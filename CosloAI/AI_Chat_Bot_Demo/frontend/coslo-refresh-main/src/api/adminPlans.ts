// src/api/adminPlans.ts
import { authFetchJson } from "./authorizedClient";

export interface AdminUsagePlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyTokens: number | null;
  monthlyEmails: number | null;
  monthlyAmountCents: number;
  currency: string;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subscriptionsCount: number;
}

export interface AdminUsagePlanListResponse {
  items: AdminUsagePlan[];
  total: number;
}

export interface AdminUsagePlanUpsertPayload {
  code: string;
  name: string;
  description?: string | null;
  monthlyTokens?: number | null;
  monthlyEmails?: number | null;
  monthlyAmountCents: number;
  currency: string;
  stripePriceId?: string | null;
  isActive?: boolean;
}

export interface AdminFeaturePrice {
  id: string;
  code: string;
  label: string;
  monthlyAmountCents: number;
  currency: string;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeaturePriceListResponse {
  items: AdminFeaturePrice[];
  total: number;
}

export interface AdminFeaturePriceUpsertPayload {
  code: string;
  label: string;
  monthlyAmountCents: number;
  currency: string;
  stripePriceId?: string | null;
  isActive?: boolean;
}

/* ========== Usage plans ========== */

export async function adminListUsagePlans(params?: {
  search?: string;
  includeInactive?: boolean;
  take?: number;
  skip?: number;
}): Promise<AdminUsagePlanListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.includeInactive) qs.set("includeInactive", "true");
  if (typeof params?.take === "number") qs.set("take", String(params.take));
  if (typeof params?.skip === "number") qs.set("skip", String(params.skip));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminUsagePlanListResponse>(`/admin/plans${suffix}`);
}

export async function adminCreateUsagePlan(
  body: AdminUsagePlanUpsertPayload
): Promise<AdminUsagePlan> {
  return authFetchJson<AdminUsagePlan>("/admin/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function adminUpdateUsagePlan(
  id: string,
  body: Partial<AdminUsagePlanUpsertPayload>
): Promise<AdminUsagePlan> {
  return authFetchJson<AdminUsagePlan>(`/admin/plans/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function adminDeleteUsagePlan(id: string): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(`/admin/plans/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

/* ========== Feature prices (legacy) ========== */

export async function adminListFeaturePrices(params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<AdminFeaturePriceListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.includeInactive) qs.set("includeInactive", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminFeaturePriceListResponse>(`/admin/feature-prices${suffix}`);
}

export async function adminCreateFeaturePrice(
  body: AdminFeaturePriceUpsertPayload
): Promise<AdminFeaturePrice> {
  return authFetchJson<AdminFeaturePrice>("/admin/feature-prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function adminUpdateFeaturePrice(
  id: string,
  body: Partial<AdminFeaturePriceUpsertPayload>
): Promise<AdminFeaturePrice> {
  return authFetchJson<AdminFeaturePrice>(`/admin/feature-prices/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function adminDeleteFeaturePrice(id: string): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(`/admin/feature-prices/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}
