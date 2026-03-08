// src/api/adminBots.ts
import { authFetchJson } from "./authorizedClient";

export type AdminBotStatus = "DRAFT" | "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "CANCELED";

export type AdminSubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "UNPAID";

export type AdminUsagePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyAmountCents: number;
  currency: string;
  monthlyTokens: number | null;
  monthlyEmails: number | null;
  isActive: boolean;
};

export type AdminBotSubscription = {
  id: string;
  status: AdminSubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currency: string | null;

  usagePlanId: string | null;
  usagePlanCode: string | null;
  usagePlanName: string | null;
  monthlyAmountCents: number | null;
  monthlyTokens: number | null;
  monthlyEmails: number | null;
};

export type AdminBotListItem = {
  id: string;
  name: string;
  slug: string;
  status: AdminBotStatus;
  createdAt: string;

  owner: {
    id: string;
    email: string;
    name: string | null;
  };

  channelWeb: boolean;
  channelWhatsapp: boolean;
  channelInstagram: boolean;
  channelMessenger: boolean;
  externalChannelCount: number;

  subscription: AdminBotSubscription | null;

  booking: {
    enabled: boolean;
    calendarId: string | null;
    timeZone: string | null;
    defaultDurationMinutes: number | null;
    bookingMinLeadHours: number | null;
    bookingMaxAdvanceDays: number | null;
    bookingReminderWindowHours: number | null;
    bookingReminderMinLeadHours: number | null;
    bookingConfirmationEmailEnabled: boolean;
    bookingReminderEmailEnabled: boolean;
  };

  autoEvaluateConversations: boolean;

  tokensLast30Days: number;
  emailsLast30Days: number;
  bookingsLast30Days: number;
};

export type AdminBotListResponse = {
  items: AdminBotListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminUsagePlanListResponse = {
  items: AdminUsagePlan[];
};

export async function adminListBots(params: {
  q?: string;
  status?: AdminBotStatus;
  hasSubscription?: boolean;
  planCode?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminBotListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.status) {
    qs.set("status", params.status);
  }
  if (typeof params.hasSubscription === "boolean") {
    qs.set("hasSubscription", params.hasSubscription ? "true" : "false");
  }
  if (params.planCode && params.planCode.trim()) {
    qs.set("planCode", params.planCode.trim());
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminBotListResponse>(`/admin/bots${suffix}`);
}

export async function adminUpdateBot(
  botId: string,
  body: {
    status?: AdminBotStatus;
    autoEvaluateConversations?: boolean;
    usagePlanId?: string | null;
  }
): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(`/admin/bots/${encodeURIComponent(botId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function adminListUsagePlans(): Promise<AdminUsagePlanListResponse> {
  return authFetchJson<AdminUsagePlanListResponse>("/admin/usage-plans");
}
