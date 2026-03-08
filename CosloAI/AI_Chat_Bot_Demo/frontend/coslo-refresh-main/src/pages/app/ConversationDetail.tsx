// src/pages/app/ConversationDetailsPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ConversationMessage,
  fetchConversationMessages,
  ConversationDetails,
  fetchConversationDetails,
  sendManualConversationMessage,
  setConversationMode,
  ConversationMode
} from "@/api/bots";
import { useTranslation } from "react-i18next";

const ConversationDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState<ConversationDetails | null>(null);

  const [humanText, setHumanText] = useState("");
  const [sendingHuman, setSendingHuman] = useState(false);
  const [humanError, setHumanError] = useState<string | null>(null);
  const [humanSuccess, setHumanSuccess] = useState<string | null>(null);

  const [updatingMode, setUpdatingMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  const conversationsLink = details?.botId
    ? `/app/bots/${details.botId}/conversations`
    : "/app/bots";

  const is24hRestrictedChannel = !!(
    details &&
    (details.channel === "WHATSAPP" ||
      details.channel === "FACEBOOK" ||
      details.channel === "INSTAGRAM")
  );

  let outside24hWindow = false;

  if (details && is24hRestrictedChannel) {
    const lastUserAt = details.lastUserMessageAt
      ? new Date(details.lastUserMessageAt)
      : null;

    if (!lastUserAt) {
      outside24hWindow = true;
    } else {
      const diffMs = Date.now() - lastUserAt.getTime();
      const hours = diffMs / (1000 * 60 * 60);
      outside24hWindow = hours > 24;
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([fetchConversationMessages(id), fetchConversationDetails(id)])
      .then(([messagesData, detailsData]) => {
        setMessages(messagesData);
        setDetails(detailsData);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("conversationDetail.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  const roleLabel = (role: ConversationMessage["role"]) => {
    switch (role) {
      case "USER":
        return t("conversationDetail.roles.user") || "User";
      case "ASSISTANT":
        return t("conversationDetail.roles.assistant") || "Assistant";
      case "HUMAN":
        return t("conversationDetail.roles.human") || "Human";
      case "SYSTEM":
        return t("conversationDetail.roles.system") || "System";
      default:
        return role;
    }
  };

  const handleSwitchMode = async (mode: ConversationMode) => {
    if (!id || !details || updatingMode) return;
    setUpdatingMode(true);
    setModeError(null);
    try {
      const res = await setConversationMode(id, mode);
      setDetails((prev) => (prev ? { ...prev, mode: res.mode } : prev));
    } catch (err: any) {
      console.error(err);
      setModeError(
        err?.message ||
          t("conversationDetail.mode.error") ||
          "Failed to change mode."
      );
    } finally {
      setUpdatingMode(false);
    }
  };

  const handleSendHuman = async () => {
    if (!id || sendingHuman) return;
    const trimmed = humanText.trim();
    if (!trimmed) {
      setHumanError(
        t("conversationDetail.manualSend.empty") || "Write a message first."
      );
      setHumanSuccess(null);
      return;
    }

    setSendingHuman(true);
    setHumanError(null);
    setHumanSuccess(null);
    try {
      await sendManualConversationMessage(id, trimmed);
      setHumanText("");
      setHumanSuccess(
        t("conversationDetail.manualSend.success") || "Message sent."
      );
      const updatedMessages = await fetchConversationMessages(id);
      setMessages(updatedMessages);
    } catch (err: any) {
      console.error(err);
      setHumanError(
        err?.message ||
          t("conversationDetail.manualSend.failed") ||
          "Failed to send message."
      );
    } finally {
      setSendingHuman(false);
    }
  };

  if (!id) {
    return (
      <div className="conversation-page">
        <div className="conversation-topbar">
          <div>
            <h1 className="conversation-title">
              {t("conversationDetail.title")}
            </h1>
            <p className="muted conversation-subtitle">
              {t("conversationDetail.missingId") ||
                "Conversation not found."}
            </p>
          </div>
          <Link to={conversationsLink} className="btn-secondary">
            {t("conversationDetail.backToConversations") ||
              t("conversationDetail.backToBots")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-page">
      <div className="conversation-topbar">
        <div>
          <h1 className="conversation-title">{t("conversationDetail.title")}</h1>
          <p className="muted conversation-subtitle">
            {details?.user.displayName || details?.user.identifier || ""}
          </p>
        </div>
        <Link to={conversationsLink} className="btn-secondary">
          {t("conversationDetail.backToConversations") ||
            t("conversationDetail.backToBots")}
        </Link>
      </div>

      <div className="conversation-layout">
        <section className="conversation-chat">
          {details && (
            <div className="conversation-card">
              <h2 className="conversation-card-title">
                {t("conversationDetail.parties.title")}
              </h2>
              <div className="conversation-party">
                <div className="conversation-party-label">
                  {t("conversationDetail.parties.business")}
                </div>
                <div className="conversation-party-value">
                  {details.business.title}
                </div>
                {details.business.subtitle && (
                  <div className="conversation-party-muted">
                    {details.business.subtitle}
                  </div>
                )}
              </div>
              <div className="conversation-party">
                <div className="conversation-party-label">
                  {t("conversationDetail.parties.user")}
                </div>
                <div className="conversation-party-value">
                  {details.user.displayName || details.user.identifier}
                </div>
                {details.user.displayName && (
                  <div className="conversation-party-muted">
                    {details.user.identifier}
                  </div>
                )}
              </div>

            </div>
          )}

          {loading && <p className="muted">{t("conversationDetail.loading")}</p>}
          {error && <div className="form-error">{error}</div>}

          {!loading && !error && messages.length === 0 && (
            <div className="conversation-empty">
              {t("conversationDetail.empty")}
            </div>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className="conversation-messages flex flex-col gap-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    "conversation-bubble",
                    "max-w-[80%] w-fit",
                    m.role === "USER" || m.role === "SYSTEM"
                      ? "self-start"
                      : "self-end",
                    m.role === "USER"
                      ? "bg-white/70 border-border dark:bg-slate-800/80 dark:border-slate-600/60 dark:text-slate-100"
                      : "",
                    m.role === "ASSISTANT"
                      ? "bg-primary/10 border-primary/20 dark:bg-primary/30 dark:border-primary/40 dark:text-foreground"
                      : "",
                    m.role === "HUMAN" ? "bg-emerald-50 border-emerald-200" : "",
                    m.role === "SYSTEM" ? "bg-amber-50 border-amber-200" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="conversation-bubble-meta">
                    <span>{roleLabel(m.role)}</span>
                  </div>
                  <div className="conversation-bubble-text">{m.content}</div>
                  <div className="conversation-bubble-footer">
                    <span className="conversation-bubble-time">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {details && details.mode === "AI" && (
            <div className="conversation-composer">
              <div className="conversation-composer-header">
                <div>
                  <h3>
                    {t("conversationDetail.mode.aiLabel") || "AI"}
                  </h3>
                  <p className="muted">
                    {is24hRestrictedChannel && outside24hWindow
                      ? t("conversationDetail.manualSend.windowExpired") ||
                        "You can no longer send manual messages: the last user message is more than 24 hours old on this channel. Meta requires templates beyond the 24h window."
                      : t("conversationDetail.aiModeNotice") ||
                        "Switch to human mode to chat with this contact."}
                  </p>
                </div>
              </div>
              <div className="conversation-composer-row">
                {is24hRestrictedChannel && outside24hWindow ? (
                  <span className="conversation-mode-pill">
                    {t("conversationDetail.windowExpiredPill") ||
                      "24h window expired"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={updatingMode}
                    onClick={() => handleSwitchMode("HUMAN")}
                  >
                    {updatingMode
                      ? t("conversationDetail.mode.switchingToHuman") || "Switching..."
                      : t("conversationDetail.switchToHuman") ||
                        "Switch to human mode"}
                  </button>
                )}
              </div>
              {modeError && <div className="form-error">{modeError}</div>}
            </div>
          )}

          {details && details.mode === "HUMAN" && (
            <div className="conversation-composer">
              <div className="conversation-composer-header">
                <div>
                  <h3>
                    {t("conversationDetail.manualSend.title") ||
                      "Manual reply (HUMAN)"}
                  </h3>
                  <p className="muted">
                    {t("conversationDetail.manualSend.description") ||
                      "Send a manual reply as a human agent over this channel."}
                  </p>
                </div>
                <span className="conversation-mode-pill">
                  {t("conversationDetail.mode.humanLabel") || "HUMAN"}
                </span>
              </div>

              {is24hRestrictedChannel && outside24hWindow && (
                <div className="form-error mb-2">
                  {t("conversationDetail.manualSend.windowExpired") ||
                    "You can no longer send manual messages: the last user message is more than 24 hours old on this channel. Meta requires templates beyond the 24h window."}
                </div>
              )}

              <div className="conversation-composer-row">
                <textarea
                  value={humanText}
                  onChange={(e) => setHumanText(e.target.value)}
                  placeholder={
                    t("conversationDetail.manualSend.placeholder") ||
                    "Type a manual reply..."
                  }
                  disabled={
                    sendingHuman ||
                    (is24hRestrictedChannel && outside24hWindow)
                  }
                  rows={2}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendHuman}
                  disabled={
                    sendingHuman ||
                    (is24hRestrictedChannel && outside24hWindow)
                  }
                >
                  {sendingHuman
                    ? t("conversationDetail.manualSend.sending") || "Sending..."
                    : t("conversationDetail.manualSend.button") || "Send"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={updatingMode}
                  onClick={() => handleSwitchMode("AI")}
                >
                  {updatingMode
                    ? t("conversationDetail.mode.switchingToAi") || "Switching..."
                    : t("conversationDetail.switchToAi") || "Switch to AI"}
                </button>
              </div>

              {modeError && <div className="form-error">{modeError}</div>}
              {humanError && <div className="form-error">{humanError}</div>}
              {humanSuccess && <div className="form-success">{humanSuccess}</div>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ConversationDetailPage;
