// src/pages/app/admin/AdminPaymentsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListPayments,
  AdminPaymentListItem,
  AdminPaymentTotalsByCurrencyItem
} from "@/api/adminPayments";

const PAGE_SIZE = 20;

type HasReferralFilter = "all" | "with" | "without";

const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([]);
  const [totalsByCurrency, setTotalsByCurrency] = useState<
    AdminPaymentTotalsByCurrencyItem[]
  >([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [statusInput, setStatusInput] = useState<string>("");
  const [hasReferralFilter, setHasReferralFilter] =
    useState<HasReferralFilter>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const loadPayments = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      setLoading(true);
      setError(null);
      try {
        const hasReferralParam =
          hasReferralFilter === "all"
            ? undefined
            : hasReferralFilter === "with";

        const res = await adminListPayments({
          q: query || undefined,
          status: statusInput || undefined,
          hasReferral: hasReferralParam,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });

        setPayments(res.items);
        setTotalsByCurrency(res.totalsByCurrency);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: any) {
        console.error("Failed to load payments:", err);
        setError(err?.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    },
    [page, query, statusInput, hasReferralFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    loadPayments();
  }, [query, statusInput, hasReferralFilter, dateFrom, dateTo, page, loadPayments]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setQuery("");
    setStatusInput("");
    setHasReferralFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const formatMoney = (amountCents: number, currency: string): string => {
    const value = amountCents / 100;
    const code = currency || "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  };

  const formatNumber = (n: number): string => n.toLocaleString(undefined);

  const formatDateTime = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Payments & invoices</h1>
        <p className="page-subtitle">
          Inspect Stripe payments across all bots. See who paid what, when, on which plan, and which
          payments generated referral commissions.
        </p>
      </header>

      {/* Filters */}
      <section aria-label="Payments filters" className="card">
        <form className="admin-filters-bar admin-filters-bar--5" onSubmit={handleApplyFilters}>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="payments-search">
              Search
            </label>
            <input
              id="payments-search"
              className="input"
              type="search"
              placeholder="Search billing email, name, bot name, slug or owner email"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="payments-status">
              Status contains
            </label>
            <input
              id="payments-status"
              className="input"
              type="text"
              placeholder="e.g. succeeded, failed, requires_action"
              value={statusInput}
              onChange={(e) => {
                setStatusInput(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="payments-referral-filter">
              Referral
            </label>
            <select
              id="payments-referral-filter"
              className="select"
              value={hasReferralFilter}
              onChange={(e) => {
                const value = e.target.value as HasReferralFilter;
                setHasReferralFilter(value);
                setPage(1);
              }}
            >
              <option value="all">All payments</option>
              <option value="with">With referral commission</option>
              <option value="without">Without referral commission</option>
            </select>
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="payments-date-from">
              From (created)
            </label>
            <input
              id="payments-date-from"
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="payments-date-to">
              To (created)
            </label>
            <input
              id="payments-date-to"
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-filter-actions">
            <button type="submit" className="btn-secondary" disabled={loading}>
              Apply
            </button>
            <button
              type="button"
              className="btn-link-small"
              onClick={handleClearFilters}
              disabled={
                loading &&
                !query &&
                !statusInput &&
                hasReferralFilter === "all" &&
                !dateFrom &&
                !dateTo
              }
            >
              Clear
            </button>
          </div>
        </form>

        <div className="admin-filters-meta">
          <span>
            Page {page} of {totalPages} • {formatNumber(total)} payments
          </span>
        </div>
      </section>

      {loading && (
        <div className="card">
          <p>Loading payments…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="card">
          <p>No payments match your filters.</p>
        </div>
      )}

      {/* Totals by currency */}
      {!loading && !error && totalsByCurrency.length > 0 && (
        <section aria-label="Payment totals" className="card">
          <h2 className="card-title">Totals by currency (matching filters)</h2>
          <div className="admin-table-wrapper">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Payments</th>
                  <th>Total amount</th>
                </tr>
              </thead>
              <tbody>
                {totalsByCurrency.map((row) => (
                  <tr key={row.currency}>
                    <td>{row.currency}</td>
                    <td>{formatNumber(row.count)}</td>
                    <td>{formatMoney(row.totalAmountCents, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Payments table */}
      {!loading && !error && payments.length > 0 && (
        <section aria-label="Payments list" className="card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Bot</th>
                  <th>Plan & billing</th>
                  <th>Referral</th>
                  <th>Period</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const plan = p.plan;
                  const referral = p.referral;

                  const statusLower = p.status.toLowerCase();
                  let statusClass = "status-pill status-pill-muted";
                  if (statusLower.includes("succeeded") || statusLower === "paid") {
                    statusClass = "status-pill status-pill-success";
                  } else if (
                    statusLower.includes("requires") ||
                    statusLower.includes("past_due")
                  ) {
                    statusClass = "status-pill status-pill-info";
                  } else if (
                    statusLower.includes("failed") ||
                    statusLower.includes("canceled")
                  ) {
                    statusClass = "status-pill status-pill-warning";
                  }

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="admin-payment-main">
                          <div className="admin-number-cell">
                            <span className="admin-number-main">
                              {formatMoney(p.amountCents, p.currency)}
                            </span>
                            <span className="admin-number-sub">
                              Status:{" "}
                              <span className={statusClass}>{p.status}</span>
                            </span>
                          </div>
                          <div className="admin-payment-meta">
                            <span className="admin-number-sub">
                              Customer:{" "}
                              <code>{p.stripeCustomerId.slice(0, 10)}…</code>
                            </span>
                            {p.stripeInvoiceId && (
                              <span className="admin-number-sub">
                                Invoice: <code>{p.stripeInvoiceId}</code>
                              </span>
                            )}
                            {p.stripePaymentIntentId && (
                              <span className="admin-number-sub">
                                PaymentIntent:{" "}
                                <code>{p.stripePaymentIntentId}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-bot-main">
                          <div className="admin-bot-name">{p.bot.name}</div>
                          <div className="admin-bot-meta">
                            <span className="admin-bot-slug">/{p.bot.slug}</span>
                            <span className="admin-number-sub">
                              Owner {p.bot.owner.email}
                            </span>
                            <span className="admin-number-sub">
                              Bot status {p.bot.status.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-plan-cell">
                          {p.billingEmail && (
                            <div className="admin-number-sub">
                              {p.billingName && (
                                <>
                                  {p.billingName} ·{" "}
                                </>
                              )}
                              {p.billingEmail}
                            </div>
                          )}
                          {plan ? (
                            <>
                              <div className="admin-plan-code">
                                <strong>{plan.code}</strong>{" "}
                                <span className="admin-number-sub">
                                  {plan.name}
                                </span>
                              </div>
                              <div className="admin-number-sub">
                                Plan billing:{" "}
                                {formatMoney(
                                  plan.monthlyAmountCents,
                                  plan.currency
                                )}{" "}
                                / month
                              </div>
                            </>
                          ) : (
                            <span className="status-pill status-pill-muted">
                              No linked plan
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {referral ? (
                          <div className="admin-status-stack">
                            <span className="status-pill status-pill-info">
                              Referral {referral.status.toLowerCase()}
                            </span>
                            <span className="admin-number-sub">
                              Partner:{" "}
                              {referral.partnerUserEmail ||
                                referral.partnerId.slice(0, 8) + "…"}
                            </span>
                            <span className="admin-number-sub">
                              Base:{" "}
                              {formatMoney(
                                referral.amountBaseCents,
                                referral.currency
                              )}{" "}
                              · Commission:{" "}
                              {formatMoney(
                                referral.commissionCents,
                                referral.currency
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="status-pill status-pill-muted">
                            No referral
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span>
                            {p.periodStart
                              ? formatDateTime(p.periodStart)
                              : "—"}
                            {"  "}→{" "}
                            {p.periodEnd ? formatDateTime(p.periodEnd) : "—"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span>{formatDateTime(p.createdAt)}</span>
                          <span className="admin-number-sub">
                            Updated {formatDateTime(p.updatedAt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="admin-table-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => !disabledPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={disabledPrev}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                !disabledNext && setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={disabledNext}
            >
              Next →
            </button>
          </footer>
        </section>
      )}
    </div>
  );
};

export default AdminPayments;
