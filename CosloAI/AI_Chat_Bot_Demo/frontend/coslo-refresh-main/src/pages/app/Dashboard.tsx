// src/pages/app/DashboardPage.tsx

import React, { useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import {

  ResponsiveContainer,

  LineChart,

  Line,

  XAxis,

  YAxis,

  Tooltip,

  Legend,

  CartesianGrid,

  BarChart,

  Bar

} from "recharts";

import { Link } from "react-router-dom";

import {

  fetchDashboardOverview,

  fetchDashboardOverviewRange,

  fetchDashboardConversion,

  fetchDashboardShopifyAnalytics,
  fetchRevenueAIMetrics,

  DashboardOverviewResponse,

  DashboardOverviewRangeResponse,

  DashboardConversionResponse,

  DashboardShopifyAnalyticsResponse,
  RevenueAIMetricsResponse,

  TopBotActivity

} from "@/api/dashboard";



const LINE_COLORS = [

  "#6366F1", // indigo

  "#EC4899", // pink

  "#10B981", // green

  "#F59E0B", // amber

  "#3B82F6", // blue

  "#8B5CF6", // violet

  "#F97316", // orange

  "#22C55E" // emerald

];



const RANGE_PRESETS = [10, 30, 90];



function getLocaleFromLanguage(language: string | undefined): string {

  const code = (language || "en").split("-")[0];

  switch (code) {

    case "it":

      return "it-IT";

    case "es":

      return "es-ES";

    case "de":

      return "de-DE";

    case "fr":

      return "fr-FR";

    default:

      return "en-GB";

  }

}



const DashboardPage: React.FC = () => {

  const { t, i18n } = useTranslation();

  const locale = useMemo(

    () => getLocaleFromLanguage(i18n.resolvedLanguage || i18n.language),

    [i18n.language, i18n.resolvedLanguage]

  );



  const [data, setData] = useState<DashboardOverviewResponse | null>(null);

  const [rangeData, setRangeData] =

    useState<DashboardOverviewRangeResponse | null>(null);

  const [conversionData, setConversionData] =

    useState<DashboardConversionResponse | null>(null);

  const [shopifyData, setShopifyData] =

    useState<DashboardShopifyAnalyticsResponse | null>(null);

  const [revenueAIData, setRevenueAIData] =

    useState<RevenueAIMetricsResponse | null>(null);



  const [rangeDays, setRangeDays] = useState<number>(10);

  const [loading, setLoading] = useState<boolean>(true);

  const [rangeLoading, setRangeLoading] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    let mounted = true;



    const load = async () => {

      try {

        const res = await fetchDashboardOverview();

        if (mounted) setData(res);

      } catch (err: any) {

        console.error("Failed to load dashboard", err);

        if (mounted) {

          setError(err.message || t("dashboard.errors.loadFailed"));

        }

      } finally {

        if (mounted) setLoading(false);

      }

    };



    load();

    return () => {

      mounted = false;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  useEffect(() => {

    let mounted = true;



    const loadRange = async () => {

      setRangeLoading(true);

      try {

        const [overviewRange, conversion, shopifyAnalytics, revenueAI] = await Promise.all([

          fetchDashboardOverviewRange(rangeDays),

          fetchDashboardConversion(rangeDays),

          fetchDashboardShopifyAnalytics(rangeDays),
          fetchRevenueAIMetrics(rangeDays)

        ]);



        if (!mounted) return;

        setRangeData(overviewRange);

        setConversionData(conversion);

        setShopifyData(shopifyAnalytics);

        setRevenueAIData(revenueAI);

      } catch (err: any) {

        console.error("Failed to load dashboard range data", err);

      } finally {

        if (mounted) setRangeLoading(false);

      }

    };



    loadRange();

    return () => {

      mounted = false;

    };

  }, [rangeDays]);





  const hasBots = (data?.kpis.totalBots ?? 0) > 0;

  const chartSource = rangeData ? rangeData : data;
  const kpiSource = rangeData ? rangeData : data;

  const hasConvSeries =
    (chartSource?.conversationsLast10Days.series.length ?? 0) > 0;
  const hasTokenSeries =
    (chartSource?.tokensLast10Days.series.length ?? 0) > 0;
  const hasTopBots =
    (chartSource?.topBotsByConversationsLast30Days.length ?? 0) > 0;

  const hasTokenSplit =
    (chartSource?.tokenBreakdownLast10Days?.dates.length ?? 0) > 0;

  const hasTokenSplitByBot =
    chartSource?.tokenBreakdownByBotLast10Days &&
    chartSource.tokenBreakdownByBotLast10Days.length > 0;

  const hasShopifyBots = (shopifyData?.perBot?.length ?? 0) > 0;

  const tOr = (
    key: string,
    fallback: string,
    options?: Record<string, any>
  ): string => {

    const anyI18n = i18n as any;

    if (typeof anyI18n.exists === "function" && anyI18n.exists(key)) {

      return t(key, options);

    }

    return fallback;

  };



  const formatPct = (v: number | null | undefined): string => {

    if (v == null || Number.isNaN(v)) return "—";

    return `${v.toFixed(1)}%`;

  };



  // UI-only: show tokens/10 (raw stays in API + backend math)
  const tokensThisMonthUi = kpiSource
    ? Math.round(kpiSource.kpis.totalTokensThisMonth / 10)
    : 0;
  const tokensLimitUi =
    kpiSource?.kpis.monthlyTokensLimit == null
      ? null
      : Math.round(kpiSource.kpis.monthlyTokensLimit / 10);

  const tokensPlanHint = useMemo(() => {
    if (!kpiSource) return "";
    if (kpiSource.kpis.monthlyTokensLimit == null) {
      return tOr("dashboard.kpisHints.unlimitedPlan", "Unlimited plan");
    }
    if (kpiSource.kpis.monthlyTokensLimit <= 0) return "";
    const limit =
      tokensLimitUi ?? Math.round(kpiSource.kpis.monthlyTokensLimit / 10);
    return `${tOr("dashboard.kpisHints.of", "of")} ${limit.toLocaleString(
      locale
    )}`;
  }, [kpiSource, locale, tokensLimitUi, i18n, t]);

  const emailsPlanHint = useMemo(() => {
    if (!kpiSource) return "";
    if (kpiSource.kpis.monthlyEmailsLimit == null) {
      return tOr("dashboard.kpisHints.unlimitedPlan", "Unlimited plan");
    }
    if (kpiSource.kpis.monthlyEmailsLimit <= 0) return "";
    return `${tOr(
      "dashboard.kpisHints.of",
      "of"
    )} ${kpiSource.kpis.monthlyEmailsLimit.toLocaleString(locale)}`;
  }, [kpiSource, locale, i18n, t]);

  // Helpers for token UI formatting (keep raw numbers under the hood)
  const formatTokenTick = (value: number): string =>
    Math.round(value / 10).toLocaleString(locale);

  const formatTokenTooltipValue = (
    value: number | string,
    name: string
  ): [string, string] => {
    const num = typeof value === "number" ? value : Number(value) || 0;

    const ui = Math.round(num / 10).toLocaleString(locale);

    return [ui, name];

  };



  const chartTooltipStyle = {

    background: "rgba(2, 6, 23, 0.95)",

    border: "1px solid rgba(99, 102, 241, 0.35)",

    borderRadius: 12,

    padding: "0.55rem 0.75rem",

    fontSize: "0.8rem",

    color: "#e5e7eb",

    boxShadow: "0 12px 30px rgba(2, 6, 23, 0.55)"

  } as const;



  const chartLabelStyle = {

    color: "#9ca3af",

    fontSize: "0.75rem"

  } as const;



  const chartLegendStyle = {

    fontSize: "0.78rem",

    color: "#9ca3af"

  } as const;



  const formatDelta = (value: number | null | undefined): string => {

    if (value == null || Number.isNaN(value)) return "—";

    const prefix = value > 0 ? "+" : "";

    return `${prefix}${value.toFixed(1)}%`;

  };



  const totalConversationsInRange = useMemo(() => {

    if (!chartSource || !chartSource.conversationsLast10Days.series) return 0;

    return chartSource.conversationsLast10Days.series.reduce((sum, s) => {

      const seriesSum = (s.values || []).reduce((a, b) => a + (b || 0), 0);

      return sum + seriesSum;

    }, 0);

  }, [chartSource]);



  const formatAlertValue = (alert: { metric: string; value: number }): string => {

    if (alert.metric === "tokens") {

      return Math.round(alert.value / 10).toLocaleString(locale);

    }

    return alert.value.toLocaleString(locale);

  };



  const formatAlertPrevValue = (alert: { metric: string; previousValue: number }): string => {

    if (alert.metric === "tokens") {

      return Math.round(alert.previousValue / 10).toLocaleString(locale);

    }

    return alert.previousValue.toLocaleString(locale);

  };



  // ---- Chart data transforms ----

  const conversationsChartData = useMemo(() => {

    if (!chartSource || !hasConvSeries) return [];

    const { dates, series } = chartSource.conversationsLast10Days;



    return dates.map((date, idx) => {

      const entry: Record<string, any> = { date };

      series.forEach((s) => {

        entry[s.botName] = s.values[idx] ?? 0;

      });

      return entry;

    });

  }, [chartSource, hasConvSeries]);



  const tokensChartData = useMemo(() => {

    if (!chartSource || !hasTokenSeries) return [];

    const { dates, series } = chartSource.tokensLast10Days;



    // IMPORTANT: keep raw values here, only format in axis/tooltip

    return dates.map((date, idx) => {

      const entry: Record<string, any> = { date };

      series.forEach((s) => {

        entry[s.botName] = s.values[idx] ?? 0;

      });

      return entry;

    });

  }, [chartSource, hasTokenSeries]);



  const tokenSplitChartData = useMemo(() => {

    if (!chartSource || !hasTokenSplit) return [];

    const { dates, openAiTokens, emailTokens, whatsappTokens } =

      chartSource.tokenBreakdownLast10Days;



    // Raw token values; formatted in axis/tooltip

    return dates.map((date, idx) => ({
      date,
      openAi: openAiTokens[idx] ?? 0,
      emails: emailTokens[idx] ?? 0,
      whatsapp: whatsappTokens[idx] ?? 0
    }));

  }, [chartSource, hasTokenSplit]);



  // NEW: per-bot breakdown chart data (aggregated over last 10 days)

  const tokenSplitByBotChartData = useMemo(() => {

    if (!chartSource || !hasTokenSplitByBot) return [];

    return chartSource.tokenBreakdownByBotLast10Days.map((row) => ({

      botName: row.botName,

      openAi: row.openAiTokens,

      emails: row.emailTokens,

      whatsapp: row.whatsappTokens

    }));

  }, [chartSource, hasTokenSplitByBot]);



  const topBotsChartData = useMemo(() => {

    if (!chartSource || !hasTopBots) return [];

    return chartSource.topBotsByConversationsLast30Days.map((b: TopBotActivity) => ({

      name: b.botName,

      conversations: b.conversationCount

    }));

  }, [chartSource, hasTopBots]);



  const shopifyChartData = useMemo(() => {

    if (!shopifyData) return [];

    return shopifyData.series.dates.map((date, idx) => ({

      date,

      view: shopifyData.series.viewProduct[idx] ?? 0,

      add: shopifyData.series.addToCart[idx] ?? 0,

      purchase: shopifyData.series.purchases[idx] ?? 0

    }));

  }, [shopifyData]);



  const shopifyPerBotChartData = useMemo(() => {

    if (!shopifyData?.perBot?.length) return [];

    return shopifyData.perBot.map((row) => ({

      botName: row.botName,

      view: row.viewProduct,

      add: row.addToCart,

      purchase: row.purchases

    }));

  }, [shopifyData]);



  return (

    <div className="page-container dashboard-page">

      <div className="page-header">

        <div>

          <h1 className="page-title">{t("dashboard.title")}</h1>

          <p className="page-subtitle">{t("dashboard.subtitle")}</p>

        </div>



        {hasBots && (

          <Link to="/onboarding/bots/new" className="btn-primary">

            {t("dashboard.actions.createNewBot")}

          </Link>

        )}

      </div>



      {!loading && !error && hasBots && (

        <div className="dashboard-range-panel">

        <div className="dashboard-range-row">

          <div className="dashboard-range-left">

            <span className="dashboard-range-label">

              {t("dashboard.range.label")}

            </span>

            <div className="dashboard-range-pills">

              {RANGE_PRESETS.map((d) => (

                <button

                  key={d}

                  type="button"

                  className={

                    "dashboard-range-pill" +

                    (rangeDays === d ? " dashboard-range-pill--active" : "")

                  }

                  onClick={() => setRangeDays(d)}

                >
                  {t("dashboard.range.last")} {d}{" "}
                  {t("dashboard.range.days")}
                </button>

              ))}

            </div>

          </div>

          <div className="dashboard-range-hint">

            {rangeLoading

               ? t("dashboard.range.loading")

              : t("dashboard.range.hint")}

          </div>

        </div>

        </div>

      )}



      {loading && (

        <div className="card">

          <p>{t("dashboard.loading")}</p>

        </div>

      )}



      {!loading && error && (

        <div className="card card-error">

          <p>{error}</p>

        </div>

      )}



      {!loading && !error && !hasBots && (

        <div className="card">

          <h2 className="card-title">{t("dashboard.empty.title")}</h2>

          <p className="card-subtitle">{t("dashboard.empty.subtitle")}</p>

          <div className="mt-4">

            <Link to="/onboarding/bots/new" className="btn-primary">

              {t("dashboard.empty.cta")}

            </Link>

          </div>

        </div>

      )}



      {!loading && !error && hasBots && data && (

        <>

          {/* KPI cards */}

<section className="dashboard-section">

  <div className="dashboard-section-header">

    <div>

      <h2 className="dashboard-section-title">

        {tOr("dashboard.sections.overview", "At a glance")}

      </h2>

      <p className="dashboard-section-subtitle">

        {tOr(

          "dashboard.sections.overviewSubtitle",

          "Core health signals across your bots."

        )}

      </p>

    </div>

  </div>

  {/* Row 1 – bots & conversations */}

  <div className="dashboard-kpi-row dashboard-kpi-row--top">

    <div className="dashboard-kpi-card dashboard-kpi-card--bots">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {t("dashboard.kpis.totalBots")}

      </div>

      <div className="dashboard-kpi-value">

        {kpiSource?.kpis.totalBots ?? 0}

      </div>

      <div className="dashboard-kpi-hint">

        {t("dashboard.kpisHints.totalBots")}

      </div>

    </div>



    <div className="dashboard-kpi-card dashboard-kpi-card--active">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {t("dashboard.kpis.activeBots")}

      </div>

      <div className="dashboard-kpi-value">

        {kpiSource?.kpis.activeBots ?? 0}

      </div>

      <div className="dashboard-kpi-hint">

        {t("dashboard.kpisHints.activeBots")}

      </div>

    </div>



    <div className="dashboard-kpi-card dashboard-kpi-card--conversations">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {t("dashboard.kpis.conversationsLast30Days", { days: rangeDays })}

      </div>

      <div className="dashboard-kpi-value">

        {kpiSource?.kpis.totalConversationsLast30Days ?? 0}

      </div>

      <div className="dashboard-kpi-hint">

        {t("dashboard.kpisHints.conversationsLast30Days")}

      </div>

    </div>

  </div>



  {/* Row 2 – energy, emails, WhatsApp messages */}

  <div className="dashboard-kpi-row dashboard-kpi-row--bottom">

    {/* Energy (tokens) */}

    <div className="dashboard-kpi-card dashboard-kpi-card--tokens">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {t("dashboard.kpis.tokensThisMonth", { days: rangeDays })}

      </div>



      <div className="dashboard-kpi-value-row">

        <div className="dashboard-kpi-value">

          {tokensThisMonthUi.toLocaleString(locale)}

        </div>

        {kpiSource.kpis.tokensUsagePercent != null && (

          <span className="dashboard-kpi-pill">

            {formatPct(kpiSource.kpis.tokensUsagePercent)}

          </span>

        )}

      </div>



      <div className="dashboard-kpi-hint">{tokensPlanHint}</div>

    </div>



    {/* Emails */}

    <div className="dashboard-kpi-card dashboard-kpi-card--emails">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {tOr(

          "dashboard.kpis.emailsThisMonth",

          `Emails sent (last ${rangeDays} days)`,

          { days: rangeDays }

        )}

      </div>

      <div className="dashboard-kpi-value-row">

        <div className="dashboard-kpi-value">

          {(kpiSource?.kpis.totalEmailsThisMonth ?? 0).toLocaleString(locale)}

        </div>

        {kpiSource.kpis.emailsUsagePercent != null && (

          <span className="dashboard-kpi-pill">

            {formatPct(kpiSource.kpis.emailsUsagePercent)}

          </span>

        )}

      </div>

      <div className="dashboard-kpi-hint">{emailsPlanHint}</div>

    </div>



    {/* WhatsApp messages / leads */}

    <div className="dashboard-kpi-card dashboard-kpi-card--whatsapp">

      <div className="dashboard-kpi-label">

        <span className="dashboard-kpi-icon" />

        {tOr(

          "dashboard.kpis.whatsappLeadsThisMonth",

          `WhatsApp leads (last ${rangeDays} days)`,

          { days: rangeDays }

        )}

      </div>

      <div className="dashboard-kpi-value">

        {(kpiSource?.kpis.totalWhatsappLeadsThisMonth ?? 0).toLocaleString(locale)}

      </div>

      <div className="dashboard-kpi-hint">

        {tOr(

          "dashboard.kpisHints.whatsappLeadsThisMonth",

          `Number of WhatsApp lead templates sent in the last ${rangeDays} days`,

          { days: rangeDays }

        )}

      </div>

    </div>

  </div>

</section>




          <section className="dashboard-section">

            <div className="dashboard-conversion-card card">

              <div className="card-header">

                <h2>{t("dashboard.conversion.title")}</h2>

                <p className="card-subtitle">

                  {t("dashboard.conversion.subtitle")}

                </p>

              </div>



              {conversionData ? (

                <>

                  <div className="dashboard-conversion-grid">

                    <div>

                      <div className="dashboard-conversion-value">

                        {conversionData.totals.conversations.toLocaleString(locale)}

                      </div>

                      <div className="dashboard-conversion-label">

                        {t("dashboard.conversion.conversations")}

                      </div>

                    </div>

                    <div>

                      <div className="dashboard-conversion-value">

                        {conversionData.totals.leads.toLocaleString(locale)}

                      </div>

                      <div className="dashboard-conversion-label">

                        {t("dashboard.conversion.leads")}

                      </div>

                      <div className="dashboard-conversion-rate">

                        {conversionData.totals.conversations > 0

                           ? `${conversionData.totals.leadRate.toFixed(1)}%`

                          : "—"}

                      </div>

                    </div>

                    <div>

                      <div className="dashboard-conversion-value">

                        {conversionData.totals.bookings.toLocaleString(locale)}

                      </div>

                      <div className="dashboard-conversion-label">

                        {t("dashboard.conversion.bookings")}

                      </div>

                      <div className="dashboard-conversion-rate">

                        {conversionData.totals.leads > 0 ||

                        conversionData.totals.conversations > 0 ||

                        conversionData.totals.bookings > 0

                           ? `${conversionData.totals.bookingRate.toFixed(1)}%`

                          : "—"}

                      </div>

                    </div>

                  </div>



                  <div className="dashboard-conversion-footer">

                    <Link to="/app/dashboard/conversion" className="btn-link-small">

                      {t("dashboard.conversion.viewDetails")}

                    </Link>

                  </div>

                </>

              ) : (

                <p className="card-empty">

                  {t("dashboard.conversion.empty")}

                </p>

              )}

            </div>

          </section>



          {hasShopifyBots && (

          <section className="dashboard-section">

            <div className="card">

              <div className="card-header">

                <h2>

                  {tOr(

                    "dashboard.shopify.title",

                    "Shopify assistant commerce"

                  )}

                </h2>

                <p className="card-subtitle">

                  {tOr(

                    "dashboard.shopify.subtitle",

                    "Track product views, add-to-cart clicks, and purchases driven by the assistant."

                  )}

                  <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                    {t("dashboard.range.days")}

                  </span>

                </p>

              </div>



              {shopifyData ? (

                <>

                  <div className="dashboard-kpi-row dashboard-kpi-row--bottom">

                    <div className="dashboard-kpi-card">

                      <div className="dashboard-kpi-label">

                        {tOr(

                          "dashboard.shopify.viewProduct",

                          "View product clicks"

                        )}

                      </div>

                      <div className="dashboard-kpi-value">

                        {shopifyData.totals.viewProduct.toLocaleString(locale)}

                      </div>

                    </div>

                    <div className="dashboard-kpi-card">

                      <div className="dashboard-kpi-label">

                        {tOr(

                          "dashboard.shopify.addToCart",

                          "Add to cart clicks"

                        )}

                      </div>

                      <div className="dashboard-kpi-value">

                        {shopifyData.totals.addToCart.toLocaleString(locale)}

                      </div>

                    </div>

                    <div className="dashboard-kpi-card">

                      <div className="dashboard-kpi-label">

                        {tOr("dashboard.shopify.purchases", "Purchases")}

                      </div>

                      <div className="dashboard-kpi-value">

                        {shopifyData.totals.purchases.toLocaleString(locale)}

                      </div>

                    </div>

                    <div className="dashboard-kpi-card">

                      <div className="dashboard-kpi-label">

                        {tOr(

                          "dashboard.shopify.revenue",

                          "Revenue attributed"

                        )}

                      </div>

                      <div className="dashboard-kpi-value">

                        {shopifyData.totals.revenueFormatted}

                      </div>

                    </div>

                  </div>



                  <div className="w-full h-[260px] mt-4">

                    <ResponsiveContainer>

                      <BarChart data={shopifyChartData}>

                        <CartesianGrid strokeDasharray="3 3" />

                        <XAxis dataKey="date" />

                        <YAxis allowDecimals={false} />

                        <Tooltip

                          contentStyle={{

                            background: "rgba(17,24,39,0.95)",

                            border: "1px solid rgba(255,255,255,0.08)",

                            borderRadius: 10,

                            padding: "0.45rem 0.7rem",

                            fontSize: "0.8rem"

                          }}

                          labelStyle={{ color: "#9ca3af" }}

                        />

                        <Legend />

                        <Bar

                          dataKey="view"

                          fill="#60A5FA"

                          name={tOr(

                            "dashboard.shopify.viewProduct",

                            "View product clicks"

                          )}

                        />

                        <Bar

                          dataKey="add"

                          fill="#F59E0B"

                          name={tOr(

                            "dashboard.shopify.addToCart",

                            "Add to cart clicks"

                          )}

                        />

                        <Bar

                          dataKey="purchase"

                          fill="#22C55E"

                          name={tOr("dashboard.shopify.purchases", "Purchases")}

                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>



                  {shopifyPerBotChartData.length > 0 && (

                    <div className="w-full h-[280px] mt-6">

                      <div className="card-subtitle mb-2.5">

                        {tOr(

                          "dashboard.shopify.byBot",

                          "Shopify activity by bot"

                        )}

                      </div>

                      <ResponsiveContainer>

                        <BarChart data={shopifyPerBotChartData}>

                          <CartesianGrid strokeDasharray="3 3" />

                          <XAxis dataKey="botName" />

                          <YAxis allowDecimals={false} />

                          <Tooltip

                            contentStyle={{

                              background: "rgba(17,24,39,0.95)",

                              border: "1px solid rgba(255,255,255,0.08)",

                              borderRadius: 10,

                              padding: "0.45rem 0.7rem",

                              fontSize: "0.8rem"

                            }}

                            labelStyle={{ color: "#9ca3af" }}

                          />

                          <Legend />

                          <Bar

                            dataKey="view"

                            fill="#60A5FA"

                            name={tOr(

                              "dashboard.shopify.viewProduct",

                              "View product clicks"

                            )}

                          />

                          <Bar

                            dataKey="add"

                            fill="#F59E0B"

                            name={tOr(

                              "dashboard.shopify.addToCart",

                              "Add to cart clicks"

                            )}

                          />

                          <Bar

                            dataKey="purchase"

                            fill="#22C55E"

                            name={tOr("dashboard.shopify.purchases", "Purchases")}

                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>

                  )}

                </>

              ) : (

                <p className="card-empty">

                  {tOr(

                    "dashboard.shopify.empty",

                    "No Shopify analytics yet."

                  )}

                </p>

              )}

            </div>

          </section>

          )}

          {revenueAIData && (
          <section className="dashboard-section">
            <div className="card">
              <div className="card-header">
                <h2>{t("dashboard.revenueAI.title")}</h2>
                <p className="card-subtitle">
                  {t("dashboard.revenueAI.subtitle")}
                  <span className="dashboard-range-tag">
                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}
                    {t("dashboard.range.days")}
                  </span>
                </p>
              </div>

              <div className="dashboard-kpi-row dashboard-kpi-row--bottom">
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    {t("dashboard.revenueAI.metrics.impressions")}
                  </div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.totals.impressions.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    {t("dashboard.revenueAI.metrics.viewProduct")}
                  </div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.totals.clicks.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    {t("dashboard.revenueAI.metrics.addToCart")}
                  </div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.totals.addToCart.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    {t("dashboard.revenueAI.metrics.checkout")}
                  </div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.totals.checkout.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    {t("dashboard.revenueAI.metrics.influencedRevenue")}
                  </div>
                  <div className="dashboard-kpi-value">
                    {new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2
                    }).format(revenueAIData.totals.revenueCents / 100)}
                  </div>
                </div>
              </div>

              <div className="w-full h-[240px] mt-4">
                <ResponsiveContainer>
                  <BarChart
                    data={revenueAIData.series.dates.map((date, idx) => ({
                      date,
                      impressions: revenueAIData.series.impressions[idx] ?? 0,
                      clicks: revenueAIData.series.clicks[idx] ?? 0,
                      addToCart: revenueAIData.series.addToCart[idx] ?? 0,
                      checkout: revenueAIData.series.checkout[idx] ?? 0,
                      purchases: revenueAIData.series.purchases[idx] ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="impressions"
                      fill="#60A5FA"
                      name={t("dashboard.revenueAI.metrics.impressions")}
                    />
                    <Bar
                      dataKey="clicks"
                      fill="#F59E0B"
                      name={t("dashboard.revenueAI.metrics.viewProduct")}
                    />
                    <Bar
                      dataKey="addToCart"
                      fill="#10B981"
                      name={t("dashboard.revenueAI.metrics.addToCart")}
                    />
                    <Bar
                      dataKey="checkout"
                      fill="#22C55E"
                      name={t("dashboard.revenueAI.metrics.checkout")}
                    />
                    <Bar
                      dataKey="purchases"
                      fill="#111827"
                      name={t("dashboard.revenueAI.metrics.purchases")}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="dashboard-grid mt-4">
                <div className="card">
                  <div className="card-subtitle">
                    {t("dashboard.revenueAI.impact.title")}
                  </div>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t("dashboard.revenueAI.impact.atcRateUplift")}</span>
                      <span className="font-semibold">
                        {formatPct(revenueAIData.impact.uplift.addToCartRate)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.revenueAI.impact.offerSessions")} {" "}
                      {formatPct(revenueAIData.impact.withOffer.addToCartRate)} {" "}
                      {t("dashboard.revenueAI.impact.without")}
                      {formatPct(revenueAIData.impact.withoutOffer.addToCartRate)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("dashboard.revenueAI.impact.checkoutRateUplift")}</span>
                      <span className="font-semibold">
                        {formatPct(revenueAIData.impact.uplift.checkoutRate)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.revenueAI.impact.offerSessions")} {" "}
                      {formatPct(revenueAIData.impact.withOffer.checkoutRate)} {" "}
                      {t("dashboard.revenueAI.impact.without")}
                      {formatPct(revenueAIData.impact.withoutOffer.checkoutRate)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("dashboard.revenueAI.impact.aovUplift")}</span>
                      <span className="font-semibold">
                        {new Intl.NumberFormat(locale, {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 2
                        }).format(revenueAIData.impact.uplift.aovCents / 100)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.revenueAI.impact.withOffers")} {" "}
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 2
                      }).format(revenueAIData.impact.withOffer.aovCents / 100)}{" "}
                      {t("dashboard.revenueAI.impact.without")}
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 2
                      }).format(revenueAIData.impact.withoutOffer.aovCents / 100)}
                    </div>

                  </div>
                </div>
                <div className="card">
                  <div className="card-subtitle">{t("dashboard.revenueAI.style.title")}</div>
                  <div className="grid gap-3 text-sm">
                    {revenueAIData.byStyle.length === 0 && (
                      <div className="text-sm text-muted-foreground">{t("dashboard.revenueAI.style.empty")}</div>
                    )}
                    {revenueAIData.byStyle.map((row) => (
                      <div key={row.style} className="grid gap-1">
                        <div className="flex items-center justify-between">
                          <span>{row.style}</span>
                          <span className="text-muted-foreground">
                            {t("dashboard.revenueAI.style.ctr")} {formatPct(row.ctr)}{t("dashboard.revenueAI.style.atc")} {formatPct(row.atcRate)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.revenueAI.style.checkout")} {formatPct(row.checkoutRate)}{t("dashboard.revenueAI.style.revenue")} {" "}
                          {new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 2
                          }).format(row.revenueCents / 100)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card mt-4">
                <div className="card-subtitle">{t("dashboard.revenueAI.topProducts.title")}</div>
                {revenueAIData.productFunnels.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("dashboard.revenueAI.topProducts.empty")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="text-left">
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.product")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.impressions")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.ctr")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.atc")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.checkout")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.purchases")}</th>
                          <th className="py-2 pr-4">{t("dashboard.revenueAI.topProducts.columns.revenue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueAIData.productFunnels.slice(0, 8).map((row) => (
                          <tr key={row.productId} className="border-t border-white/5">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                {row.imageUrl && (
                                  <img
                                    src={row.imageUrl}
                                    alt={row.title || row.productId}
                                    className="h-8 w-8 rounded-md object-cover"
                                  />
                                )}
                                <span>{row.title || row.productId}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-4">{row.impressions}</td>
                            <td className="py-2 pr-4">{formatPct(row.rates.ctr)}</td>
                            <td className="py-2 pr-4">{formatPct(row.rates.atcRate)}</td>
                            <td className="py-2 pr-4">{formatPct(row.rates.checkoutRate)}</td>
                            <td className="py-2 pr-4">{formatPct(row.rates.purchaseRate)}</td>
                            <td className="py-2 pr-4">
                              {new Intl.NumberFormat(locale, {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 2
                              }).format(row.revenueCents / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="dashboard-kpi-row dashboard-kpi-row--bottom mt-4">
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">{t("dashboard.revenueAI.sessions.withSuggestion")}</div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.sessions.withSuggestion.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">{t("dashboard.revenueAI.sessions.withoutSuggestion")}</div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.sessions.withoutSuggestion.toLocaleString(locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">{t("dashboard.revenueAI.sessions.total")}</div>
                  <div className="dashboard-kpi-value">
                    {revenueAIData.sessions.total.toLocaleString(locale)}
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}



          {/* Conversations / Tokens charts */}

          <section className="dashboard-section">

            <div className="dashboard-section-header">

              <div>

                <h2 className="dashboard-section-title">

                  {tOr("dashboard.sections.trends", "Trends")}

                </h2>

                <p className="dashboard-section-subtitle">

                  {tOr(

                    "dashboard.sections.trendsSubtitle",

                    "Conversations, usage, and performance over time."

                  )}

                </p>

              </div>

            </div>

            <div className="dashboard-grid">

              <div className="card chart-card">

                <div className="card-header">

                  <h2>

                    {t("dashboard.charts.conversationsLast10Days.title", {

                      days: rangeDays

                    })}

                  </h2>

                  <p className="card-subtitle">

                    {t("dashboard.charts.conversationsLast10Days.subtitle")}

                    <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                      {t("dashboard.range.days")}

                    </span>

                  </p>

                </div>



                {hasConvSeries ? (

                  <div className="dashboard-chart">

                    <ResponsiveContainer>

                      <LineChart data={conversationsChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />

                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <Tooltip

                          contentStyle={chartTooltipStyle}

                          labelStyle={chartLabelStyle}

                        />

                        <Legend wrapperStyle={chartLegendStyle} />

                        {chartSource.conversationsLast10Days.series.map(

                          (s, idx) => (

                            <Line

                              key={s.botId}

                              type="monotone"

                              dataKey={s.botName}

                              stroke={

                                LINE_COLORS[idx % LINE_COLORS.length]

                              }

                              strokeWidth={2}

                              dot={false}

                            />

                          )

                        )}

                      </LineChart>

                    </ResponsiveContainer>

                  </div>

                ) : (

                  <p className="card-empty">

                    {t("dashboard.charts.conversationsLast10Days.empty")}

                  </p>

                )}

              </div>



              <div className="card chart-card">

                <div className="card-header">

                  <h2>

                    {t("dashboard.charts.tokensLast10Days.title", {

                      days: rangeDays

                    })}

                  </h2>

                  <p className="card-subtitle">

                    {t("dashboard.charts.tokensLast10Days.subtitle")}

                    <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                      {t("dashboard.range.days")}

                    </span>

                  </p>

                </div>



                {hasTokenSeries ? (

                  <div className="dashboard-chart">

                    <ResponsiveContainer>

                      <LineChart data={tokensChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />

                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <YAxis

                          allowDecimals={false}

                          tickFormatter={formatTokenTick}

                          tick={{ fill: "#9ca3af", fontSize: 11 }}

                        />

                        <Tooltip

                          contentStyle={chartTooltipStyle}

                          labelStyle={chartLabelStyle}

                          formatter={formatTokenTooltipValue}

                        />

                        <Legend wrapperStyle={chartLegendStyle} />

                        {chartSource.tokensLast10Days.series.map((s, idx) => (

                          <Line

                            key={s.botId}

                            type="monotone"

                            dataKey={s.botName}

                            stroke={

                              LINE_COLORS[idx % LINE_COLORS.length]

                            }

                            strokeWidth={2}

                            dot={false}

                          />

                        ))}

                      </LineChart>

                    </ResponsiveContainer>

                  </div>

                ) : (

                  <p className="card-empty">

                    {t("dashboard.charts.tokensLast10Days.empty")}

                  </p>

                )}

              </div>



              {/* Existing split by channel over time */}

              <div className="card chart-card">

                <div className="card-header">

                  <h2>

                    {tOr(

                      "dashboard.charts.tokensSplitLast10Days.title",

                      `Tokens by channel (last ${rangeDays} days)`,

                      { days: rangeDays }

                    )}

                  </h2>

                  <p className="card-subtitle">

                    {tOr(

                      "dashboard.charts.tokensSplitLast10Days.subtitle",

                      "OpenAI + knowledge vs emails vs WhatsApp templates"

                    )}

                    <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                      {t("dashboard.range.days")}

                    </span>

                  </p>

                </div>



                {hasTokenSplit ? (

                  <div className="dashboard-chart">

                    <ResponsiveContainer>

                      <BarChart data={tokenSplitChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />

                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <YAxis

                          allowDecimals={false}

                          tickFormatter={formatTokenTick}

                          tick={{ fill: "#9ca3af", fontSize: 11 }}

                        />

                        <Tooltip

                          contentStyle={chartTooltipStyle}

                          labelStyle={chartLabelStyle}

                          formatter={formatTokenTooltipValue}

                        />

                        <Legend wrapperStyle={chartLegendStyle} />

                        {/* OpenAI + Knowledge */}

                        <Bar

                          dataKey="openAi"

                          stackId="tokens"

                          fill="#6366F1"

                          name={tOr(

                            "dashboard.tokensSplit.legend.openAi",

                            "OpenAI + knowledge"

                          )}

                          radius={[6, 6, 0, 0]}

                        />

                        {/* Emails (virtual tokens) */}

                        <Bar

                          dataKey="emails"

                          stackId="tokens"

                          fill="#F97316"

                          name={tOr(

                            "dashboard.tokensSplit.legend.emails",

                            "Emails"

                          )}

                        />

                        {/* WhatsApp lead templates */}

                        <Bar

                          dataKey="whatsapp"

                          stackId="tokens"

                          fill="#22C55E"

                          name={tOr(

                            "dashboard.tokensSplit.legend.whatsapp",

                            "WhatsApp templates"

                          )}

                          radius={[0, 0, 6, 6]}

                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                ) : (

                  <p className="card-empty">

                    {tOr(

                      "dashboard.charts.tokensSplitLast10Days.empty",

                      "Not enough data yet to show the split."

                    )}

                  </p>

                )}

              </div>



              {/* NEW: per-bot breakdown by channel */}

              <div className="card chart-card">

                <div className="card-header">

                  <h2>

                    {tOr(

                      "dashboard.charts.tokensSplitByBotLast10Days.title",

                      `Tokens by bot & channel (last ${rangeDays} days)`,

                      { days: rangeDays }

                    )}

                  </h2>

                  <p className="card-subtitle">

                    {tOr(

                      "dashboard.charts.tokensSplitByBotLast10Days.subtitle",

                      "How each bot consumes tokens via OpenAI + knowledge, emails, and WhatsApp templates"

                    )}

                    <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                      {t("dashboard.range.days")}

                    </span>

                  </p>

                </div>



                {hasTokenSplitByBot ? (

                  <div className="dashboard-chart">

                    <ResponsiveContainer>

                      <BarChart data={tokenSplitByBotChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />

                        <XAxis dataKey="botName" tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <YAxis

                          allowDecimals={false}

                          tickFormatter={formatTokenTick}

                          tick={{ fill: "#9ca3af", fontSize: 11 }}

                        />

                        <Tooltip

                          contentStyle={chartTooltipStyle}

                          labelStyle={chartLabelStyle}

                          formatter={formatTokenTooltipValue}

                        />

                        <Legend wrapperStyle={chartLegendStyle} />

                        <Bar

                          dataKey="openAi"

                          stackId="tokens"

                          fill="#6366F1"

                          name={tOr(

                            "dashboard.tokensSplit.legend.openAi",

                            "OpenAI + knowledge"

                          )}

                          radius={[6, 6, 0, 0]}

                        />

                        <Bar

                          dataKey="emails"

                          stackId="tokens"

                          fill="#F97316"

                          name={tOr(

                            "dashboard.tokensSplit.legend.emails",

                            "Emails"

                          )}

                        />

                        <Bar

                          dataKey="whatsapp"

                          stackId="tokens"

                          fill="#22C55E"

                          name={tOr(

                            "dashboard.tokensSplit.legend.whatsapp",

                            "WhatsApp templates"

                          )}

                          radius={[0, 0, 6, 6]}

                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                ) : (

                  <p className="card-empty">

                    {tOr(

                      "dashboard.charts.tokensSplitByBotLast10Days.empty",

                      "Not enough data yet to show per-bot split."

                    )}

                  </p>

                )}

              </div>



              <div className="card chart-card">

                <div className="card-header">

                  <h2>{t("dashboard.charts.topBots.title")}</h2>

                  <p className="card-subtitle">

                    {t("dashboard.charts.topBots.subtitle")}

                    <span className="dashboard-range-tag">

                    {"\u2022"} {t("dashboard.range.last")} {rangeDays}{" "}

                      {t("dashboard.range.days")}

                    </span>

                  </p>

                </div>



                {hasTopBots ? (

                  <div className="dashboard-chart">

                    <ResponsiveContainer>

                      <BarChart data={topBotsChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />

                        <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />

                        <Tooltip

                          contentStyle={chartTooltipStyle}

                          labelStyle={chartLabelStyle}

                        />

                        <Bar

                          dataKey="conversations"

                          fill="#6366F1"

                          radius={[6, 6, 0, 0]}

                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                ) : (

                  <p className="card-empty">

                    {t("dashboard.charts.topBots.empty")}

                  </p>

                )}

              </div>



              <div className="card chart-card">

                <div className="card-header">

                  <h2>{t("dashboard.activity.title")}</h2>

                  <p className="card-subtitle">

                    {t("dashboard.activity.subtitle")}

                  </p>

                </div>



                {hasTopBots ? (

                  <ul className="list-plain">

                    {chartSource.topBotsByConversationsLast30Days.map((bot) => (

                      <li key={bot.botId} className="list-row">

                        <div className="list-row-main">

                          <div className="list-title">{bot.botName}</div>

                          {bot.lastConversationAt && (

                            <div className="list-subtitle">

                              {t("dashboard.activity.lastConversation")}{" "}

                              {new Date(

                                bot.lastConversationAt

                              ).toLocaleString(locale)}

                            </div>

                          )}

                        </div>



                        <div className="list-row-meta">

                          <span className="badge">

                            {bot.conversationCount}{" "}

                            {t("dashboard.activity.convAbbrev")}

                          </span>

                          <Link

                            to={`/app/bots/${bot.botId}/conversations`}

                            className="btn-link-small"

                          >

                            {t("dashboard.activity.view")}

                          </Link>

                        </div>

                      </li>

                    ))}

                  </ul>

                ) : (

                  <p className="card-empty">

                    {t("dashboard.activity.empty")}

                  </p>

                )}

              </div>

            </div>

          </section>

        </>

      )}

    </div>

  );

};



export default DashboardPage;

