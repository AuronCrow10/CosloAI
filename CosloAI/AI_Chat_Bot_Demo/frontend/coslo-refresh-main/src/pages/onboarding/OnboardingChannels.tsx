import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Globe, Loader2, MessageCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingLayout from "./OnboardingLayout";
import {
  Bot,
  BotChannel,
  ChannelType,
  MetaSessionResponse,
  WhatsappConnectSessionResponse,
  attachMetaSession,
  attachWhatsappSession,
  completeWhatsappEmbeddedSignup,
  deleteChannel,
  fetchChannels,
  getBotById,
  getMetaConnectUrl,
  getMetaSession,
  updateBot
} from "@/api/bots";
import { loadFacebookSdk } from "@/utils/facebookSdk";
import { ALWAYS_ON_FEATURES, mapChannelsToFeatureFlags } from "./onboardingFeatureHelpers";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isMetaChannelType(type: ChannelType) {
  return type === "FACEBOOK" || type === "INSTAGRAM";
}

type ChannelBadge = { label: string; tone: string; isConnected: boolean };

const isConnectedChannel = (channel: BotChannel | null): boolean => {
  if (!channel) return false;
  const meta = (channel.meta as any) || {};
  return meta.needsReconnect !== true;
};

const hasLeadAdsConnectedChannels = (items: BotChannel[]): boolean => {
  const facebook = items.find((c) => c.type === "FACEBOOK") || null;
  const whatsapp = items.find((c) => c.type === "WHATSAPP") || null;
  return isConnectedChannel(facebook) && isConnectedChannel(whatsapp);
};

