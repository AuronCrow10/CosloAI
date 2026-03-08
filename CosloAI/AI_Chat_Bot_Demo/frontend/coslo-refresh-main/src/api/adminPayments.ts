// src/api/adminPayments.ts
import { authFetchJson } from "./authorizedClient";
import type { AdminBotStatus } from "./adminBots";

export type AdminPaymentPlan = {
  id: string;
  code: string;
  name: string;
  monthlyAmountCents: number;
  currency: string;
};

export type AdminPaymentReferral = {
  id: string;
  partnerId: string;
  partnerUserId: string | null;
  partnerUserEmail: string | null;
  partnerUserName: string | null;
  commissionCents: number;
  amountBaseCents: number;
  currency: string;
  kind: string;
  status: string;
};

export type AdminPaymentListItem = {
  id: string;

  bot: {
    id: string;
    name: string;
    slug: string;
    status: AdminBotStatus;
    owner: {
      id: string;
      email: string;
      name: string | null;
    };
  };

  amountCents: number;
  currency: string;
  status: string;

  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;

  billingEmail: string | null;
  billingName: string | null;
  billingAddressJson: unknown | null;

  periodStart: string | null;
  periodEnd: string | null;

  createdAt: string;
  updatedAt: string;

  plan: AdminPaymentPlan | null;
  referral: AdminPaymentReferral | null;
};

export type AdminPaymentTotalsByCurrencyItem = {
  currency: string;
  totalAmountCents: number;
  count: number;
};

export type AdminPaymentListResponse = {
  items: AdminPaymentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalsByCurrency: AdminPaymentTotalsByCurrencyItem[];
};

export async function adminListPayments(params: {
  q?: string;
  status?: string;
  hasReferral?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminPaymentListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.status && params.status.trim()) {
    qs.set("status", params.status.trim());
  }
  if (typeof params.hasReferral === "boolean") {
    qs.set("hasReferral", params.hasReferral ? "true" : "false");
  }
  if (params.dateFrom && params.dateFrom.trim()) {
    qs.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo && params.dateTo.trim()) {
    qs.set("dateTo", params.dateTo.trim());
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminPaymentListResponse>(`/admin/payments${suffix}`);
}
