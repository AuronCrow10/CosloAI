import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FileText, Globe, Loader2, ShoppingBag } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  CrawlEstimateResponse,
  crawlBotDomain,
  estimateBotDocuments,
  getBotCrawlHistory,
  getBotCrawlEstimateStatus,
  getBotCrawlStatus,
  getBotById,
  updateBot,
  uploadBotDocuments
} from "@/api/bots";
import {
  fetchShopifyShops,
  linkShopifyShop,
  syncShopifyProducts,
  type ShopifyShopSummary
} from "@/api/shopify";
import { API_BASE_URL } from "@/api/client";

type CrawlUiStatus = "idle" | "running" | "completed" | "failed";
type RagMode = "website" | "docs";

const POLL_MS = 4000;
const ESTIMATE_POLL_MS = 1500;
const MAX_ESTIMATE_STATUS_ERRORS = 10;
const SHOP_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const OnboardingKnowledge = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Domain crawl states (RAG)
  const [domainInput, setDomainInput] = useState("");
  const [ragMode, setRagMode] = useState<RagMode>("website");
  const [crawlStatus, setCrawlStatus] = useState<CrawlUiStatus>("idle");
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [estimatePending, setEstimatePending] = useState(false);
  const [knowledgeReady, setKnowledgeReady] = useState(false);
  const [docsKnowledgeReady, setDocsKnowledgeReady] = useState(false);
  const [docsFiles, setDocsFiles] = useState<File[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    requiredTokens: number;
    remainingTokens: number | null;
    estimateId: string | null;
  } | null>(null);
  const [docsConfirmModal, setDocsConfirmModal] = useState<{
    files: File[];
    requiredTokens: number;
  } | null>(null);
  const docsInputRef = useRef<HTMLInputElement | null>(null);

  // Shopify states
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shops, setShops] = useState<ShopifyShopSummary[]>([]);
  const [shopDomain, setShopDomain] = useState("");
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  const isShopify = bot?.knowledgeSource === "SHOPIFY";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadBot = async () => {
      setLoading(true);
      setError(null);

      try {
        const b = await getBotById(id);
        if (cancelled) return;

        setBot(b);
        setDomainInput(b.domain || "");

        if (b.knowledgeSource !== "SHOPIFY") {
          setRagMode(b.domain ? "website" : "docs");

          let hasReadyKnowledge = false;
          let hasReadyDocsKnowledge = false;
          if (b.knowledgeClientId) {
            try {
              const history = await getBotCrawlHistory(id, 1);
              const completedJobs = (history.jobs || []).filter(
                (job) => job.status === "completed" && job.isActive !== false
              );
              hasReadyKnowledge = completedJobs.length > 0;
              hasReadyDocsKnowledge = completedJobs.some(
                (job) => job.jobType === "docs"
              );
            } catch (historyErr) {
              console.error(historyErr);
            }
          }

          if (!hasReadyKnowledge && b.domain && b.knowledgeClientId) {
            hasReadyKnowledge = true;
          }

          if (cancelled) return;
          setKnowledgeReady(hasReadyKnowledge);
          setDocsKnowledgeReady(hasReadyDocsKnowledge);
          if (hasReadyKnowledge) {
            setCrawlStatus("completed");
            setCrawlMessage(t("botKnowledge.onboarding.status.readyExisting"));
          } else {
            setCrawlStatus("idle");
            setCrawlMessage(null);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(
            err?.message ||
              t("botKnowledge.onboarding.errors.loadBot", "Failed to load bot.")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadBot();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const loadShopify = async () => {
    if (!id) return;
    setShopifyLoading(true);
    try {
      const resp = await fetchShopifyShops(id);
      const items = resp.items || [];
      setShops(items);
      const active = items.find((s) => s.isActive) || items[0];
      if (active?.shopDomain && !shopDomain) {
        setShopDomain(active.shopDomain);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShopifyLoading(false);
    }
  };

  useEffect(() => {
    if (!id || !isShopify) return;
    loadShopify().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isShopify]);

  // Poll crawl job
  useEffect(() => {
    if (!id || !crawlJobId) return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const resp = await getBotCrawlStatus(id, crawlJobId);
        if (cancelled || !resp?.job) return;

        if (resp.job.status === "completed") {
          setCrawlStatus("completed");
          setKnowledgeReady(true);
          setCrawlMessage(
            t("botKnowledge.onboarding.status.completed", "Crawl complete.")
          );
          if (timer) window.clearInterval(timer);
        } else if (resp.job.status === "failed") {
          setCrawlStatus("failed");
          setCrawlMessage(
            resp.job.errorMessage ||
              t("botKnowledge.onboarding.status.failed", "Crawl failed.")
          );
          if (timer) window.clearInterval(timer);
        } else {
          setCrawlStatus("running");
          setCrawlMessage(
            t("botKnowledge.onboarding.status.running", "Crawling...")
          );
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setCrawlMessage(
            t("botKnowledge.onboarding.status.pollError", "Polling error.")
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

  const pollEstimateStatus = async (estimateId: string) => {
    if (!id) throw new Error("Missing bot ID.");
    let consecutiveErrors = 0;

    while (true) {
      try {
        const status = await getBotCrawlEstimateStatus(id, estimateId);
        consecutiveErrors = 0;

        if (status.status === "estimate") {
          return status as CrawlEstimateResponse;
        }
        if (status.status === "failed") {
          throw new Error(
            status.error || t("botKnowledge.errors.estimateFailed")
          );
        }
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_ESTIMATE_STATUS_ERRORS) {
          throw err;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, ESTIMATE_POLL_MS));
    }
  };

  const handleStartCrawl = async () => {
    if (!id) return;
    if (bot && !bot.useDomainCrawler) {
      setError(t("botKnowledge.errors.domainCrawlerDisabled"));
      return;
    }
    const domain = domainInput.trim();
    if (!domain) {
      setError(
        t(
          "botKnowledge.onboarding.errors.saveDomain",
          "Please enter a valid domain."
        )
      );
      return;
    }

    setCrawlLoading(true);
    setError(null);

    try {
      const updated = await updateBot(id, { domain });
      setBot(updated);
      const preflight = await crawlBotDomain(id, domain);
      if (preflight.status === "estimate") {
        setConfirmModal({
          requiredTokens:
            preflight.requiredTokens ??
            preflight.estimate?.tokensEstimated ??
            0,
          remainingTokens:
            preflight.remainingTokens ??
            preflight.estimate?.tokensRemaining ??
            null,
          estimateId: preflight.estimateId ?? null
        });
        return;
      }

      if (preflight.status === "estimate_pending" && preflight.estimateId) {
        setEstimatePending(true);
        const resolved = await pollEstimateStatus(preflight.estimateId);
        setConfirmModal({
          requiredTokens:
            resolved.requiredTokens ??
            resolved.estimate?.tokensEstimated ??
            0,
          remainingTokens:
            resolved.remainingTokens ??
            resolved.estimate?.tokensRemaining ??
            null,
          estimateId: resolved.estimateId ?? preflight.estimateId ?? null
        });
        return;
      }

      if ("jobId" in preflight && preflight.jobId) {
        setCrawlJobId(preflight.jobId);
        setCrawlStatus("running");
        setCrawlMessage(
          t("botKnowledge.onboarding.status.running", "Crawling...")
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.onboarding.errors.crawlFailed"));
    } finally {
      setEstimatePending(false);
      setCrawlLoading(false);
    }
  };

  const handleConfirmCrawl = async () => {
    if (!id || !confirmModal) return;
    setCrawlLoading(true);
    setError(null);
    try {
      const resp = await crawlBotDomain(id, domainInput.trim(), {
        confirm: true,
        estimateId: confirmModal.estimateId ?? null
      });
      if ("jobId" in resp && resp.jobId) {
        setCrawlJobId(resp.jobId);
        setCrawlStatus("running");
        setCrawlMessage(
          t("botKnowledge.onboarding.status.running", "Crawling...")
        );
      }
      setConfirmModal(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.onboarding.errors.crawlFailed"));
    } finally {
      setCrawlLoading(false);
    }
  };

  const handleDocsFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setDocsFiles(files);
  };

  const handleStartDocsFlow = async () => {
    if (!id) return;
    if (!docsFiles.length) {
      setError(
        t(
          "botKnowledge.docsCard.uploadLabel",
          "Upload one or more files"
        )
      );
      return;
    }
    if (bot && !bot.usePdfCrawler) {
      setError(t("botKnowledge.errors.pdfUploadDisabled"));
      return;
    }

    setDocsLoading(true);
    setError(null);
    try {
      const estResp = await estimateBotDocuments(id, docsFiles);
      const requiredTokens = estResp?.estimate?.totalTokensEstimated ?? 0;
      setDocsConfirmModal({
        files: docsFiles,
        requiredTokens
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.uploadFailed"));
    } finally {
      setDocsLoading(false);
    }
  };

  const handleConfirmDocsUpload = async () => {
    if (!id || !docsConfirmModal) return;
    setDocsLoading(true);
    setError(null);
    try {
      await uploadBotDocuments(id, docsConfirmModal.files);
      const refreshed = await getBotById(id);
      setBot(refreshed);
      setKnowledgeReady(true);
      setDocsKnowledgeReady(true);
      setCrawlStatus("completed");
      setCrawlMessage(t("botKnowledge.onboarding.status.readyExisting"));
      setDocsFiles([]);
      setDocsConfirmModal(null);
      if (docsInputRef.current) {
        docsInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.errors.uploadFailed"));
    } finally {
      setDocsLoading(false);
    }
  };

  const handleLinkShop = async (overrideShop?: string) => {
    if (!id) return;
    const trimmed = (overrideShop || shopDomain).trim().toLowerCase();
    if (!SHOP_DOMAIN_REGEX.test(trimmed)) {
      setError(t("shopifyPage.errors.invalidShop", "Invalid shop domain."));
      return;
    }

    setLinking(true);
    setError(null);
    setBlockedByOther(false);
    try {
      await linkShopifyShop(trimmed, id);
      await loadShopify();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("already linked")) {
        setBlockedByOther(true);
        setError(
          t(
            "shopifyOnboarding.errors.linkedToOther",
            "This Shopify store is already linked to another account."
          )
        );
      } else {
        setError(err?.message || t("shopifyPage.errors.linkFailed"));
      }
    } finally {
      setLinking(false);
    }
  };

  const handleInstallShopify = () => {
    if (!id) return;
    const trimmed = shopDomain.trim().toLowerCase();
    if (!SHOP_DOMAIN_REGEX.test(trimmed)) {
      setError(t("shopifyPage.errors.invalidShop", "Invalid shop domain."));
      return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}`;
    const installUrl =
      `${API_BASE_URL}/shopify/install?shop=${encodeURIComponent(trimmed)}` +
      `&botId=${encodeURIComponent(id)}` +
      `&returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = installUrl;
  };

  const handleSyncShopify = async () => {
    const activeShop = shops.find((s) => s.isActive) || shops[0] || null;
    if (!activeShop) return;
    setSyncing(true);
    setError(null);
    try {
      await syncShopifyProducts(activeShop.shopDomain);
      await loadShopify();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.errors.syncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  const activeShop = useMemo(
    () => shops.find((s) => s.isActive) || shops[0] || null,
    [shops]
  );
  const shopifyConnected = !!activeShop?.shopDomain;
  const shopifyHasSync = !!activeShop?.lastProductsSyncAt;

  const shopifyStatusTone = shopifyLoading
    ? "bg-primary/10 text-primary"
    : shopifyConnected
      ? "bg-success/10 text-success"
      : "bg-warning/10 text-warning-foreground";

  const shopifyStatusLabel = shopifyLoading
    ? t(
        "botKnowledge.onboarding.statusPill.shopifyChecking",
        "Checking Shopify..."
      )
    : shopifyConnected
      ? t(
          "botKnowledge.onboarding.statusPill.shopifyConnected",
          "Shopify connected"
        )
      : t(
          "botKnowledge.onboarding.statusPill.shopifyNotConnected",
          "Shopify not connected"
        );

  const canFinish = isShopify
    ? shopifyHasSync
    : knowledgeReady;

  const handleFinish = () => {
    navigate(`/onboarding/bots/${encodeURIComponent(id)}/channels`);
  };

  const handleSkip = async () => {
    if (!id) return;
    setSkipLoading(true);
    setError(null);
    try {
      navigate(`/onboarding/bots/${encodeURIComponent(id)}/channels`, {
        replace: true
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("common.error"));
    } finally {
      setSkipLoading(false);
    }
  };

  const handleBack = () => {
    if (!id) return;
    navigate(`/onboarding/bots/${encodeURIComponent(id)}/plan`);
  };

  const crawlStatusTone =
    crawlStatus === "completed"
      ? "bg-success/10 text-success"
      : crawlStatus === "failed"
        ? "bg-warning/10 text-warning-foreground"
        : crawlStatus === "running"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";

  const crawlButtonLabel =
    estimatePending
      ? t(
          "botKnowledge.modal.estimateTitle",
          "Estimating crawl cost..."
        )
      : crawlStatus === "running"
      ? t("botKnowledge.onboarding.btnIndexing", "Indexing...")
      : crawlStatus === "completed"
        ? t("botKnowledge.onboarding.btnReindex", "Re-index")
        : t("botKnowledge.onboarding.btnStartIndexing", "Start indexing");

  const title = t(
    "botKnowledge.onboarding.title",
    "Connect your knowledge source"
  );
  const subtitle = isShopify
    ? t(
        "botKnowledge.onboarding.subtitleShopify",
        "Connect your Shopify store so Coslo can use your live catalog."
      )
    : ragMode === "docs"
      ? t("botKnowledge.docsCard.description")
    : t(
        "botKnowledge.onboarding.subtitle",
        "Connect your website so Coslo can crawl it and answer questions."
      );

  if (!id) return null;

  return (
    <OnboardingLayout
      currentStep="knowledge"
      botId={id}
      flow="assistantType"
      includeAssistantBookingStep={bot?.knowledgeSource === "RAG"}
      layout="full"
      title={title}
      subtitle={subtitle}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("common.loading", "Loading...")}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  {isShopify ? (
                    <ShoppingBag className="h-6 w-6" />
                  ) : ragMode === "docs" ? (
                    <FileText className="h-6 w-6" />
                  ) : (
                    <Globe className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {isShopify
                      ? t(
                          "botKnowledge.onboarding.source.shopify",
                          "Shopify store"
                        )
                      : ragMode === "docs"
                        ? t("botKnowledge.docsCard.title")
                      : t(
                          "botKnowledge.onboarding.source.rag",
                          "Website domain"
                        )}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isShopify
                      ? t(
                          "botKnowledge.onboarding.heroBodyShopify",
                          "Link your store and sync products to finish setup."
                        )
                      : ragMode === "docs"
                        ? t("botKnowledge.docsCard.description")
                      : t(
                          "botKnowledge.onboarding.heroBody",
                          "Enter your domain and start crawling to build knowledge."
                        )}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  isShopify ? shopifyStatusTone : crawlStatusTone
                }`}
              >
                {isShopify ? (
                  shopifyLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : shopifyConnected ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : null
                ) : crawlStatus === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : crawlStatus === "running" || estimatePending || docsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {isShopify
                  ? shopifyStatusLabel
                  : docsLoading
                    ? t("botKnowledge.actions.estimating")
                  : estimatePending
                    ? t(
                        "botKnowledge.modal.estimateTitle",
                        "Estimating crawl cost..."
                      )
                  : crawlMessage ||
                    t("botKnowledge.onboarding.statusPill.idle", "Idle")}
              </span>
            </div>

            {isShopify ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <div className="font-medium text-foreground">
                    {t("botKnowledge.onboarding.shopifyWhyTitle")}
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {t("botKnowledge.onboarding.shopifyWhyBody")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    {t("shopifyPage.connect.shopDomain", "Shop domain")}
                  </label>
                  <Input
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder={t(
                      "shopifyPage.connect.shopPlaceholder",
                      "your-store.myshopify.com"
                    )}
                    className="mt-1"
                  />
                </div>

                {!shopifyConnected && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => handleLinkShop()}
                      disabled={linking || blockedByOther}
                    >
                      {linking
                        ? t("shopifyPage.actions.redirecting", "Redirecting...")
                        : t("shopifyOnboarding.actions.link", "Link store")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleInstallShopify}
                      disabled={linking || blockedByOther}
                    >
                      {t("shopifyPage.actions.install", "Install app")}
                    </Button>
                  </div>
                )}

                {activeShop && (
                  <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <span>{t("shopifyPage.summary.connectedShop")}</span>
                      <span className="text-foreground font-medium">
                        {activeShop.shopDomain}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 mt-2">
                      <span>{t("shopifyPage.summary.catalog")}</span>
                      <span className="text-foreground">
                        {t("shopifyPage.summary.products")}:{" "}
                        {activeShop.productCount}{" "}
                        <span aria-hidden="true">&middot;</span>{" "}
                        {t("shopifyPage.summary.variants")}:{" "}
                        {activeShop.variantCount}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 mt-2">
                      <span>{t("shopifyPage.summary.lastSync")}</span>
                      <span className="text-foreground">
                        {activeShop.lastProductsSyncAt
                          ? new Date(
                              activeShop.lastProductsSyncAt
                            ).toLocaleString()
                          : t("shopifyPage.summary.neverSynced")}
                      </span>
                    </div>
                  </div>
                )}

                {shopifyConnected && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSyncShopify}
                      disabled={!activeShop || syncing}
                    >
                      {syncing
                        ? t("shopifyPage.actions.syncing", "Syncing...")
                        : t("shopifyPage.actions.sync", "Sync products")}
                    </Button>
                  </div>
                )}

                {!shopifyHasSync && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "shopifyOnboarding.syncHint",
                      "Sync products to continue with onboarding."
                    )}
                  </p>
                )}
              </div>
             ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-background/60 p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        ragMode === "website"
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                      onClick={() => setRagMode("website")}
                    >
                      <div className="text-sm font-medium text-foreground">
                        {t("botKnowledge.domainCard.title")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botKnowledge.onboarding.domainWhyBody")}
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        ragMode === "docs"
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                      onClick={() => setRagMode("docs")}
                    >
                      <div className="text-sm font-medium text-foreground">
                        {t("botKnowledge.docsCard.title")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botKnowledge.docsCard.description")}
                      </p>
                    </button>
                  </div>
                </div>

                {ragMode === "website" ? (
                  <>
                    <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                      <div className="font-medium text-foreground">
                        {t("botKnowledge.onboarding.domainWhyTitle")}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {t("botKnowledge.onboarding.domainWhyBody")}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        {t("botKnowledge.onboarding.domainLabel", "Website domain")}
                      </label>
                      <Input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder={t(
                          "botKnowledge.onboarding.domainPlaceholder",
                          "example.com"
                        )}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {t(
                          "botKnowledge.onboarding.domainHint",
                          "We'll crawl this domain and use it as your bot's knowledge base."
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={handleStartCrawl}
                        disabled={
                          crawlLoading ||
                          !domainInput.trim() ||
                          !!(bot && !bot.useDomainCrawler)
                        }
                      >
                        {crawlLoading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {crawlButtonLabel}
                      </Button>
                    </div>
                    {bot && !bot.useDomainCrawler && (
                      <p className="text-xs text-muted-foreground">
                        {t("botKnowledge.domainCard.disabledNote")}
                      </p>
                    )}

                    {estimatePending && (
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t(
                            "botKnowledge.modal.estimateTitle",
                            "Estimating crawl cost..."
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t(
                            "botKnowledge.modal.estimateBody",
                            "We're calculating the estimated crawl cost. This may take a few minutes for larger websites."
                          )}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                      <div className="font-medium text-foreground">
                        {t("botKnowledge.docsCard.title")}
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {t("botKnowledge.docsCard.description")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botKnowledge.docsCard.supportedFormats")}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">
                        {t("botKnowledge.docsCard.uploadLabel")}
                      </label>
                      <Input
                        ref={docsInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        onChange={handleDocsFileChange}
                      />
                      {docsFiles.length > 0 && (
                        <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                          {docsFiles.map((file) => file.name).join(", ")}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={handleStartDocsFlow}
                        disabled={
                          docsLoading ||
                          docsFiles.length === 0 ||
                          !!(bot && !bot.usePdfCrawler)
                        }
                      >
                        {docsLoading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {docsLoading
                          ? t("botKnowledge.actions.estimating")
                          : t("botKnowledge.modal.docsTitle")}
                      </Button>
                    </div>
                    {bot && !bot.usePdfCrawler && (
                      <p className="text-xs text-muted-foreground">
                        {t("botKnowledge.docsCard.disabledNote")}
                      </p>
                    )}
                    {docsKnowledgeReady && (
                      <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          {t(
                            "botKnowledge.onboarding.docsReadyTitle",
                            "Documents uploaded successfully"
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            "botKnowledge.onboarding.docsReadyBody",
                            "Your files are now part of the knowledge base. You can continue to channels."
                          )}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleBack}>
            {t("common.back")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={handleSkip}
              disabled={skipLoading || loading}
            >
              {t("botSettings.onboarding.common.skip")}
            </Button>
            <Button
              type="button"
              onClick={handleFinish}
              disabled={!canFinish || skipLoading}
            >
              {t("botKnowledge.onboarding.continueToChannels")}
            </Button>
          </div>
        </div>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {t("botKnowledge.modal.crawlTitle")}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t("botKnowledge.modal.crawlBody")}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("botKnowledge.modal.estimatedTokens")}
                </span>
                <span className="text-foreground font-medium">
                  {confirmModal.requiredTokens.toLocaleString()}{" "}
                  {t("botKnowledge.estimate.tokensUnit")}
                </span>
              </div>
              {confirmModal.remainingTokens != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("botKnowledge.modal.remainingTokens")}
                  </span>
                  <span className="text-foreground font-medium">
                    {confirmModal.remainingTokens.toLocaleString()}{" "}
                    {t("botKnowledge.estimate.tokensUnit")}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={crawlLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmCrawl}
                disabled={crawlLoading}
              >
                {crawlLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {docsConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {t("botKnowledge.modal.docsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t("botKnowledge.modal.docsBody")}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("botKnowledge.modal.estimatedTokens")}
                </span>
                <span className="text-foreground font-medium">
                  {docsConfirmModal.requiredTokens.toLocaleString()}{" "}
                  {t("botKnowledge.estimate.tokensUnit")}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setDocsConfirmModal(null)}
                disabled={docsLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDocsUpload}
                disabled={docsLoading}
              >
                {docsLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </OnboardingLayout>
  );
};

export default OnboardingKnowledge;
