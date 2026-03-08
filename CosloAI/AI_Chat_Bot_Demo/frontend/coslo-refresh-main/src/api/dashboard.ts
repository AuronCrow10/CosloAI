// src/api/dashboard.ts
import { authFetchJson } from "./authorizedClient";

export interface DashboardKpis {
  totalBots: number;
  activeBots: number;
  totalConversationsLast30Days: number;

  // Raw tokens (AI + Knowledge + virtual tokens) for the current month
  totalTokensThisMonth: number;

  // Plan limits aggregated across all bots (null = unlimited / unknown)
  monthlyTokensLimit: number | null;
  tokensUsagePercent: number | null;

  // Email usage for the current month (count of EmailUsage rows)
  totalEmailsThisMonth: number;
  monthlyEmailsLimit: number | null;
  emailsUsagePercent: number | null;

  // NEW: WhatsApp lead templates sent this month (count of metaLead rows with whatsappStatus=SENT)
  totalWhatsappLeadsThisMonth: number;
}

export interface DashboardSeriesPoint {
  botId: string;
  botName: string;
  values: number[]; // aligned with dates array
}

export interface DashboardTimeSeries {
  dates: string[]; // e.g. ["2025-12-01", ...]
  series: DashboardSeriesPoint[];
}

export interface TopBotActivity {
  botId: string;
  botName: string;
  conversationCount: number;
  lastConversationAt: string | null; // ISO string
}

export interface DashboardTokenBreakdownTimeSeries {
  dates: string[];
  openAiTokens: number[]; // OpenAI + Knowledge
  emailTokens: number[]; // email virtual tokens
  whatsappTokens: number[]; // WA lead template virtual tokens
}

// NEW: per-bot aggregated breakdown over the last 10 days
export interface DashboardTokenBreakdownByBot {
  botId: string;
  botName: string;
  openAiTokens: number;
  emailTokens: number;
  whatsappTokens: number;
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpis;
  conversationsLast10Days: DashboardTimeSeries;
  tokensLast10Days: DashboardTimeSeries;
  tokenBreakdownLast10Days: DashboardTokenBreakdownTimeSeries;
  tokenBreakdownByBotLast10Days: DashboardTokenBreakdownByBot[];
  topBotsByConversationsLast30Days: TopBotActivity[];
}

export interface DashboardOverviewRangeResponse extends DashboardOverviewResponse {
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
}

export interface DashboardCompareSummary {
  conversations: number;
  tokens: number;
  emails: number;
  whatsappLeads: number;
  bookings: number;
}

export interface DashboardCompareResponse {
  days: number;
  current: DashboardCompareSummary;
  previous: DashboardCompareSummary;
  delta: Record<string, number | null>;
}

export interface DashboardAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  metric: string;
  value: number;
  previousValue: number;
}

export interface DashboardAlertsResponse {
  rangeDays: number;
  alerts: DashboardAlert[];
}

export interface DashboardChannelBreakdownResponse {
  rangeDays: number;
  totals: {
    openAiTokens: number;
    emailTokens: number;
    whatsappTokens: number;
    totalTokens: number;
    emailCount: number;
    whatsappLeadCount: number;
  };
}

export interface DashboardBotHealthItem {
  botId: string;
  botName: string;
  status: string;
  healthScore: number;
  lastConversationAt: string | null;
  conversationsLast30Days: number;
  channels: {
    web: boolean;
    whatsapp: boolean;
    facebook: boolean;
    instagram: boolean;
  };
  knowledgeEnabled: boolean;
  calendarEnabled: boolean;
}

