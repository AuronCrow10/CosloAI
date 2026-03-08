// src/pages/app/BotConversationsPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Conversation,
  ConversationEvalResponse,
  PaginatedConversations,
  fetchBotConversations,
  evaluateConversationApi,
  bulkEvaluateConversationsApi,
  BulkConversationEvalItem
} from "@/api/bots";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

const BotConversations: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Selection & bulk eval
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEvaluating, setBulkEvaluating] = useState(false);

  // Load conversations whenever bot id or page changes
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchBotConversations(id, page)
      .then((data: PaginatedConversations) => {
        setConversations(data.items);
        setTotalPages(data.totalPages);
        setTotalItems(data.totalItems);
        // Reset selection on page change
        setSelectedIds(new Set());
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botConversations.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, page, t]);

  const handleEvaluate = async (conversationId: string) => {
    try {
      setEvaluatingId(conversationId);
      setError(null);

      const result: ConversationEvalResponse = await evaluateConversationApi(
        conversationId
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                latestEval: {
                  score: result.score,
                  label: result.label ?? null,
                  isAuto: result.isAuto,
                  createdAt: result.createdAt
                }
              }
            : c
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botConversations.errors.evalFailed"));
    } finally {
      setEvaluatingId(null);
    }
  };

  // ---- Selection helpers ----

  const toggleSelect = (conversationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    // Select *all conversations in the current page* (max 20)
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  };

  const selectedCount = selectedIds.size;
  const allSelected =
    conversations.length > 0 && selectedCount === conversations.length;

  // ---- Bulk evaluate (up to 20, one page) ----

  const handleBulkEvaluate = async () => {
    if (selectedIds.size === 0) return;
    setBulkEvaluating(true);
    setError(null);

    const idsToEval = Array.from(selectedIds);

    try {
      const results: BulkConversationEvalItem[] =
        await bulkEvaluateConversationsApi(idsToEval);

      // Update local state with results
      setConversations((prev) =>
        prev.map((c) => {
          const item = results.find(
            (r) => r.conversationId === c.id && r.ok && r.result
          );
          if (!item || !item.result) return c;

          const r = item.result;
          return {
            ...c,
            latestEval: {
              score: r.score,
                label: r.label ?? null,
              isAuto: r.isAuto,
              createdAt: r.createdAt
            }
          };
        })
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(t("botConversations.errors.someFailed"));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botConversations.errors.bulkEvalFailed"));
    } finally {
      setBulkEvaluating(false);
    }
  };

  // ---- Pagination controls ----

  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    if (totalPages === 0) return;
    setPage((p) => Math.min(totalPages, p + 1));
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botConversations.missingId")}</p>
      </div>
    );
  }

  const hasConversations = totalItems > 0;

  const isTeamMember = user?.role === "TEAM_MEMBER";
  const bulkButtonLabel = bulkEvaluating
    ? t("botConversations.actions.evaluatingSelected")
    : selectedCount > 0
    ? t("botConversations.actions.evaluateSelectedCount", {
        count: selectedCount
      })
    : t("botConversations.actions.evaluateSelected");
  const conversationLabels = {
    select: t("botConversations.table.selectAll"),
    channel: t("botConversations.table.channel"),
    externalUser: t("botConversations.table.externalUser"),
    lastMessage: t("botConversations.table.lastMessage"),
    score: t("botConversations.table.score"),
    actions: t("botConversations.table.actions")
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t("botConversations.title")}</h1>
          <p className="muted">{t("botConversations.subtitle")}</p>
        </div>

        <div className="page-header-actions">
          {!isTeamMember && (
            <button
              className="btn-secondary mr-3"
              onClick={handleBulkEvaluate}
              disabled={selectedCount === 0 || bulkEvaluating}
            >
              {bulkButtonLabel}
            </button>
          )}

          <Link to={isTeamMember ? "/app/bots" : `/app/bots/${id}`} className="btn-secondary">
            {t("botConversations.backToBot")}
          </Link>
        </div>
      </div>

      {loading && <p>{t("botConversations.loading")}</p>}
      {error && <div className="form-error">{error}</div>}
      {!loading && !error && !hasConversations && (
        <p>{t("botConversations.empty")}</p>
      )}

      {!loading && !error && hasConversations && (
        <>
          {/* Pagination summary */}
          <div className="conversations-pagination">
            <span className="muted">
              {t("botConversations.pagination.total", { total: totalItems })}
              {totalPages > 1 &&
                ` • ${t("botConversations.pagination.pageOf", {
                  page,
                  totalPages
                })}`}
            </span>

            <div className="conversations-pagination-actions">
              <button
                className="btn-secondary mr-2"
                onClick={handlePrevPage}
                disabled={page <= 1 || loading}
              >
                {t("botConversations.pagination.prev")}
              </button>
              <button
                className="btn-secondary"
                onClick={handleNextPage}
                disabled={page >= totalPages || loading}
              >
                {t("botConversations.pagination.next")}
              </button>
            </div>
          </div>

          <div className="table-responsive conversations-table-wrapper">
            <table className="table conversations-table">
            <thead>
              <tr>
                {!isTeamMember && (
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label={conversationLabels.select}
                    />
                  </th>
                )}
                <th>{conversationLabels.channel}</th>
                <th>{conversationLabels.externalUser}</th>
                <th>{conversationLabels.lastMessage}</th>
                <th>{conversationLabels.score}</th>
                <th className="conversations-actions-header">
                  {conversationLabels.actions}
                </th>
              </tr>
            </thead>

            <tbody>
              {conversations.map((c) => {
                const isSelected = selectedIds.has(c.id);
                const isRowEvaluating = evaluatingId === c.id || bulkEvaluating;

                const evalLabel = isRowEvaluating
                  ? t("botConversations.actions.evaluating")
                  : c.latestEval
                  ? t("botConversations.actions.reevaluate")
                  : t("botConversations.actions.evaluate");

                return (
                  <tr key={c.id}>
                    {!isTeamMember && (
                      <td
                        className="conversations-select-cell"
                        data-label={conversationLabels.select}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={t("botConversations.table.selectRow")}
                        />
                      </td>
                    )}

                    <td data-label={conversationLabels.channel}>{c.channel}</td>
                    <td
                      className="conversations-external-user"
                      data-label={conversationLabels.externalUser}
                    >
                      {maskExternalUserId(c.externalUserId)}
                    </td>
                    <td data-label={conversationLabels.lastMessage}>
                      {new Date(c.lastMessageAt).toLocaleString()}
                    </td>

                    <td data-label={conversationLabels.score}>
                      {c.latestEval ? (
                        <ScoreStars
                          score={c.latestEval.score}
                            label={c.latestEval.label ?? undefined}
                        />
                      ) : (
                        <span className="muted">
                          {t("botConversations.notEvaluated")}
                        </span>
                      )}
                    </td>

                    <td
                      className="conversations-actions-cell"
                      data-label={conversationLabels.actions}
                    >
                      {!isTeamMember && (
                        <button
                          className="btn-secondary mr-2"
                          disabled={isRowEvaluating}
                          onClick={() => handleEvaluate(c.id)}
                        >
                          {evalLabel}
                        </button>
                      )}

                      <Link
                        to={`/app/conversations/${c.id}`}
                        className="btn-link"
                      >
                        {t("botConversations.actions.view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

function maskExternalUserId(id: string): string {
  if (id.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, id.length - 4))}${id.slice(-4)}`;
}

/**
 * Render score as stars, where 1/10 = 0.5★.
 * Examples:
 *  - 9/10 -> 4.5★
 *  - 8/10 -> 4★
 */
const ScoreStars: React.FC<{ score: number; label?: string }> = ({
  score,
  label
}) => {
  const [open, setOpen] = useState(false);

  // clamp score to [0, 10] and convert to 0..5 stars in 0.5 increments
  const safeScore = Math.max(0, Math.min(10, score));
  const stars = safeScore / 2; // 10 -> 5, 1 -> 0.5
  const fullStars = Math.floor(stars);
  const hasHalf = stars - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  const handleMouseEnter = () => setOpen(true);
  const handleMouseLeave = () => setOpen(false);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <div
      className="score-stars-wrapper relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <span
        className={`score-stars ${label ? "cursor-pointer" : "cursor-default"}`}
        aria-label={`${score}/10`}
      >
        {Array.from({ length: fullStars }).map((_, i) => (
          <span key={`full-${i}`} className="text-amber-400">
            ★
          </span>
        ))}
        {hasHalf && (
          <span key="half" className="text-amber-400">
            ☆
          </span>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <span key={`empty-${i}`} className="text-muted-foreground/40">
            ★
          </span>
        ))}
      </span>

      {label && open && (
        <div
          className="score-tooltip absolute top-[120%] left-1/2 -translate-x-1/2 rounded bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg max-w-[260px] whitespace-normal z-10"
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default BotConversations;

