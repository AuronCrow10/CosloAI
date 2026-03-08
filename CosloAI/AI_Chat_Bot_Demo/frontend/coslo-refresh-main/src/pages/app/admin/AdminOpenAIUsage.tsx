// src/pages/app/admin/AdminOpenAIUsagePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  adminGetOpenAIUsage,
  AdminOpenAIUsageResponse
} from "@/api/adminOpenAIUsage";
import { monthKeyForDateUTC } from "@/api/referrals";

const MONTH_TAKE = 50;

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyForDateUTC(d);
}

const formatInt = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0
  }).format(value);

const AdminOpenAIUsage: React.FC = () => {
  const locale = useMemo(() => "en-GB", []);
  const [monthKey, setMonthKey] = useState(() =>
    monthKeyForDateUTC(new Date())
  );

  const [inputQuery, setInputQuery] = useState("");
  const [inputModel, setInputModel] = useState("");
  const [filters, setFilters] = useState<{ q: string; model: string }>({
    q: "",
    model: ""
  });

  const [skip, setSkip] = useState(0);

  const [data, setData] = useState<AdminOpenAIUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyFilters = () => {
    setFilters({
      q: inputQuery.trim(),
      model: inputModel.trim()
    });
    setSkip(0);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetOpenAIUsage({
          month: monthKey,
          q: filters.q || undefined,
          model: filters.model || undefined,
          take: MONTH_TAKE,
          skip
        });
        if (!cancelled) {
          setData(res);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load OpenAI usage"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [monthKey, filters.q, filters.model, skip]);

  const handlePrevMonth = () => {
    setMonthKey((prev) => shiftMonthKey(prev, -1));
    setSkip(0);
  };

  const handleNextMonth = () => {
    setMonthKey((prev) => shiftMonthKey(prev, +1));
    setSkip(0);
  };

  const handleResetMonth = () => {
    setMonthKey(monthKeyForDateUTC(new Date()));
    setSkip(0);
  };

  const handlePrevPage = () => {
    setSkip((prev) => Math.max(0, prev - MONTH_TAKE));
  };

  const handleNextPage = () => {
    if (data && data.paging.hasMore) {
      setSkip((prev) => prev + MONTH_TAKE);
    }
  };

  const totalBots = data?.paging.total ?? 0;
  const currentFrom = data?.paging.skip ?? 0;
  const currentTo = Math.min(
    (data?.paging.skip ?? 0) + (data?.paging.take ?? MONTH_TAKE),
    totalBots
  );

  const topModel = useMemo(() => {
    if (!data || data.global.byModel.length === 0) return null;
    return data.global.byModel[0];
  }, [data]);

  const global = data?.global;

  return (
    <div className="page-root">
      <header className="page-header">
        <div>
          <h1>OpenAI & Crawler usage (admin)</h1>
          <p className="muted">
            Monitor token usage per bot, see global OpenAI load by model and
            knowledge (Crawler) costs for the selected billing month.
          </p>
        </div>
      </header>

      {/* Time window */}
      <section className="card mb-3">
        <div className="card-header">
          <h2>Time window</h2>
        </div>
        <div className="card-body admin-toolbar">
          <div className="admin-toolbar-left">
            <span className="pill">
              Month: <strong>{monthKey}</strong>
            </span>
            {data && (
              <span className="pill pill-muted">
                UTC window:{" "}
                <strong>
                  {new Date(data.window.from).toISOString().slice(0, 10)} –{" "}
                  {new Date(data.window.to).toISOString().slice(0, 10)}
                </strong>
              </span>
            )}
          </div>
          <div className="admin-toolbar-right">
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePrevMonth}
            >
              ← Previous month
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetMonth}
            >
              Current month
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleNextMonth}
            >
              Next month →
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="card mb-3">
        <div className="card-header">
          <h2>Filters</h2>
        </div>
        <div className="card-body admin-toolbar">
          <div className="admin-toolbar-left">
            <input
              type="text"
              className="input"
              placeholder="Search by bot name, slug or owner email…"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters();
                }
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Filter by model (e.g. gpt-4o-mini)…"
              value={inputModel}
              onChange={(e) => setInputModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters();
                }
              }}
            />
          </div>
          <div className="admin-toolbar-right">
            <button
              type="button"
              className="btn-primary"
              onClick={applyFilters}
            >
              Apply filters
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="card mb-3">
          <div className="card-body">
            <div className="form-error">{error}</div>
          </div>
        </section>
      )}

      {/* Global summary */}
      <section className="card mb-3">
        <div className="card-header">
          <h2>Global usage summary</h2>
        </div>
        <div className="card-body">
          {loading && !data ? (
            <p>Loading…</p>
          ) : (
            <>
              <div className="dashboard-kpi-row">
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    Monthly tokens (AI + Crawler)
                  </div>
                  <div className="dashboard-kpi-value">
                    {formatInt(global?.totalTokens ?? 0, locale)}
                  </div>
                  <div className="dashboard-kpi-hint">
                    OpenAI:{" "}
                    {formatInt(global?.totalTokensOpenAI ?? 0, locale)} ·
                    Crawler:{" "}
                    {formatInt(global?.totalTokensKnowledge ?? 0, locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    OpenAI requests (all bots)
                  </div>
                  <div className="dashboard-kpi-value">
                    {formatInt(global?.requestCount ?? 0, locale)}
                  </div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-label">
                    Top model (by tokens)
                  </div>
                  <div className="dashboard-kpi-value">
                    {topModel ? (
                      <>
                        {topModel.model}{" "}
                        <span className="dashboard-kpi-hint">
                          ({formatInt(topModel.totalTokens, locale)} tokens)
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <h3>Usage by model (OpenAI + Crawler)</h3>
                {data && data.global.byModel.length === 0 && (
                  <p className="muted">No usage recorded for this month.</p>
                )}
                {data && data.global.byModel.length > 0 && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th className="text-right">Tokens</th>
                          <th className="text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.global.byModel.map((m) => (
                          <tr key={m.model}>
                            <td>{m.model}</td>
                            <td className="text-right">
                              {formatInt(m.totalTokens, locale)}
                            </td>
                            <td className="text-right">
                              {m.model === "Crawler"
                                ? "—"
                                : formatInt(m.requestCount, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <h3>Top users by tokens (AI + Crawler)</h3>
                {data && data.global.topUsers.length === 0 && (
                  <p className="muted">
                    No user-level usage records for this month.
                  </p>
                )}
                {data && data.global.topUsers.length > 0 && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Email</th>
                          <th className="text-right">
                            Tokens (AI + Crawler)
                          </th>
                          <th className="text-right">OpenAI requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.global.topUsers.map((u) => (
                          <tr key={u.userId}>
                            <td>{u.name || "—"}</td>
                            <td>{u.email}</td>
                            <td className="text-right">
                              {formatInt(u.totalTokens, locale)}
                            </td>
                            <td className="text-right">
                              {formatInt(u.requestCount, locale)}
                            </td>
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
      </section>

      {/* Bots usage */}
      <section className="card">
        <div className="card-header">
          <h2>Bots usage</h2>
          <div className="card-header-meta">
            {totalBots > 0 && (
              <span className="muted">
                Showing {currentFrom + 1}–{currentTo} of {totalBots} bots
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          {loading && !data ? (
            <p>Loading…</p>
          ) : !data || data.bots.length === 0 ? (
            <p className="muted">No bots match the current filters.</p>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>Owner</th>
                      <th>Plan</th>
                      <th className="text-right">
                        Tokens (combined / breakdown)
                      </th>
                      <th className="text-right">Requests (OpenAI)</th>
                      <th className="text-right">Usage vs plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bots.map((b) => {
                      const limit = b.plan?.monthlyTokens ?? null;
                      const openAiTokens = b.monthTokens.totalTokens;
                      const knowledgeTokens = b.knowledgeTokens ?? 0;
                      const combinedTokens =
                        b.totalTokensAll ?? openAiTokens + knowledgeTokens;

                      const pct = limit
                        ? Math.min(
                            999,
                            Math.round((combinedTokens / limit) * 100)
                          )
                        : null;

                      return (
                        <tr key={b.botId}>
                          <td>
                            <div className="table-main-cell">
                              <div className="table-main-title">{b.name}</div>
                              <div className="table-main-subtitle">
                                <code>{b.slug}</code> ·{" "}
                                <span className="pill pill-muted">
                                  {b.status}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="table-main-cell">
                              <div className="table-main-title">
                                {b.owner.name || "—"}
                              </div>
                              <div className="table-main-subtitle">
                                {b.owner.email}
                              </div>
                            </div>
                          </td>
                          <td>
                            {b.plan ? (
                              <div className="table-main-cell">
                                <div className="table-main-title">
                                  {b.plan.name}
                                </div>
                                <div className="table-main-subtitle">
                                  {b.plan.monthlyTokens
                                    ? `${formatInt(
                                        b.plan.monthlyTokens,
                                        locale
                                      )} tokens / month`
                                    : "Unlimited tokens"}
                                </div>
                              </div>
                            ) : (
                              <span className="muted">No usage plan</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div>{formatInt(combinedTokens, locale)}</div>
                            <div className="muted">
                              OpenAI:{" "}
                              {formatInt(openAiTokens, locale)} (
                              {formatInt(
                                b.monthTokens.promptTokens,
                                locale
                              )}{" "}
                              /{" "}
                              {formatInt(
                                b.monthTokens.completionTokens,
                                locale
                              )}
                              ) · Crawler:{" "}
                              {formatInt(knowledgeTokens, locale)}
                            </div>
                          </td>
                          <td className="text-right">
                            {formatInt(b.monthTokens.requests, locale)}
                          </td>
                          <td className="text-right">
                            {limit ? (
                              <>
                                <div>
                                  {pct}% of plan
                                  {pct! >= 90 && (
                                    <span className="pill pill-warning ml-1">
                                      near limit
                                    </span>
                                  )}
                                </div>
                                <div className="muted">
                                  {formatInt(combinedTokens, locale)} /{" "}
                                  {formatInt(limit, locale)}
                                </div>
                              </>
                            ) : (
                              <span className="muted">Unlimited</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="table-pagination">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePrevPage}
                  disabled={skip === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleNextPage}
                  disabled={!data.paging.hasMore}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminOpenAIUsage;