export interface RevenueAIMetricsResponse {
  rangeDays: number;
  totals: {
    impressions: number;
    clicks: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    revenueCents: number;
  };
  series: {
    dates: string[];
    impressions: number[];
    clicks: number[];
    addToCart: number[];
    checkout: number[];
    purchases: number[];
    revenueCents: number[];
  };
  funnel: {
    impressions: number;
    clicks: number;
    addToCart: number;
    checkout: number;
    purchases: number;
  };
  byStyle: Array<{
    style: string;
    impressions: number;
    clicks: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    revenueCents: number;
    ctr: number;
    atcRate: number;
    checkoutRate: number;
    purchaseRate: number;
  }>;
  impact: {
    withOffer: {
      sessions: number;
      addToCartSessions: number;
      checkoutSessions: number;
      purchaseSessions: number;
      revenueCents: number;
      purchaseCount: number;
      addToCartRate: number;
      checkoutRate: number;
      purchaseRate: number;
      aovCents: number;
    };
    withoutOffer: {
      sessions: number;
      addToCartSessions: number;
      checkoutSessions: number;
      purchaseSessions: number;
      revenueCents: number;
      purchaseCount: number;
      addToCartRate: number;
      checkoutRate: number;
      purchaseRate: number;
      aovCents: number;
    };
    uplift: {
      addToCartRate: number;
      checkoutRate: number;
      purchaseRate: number;
      aovCents: number;
    };
  };
  productFunnels: Array<{
    productId: string;
    title: string | null;
    imageUrl: string | null;
    impressions: number;
    clicks: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    revenueCents: number;
    rates: {
      ctr: number;
      atcRate: number;
      checkoutRate: number;
      purchaseRate: number;
    };
  }>;
  topProducts: Array<{ productId: string; count: number; title?: string | null; imageUrl?: string | null }>;
  perBot: Array<{
    botId: string;
    botName: string;
    impressions: number;
    clicks: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    revenueCents: number;
  }>;
  sessions: { withSuggestion: number; withoutSuggestion: number; total: number };
}

export async function fetchRevenueAIMetrics(
  days = 30,
  botId?: string
): Promise<RevenueAIMetricsResponse> {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (botId) params.set("botId", botId);
  return authFetchJson<RevenueAIMetricsResponse>(
    `/dashboard/revenue-ai?${params.toString()}`
  );
}

export interface DashboardBotHealthResponse {
  items: DashboardBotHealthItem[];
}

export interface DashboardConversionRow {
  botId: string;
  botName: string;
  conversations: number;
  leads: number;
  bookings: number;
  leadRate: number;
  bookingRate: number;
}

export interface DashboardConversionResponse {
  rangeDays: number;
  totals: {
    conversations: number;
    leads: number;
    bookings: number;
    leadRate: number;
    bookingRate: number;
  };
  perBot: DashboardConversionRow[];
}

export interface DashboardShopifyAnalyticsResponse {
  rangeDays: number;
  totals: {
    viewProduct: number;
    addToCart: number;
    purchases: number;
    revenueCents: number;
    revenueFormatted: string;
  };
  series: {
    dates: string[];
    viewProduct: number[];
    addToCart: number[];
    purchases: number[];
  };
  perBot: Array<{
    botId: string;
    botName: string;
    viewProduct: number;
    addToCart: number;
    purchases: number;
    revenueCents: number;
  }>;
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewResponse> {
  return authFetchJson<DashboardOverviewResponse>("/dashboard/overview");
}

export async function fetchDashboardOverviewRange(
  days: number
): Promise<DashboardOverviewRangeResponse> {
  return authFetchJson<DashboardOverviewRangeResponse>(
    `/dashboard/overview-range?days=${days}`
  );
}

export async function fetchDashboardCompare(
  days: number
): Promise<DashboardCompareResponse> {
  return authFetchJson<DashboardCompareResponse>(
    `/dashboard/overview-compare?days=${days}`
  );
}

export async function fetchDashboardAlerts(
  days: number
): Promise<DashboardAlertsResponse> {
  return authFetchJson<DashboardAlertsResponse>(`/dashboard/alerts?days=${days}`);
}

export async function fetchDashboardChannelBreakdown(
  days: number
): Promise<DashboardChannelBreakdownResponse> {
  return authFetchJson<DashboardChannelBreakdownResponse>(
    `/dashboard/channel-breakdown?days=${days}`
  );
}

export async function fetchDashboardBotHealth(): Promise<DashboardBotHealthResponse> {
  return authFetchJson<DashboardBotHealthResponse>("/dashboard/bots-health");
}

export async function fetchDashboardConversion(
  days: number
): Promise<DashboardConversionResponse> {
  return authFetchJson<DashboardConversionResponse>(
    `/dashboard/conversion?days=${days}`
  );
}

export async function fetchDashboardShopifyAnalytics(
  days: number
): Promise<DashboardShopifyAnalyticsResponse> {
  return authFetchJson<DashboardShopifyAnalyticsResponse>(
    `/dashboard/shopify-analytics?days=${days}`
  );
}
