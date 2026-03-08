// src/pages/app/BotKnowledgePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bot,
  getBotById,
  updateBot,
  crawlBotDomain,
  uploadBotDocuments,
  getBotCrawlStatus,
  estimateBotDocuments,
  getBotCrawlHistory,
  deactivateBotKnowledgeJob
} from "../../api/bots";
import { useTranslation } from "react-i18next";

type KnowledgeJobType = "domain" | "docs";

type CrawlJobView = {
  id: string;
  clientId: string;
  status: "queued" | "running" | "completed" | "failed";
  isActive: boolean;

  jobType: KnowledgeJobType;
  origin: string;

  domain: string;
  startUrl: string;

  pagesVisited: number;
  pagesStored: number;
  chunksStored: number;
  totalPagesEstimated: number | null;
  percent: number | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;

  // UI-only
  _optimistic?: boolean;
};

const DASH = "—";

function formatDate(iso: string | null | undefined) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString();
}

/**
 * Docs ingest uses a "namespace domain" for grouping/storage, NOT the file's origin.
 * Backend normalizes to host when possible. We mimic that here for optimistic rows.
 */
function normalizeDocsNamespaceDomain(input: string | null | undefined): string {
  const raw = (input || "").trim();
  if (!raw) return "uploaded-docs";

  try {
    // Handles "https://example.com/path"
    const u = new URL(raw);
    return u.hostname || "uploaded-docs";
  } catch {
    // Handles "example.com", or "example.com/path"
    const noProto = raw.replace(/^https?:\/\//i, "");
    const host = noProto.split("/")[0]?.trim();
    return host || "uploaded-docs";
  }
}

/**
 * Safety fallback if older API responses don't include `origin` properly.
 * Domain: origin = domain
 * Docs: origin = filename from startUrl (file://local/<name>)
 */
function deriveOriginFallback(
  job: Pick<CrawlJobView, "jobType" | "origin" | "domain" | "startUrl">,
  uploadedDocumentLabel: string
): string {
  if (job.origin) return job.origin;
  if (job.jobType === "domain") return job.domain || DASH;

  // docs fallback: extract filename from startUrl
  const s = job.startUrl || "";
  const last =
    s
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .filter(Boolean)
      .pop() || "";
  try {
    return decodeURIComponent(last) || uploadedDocumentLabel;
  } catch {
    return last || uploadedDocumentLabel;
  }
}

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 6000;

const BotKnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [domain, setDomain] = useState<string>("");

  const [crawlEstimate, setCrawlEstimate] = useState<any | null>(null);
  const [crawlEstimateId, setCrawlEstimateId] = useState<string | null>(null);
  const [crawlEstimateLoading, setCrawlEstimateLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    kind: "crawl" | "docs";
    requiredTokens: number;
    remainingTokens: number | null;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ✅ Crawl history (paginated)
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalItems, setHistoryTotalItems] = useState(0);
  const [historyJobs, setHistoryJobs] = useState<CrawlJobView[]>([]);
  const [refreshingJobIds, setRefreshingJobIds] = useState<Record<string, boolean>>({});
  const [deactivatingJobIds, setDeactivatingJobIds] = useState<Record<string, boolean>>({});

  const autoTimerRef = useRef<number | null>(null);
  const autoRefreshingRef = useRef(false);

  const isActive = bot?.status === "ACTIVE";

  const knowledgeMissing =
    (bot?.useDomainCrawler || bot?.usePdfCrawler) && !bot?.knowledgeClientId;

  const loadHistoryPage = async (botId: string, page: number) => {
    setHistoryLoading(true);
    try {
      const resp = await getBotCrawlHistory(botId, page);
      setHistoryPage(resp.page);
      setHistoryTotalPages(resp.totalPages);
      setHistoryTotalItems(resp.totalItems);
      setHistoryJobs((resp.jobs || []) as CrawlJobView[]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    getBotById(id)
      .then(async (data) => {
        setBot(data);
        setDomain(data.domain || "");

        if (data.knowledgeClientId) {
          await loadHistoryPage(id, 1);
        } else {
          setHistoryPage(1);
          setHistoryTotalPages(1);
          setHistoryTotalItems(0);
          setHistoryJobs([]);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botKnowledge.errors.loadBot"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  const visibleRunningJobIds = useMemo(() => {
    return historyJobs
      .filter((j) => !j._optimistic && (j.status === "running" || j.status === "queued"))
      .map((j) => j.id);
  }, [historyJobs]);

  const refreshJobRow = async (jobId: string) => {
    if (!id) return;
    setRefreshingJobIds((m) => ({ ...m, [jobId]: true }));
    try {
      const resp = await getBotCrawlStatus(id, jobId);
      const job = resp?.job as CrawlJobView | undefined;
      if (job) {
        setHistoryJobs((prev) => prev.map((x) => (x.id === job.id ? job : x)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingJobIds((m) => ({ ...m, [jobId]: false }));
    }
  };

  const refreshVisibleRunningRows = async () => {
    if (!id) return;
    if (visibleRunningJobIds.length === 0) return;
    if (autoRefreshingRef.current) return;

    autoRefreshingRef.current = true;
    try {
      const results = await Promise.allSettled(
        visibleRunningJobIds.map((jobId) => getBotCrawlStatus(id, jobId))
      );

      const updated: Record<string, CrawlJobView> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          const job = r.value?.job as CrawlJobView | undefined;
          if (job?.id) updated[job.id] = job;
        }
      }

      if (Object.keys(updated).length > 0) {
        setHistoryJobs((prev) => prev.map((j) => updated[j.id] ?? j));
      }
    } finally {
      autoRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    if (visibleRunningJobIds.length === 0) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    if (autoTimerRef.current) return;

    refreshVisibleRunningRows().catch(() => {});
    autoTimerRef.current = window.setInterval(() => {
      refreshVisibleRunningRows().catch(() => {});
    }, AUTO_REFRESH_MS) as any;

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRunningJobIds.join("|")]);

  const handleSaveSettings: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!id || !bot) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateBot(id, {
        domain: domain || null
      });
      setBot(updated);
      setSuccess(t("botKnowledge.success.settingsUpdated"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.updateSettings"));
    } finally {
      setSaving(false);
    }
  };

  const handleCrawlDomain = async () => {
    if (!id || !bot) return;

    if (bot.status !== "ACTIVE") {
      setError(t("botKnowledge.errors.mustBeActiveToCrawl"));
      return;
    }

    if (!domain.trim()) {
      setError(t("botKnowledge.errors.domainRequired"));
      return;
    }

    if (!bot.useDomainCrawler) {
      setError(t("botKnowledge.errors.domainCrawlerDisabled"));
      return;
    }

    setError(null);
    setSuccess(null);
    setCrawlEstimateLoading(true);
    setCrawlEstimate(null);
    setCrawlEstimateId(null);

    try {
      const preflight = await crawlBotDomain(id, domain.trim());
      if (preflight && "status" in preflight && preflight.status === "estimate") {
        const estimate = preflight.estimate ?? null;
        setCrawlEstimate(estimate);
        setCrawlEstimateId(preflight.estimateId ?? null);

        if (preflight.canProceed === false) {
          const required = preflight.requiredTokens ?? estimate?.tokensEstimated ?? 0;
          const remaining = preflight.remainingTokens ?? 0;
          setError(
            t("botKnowledge.errors.crawlLimitExceeded", {
              required: required.toLocaleString(),
              remaining: remaining.toLocaleString()
            })
          );
          return;
        }

        const requiredTokens = preflight.requiredTokens ?? estimate?.tokensEstimated ?? 0;
        const remainingTokens = preflight.remainingTokens ?? null;

        setConfirmModal({
          kind: "crawl",
          requiredTokens,
          remainingTokens,
          onConfirm: async () => {
            setCrawlLoading(true);
            const resp = await crawlBotDomain(id, domain.trim(), {
              confirm: true,
              estimateId: preflight.estimateId ?? null
            });
            if (!resp || !("jobId" in resp)) {
              throw new Error(t("botKnowledge.errors.crawlFailed"));
            }

            setCrawlEstimate(resp.estimate ?? estimate ?? null);
            setSuccess(
              t("botKnowledge.success.domainCrawlStartedJob", {
                domain: resp.domain,
                jobId: resp.jobId
              })
            );

            const refreshed = await getBotById(id);
            setBot(refreshed);

            await loadHistoryPage(id, 1);
          }
        });

        return;
      }

      const resp = await crawlBotDomain(id, domain.trim(), { confirm: true });
      if (!resp || !("jobId" in resp)) {
        throw new Error(t("botKnowledge.errors.crawlFailed"));
      }

      setCrawlEstimate(resp.estimate ?? preflight?.estimate ?? null);
      setSuccess(
        t("botKnowledge.success.domainCrawlStartedJob", {
          domain: resp.domain,
          jobId: resp.jobId
        })
      );

      const refreshed = await getBotById(id);
      setBot(refreshed);

      await loadHistoryPage(id, 1);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.crawlFailed"));
    } finally {
      setCrawlEstimateLoading(false);
      setCrawlLoading(false);
    }
  };

  function makeOptimisticDocRows(files: FileList | File[], namespaceDomain: string): CrawlJobView[] {
    const now = new Date().toISOString();
    return Array.from(files as any[]).map((f: any, idx: number) => {
      const fileName = String(f?.name || `document-${idx + 1}`);
      const optimisticId = `optimistic-doc-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`;

      return {
        id: optimisticId,
        clientId: bot?.knowledgeClientId || "pending",
        status: "running",
        jobType: "docs",
        origin: fileName,

        // Storage namespace (NOT origin)
        domain: namespaceDomain,

        // Match backend: docs jobs use file://local/<filename> so origin stays filename after completion
        startUrl: `file://local/${encodeURIComponent(fileName)}`,

        pagesVisited: 0,
        pagesStored: 0,
        chunksStored: 0,
        totalPagesEstimated: 1,
        percent: null,
        errorMessage: null,
        tokensUsed: null,
        createdAt: now,
        startedAt: now,
        finishedAt: null,
        updatedAt: now,
        _optimistic: true
      };
    });
  }

  const handleUploadDocs: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (!id || !bot) return;

    if (bot.status !== "ACTIVE") {
      setError(t("botKnowledge.errors.mustBeActiveToUpload"));
      e.target.value = "";
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;
    const inputEl = e.target;
    const fileList = Array.from(files);

    if (!bot.usePdfCrawler) {
      setError(t("botKnowledge.errors.pdfUploadDisabled"));
      e.target.value = "";
      return;
    }

    setError(null);
    setSuccess(null);
    setUploadLoading(true);

    try {
      const estResp = await estimateBotDocuments(id, fileList);
      const estimate = estResp?.estimate;

      if (estimate?.totalTokensEstimated != null) {
        const requiredTokens = estimate.totalTokensEstimated ?? 0;
        setConfirmModal({
          kind: "docs",
          requiredTokens,
          remainingTokens: null,
          onConfirm: async () => {
            setUploadLoading(true);
            const namespaceDomain = normalizeDocsNamespaceDomain(bot.domain) || "uploaded-docs";

            setHistoryPage(1);
            setHistoryJobs((prev) => {
              const optimistic = makeOptimisticDocRows(fileList, namespaceDomain);
              const merged = [...optimistic, ...prev];
              return merged.slice(0, PAGE_SIZE);
            });

            const resp = await uploadBotDocuments(id, fileList);

            setSuccess(
              t("botKnowledge.success.uploadedDocs", {
                count: resp.files.length,
                files: resp.files.join(", ")
              })
            );

            const refreshed = await getBotById(id);
            setBot(refreshed);

            await loadHistoryPage(id, 1);

            inputEl.value = "";
          }
        });

        return;
      }

      // Add optimistic rows immediately so the user sees "running" instantly.
      // IMPORTANT: for docs, "origin" is the filename; domain is only a storage namespace.
      const namespaceDomain = normalizeDocsNamespaceDomain(bot.domain) || "uploaded-docs";

      // Ensure we're on page 1 so newest rows show at top
      setHistoryPage(1);

      setHistoryJobs((prev) => {
        const optimistic = makeOptimisticDocRows(fileList, namespaceDomain);
        const merged = [...optimistic, ...prev];
        return merged.slice(0, PAGE_SIZE);
      });

      const resp = await uploadBotDocuments(id, fileList);

      setSuccess(
        t("botKnowledge.success.uploadedDocs", {
          count: resp.files.length,
          files: resp.files.join(", ")
        })
      );

      const refreshed = await getBotById(id);
      setBot(refreshed);

      // Replace optimistic rows with real jobs from backend
      await loadHistoryPage(id, 1);

      inputEl.value = "";
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.uploadFailed"));
      setHistoryJobs((prev) => prev.filter((j) => !j._optimistic));
    } finally {
      setUploadLoading(false);
    }
  };

  const handleGoPrev = async () => {
    if (!id) return;
    const next = Math.max(1, historyPage - 1);
    if (next === historyPage) return;
    setError(null);
    await loadHistoryPage(id, next);
  };

  const handleGoNext = async () => {
    if (!id) return;
    const next = Math.min(historyTotalPages, historyPage + 1);
    if (next === historyPage) return;
    setError(null);
    await loadHistoryPage(id, next);
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botKnowledge.missingId")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <p>{t("botKnowledge.loadingBot")}</p>
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="page-container">
        <h1>{t("common.error")}</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="page-container">
        <h1>{t("botKnowledge.notFound")}</h1>
      </div>
    );
  }

  const uploadedDocumentLabel = t("botKnowledge.history.uploadedDocument");
  const historyLabels = {
    status: t("botKnowledge.history.table.status"),
    type: t("botKnowledge.history.table.type"),
    origin: t("botKnowledge.history.table.origin"),
    started: t("botKnowledge.history.table.started"),
    finished: t("botKnowledge.history.table.finished"),
    pages: t("botKnowledge.history.table.pages"),
    chunks: t("botKnowledge.history.table.chunks"),
    tokens: t("botKnowledge.history.table.tokens"),
    actions: t("botKnowledge.history.table.actions")
  };

  const handleDeactivateJob = async (job: CrawlJobView) => {
    if (!id || !job?.id) return;

    const ok = window.confirm(t("botKnowledge.confirm.deactivateJob"));
    if (!ok) return;

    setError(null);
    setSuccess(null);
    setDeactivatingJobIds((m) => ({ ...m, [job.id]: true }));
    try {
      const resp = await deactivateBotKnowledgeJob(id, job.id);
      setSuccess(
        t("botKnowledge.success.deactivateJob", {
          count: resp.deactivated,
          jobId: resp.jobId
        })
      );
      setHistoryJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, isActive: false } : j))
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.deactivateFailed"));
    } finally {
      setDeactivatingJobIds((m) => ({ ...m, [job.id]: false }));
    }
  };

  const handleOpenJob = (job: CrawlJobView) => {
    if (!id || !job?.id) return;
    const isRunning = job.status === "running" || job.status === "queued";
    if (isRunning || job._optimistic || job.isActive === false) return;
    navigate(`/app/bots/${id}/knowledge/jobs/${job.id}`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t("botKnowledge.title")}</h1>
          <p className="muted">{t("botKnowledge.subtitle", { botName: bot.name })}</p>
        </div>
        <Link to={`/app/bots/${bot.id}`} className="btn-secondary">
          {t("botKnowledge.backToBot")}
        </Link>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      {!isActive ? (
        <div className="alert-warning" style={{ marginBottom: "1rem" }}>
          <strong>
            {t("botKnowledge.status.knowledgeStatus")}: {t("botKnowledge.status.locked")}
          </strong>{" "}
          {t("botKnowledge.lockedBody", { status: bot.status })}{" "}
          <Link to={`/app/bots/${bot.id}/features`}>{t("botKnowledge.featuresAndPlan")}</Link>.
        </div>
      ) : knowledgeMissing ? (
        <div className="alert-warning" style={{ marginBottom: "1rem" }}>
          <strong>
            {t("botKnowledge.status.knowledgeStatus")}: {t("botKnowledge.status.missing")}
          </strong>{" "}
          {t("botKnowledge.missingBody")}
        </div>
      ) : null}

      {isActive && (
        <>
          <div className="knowledge-grid">
            <section className="knowledge-card">
              <div className="knowledge-card-header">
                <div>
                  <h3 className="knowledge-card-title">{t("botKnowledge.domainCard.title")}</h3>
                  <p className="knowledge-card-description">{t("botKnowledge.domainCard.description")}</p>
                </div>
                <span
                  className={
                    bot.useDomainCrawler ? "status-badge status-badge-ok" : "status-badge status-badge-warn"
                  }
                >
                  {bot.useDomainCrawler ? t("botKnowledge.feature.enabled") : t("botKnowledge.feature.disabled")}
                </span>
              </div>

              <form className="form" onSubmit={handleSaveSettings}>
                <label className="form-field">
                  <span>{t("botKnowledge.fields.domain")}</span>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder={t("botKnowledge.placeholders.domain")}
                  />
                  <span className="knowledge-card-muted-note">{t("botKnowledge.domainCard.domainNote")}</span>
                </label>

                <div className="knowledge-card-actions">
                  <button className="btn-primary" type="submit" disabled={saving}>
                    {saving ? t("common.saving") : t("botKnowledge.actions.saveKnowledgeSettings")}
                  </button>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={handleCrawlDomain}
                    disabled={crawlLoading || crawlEstimateLoading || !bot.useDomainCrawler}
                  >
                    {crawlEstimateLoading
                      ? t("botKnowledge.actions.estimating")
                      : crawlLoading
                      ? t("botKnowledge.actions.crawling")
                      : t("botKnowledge.actions.crawlNow")}
                  </button>
                </div>

                {crawlEstimate && (
                  <div style={{ marginTop: "0.75rem" }} className="knowledge-card-muted-note">
                    {t("botKnowledge.estimate.crawlCostLabel")}{" "}
                    <strong>
                      {crawlEstimate.tokensLow?.toLocaleString()} – {crawlEstimate.tokensHigh?.toLocaleString()}{" "}
                      {t("botKnowledge.estimate.tokensUnit")}
                    </strong>
                    {crawlEstimate.samplePages
                      ? ` ${t("botKnowledge.estimate.sampledPages", { count: crawlEstimate.samplePages })}`
                      : null}
                  </div>
                )}

                {!bot.useDomainCrawler && (
                  <p className="knowledge-card-muted-note">
                    {t("botKnowledge.domainCard.disabledNote")}{" "}
                    <Link to={`/app/bots/${bot.id}/features`}>{t("botKnowledge.featuresAndPlan")}</Link>.
                  </p>
                )}
              </form>
            </section>

            <section className="knowledge-card">
              <div className="knowledge-card-header">
                <div>
                  <h3 className="knowledge-card-title">{t("botKnowledge.docsCard.title")}</h3>
                  <p className="knowledge-card-description">{t("botKnowledge.docsCard.description")}</p>
                </div>
                <span
                  className={bot.usePdfCrawler ? "status-badge status-badge-ok" : "status-badge status-badge-warn"}
                >
                  {bot.usePdfCrawler ? t("botKnowledge.feature.enabled") : t("botKnowledge.feature.disabled")}
                </span>
              </div>

              {!bot.usePdfCrawler && (
                <p className="knowledge-card-muted-note">
                  {t("botKnowledge.docsCard.disabledNote")}{" "}
                  <Link to={`/app/bots/${bot.id}/features`}>{t("botKnowledge.featuresAndPlan")}</Link>.
                </p>
              )}

              {bot.usePdfCrawler && (
              <div className="form">
                <div className="form-field">
                  <span>{t("botKnowledge.docsCard.uploadLabel")}</span>
                  <input
                    type="file"
                    accept=".pdf,doc,docx,txt"
                    multiple
                    onChange={handleUploadDocs}
                    disabled={uploadLoading}
                  />
                  {uploadLoading && (
                    <span className="knowledge-card-muted-note">{t("botKnowledge.actions.uploading")}</span>
                  )}
                  <span className="knowledge-card-muted-note">{t("botKnowledge.docsCard.supportedFormats")}</span>
                </div>
              </div>
              )}
            </section>
          </div>

          {/* ✅ Crawl History Table */}
          <div style={{ marginTop: "1.25rem" }}>
            <div className="page-header" style={{ alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0 }}>{t("botKnowledge.history.title")}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {t("botKnowledge.history.autoRefreshNote", {
                    seconds: Math.round(AUTO_REFRESH_MS / 1000)
                  })}
                </p>
              </div>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => id && loadHistoryPage(id, historyPage)}
                disabled={historyLoading || !bot.knowledgeClientId}
              >
                {historyLoading ? t("botKnowledge.history.refreshingPage") : t("botKnowledge.history.refreshPage")}
              </button>
            </div>

            <div className="table-responsive crawl-history-table-wrapper">
              <table className="table crawl-history-table">
                <thead>
                  <tr>
                    <th>{historyLabels.status}</th>
                    <th>{historyLabels.type}</th>
                    <th>{historyLabels.origin}</th>
                    <th>{historyLabels.started}</th>
                    <th>{historyLabels.finished}</th>
                    <th>{historyLabels.pages}</th>
                    <th>{historyLabels.chunks}</th>
                    <th>{historyLabels.tokens}</th>
                    <th className="crawl-history-actions-header">{historyLabels.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {!bot.knowledgeClientId ? (
                    <tr>
                      <td colSpan={9} className="muted">
                        {t("botKnowledge.history.empty.noClient")}
                      </td>
                    </tr>
                  ) : historyJobs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="muted">
                        {historyLoading ? t("botKnowledge.history.loadingRows") : t("botKnowledge.history.empty.noRuns")}
                      </td>
                    </tr>
                  ) : (
                    historyJobs.map((j) => {
                      const isRunning = j.status === "running" || j.status === "queued";
                      const refreshing = !!refreshingJobIds[j.id];
                      const deactivating = !!deactivatingJobIds[j.id];
                      const isOptimistic = !!j._optimistic;

                      const originText = deriveOriginFallback(j, uploadedDocumentLabel);
                      const storageNamespace = j.domain || "uploaded-docs";

                      const isDeactivated = j.isActive === false;
                      const statusLabel = isDeactivated
                        ? t("botKnowledge.history.status.deactivated")
                        : t(`botKnowledge.history.status.${j.status}`);
                      const typeLabel =
                        j.jobType === "docs"
                          ? t("botKnowledge.history.jobType.docs")
                          : t("botKnowledge.history.jobType.domain");

                      return (
                        <tr
                          key={j.id}
                          className={
                            !isRunning && !isOptimistic && !isDeactivated
                              ? "crawl-history-row--clickable"
                              : undefined
                          }
                          onClick={() => handleOpenJob(j)}
                        >
                          <td className="crawl-history-status-cell" data-label={historyLabels.status}>
                            <span
                              className={
                                isDeactivated
                                  ? "status-badge status-badge-warn"
                                  : j.status === "completed"
                                  ? "status-badge status-badge-ok"
                                  : j.status === "failed"
                                  ? "status-badge status-badge-warn"
                                  : "status-badge"
                              }
                            >
                              {statusLabel}
                            </span>
                            {j.errorMessage ? (
                              <div className="muted" style={{ marginTop: 4 }}>
                                {j.errorMessage}
                              </div>
                            ) : null}
                            {isOptimistic ? (
                              <div className="muted" style={{ marginTop: 4 }}>
                                {t("botKnowledge.history.uploadInProgress")}
                              </div>
                            ) : null}
                          </td>

                          <td data-label={historyLabels.type}>
                            <span className="status-badge">{typeLabel}</span>
                          </td>

                          <td className="crawl-history-origin" data-label={historyLabels.origin}>
                            <div className="crawl-history-origin-text">
                              {originText || DASH}
                            </div>

                            {/* IMPORTANT: do NOT show domain as "origin" for docs.
                               If you want to show it, label it as storage/namespace. */}
                            {j.jobType === "docs" ? (
                              <div className="muted" style={{ marginTop: 4 }}>
                                {t("botKnowledge.history.storedUnder", { namespace: storageNamespace })}
                              </div>
                            ) : null}
                          </td>

                          <td data-label={historyLabels.started}>{formatDate(j.startedAt || j.createdAt)}</td>
                          <td data-label={historyLabels.finished}>{formatDate(j.finishedAt)}</td>
                          <td data-label={historyLabels.pages}>
                            {j.pagesVisited}
                            {j.totalPagesEstimated ? ` / ~${j.totalPagesEstimated}` : ""}
                            {j.percent != null ? ` (${j.percent}%)` : ""}
                          </td>
                          <td data-label={historyLabels.chunks}>
                            {j.chunksStored}{" "}
                            <span className="muted">
                              ({t("botKnowledge.history.pagesStored", { count: j.pagesStored })})
                            </span>
                          </td>
                          <td data-label={historyLabels.tokens}>
                            {j.tokensUsed != null ? (j.tokensUsed / 10).toLocaleString() : DASH}
                          </td>
                          <td className="crawl-history-actions-cell" data-label={historyLabels.actions}>
                            <button
                              className="btn-secondary"
                              type="button"
                              disabled={isOptimistic || !isRunning || refreshing}
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshJobRow(j.id);
                              }}
                            >
                              {refreshing ? t("botKnowledge.history.refreshingRow") : t("botKnowledge.history.refreshRow")}
                            </button>
                            <button
                              className="btn-secondary"
                              type="button"
                              disabled={isOptimistic || isRunning || refreshing || deactivating || isDeactivated}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivateJob(j);
                              }}
                            >
                              {deactivating
                                ? t("botKnowledge.history.deactivating")
                                : t("botKnowledge.history.deactivate")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="crawl-history-footer">
              <div className="muted">
                {t("botKnowledge.history.footer", {
                  shown: historyJobs.length,
                  total: historyTotalItems,
                  page: historyPage,
                  totalPages: historyTotalPages,
                  pageSize: PAGE_SIZE
                })}
              </div>
              <div className="crawl-history-footer-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={handleGoPrev}
                  disabled={historyLoading || historyPage <= 1 || !bot.knowledgeClientId}
                >
                  {t("botKnowledge.history.prev")}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={handleGoNext}
                  disabled={historyLoading || historyPage >= historyTotalPages || !bot.knowledgeClientId}
                >
                  {t("botKnowledge.history.next")}
                </button>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              {t("botKnowledge.history.tokenUsageNote")}
            </p>
          </div>
        </>
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
              <h2 style={{ margin: 0 }}>
                {confirmModal.kind === "crawl"
                  ? t("botKnowledge.modal.crawlTitle")
                  : t("botKnowledge.modal.docsTitle")}
              </h2>
              <button type="button" onClick={() => setConfirmModal(null)}>
                ×
              </button>
            </div>
            <div className="meta-page-select-modal-body">
              <p className="muted">
                {confirmModal.kind === "crawl"
                  ? t("botKnowledge.modal.crawlBody")
                  : t("botKnowledge.modal.docsBody")}
              </p>
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
                    setError(err?.message || t("botKnowledge.errors.crawlFailed"));
                  } finally {
                    setCrawlEstimateLoading(false);
                    setCrawlLoading(false);
                    setUploadLoading(false);
                  }
                }}
              >
                {t("botKnowledge.modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotKnowledgePage;
