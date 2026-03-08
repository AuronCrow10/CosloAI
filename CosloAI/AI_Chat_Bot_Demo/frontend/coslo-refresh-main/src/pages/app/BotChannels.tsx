// src/pages/app/BotChannelsPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BotChannel,
  ChannelType,
  fetchChannels,
  updateChannel,
  deleteChannel,
  getBotById,
  Bot,
  getMetaConnectUrl,
  getMetaSession,
  attachMetaSession,
  MetaSessionResponse,
  completeWhatsappEmbeddedSignup,
  attachWhatsappSession,
  WhatsappConnectSessionResponse
} from "@/api/bots";
import { loadFacebookSdk } from "@/utils/facebookSdk";
import { useTranslation } from "react-i18next";

function isMetaChannelType(type: ChannelType) {
  return type === "FACEBOOK" || type === "INSTAGRAM";
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const BotChannels: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    externalId: string;
    accessToken: string;
    meta: string;
  }>({
    externalId: "",
    accessToken: "",
    meta: ""
  });

  // Meta connect session state (page selection)
  const [metaSession, setMetaSession] = useState<MetaSessionResponse | null>(
    null
  );
  const [metaSessionLoading, setMetaSessionLoading] = useState(false);
  const [metaSessionError, setMetaSessionError] = useState<string | null>(null);
  const [metaSelectedPageId, setMetaSelectedPageId] = useState<string>("");
  const [metaAttachLoading, setMetaAttachLoading] = useState(false);

  // WhatsApp embedded signup session state
  const [waSession, setWaSession] =
    useState<WhatsappConnectSessionResponse | null>(null);
  const [waSelectedNumberId, setWaSelectedNumberId] = useState<string>("");
  const [waConnecting, setWaConnecting] = useState(false);
  const [waAttachLoading, setWaAttachLoading] = useState(false);
  const [waRegistrationPin, setWaRegistrationPin] = useState<string>("");

  // Meta permissions confirmation dialog
  const [metaPermissionsChannel, setMetaPermissionsChannel] = useState<
    "FACEBOOK" | "INSTAGRAM" | null
  >(null);
  const [metaPermissionsAccepted, setMetaPermissionsAccepted] =
    useState(false);
  const [metaPermissionsSubmitting, setMetaPermissionsSubmitting] =
    useState(false);

  // Meta page select modal
  const [metaSelectModalOpen, setMetaSelectModalOpen] = useState(false);

  const [webWidgetModalOpen, setWebWidgetModalOpen] = useState(false);
  const [webWidgetCopied, setWebWidgetCopied] = useState(false);
  const webWidgetCloseRef = useRef<HTMLButtonElement | null>(null);
  const webWidgetCopyTimeoutRef = useRef<number | null>(null);

  const clearMetaSessionFromUrl = () => {
    const params = new URLSearchParams(location.search);
    if (params.has("metaSessionId")) {
      params.delete("metaSessionId");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString()
        },
        { replace: true }
      );
    }
  };

  const closeMetaSelectModal = () => {
    setMetaSelectModalOpen(false);
    setMetaSession(null);
    setMetaSelectedPageId("");
    clearMetaSessionFromUrl();
  };

  const openMetaPermissionsDialog = (channel: "FACEBOOK" | "INSTAGRAM") => {
    setMetaPermissionsChannel(channel);
    setMetaPermissionsAccepted(false);
    setMetaPermissionsSubmitting(false);
  };

  const closeMetaPermissionsDialog = () => {
    setMetaPermissionsChannel(null);
    setMetaPermissionsAccepted(false);
    setMetaPermissionsSubmitting(false);
  };

  const handleConfirmMetaPermissions = async () => {
    if (!id || !metaPermissionsChannel) return;

    setMetaPermissionsSubmitting(true);
    setError(null);

    try {
      const returnPath = `/app/bots/${encodeURIComponent(id)}/channels`;
      const { url } = await getMetaConnectUrl(
        id,
        metaPermissionsChannel,
        returnPath
      );
      window.location.href = url;
    } catch (err: any) {
      console.error(err);
      const errorKey =
        metaPermissionsChannel === "FACEBOOK"
          ? "botChannels.errors.facebookConnectFailed"
          : "botChannels.errors.instagramConnectFailed";
      setError(err?.message || t(errorKey));
      setMetaPermissionsSubmitting(false);
    }
  };

  const loadChannels = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getBotById(id).catch((err: any) => {
        console.error(err);
        return null;
      }),
      fetchChannels(id)
    ])
      .then(([botData, channelData]) => {
        if (botData) setBot(botData);
        setChannels(channelData);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botChannels.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  };

  const loadMetaSessionFromQuery = () => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("metaSessionId");
    if (!sessionId) {
      setMetaSession(null);
      setMetaSessionError(null);
      setMetaSelectedPageId("");
      setMetaSelectModalOpen(false);
      return;
    }

    setMetaSessionLoading(true);
    setMetaSessionError(null);
    getMetaSession(sessionId)
      .then((session) => {
        setMetaSession(session);
        console.log("Meta session for", session.channelType, session);
        setMetaSelectedPageId("");
        setMetaSelectModalOpen(true);
      })
      .catch((err: any) => {
        console.error(err);
        setMetaSessionError(
          err?.message || t("botChannels.errors.metaSessionLoad")
        );
        setMetaSession(null);
        setMetaSelectModalOpen(false);
      })
      .finally(() => setMetaSessionLoading(false));
  };

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadMetaSessionFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botChannels.missingId")}</p>
      </div>
    );
  }

  const handleEditChange =
    (field: keyof typeof editForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEditForm({
        ...editForm,
        [field]: e.target.value
      });
    };

  const startEdit = (ch: BotChannel) => {
    if (isMetaChannelType(ch.type)) {
      setError(t("botChannels.errors.metaManagedExternally"));
      return;
    }

    setEditingId(ch.id);
    setEditForm({
      externalId: ch.externalId,
      accessToken: ch.accessToken,
      meta: ch.meta ? JSON.stringify(ch.meta, null, 2) : ""
    });
  };

  const handleEditSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!id || !editingId) return;
    setError(null);

    try {
      let meta: any = undefined;
      if (editForm.meta.trim()) {
        meta = JSON.parse(editForm.meta);
      }

      await updateChannel(id, editingId, {
        externalId: editForm.externalId,
        accessToken: editForm.accessToken,
        meta
      });

      setEditingId(null);
      loadChannels();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.updateFailed"));
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!id) return;
    if (!window.confirm(t("botChannels.confirm.deleteChannel"))) return;

    setError(null);
    try {
      await deleteChannel(id, channelId);
      loadChannels();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.deleteFailed"));
    }
  };

  useEffect(() => {
    if (!webWidgetModalOpen) return;
    webWidgetCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWebWidgetModalOpen(false);
        setWebWidgetCopied(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [webWidgetModalOpen]);

  useEffect(() => {
    return () => {
      if (webWidgetCopyTimeoutRef.current) {
        window.clearTimeout(webWidgetCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyWidgetSnippet = async (snippet: string) => {
    if (!snippet) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = snippet;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setWebWidgetCopied(true);
      if (webWidgetCopyTimeoutRef.current) {
        window.clearTimeout(webWidgetCopyTimeoutRef.current);
      }
      webWidgetCopyTimeoutRef.current = window.setTimeout(() => {
        setWebWidgetCopied(false);
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAttachMetaSession = async () => {
    if (!metaSession || !metaSelectedPageId) return;
    setMetaAttachLoading(true);
    setError(null);

    try {
      await attachMetaSession(metaSession.id, metaSelectedPageId);
      setMetaSession(null);
      setMetaSelectedPageId("");
      clearMetaSessionFromUrl();
      setMetaSelectModalOpen(false);
      loadChannels();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.metaAttachFailed"));
    } finally {
      setMetaAttachLoading(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!id) return;
    setError(null);
    setWaConnecting(true);

    const appId =
      (import.meta as any).env.VITE_META_APP_ID ||
      (import.meta as any).env.VITE_FACEBOOK_APP_ID;
    const configId = (import.meta as any).env.VITE_WHATSAPP_EMBEDDED_CONFIG_ID;
    const redirectUri =
      (import.meta as any).env.VITE_WHATSAPP_EMBEDDED_REDIRECT_URI ||
      `${window.location.origin}/app/bots`;

    if (!appId || !configId) {
      setError(t("botChannels.errors.whatsappEnvMissing"));
      setWaConnecting(false);
      return;
    }

    try {
      const lastConnectTimestampStr =
        window.localStorage.getItem("wa_last_connect_ts");
      if (lastConnectTimestampStr) {
        const lastConnectTimestamp = parseInt(lastConnectTimestampStr, 10);
        if (Date.now() - lastConnectTimestamp < SEVEN_DAYS_MS) {
          if (
            !window.confirm(
              t("botChannels.whatsapp.confirmReconnectWithinWeek")
            )
          ) {
            setWaConnecting(false);
            return;
          }
        }
      }

      const FB = await loadFacebookSdk(appId);

      console.log("redirectUri", redirectUri, "origin", window.location.origin);

      FB.login(
        (response: any) => {
          (async () => {
            if (
              !response ||
              !response.authResponse ||
              !response.authResponse.code
            ) {
              setError(t("botChannels.errors.whatsappCancelled"));
              setWaConnecting(false);
              return;
            }

            const code = response.authResponse.code as string;

            try {
              const session = await completeWhatsappEmbeddedSignup(id, {
                code,
                redirectUri
              });
              setWaSession(session);
              setWaSelectedNumberId("");
              setWaRegistrationPin("");
            } catch (err: any) {
              console.error(err);
              setError(
                err?.message || t("botChannels.errors.whatsappSignupFailed")
              );
            } finally {
              setWaConnecting(false);
            }
          })();
        },
        {
          config_id: configId,
          redirect_uri: redirectUri,
          response_type: "code",
          override_default_response_type: true
        }
      );

      window.localStorage.setItem(
        "wa_last_connect_ts",
        Date.now().toString()
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.whatsappInitFailed"));
      setWaConnecting(false);
    }
  };

  const handleAttachWhatsappSession = async () => {
    if (!waSession || !waSelectedNumberId) return;
    setWaAttachLoading(true);
    setError(null);

    try {
      await attachWhatsappSession(
        waSession.sessionId,
        waSelectedNumberId,
        waRegistrationPin || undefined
      );
      setWaSession(null);
      setWaSelectedNumberId("");
      setWaRegistrationPin("");
      loadChannels();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.whatsappAttachFailed"));
    } finally {
      setWaAttachLoading(false);
    }
  };

  const renderChannelDetails = (ch: BotChannel) => {
    if (isMetaChannelType(ch.type)) {
      const meta = (ch.meta as any) || {};
      const pageName = meta.pageName as string | undefined;
      const igUsername = meta.igUsername as string | undefined;
      const igName = meta.igName as string | undefined;

      const label =
        ch.type === "FACEBOOK"
          ? t("botChannels.labels.facebookPage")
          : t("botChannels.labels.instagramBusiness");

      const displayName =
        ch.type === "FACEBOOK"
          ? pageName
          : igUsername || igName || pageName;

      if (displayName) {
        return (
          <>
            <strong>{label}</strong>
            <div className="muted">{displayName}</div>
          </>
        );
      }

      return (
        <>
          <strong>{label}</strong>
          <div className="muted">
            {t("botChannels.meta.connectedViaMeta")}
          </div>
        </>
      );
    }

    if (ch.type === "WHATSAPP") {
      const displayPhoneNumber =
        (ch.meta?.displayPhoneNumber as string | undefined) ||
        (ch.meta?.display_phone_number as string | undefined);
      const verifiedName =
        (ch.meta?.verifiedName as string | undefined) ||
        (ch.meta?.verified_name as string | undefined);

      return (
        <>
          <strong>{t("botChannels.labels.whatsapp")}</strong>
          <div className="muted">
            {displayPhoneNumber
              ? t("botChannels.whatsapp.number", { number: displayPhoneNumber })
              : t("botChannels.whatsapp.numberId", { id: ch.externalId })}
            {verifiedName ? ` – ${verifiedName}` : ""}
          </div>
        </>
      );
    }

    if (ch.type === "WEB") {
      return (
        <>
          <strong>{t("botChannels.labels.webWidget")}</strong>
          <div className="muted">
            {t("botChannels.web.externalId", {
              id: ch.externalId || t("botChannels.web.defaultWidget")
            })}
          </div>
        </>
      );
    }

    return (
      <>
        <strong>{ch.type}</strong>
        <div className="muted">
          {t("botChannels.generic.externalId", { id: ch.externalId })}
        </div>
      </>
    );
  };

  const getChannelStatusInfo = (
    ch: BotChannel | null
  ): { label: string; className: string; isConnected: boolean } => {
    if (!ch) {
      return {
        label: t("botChannels.status.notConnected"),
        className: "status-badge status-badge-warn",
        isConnected: false
      };
    }

    const meta = (ch.meta as any) || {};

    if (!isMetaChannelType(ch.type)) {
      const needsReconnect = meta.needsReconnect === true;
      if (needsReconnect) {
        return {
          label: t("botChannels.status.needsReconnect"),
          className: "status-badge status-badge-error",
          isConnected: false
        };
      }
      return {
        label: t("botChannels.status.active"),
        className: "status-badge status-badge-ok",
        isConnected: true
      };
    }

    const now = Date.now();
    const needsReconnect = meta.needsReconnect === true;
    const tokenExpiresAtStr: string | undefined = meta.tokenExpiresAt;
    let expiresAt: Date | null = null;

    if (tokenExpiresAtStr) {
      const d = new Date(tokenExpiresAtStr);
      if (!isNaN(d.getTime())) expiresAt = d;
    }

    if (needsReconnect) {
      return {
        label: t("botChannels.status.needsReconnect"),
        className: "status-badge status-badge-error",
        isConnected: false
      };
    }

    if (!expiresAt) {
      return {
        label: t("botChannels.status.connectedUnknownExpiry"),
        className: "status-badge status-badge-ok",
        isConnected: true
      };
    }

    const diff = expiresAt.getTime() - now;

    if (diff <= 0) {
      return {
        label: t("botChannels.status.expired"),
        className: "status-badge status-badge-error",
        isConnected: false
      };
    }

    if (diff <= SEVEN_DAYS_MS) {
      return {
        label: t("botChannels.status.expiringSoon"),
        className: "status-badge status-badge-warn",
        isConnected: false
      };
    }

    return {
      label: t("botChannels.status.connected"),
      className: "status-badge status-badge-ok",
      isConnected: true
    };
  };

  const renderChannelStatusBadge = (ch: BotChannel | null) => {
    const { label, className } = getChannelStatusInfo(ch);
    return <span className={className}>{label}</span>;
  };

  const renderChannelTypeLabel = (type: ChannelType) => {
    if (type === "FACEBOOK") return t("botChannels.types.facebook");
    if (type === "INSTAGRAM") return t("botChannels.types.instagram");
    if (type === "WHATSAPP") return t("botChannels.types.whatsapp");
    if (type === "WEB") return t("botChannels.types.webWidget");
    return type;
  };

  const facebookChannel = channels.find((c) => c.type === "FACEBOOK") || null;
  const instagramChannel = channels.find((c) => c.type === "INSTAGRAM") || null;
  const whatsappChannel = channels.find((c) => c.type === "WHATSAPP") || null;
  const connectedChannels = channels.filter((ch) => ch.type !== "WEB");

  const fbStatus = getChannelStatusInfo(facebookChannel);
  const igStatus = getChannelStatusInfo(instagramChannel);
  const waStatus = getChannelStatusInfo(whatsappChannel);

  const connectedChannelLabels = {
    type: t("botChannels.table.type"),
    details: t("botChannels.table.details"),
    status: t("botChannels.table.status"),
    actions: t("botChannels.table.actions")
  };

  const isValidWaPin = /^\d{6}$/.test(waRegistrationPin);

  const botSlug = bot?.slug || id || "";
  const widgetSnippet =
    typeof window !== "undefined" && botSlug
      ? `<script
  src="https://coslo.it/embed.js"
  async
  data-bot-slug="${botSlug}"
  data-bot-icon="https://i.ibb.co/cczVssVz/test.gif"
  data-bot-hints="Serve aiuto?|Fai una domanda|Parla con il mio assistente 🤖|Sono qui per te!"
></script>`
      : "";

  return (
    <div className="page-container">
      <div className="page-header">
        {/* Meta permissions dialog */}
        {metaPermissionsChannel && (
          <div className="meta-permissions-modal-backdrop">
            <div className="meta-permissions-modal">
              <div className="meta-permissions-modal-header">
                <h2>
                  {metaPermissionsChannel === "FACEBOOK"
                    ? t("botChannels.meta.permissionsDialog.titleFacebook")
                    : t("botChannels.meta.permissionsDialog.titleInstagram")}
                </h2>
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={closeMetaPermissionsDialog}
                >
                  {t("botChannels.actions.cancel")}
                </button>
              </div>

              <div className="meta-permissions-modal-body">
                <p className="muted">
                  {metaPermissionsChannel === "FACEBOOK"
                    ? t("botChannels.meta.permissionsDialog.introFacebook")
                    : t("botChannels.meta.permissionsDialog.introInstagram")}
                </p>

                <p className="meta-permissions-list-title">
                  {t("botChannels.meta.permissionsDialog.listTitle")}
                </p>

                {metaPermissionsChannel === "FACEBOOK" ? (
                  <ul className="meta-permissions-list">
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.facebook.pagesShowList"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.facebook.pagesMessaging"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.facebook.pagesManageMetadata"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.facebook.businessManagement"
                      )}
                    </li>
                  </ul>
                ) : (
                  <ul className="meta-permissions-list">
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.instagram.pagesShowList"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.instagram.instagramBasic"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.instagram.instagramManageMessages"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.instagram.pagesManageMetadata"
                      )}
                    </li>
                    <li>
                      {t(
                        "botChannels.meta.permissionsDialog.instagram.businessManagement"
                      )}
                    </li>
                  </ul>
                )}

                <label className="checkbox-inline mt-3">
                  <input
                    type="checkbox"
                    checked={metaPermissionsAccepted}
                    onChange={(e) =>
                      setMetaPermissionsAccepted(e.target.checked)
                    }
                  />
                  <span>
                    {t("botChannels.meta.permissionsDialog.checkboxLabel")}
                  </span>
                </label>

                <p className="muted small mt-2">
                  {t("botChannels.meta.permissionsDialog.footerNote")}
                </p>
              </div>

              <div className="meta-permissions-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeMetaPermissionsDialog}
                >
                  {t("botChannels.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    !metaPermissionsAccepted || metaPermissionsSubmitting
                  }
                  onClick={handleConfirmMetaPermissions}
                >
                  {metaPermissionsChannel === "FACEBOOK"
                    ? t(
                        "botChannels.meta.permissionsDialog.continueFacebook"
                      )
                    : t(
                        "botChannels.meta.permissionsDialog.continueInstagram"
                      )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Meta session page selection modal */}
        {metaSession && metaSelectModalOpen && (
          <div className="meta-page-select-modal-backdrop">
            <div className="meta-page-select-modal">
              <div className="meta-page-select-modal-header">
                <h2>
                  {metaSession.channelType === "FACEBOOK"
                    ? t("botChannels.meta.selectModal.titleFacebook")
                    : t("botChannels.meta.selectModal.titleInstagram")}
                </h2>
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={closeMetaSelectModal}
                >
                  {t("botChannels.actions.cancel")}
                </button>
              </div>

              <div className="meta-page-select-modal-body">
                <p className="muted">
                  {metaSession.channelType === "FACEBOOK"
                    ? t("botChannels.meta.selectModal.introFacebook")
                    : t("botChannels.meta.selectModal.introInstagram")}
                </p>

                {metaSessionLoading && (
                  <p className="muted">
                    {t("botChannels.meta.loadingPages")}
                  </p>
                )}
                {metaSessionError && (
                  <div className="form-error">
                    {t("botChannels.meta.sessionLoadFailed")}:{" "}
                    {metaSessionError}
                  </div>
                )}

                {!metaSessionLoading &&
                  !metaSessionError &&
                  (() => {
                    const eligiblePages = metaSession.pages.filter((p) =>
                      metaSession.channelType === "INSTAGRAM"
                        ? !!p.instagramBusinessId
                        : true
                    );

                    const personalPages = eligiblePages.filter(
                      (p) => !p.isBusinessManaged
                    );
                    const businessPages = eligiblePages.filter(
                      (p) => p.isBusinessManaged
                    );

                    const hasAnyPages =
                      metaSession.pages && metaSession.pages.length > 0;
                    const isWeirdInstagramState =
                      metaSession.channelType === "INSTAGRAM" &&
                      hasAnyPages &&
                      eligiblePages.length === 0;

                    if (eligiblePages.length === 0) {
                      return (
                        <>
                          <p className="muted">
                            {t("botChannels.meta.selectModal.noPages")}
                          </p>

                          {isWeirdInstagramState && (
                            <p className="muted small mt-2">
                              {t(
                                "botChannels.meta.selectModal.editPreviousSettingsHint"
                              )}
                            </p>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        {personalPages.length > 0 && (
                          <>
                            <p className="meta-page-select-group-title">
                              {t(
                                "botChannels.meta.selectModal.personalGroupTitle"
                              )}
                            </p>
                            <div className="meta-page-select-list">
                              {personalPages.map((p) => (
                                <label
                                  key={p.id}
                                  className={
                                    "meta-page-select-item" +
                                    (metaSelectedPageId === p.id
                                      ? " selected"
                                      : "")
                                  }
                                >
                                  <input
                                    type="radio"
                                    name="meta-page-select"
                                    value={p.id}
                                    checked={metaSelectedPageId === p.id}
                                    onChange={() =>
                                      setMetaSelectedPageId(p.id)
                                    }
                                  />
                                  <span className="meta-page-select-name">
                                    {p.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </>
                        )}

                        {businessPages.length > 0 && (
                          <>
                            <p className="meta-page-select-group-title">
                              {t(
                                "botChannels.meta.selectModal.businessGroupTitle"
                              )}
                            </p>
                            <div className="meta-page-select-list">
                              {businessPages.map((p) => (
                                <label
                                  key={p.id}
                                  className={
                                    "meta-page-select-item" +
                                    (metaSelectedPageId === p.id
                                      ? " selected"
                                      : "")
                                  }
                                >
                                  <input
                                    type="radio"
                                    name="meta-page-select"
                                    value={p.id}
                                    checked={metaSelectedPageId === p.id}
                                    onChange={() =>
                                      setMetaSelectedPageId(p.id)
                                    }
                                  />
                                  <span className="meta-page-select-name">
                                    {p.name}
                                    {p.businessName
                                      ? ` (${p.businessName})`
                                      : ""}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
              </div>

              <div className="meta-page-select-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeMetaSelectModal}
                >
                  {t("botChannels.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!metaSelectedPageId || metaAttachLoading}
                  onClick={handleAttachMetaSession}
                >
                  {metaAttachLoading
                    ? t("botChannels.actions.connecting")
                    : t("botChannels.actions.connectSelected")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp PIN + number modal (reuses meta modal styles) */}
        {waSession && (
          <div className="meta-page-select-modal-backdrop">
            <div className="meta-page-select-modal">
              <div className="meta-page-select-modal-header">
                <h2>
                  {t("botChannels.whatsapp.pinModal.title")}
                </h2>
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={() => {
                    setWaSession(null);
                    setWaSelectedNumberId("");
                    setWaRegistrationPin("");
                  }}
                >
                  {t("botChannels.actions.cancel")}
                </button>
              </div>

              <div className="meta-page-select-modal-body">
                <p className="muted">
                  {t("botChannels.whatsapp.pinModal.intro")}
                </p>

                <p className="muted small mt-2">
                  {t("botChannels.whatsapp.pinModal.whatIsPin")}
                </p>

                <ol className="muted small mt-3">
                  <li>
                    {t("botChannels.whatsapp.pinModal.step1")}
                  </li>
                  <li>
                    {t("botChannels.whatsapp.pinModal.step2")}
                  </li>
                  <li>
                    {t("botChannels.whatsapp.pinModal.step3")}
                  </li>
                  <li>
                    {t("botChannels.whatsapp.pinModal.step4")}
                  </li>
                </ol>

                <label className="form-field mt-4">
                  <span>{t("botChannels.whatsapp.numberLabel")}</span>
                  <select
                    value={waSelectedNumberId}
                    onChange={(e) => setWaSelectedNumberId(e.target.value)}
                  >
                    <option value="">
                      {t("botChannels.whatsapp.selectPlaceholder")}
                    </option>
                    {waSession.numbers.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.displayPhoneNumber || n.id}
                        {n.verifiedName ? ` – ${n.verifiedName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>
                    {t("botChannels.whatsapp.pinLabel")}
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    value={waRegistrationPin}
                    onChange={(e) =>
                      setWaRegistrationPin(
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder={t("botChannels.whatsapp.pinPlaceholder")}
                  />
                  <p className="muted small mt-1">
                    {t("botChannels.whatsapp.pinModal.pinHint")}
                  </p>
                </label>
              </div>

              <div className="meta-page-select-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setWaSession(null);
                    setWaSelectedNumberId("");
                    setWaRegistrationPin("");
                  }}
                >
                  {t("botChannels.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    !waSelectedNumberId ||
                    !isValidWaPin ||
                    waAttachLoading
                  }
                  onClick={handleAttachWhatsappSession}
                >
                  {waAttachLoading
                    ? t("botChannels.actions.connecting")
                    : t("botChannels.actions.connectSelected")}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <h1 className="page-title">
              {t("botChannels.connectSocial.title")}
            </h1>
            <p className="page-subtitle">
              {t("botChannels.connectSocial.subtitle")}
            </p>
          </div>
        </div>
        <div className="page-header-actions">
          <Link to={`/app/bots/${id}`} className="btn-secondary">
            {t("botChannels.backToBot")}
          </Link>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading && <p>{t("botChannels.loading")}</p>}

      {/* Meta + WhatsApp connect cards */}
      {!loading && (
        <section className="detail-main">
          <div>
            <h2 className="page-title text-lg">
              {t("botChannels.sections.available.title")}
            </h2>
            <p className="page-subtitle">
              {t("botChannels.sections.available.subtitle")}
            </p>
          </div>

          <div className="channel-cards md:grid-cols-2 lg:grid-cols-2">
            {/* Facebook card */}
            <article className="channel-card transition hover:border-primary/30 hover:shadow-md focus-within:border-primary/40">
              <div className="channel-card-header">
                <div className="channel-card-main">
                  <div className="channel-card-icon channel-card-icon-facebook">
                    f
                  </div>
                  <div>
                    <h3 className="channel-card-title">
                      {t("botChannels.labels.facebookPage")}
                    </h3>
                    <p className="channel-card-description">
                      {t("botChannels.connectSocial.facebookDesc")}
                    </p>
                  </div>
                </div>
                {renderChannelStatusBadge(facebookChannel)}
              </div>

              {facebookChannel && (
                <p className="channel-card-meta">
                  {t("botChannels.connectSocial.connectedPage")}:{" "}
                  <strong>
                    {(facebookChannel.meta as any)?.pageName ||
                      t("botChannels.meta.connectedViaMeta")}
                  </strong>
                </p>
              )}

              {!fbStatus.isConnected && (
                <button
                  type="button"
                  className="btn-primary channel-card-button"
                  onClick={() => openMetaPermissionsDialog("FACEBOOK")}
                >
                  {facebookChannel
                    ? t("botChannels.actions.reconnectFacebook")
                    : t("botChannels.actions.connectFacebook")}
                </button>
              )}

              {facebookChannel && (
                <button
                  type="button"
                  className="btn-secondary channel-card-button"
                  onClick={() => handleDelete(facebookChannel.id)}
                >
                  {t("botChannels.actions.disconnect")}
                </button>
              )}
            </article>

            {/* Instagram card */}
            <article className="channel-card transition hover:border-primary/30 hover:shadow-md focus-within:border-primary/40">
              <div className="channel-card-header">
                <div className="channel-card-main">
                  <div className="channel-card-icon channel-card-icon-instagram">
                    ig
                  </div>
                  <div>
                    <h3 className="channel-card-title">
                      {t("botChannels.labels.instagramBusiness")}
                    </h3>
                    <p className="channel-card-description">
                      {t("botChannels.connectSocial.instagramDesc")}
                    </p>
                  </div>
                </div>
                {renderChannelStatusBadge(instagramChannel)}
              </div>

              {instagramChannel && (
                <p className="channel-card-meta">
                  {t("botChannels.connectSocial.connectedAccount")}:{" "}
                  <strong>
                    {(() => {
                      const meta = (instagramChannel.meta as any) || {};
                      return (
                        meta.igUsername ||
                        meta.igName ||
                        meta.pageName ||
                        t("botChannels.meta.connectedViaMeta")
                      );
                    })()}
                  </strong>
                </p>
              )}

              {!igStatus.isConnected && (
                <button
                  type="button"
                  className="btn-primary channel-card-button"
                  onClick={() => openMetaPermissionsDialog("INSTAGRAM")}
                >
                  {instagramChannel
                    ? t("botChannels.actions.reconnectInstagram")
                    : t("botChannels.actions.connectInstagram")}
                </button>
              )}

              {instagramChannel && (
                <button
                  type="button"
                  className="btn-secondary channel-card-button"
                  onClick={() => handleDelete(instagramChannel.id)}
                >
                  {t("botChannels.actions.disconnect")}
                </button>
              )}
            </article>

            {/* WhatsApp card */}
            <article className="channel-card transition hover:border-primary/30 hover:shadow-md focus-within:border-primary/40">
              <div className="channel-card-header">
                <div className="channel-card-main">
                  <div className="channel-card-icon channel-card-icon-whatsapp">
                    wa
                  </div>
                  <div>
                    <h3 className="channel-card-title">
                      {t("botChannels.labels.whatsappBusiness")}
                    </h3>
                    <p className="channel-card-description">
                      {t("botChannels.connectSocial.whatsappDesc")}
                    </p>
                  </div>
                </div>
                {renderChannelStatusBadge(whatsappChannel)}
              </div>

              {whatsappChannel && (
                <p className="channel-card-meta">
                  {t("botChannels.connectSocial.connectedNumber")}:{" "}
                  <strong>
                    {(() => {
                      const meta = (whatsappChannel.meta as any) || {};
                      return (
                        meta.displayPhoneNumber ||
                        meta.display_phone_number ||
                        whatsappChannel.externalId
                      );
                    })()}
                  </strong>
                </p>
              )}

              {!waStatus.isConnected && (
                <button
                  type="button"
                  className="btn-primary channel-card-button"
                  onClick={handleConnectWhatsApp}
                  disabled={waConnecting}
                >
                  {waConnecting
                    ? t("botChannels.actions.connectingWhatsapp")
                    : whatsappChannel
                    ? t("botChannels.actions.reconnectWhatsapp")
                    : t("botChannels.actions.connectWhatsapp")}
                </button>
              )}

              {whatsappChannel && (
                <button
                  type="button"
                  className="btn-secondary channel-card-button"
                  onClick={() => handleDelete(whatsappChannel.id)}
                >
                  {t("botChannels.actions.disconnect")}
                </button>
              )}
            </article>

            {/* Web Widget card */}
            <article className="channel-card transition hover:border-primary/30 hover:shadow-md focus-within:border-primary/40">
              <div className="channel-card-header">
                <div className="channel-card-main">
                  <div className="channel-card-icon bg-primary/10 text-primary">
                    ww
                  </div>
                  <div>
                    <h3 className="channel-card-title">
                      {t("botChannels.webWidget.title")}
                    </h3>
                    <p className="channel-card-description">
                      {t("botChannels.webWidget.description")}
                    </p>
                  </div>
                </div>
                <span className="status-badge status-badge-ok">
                  {t("botChannels.webWidget.statusAvailable")}
                </span>
              </div>

              <p className="channel-card-meta">
                {t("botChannels.webWidget.meta")}
              </p>

              <button
                type="button"
                className="btn-primary channel-card-button"
                onClick={() => {
                  setWebWidgetModalOpen(true);
                  setWebWidgetCopied(false);
                }}
              >
                {t("botChannels.webWidget.cta")}
              </button>
            </article>
          </div>
        </section>
      )}

      {/* Connected channels list */}
      {!loading && (
        <section className="detail-main">
          <div>
            <h2 className="page-title text-lg">
              {t("botChannels.sections.connected.title")}
            </h2>
            <p className="page-subtitle">
              {t("botChannels.sections.connected.subtitle")}
            </p>
          </div>

          {connectedChannels.length === 0 ? (
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground text-sm">
                  &#183;
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("botChannels.connected.emptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("botChannels.connected.emptyHint")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive connected-channels-table-wrapper">
                <table className="table connected-channels-table">
                  <thead>
                    <tr>
                      <th>{connectedChannelLabels.type}</th>
                      <th>{connectedChannelLabels.details}</th>
                      <th>{connectedChannelLabels.status}</th>
                      <th className="connected-channels-actions-header">
                        {connectedChannelLabels.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectedChannels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-muted/40">
                        <td data-label={connectedChannelLabels.type}>
                          <span className="font-semibold text-foreground">
                            {renderChannelTypeLabel(ch.type)}
                          </span>
                        </td>
                        <td data-label={connectedChannelLabels.details}>
                          {renderChannelDetails(ch)}
                        </td>
                        <td data-label={connectedChannelLabels.status}>
                          {renderChannelStatusBadge(ch)}
                        </td>
                        <td
                          className="connected-channels-actions-cell"
                          data-label={connectedChannelLabels.actions}
                        >
                          {editingId === ch.id ? (
                            <>
                              <button
                                className="btn-secondary mr-2"
                                type="button"
                                onClick={() => setEditingId(null)}
                              >
                                {t("botChannels.actions.cancel")}
                              </button>
                            </>
                          ) : (
                            !isMetaChannelType(ch.type) && (
                              <button
                                className="btn-secondary mr-2"
                                type="button"
                                onClick={() => startEdit(ch)}
                              >
                                {t("botChannels.actions.edit")}
                              </button>
                            )
                          )}

                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() => handleDelete(ch.id)}
                          >
                            {t("botChannels.actions.disconnect")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Edit form */}
          {editingId && (
            <div className="card mt-4">
              <h3 className="mt-0">{t("botChannels.edit.title")}</h3>
              <form className="form" onSubmit={handleEditSubmit}>
                <label className="form-field">
                  <span>{t("botChannels.fields.externalId")}</span>
                  <input
                    type="text"
                    value={editForm.externalId}
                    onChange={handleEditChange("externalId")}
                  />
                </label>

                <label className="form-field">
                  <span>{t("botChannels.fields.accessToken")}</span>
                  <input
                    type="text"
                    value={editForm.accessToken}
                    onChange={handleEditChange("accessToken")}
                  />
                </label>

                <label className="form-field">
                  <span>{t("botChannels.fields.metaJson")}</span>
                  <textarea
                    value={editForm.meta}
                    onChange={handleEditChange("meta")}
                    rows={6}
                    placeholder={t("botChannels.placeholders.metaJson")}
                  />
                </label>

                <div className="flex gap-2">
                  <button className="btn-primary" type="submit">
                    {t("botChannels.actions.save")}
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => setEditingId(null)}
                  >
                    {t("botChannels.actions.cancel")}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {webWidgetModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setWebWidgetModalOpen(false);
            setWebWidgetCopied(false);
          }}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-foreground">
                {t("botChannels.webWidget.modalTitle")}
              </h2>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setWebWidgetModalOpen(false);
                  setWebWidgetCopied(false);
                }}
                ref={webWidgetCloseRef}
              >
                {t("botChannels.actions.close")}
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("botChannels.webWidget.modalInstructions")}
              </p>
              <div className="rounded-xl border border-border bg-background/70 p-4 text-xs text-foreground whitespace-pre-wrap font-mono">
                {widgetSnippet}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setWebWidgetModalOpen(false);
                    setWebWidgetCopied(false);
                  }}
                >
                  {t("botChannels.actions.close")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  aria-label="Copy install script"
                  onClick={() => handleCopyWidgetSnippet(widgetSnippet)}
                >
                  {webWidgetCopied
                    ? t("botChannels.webWidget.copied")
                    : t("botChannels.webWidget.copyCta")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotChannels;
