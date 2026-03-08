// src/pages/app/admin/AdminConversations.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminListConversationBots,
  adminListConversations,
  AdminConversationBotSummaryItem,
  AdminConversationListItem,
  AdminConversationChannel,
  AdminConversationMode
} from "@/api/adminConversations";

const PAGE_SIZE = 20;

const channelOptions: { label: string; value: "" | AdminConversationChannel }[] = [
  { label: "All channels", value: "" },
  { label: "Web", value: "WEB" },
  { label: "WhatsApp", value: "WHATSAPP" },
  { label: "Facebook", value: "FACEBOOK" },
  { label: "Instagram", value: "INSTAGRAM" }
];

const modeOptions: { label: string; value: "" | AdminConversationMode }[] = [
  { label: "All modes", value: "" },
  { label: "AI", value: "AI" },
  { label: "Human", value: "HUMAN" }
];

const AdminConversations: React.FC = () => {
  const [bots, setBots] = useState<AdminConversationBotSummaryItem[]>([]);
  const [botsLoading, setBotsLoading] = useState<boolean>(true);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsPage, setBotsPage] = useState<number>(1);
  const [botsTotal, setBotsTotal] = useState<number>(0);
  const [botsQueryInput, setBotsQueryInput] = useState<string>("");
  const [botsQuery, setBotsQuery] = useState<string>("");

  const [selectedBot, setSelectedBot] =
    useState<AdminConversationBotSummaryItem | null>(null);

  const [conversations, setConversations] = useState<AdminConversationListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [channelFilter, setChannelFilter] =
    useState<"" | AdminConversationChannel>("");
  const [modeFilter, setModeFilter] = useState<"" | AdminConversationMode>("");

  const botTotalPages = useMemo(
    () => (botsTotal > 0 ? Math.ceil(botsTotal / PAGE_SIZE) : 1),
    [botsTotal]
  );

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const loadBots = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? botsPage;
      setBotsLoading(true);
      setBotsError(null);
      try {
        const res = await adminListConversationBots({
          q: botsQuery || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });
        setBots(res.items);
        setBotsTotal(res.total);
        setBotsPage(res.page);
      } catch (err: any) {
        console.error("Failed to load bots:", err);
        setBotsError(err?.message || "Failed to load bots");
      } finally {
        setBotsLoading(false);
      }
    },
    [botsPage, botsQuery]
  );

  const loadConversations = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      if (!selectedBot) return;

      setLoading(true);
      setError(null);
      try {
        const res = await adminListConversations({
          botId: selectedBot.id,
          channel: channelFilter || undefined,
          mode: modeFilter || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });

        setConversations(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: any) {
        console.error("Failed to load conversations:", err);
        setError(err?.message || "Failed to load conversations");
      } finally {
        setLoading(false);
      }
    },
    [page, channelFilter, modeFilter, selectedBot]
  );

  useEffect(() => {
    loadBots();
  }, [botsQuery, botsPage, loadBots]);

  useEffect(() => {
    loadConversations();
  }, [channelFilter, modeFilter, page, loadConversations]);

  const handleApplyBotFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setBotsPage(1);
    setBotsQuery(botsQueryInput.trim());
  };

  const handleClearBotFilters = () => {
    setBotsQueryInput("");
    setBotsQuery("");
    setBotsPage(1);
  };

  const handleSelectBot = (bot: AdminConversationBotSummaryItem) => {
    setSelectedBot(bot);
    setPage(1);
    setChannelFilter("");
    setModeFilter("");
  };

  const handleBackToBots = () => {
    setSelectedBot(null);
    setConversations([]);
    setTotal(0);
    setPage(1);
    setChannelFilter("");
    setModeFilter("");
    setError(null);
  };

  const formatDateTime = (iso: string): string => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatNumber = (n: number): string => n.toLocaleString(undefined);

  const maskExternalUserId = (id: string): string => {
    if (!id) return "-";
    if (id.length <= 4) return "****";
    return `${"*".repeat(Math.max(0, id.length - 4))}${id.slice(-4)}`;
  };

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  const botDisabledPrev = botsPage <= 1 || botsLoading;
  const botDisabledNext = botsPage >= botTotalPages || botsLoading;

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Conversations admin</h1>
        <p className="page-subtitle">
          Review conversations by bot. Start from a bot summary, then drill into
          individual conversations.
        </p>
      </header>

      {!selectedBot && (
        <>
          <section aria-label="Bot filters" className="card">
            <form className="admin-filters-bar admin-filters-bar--2" onSubmit={handleApplyBotFilters}>
              <div className="admin-filter-group">
                <label className="admin-filter-label" htmlFor="bot-search">
                  Search
                </label>
                <input
                  id="bot-search"
                  className="input"
                  type="search"
                  placeholder="Search by bot name, slug, or owner email"
                  value={botsQueryInput}
                  onChange={(e) => setBotsQueryInput(e.target.value)}
                />
              </div>

              <div className="admin-filter-actions">
                <button type="submit" className="btn-secondary" disabled={botsLoading}>
                  Apply
                </button>
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={handleClearBotFilters}
                  disabled={botsLoading && !botsQuery}
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="admin-filters-meta">
              <span>
                Page {botsPage} of {botTotalPages} - {formatNumber(botsTotal)} bots
              </span>
            </div>
          </section>

          {botsLoading && (
            <div className="card">
              <p>Loading bots...</p>
            </div>
          )}

          {!botsLoading && botsError && (
            <div className="card card-error">
              <p>{botsError}</p>
            </div>
          )}

          {!botsLoading && !botsError && bots.length === 0 && (
            <div className="card">
              <p>No bots match your filters.</p>
            </div>
          )}

          {!botsLoading && !botsError && bots.length > 0 && (
            <section aria-label="Bots list" className="card">
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>Owner</th>
                      <th>Conversations</th>
                      <th>Last message</th>
                      <th aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div className="admin-bot-main">
                            <div className="admin-bot-name">{b.name}</div>
                            <div className="admin-bot-meta">
                              <span className="admin-bot-slug">/{b.slug}</span>
                              <span className="muted">Status {b.status}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-owner-main">
                            <div className="admin-owner-email">{b.owner.email}</div>
                            {b.owner.name && (
                              <div className="admin-owner-name">{b.owner.name}</div>
                            )}
                          </div>
                        </td>
                        <td>{formatNumber(b.conversationCount)}</td>
                        <td>{b.lastMessageAt ? formatDateTime(b.lastMessageAt) : "-"}</td>
                        <td className="admin-actions-cell">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleSelectBot(b)}
                          >
                            View conversations
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="admin-table-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    !botDisabledPrev && setBotsPage((p) => Math.max(1, p - 1))
                  }
                  disabled={botDisabledPrev}
                >
                  {"<- Previous"}
                </button>
                <span>
                  Page {botsPage} of {botTotalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    !botDisabledNext &&
                    setBotsPage((p) => Math.min(botTotalPages, p + 1))
                  }
                  disabled={botDisabledNext}
                >
                  {"Next ->"}
                </button>
              </footer>
            </section>
          )}
        </>
      )}

      {selectedBot && (
        <>
          <section aria-label="Conversation filters" className="card">
            <div className="admin-filters-bar admin-filters-bar--3">
              <div className="admin-filter-group">
                <div className="admin-filter-label">Selected bot</div>
                <div className="admin-number-sub">
                  {selectedBot.name} / {selectedBot.slug}
                </div>
              </div>

              <div className="admin-filter-group">
                <label className="admin-filter-label" htmlFor="conversation-channel">
                  Channel
                </label>
                <select
                  id="conversation-channel"
                  className="select"
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value as "" | AdminConversationChannel);
                    setPage(1);
                  }}
                >
                  {channelOptions.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-filter-group">
                <label className="admin-filter-label" htmlFor="conversation-mode">
                  Mode
                </label>
                <select
                  id="conversation-mode"
                  className="select"
                  value={modeFilter}
                  onChange={(e) => {
                    setModeFilter(e.target.value as "" | AdminConversationMode);
                    setPage(1);
                  }}
                >
                  {modeOptions.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-filter-actions">
                <button type="button" className="btn-secondary" onClick={handleBackToBots}>
                  {"<- Back to bots"}
                </button>
              </div>
            </div>

            <div className="admin-filters-meta">
              <span>
                Page {page} of {totalPages} - {formatNumber(total)} conversations
              </span>
            </div>
          </section>

          {loading && (
            <div className="card">
              <p>Loading conversations...</p>
            </div>
          )}

          {!loading && error && (
            <div className="card card-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && conversations.length === 0 && (
            <div className="card">
              <p>No conversations match your filters.</p>
            </div>
          )}

          {!loading && !error && conversations.length > 0 && (
            <section aria-label="Conversations list" className="card">
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Conversation</th>
                      <th>Channel / Mode</th>
                      <th>Last message</th>
                      <th>Messages</th>
                      <th>Eval</th>
                      <th aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.map((c) => {
                      const modeClass =
                        c.mode === "HUMAN"
                          ? "status-pill status-pill-warning"
                          : "status-pill status-pill-muted";
                      const evalLabel = c.latestEval
                        ? `${c.latestEval.score}/10`
                        : "-";

                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="admin-status-stack">
                              <span>{maskExternalUserId(c.externalUserId)}</span>
                              <span className="admin-number-sub">
                                ID <code>{c.id.slice(0, 8)}...</code>
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-status-stack">
                              <span className="status-pill status-pill-info">
                                {c.channel}
                              </span>
                              <span className={modeClass}>{c.mode}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-status-stack">
                              <span>{formatDateTime(c.lastMessageAt)}</span>
                              <span className="admin-number-sub">
                                Started {formatDateTime(c.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td>{formatNumber(c.messageCount)}</td>
                          <td>{evalLabel}</td>
                          <td className="admin-actions-cell">
                            <Link to={`/app/conversations/${c.id}`} className="btn-link-small">
                              View
                            </Link>
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
                  {"<- Previous"}
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
                  {"Next ->"}
                </button>
              </footer>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminConversations;
