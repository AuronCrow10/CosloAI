// src/api/adminUsers.ts
import { authFetchJson } from "./authorizedClient";

export type AdminUserRole = "ADMIN" | "CLIENT" | "REFERRER" | "TEAM_MEMBER";

export type AdminUserListItem = {
  id: string;
  email: string;
  name: string | null;
  role: AdminUserRole;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;

  botsCount: number;
  referralLeadsCount: number;
  isReferralPartner: boolean;

  totalTokensLast30Days: number;
  lastUsageAt: string | null;
};

export type AdminUserListResponse = {
  items: AdminUserListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export async function adminListUsers(params: {
  q?: string;
  role?: AdminUserRole;
  page?: number;
  pageSize?: number;
}): Promise<AdminUserListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.role) {
    qs.set("role", params.role);
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminUserListResponse>(`/admin/users${suffix}`);
}

export async function adminUpdateUser(
  userId: string,
  body: { role?: AdminUserRole; emailVerified?: boolean }
): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
