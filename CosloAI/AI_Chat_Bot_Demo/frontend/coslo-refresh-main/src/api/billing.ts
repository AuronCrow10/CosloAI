// src/api/billing.ts
import { authFetchJson } from "./authorizedClient";
import type { BotStatus } from "./bots";

export type SubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "UNPAID";

export interface SubscriptionSummary {
  botId: string;
  botName: string;
  botSlug: string;
  botStatus: BotStatus;
  subscriptionStatus: SubscriptionStatus;
  currency: string;

  totalMonthlyAmountCents: number;
  totalMonthlyAmountFormatted: string;
  featuresAmountCents: number;
  planAmountCents: number;

  usagePlanId: string | null;
  usagePlanName: string | null;
  usagePlanCode: string | null;

  // Tokens
  monthlyTokens: number | null;
  usedTokensThisPeriod: number;
  usagePercent: number | null;

  // Emails
  monthlyEmails: number | null;
  usedEmailsThisPeriod: number;
  emailUsagePercent: number | null;

  // ✅ NEW: WhatsApp leads
  monthlyWhatsappLeads: number | null;
  usedWhatsappLeadsThisPeriod: number;
  whatsappUsagePercent: number | null;

  periodStart: string;
  periodEnd: string;

  cancelAtPeriodEnd?: boolean;
  cancelAtPeriodEndDate?: string | null;
}

export interface PaymentSummary {
  id: string;
  botId: string;
  botName: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  hasInvoice: boolean;
  kind?: "SUBSCRIPTION" | "TOP_UP";
}

export interface BillingOverviewResponse {
  subscriptions: SubscriptionSummary[];
  totalMonthlyAmountCents: number;
  totalMonthlyAmountFormatted: string;
  payments: PaymentSummary[];
}

export async function fetchBillingOverview(): Promise<BillingOverviewResponse> {
  return authFetchJson<BillingOverviewResponse>("/billing/overview");
}

export async function getPaymentInvoiceUrl(
  paymentId: string
): Promise<{ url: string }> {
  return authFetchJson<{ url: string }>(
    `/billing/payments/${encodeURIComponent(paymentId)}/invoice-url`
  );
}


export interface BotTopUpOptionsResponse {
  botId: string;
  botName: string;
  usagePlanName: string;
  currency: string;
  baseMonthlyTokens: number;
  baseMonthlyAmountCents: number;
  baseMonthlyAmountFormatted: string;
  options: {
    code: string;
    percentTokens: number;
    percentPrice: number;
    extraTokens: number;
    priceCents: number;
    priceFormatted: string;
  }[];
}

export async function fetchTopUpOptions(
  botId: string
): Promise<BotTopUpOptionsResponse> {
  return authFetchJson<BotTopUpOptionsResponse>(
    `/bots/${encodeURIComponent(botId)}/topup-options`
  );
}

export async function startTopUpCheckout(
  botId: string,
  optionCode: string
): Promise<{ checkoutUrl: string }> {
  return authFetchJson<{ checkoutUrl: string }>(
    `/bots/${encodeURIComponent(botId)}/topup-checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionCode })
    }
  );
}

export async function cancelBotSubscription(
  botId: string
): Promise<{
  ok: boolean;
  cancelAtPeriodEnd?: boolean;
  periodEnd?: string | null;
}> {
  return authFetchJson<{
    ok: boolean;
    cancelAtPeriodEnd?: boolean;
    periodEnd?: string | null;
  }>(`/bots/${encodeURIComponent(botId)}/cancel-subscription`, {
    method: "POST"
  });
}
