// src/api/adminConversations.ts
import { authFetchJson } from "./authorizedClient";

export type AdminConversationChannel = "WEB" | "WHATSAPP" | "FACEBOOK" | "INSTAGRAM";
export type AdminConversationMode = "AI" | "HUMAN";

export type AdminConversationListItem = {
  id: string;
  botId: string;
  channel: AdminConversationChannel;
  mode: AdminConversationMode;
  externalUserId: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  latestEval: {
    score: number;
    label: string | null;
    isAuto: boolean;
    createdAt: string;
  } | null;
  bot: {
    id: string;
    name: string;
    slug: string;
    owner: {
      id: string;
      email: string;
      name: string | null;
    };
  };
};

export type AdminConversationListResponse = {
  items: AdminConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminConversationBotSummaryItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  owner: {
    id: string;
    email: string;
    name: string | null;
  };
  conversationCount: number;
  lastMessageAt: string | null;
};

export type AdminConversationBotSummaryResponse = {
  items: AdminConversationBotSummaryItem[];
  page: number;
  pageSize: number;
  total: number;
};

export async function adminListConversationBots(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminConversationBotSummaryResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminConversationBotSummaryResponse>(
    `/admin/conversations/bots${suffix}`
  );
}

export async function adminListConversations(params: {
  q?: string;
  botId?: string;
  channel?: AdminConversationChannel;
  mode?: AdminConversationMode;
  page?: number;
  pageSize?: number;
}): Promise<AdminConversationListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.botId && params.botId.trim()) {
    qs.set("botId", params.botId.trim());
  }
  if (params.channel) {
    qs.set("channel", params.channel);
  }
  if (params.mode) {
    qs.set("mode", params.mode);
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminConversationListResponse>(`/admin/conversations${suffix}`);
}
