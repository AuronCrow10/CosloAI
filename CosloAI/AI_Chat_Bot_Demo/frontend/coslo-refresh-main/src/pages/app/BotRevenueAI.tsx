
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBotById, updateBot } from "@/api/bots";
import { fetchShopifyShops, ShopifyShopSummary } from "@/api/shopify";
import { fetchRevenueAIMetrics, RevenueAIMetricsResponse } from "@/api/dashboard";
import { useAuth } from "@/contexts/AuthContext";

type ComplementRule = { key: string; values: string[] };

type InfoTipProps = {
  content: string;
  className?: string;
};

const InfoTip: React.FC<InfoTipProps> = ({ content, className }) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className={`relative ${className || ""}`}>
      <button
        type="button"
        aria-label={t("common.info")}
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 text-xs font-semibold text-slate-600 dark:text-slate-200 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-500"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-200 shadow-lg">
          {content}
        </div>
      )}
    </div>
  );
};

const normalizeListInput = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const serializeComplementRules = (rules: ComplementRule[]) =>
  rules
    .filter((rule) => rule.key.trim().length > 0 && rule.values.length > 0)
    .reduce<Record<string, string[]>>((acc, rule) => {
      acc[rule.key.trim()] = Array.from(
        new Set(rule.values.map((v) => v.trim()).filter(Boolean))
      );
      return acc;
    }, {});

const buildComplementJson = (
  productTypeRules: ComplementRule[],
  tagRules: ComplementRule[]
) => {
  const payload: Record<string, Record<string, string[]>> = {};
  const productType = serializeComplementRules(productTypeRules);
  const tags = serializeComplementRules(tagRules);
  if (Object.keys(productType).length > 0) {
    payload.productType = productType;
  }
  if (Object.keys(tags).length > 0) {
    payload.tags = tags;
  }
  return Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : "";
};

const parseComplementJson = (raw: string) => {
  if (!raw || raw.trim().length === 0) {
    return { productTypeRules: [], tagRules: [], valid: true };
  }
  try {
    const parsed = JSON.parse(raw);
    const productTypeRules: ComplementRule[] = [];
    const tagRules: ComplementRule[] = [];
    if (parsed?.productType && typeof parsed.productType === "object") {
      Object.entries(parsed.productType).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          productTypeRules.push({ key, values: value.map((entry) => String(entry)) });
        }
      });
    }
    if (parsed?.tags && typeof parsed.tags === "object") {
      Object.entries(parsed.tags).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          tagRules.push({ key, values: value.map((entry) => String(entry)) });
        }
      });
    }
    return { productTypeRules, tagRules, valid: true };
  } catch {
    return { productTypeRules: [], tagRules: [], valid: false };
  }
};

