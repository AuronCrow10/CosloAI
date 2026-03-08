// src/pages/app/BotKnowledgeJobPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  KnowledgeChunk,
  KnowledgeCrawlJob,
  getBotById,
  getBotCrawlStatus,
  getBotJobChunks,
  updateBotJobChunk,
  deleteBotJobChunk
} from "@/api/bots";

type ChunkRow = KnowledgeChunk & {
  draftText: string;
};

const DASH = "-";

function formatDate(iso: string | null | undefined) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString();
}

const BotKnowledgeJob: React.FC = () => {
  const { t } = useTranslation();
  const { id, jobId } = useParams<{ id: string; jobId: string }>();
  const [bot, setBot] = useState<Bot | null>(null);
  const [job, setJob] = useState<KnowledgeCrawlJob | null>(null);
  const [chunks, setChunks] = useState<ChunkRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [deletingMap, setDeletingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id || !jobId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    Promise.all([getBotById(id), getBotCrawlStatus(id, jobId), getBotJobChunks(id, jobId)])
      .then(([botResp, jobResp, chunksResp]) => {
        setBot(botResp);
        setJob(jobResp.job);
        const rows: ChunkRow[] = (chunksResp.chunks || []).map((c) => ({
          ...c,
          draftText: c.text
        }));
        setChunks(rows);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botKnowledge.chunks.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, jobId, t]);

  const handleSaveChunk = async (chunk: ChunkRow) => {
    if (!id) return;
    const nextText = chunk.draftText.trim();
    if (!nextText || nextText === chunk.text) return;

    setSavingMap((m) => ({ ...m, [chunk.id]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await updateBotJobChunk(id, chunk.id, nextText);
      const updated = resp.chunk;
      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunk.id
            ? { ...c, text: updated.text, draftText: updated.text }
            : c
        )
      );
      setSuccess(
        t("botKnowledge.chunks.success.saved", { chunkId: updated.id })
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.chunks.errors.saveFailed"));
    } finally {
      setSavingMap((m) => ({ ...m, [chunk.id]: false }));
    }
  };

  const handleDeleteChunk = async (chunk: ChunkRow) => {
    if (!id) return;
    const ok = window.confirm(t("botKnowledge.chunks.confirm.delete"));
    if (!ok) return;

    setDeletingMap((m) => ({ ...m, [chunk.id]: true }));
    setError(null);
    setSuccess(null);
    try {
      await deleteBotJobChunk(id, chunk.id);
      setChunks((prev) => prev.filter((c) => c.id !== chunk.id));
      setSuccess(
        t("botKnowledge.chunks.success.deleted", { chunkId: chunk.id })
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botKnowledge.chunks.errors.deleteFailed"));
    } finally {
      setDeletingMap((m) => ({ ...m, [chunk.id]: false }));
    }
  };

  if (!id || !jobId) {
    return (
      <div className="page-container">
        <p>{t("botKnowledge.chunks.missingId")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <p>{t("botKnowledge.chunks.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t("botKnowledge.chunks.title")}</h1>
          <p className="muted">
            {t("botKnowledge.chunks.subtitle", { botName: bot?.name || "" })}
          </p>
        </div>
        <Link to={`/app/bots/${id}/knowledge`} className="btn-secondary btn-color">
          {t("botKnowledge.chunks.backToHistory")}
        </Link>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      {job && (
        <div className="knowledge-card mb-4">
          <div className="knowledge-card-header">
            <div>
              <h3 className="knowledge-card-title">
                {t("botKnowledge.chunks.jobTitle")}
              </h3>
              <p className="knowledge-card-description">
                {t("botKnowledge.chunks.jobSubtitle", {
                  origin: job.origin || DASH
                })}
              </p>
            </div>
            <span className="status-badge">
              {job.jobType === "docs"
                ? t("botKnowledge.history.jobType.docs")
                : t("botKnowledge.history.jobType.domain")}
            </span>
          </div>
          <div className="chunk-meta">
            <div>
              <strong>{t("botKnowledge.chunks.jobIdLabel")}:</strong> {job.id}
            </div>
            <div>
              <strong>{t("botKnowledge.chunks.startedLabel")}:</strong>{" "}
              {formatDate(job.startedAt || job.createdAt)}
            </div>
            <div>
              <strong>{t("botKnowledge.chunks.finishedLabel")}:</strong>{" "}
              {formatDate(job.finishedAt)}
            </div>
          </div>
        </div>
      )}

      {chunks.length === 0 ? (
        <div className="muted">{t("botKnowledge.chunks.empty")}</div>
      ) : (
        <div className="chunk-list">
          {chunks.map((chunk) => {
            const saving = !!savingMap[chunk.id];
            const deleting = !!deletingMap[chunk.id];

            return (
              <div key={chunk.id} className="chunk-card">
                <div className="chunk-card-header">
                  <div>
                    <div className="chunk-title">
                      {t("botKnowledge.chunks.chunkLabel", {
                        index: chunk.chunkIndex
                      })}
                    </div>
                    <div className="chunk-subtitle">
                      {t("botKnowledge.chunks.sourceLabel")}: {chunk.url}
                    </div>
                  </div>
                  <div className="chunk-actions">
                    <button
                      className="btn-secondary btn-color"
                      type="button"
                      disabled={saving || deleting || chunk.draftText.trim() === chunk.text}
                      onClick={() => handleSaveChunk(chunk)}
                    >
                      {saving
                        ? t("botKnowledge.chunks.saving")
                        : t("botKnowledge.chunks.save")}
                    </button>
                    <button
                      className="btn-secondary btn-color"
                      type="button"
                      disabled={saving || deleting}
                      onClick={() => handleDeleteChunk(chunk)}
                    >
                      {deleting
                        ? t("botKnowledge.chunks.deleting")
                        : t("botKnowledge.chunks.delete")}
                    </button>
                  </div>
                </div>

                <textarea
                  className="chunk-textarea"
                  value={chunk.draftText}
                  onChange={(e) => {
                    const value = e.target.value;
                    setChunks((prev) =>
                      prev.map((c) =>
                        c.id === chunk.id ? { ...c, draftText: value } : c
                      )
                    );
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BotKnowledgeJob;
