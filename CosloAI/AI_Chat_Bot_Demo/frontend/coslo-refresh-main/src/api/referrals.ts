// src/api/referrals.ts
import { API_BASE_URL, handleJsonResponse } from "./client";
import { authFetchJson } from "./authorizedClient";

/** YYYY-MM (UTC) */
export function monthKeyForDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type ReferralCode = {
  id?: string;
  code: string;
  isActive: boolean;
};

export type ReferralsMeResponse = {
  id: string;
  status: "ACTIVE" | "SUSPENDED";
  commissionBps: number;
  codes: ReferralCode[];
  createdAt: string;
  updatedAt: string;
};

export type ReferralsMeStatsResponse = {
  month: string; // YYYY-MM
  activeAttributions: number;
  conversionsThisMonth: number;
  referredUsersTotal: number;
  referredUsers: Array<{
    id: string;
    email: string;
    createdAt: string;
    referralCode: string | null;
  }>;
  totalsByCurrency: Array<{
    currency: string;
    revenueCents: number;
    commissionCents: number;
  }>;
  payoutPeriods: Array<{
    currency: string;
    amountCents: number;
    status: "OPEN" | "PAID";
    paidAt: string | null;
  }>;
};

export type AdminPartnerRow = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  status: "ACTIVE" | "SUSPENDED";
  commissionBps: number;
  codes: Array<{ code: string; isActive: boolean }>;
  createdAt: string;
};

export type AdminOverviewResponse = {
  monthKey: string;
  totals: {
    monthByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
    lifetimeByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
    dueThisMonth: {
      openByCurrency: Array<{ currency: string; amountCents: number }>;
      paidByCurrency: Array<{ currency: string; amountCents: number }>;
    };
  };
  partners: Array<{
    partnerId: string;
    userId: string;
    email: string;
    name: string | null;
    status: "ACTIVE" | "SUSPENDED";
    commissionBps: number;
    codes: Array<{ code: string; isActive: boolean }>;

    clientsTotal: number;
    clientsActive: number;
    lastConversionAt: string | null;

    month: {
      monthKey: string;
      totalsByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
      payoutPeriods: Array<{
        currency: string;
        amountCents: number;
        status: "OPEN" | "PAID";
        paidAt: string | null;
      }>;
    };

    lifetime: {
      totalsByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
    };
  }>;
};

export type AdminPartnerDetailResponse = {
  partner: {
    id: string;
    userId: string;
    email: string;
    name: string | null;
    status: "ACTIVE" | "SUSPENDED";
    commissionBps: number;
    codes: Array<{ code: string; isActive: boolean }>;
    createdAt: string;
  };
  clients: {
    total: number;
    active: number;
  };
  month: {
    monthKey: string;
    totalsByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
    payoutPeriods: Array<{
      currency: string;
      amountCents: number;
      status: "OPEN" | "PAID";
      paidAt: string | null;
    }>;
  };
  lifetime: {
    totalsByCurrency: Array<{ currency: string; revenueCents: number; commissionCents: number }>;
  };
  recent: {
    attributions: Array<{
      id: string;
      startedAt: string;
      endedAt: string | null;
      referralCode: string;
      referredUser: { id: string; email: string };
      bot: { id: string; name: string; slug: string; status: string };
      stripeSubscriptionId: string | null;
    }>;
    commissions: Array<{
      id: string;
      createdAt: string;
      monthKey: string;
      currency: string;
      kind: string;
      status: string;
      revenueCents: number;
      commissionCents: number;
      stripeInvoiceId: string | null;
      stripeSubscriptionId: string | null;
    }>;
  };
  referredUsers: {
    total: number;
    items: Array<{
      id: string;
      email: string;
      createdAt: string;
      referralCode: string | null;
    }>;
  };
  payoutHistory: Array<{
    monthKey: string;
    currency: string;
    amountCents: number;
    status: "OPEN" | "PAID";
    paidAt: string | null;
  }>;
};

/** Public: track + cookie */
export async function trackReferral(code: string, path?: string): Promise<{ ok: true; code: string }> {
  const qs = new URLSearchParams({ code });
  if (path) qs.set("path", path);

  const res = await fetch(`${API_BASE_URL}/referrals/track?${qs.toString()}`, {
    method: "GET",
    credentials: "include"
  });
  return handleJsonResponse<{ ok: true; code: string }>(res);
}

export async function clearReferralCookie(): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE_URL}/referrals/clear`, {
    method: "POST",
    credentials: "include"
  });
  return handleJsonResponse<{ ok: true }>(res);
}

/** Referrer self (AUTH REQUIRED) */
export async function getReferralsMe(): Promise<ReferralsMeResponse> {
  return authFetchJson<ReferralsMeResponse>("/referrals/me");
}

export async function getReferralsMeStats(month?: string): Promise<ReferralsMeStatsResponse> {
  const qs = new URLSearchParams();
  if (month) qs.set("month", month);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<ReferralsMeStatsResponse>(`/referrals/me/stats${suffix}`);
}

/** Admin (AUTH + ADMIN ROLE REQUIRED) */
export async function adminListReferralPartners(): Promise<AdminPartnerRow[]> {
  return authFetchJson<AdminPartnerRow[]>("/referrals/admin/partners");
}

export async function adminCreateOrUpdatePartner(body: {
  userId?: string;
  email?: string;
  commissionBps?: number;
  createCode?: boolean;
}): Promise<{ partnerId: string; userId: string; commissionBps: number; createdCode: string | null }> {
  return authFetchJson<{ partnerId: string; userId: string; commissionBps: number; createdCode: string | null }>(
    "/referrals/admin/partners",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

export async function adminPatchPartner(
  partnerId: string,
  body: { status?: "ACTIVE" | "SUSPENDED"; commissionBps?: number }
): Promise<{ ok: true; partner: any }> {
  return authFetchJson<{ ok: true; partner: any }>(
    `/referrals/admin/partners/${encodeURIComponent(partnerId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

export async function adminCreatePartnerCode(partnerId: string): Promise<{ ok: true; code: string }> {
  return authFetchJson<{ ok: true; code: string }>(
    `/referrals/admin/partners/${encodeURIComponent(partnerId)}/codes`,
    { method: "POST" }
  );
}

export async function adminGetOverview(month?: string): Promise<AdminOverviewResponse> {
  const qs = new URLSearchParams();
  if (month) qs.set("month", month);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminOverviewResponse>(`/referrals/admin/overview${suffix}`);
}

export async function adminGetPartnerDetail(params: {
  partnerId: string;
  month?: string;
  take?: number;
  skip?: number;
}): Promise<AdminPartnerDetailResponse> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (typeof params.take === "number") qs.set("take", String(params.take));
  if (typeof params.skip === "number") qs.set("skip", String(params.skip));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminPartnerDetailResponse>(
    `/referrals/admin/partners/${encodeURIComponent(params.partnerId)}/detail${suffix}`
  );
}

export async function adminMarkPartnerMonthPaid(params: {
  partnerId: string;
  monthKey: string;
}): Promise<{ ok: true; updated: number }> {
  return authFetchJson<{ ok: true; updated: number }>(
    `/referrals/admin/partners/${encodeURIComponent(params.partnerId)}/payouts/${encodeURIComponent(
      params.monthKey
    )}/mark-paid`,
    { method: "POST" }
  );
}
