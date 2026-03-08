// src/api/adminOpenAIUsage.ts

import { authFetchJson } from "./authorizedClient";

export type AdminOpenAIUsageBotRow = {
  botId: string;
  slug: string;
  name: string;
  status: string;
  owner: {
    id: string;
    email: string;
    name: string | null;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    monthlyTokens: number | null;
  } | null;
  // OpenAI-only tokens
  monthTokens: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    requests: number;
  };
  // Knowledge (crawler) tokens this month
  knowledgeTokens: number;
  // Combined tokens (OpenAI + crawler)
  totalTokensAll: number;
  createdAt: string;
};

export type AdminOpenAIUsageGlobalModelRow = {
  model: string; // includes "Crawler"
  totalTokens: number;
  requestCount: number;
};

export type AdminOpenAIUsageGlobalUserRow = {
  userId: string;
  email: string;
  name: string | null;
  totalTokens: number;
  requestCount: number;
};

export type AdminOpenAIUsageResponse = {
  monthKey: string;
  window: {
    from: string;
    to: string;
  };
  filters: {
    q: string | null;
    model: string | null;
  };
  paging: {
    take: number;
    skip: number;
    total: number;
    hasMore: boolean;
  };
  bots: AdminOpenAIUsageBotRow[];
  global: {
    totalTokensOpenAI: number;
    totalTokensKnowledge: number;
    totalTokens: number; // combined
    requestCount: number; // OpenAI-only requests
    byModel: AdminOpenAIUsageGlobalModelRow[];
    topUsers: AdminOpenAIUsageGlobalUserRow[];
  };
};

export async function adminGetOpenAIUsage(params: {
  month?: string;
  q?: string;
  model?: string;
  take?: number;
  skip?: number;
}): Promise<AdminOpenAIUsageResponse> {
  const qs = new URLSearchParams();

  if (params.month) qs.set("month", params.month);
  if (params.q) qs.set("q", params.q);
  if (params.model) qs.set("model", params.model);
  if (typeof params.take === "number") qs.set("take", String(params.take));
  if (typeof params.skip === "number") qs.set("skip", String(params.skip));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminOpenAIUsageResponse>(
    `/admin/openai-usage${suffix}`
  );
}
