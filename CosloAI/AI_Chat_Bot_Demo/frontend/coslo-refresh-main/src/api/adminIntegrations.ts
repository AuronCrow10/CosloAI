// src/api/adminIntegrations.ts
import { authFetchJson } from "./authorizedClient";

export type AdminMetaIntegration = {
  id: string;
  createdAt: string;
  channelType: "FACEBOOK" | "INSTAGRAM" | "MESSENGER" | string;
  user: {
    id: string;
    email: string;
  };
  bot: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  pages: {
    count: number;
    names: string[];
  };
};

export type AdminWhatsappIntegration = {
  id: string;
  createdAt: string;
  wabaId: string;
  user: {
    id: string;
    email: string;
  };
  bot: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  phoneNumbers: {
    count: number;
    display: string[];
  };
};

export type AdminIntegrationsResponse = {
  meta: AdminMetaIntegration[];
  whatsapp: AdminWhatsappIntegration[];
};

export async function adminListIntegrations(params?: {
  q?: string;
  limit?: number;
}): Promise<AdminIntegrationsResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (typeof params?.limit === "number") qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminIntegrationsResponse>(`/admin/integrations${suffix}`);
}

export async function adminDeleteMetaIntegration(
  id: string
): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(
    `/admin/integrations/meta/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function adminDeleteWhatsappIntegration(
  id: string
): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(
    `/admin/integrations/whatsapp/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
