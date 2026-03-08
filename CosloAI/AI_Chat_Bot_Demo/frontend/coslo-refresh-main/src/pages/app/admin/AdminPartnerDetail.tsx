// src/pages/app/admin/AdminReferralPartnerDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  adminGetPartnerDetail,
  adminMarkPartnerMonthPaid,
  monthKeyForDateUTC,
  AdminPartnerDetailResponse
} from "@/api/referrals";

const formatCurrency = (amountCents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amountCents / 100);

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const AdminPartnerDetail: React.FC = () => {
  const locale = useMemo(() => "en-GB", []);
  const { id } = useParams<{ id: string }>();
  const query = useQuery();

  const monthFromQuery = query.get("month") || monthKeyForDateUTC(new Date());
  const [monthKey, setMonthKey] = useState(monthFromQuery);

  const [data, setData] = useState<AdminPartnerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [marking, setMarking] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetPartnerDetail({ partnerId: id, month: monthKey, take: 50, skip: 0 });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load partner detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, monthKey]);

  const canMarkPaid = useMemo(() => {
    if (!data) return false;
    return data.month.payoutPeriods.some((p) => p.status === "OPEN");
  }, [data]);

  const handleMarkPaid = async () => {
    if (!id) return;
    setMarking(true);
    setError(null);
    try {
      await adminMarkPartnerMonthPaid({ partnerId: id, monthKey });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to mark paid.");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1>Partner detail</h1>
          <p className="muted">{data?.partner.email || ""}</p>
        </div>

        <div className="page-header-actions">
          <Link className="btn-secondary" to="/app/admin/referrals">
            ← Back
          </Link>
          <div className="month-pill">{monthKey}</div>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="card"><p>Loading...</p></div>}

      {!loading && data && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Summary</h2>
              <p className="card-subtitle">Clients + month/lifetime totals.</p>
            </div>

            <div className="ref-detail-summary">
              <div>
                <div className="dashboard-kpi-label">Clients (total)</div>
                <div className="dashboard-kpi-value">{data.clients.total}</div>
              </div>
              <div>
                <div className="dashboard-kpi-label">Clients (active)</div>
                <div className="dashboard-kpi-value">{data.clients.active}</div>
              </div>
              <div>
                <div className="dashboard-kpi-label">Commission BPS</div>
                <div className="dashboard-kpi-value">{data.partner.commissionBps}</div>
              </div>
            </div>

            <hr className="section-separator" />

            <h3 className="m-0">Month totals ({data.month.monthKey})</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Revenue</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {data.month.totalsByCurrency.map((r) => (
                    <tr key={r.currency}>
                      <td>{r.currency.toUpperCase()}</td>
                      <td>{formatCurrency(r.revenueCents, r.currency, locale)}</td>
                      <td>{formatCurrency(r.commissionCents, r.currency, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-5">Payout periods ({data.month.monthKey})</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Paid at</th>
                  </tr>
                </thead>
                <tbody>
                  {data.month.payoutPeriods.map((p, idx) => (
                    <tr key={`${p.currency}-${idx}`}>
                      <td>{p.currency.toUpperCase()}</td>
                      <td>{formatCurrency(p.amountCents, p.currency, locale)}</td>
                      <td>{p.status}</td>
                      <td>{p.paidAt ? new Date(p.paidAt).toLocaleString(locale) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <button className="btn-primary" type="button" disabled={!canMarkPaid || marking} onClick={handleMarkPaid}>
                {marking ? "Marking..." : "Mark OPEN payouts as PAID"}
              </button>
              <button className="btn-secondary" type="button" onClick={() => setMonthKey(monthKeyForDateUTC(new Date()))}>
                Jump to current month
              </button>
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>Recent attributions</h2>
              <p className="card-subtitle">Latest client attributions (paginated server-side in the endpoint).</p>
            </div>

            {data.recent.attributions.length === 0 ? (
              <p className="card-empty">No attributions found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>Referral code</th>
                      <th>User</th>
                      <th>Bot</th>
                      <th>Stripe sub</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.attributions.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.startedAt).toLocaleString(locale)}</td>
                        <td>{a.referralCode}</td>
                        <td>{a.referredUser.email}</td>
                        <td>{a.bot.name}</td>
                        <td>{a.stripeSubscriptionId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>Recent commissions</h2>
              <p className="card-subtitle">Ledger items for this partner.</p>
            </div>

            {data.recent.commissions.length === 0 ? (
              <p className="card-empty">No commissions found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Month</th>
                      <th>Currency</th>
                      <th>Status</th>
                      <th>Revenue</th>
                      <th>Commission</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.commissions.map((c) => (
                      <tr key={c.id}>
                        <td>{new Date(c.createdAt).toLocaleString(locale)}</td>
                        <td>{c.monthKey}</td>
                        <td>{c.currency.toUpperCase()}</td>
                        <td>{c.status}</td>
                        <td>{formatCurrency(c.revenueCents, c.currency, locale)}</td>
                        <td>{formatCurrency(c.commissionCents, c.currency, locale)}</td>
                        <td>{c.stripeInvoiceId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>Referred users</h2>
              <p className="card-subtitle">
                Users who registered with this partner’s link (latest first).
              </p>
            </div>

            {data.referredUsers.items.length === 0 ? (
              <p className="card-empty">No referred users found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Registered</th>
                      <th>Email</th>
                      <th>Referral code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referredUsers.items.map((u) => (
                      <tr key={u.id}>
                        <td>{new Date(u.createdAt).toLocaleString(locale)}</td>
                        <td>{u.email}</td>
                        <td>{u.referralCode ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>Payout history</h2>
              <p className="card-subtitle">Last 24 periods.</p>
            </div>

            {data.payoutHistory.length === 0 ? (
              <p className="card-empty">No payout history found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Currency</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payoutHistory.map((p, idx) => (
                      <tr key={`${p.monthKey}-${p.currency}-${idx}`}>
                        <td>{p.monthKey}</td>
                        <td>{p.currency.toUpperCase()}</td>
                        <td>{formatCurrency(p.amountCents, p.currency, locale)}</td>
                        <td>{p.status}</td>
                        <td>{p.paidAt ? new Date(p.paidAt).toLocaleString(locale) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPartnerDetail;
