// src/pages/app/admin/AdminEmailUsagePage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminListEmailUsage, AdminEmailUsageBotItem, AdminEmailUsageSummaryByPlanItem } from "@/api/adminEmailUsage";
import { adminListUsagePlans, AdminUsagePlan, AdminBotStatus } from "@/api/adminBots";

const PAGE_SIZE = 20;

const statusOptions: { label: string; value: "" | AdminBotStatus }[] = [
  { label: "All statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Pending payment", value: "PENDING_PAYMENT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Canceled", value: "CANCELED" }
];

const AdminEmails: React.FC = () => {
  const [rows, setRows] = useState<AdminEmailUsageBotItem[]>([]);
  const [summaryByPlan, setSummaryByPlan] = useState<AdminEmailUsageSummaryByPlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [monthStartIso, setMonthStartIso] = useState<string | null>(null);
  const [monthEndIso, setMonthEndIso] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | AdminBotStatus>("");
  const [planFilterCode, setPlanFilterCode] = useState<string>("");
  const [overLimitOnly, setOverLimitOnly] = useState<boolean>(false);

  const [plans, setPlans] = useState<AdminUsagePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await adminListUsagePlans();
      setPlans(res.items);
    } catch (err: any) {
      console.error("Failed to load usage plans:", err);
      setPlansError(err?.message || "Failed to load usage plans");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadUsage = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      setLoading(true);
      setError(null);
      try {
        const res = await adminListEmailUsage({
          q: query || undefined,
          status: statusFilter || undefined,
          planCode: planFilterCode || undefined,
          overLimitOnly: overLimitOnly ? true : undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });

        setRows(res.items);
        setSummaryByPlan(res.summaryByPlan);
        setTotal(res.total);
        setPage(res.page);
        setMonthStartIso(res.monthStart);
        setMonthEndIso(res.monthEndExclusive);
      } catch (err: any) {
        console.error("Failed to load email usage:", err);
        setError(err?.message || "Failed to load email usage");
      } finally {
        setLoading(false);
      }
    },
    [page, query, statusFilter, planFilterCode, overLimitOnly]
  );

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    loadUsage();
  }, [query, statusFilter, planFilterCode, overLimitOnly, page, loadUsage]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setQuery("");
    setStatusFilter("");
    setPlanFilterCode("");
    setOverLimitOnly(false);
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

  const formatMonthRange = (startIso: string | null, endIso: string | null): string => {
    if (!startIso) return "";
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return "";

    const label = start.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long"
    });

    return label;
  };

  const percentage = (ratio: number | null): string => {
    if (ratio == null) return "—";
    return `${Math.round(ratio * 100)}%`;
  };

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  const currentMonthLabel = formatMonthRange(monthStartIso, monthEndIso);

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Email usage & quotas</h1>
        <p className="page-subtitle">
          Monitor outbound emails per bot against plan limits for the current month.
          Useful to spot accounts close to or over quota.
        </p>
      </header>

      <section aria-label="Email usage filters" className="card">
        <form className="admin-filters-bar admin-filters-bar--4" onSubmit={handleApplyFilters}>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="emails-search">
              Search
            </label>
            <input
              id="emails-search"
              className="input"
              type="search"
              placeholder="Search by bot name, slug or owner email"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="emails-status-filter">
              Bot status
            </label>
            <select
              id="emails-status-filter"
              className="select"
              value={statusFilter}
              onChange={(e) => {
                const value = e.target.value as "" | AdminBotStatus;
                setStatusFilter(value);
                setPage(1);
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="emails-plan-filter">
              Plan
            </label>
            <select
              id="emails-plan-filter"
              className="select"
              value={planFilterCode}
              onChange={(e) => {
                setPlanFilterCode(e.target.value);
                setPage(1);
              }}
              disabled={plansLoading || !!plansError}
            >
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} · {p.name}
                  {!p.isActive ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="emails-over-limit">
              Only over limit
            </label>
            <div className="flex items-center gap-2">
              <input
                id="emails-over-limit"
                type="checkbox"
                checked={overLimitOnly}
                onChange={(e) => {
                  setOverLimitOnly(e.target.checked);
                  setPage(1);
                }}
              />
              <span className="admin-filters-note">
                Show only bots where emails &gt; plan email limit
              </span>
            </div>
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
                !statusFilter &&
                !planFilterCode &&
                !overLimitOnly
              }
            >
              Clear
            </button>
          </div>
        </form>

        <div className="admin-filters-meta">
          <span>
            {currentMonthLabel && (
              <>
                Month: <strong>{currentMonthLabel}</strong> ·{" "}
              </>
            )}
            Page {page} of {totalPages} • {formatNumber(total)} bots
          </span>
          {plansError && (
            <span className="admin-filters-note admin-filters-note-error">
              {plansError}
            </span>
          )}
        </div>
      </section>

      {loading && (
        <div className="card">
          <p>Loading email usage…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="card">
          <p>No bots match your filters.</p>
        </div>
      )}

      {/* Summary by plan */}
      {!loading && !error && summaryByPlan.length > 0 && (
        <section aria-label="Email usage summary by plan" className="card">
          <h2 className="card-title">By plan (visible rows)</h2>
          <div className="admin-table-wrapper">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Bots</th>
                  <th>Over limit</th>
                  <th>Emails this month</th>
                  <th>Limit per bot</th>
                </tr>
              </thead>
              <tbody>
                {summaryByPlan.map((p) => (
                  <tr key={p.usagePlanId ?? "NO_PLAN"}>
                    <td>
                      {p.usagePlanCode ? (
                        <>
                          <strong>{p.usagePlanCode}</strong>{" "}
                          <span className="admin-number-sub">
                            {p.usagePlanName || ""}
                          </span>
                        </>
                      ) : (
                        <span className="muted">No plan / legacy</span>
                      )}
                    </td>
                    <td>{formatNumber(p.botsCount)}</td>
                    <td>{formatNumber(p.overLimitBotsCount)}</td>
                    <td>{formatNumber(p.totalEmailsThisMonth)}</td>
                    <td>
                      {p.monthlyEmails != null
                        ? `${formatNumber(p.monthlyEmails)} / bot`
                        : "Unlimited"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per-bot table */}
      {!loading && !error && rows.length > 0 && (
        <section aria-label="Email usage per bot" className="card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Emails (month)</th>
                  <th>Usage vs limit</th>
                  <th aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const plan = row.usagePlan;
                  const hasLimit = row.monthlyEmailLimit != null;

                  let usageClass = "status-pill status-pill-muted";
                  if (hasLimit && row.usageRatio != null) {
                    if (row.isOverLimit) usageClass = "status-pill status-pill-warning";
                    else if (row.usageRatio >= 0.8)
                      usageClass = "status-pill status-pill-info";
                    else usageClass = "status-pill status-pill-success";
                  }

                  return (
                    <tr key={row.botId}>
                      <td>
                        <div className="admin-bot-main">
                          <div className="admin-bot-name">{row.botName}</div>
                          <div className="admin-bot-meta">
                            <span className="admin-bot-slug">/{row.botSlug}</span>
                            <span className="admin-number-sub">
                              Status {row.botStatus.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-owner-main">
                          <div className="admin-owner-email">{row.owner.email}</div>
                          {row.owner.name && (
                            <div className="admin-owner-name">{row.owner.name}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        {plan ? (
                          <div className="admin-plan-cell">
                            <div className="admin-plan-code">
                              <strong>{plan.code}</strong>{" "}
                              <span className="admin-number-sub">
                                {plan.name}
                              </span>
                            </div>
                            <div className="admin-number-sub">
                              {plan.monthlyEmails != null
                                ? `${formatNumber(plan.monthlyEmails)} emails / month`
                                : "Unlimited emails"}
                            </div>
                            <div className="admin-number-sub">
                              {formatMoney(plan.monthlyAmountCents, plan.currency)} / month
                            </div>
                          </div>
                        ) : (
                          <span className="status-pill status-pill-muted">
                            No plan / legacy
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="admin-number-cell">
                          <span className="admin-number-main">
                            {formatNumber(row.emailsThisMonth)}
                          </span>
                          <span className="admin-number-sub">
                            this month
                          </span>
                        </div>
                      </td>
                      <td>
                        {hasLimit ? (
                          <div className="admin-status-stack">
                            <span className={usageClass}>
                              {percentage(row.usageRatio)} of{" "}
                              {formatNumber(row.monthlyEmailLimit!)} emails
                            </span>
                            {row.isOverLimit && (
                              <span className="admin-number-sub">
                                Over limit by{" "}
                                {formatNumber(
                                  row.emailsThisMonth - (row.monthlyEmailLimit || 0)
                                )}{" "}
                                emails
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="status-pill status-pill-muted">
                            No email limit
                          </span>
                        )}
                      </td>
                      <td className="admin-actions-cell">
                        <a
                          href={`/app/bots/${row.botSlug}`}
                          className="btn-link-small"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open bot →
                        </a>
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

export default AdminEmails;
