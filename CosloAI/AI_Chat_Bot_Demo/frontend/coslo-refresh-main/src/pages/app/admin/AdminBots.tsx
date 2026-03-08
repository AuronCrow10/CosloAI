// src/pages/app/admin/AdminBotsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListBots,
  adminUpdateBot,
  adminListUsagePlans,
  AdminBotListItem,
  AdminBotStatus,
  AdminUsagePlan
} from "@/api/adminBots";

const PAGE_SIZE = 20;

const statusOptions: { label: string; value: "" | AdminBotStatus }[] = [
  { label: "All statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Pending payment", value: "PENDING_PAYMENT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Canceled", value: "CANCELED" }
];

type HasSubscriptionFilter = "all" | "with" | "without";

const AdminBots: React.FC = () => {
  const [bots, setBots] = useState<AdminBotListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | AdminBotStatus>("");
  const [hasSubscriptionFilter, setHasSubscriptionFilter] =
    useState<HasSubscriptionFilter>("all");
  const [planFilterCode, setPlanFilterCode] = useState<string>("");

  const [updatingBotId, setUpdatingBotId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  const loadBots = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      setLoading(true);
      setError(null);
      try {
        const hasSubscriptionParam =
          hasSubscriptionFilter === "all"
            ? undefined
            : hasSubscriptionFilter === "with";

        const res = await adminListBots({
          q: query || undefined,
          status: statusFilter || undefined,
          hasSubscription: hasSubscriptionParam,
          planCode: planFilterCode || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });

        setBots(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: any) {
        console.error("Failed to load bots:", err);
        setError(err?.message || "Failed to load bots");
      } finally {
        setLoading(false);
      }
    },
    [page, query, statusFilter, hasSubscriptionFilter, planFilterCode]
  );

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    loadBots();
  }, [query, statusFilter, hasSubscriptionFilter, planFilterCode, page, loadBots]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setQuery("");
    setStatusFilter("");
    setHasSubscriptionFilter("all");
    setPlanFilterCode("");
    setPage(1);
  };

  const handleChangeStatus = async (botId: string, status: AdminBotStatus) => {
    setUpdateError(null);
    setUpdatingBotId(botId);
    try {
      await adminUpdateBot(botId, { status });
      await loadBots();
    } catch (err: any) {
      console.error("Failed to update bot:", err);
      setUpdateError(err?.message || "Failed to update bot");
    } finally {
      setUpdatingBotId(null);
    }
  };

  const handleToggleAutoEval = async (bot: AdminBotListItem) => {
    setUpdateError(null);
    setUpdatingBotId(bot.id);
    try {
      await adminUpdateBot(bot.id, {
        autoEvaluateConversations: !bot.autoEvaluateConversations
      });
      await loadBots();
    } catch (err: any) {
      console.error("Failed to update bot:", err);
      setUpdateError(err?.message || "Failed to update bot");
    } finally {
      setUpdatingBotId(null);
    }
  };

  const handleChangePlan = async (bot: AdminBotListItem, usagePlanId: string | "") => {
    setUpdateError(null);
    setUpdatingBotId(bot.id);
    try {
      await adminUpdateBot(bot.id, {
        usagePlanId: usagePlanId || null
      });
      await loadBots();
    } catch (err: any) {
      console.error("Failed to update subscription plan:", err);
      setUpdateError(err?.message || "Failed to update subscription plan");
    } finally {
      setUpdatingBotId(null);
    }
  };

  const formatMoney = (amountCents: number | null, currency: string | null): string => {
    if (amountCents == null) return "—";
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

  const formatDateTime = (iso: string): string => {
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

  const formatNumber = (n: number): string => n.toLocaleString(undefined);

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Bots & subscriptions</h1>
        <p className="page-subtitle">
          Inspect bots, subscription plans, channels and booking settings. Admin-only
          quick actions for status and plan changes.
        </p>
      </header>

      <section aria-label="Bot filters" className="card">
        <form className="admin-filters-bar admin-filters-bar--4" onSubmit={handleApplyFilters}>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="bot-search">
              Search
            </label>
            <input
              id="bot-search"
              className="input"
              type="search"
              placeholder="Search by bot name, slug or owner email"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="bot-status-filter">
              Status
            </label>
            <select
              id="bot-status-filter"
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
            <label className="admin-filter-label" htmlFor="bot-subscription-filter">
              Subscription
            </label>
            <select
              id="bot-subscription-filter"
              className="select"
              value={hasSubscriptionFilter}
              onChange={(e) => {
                const value = e.target.value as HasSubscriptionFilter;
                setHasSubscriptionFilter(value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="with">With subscription</option>
              <option value="without">Without subscription</option>
            </select>
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="bot-plan-filter">
              Plan
            </label>
            <select
              id="bot-plan-filter"
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

          <div className="admin-filter-actions">
            <button type="submit" className="btn-secondary" disabled={loading}>
              Apply
            </button>
            <button
              type="button"
              className="btn-link-small"
              onClick={handleClearFilters}
              disabled={loading && !query && !statusFilter && hasSubscriptionFilter === "all"}
            >
              Clear
            </button>
          </div>
        </form>

        <div className="admin-filters-meta">
          <span>
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
          <p>Loading bots…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {updateError && (
        <div className="card card-error">
          <p>{updateError}</p>
        </div>
      )}

      {!loading && !error && bots.length === 0 && (
        <div className="card">
          <p>No bots match your filters.</p>
        </div>
      )}

      {!loading && !error && bots.length > 0 && (
        <section aria-label="Bots list" className="card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Billing</th>
                  <th>Channels</th>
                  <th>Booking</th>
                  <th aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => {
                  const isUpdating = updatingBotId === bot.id;
                  const sub = bot.subscription;

                  const currentPlanId = sub?.usagePlanId ?? "";
                  const planOptions: AdminUsagePlan[] = plans;

                  const bookingLabels: string[] = [];
                  if (bot.booking.enabled) bookingLabels.push("Calendar on");
                  if (bot.booking.bookingConfirmationEmailEnabled) {
                    bookingLabels.push("Conf. emails");
                  }
                  if (bot.booking.bookingReminderEmailEnabled) {
                    bookingLabels.push("Reminder emails");
                  }

                  return (
                    <tr key={bot.id}>
                      <td>
                        <div className="admin-bot-main">
                          <div className="admin-bot-name">{bot.name}</div>
                          <div className="admin-bot-meta">
                            <span className="admin-bot-slug">/{bot.slug}</span>
                            <span>Created {formatDateTime(bot.createdAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-owner-main">
                          <div className="admin-owner-email">{bot.owner.email}</div>
                          {bot.owner.name && (
                            <div className="admin-owner-name">{bot.owner.name}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <select
                            className="select select-sm"
                            value={bot.status}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleChangeStatus(
                                bot.id,
                                e.target.value as AdminBotStatus
                              )
                            }
                          >
                            {statusOptions
                              .filter((opt) => opt.value)
                              .map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                          </select>

                          <button
                            type="button"
                            className="btn-link-small"
                            disabled={isUpdating}
                            onClick={() => handleToggleAutoEval(bot)}
                          >
                            {bot.autoEvaluateConversations
                              ? "Disable auto-eval"
                              : "Enable auto-eval"}
                          </button>
                        </div>
                      </td>
                      <td>
                        {sub ? (
                          <div className="admin-plan-cell">
                            <select
                              className="select select-sm"
                              value={currentPlanId}
                              disabled={isUpdating || plansLoading || !!plansError}
                              onChange={(e) =>
                                handleChangePlan(bot, e.target.value || "")
                              }
                            >
                              <option value="">No plan / legacy</option>
                              {planOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} · {p.name}
                                  {!p.isActive ? " (inactive)" : ""}
                                </option>
                              ))}
                            </select>
                            <div className="admin-plan-meta">
                              <span className="admin-plan-code">
                                {sub.usagePlanCode || "—"}
                              </span>
                              <span className="admin-plan-status">
                                {sub.status.toLowerCase()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="status-pill status-pill-muted">
                            No subscription
                          </span>
                        )}
                      </td>
                      <td>
                        {sub ? (
                          <div className="admin-number-cell">
                            <span className="admin-number-main">
                              {formatMoney(sub.monthlyAmountCents, sub.currency)}
                            </span>
                            <span className="admin-number-sub">
                              customer {sub.stripeCustomerId.slice(0, 8)}…
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          {bot.channelWeb && (
                            <span className="status-pill status-pill-info">Web</span>
                          )}
                          {bot.channelWhatsapp && (
                            <span className="status-pill status-pill-info">
                              WhatsApp
                            </span>
                          )}
                          {bot.channelInstagram && (
                            <span className="status-pill status-pill-info">
                              Instagram
                            </span>
                          )}
                          {bot.channelMessenger && (
                            <span className="status-pill status-pill-info">
                              Messenger
                            </span>
                          )}
                          <span className="admin-number-sub">
                            {bot.externalChannelCount} connected channel
                            {bot.externalChannelCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          {bookingLabels.length > 0 ? (
                            bookingLabels.map((label) => (
                              <span
                                key={label}
                                className="status-pill status-pill-muted"
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="status-pill status-pill-muted">
                              Booking off
                            </span>
                          )}
                          {bot.booking.timeZone && (
                            <span className="admin-number-sub">
                              TZ {bot.booking.timeZone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="admin-actions-cell">
                        <a
                          href={`/app/bots/${bot.slug}`}
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

export default AdminBots;