const OnboardingChannelsPage = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metaPermissionsChannel, setMetaPermissionsChannel] = useState<"FACEBOOK" | "INSTAGRAM" | null>(null);
  const [metaPermissionsAccepted, setMetaPermissionsAccepted] = useState(false);
  const [metaPermissionsSubmitting, setMetaPermissionsSubmitting] = useState(false);
  const [metaSession, setMetaSession] = useState<MetaSessionResponse | null>(null);
  const [metaSelectedPageId, setMetaSelectedPageId] = useState("");
  const [metaAttachLoading, setMetaAttachLoading] = useState(false);

  const [waSession, setWaSession] = useState<WhatsappConnectSessionResponse | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waSelectedNumberId, setWaSelectedNumberId] = useState("");
  const [waRegistrationPin, setWaRegistrationPin] = useState("");
  const [waAttachLoading, setWaAttachLoading] = useState(false);

  const [widgetOpen, setWidgetOpen] = useState(false);
  const [widgetCopied, setWidgetCopied] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [botRes, channelsRes] = await Promise.all([getBotById(id), fetchChannels(id)]);
      setBot(botRes);
      setChannels(channelsRes);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("metaSessionId");
    if (!sessionId) return;

    getMetaSession(sessionId)
      .then((session) => {
        setMetaSession(session);
        setMetaSelectedPageId("");
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botChannels.errors.metaSessionLoad"));
      });
  }, [location.search, t]);

  const clearMetaSessionFromUrl = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has("metaSessionId")) return;
    params.delete("metaSessionId");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const channelBadge = (ch: BotChannel | null): ChannelBadge => {
    if (!ch) {
      return {
        label: t("botChannels.status.notConnected"),
        tone: "bg-muted text-muted-foreground",
        isConnected: false
      };
    }
    const meta = (ch.meta as any) || {};
    if (meta.needsReconnect === true) {
      return {
        label: t("botChannels.status.needsReconnect"),
        tone: "bg-warning/10 text-warning-foreground",
        isConnected: false
      };
    }
    return {
      label: t(isMetaChannelType(ch.type) ? "botChannels.status.connected" : "botChannels.status.active"),
      tone: "bg-success/10 text-success",
      isConnected: true
    };
  };

  const facebookChannel = useMemo(() => channels.find((c) => c.type === "FACEBOOK") || null, [channels]);
  const instagramChannel = useMemo(() => channels.find((c) => c.type === "INSTAGRAM") || null, [channels]);
  const whatsappChannel = useMemo(() => channels.find((c) => c.type === "WHATSAPP") || null, [channels]);
  const fbStatus = channelBadge(facebookChannel);
  const igStatus = channelBadge(instagramChannel);
  const waStatus = channelBadge(whatsappChannel);

  const connectMeta = async (channel: "FACEBOOK" | "INSTAGRAM") => {
    if (!id) return;
    setError(null);
    try {
      const returnPath = `/onboarding/bots/${encodeURIComponent(id)}/channels`;
      const { url } = await getMetaConnectUrl(id, channel, returnPath);
      window.location.href = url;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t(channel === "FACEBOOK" ? "botChannels.errors.facebookConnectFailed" : "botChannels.errors.instagramConnectFailed")
      );
    }
  };

  const handleConfirmMetaPermissions = async () => {
    if (!metaPermissionsChannel) return;
    setMetaPermissionsSubmitting(true);
    await connectMeta(metaPermissionsChannel);
    setMetaPermissionsSubmitting(false);
  };

  const handleAttachMeta = async () => {
    if (!metaSession || !metaSelectedPageId) return;
    setMetaAttachLoading(true);
    setError(null);
    try {
      await attachMetaSession(metaSession.id, metaSelectedPageId);
      setMetaSession(null);
      setMetaSelectedPageId("");
      clearMetaSessionFromUrl();
      await loadData();
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

    const appId = (import.meta as any).env.VITE_META_APP_ID || (import.meta as any).env.VITE_FACEBOOK_APP_ID;
    const configId = (import.meta as any).env.VITE_WHATSAPP_EMBEDDED_CONFIG_ID;
    const redirectUri = (import.meta as any).env.VITE_WHATSAPP_EMBEDDED_REDIRECT_URI || `${window.location.origin}${location.pathname}`;

    if (!appId || !configId) {
      setError(t("botChannels.errors.whatsappEnvMissing"));
      setWaConnecting(false);
      return;
    }

    try {
      const last = window.localStorage.getItem("wa_last_connect_ts");
      if (last) {
        const ts = parseInt(last, 10);
        if (Date.now() - ts < SEVEN_DAYS_MS) {
          if (!window.confirm(t("botChannels.whatsapp.confirmReconnectWithinWeek"))) {
            setWaConnecting(false);
            return;
          }
        }
      }

      const FB = await loadFacebookSdk(appId);
      FB.login(
        (response: any) => {
          (async () => {
            if (!response?.authResponse?.code) {
              setError(t("botChannels.errors.whatsappCancelled"));
              setWaConnecting(false);
              return;
            }
            try {
              const session = await completeWhatsappEmbeddedSignup(id, {
                code: response.authResponse.code as string,
                redirectUri
              });
              setWaSession(session);
              setWaSelectedNumberId("");
              setWaRegistrationPin("");
            } catch (err: any) {
              console.error(err);
              setError(err?.message || t("botChannels.errors.whatsappSignupFailed"));
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

      window.localStorage.setItem("wa_last_connect_ts", Date.now().toString());
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.whatsappInitFailed"));
      setWaConnecting(false);
    }
  };

  const handleAttachWhatsapp = async () => {
    if (!waSession || !waSelectedNumberId) return;
    setWaAttachLoading(true);
    setError(null);
    try {
      await attachWhatsappSession(waSession.sessionId, waSelectedNumberId, waRegistrationPin || undefined);
      setWaSession(null);
      setWaSelectedNumberId("");
      setWaRegistrationPin("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.whatsappAttachFailed"));
    } finally {
      setWaAttachLoading(false);
    }
  };

  const disconnectChannel = async (channelId: string) => {
    if (!id) return;
    if (!window.confirm(t("botChannels.confirm.deleteChannel"))) return;
    try {
      await deleteChannel(id, channelId);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.deleteFailed"));
    }
  };

  const botSlug = bot?.slug || id || "";
  const widgetSnippet =
    typeof window !== "undefined" && botSlug
      ? `<script
  src="https://coslo.it/embed.js"
  async
  data-bot-slug="${botSlug}"
  data-bot-icon="https://i.ibb.co/cczVssVz/test.gif"
  data-bot-hints="Need help?|Ask a question|Chat with my assistant|We are here for you"
></script>`
      : "";

  const copyWidgetSnippet = async () => {
    if (!widgetSnippet) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(widgetSnippet);
      } else {
        const tmp = document.createElement("textarea");
        tmp.value = widgetSnippet;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
      }
      setWidgetCopied(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("common.error"));
    }
  };

  const finishOnboarding = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const resolvedBot = bot ?? (await getBotById(id));
      const currentChannels = await fetchChannels(id);
      const flags = mapChannelsToFeatureFlags(currentChannels);
      await updateBot(id, {
        ...ALWAYS_ON_FEATURES,
        channelWhatsapp: flags.channelWhatsapp,
        channelMessenger: flags.channelMessenger,
        channelInstagram: flags.channelInstagram
      });
      if (resolvedBot.knowledgeSource === "RAG") {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/booking`, {
          replace: true
        });
      } else if (hasLeadAdsConnectedChannels(currentChannels)) {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/lead-ads`, {
          replace: true
        });
      } else {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/complete`, {
          replace: true
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const skipChannels = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const resolvedBot = bot ?? (await getBotById(id));
      if (resolvedBot.knowledgeSource === "RAG") {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/booking`, {
          replace: true
        });
      } else if (hasLeadAdsConnectedChannels(channels)) {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/lead-ads`, {
          replace: true
        });
      } else {
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/complete`, {
          replace: true
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botChannels.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!id) return null;
  const isValidWaPin = /^\d{6}$/.test(waRegistrationPin);

  return (
    <OnboardingLayout
      currentStep="channels"
      botId={id}
      flow="assistantType"
      includeAssistantBookingStep={bot?.knowledgeSource === "RAG"}
      includeAssistantLeadAdsStep={hasLeadAdsConnectedChannels(channels)}
      layout="full"
      title={t("botChannels.onboarding.channels.finalTitle")}
      subtitle={t("botChannels.onboarding.channels.finalSubtitle")}
    >
      <div className="space-y-6">
        {error && <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>}

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h3 className="text-base font-semibold text-foreground">{t("botChannels.onboarding.channels.whyTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("botChannels.onboarding.channels.whyBody")}</p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">{t("botChannels.onboarding.channels.how1")}</div>
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">{t("botChannels.onboarding.channels.how2")}</div>
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">{t("botChannels.onboarding.channels.how3")}</div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{t("botChannels.onboarding.channels.meta.title")}</h4>
                <p className="text-sm text-muted-foreground mt-1">{t("botChannels.onboarding.channels.meta.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
              <span>{t("botChannels.labels.facebookPage")}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${fbStatus.tone}`}>{fbStatus.label}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
              <span>{t("botChannels.labels.instagramBusiness")}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${igStatus.tone}`}>{igStatus.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { setMetaPermissionsChannel("FACEBOOK"); setMetaPermissionsAccepted(false); }}>
                {facebookChannel ? t("botChannels.actions.reconnectFacebook") : t("botChannels.actions.connectFacebook")}
              </Button>
              {facebookChannel && <Button size="sm" variant="outline" onClick={() => disconnectChannel(facebookChannel.id)}>{t("botChannels.actions.disconnect")}</Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { setMetaPermissionsChannel("INSTAGRAM"); setMetaPermissionsAccepted(false); }}>
                {instagramChannel ? t("botChannels.actions.reconnectInstagram") : t("botChannels.actions.connectInstagram")}
              </Button>
              {instagramChannel && <Button size="sm" variant="outline" onClick={() => disconnectChannel(instagramChannel.id)}>{t("botChannels.actions.disconnect")}</Button>}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{t("botChannels.onboarding.channels.whatsapp.title")}</h4>
                <p className="text-sm text-muted-foreground mt-1">{t("botChannels.onboarding.channels.whatsapp.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
              <span>{t("botChannels.labels.whatsappBusiness")}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${waStatus.tone}`}>{waStatus.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleConnectWhatsApp} disabled={waConnecting}>
                {waConnecting ? t("botChannels.actions.connectingWhatsapp") : whatsappChannel ? t("botChannels.actions.reconnectWhatsapp") : t("botChannels.actions.connectWhatsapp")}
              </Button>
              {whatsappChannel && <Button size="sm" variant="outline" onClick={() => disconnectChannel(whatsappChannel.id)}>{t("botChannels.actions.disconnect")}</Button>}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{t("botChannels.webWidget.title")}</h4>
                <p className="text-sm text-muted-foreground mt-1">{t("botChannels.webWidget.description")}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-success/10 px-3 py-2 text-sm text-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("botChannels.webWidget.statusAvailable")}
            </div>
            <p className="text-xs text-muted-foreground">{t("botChannels.webWidget.meta")}</p>
            <Button size="sm" onClick={() => { setWidgetCopied(false); setWidgetOpen(true); }}>{t("botChannels.webWidget.cta")}</Button>
          </article>
        </section>

        {loading && <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t("botChannels.loading")}</div>}

        <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          {t("botChannels.onboarding.channels.finalHint")}
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" onClick={() => navigate(`/onboarding/bots/${encodeURIComponent(id)}/knowledge`)} disabled={saving}>
            {t("common.back")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={skipChannels} disabled={saving}>
              {t("botSettings.onboarding.common.skip")}
            </Button>
            <Button onClick={finishOnboarding} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("botChannels.onboarding.channels.finish")}
            </Button>
          </div>
        </div>
      </div>

      {metaPermissionsChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {metaPermissionsChannel === "FACEBOOK" ? t("botChannels.meta.permissionsDialog.titleFacebook") : t("botChannels.meta.permissionsDialog.titleInstagram")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {metaPermissionsChannel === "FACEBOOK" ? t("botChannels.meta.permissionsDialog.introFacebook") : t("botChannels.meta.permissionsDialog.introInstagram")}
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={metaPermissionsAccepted} onChange={(e) => setMetaPermissionsAccepted(e.target.checked)} />
              <span>{t("botChannels.meta.permissionsDialog.checkboxLabel")}</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMetaPermissionsChannel(null)}>{t("botChannels.actions.cancel")}</Button>
              <Button onClick={handleConfirmMetaPermissions} disabled={!metaPermissionsAccepted || metaPermissionsSubmitting}>
                {metaPermissionsSubmitting ? t("botChannels.actions.connecting") : (metaPermissionsChannel === "FACEBOOK" ? t("botChannels.meta.permissionsDialog.continueFacebook") : t("botChannels.meta.permissionsDialog.continueInstagram"))}
              </Button>
            </div>
          </div>
        </div>
      )}

      {metaSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {metaSession.channelType === "FACEBOOK" ? t("botChannels.meta.selectModal.titleFacebook") : t("botChannels.meta.selectModal.titleInstagram")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {metaSession.channelType === "FACEBOOK" ? t("botChannels.meta.selectModal.introFacebook") : t("botChannels.meta.selectModal.introInstagram")}
            </p>
            <div className="mt-4 space-y-2 max-h-72 overflow-auto pr-1">
              {metaSession.pages.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                  <input type="radio" name="meta-page-select" value={p.id} checked={metaSelectedPageId === p.id} onChange={() => setMetaSelectedPageId(p.id)} />
                  <span className="text-foreground">{p.name}{p.businessName ? ` (${p.businessName})` : ""}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setMetaSession(null); setMetaSelectedPageId(""); clearMetaSessionFromUrl(); }}>{t("botChannels.actions.cancel")}</Button>
              <Button onClick={handleAttachMeta} disabled={!metaSelectedPageId || metaAttachLoading}>
                {metaAttachLoading ? t("botChannels.actions.connecting") : t("botChannels.actions.connectSelected")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {waSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">{t("botChannels.whatsapp.pinModal.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("botChannels.whatsapp.pinModal.intro")}</p>
            <label className="mt-4 block text-sm">
              <span className="text-foreground">{t("botChannels.whatsapp.numberLabel")}</span>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={waSelectedNumberId} onChange={(e) => setWaSelectedNumberId(e.target.value)}>
                <option value="">{t("botChannels.whatsapp.selectPlaceholder")}</option>
                {waSession.numbers.map((n) => (
                  <option key={n.id} value={n.id}>{n.displayPhoneNumber || n.id}{n.verifiedName ? ` - ${n.verifiedName}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm">
              <span className="text-foreground">{t("botChannels.whatsapp.pinLabel")}</span>
              <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" type="text" maxLength={6} value={waRegistrationPin} onChange={(e) => setWaRegistrationPin(e.target.value.replace(/\\D/g, ""))} placeholder={t("botChannels.whatsapp.pinPlaceholder")} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setWaSession(null); setWaSelectedNumberId(""); setWaRegistrationPin(""); }}>{t("botChannels.actions.cancel")}</Button>
              <Button onClick={handleAttachWhatsapp} disabled={!waSelectedNumberId || !isValidWaPin || waAttachLoading}>
                {waAttachLoading ? t("botChannels.actions.connecting") : t("botChannels.actions.connectSelected")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {widgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setWidgetOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground">{t("botChannels.webWidget.modalTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("botChannels.webWidget.modalInstructions")}</p>
            <pre className="mt-4 rounded-xl border border-border bg-background/70 p-4 text-xs text-foreground whitespace-pre-wrap font-mono">{widgetSnippet}</pre>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWidgetOpen(false)}>{t("botChannels.actions.close")}</Button>
              <Button onClick={copyWidgetSnippet}>{widgetCopied ? t("botChannels.webWidget.copied") : t("botChannels.webWidget.copyCta")}</Button>
            </div>
          </div>
        </div>
      )}
    </OnboardingLayout>
  );
};

export default OnboardingChannelsPage;
