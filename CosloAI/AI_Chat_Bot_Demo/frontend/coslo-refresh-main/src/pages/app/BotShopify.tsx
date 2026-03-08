// src/pages/app/ShopifyIntegrationPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBotById } from "@/api/bots";
import {
  fetchShopifyShops,
  linkShopifyShop,
  syncShopifyProducts,
  fetchWidgetConfig,
  ShopifyShopSummary,
  fetchCatalogSchema,
  rebuildCatalogSchema,
  ShopCatalogSchema,
  fetchCatalogContext,
  rebuildCatalogContext,
  updateCatalogContext,
  ShopCatalogContext
} from "@/api/shopify";
import { API_BASE_URL } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

type WidgetConfig = { botId: string; botSlug: string; botName: string } | null;

const SHOP_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function deriveBackendOrigin(): string {
  if (API_BASE_URL.startsWith("http")) {
    try {
      return new URL(API_BASE_URL).origin;
    } catch {
      return window.location.origin;
    }
  }
  return window.location.origin;
}

const normalizeListInput = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const BotShopify: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isTeamMember = user?.role === "TEAM_MEMBER";

  const [botName, setBotName] = useState<string>("");
  const [botSlug, setBotSlug] = useState<string>("");
  const [shops, setShops] = useState<ShopifyShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncingShop, setSyncingShop] = useState<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(null);
  const [checkingWidget, setCheckingWidget] = useState(false);
  const [catalogSchema, setCatalogSchema] = useState<ShopCatalogSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [rebuildingSchema, setRebuildingSchema] = useState(false);
  const [catalogContext, setCatalogContext] = useState<ShopCatalogContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [rebuildingContext, setRebuildingContext] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [contextDraft, setContextDraft] = useState({
    summary: "",
    categories: "",
    useCases: "",
    audiences: "",
    notableAttributes: "",
    pricePositioning: "unknown",
    priceMin: "",
    priceMax: "",
    priceCurrency: ""
  });

  const backendOrigin = useMemo(() => deriveBackendOrigin(), []);

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
      setBotName(bot.name);
      setBotSlug(bot.slug);
      setShops(shopRes.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activeShop = shops.find((s) => s.isActive) || shops[0] || null;

  useEffect(() => {
    if (!activeShop?.shopDomain) {
      setCatalogSchema(null);
      return;
    }
    setLoadingSchema(true);
    fetchCatalogSchema(activeShop.shopDomain)
      .then((schema) => setCatalogSchema(schema))
      .catch(() => setCatalogSchema(null))
      .finally(() => setLoadingSchema(false));
  }, [activeShop?.shopDomain]);

  useEffect(() => {
    if (!activeShop?.shopDomain) {
      setCatalogContext(null);
      return;
    }
    setLoadingContext(true);
    fetchCatalogContext(activeShop.shopDomain)
      .then((context) => {
        setCatalogContext(context);
        if (context) {
          setContextDraft({
            summary: context.summary || "",
            categories: context.categories?.join(", ") || "",
            useCases: context.useCases?.join(", ") || "",
            audiences: context.audiences?.join(", ") || "",
            notableAttributes: context.notableAttributes?.join(", ") || "",
            pricePositioning: context.pricePositioning || "unknown",
            priceMin:
              typeof context.priceRange?.min === "number"
                ? String(context.priceRange.min)
                : "",
            priceMax:
              typeof context.priceRange?.max === "number"
                ? String(context.priceRange.max)
                : "",
            priceCurrency: context.priceRange?.currency || ""
          });
        }
      })
      .catch(() => setCatalogContext(null))
      .finally(() => setLoadingContext(false));
  }, [activeShop?.shopDomain]);

  const handleInstall = () => {
    if (!id) return;
    setError(null);
    setSuccess(null);

    const trimmed = shopDomain.trim().toLowerCase();
    if (!SHOP_DOMAIN_REGEX.test(trimmed)) {
      setError(
        t("shopifyPage.errors.invalidShop")
      );
      return;
    }

    setConnecting(true);
    const installUrl = `${API_BASE_URL}/shopify/install?shop=${encodeURIComponent(
      trimmed
    )}&botId=${encodeURIComponent(id)}`;
    window.location.href = installUrl;
  };

  const handleRelink = async (shop: ShopifyShopSummary) => {
    if (!id) return;
    setError(null);
    setSuccess(null);

    try {
      await linkShopifyShop(shop.shopDomain, id);
      setSuccess(
        t("shopifyPage.success.linked")
      );
      loadPage();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.errors.linkFailed"));
    }
  };

  const handleUnlink = async (shop: ShopifyShopSummary) => {
    if (!id) return;
    if (
      !window.confirm(
        t("shopifyPage.confirm.unlink")
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await linkShopifyShop(shop.shopDomain, null);
      setSuccess(
        t("shopifyPage.success.unlinked")
      );
      loadPage();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.errors.unlinkFailed"));
    }
  };

  const handleSync = async (shop: ShopifyShopSummary) => {
    setError(null);
    setSuccess(null);
    setSyncingShop(shop.shopDomain);
    try {
      const res = await syncShopifyProducts(shop.shopDomain);
      setSuccess(
        t("shopifyPage.success.syncComplete")
      );
      console.log("Shopify sync result", res);
      loadPage();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.errors.syncFailed"));
    } finally {
      setSyncingShop(null);
    }
  };

  const handleCheckWidget = async (shop: ShopifyShopSummary) => {
    setCheckingWidget(true);
    setError(null);
    try {
      const config = await fetchWidgetConfig(shop.shopDomain);
      setWidgetConfig(config);
    } catch (err: any) {
      console.error(err);
      setWidgetConfig(null);
      setError(err?.message || t("shopifyPage.errors.widgetFailed"));
    } finally {
      setCheckingWidget(false);
    }
  };

  const handleRebuildSchema = async () => {
    if (!activeShop?.shopDomain) return;
    setRebuildingSchema(true);
    setError(null);
    try {
      const schema = await rebuildCatalogSchema(activeShop.shopDomain);
      setCatalogSchema(schema);
      setSuccess(t("shopifyPage.catalogSchema.success"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("shopifyPage.catalogSchema.error"));
    } finally {
      setRebuildingSchema(false);
    }
  };

  const handleRebuildContext = async () => {
    if (!activeShop?.shopDomain) return;
    setRebuildingContext(true);
    setError(null);
    try {
      const context = await rebuildCatalogContext(activeShop.shopDomain);
      setCatalogContext(context);
      if (context) {
        setContextDraft({
          summary: context.summary || "",
          categories: context.categories?.join(", ") || "",
          useCases: context.useCases?.join(", ") || "",
          audiences: context.audiences?.join(", ") || "",
          notableAttributes: context.notableAttributes?.join(", ") || "",
          pricePositioning: context.pricePositioning || "unknown",
          priceMin:
            typeof context.priceRange?.min === "number"
              ? String(context.priceRange.min)
              : "",
          priceMax:
            typeof context.priceRange?.max === "number"
              ? String(context.priceRange.max)
              : "",
          priceCurrency: context.priceRange?.currency || ""
        });
      }
      setSuccess(
        t("shopifyPage.catalogContext.success")
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("shopifyPage.catalogContext.error")
      );
    } finally {
      setRebuildingContext(false);
    }
  };

  const handleSaveContext = async () => {
    if (!activeShop?.shopDomain) return;
    setSavingContext(true);
    setError(null);
    try {
      const patch = {
        summary: contextDraft.summary.trim(),
        categories: normalizeListInput(contextDraft.categories),
        useCases: normalizeListInput(contextDraft.useCases),
        audiences: normalizeListInput(contextDraft.audiences),
        notableAttributes: normalizeListInput(contextDraft.notableAttributes),
        pricePositioning: contextDraft.pricePositioning as
          | "budget"
          | "mid"
          | "premium"
          | "mixed"
          | "unknown",
        priceRange: {
          min:
            contextDraft.priceMin.trim().length > 0
              ? Number(contextDraft.priceMin)
              : undefined,
          max:
            contextDraft.priceMax.trim().length > 0
              ? Number(contextDraft.priceMax)
              : undefined,
          currency: contextDraft.priceCurrency.trim() || null
        }
      };
      const context = await updateCatalogContext(activeShop.shopDomain, patch);
      setCatalogContext(context);
      setSuccess(
        t("shopifyPage.catalogContext.saved")
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("shopifyPage.catalogContext.saveError")
      );
    } finally {
      setSavingContext(false);
    }
  };

  const widgetScriptUrl = activeShop
    ? `${backendOrigin}/embed.js?shop=${encodeURIComponent(activeShop.shopDomain)}`
    : null;

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
            {t("shopifyPage.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {t("shopifyPage.subtitle")}
          </p>
        </div>
        <Link to={`/app/bots/${id}`} className="btn-secondary">
          {t("shopifyPage.backToBot")}
        </Link>
      </div>

      {error && <div className="mt-4 form-error">{error}</div>}
      {success && <div className="mt-4 form-success">{success}</div>}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-6 py-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("shopifyPage.loading")}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("shopifyPage.connect.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t("shopifyPage.connect.subtitle")}
                </p>
              </div>
              {activeShop && (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    activeShop.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                  }`}
                >
                  {activeShop.isActive
                    ? t("shopifyPage.status.active")
                    : t("shopifyPage.status.inactive")}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t("shopifyPage.connect.shopDomain")}
                </span>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder={t("shopifyPage.connect.shopPlaceholder")}
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-950/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                />
              </label>

              <button
                type="button"
                className="btn-primary"
                disabled={connecting}
                onClick={handleInstall}
              >
                {connecting
                  ? t("shopifyPage.actions.redirecting")
                  : t("shopifyPage.actions.install")}
              </button>
            </div>

            {activeShop && (
              <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {t("shopifyPage.summary.connectedShop")}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {activeShop.shopDomain}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {t("shopifyPage.summary.scopes")}
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {activeShop.scopes ||
                      "read_products, read_orders, read_fulfillments, write_script_tags"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {t("shopifyPage.summary.catalog")}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {t("shopifyPage.summary.products")}: {" "}
                    {activeShop.productCount} - {" "}
                    {t("shopifyPage.summary.variants")}: {" "}
                    {activeShop.variantCount}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {t("shopifyPage.summary.lastSync")}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {activeShop.lastProductsSyncAt
                      ? new Date(activeShop.lastProductsSyncAt).toLocaleString()
                      : t("shopifyPage.summary.neverSynced")}
                  </span>
                </div>
                {activeShop.shopCurrency && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.summary.currency")}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {activeShop.shopCurrency}
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeShop && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleSync(activeShop)}
                  disabled={syncingShop === activeShop.shopDomain}
                >
                  {syncingShop === activeShop.shopDomain
                    ? t("shopifyPage.actions.syncing")
                    : t("shopifyPage.actions.sync")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleRelink(activeShop)}
                >
                  {t("shopifyPage.actions.relink")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleUnlink(activeShop)}
                >
                  {t("shopifyPage.actions.unlink")}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("shopifyPage.widget.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("shopifyPage.widget.subtitle")}
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.widget.scriptUrl")}
                </div>
                <div className="mt-2 break-words rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {widgetScriptUrl ||
                    t("shopifyPage.widget.notReady")}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.widget.demo")}
                </span>
                <span>
                  {botSlug ? (
                    <a
                      className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
                      href={`/widget/${encodeURIComponent(botSlug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("shopifyPage.actions.openDemo")}
                    </a>
                  ) : (
                    t("shopifyPage.widget.notReady")
                  )}
                </span>
              </div>
            </div>

            {activeShop && (
              <>
                <button
                  type="button"
                  className="btn-secondary mt-4 w-full"
                  onClick={() => handleCheckWidget(activeShop)}
                  disabled={checkingWidget}
                >
                  {checkingWidget
                    ? t("shopifyPage.actions.checking")
                    : t("shopifyPage.actions.checkWidget")}
                </button>

                {widgetConfig && (
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t("shopifyPage.widget.connectedTo")}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {widgetConfig.botName || botName}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {t("shopifyPage.widget.botSlug")}: {" "}
                      {widgetConfig.botSlug}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("shopifyPage.capabilities.title")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.capabilities.search")}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.capabilities.cart")}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.capabilities.orders")}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.capabilities.webhooks")}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("shopifyPage.capabilities.noteTitle")}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t("shopifyPage.capabilities.noteBody")}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("shopifyPage.webhooks.title")}
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.appUninstalled")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.productsUpdate")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.productsDelete")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.inventoryUpdate")}{" "}
                {t("shopifyPage.webhooks.inventoryNote")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.customersDataRequest")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.customersRedact")}
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 px-3 py-2">
                {t("shopifyPage.webhooks.topics.shopRedact")}
              </li>
            </ul>
          </section>

          <section className="xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("shopifyPage.catalogSchema.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t("shopifyPage.catalogSchema.subtitle")}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={!activeShop?.shopDomain || rebuildingSchema || isTeamMember}
                onClick={handleRebuildSchema}
              >
                {rebuildingSchema
                  ? t("shopifyPage.catalogSchema.rebuilding")
                  : t("shopifyPage.catalogSchema.rebuild")}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.catalogSchema.lastBuild")}
                </div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  {loadingSchema
                    ? t("shopifyPage.catalogSchema.loading")
                    : catalogSchema?.updatedAt
                      ? new Date(catalogSchema.updatedAt).toLocaleString()
                      : t("shopifyPage.catalogSchema.none")}
                </div>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.catalogSchema.topAttributes")}
                </div>
                {catalogSchema?.attributes?.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {catalogSchema.attributes.slice(0, 6).map((attr) => (
                      <div
                        key={attr.name}
                        className="rounded-lg border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {attr.name}
                        </div>
                        <div className="text-slate-500">
                          {t("shopifyPage.catalogSchema.coverage")}:{" "}
                          {Math.round(attr.coverage * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">
                    {t("shopifyPage.catalogSchema.noAttributes")}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("shopifyPage.catalogContext.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t("shopifyPage.catalogContext.subtitle")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeShop?.shopDomain || rebuildingContext || isTeamMember}
                  onClick={handleRebuildContext}
                >
                  {rebuildingContext
                    ? t("shopifyPage.catalogContext.rebuilding")
                    : t("shopifyPage.catalogContext.rebuild")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!activeShop?.shopDomain || savingContext || isTeamMember}
                  onClick={handleSaveContext}
                >
                  {savingContext
                    ? t("shopifyPage.catalogContext.saving")
                    : t("shopifyPage.catalogContext.save")}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.catalogContext.lastBuild")}
                </div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  {loadingContext
                    ? t("shopifyPage.catalogContext.loading")
                    : catalogContext?.updatedAt
                      ? new Date(catalogContext.updatedAt).toLocaleString()
                      : t("shopifyPage.catalogContext.none")}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {t("shopifyPage.catalogContext.sampleSize")}:{" "}
                  {catalogContext?.sampleSize ?? "—"}
                </div>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-slate-100 dark:bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t("shopifyPage.catalogContext.summaryLabel")}
                </div>
                <textarea
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                  value={contextDraft.summary}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      summary: event.target.value
                    }))
                  }
                  placeholder={t("shopifyPage.catalogContext.summaryPlaceholder")}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.categories")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.categories}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      categories: event.target.value
                    }))
                  }
                  placeholder={t("shopifyPage.catalogContext.listHint")}
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.useCases")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.useCases}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      useCases: event.target.value
                    }))
                  }
                  placeholder={t("shopifyPage.catalogContext.listHint")}
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.audiences")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.audiences}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      audiences: event.target.value
                    }))
                  }
                  placeholder={t("shopifyPage.catalogContext.listHint")}
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.attributes")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.notableAttributes}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      notableAttributes: event.target.value
                    }))
                  }
                  placeholder={t("shopifyPage.catalogContext.listHint")}
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.pricePositioning")}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.pricePositioning}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      pricePositioning: event.target.value
                    }))
                  }
                >
                  {["unknown", "budget", "mid", "premium", "mixed"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.priceMin")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.priceMin}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      priceMin: event.target.value
                    }))
                  }
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.priceMax")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.priceMax}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      priceMax: event.target.value
                    }))
                  }
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200">
                {t("shopifyPage.catalogContext.priceCurrency")}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-3 py-2 text-sm"
                  value={contextDraft.priceCurrency}
                  onChange={(event) =>
                    setContextDraft((prev) => ({
                      ...prev,
                      priceCurrency: event.target.value
                    }))
                  }
                  placeholder="USD"
                />
              </label>
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

export default BotShopify;









