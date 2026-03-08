// src/pages/onboarding/OnboardingKnowledgePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import OnboardingLayout from "./OnboardingLayout";
import {
  Bot,
  getBotById,
  updateBot,
  crawlBotDomain,
  getBotCrawlStatus,
} from "../../api/bots";

type CrawlUiStatus = "idle" | "running" | "completed" | "failed";

interface KnowledgeCrawlJobResponse {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    errorMessage?: string | null;
  };
}

const POLL_MS = 4000;

const OnboardingKnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);

  const [domainInput, setDomainInput] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  const [crawlStatus, setCrawlStatus] = useState<CrawlUiStatus>("idle");
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    requiredTokens: number;
    remainingTokens: number | null;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    getBotById(id)
      .then((b) => {
        setBot(b);
        setDomainInput(b.domain || "");

        // If they already have knowledge, we treat it as completed
        if (b.knowledgeClientId && b.domain) {
          setCrawlStatus("completed");
          setCrawlMessage(
            t(
              "botKnowledge.onboarding.status.readyExisting",
              "Your content is already indexed. You can re-index anytime to keep Coslo up to date."
            )
          );
        } else {
          setCrawlStatus("idle");
        }
      })
      .catch((err: any) => {
        console.error(err);
        setError(
          err?.message ||
            t(
              "botKnowledge.onboarding.errors.loadBot",
              "Unable to load this bot right now."
            )
        );
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  // Poll only the crawl started from THIS page
  useEffect(() => {
    if (!id || !crawlJobId) return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const resp = (await getBotCrawlStatus(
          id,
          crawlJobId
        )) as KnowledgeCrawlJobResponse;

        if (cancelled || !resp.job) return;

        const job = resp.job;

        if (job.status === "completed") {
          setCrawlStatus("completed");
          setCrawlMessage(
            t(
              "botKnowledge.onboarding.status.completed",
              "Knowledge ready. Coslo now understands your website."
            )
          );
          if (timer) window.clearInterval(timer);
        } else if (job.status === "failed") {
          setCrawlStatus("failed");
          setCrawlMessage(
            job.errorMessage ||
              t(
                "botKnowledge.onboarding.status.failed",
                "The crawl failed. Check your domain and try again."
              )
          );
          if (timer) window.clearInterval(timer);
        } else {
          setCrawlStatus("running");
          setCrawlMessage(
            t(
              "botKnowledge.onboarding.status.running",
              "Indexing in progress. You can already use your bot while we finish crawling."
            )
          );
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setCrawlMessage(
            t(
              "botKnowledge.onboarding.status.pollError",
              "We’re having trouble refreshing the status, but the crawl is still running."
            )
          );
        }
      }
    };

    tick().catch(() => {});
    timer = window.setInterval(() => {
      tick().catch(() => {});
    }, POLL_MS) as any;

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [id, crawlJobId, t]);

  // Status pill tone
  let statusLabel: string;
  let statusTone: "neutral" | "info" | "success" | "warn" = "neutral";

  switch (crawlStatus) {
    case "running":
      statusLabel = t(
        "botKnowledge.onboarding.statusPill.running",
        "Indexing in progress"
      );
      statusTone = "info";
      break;
    case "completed":
      statusLabel = t(
        "botKnowledge.onboarding.statusPill.completed",
        "Knowledge ready"
      );
      statusTone = "success";
      break;
    case "failed":
      statusLabel = t(
        "botKnowledge.onboarding.statusPill.failed",
        "Crawl failed"
      );
      statusTone = "warn";
      break;
    default:
      statusLabel = t(
        "botKnowledge.onboarding.statusPill.idle",
        "Not started yet"
      );
  }

  const canStartCrawl =
    !!domainInput.trim() && !crawlLoading && !!bot && id != null;

  const hasExistingKnowledge = !!bot?.domain && !!bot?.knowledgeClientId;

  // Only enable "Go to dashboard" once knowledge exists
  const canGoToDashboard =
    crawlStatus === "completed" || hasExistingKnowledge;

  const handleSaveDomain: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!id || !bot) return;

    setSavingDomain(true);
    setError(null);

    try {
      const updated = await updateBot(id, {
        domain: domainInput.trim() || null
      });
      setBot(updated);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t(
            "botKnowledge.onboarding.errors.saveDomain",
            "Unable to save this domain."
          )
      );
    } finally {
      setSavingDomain(false);
    }
  };

  const handleStartCrawl = async () => {
    if (!id || !bot || !domainInput.trim()) return;

    setError(null);
    setCrawlLoading(true);
    setCrawlStatus("idle");
    setCrawlMessage(null);

    try {
      const updated = await updateBot(id, { domain: domainInput.trim() });
      setBot(updated);

      const preflight = await crawlBotDomain(id, domainInput.trim());
      if (preflight && "status" in preflight && preflight.status === "estimate") {
        if (preflight.canProceed === false) {
          const required = preflight.requiredTokens ?? 0;
          const remaining = preflight.remainingTokens ?? 0;
          setError(
            t(
              "botKnowledge.errors.crawlLimitExceeded",
              "This crawl would exceed your monthly limit ({{required}} needed, {{remaining}} remaining).",
              {
                required: required.toLocaleString(),
                remaining: remaining.toLocaleString()
              }
            )
          );
          return;
        }

        const requiredTokens = preflight.requiredTokens ?? preflight.estimate?.tokensEstimated ?? 0;
        const remainingTokens = preflight.remainingTokens ?? null;

        setConfirmModal({
          requiredTokens,
          remainingTokens,
          onConfirm: async () => {
            setCrawlLoading(true);
            setCrawlStatus("running");
            setCrawlMessage(
              t(
                "botKnowledge.onboarding.status.running",
                "Indexing in progress. You can already use your bot while we finish crawling."
              )
            );

            const resp = await crawlBotDomain(id, domainInput.trim(), {
              confirm: true,
              estimateId: preflight.estimateId ?? null
            });
            if (!resp || !("jobId" in resp)) {
              throw new Error(
                t(
                  "botKnowledge.onboarding.errors.crawlFailed",
                  "We couldn't start the crawl. Please check your domain and try again."
                )
              );
            }
            setCrawlJobId(resp.jobId);
          }
        });

        return;
      }

      const resp = await crawlBotDomain(id, domainInput.trim(), { confirm: true });
      if (!resp || !("jobId" in resp)) {
        throw new Error(
          t(
            "botKnowledge.onboarding.errors.crawlFailed",
            "We couldn't start the crawl. Please check your domain and try again."
          )
        );
      }
      setCrawlJobId(resp.jobId);
    } catch (err: any) {
      console.error(err);
      setCrawlStatus("failed");
      setCrawlMessage(
        err?.message ||
          t(
            "botKnowledge.onboarding.errors.crawlFailed",
            "We couldn’t start the crawl. Please check your domain and try again."
          )
      );
    } finally {
      setCrawlLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/app/dashboard");
  };

  return (
    <OnboardingLayout
      currentStep="knowledge"
      botId={id}
      layout="full"
      title={t(
        "botKnowledge.onboarding.title",
        "We’re preparing your bot’s knowledge"
      )}
      subtitle={t(
        "botKnowledge.onboarding.subtitle",
        "Connect your website so Coslo can crawl it and answer detailed, up-to-date questions."
      )}
    >
      {loading ? (
        <div className="knowledge-shell">
          <p className="muted">Loading…</p>
        </div>
      ) : (
        <div className="knowledge-shell">
          <section className="knowledge-hero knowledge-hero--light">
            <div className="knowledge-hero-inner">
              {/* LEFT SIDE */}
              <div className="knowledge-main">
                <div className="knowledge-status-row">
                  <span
                    className={[
                      "knowledge-status-pill",
                      `knowledge-status-pill--${statusTone}`
                    ].join(" ")}
                  >
                    {statusLabel}
                  </span>
                  {crawlMessage && (
                    <span className="knowledge-status-caption">
                      {crawlMessage}
                    </span>
                  )}
                </div>

                <h2 className="knowledge-main-title">
                  {t(
                    "botKnowledge.onboarding.heroTitle",
                    "Teach Coslo about your website in one click"
                  )}
                </h2>
                <p className="knowledge-main-copy">
                  {t(
                    "botKnowledge.onboarding.heroBody",
                    "We’ll crawl your main domain to extract FAQs, help articles and key pages so your assistant feels like a real member of your team."
                  )}
                </p>

                {error && (
                  <div className="alert alert-warn knowledge-alert">
                    {error}
                  </div>
                )}

                <form
                  className="knowledge-form"
                  onSubmit={handleSaveDomain}
                  autoComplete="off"
                >
                  <label className="knowledge-field">
                    <span className="knowledge-field-label">
                      {t(
                        "botKnowledge.onboarding.domainLabel",
                        "Website domain"
                      )}
                    </span>
                    <div className="knowledge-domain-row">
                      <div className="knowledge-domain-input-wrap">
                        <span className="knowledge-domain-prefix">🌐</span>
                        <input
                          type="url"
                          className="knowledge-input"
                          placeholder={t(
                            "botKnowledge.onboarding.domainPlaceholder",
                            "https://your-website.com"
                          )}
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn-secondary btn-color"
                        disabled={savingDomain || !domainInput.trim()}
                      >
                        {savingDomain
                          ? t(
                              "botKnowledge.onboarding.savingDomain",
                              "Saving…"
                            )
                          : t(
                              "botKnowledge.onboarding.saveDomain",
                              "Save domain"
                            )}
                      </button>
                    </div>
                    <p className="knowledge-field-hint">
                      {t(
                        "botKnowledge.onboarding.domainHint",
                        "We only use publicly available pages and always respect your robots.txt."
                      )}
                    </p>
                  </label>
                </form>

                <div className="knowledge-actions">
                  <button
                    type="button"
                    className="btn-primary knowledge-primary-cta btn-color"
                    onClick={handleStartCrawl}
                    disabled={!canStartCrawl}
                  >
                    {crawlLoading || crawlStatus === "running"
                      ? t(
                          "botKnowledge.onboarding.btnIndexing",
                          "Indexing website…"
                        )
                      : crawlStatus === "completed"
                      ? t(
                          "botKnowledge.onboarding.btnReindex",
                          "Re-index website"
                        )
                      : t(
                          "botKnowledge.onboarding.btnStartIndexing",
                          "Start indexing"
                        )}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary knowledge-secondary-cta btn-color"
                    onClick={handleGoToDashboard}
                    disabled={!canGoToDashboard}
                  >
                    {t(
                      "botKnowledge.onboarding.goToDashboard",
                      "Go to dashboard"
                    )}
                  </button>
                </div>

                {!canGoToDashboard && (
                  <p className="knowledge-dash-hint">
                    {t(
                      "botKnowledge.onboarding.dashboardHint",
                      "We’ll unlock the dashboard button right after the first index is completed."
                    )}
                  </p>
                )}
              </div>

              {/* RIGHT SIDE */}
              <aside className="knowledge-side knowledge-side--light">
                <div className="knowledge-orb">
                  <div className="knowledge-orb-inner">
                    <div className="knowledge-orb-pulse" />
                    <div className="knowledge-orb-core">
                      <span>⚡</span>
                    </div>
                  </div>
                </div>

                <div className="knowledge-steps">
                  <div
                    className={[
                      "knowledge-step",
                      domainInput.trim()
                        ? "knowledge-step--done"
                        : "knowledge-step--idle"
                    ].join(" ")}
                  >
                    <span className="knowledge-step-bullet" />
                    <div className="knowledge-step-body">
                      <div className="knowledge-step-title">
                        {t(
                          "botKnowledge.onboarding.step1.title",
                          "Connect your domain"
                        )}
                      </div>
                      <div className="knowledge-step-text">
                        {t(
                          "botKnowledge.onboarding.step1.text",
                          "Add the main website your customers use."
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      "knowledge-step",
                      crawlStatus === "running"
                        ? "knowledge-step--active"
                        : crawlStatus === "completed"
                        ? "knowledge-step--done"
                        : "knowledge-step--idle"
                    ].join(" ")}
                  >
                    <span className="knowledge-step-bullet" />
                    <div className="knowledge-step-body">
                      <div className="knowledge-step-title">
                        {t(
                          "botKnowledge.onboarding.step2.title",
                          "Coslo crawls your pages"
                        )}
                      </div>
                      <div className="knowledge-step-text">
                        {t(
                          "botKnowledge.onboarding.step2.text",
                          "We follow links, extract content and clean it up."
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      "knowledge-step",
                      crawlStatus === "completed" || hasExistingKnowledge
                        ? "knowledge-step--done"
                        : "knowledge-step--idle"
                    ].join(" ")}
                  >
                    <span className="knowledge-step-bullet" />
                    <div className="knowledge-step-body">
                      <div className="knowledge-step-title">
                        {t(
                          "botKnowledge.onboarding.step3.title",
                          "Your bot answers like a pro"
                        )}
                      </div>
                      <div className="knowledge-step-text">
                        {t(
                          "botKnowledge.onboarding.step3.text",
                          "Use Coslo in any channel, backed by your site’s content."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {confirmModal && (
        <div
          className="meta-page-select-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="meta-page-select-modal" role="dialog" aria-modal="true">
            <div className="meta-page-select-modal-header">
              <h2 style={{ margin: 0 }}>{t("botKnowledge.modal.crawlTitle")}</h2>
              <button type="button" onClick={() => setConfirmModal(null)}>
                ×
              </button>
            </div>
            <div className="meta-page-select-modal-body">
              <p className="muted">{t("botKnowledge.modal.crawlBody")}</p>
              <div className="form-fieldset" style={{ marginTop: "0.8rem" }}>
                <div className="form-row">
                  <label>
                    <span>{t("botKnowledge.modal.estimatedTokens")}</span>
                    <strong style={{ display: "block", marginTop: "0.2rem" }}>
                      {confirmModal.requiredTokens.toLocaleString()} {t("botKnowledge.estimate.tokensUnit")}
                    </strong>
                  </label>
                  {confirmModal.remainingTokens != null && (
                    <label>
                      <span>{t("botKnowledge.modal.remainingTokens")}</span>
                      <strong style={{ display: "block", marginTop: "0.2rem" }}>
                        {confirmModal.remainingTokens.toLocaleString()} {t("botKnowledge.estimate.tokensUnit")}
                      </strong>
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="meta-page-select-modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)}>
                {t("botKnowledge.modal.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  try {
                    await action();
                  } catch (err: any) {
                    console.error(err);
                    setError(
                      err?.message ||
                        t(
                          "botKnowledge.onboarding.errors.crawlFailed",
                          "We couldn't start the crawl. Please check your domain and try again."
                        )
                    );
                    setCrawlStatus("failed");
                  } finally {
                    setCrawlLoading(false);
                  }
                }}
              >
                {t("botKnowledge.modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </OnboardingLayout>
  );
};

export default OnboardingKnowledgePage;
