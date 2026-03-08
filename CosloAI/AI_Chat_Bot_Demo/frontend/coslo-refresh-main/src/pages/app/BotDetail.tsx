import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  BotChannel,
  getBotById,
  updateBot,
  fetchChannels,
  getBotPricingPreview,
  BotPricingPreview,
  MetaLeadAutomationSettings,
  fetchMetaLeadAutomation
} from "@/api/bots";
import { fetchShopifyShops } from "@/api/shopify";
import SettingsLayout from "@/layouts/SettingsLayout";

const BotDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const systemPromptTemplates = useMemo(
    () =>
      [
        {
          key: "minimal",
          label: t("botDetails.systemPromptTemplates.minimal.label"),
          value: t("botDetails.systemPromptTemplates.minimal.value")
        },
        {
          key: "warm",
          label: t("botDetails.systemPromptTemplates.warm.label"),
          value: t("botDetails.systemPromptTemplates.warm.value")
        },
        {
          key: "premium",
          label: t("botDetails.systemPromptTemplates.premium.label"),
          value: t("botDetails.systemPromptTemplates.premium.value")
        }
      ] as const,
    [t]
  );

  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<BotChannel[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSystemPrompt, setSavingSystemPrompt] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSystemPromptFocused, setIsSystemPromptFocused] = useState(false);
  const [systemPromptTemplateKey, setSystemPromptTemplateKey] =
    useState<string>("custom");

  const [form, setForm] = useState<{
    description: string;
    systemPrompt: string;
    autoEvaluateConversations: boolean;
  } | null>(null);

  const [pricing, setPricing] = useState<BotPricingPreview | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameEditRef = useRef<HTMLDivElement | null>(null);

  const [leadAutomation, setLeadAutomation] =
    useState<MetaLeadAutomationSettings | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyLoading, setShopifyLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPricingError(null);

    Promise.all([getBotById(id), fetchChannels(id)])
      .then(([botData, channelData]) => {
        setBot(botData);
        setChannels(channelData || []);
        setForm({
          description: botData.description || "",
          systemPrompt: botData.systemPrompt,
          autoEvaluateConversations: botData.autoEvaluateConversations ?? false
        });

        return Promise.all([
          getBotPricingPreview(botData.id),
          fetchMetaLeadAutomation(botData.id)
        ]);
      })
      .then(([pricingData, leadAutomationData]) => {
        setPricing(pricingData);
        setLeadAutomation(leadAutomationData);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botDetails.errors.loadBot"));
        setPricingError(t("botDetails.errors.loadPricing"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (bot?.name) {
      setNameDraft(bot.name);
    }
  }, [bot?.name]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!bot || (bot.knowledgeSource || "RAG") !== "SHOPIFY") {
      setShopifyConnected(false);
      return;
    }
    setShopifyLoading(true);
    fetchShopifyShops(bot.id)
      .then((resp) => {
        const connected = (resp.items || []).some((s) => s.isActive);
        setShopifyConnected(connected);
      })
      .catch((err) => {
        console.error(err);
        setShopifyConnected(false);
      })
      .finally(() => setShopifyLoading(false));
  }, [bot]);

  useEffect(() => {
    if (!form) return;
    const template = systemPromptTemplates.find(
      (item) => item.value === form.systemPrompt
    );
    setSystemPromptTemplateKey(template?.key ?? "custom");
  }, [form?.systemPrompt, systemPromptTemplates]);

  const handleChange =
    (field: keyof NonNullable<typeof form>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!form) return;
      const value = e.target.value;
      setForm({
        ...form,
        [field]: value
      });
    };

  const handleTemplateSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    if (!form) return;
    const template = systemPromptTemplates.find(
      (item) => item.key === e.target.value
    );
    if (!template) return;
    setSystemPromptTemplateKey(template.key);
    setForm({
      ...form,
      systemPrompt: template.value
    });
  };

  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (!form) return;
    const value = e.target.value;
    const template = systemPromptTemplates.find(
      (item) => item.value === value
    );
    setSystemPromptTemplateKey(template?.key ?? "custom");
    setForm({
      ...form,
      systemPrompt: value
    });
  };

  const handleSaveSystemPrompt = async () => {
    if (!id || !form) return;
    setSavingSystemPrompt(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateBot(id, {
        systemPrompt: form.systemPrompt
      });
      setBot(updated);
      setSuccess(t("botDetails.success.basicsUpdated"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botDetails.errors.updateBot"));
    } finally {
      setSavingSystemPrompt(false);
    }
  };

  const handleStartEditName = () => {
    if (!bot) return;
    setNameDraft(bot.name);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setNameDraft(bot?.name ?? "");
    setIsEditingName(false);
  };

  const handleSaveName = async () => {
    if (!id || !bot) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError(t("botDetails.errors.nameRequired"));
      return;
    }
    if (trimmed === bot.name) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateBot(id, { name: trimmed });
      setBot(updated);
      setSuccess(t("botDetails.success.nameUpdated"));
      setIsEditingName(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botDetails.errors.updateBot"));
    } finally {
      setSavingName(false);
    }
  };

  const handleNameBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    if (savingName || !isEditingName) return;
    const next = e.relatedTarget as Node | null;
    if (next && nameEditRef.current?.contains(next)) {
      return;
    }
    handleSaveName();
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botDetails.missingId")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <p>{t("botDetails.loading")}</p>
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="page-container">
        <h1>{t("botDetails.errorTitle")}</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!bot || !form) {
    return (
      <div className="page-container">
        <h1>{t("botDetails.notFoundTitle")}</h1>
      </div>
    );
  }

  const isActive = bot.status === "ACTIVE";

  const knowledgeSource = bot.knowledgeSource || "RAG";
  const isShopifyAssistant = knowledgeSource === "SHOPIFY";
  const knowledgeEnabled =
    isShopifyAssistant
      ? true
      : bot.useDomainCrawler || bot.usePdfCrawler;
  const knowledgeInitialized =
    isShopifyAssistant
      ? shopifyConnected
      : knowledgeEnabled && !!bot.knowledgeClientId;

  const channelsArray = channels || [];
  const selectedChannels = {
    web: bot.channelWeb,
    whatsapp: bot.channelWhatsapp,
    messenger: bot.channelMessenger,
    instagram: bot.channelInstagram
  };

  const webConfigured = !bot.channelWeb || !!bot.domain;
  const whatsappConfigured =
    !bot.channelWhatsapp ||
    channelsArray.some(
      (c) => c.type === "WHATSAPP" && !!c.externalId?.trim()
    );
  const messengerConfigured =
    !bot.channelMessenger ||
    channelsArray.some(
      (c) => c.type === "FACEBOOK" && !!c.externalId?.trim()
    );
  const instagramConfigured =
    !bot.channelInstagram ||
    channelsArray.some(
      (c) => c.type === "INSTAGRAM" && !!c.externalId?.trim()
    );

  const channelsEnabledCount = Object.values(selectedChannels).filter(Boolean)
    .length;

  const allSelectedChannelsConfigured =
    webConfigured &&
    whatsappConfigured &&
    messengerConfigured &&
    instagramConfigured;

  const missingChannelConfigs: string[] = [];
  if (bot.channelWeb && !webConfigured)
    missingChannelConfigs.push(t("botDetails.channels.missing.webDomain"));
  if (bot.channelWhatsapp && !whatsappConfigured)
    missingChannelConfigs.push(
      t("botDetails.channels.missing.whatsappExternalId")
    );
  if (bot.channelMessenger && !messengerConfigured)
    missingChannelConfigs.push(
      t("botDetails.channels.missing.facebookPageId")
    );
  if (bot.channelInstagram && !instagramConfigured)
    missingChannelConfigs.push(
      t("botDetails.channels.missing.instagramBusinessId")
    );

  const calendarEnabled = bot.useCalendar;
  const calendarConfigured =
    calendarEnabled &&
    !!bot.calendarId &&
    !!bot.timeZone &&
    !!bot.defaultDurationMinutes;

  const revenueAIEnabled = !!bot.revenueAIEnabled;
  const revenueAIConfigured = revenueAIEnabled && shopifyConnected;

  const hasLeadAdsFeature =
    bot.leadWhatsappMessages200 ||
    bot.leadWhatsappMessages500 ||
    bot.leadWhatsappMessages1000;

  const whatsappChannel = channelsArray.find((c) => c.type === "WHATSAPP");
  const facebookChannel = channelsArray.find((c) => c.type === "FACEBOOK");

  const whatsappChannelMeta = (whatsappChannel?.meta as any) || {};
  const facebookChannelMeta = (facebookChannel?.meta as any) || {};

  const whatsappLeadChannelConnected =
    !!whatsappChannel &&
    !!whatsappChannel.externalId?.trim() &&
    whatsappChannelMeta.needsReconnect !== true;

  const facebookLeadChannelConnected =
    !!facebookChannel &&
    !!facebookChannel.externalId?.trim() &&
    facebookChannelMeta.needsReconnect !== true;

  const hasLeadAutomation =
    !!leadAutomation &&
    !!leadAutomation.templateName &&
    !!leadAutomation.templateLanguage;

  const leadAdsEnabled = hasLeadAdsFeature;
  const leadAdsFullyConfigured =
    leadAdsEnabled &&
    whatsappLeadChannelConnected &&
    facebookLeadChannelConnected &&
    hasLeadAutomation;

  const missingLeadAdsBits: string[] = [];
  if (!whatsappLeadChannelConnected) {
    missingLeadAdsBits.push(
      t("botDetails.health.leadAds.missingWhatsapp")
    );
  }
  if (!facebookLeadChannelConnected) {
    missingLeadAdsBits.push(
      t("botDetails.health.leadAds.missingFacebook")
    );
  }
  if (!hasLeadAutomation) {
    missingLeadAdsBits.push(
      t("botDetails.health.leadAds.missingAutomation")
    );
  }

  const badgeClass = (kind: "ok" | "warn" | "error") => {
    if (kind === "ok") return "status-badge status-badge-ok";
    if (kind === "warn") return "status-badge status-badge-warn";
    return "status-badge status-badge-error";
  };

  const getBotStatusBadgeKind = (
    status: Bot["status"]
  ): "ok" | "warn" | "error" => {
    const normalized = status.toUpperCase();
    if (normalized === "ACTIVE") return "ok";
    if (normalized === "DRAFT") return "warn";
    return "error";
  };

  const getStatusPillClass = (status: Bot["status"]) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACTIVE")
      return "plan-summary-status plan-summary-status-ok";
    if (normalized === "DRAFT")
      return "plan-summary-status plan-summary-status-warn";
    if (normalized === "CANCELLED" || normalized === "INACTIVE")
      return "plan-summary-status plan-summary-status-error";
    return "plan-summary-status";
  };

  const statusPillClass = getStatusPillClass(bot.status);

  const enabledChannelNames = [
    bot.channelWeb ? t("botDetails.channels.names.web") : null,
    bot.channelWhatsapp ? t("botDetails.channels.names.whatsapp") : null,
    bot.channelMessenger ? t("botDetails.channels.names.messenger") : null,
    bot.channelInstagram ? t("botDetails.channels.names.instagram") : null
  ].filter(Boolean) as string[];

  const currentSystemTemplateLabel =
    systemPromptTemplates.find((item) => item.key === systemPromptTemplateKey)
      ?.label ?? "Custom";

  const healthLinkClass =
    "font-medium text-indigo-600 underline underline-offset-4 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300";

  return (
    <SettingsLayout
      header={
        <div className="page-header">
          <div className="bot-header">
            <div className="bot-avatar">{bot.name.charAt(0).toUpperCase()}</div>
            <div>
              <div className="bot-title-row">
                {!isEditingName ? (
                  <>
                    <h1 className="bot-title">{bot.name}</h1>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={handleStartEditName}
                      aria-label={t("botDetails.actions.editName")}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                        <path
                          d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="bot-title-edit" ref={nameEditRef}>
                    <input
                      className="bot-title-input"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      ref={nameInputRef}
                      onBlur={handleNameBlur}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveName();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          handleCancelEditName();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button icon-button--primary"
                      onClick={handleSaveName}
                      disabled={savingName}
                      aria-label={t("botDetails.actions.saveName")}
                    >
                      {savingName ? (
                        <span className="icon-button-spinner" aria-hidden="true" />
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                          <path
                            d="M5 12l4 4 10-10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={handleCancelEditName}
                      aria-label={t("botDetails.actions.cancelEditName")}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                        <path
                          d="M6 6l12 12M18 6l-12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <p className="muted">
                {t("botDetails.slugLabel")} <code>{bot.slug}</code>
              </p>
            </div>
          </div>

          <div className="page-header-actions">
            <span className={statusPillClass}>{bot.status}</span>

            <Link to={`/demo/${bot.slug}`} className="btn-secondary" target="_blank">
              {t("botDetails.actions.openDemo")}
            </Link>

            {!isActive && (
              <Link to={`/app/bots/${bot.id}/plan`} className="btn-secondary">
                {t("botDetails.actions.activatePay")}
              </Link>
            )}

          </div>
        </div>
      }
      main={
        <>
          <div className="form settings-form">
            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-success">{success}</div>}

            <div className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">AI Behavior</h2>
                  <p className="settings-card-subtitle text-slate-500 dark:text-slate-400">
                    {currentSystemTemplateLabel}
                  </p>
                </div>
              </div>

              <div className="settings-card-body px-7 py-6">
                <div className="form-field space-y-2">
                  <div className="form-field-label-row">
                    <span>{t("botDetails.systemPromptTemplates.title")}</span>
                  </div>
                  <span className="form-field-hint text-slate-500 dark:text-slate-400">
                    {t("botDetails.systemPromptTemplates.helper", {
                      defaultValue:
                        "Choose the behavior style for this assistant."
                    })}
                  </span>
                  <select
                    onChange={handleTemplateSelect}
                    value={systemPromptTemplateKey}
                    className="w-full rounded-xl border border-slate-200 bg-white/70 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                  >
                    <option value="custom">
                      {t("botDetails.systemPromptTemplates.select")}
                    </option>
                    {systemPromptTemplates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field mt-6 space-y-2">
                  <div className="form-field-label-row">
                    <span className="form-field-label">Advanced</span>
                  </div>
                  <span className="form-field-hint text-slate-500 dark:text-slate-400">
                    Customize tone, boundaries, and response rules.
                  </span>
                  <textarea
                    value={form.systemPrompt}
                    onChange={handleSystemPromptChange}
                    onFocus={() => setIsSystemPromptFocused(true)}
                    onBlur={() => setIsSystemPromptFocused(false)}
                    rows={isSystemPromptFocused ? 8 : 5}
                    placeholder={t("botDetails.basics.systemPromptPlaceholder")}
                    className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                  />
                </div>

                <div className="form-field-actions mt-4 flex justify-end">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={handleSaveSystemPrompt}
                    disabled={savingSystemPrompt}
                  >
                    {savingSystemPrompt
                      ? t("botDetails.actions.saving")
                      : t("botDetails.actions.updateSystemPrompt", {
                          defaultValue: "Update System Prompt"
                        })}
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="settings-card">
            <div className="settings-card-header">
              <h2 className="settings-card-title">
                {t("botDetails.health.title")}
              </h2>
            </div>
            <div className="status-overview grid gap-4">
              <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="status-row-header flex items-center justify-between gap-4">
                  <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                    {t("botDetails.health.botStatusTitle")}
                  </span>
                  <span className={badgeClass(getBotStatusBadgeKind(bot.status))}>{bot.status}</span>
                </div>

                <p className="muted text-slate-500 dark:text-slate-400">
                  {bot.status === "ACTIVE"
                    ? t("botDetails.health.botStatus.active")
                    : bot.status === "DRAFT"
                    ? t("botDetails.health.botStatus.draft")
                    : t("botDetails.health.botStatus.inactive")}
                </p>
              </div>

              <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="status-row-header flex items-center justify-between gap-4">
                  <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                    {t("botDetails.health.knowledgeTitle")}
                  </span>
                  {knowledgeEnabled ? (
                    knowledgeInitialized ? (
                      <span className={badgeClass("ok")}>
                        {t("botDetails.health.badges.configured")}
                      </span>
                    ) : (
                      <span className={badgeClass("warn")}>
                        {t("botDetails.health.badges.enabledNotInitialized")}
                      </span>
                    )
                  ) : (
                    <span className={badgeClass("error")}>
                      {t("botDetails.health.badges.disabled")}
                    </span>
                  )}
                </div>

                <p className="muted text-slate-500 dark:text-slate-400">
                  {!knowledgeEnabled ? (
                    t("botDetails.health.knowledge.disabled")
                  ) : !knowledgeInitialized ? (
                    <>
                      {knowledgeSource === "SHOPIFY"
                        ? shopifyLoading
                          ? t("botDetails.health.knowledge.shopifyChecking")
                          : t("botDetails.health.knowledge.shopifyNotConnected")
                        : t("botDetails.health.knowledge.enabledNotInitialized")}{" "}
                      <Link
                        to={
                          knowledgeSource === "SHOPIFY"
                            ? `/app/bots/${bot.id}/shopify`
                            : `/app/bots/${bot.id}/knowledge`
                        }
                        className={healthLinkClass}
                      >
                        {knowledgeSource === "SHOPIFY"
                          ? t("botDetails.health.knowledge.goToShopify")
                          : t("botDetails.health.knowledge.goToKnowledge")}
                      </Link>
                      .
                    </>
                  ) : knowledgeSource === "SHOPIFY" ? (
                    t("botDetails.health.knowledge.shopifyConnected")
                  ) : (
                    t("botDetails.health.knowledge.configured")
                  )}
                </p>
              </div>

              <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="status-row-header flex items-center justify-between gap-4">
                  <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                    {t("botDetails.health.channelsTitle")}
                  </span>
                  {channelsEnabledCount === 0 ? (
                    <span className={badgeClass("warn")}>
                      {t("botDetails.health.badges.noChannelsEnabled")}
                    </span>
                  ) : allSelectedChannelsConfigured ? (
                    <span className={badgeClass("ok")}>
                      {t("botDetails.health.badges.allChannelsConfigured")}
                    </span>
                  ) : (
                    <span className={badgeClass("warn")}>
                      {t("botDetails.health.badges.someChannelsNeedSetup")}
                    </span>
                  )}
                </div>

                <p className="muted text-slate-500 dark:text-slate-400">
                  {channelsEnabledCount === 0 && (
                    <>
                      {t("botDetails.health.channels.none")} {" "}
                      <Link
                        to={`/app/bots/${bot.id}/features`}
                        className={healthLinkClass}
                      >
                        {t("botDetails.nav.featuresPlan")}
                      </Link>{" "}
                      {t("botDetails.health.channels.and")} {" "}
                      <Link
                        to={`/app/bots/${bot.id}/channels`}
                        className={healthLinkClass}
                      >
                        {t("botDetails.health.channels.goToChannels")}
                      </Link>
                      .
                    </>
                  )}

                  {channelsEnabledCount > 0 && allSelectedChannelsConfigured && (
                    <>
                      {t("botDetails.health.channels.enabledList", {
                        channels: enabledChannelNames.join(", ")
                      })}
                    </>
                  )}

                  {channelsEnabledCount > 0 && !allSelectedChannelsConfigured && (
                    <>
                      {t("botDetails.health.channels.missingConfig", {
                        missing: missingChannelConfigs.join(", ")
                      })} {" "}
                      <Link
                        to={`/app/bots/${bot.id}/channels`}
                        className={healthLinkClass}
                      >
                        {t("botDetails.health.channels.goToChannels")}
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>

              <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="status-row-header flex items-center justify-between gap-4">
                  <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                    {t("botDetails.health.leadAdsTitle")}
                  </span>
                  {!leadAdsEnabled ? (
                    <span className={badgeClass("error")}>
                      {t("botDetails.health.badges.disabled")}
                    </span>
                  ) : leadAdsFullyConfigured ? (
                    <span className={badgeClass("ok")}>
                      {t("botDetails.health.badges.configured")}
                    </span>
                  ) : (
                    <span className={badgeClass("warn")}>
                      {t("botDetails.health.badges.enabledNotConfigured")}
                    </span>
                  )}
                </div>

                <p className="muted text-slate-500 dark:text-slate-400">
                  {!leadAdsEnabled ? (
                    <>
                      {t("botDetails.health.leadAds.disabled")}{" "}
                      <Link
                        to={`/app/bots/${bot.id}/channels`}
                        className={healthLinkClass}
                      >
                        {t("botDetails.health.leadAds.goToChannels")}
                      </Link>
                      .
                    </>
                  ) : leadAdsFullyConfigured ? (
                    t("botDetails.health.leadAds.configured")
                  ) : (
                    <>
                      {t("botDetails.health.leadAds.enabledNotConfigured")}{" "}
                      {missingLeadAdsBits.join(", ")}. {" "}
                      <Link
                        to={`/app/bots/${bot.id}/channels`}
                        className={healthLinkClass}
                      >
                        {t("botDetails.health.leadAds.goToChannels")}
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>

              {isShopifyAssistant ? (
                <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="status-row-header flex items-center justify-between gap-4">
                    <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                      {t("botDetails.health.revenueAI.title")}
                    </span>
                    {!revenueAIEnabled ? (
                      <span className={badgeClass("error")}>
                        {t("botDetails.health.badges.disabled")}
                      </span>
                    ) : revenueAIConfigured ? (
                      <span className={badgeClass("ok")}>
                        {t("botDetails.health.badges.configured")}
                      </span>
                    ) : (
                      <span className={badgeClass("warn")}>
                        {t("botDetails.health.badges.enabledNotConfigured")}
                      </span>
                    )}
                  </div>

                  <p className="muted text-slate-500 dark:text-slate-400">
                    {!revenueAIEnabled
                      ? t("botDetails.health.revenueAI.disabled")
                      : revenueAIConfigured
                      ? t("botDetails.health.revenueAI.configured")
                      : t("botDetails.health.revenueAI.missingShopify")}{" "}
                    <Link
                      to={`/app/bots/${bot.id}/revenue-ai`}
                      className={healthLinkClass}
                    >
                      {t("botDetails.health.revenueAI.goToSettings")}
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="status-row rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="status-row-header flex items-center justify-between gap-4">
                    <span className="status-label font-medium text-slate-700 dark:text-slate-200">
                      {t("botDetails.health.calendarTitle")}
                    </span>
                    {!calendarEnabled ? (
                      <span className={badgeClass("error")}>
                        {t("botDetails.health.badges.disabled")}
                      </span>
                    ) : calendarConfigured ? (
                      <span className={badgeClass("ok")}>
                        {t("botDetails.health.badges.configured")}
                      </span>
                    ) : (
                      <span className={badgeClass("warn")}>
                        {t("botDetails.health.badges.enabledNotConfigured")}
                      </span>
                    )}
                  </div>

                  <p className="muted text-slate-500 dark:text-slate-400">
                    {!calendarEnabled ? (
                      t("botDetails.health.calendar.disabled")
                    ) : !calendarConfigured ? (
                      <>
                        {t("botDetails.health.calendar.enabledNotConfigured")}{" "}
                        <Link
                          to={`/app/bots/${bot.id}/settings`}
                          className={healthLinkClass}
                        >
                          {t("botDetails.health.calendar.goToSettings")}
                        </Link>
                        .
                      </>
                    ) : (
                      t("botDetails.health.calendar.configured", {
                        calendarId: bot.calendarId,
                        timeZone: bot.timeZone,
                        duration: bot.defaultDurationMinutes || 30
                      })
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      }
      sidebar={
        <div className="settings-sidebar-card">
          <div className="settings-sidebar-header">
            <div>
              <h3 className="settings-sidebar-title">
                {t("botDetails.workspace.title")}
              </h3>
              <p className="settings-sidebar-subtitle">
                {t("botDetails.workspace.subtitle")}
              </p>
            </div>
            <span className={statusPillClass}>{bot.status}</span>
          </div>

          <div className="settings-sidebar-list">
            <Link to={`/app/bots/${bot.id}/plan`} className="settings-sidebar-item">
              <div className="settings-sidebar-item-main">
                <span className="settings-sidebar-item-title">
                  {t("botDetails.actions.viewPlanBilling")}
                </span>
                <span className="settings-sidebar-item-subtitle">
                  {t("botDetails.nav.planDesc")}
                </span>
              </div>
              <span className="settings-sidebar-item-chevron">&gt;</span>
            </Link>

            {isShopifyAssistant ? (
              <>
                <Link to={`/app/bots/${bot.id}/shopify`} className="settings-sidebar-item">
                  <div className="settings-sidebar-item-main">
                    <span className="settings-sidebar-item-title">
                      {t("botDetails.nav.shopify")}
                    </span>
                    <span className="settings-sidebar-item-subtitle">
                      {t("botDetails.nav.shopifyDesc")}
                    </span>
                  </div>
                  <span className="settings-sidebar-item-chevron">&gt;</span>
                </Link>

                <Link to={`/app/bots/${bot.id}/revenue-ai`} className="settings-sidebar-item">
                  <div className="settings-sidebar-item-main">
                    <span className="settings-sidebar-item-title">
                      {t("shopifyPage.revenueAI.title")}
                    </span>
                    <span className="settings-sidebar-item-subtitle">
                      {t("shopifyPage.revenueAI.subtitle")}
                    </span>
                  </div>
                  <span className="settings-sidebar-item-chevron">&gt;</span>
                </Link>
              </>
            ) : (
              <Link to={`/app/bots/${bot.id}/knowledge`} className="settings-sidebar-item">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botDetails.nav.knowledge")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botDetails.nav.knowledgeDesc")}
                  </span>
                </div>
                <span className="settings-sidebar-item-chevron">&gt;</span>
              </Link>
            )}

            <Link to={`/app/bots/${bot.id}/channels`} className="settings-sidebar-item">
              <div className="settings-sidebar-item-main">
                <span className="settings-sidebar-item-title">
                  {t("botDetails.nav.channels")}
                </span>
                <span className="settings-sidebar-item-subtitle">
                  {t("botDetails.nav.channelsDesc")}
                </span>
              </div>
              <span className="settings-sidebar-item-chevron">&gt;</span>
            </Link>

            <Link
              to={`/app/bots/${bot.id}/conversations`}
              className="settings-sidebar-item"
            >
              <div className="settings-sidebar-item-main">
                <span className="settings-sidebar-item-title">
                  {t("botDetails.nav.conversations")}
                </span>
                <span className="settings-sidebar-item-subtitle">
                  {t("botDetails.nav.conversationsDesc")}
                </span>
              </div>
              <span className="settings-sidebar-item-chevron">&gt;</span>
            </Link>

            {!isShopifyAssistant && (
              <Link to={`/app/bots/${bot.id}/settings`} className="settings-sidebar-item">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botDetails.nav.settings")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botDetails.nav.settingsDesc")}
                  </span>
                </div>
                <span className="settings-sidebar-item-chevron">&gt;</span>
              </Link>
            )}

            <Link
              to={`/app/bots/${bot.id}/whatsapp-templates`}
              className="settings-sidebar-item"
            >
              <div className="settings-sidebar-item-main">
                <span className="settings-sidebar-item-title">
                  {t("botDetails.nav.adsSettings")}
                </span>
                <span className="settings-sidebar-item-subtitle">
                  {t("botDetails.nav.adsSettingsDesc")}
                </span>
              </div>
              <span className="settings-sidebar-item-chevron">&gt;</span>
            </Link>
          </div>
        </div>
      }
    />
  );
};

export default BotDetail;
