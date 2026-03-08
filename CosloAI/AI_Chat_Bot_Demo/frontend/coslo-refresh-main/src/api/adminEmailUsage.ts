// src/api/adminEmailUsage.ts
import { authFetchJson } from "./authorizedClient";
import type { AdminBotStatus } from "./adminBots";

export type AdminEmailUsageBotItem = {
  botId: string;
  botName: string;
  botSlug: string;
  botStatus: AdminBotStatus;
  botCreatedAt: string;

  owner: {
    id: string;
    email: string;
    name: string | null;
  };

  usagePlan: {
    id: string;
    code: string;
    name: string;
    monthlyEmails: number | null;
    monthlyAmountCents: number;
    currency: string;
  } | null;

  emailsThisMonth: number;
  monthlyEmailLimit: number | null;
  usageRatio: number | null; // 0–1 when limit is set
  isOverLimit: boolean;
};

export type AdminEmailUsageSummaryByPlanItem = {
  usagePlanId: string | null;
  usagePlanCode: string | null;
  usagePlanName: string | null;
  monthlyEmails: number | null;
  botsCount: number;
  overLimitBotsCount: number;
  totalEmailsThisMonth: number;
};

export type AdminEmailUsageListResponse = {
  items: AdminEmailUsageBotItem[];
  page: number;
  pageSize: number;
  total: number;
  monthStart: string;
  monthEndExclusive: string;
  summaryByPlan: AdminEmailUsageSummaryByPlanItem[];
};

export async function adminListEmailUsage(params: {
  q?: string;
  status?: AdminBotStatus;
  planCode?: string;
  overLimitOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<AdminEmailUsageListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.status) {
    qs.set("status", params.status);
  }
  if (params.planCode && params.planCode.trim()) {
    qs.set("planCode", params.planCode.trim());
  }
  if (typeof params.overLimitOnly === "boolean") {
    qs.set("overLimitOnly", params.overLimitOnly ? "true" : "false");
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminEmailUsageListResponse>(`/admin/email-usage${suffix}`);
}
