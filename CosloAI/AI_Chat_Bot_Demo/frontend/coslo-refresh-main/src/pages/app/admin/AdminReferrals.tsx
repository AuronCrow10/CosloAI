// src/pages/app/admin/AdminReferralsPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminCreateOrUpdatePartner,
  adminGetOverview,
  monthKeyForDateUTC,
  AdminOverviewResponse
} from "@/api/referrals";

const formatCurrency = (amountCents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amountCents / 100);

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyForDateUTC(d);
}

function isProbablyEmail(value: string): boolean {
  const v = value.trim();
  // Simple + strict enough for UI; backend validates with zod.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type CreatePartnerResult = {
  partnerId: string;
  userId: string;
  commissionBps: number;
  createdCode: string | null;
  email: string;
};

const AdminReferrals: React.FC = () => {
  const locale = useMemo(() => "en-GB", []);
  const [monthKey, setMonthKey] = useState(() => monthKeyForDateUTC(new Date()));

  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createCommissionBps, setCreateCommissionBps] = useState<string>("");
  const [createCode, setCreateCode] = useState(true);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<CreatePartnerResult | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const loadOverview = useCallback(
    async (mk: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetOverview(mk);
        if (signal?.aborted) return;
        setData(res);
      } catch (err: any) {
        if (signal?.aborted) return;
        setError(err?.message || "Failed to load admin referral overview.");
      } finally {
        if (signal?.aborted) return;
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(monthKey, controller.signal);
    return () => controller.abort();
  }, [monthKey, loadOverview]);

  // Focus email on open, add ESC close
  useEffect(() => {
    if (!showCreateModal) return;

    const t = window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreateModal]);

  const openCreate = () => {
    setCreateEmail("");
    setCreateCommissionBps("");
    setCreateCode(true);
    setCreateError(null);
    setCreateSuccess(null);
    setShowCreateModal(true);
  };

  const onSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = createEmail.trim().toLowerCase();
    if (!isProbablyEmail(email)) {
      setCreateError("Please enter a valid email address.");
      return;
    }

    let commissionBps: number | undefined = undefined;
    if (createCommissionBps.trim()) {
      const n = Number(createCommissionBps.trim());
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        setCreateError("Commission BPS must be a whole number (e.g. 1000 = 10%).");
        return;
      }
      if (n < 1 || n > 5000) {
        setCreateError("Commission BPS must be between 1 and 5000.");
        return;
      }
      commissionBps = n;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const res = await adminCreateOrUpdatePartner({
        email,
        commissionBps,
        createCode
      });

      const success: CreatePartnerResult = {
        ...res,
        email
      };
      setCreateSuccess(success);

      // Refresh overview (same month currently selected)
      await loadOverview(monthKey);

      // Keep modal open so admin can copy code (if returned).
      // You can close manually with the buttons.
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create/activate partner.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1>Referrals admin</h1>
          <p className="muted">Overview + partners drill-down.</p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
          >
            ← Prev
          </button>
          <div className="month-pill">{monthKey}</div>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
          >
            Next →
          </button>

          <button className="btn-primary" type="button" onClick={openCreate}>
            + Add partner
          </button>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading...</p>
        </div>
      )}
      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Totals ({data.monthKey})</h2>
              <p className="card-subtitle">Revenue/commission + due payouts for the selected month.</p>
            </div>

            <h3 className="mt-3">Month</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Revenue</th>
                    <th>Commission</th>
                    <th>Due (OPEN)</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totals.monthByCurrency.map((r) => {
                    const open =
                      data.totals.dueThisMonth.openByCurrency.find((x) => x.currency === r.currency)
                        ?.amountCents ?? 0;
                    const paid =
                      data.totals.dueThisMonth.paidByCurrency.find((x) => x.currency === r.currency)
                        ?.amountCents ?? 0;
                    return (
                      <tr key={r.currency}>
                        <td>{r.currency.toUpperCase()}</td>
                        <td>{formatCurrency(r.revenueCents, r.currency, locale)}</td>
                        <td>{formatCurrency(r.commissionCents, r.currency, locale)}</td>
                        <td>{formatCurrency(open, r.currency, locale)}</td>
                        <td>{formatCurrency(paid, r.currency, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>Partners</h2>
              <p className="card-subtitle">Click a partner to drill down (attributions, commissions, payouts).</p>
            </div>

            {data.partners.length === 0 ? (
              <p className="card-empty">No partners found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table payments-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Clients</th>
                      <th>Active</th>
                      <th>Last conversion</th>
                      <th>Month commission</th>
                      <th className="payments-actions-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.partners.map((p) => {
                      const monthCommission = p.month.totalsByCurrency.reduce(
                        (acc, r) => acc + r.commissionCents,
                        0
                      );
                      const monthCurrency = p.month.totalsByCurrency[0]?.currency || "eur";
                      return (
                        <tr key={p.partnerId}>
                          <td>{p.email}</td>
                          <td>{p.status}</td>
                          <td>{p.clientsTotal}</td>
                          <td>{p.clientsActive}</td>
                          <td>{p.lastConversionAt ? new Date(p.lastConversionAt).toLocaleString(locale) : "—"}</td>
                          <td>{formatCurrency(monthCommission, monthCurrency, locale)}</td>
                          <td className="payments-actions-cell">
                            <Link
                              className="btn-link-small"
                              to={`/app/admin/referrals/partners/${p.partnerId}?month=${encodeURIComponent(
                                monthKey
                              )}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add partner modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add referral partner"
          onMouseDown={(e) => {
            // close on backdrop click only
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="card w-full max-w-[720px] max-h-[85vh] overflow-auto">
            <div className="card-header">
              <h2 className="m-0">Add / Activate partner</h2>
              <p className="card-subtitle mt-1.5">
                The user must already be registered. This will set their role to <b>REFERRER</b> and create or update
                their partner record.
              </p>
            </div>

            <form onSubmit={onSubmitCreate}>
              <div className="grid gap-3.5">
                <div>
                  <label className="label" htmlFor="partner-email">
                    User email
                  </label>
                  <input
                    id="partner-email"
                    ref={emailInputRef}
                    className="input"
                    type="email"
                    placeholder="user@example.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    disabled={createSubmitting}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="partner-bps">
                    Commission (BPS) <span className="muted">(optional, 1–5000)</span>
                  </label>
                  <input
                    id="partner-bps"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={5000}
                    step={1}
                    placeholder="Leave empty to use default"
                    value={createCommissionBps}
                    onChange={(e) => setCreateCommissionBps(e.target.value)}
                    disabled={createSubmitting}
                  />
                  <p className="muted mt-1.5">
                    Example: <b>1000</b> = 10% commission.
                  </p>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createCode}
                    onChange={(e) => setCreateCode(e.target.checked)}
                    disabled={createSubmitting}
                  />
                  <span>Create a referral code (if they don&apos;t have one)</span>
                </label>

                {createError && (
                  <div className="card card-error">
                    <p className="m-0">{createError}</p>
                  </div>
                )}

                {createSuccess && (
                  <div className="card border border-black/10">
                    <p className="mt-0 mb-2">
                      ✅ Partner activated for <b>{createSuccess.email}</b>
                    </p>
                    <div className="grid gap-1.5">
                      <div>
                        <span className="muted">Commission:</span> <b>{createSuccess.commissionBps} bps</b>
                      </div>
                      <div>
                        <span className="muted">Partner ID:</span> <code>{createSuccess.partnerId}</code>
                      </div>
                      <div>
                        <span className="muted">Created code:</span>{" "}
                        <b>{createSuccess.createdCode ? createSuccess.createdCode : "— (already had one)"}</b>{" "}
                        {createSuccess.createdCode && (
                          <button
                            className="btn-secondary ml-2.5"
                            type="button"
                            onClick={async () => {
                              const ok = await safeCopyToClipboard(createSuccess.createdCode || "");
                              if (!ok) alert("Could not copy to clipboard.");
                            }}
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 mt-1">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createSubmitting}
                  >
                    Close
                  </button>

                  <button className="btn-primary" type="submit" disabled={createSubmitting}>
                    {createSubmitting ? "Saving..." : "Activate partner"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReferrals;