const BotRevenueAI: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isTeamMember = user?.role === "TEAM_MEMBER";

  const [shops, setShops] = useState<ShopifyShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [revenueAIEnabled, setRevenueAIEnabled] = useState(false);
  const [revenueAIMode, setRevenueAIMode] = useState<"AUTO" | "SOFT" | "CLOSER">("AUTO");
  const [offerEveryXMessages, setOfferEveryXMessages] = useState(6);
  const [maxOffersPerSession, setMaxOffersPerSession] = useState(2);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [dedupeHours, setDedupeHours] = useState(24);
  const [upsellDeltaMinPct, setUpsellDeltaMinPct] = useState(10);
  const [upsellDeltaMaxPct, setUpsellDeltaMaxPct] = useState(35);
  const [maxRecommendations, setMaxRecommendations] = useState(3);
  const [aggressiveness, setAggressiveness] = useState(0.5);
  const [categoryComplementMap, setCategoryComplementMap] = useState("");
  const [productTypeRules, setProductTypeRules] = useState<ComplementRule[]>([]);
  const [tagRules, setTagRules] = useState<ComplementRule[]>([]);
  const [showAdvancedComplementJson, setShowAdvancedComplementJson] = useState(false);
  const [complementJsonValid, setComplementJsonValid] = useState(true);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  const [savingRevenueAI, setSavingRevenueAI] = useState(false);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueAIMetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const activeShop = shops.find((s) => s.isActive) || shops[0] || null;
  const isShopifyLinked = !!activeShop?.shopDomain;

  const loadPage = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [bot, shopRes] = await Promise.all([
        getBotById(id),
        fetchShopifyShops(id)
      ]);
      setShops(shopRes.items || []);
      setRevenueAIEnabled(!!bot.revenueAIEnabled);
      setRevenueAIMode((bot.revenueAIMode as "AUTO" | "SOFT" | "CLOSER") || "AUTO");
      setOfferEveryXMessages(bot.revenueAIOfferEveryXMessages ?? 6);
      setMaxOffersPerSession(bot.revenueAIMaxOffersPerSession ?? 2);
      setCooldownMinutes(bot.revenueAICooldownMinutes ?? 15);
      setDedupeHours(bot.revenueAIDedupeHours ?? 24);
      setUpsellDeltaMinPct(bot.revenueAIUpsellDeltaMinPct ?? 10);
      setUpsellDeltaMaxPct(bot.revenueAIUpsellDeltaMaxPct ?? 35);
      setMaxRecommendations(bot.revenueAIMaxRecommendations ?? 3);
      setAggressiveness(
        typeof bot.revenueAIAggressiveness === "number"
          ? bot.revenueAIAggressiveness
          : 0.5
      );
      setCategoryComplementMap(
        bot.revenueAICategoryComplementMap
          ? JSON.stringify(bot.revenueAICategoryComplementMap, null, 2)
          : ""
      );
      setGuardrailsEnabled(
        typeof bot.revenueAIGuardrailsEnabled === "boolean"
          ? bot.revenueAIGuardrailsEnabled
          : true
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("shopifyPage.errors.loadFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const { productTypeRules: parsedProductTypes, tagRules: parsedTags, valid } =
      parseComplementJson(categoryComplementMap);
    setComplementJsonValid(valid);
    if (valid) {
      setProductTypeRules(parsedProductTypes);
      setTagRules(parsedTags);
    }
  }, [categoryComplementMap]);

  useEffect(() => {
    if (!complementJsonValid) return;
    const nextJson = buildComplementJson(productTypeRules, tagRules);
    if (nextJson !== categoryComplementMap) {
      setCategoryComplementMap(nextJson);
    }
  }, [productTypeRules, tagRules, categoryComplementMap, complementJsonValid]);

  useEffect(() => {
    if (!id || !isShopifyLinked) return;
    setLoadingMetrics(true);
    fetchRevenueAIMetrics(30, id)
      .then((data30) => {
        setRevenueMetrics(data30);
      })
      .catch(() => {
        setRevenueMetrics(null);
      })
      .finally(() => setLoadingMetrics(false));
  }, [id, isShopifyLinked]);

  const handleSaveRevenueAI = async () => {
    if (!id) return;
    setSavingRevenueAI(true);
    setError(null);
    setSuccess(null);
    try {
      await updateBot(id, {
        revenueAIEnabled,
        revenueAIMode,
        revenueAIOfferEveryXMessages: offerEveryXMessages,
        revenueAIMaxOffersPerSession: maxOffersPerSession,
        revenueAICooldownMinutes: cooldownMinutes,
        revenueAIDedupeHours: dedupeHours,
        revenueAIGuardrailsEnabled: guardrailsEnabled
      });
      setSuccess(
        t("shopifyPage.success.revenueSaved")
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("shopifyPage.errors.revenueSaveFailed")
      );
    } finally {
      setSavingRevenueAI(false);
    }
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("shopifyPage.missingId")}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t("shopifyPage.revenueAI.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {t("shopifyPage.revenueAI.subtitle")}
          </p>
        </div>
        <Link to={`/app/bots/${id}`} className="btn-secondary">
          {t("shopifyPage.backToBot")}
        </Link>
      </div>

      {!isShopifyLinked && !loading && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="status-badge status-badge-warn">
            {t("shopifyPage.revenueAI.shopRequiredLabel")}
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("shopifyPage.revenueAI.shopRequiredBody")}
          </p>
        </div>
      )}

      {error && <div className="mt-4 form-error">{error}</div>}
      {success && <div className="mt-4 form-success">{success}</div>}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-6 py-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("shopifyPage.loading")}
          </p>
        </div>
      ) : !isShopifyLinked ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">
                {t("shopifyPage.revenueAI.shopRequiredTitle")}
              </div>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
                {t("shopifyPage.revenueAI.shopRequiredBody")}
              </p>
            </div>
            <Link to={`/app/bots/${id}/shopify`} className="btn-secondary">
              {t("shopifyPage.revenueAI.shopRequiredCta")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <div className="mt-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {t("shopifyPage.revenueAI.fields.enabled")}
                  </div>
                  <InfoTip
                    content={t("shopifyPage.revenueAI.info.enabled")}
                  />
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={revenueAIEnabled}
                    onChange={(e) => setRevenueAIEnabled(e.target.checked)}
                    disabled={isTeamMember}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 text-blue-500"
                  />
                  {t("shopifyPage.revenueAI.enabledLabel")}
                </label>
              </div>
            </div>

            {revenueAIEnabled && (
              <>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.sellingMode")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.sellingMode")}
                      />
                    </div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                      value={revenueAIMode}
                      onChange={(e) =>
                        setRevenueAIMode(e.target.value as "AUTO" | "SOFT" | "CLOSER")
                      }
                      disabled={isTeamMember}
                    >
                      <option value="AUTO">
                        {t("shopifyPage.revenueAI.modes.auto")}
                      </option>
                      <option value="SOFT">
                        {t("shopifyPage.revenueAI.modes.soft")}
                      </option>
                      <option value="CLOSER">
                        {t("shopifyPage.revenueAI.modes.closer")}
                      </option>
                    </select>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {t("shopifyPage.revenueAI.sellingModeHelp")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.offerEveryX")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.offerEveryX")}
                      />
                    </div>
                    <input
                      type="number"
                      min={2}
                      value={offerEveryXMessages}
                      onChange={(e) =>
                        setOfferEveryXMessages(Number(e.target.value || 2))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.maxOffersPerSession")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.maxOffersPerSession")}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={maxOffersPerSession}
                      onChange={(e) =>
                        setMaxOffersPerSession(Number(e.target.value || 1))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.cooldownMinutes")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.cooldownMinutes")}
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(Number(e.target.value || 0))}
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.dedupeHours")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.dedupeHours")}
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={dedupeHours}
                      onChange={(e) => setDedupeHours(Number(e.target.value || 0))}
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.upsellMinDelta")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.upsellMinDelta")}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={upsellDeltaMinPct}
                      onChange={(e) =>
                        setUpsellDeltaMinPct(Number(e.target.value || 1))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.upsellMaxDelta")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.upsellMaxDelta")}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={upsellDeltaMaxPct}
                      onChange={(e) =>
                        setUpsellDeltaMaxPct(Number(e.target.value || 1))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.maxRecommendations")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.maxRecommendations")}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={maxRecommendations}
                      onChange={(e) =>
                        setMaxRecommendations(Number(e.target.value || 1))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.aggressiveness")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.aggressiveness")}
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={aggressiveness}
                      onChange={(e) =>
                        setAggressiveness(Number(e.target.value || 0))
                      }
                      disabled={isTeamMember}
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                    />
                  </div>
                  <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          {t("shopifyPage.revenueAI.fields.categoryComplementMap")}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("shopifyPage.revenueAI.fields.categoryComplementHelp")}
                        </p>
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.categoryComplementMap")}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/60 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("shopifyPage.revenueAI.fields.byProductType")}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("shopifyPage.revenueAI.fields.byProductTypeExample")}
                        </p>

                        <div className="mt-3 space-y-3">
                          {productTypeRules.map((rule, index) => (
                            <div key={`productType-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input
                                type="text"
                                value={rule.key}
                                onChange={(e) =>
                                  setProductTypeRules((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, key: e.target.value } : item
                                    )
                                  )
                                }
                                disabled={isTeamMember}
                                placeholder={t("shopifyPage.revenueAI.fields.baseProductType")}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                              />
                              <input
                                type="text"
                                value={rule.values.join(", ")}
                                onChange={(e) =>
                                  setProductTypeRules((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, values: normalizeListInput(e.target.value) }
                                        : item
                                    )
                                  )
                                }
                                disabled={isTeamMember}
                                placeholder={t("shopifyPage.revenueAI.fields.complementTypes")}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setProductTypeRules((prev) => prev.filter((_, idx) => idx !== index))
                                }
                                disabled={isTeamMember}
                                className="rounded-lg border border-slate-200 dark:border-slate-800/70 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                              >
                                {t("shopifyPage.revenueAI.fields.removeRule")}
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setProductTypeRules((prev) => [...prev, { key: "", values: [] }])
                          }
                          disabled={isTeamMember}
                          className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
                        >
                          {t("shopifyPage.revenueAI.fields.addProductTypeRule")}
                        </button>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/60 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("shopifyPage.revenueAI.fields.byTag")}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("shopifyPage.revenueAI.fields.byTagExample")}
                        </p>

                        <div className="mt-3 space-y-3">
                          {tagRules.map((rule, index) => (
                            <div key={`tag-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input
                                type="text"
                                value={rule.key}
                                onChange={(e) =>
                                  setTagRules((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, key: e.target.value } : item
                                    )
                                  )
                                }
                                disabled={isTeamMember}
                                placeholder={t("shopifyPage.revenueAI.fields.baseTag")}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                              />
                              <input
                                type="text"
                                value={rule.values.join(", ")}
                                onChange={(e) =>
                                  setTagRules((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, values: normalizeListInput(e.target.value) }
                                        : item
                                    )
                                  )
                                }
                                disabled={isTeamMember}
                                placeholder={t("shopifyPage.revenueAI.fields.complementTags")}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setTagRules((prev) => prev.filter((_, idx) => idx !== index))
                                }
                                disabled={isTeamMember}
                                className="rounded-lg border border-slate-200 dark:border-slate-800/70 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                              >
                                {t("shopifyPage.revenueAI.fields.removeRule")}
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setTagRules((prev) => [...prev, { key: "", values: [] }])
                          }
                          disabled={isTeamMember}
                          className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
                        >
                          {t("shopifyPage.revenueAI.fields.addTagRule")}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedComplementJson((prev) => !prev)}
                      className="mt-4 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      {showAdvancedComplementJson
                        ? t("shopifyPage.revenueAI.fields.hideAdvancedJson")
                        : t("shopifyPage.revenueAI.fields.showAdvancedJson")}
                    </button>

                    {showAdvancedComplementJson && (
                      <div className="mt-2">
                        <textarea
                          rows={4}
                          value={categoryComplementMap}
                          onChange={(e) => setCategoryComplementMap(e.target.value)}
                          disabled={isTeamMember}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                          placeholder='{"productType":{"shoes":["socks","laces"]},"tags":{"running":["waterproof"]}}'
                        />
                        {!complementJsonValid && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            {t("shopifyPage.revenueAI.fields.invalidJson")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {t("shopifyPage.revenueAI.fields.guardrails")}
                      </div>
                      <InfoTip
                        content={t("shopifyPage.revenueAI.info.guardrails")}
                      />
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={guardrailsEnabled}
                        onChange={(e) => setGuardrailsEnabled(e.target.checked)}
                        disabled={isTeamMember}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 text-blue-500"
                      />
                      {t("shopifyPage.revenueAI.enabledLabel")}
                    </label>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t("shopifyPage.revenueAI.safety.title")}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {t("shopifyPage.revenueAI.safety.body")}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveRevenueAI}
                    disabled={savingRevenueAI || isTeamMember}
                  >
                    {savingRevenueAI
                      ? t("shopifyPage.revenueAI.actions.saving")
                      : t("shopifyPage.revenueAI.actions.save")}
                  </button>
                  {isTeamMember && (
                    <span className="text-xs text-slate-500">
                      {t("shopifyPage.revenueAI.readOnly")}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.revenueAI.metrics.impressions")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {loadingMetrics ? "..." : (revenueMetrics?.totals.impressions ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.revenueAI.metrics.clicks")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {loadingMetrics ? "..." : (revenueMetrics?.totals.clicks ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.revenueAI.metrics.addToCart")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {loadingMetrics ? "..." : (revenueMetrics?.totals.addToCart ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.revenueAI.metrics.checkout")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {loadingMetrics ? "..." : (revenueMetrics?.totals.checkout ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.revenueAI.metrics.revenueCents")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {loadingMetrics ? "..." : (revenueMetrics?.totals.revenueCents ?? 0)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default BotRevenueAI;
