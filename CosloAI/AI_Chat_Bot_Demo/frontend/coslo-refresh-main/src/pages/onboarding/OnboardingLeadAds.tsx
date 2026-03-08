// src/pages/onboarding/OnboardingLeadAdsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import OnboardingLayout from "./OnboardingLayout";

import {
  Bot,
  BotChannel,
  getBotById,
  fetchChannels,
  fetchWhatsappTemplates,
  createWhatsappTemplate,
  updateWhatsappTemplate,
  WhatsappTemplate,
  WhatsappTemplateStatus,
  WhatsappTemplateUpsertPayload,
  WhatsappTemplateComponent,
  fetchMetaLeadAutomation,
  upsertMetaLeadAutomation,
  MetaLeadAutomationSettings,
  updateBot
} from "@/api/bots";

/**
 * Template form helpers (copied & trimmed from BotWhatsappTemplatesPage)
 */

interface TemplateFormButton {
  id: string;
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

interface TemplateFormState {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  headerEnabled: boolean;
  headerText: string;
  bodyText: string;
  footerEnabled: boolean;
  footerText: string;
  buttons: TemplateFormButton[];
}

const DEFAULT_FORM_STATE: TemplateFormState = {
  name: "",
  language: "en_US",
  category: "UTILITY",
  headerEnabled: false,
  headerText: "",
  bodyText: "",
  footerEnabled: false,
  footerText: "",
  buttons: []
};

function toStatusClass(status: WhatsappTemplateStatus) {
  switch (status) {
    case "APPROVED":
      return "status-badge status-badge-ok";
    case "PENDING":
      return "status-badge status-badge-warn";
    case "REJECTED":
      return "status-badge status-badge-error";
    default:
      return "status-badge";
  }
}

function buildComponentsFromForm(
  form: TemplateFormState
): WhatsappTemplateComponent[] {
  const components: WhatsappTemplateComponent[] = [];

  if (form.headerEnabled && form.headerText.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: form.headerText.trim(),
      example: form.headerText.includes("{{")
        ? {
            header_text: ["Example header"]
          }
        : undefined
    });
  }

  if (form.bodyText.trim()) {
    const bodyText = form.bodyText.trim();
    const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
    components.push({
      type: "BODY",
      text: bodyText,
      example:
        matches.length > 0
          ? {
              body_text: matches.map((_, idx) => `Example ${idx + 1}`)
            }
          : undefined
    });
  }

  if (form.footerEnabled && form.footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: form.footerText.trim()
    });
  }

  const buttons = form.buttons
    .filter((b) => b.text.trim())
    .map((b) => ({
      type: b.type,
      text: b.text.trim(),
      url: b.type === "URL" ? b.url : undefined,
      phone_number: b.type === "PHONE_NUMBER" ? b.phone_number : undefined
    }));

  if (buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons
    });
  }

  return components;
}

function formStateFromTemplate(tpl: WhatsappTemplate): TemplateFormState {
  const header = tpl.components.find((c) => c.type === "HEADER");
  const body = tpl.components.find((c) => c.type === "BODY");
  const footer = tpl.components.find((c) => c.type === "FOOTER");
  const buttonsComp = tpl.components.find((c) => c.type === "BUTTONS");

  return {
    name: tpl.name,
    language: tpl.language as any,
    category: tpl.category as any,
    headerEnabled: !!header,
    headerText: header?.text ?? "",
    bodyText: body?.text ?? "",
    footerEnabled: !!footer,
    footerText: footer?.text ?? "",
    buttons:
      buttonsComp?.buttons?.map((b, idx) => ({
        id: `${tpl.id}-btn-${idx}`,
        type: b.type,
        text: b.text,
        url: b.url,
        phone_number: b.phone_number
      })) ?? []
  };
}

const OnboardingLeadAdsPage: React.FC = () => {
  const { id: botId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Lead Ads -> WhatsApp automation config draft
  const [leadConfigDraft, setLeadConfigDraft] =
    useState<MetaLeadAutomationSettings>({
      phoneFieldName: "phone_number",
      consentFieldName: "whatsapp_opt_in",
      requiresWhatsappOptIn: true,
      templateName: "",
      templateLanguage: ""
    });
  const [leadConfigLoading, setLeadConfigLoading] = useState(false);

  // Whether the Lead Ads feature is ON in onboarding
  const [enabled, setEnabled] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Template selection & editing
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formTemplateId, setFormTemplateId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<TemplateFormState>(DEFAULT_FORM_STATE);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Load bot + channels
  useEffect(() => {
    if (!botId) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [botRes, channelRes] = await Promise.all([
          getBotById(botId!),
          fetchChannels(botId!)
        ]);
        setBot(botRes);
        setChannels(channelRes);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            t("whatsappTemplates.onboarding.errors.loadBotChannels")
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [botId]);

  const whatsappChannel = useMemo(
    () => channels.find((c) => c.type === "WHATSAPP") || null,
    [channels]
  );
  const facebookChannel = useMemo(
    () => channels.find((c) => c.type === "FACEBOOK") || null,
    [channels]
  );

  const isWhatsAppConnected = useMemo(() => {
    if (!whatsappChannel) return false;
    const meta = (whatsappChannel.meta as any) || {};
    return meta.needsReconnect !== true;
  }, [whatsappChannel]);

  const isFacebookConnected = useMemo(() => {
    if (!facebookChannel) return false;
    const meta = (facebookChannel.meta as any) || {};
    return meta.needsReconnect !== true;
  }, [facebookChannel]);

  const isReadyForAutomation = isFacebookConnected && isWhatsAppConnected;

  async function loadTemplates() {
    if (!botId || !isWhatsAppConnected) {
      setTemplates([]);
      return;
    }

    try {
      setTemplatesLoading(true);
      setError(null);
      const res = await fetchWhatsappTemplates(botId, { limit: 50 });
      setTemplates(res.items);
    } catch (err: any) {
      console.error(err);
      setError(
          err?.message ||
            t("whatsappTemplates.onboarding.errors.loadTemplates")
        );
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadAutomation() {
    if (!botId) return;
    try {
      setLeadConfigLoading(true);
      setError(null);
      const cfg = await fetchMetaLeadAutomation(botId);
      if (cfg) {
        setLeadConfigDraft({
          phoneFieldName: cfg.phoneFieldName || "phone_number",
          consentFieldName: cfg.consentFieldName || "whatsapp_opt_in",
          requiresWhatsappOptIn: cfg.requiresWhatsappOptIn,
          templateName: cfg.templateName || "",
          templateLanguage: cfg.templateLanguage || ""
        });
      } else {
        setLeadConfigDraft({
          phoneFieldName: "phone_number",
          consentFieldName: "whatsapp_opt_in",
          requiresWhatsappOptIn: true,
          templateName: "",
          templateLanguage: ""
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Failed to load Lead Ads -> WhatsApp automation."
      );
    } finally {
      setLeadConfigLoading(false);
    }
  }

  // Load automation + templates when WhatsApp connectivity changes
  useEffect(() => {
    if (!botId) return;
    (async () => {
      await loadAutomation();
      await loadTemplates();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, isWhatsAppConnected]);

  const approvedTemplates = useMemo(
    () => templates.filter((tpl) => tpl.status === "APPROVED"),
    [templates]
  );

  // Initial enabled state - based on bot feature flags or having a template in automation
  useEffect(() => {
    if (!bot) return;

    const hasLeadFeature =
      !!bot.leadWhatsappMessages200 ||
      !!bot.leadWhatsappMessages500 ||
      !!bot.leadWhatsappMessages1000;

    const hasAutomationTemplate =
      !!leadConfigDraft.templateName && !!leadConfigDraft.templateLanguage;

    setEnabled(hasLeadFeature || hasAutomationTemplate);
  }, [bot, leadConfigDraft.templateName, leadConfigDraft.templateLanguage]);

  // If channels are not ready, force automation OFF
  useEffect(() => {
    if (!isReadyForAutomation) {
      setEnabled(false);
    }
  }, [isReadyForAutomation]);

  const selectedTemplate = useMemo(
    () =>
      approvedTemplates.find((tpl) => tpl.id === selectedTemplateId) || null,
    [approvedTemplates, selectedTemplateId]
  );

  // Template form helpers
  function handleFormChange<K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K]
  ) {
    setFormState((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function handleNameChange(value: string) {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "");
    handleFormChange("name", sanitized);
  }

  function addButton() {
    setFormState((prev) => ({
      ...prev,
      buttons: [
        ...prev.buttons,
        {
          id: `btn-${Date.now()}-${prev.buttons.length}`,
          type: "QUICK_REPLY",
          text: ""
        }
      ]
    }));
  }

  function updateButton(id: string, patch: Partial<TemplateFormButton>) {
    setFormState((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) =>
        b.id === id ? { ...b, ...patch } : b
      )
    }));
  }

  function removeButton(id: string) {
    setFormState((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((b) => b.id !== id)
    }));
  }

  function openCreate() {
    setFormMode("create");
    setFormTemplateId(null);
    setFormState(DEFAULT_FORM_STATE);
    setIsFormOpen(true);
  }

  function openEdit(tpl: WhatsappTemplate) {
    setFormMode("edit");
    setFormTemplateId(tpl.id);
    setFormState(formStateFromTemplate(tpl));
    setSelectedTemplateId(tpl.id);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  async function handleTemplateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botId) return;
    setFormSubmitting(true);
    setError(null);

    const components = buildComponentsFromForm(formState);
    const payload: WhatsappTemplateUpsertPayload = {
      name: formState.name,
      category: formState.category,
      language: formState.language,
      components
    };

    try {
      if (formMode === "create") {
        await createWhatsappTemplate(botId, payload);
        setFormState(DEFAULT_FORM_STATE);
      } else if (formMode === "edit" && formTemplateId) {
        await updateWhatsappTemplate(botId, formTemplateId, payload);
      }

      await loadTemplates();
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("whatsappTemplates.messages.saveFailed", {
            defaultValue: "Failed to save template."
          })
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  const handleBack = () => {
    if (!botId) return;
    const backPath =
      bot?.knowledgeSource === "RAG"
        ? `/onboarding/bots/${encodeURIComponent(botId)}/booking`
        : `/onboarding/bots/${encodeURIComponent(botId)}/channels`;
    navigate(backPath);
  };

  const handleSelectTemplate = (tpl: WhatsappTemplate) => {
    setSelectedTemplateId(tpl.id);
    setLeadConfigDraft((prev) => ({
      ...prev,
      templateName: tpl.name,
      templateLanguage: tpl.language
    }));
  };

  const validateBeforeNext = (): string | null => {
    if (!enabled) {
      // Automation is off: no validation
      return null;
    }

    if (!isReadyForAutomation) {
      return t("whatsappTemplates.onboarding.errors.channelsNotReady");
    }

    if (!leadConfigDraft.phoneFieldName?.trim()) {
      return t("whatsappTemplates.leadAutomation.errors.missingPhoneField");
    }

    if (
      leadConfigDraft.requiresWhatsappOptIn &&
      !leadConfigDraft.consentFieldName?.trim()
    ) {
      return t("whatsappTemplates.leadAutomation.errors.missingConsentField");
    }

    if (!leadConfigDraft.templateName || !leadConfigDraft.templateLanguage) {
      return t("whatsappTemplates.leadAutomation.errors.missingTemplate");
    }

    return null;
  };

  const persistFeatures = async (enable: boolean) => {
    if (!botId) return;
    await updateBot(botId, {
      // minimal tier on; you can adjust later in features/billing
      leadWhatsappMessages200: enable,
      leadWhatsappMessages500: false,
      leadWhatsappMessages1000: false
    });
  };

  const handleSkip = async () => {
    if (!botId) return;
    setSaving(true);
    setError(null);
    try {
      await persistFeatures(true);
      navigate(`/onboarding/bots/${encodeURIComponent(botId)}/complete`, {
        replace: true
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("whatsappTemplates.onboarding.errors.save")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!botId) return;

    const validationError = validateBeforeNext();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (enabled) {
        const payload: MetaLeadAutomationSettings = {
          phoneFieldName: leadConfigDraft.phoneFieldName || "phone_number",
          consentFieldName: leadConfigDraft.consentFieldName || "",
          requiresWhatsappOptIn: leadConfigDraft.requiresWhatsappOptIn,
          templateName: leadConfigDraft.templateName || "",
          templateLanguage: leadConfigDraft.templateLanguage || ""
        };

        await upsertMetaLeadAutomation(botId, payload);
        await persistFeatures(true);
      } else {
        await persistFeatures(true);
      }

      navigate(`/onboarding/bots/${encodeURIComponent(botId)}/complete`, {
        replace: true
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("whatsappTemplates.onboarding.errors.save")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!botId) {
    return null;
  }

  const includeAssistantBookingStep = bot?.knowledgeSource === "RAG";

  if (loading) {
    return (
      <OnboardingLayout
        currentStep="leadAds"
        botId={botId}
        flow="assistantType"
        includeAssistantBookingStep={includeAssistantBookingStep}
        includeAssistantLeadAdsStep
        title={t("whatsappTemplates.onboarding.title")}
        subtitle={t("whatsappTemplates.onboarding.subtitle")}
        layout="full"
      >
        <p className="muted">{t("common.loading")}</p>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep="leadAds"
      botId={botId}
      flow="assistantType"
      includeAssistantBookingStep={includeAssistantBookingStep}
      includeAssistantLeadAdsStep
      title={t("whatsappTemplates.onboarding.title")}
      subtitle={t("whatsappTemplates.onboarding.subtitle")}
      layout="full"
    >
      <div className="leadads-layout">
        {/* Skip top-right */}
        <div className="onboarding-section-header">
          <div />
          <button
            type="button"
            className="btn-secondary btn-color"
            onClick={handleSkip}
            disabled={saving}
          >
            {t("whatsappTemplates.onboarding.common.skip")}
          </button>
        </div>

        {/* Big orange warning bar */}
        {!isReadyForAutomation && (
          <div className="alert alert-warning leadads-warning">
            <div className="alert-title">
              {t("whatsappTemplates.onboarding.warningTitle")}
            </div>
            <div className="alert-body">
              {!isFacebookConnected &&
                t("whatsappTemplates.onboarding.warningFacebook")}
              {!isFacebookConnected && !isWhatsAppConnected && " "}
              {!isWhatsAppConnected &&
                t("whatsappTemplates.onboarding.warningWhatsapp")}
            </div>
          </div>
        )}

        {error && <div className="form-error onboarding-form-error-txt">{error}</div>}

        {/* Connection status + ON/OFF toggle */}
        <div className="leadads-status-row">
          <div className="leadads-status-main">
            <span className="leadads-status-label">
              {t("whatsappTemplates.onboarding.requirementsTitle")}
            </span>
            <div className="leadads-status-pills">
              <span className="leadads-status-pill">
                <span className="leadads-status-dot leadads-status-dot--fb" />
                {t("common.channels.facebook")} {" "}
                {isFacebookConnected
                  ? t("common.connected")
                  : t("common.notConnected")}
              </span>
              <span className="leadads-status-pill">
                <span className="leadads-status-dot leadads-status-dot--wa" />
                {t("common.channels.whatsapp")} {" "}
                {isWhatsAppConnected
                  ? t("common.connected")
                  : t("common.notConnected")}
              </span>
            </div>
          </div>

          <div className="leadads-toggle">
            <label className="booking-toggle">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!isReadyForAutomation || saving}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="booking-toggle-slider" />
              <span className="booking-toggle-label">
                {enabled
                  ? t("whatsappTemplates.onboarding.toggleOn")
                  : t("whatsappTemplates.onboarding.toggleOff")}
              </span>
            </label>
            {!isReadyForAutomation && (
              <p className="muted small">
                {t("whatsappTemplates.onboarding.toggleDisabledHint")}
              </p>
            )}
            {enabled && isReadyForAutomation && (
              <p className="muted small">
                {t("whatsappTemplates.onboarding.toggleOnHint")}
              </p>
            )}
          </div>
        </div>

        {/* When automation is OFF, just show explanation + nav */}
        {!enabled && (
          <>
            <div className="leadads-disabled-hint">
              <p className="muted">
                {t("whatsappTemplates.onboarding.disabledHint")}
              </p>
            </div>
            <div className="onboarding-form-actions mt-5">
              <button
                className="btn-secondary btn-color"
                type="button"
                onClick={handleBack}
                disabled={saving}
              >
                {t("common.back")}
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={handleNext}
                disabled={saving}
              >
                {saving
                  ? t("common.saving")
                  : t("whatsappTemplates.onboarding.next")}
              </button>
            </div>
          </>
        )}

        {/* When automation is ON, show full config + templates grid */}
        {enabled && (
          <>
            <div className="leadads-grid">
              {/* LEFT: automation + mapping (no separate Save button) */}
              <section className="lead-card">
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="form"
                >
                  <header className="lead-card-header">
                    <div>
                      <h2>
                        {t("whatsappTemplates.leadAutomation.title")}
                      </h2>
                      <p className="lead-card-subtitle">
                        {t("whatsappTemplates.onboarding.automationHint")}
                      </p>
                    </div>
                  </header>

                  {leadConfigLoading ? (
                    <p className="muted">
                      {t("whatsappTemplates.leadAutomation.loading")}
                    </p>
                  ) : (
                    <>
                      <div className="form-grid-2">
                        <div className="form-field">
                          <label>
                            {t("whatsappTemplates.leadAutomation.phoneField")}
                          </label>
                          <input
                            type="text"
                            value={leadConfigDraft.phoneFieldName || ""}
                            onChange={(e) =>
                              setLeadConfigDraft((prev) => ({
                                ...prev,
                                phoneFieldName: e.target.value
                              }))
                            }
                            placeholder={t("whatsappTemplates.leadAutomation.placeholders.phoneField")}
                            required
                          />
                          <div className="muted small">
                            {t("whatsappTemplates.leadAutomation.phoneFieldHelp")}
                          </div>
                        </div>

                        <div className="form-field">
                          <label>
                            {t("whatsappTemplates.leadAutomation.consentField")}
                          </label>
                          <input
                            type="text"
                            value={leadConfigDraft.consentFieldName || ""}
                            onChange={(e) =>
                              setLeadConfigDraft((prev) => ({
                                ...prev,
                                consentFieldName: e.target.value
                              }))
                            }
                            placeholder={t("whatsappTemplates.leadAutomation.placeholders.consentField")}
                          />
                          <div className="muted small">
                            {t("whatsappTemplates.leadAutomation.consentFieldHelp")}
                          </div>
                        </div>
                      </div>

                      <div className="form-field form-field-inline">
                        <label className="booking-toggle">
                          <input
                            type="checkbox"
                            checked={leadConfigDraft.requiresWhatsappOptIn}
                            onChange={(e) =>
                              setLeadConfigDraft((prev) => ({
                                ...prev,
                                requiresWhatsappOptIn: e.target.checked
                              }))
                            }
                          />
                          <span className="booking-toggle-slider" />
                          <span className="booking-toggle-label">
                            {t("whatsappTemplates.leadAutomation.requireOptIn")}
                          </span>
                        </label>
                      </div>

                      <hr />

                      <div className="form-field">
                        <label>
                          {t("whatsappTemplates.leadAutomation.template")}
                        </label>
                        <select
                          value={
                            leadConfigDraft.templateName &&
                            leadConfigDraft.templateLanguage
                              ? `${leadConfigDraft.templateName}:${leadConfigDraft.templateLanguage}`
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            setLeadConfigDraft((prev) => {
                              if (!value) {
                                return {
                                  ...prev,
                                  templateName: "",
                                  templateLanguage: ""
                                };
                              }
                              const [name, lang] = value.split(":");
                              return {
                                ...prev,
                                templateName: name,
                                templateLanguage: lang
                              };
                            });
                          }}
                          disabled={approvedTemplates.length === 0}
                          required
                        >
                          <option value="">
                            {t("whatsappTemplates.leadAutomation.templatePlaceholder")}
                          </option>
                          {approvedTemplates.map((tpl) => (
                            <option
                              key={tpl.id}
                              value={`${tpl.name}:${tpl.language}`}
                            >
                              {tpl.name} ({tpl.language})
                            </option>
                          ))}
                        </select>
                        <div className="muted small">
                          {t("whatsappTemplates.leadAutomation.templateHelp")}
                        </div>
                      </div>

                      {selectedTemplate && (
                        <div className="leadads-template-preview">
                          <p className="muted small">
                            {t("whatsappTemplates.onboarding.previewLabel")}{" "}
                            <strong>
                              {selectedTemplate.name} (
                              {selectedTemplate.language})
                            </strong>
                          </p>
                        </div>
                      )}

                      <p className="muted small">
                        {t("whatsappTemplates.onboarding.autoSaveHint")}
                      </p>
                    </>
                  )}
                </form>
              </section>

              {/* RIGHT: templates list & create/edit */}
              <section className="lead-card">
                <header className="lead-card-header lead-card-header--row">
                  <div>
                    <h2>
                      {t("whatsappTemplates.title")}
                    </h2>
                    {bot && (
                      <p className="lead-card-subtitle">
                        {t("whatsappTemplates.subtitle", {
                          defaultValue:
                            "Choose which template should be used for new leads from {{name}}.",
                          name: bot.name
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={openCreate}
                    disabled={!isWhatsAppConnected}
                  >
                    {t("whatsappTemplates.addTemplate")}
                  </button>
                </header>

                {templatesLoading ? (
                  <p className="muted">
                    {t("whatsappTemplates.loadingTemplates")}
                  </p>
                ) : !isWhatsAppConnected ? (
                  <p className="muted">
                    {t("whatsappTemplates.templates.requireWhatsapp")}
                  </p>
                ) : templates.length === 0 ? (
                  <div className="wa-template-empty">
                    <p className="muted">
                      {t("whatsappTemplates.empty")}
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={openCreate}
                    >
                      {t("whatsappTemplates.emptyCta")}
                    </button>
                  </div>
                ) : (
                  <div className="lead-template-list">
                    {templates.map((tpl) => {
                      const isActive =
                        tpl.name === leadConfigDraft.templateName &&
                        tpl.language === leadConfigDraft.templateLanguage;

                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          className={
                            "lead-template-row" +
                            (isActive ? " lead-template-row--active" : "")
                          }
                          onClick={() => handleSelectTemplate(tpl)}
                        >
                          <div className="lead-template-main">
                            <div className="lead-template-name">
                              {tpl.name}
                              <span className="lead-template-language">
                                {" "}
                                · {tpl.language}
                              </span>
                            </div>
                            <div className="lead-template-meta">
                              <span>{tpl.category}</span>
                            </div>
                          </div>
                          <div className="lead-template-status">
                            <span className={toStatusClass(tpl.status)}>
                              {tpl.status}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary btn-xs btn-color"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(tpl);
                              }}
                              disabled={!isWhatsAppConnected}
                            >
                              {t("whatsappTemplates.actions.edit")}
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Bottom wizard controls */}
            <div className="form-actions mt-5">
              <button
                className="btn-secondary btn-color"
                type="button"
                onClick={handleBack}
                disabled={saving}
              >
                {t("common.back")}
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={handleNext}
                disabled={saving}
              >
                {saving
                  ? t("common.saving")
                  : t("whatsappTemplates.onboarding.next")}
              </button>
            </div>
          </>
        )}

        {/* Modal for create/edit template */}
        {isFormOpen && (
          <div className="wa-template-modal-backdrop">
            <div className="wa-template-modal">
              <div className="wa-template-modal-header">
                <h2>
                  {formMode === "create"
                    ? t("whatsappTemplates.modal.createTitle")
                    : t("whatsappTemplates.modal.editTitle")}
                </h2>
                <button
                  type="button"
                  className="btn-ghost btn-xs"
                  onClick={closeForm}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleTemplateSubmit} className="form">
                <div className="form-grid-2">
                  <div className="form-field">
                    <label>
                      {t("whatsappTemplates.form.name")}
                    </label>
                    <input
                      type="text"
                      value={formState.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={formMode === "edit"}
                      placeholder={t("whatsappTemplates.form.namePlaceholder")}
                      required
                    />
                    <div className="muted small">
                      {t("whatsappTemplates.form.nameHelp")}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>
                      {t("whatsappTemplates.form.language")}
                    </label>
                    <input
                      type="text"
                      value={formState.language}
                      onChange={(e) =>
                        handleFormChange("language", e.target.value)
                      }
                      placeholder={t("whatsappTemplates.form.languagePlaceholder")}
                      required
                    />
                    <div className="muted small">
                      {t("whatsappTemplates.form.languageHelp")}
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>
                      {t("whatsappTemplates.form.category")}
                    </label>
                    <select
                      value={formState.category}
                      onChange={(e) =>
                        handleFormChange(
                          "category",
                          e.target.value as TemplateFormState["category"]
                        )
                      }
                    >
                      <option value="UTILITY">
                        {t("whatsappTemplates.category.utility")}
                      </option>
                      <option value="MARKETING">
                        {t("whatsappTemplates.category.marketing")}
                      </option>
                      <option value="AUTHENTICATION">
                        {t("whatsappTemplates.category.authentication")}
                      </option>
                    </select>
                  </div>
                </div>

                <hr />

                <div className="form-section">
                  <div className="form-field form-field-inline">
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.headerEnabled}
                        onChange={(e) =>
                          handleFormChange("headerEnabled", e.target.checked)
                        }
                      />{" "}
                      {t("whatsappTemplates.form.header")}
                    </label>
                  </div>
                  {formState.headerEnabled && (
                    <div className="form-field">
                      <textarea
                        value={formState.headerText}
                        onChange={(e) =>
                          handleFormChange("headerText", e.target.value)
                        }
                        maxLength={60}
                        placeholder={t("whatsappTemplates.form.headerPlaceholder")}
                      />
                      <div className="muted small">
                        {t("whatsappTemplates.form.headerHelp")}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="form-field">
                    <label>
                      {t("whatsappTemplates.form.body")}
                    </label>
                    <textarea
                      value={formState.bodyText}
                      onChange={(e) =>
                        handleFormChange("bodyText", e.target.value)
                      }
                      rows={5}
                      placeholder={t("whatsappTemplates.form.bodyPlaceholder")}
                      required
                    />
                    <div className="muted small">
                      {t("whatsappTemplates.form.bodyHelp")}
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-field form-field-inline">
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.footerEnabled}
                        onChange={(e) =>
                          handleFormChange("footerEnabled", e.target.checked)
                        }
                      />{" "}
                      {t("whatsappTemplates.form.footer")}
                    </label>
                  </div>
                  {formState.footerEnabled && (
                    <div className="form-field">
                      <textarea
                        value={formState.footerText}
                        onChange={(e) =>
                          handleFormChange("footerText", e.target.value)
                        }
                        maxLength={60}
                        placeholder={t("whatsappTemplates.form.footerPlaceholder")}
                      />
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="form-field">
                    <div className="form-label-row">
                      <label>
                        {t("whatsappTemplates.form.buttons")}
                      </label>
                      <button
                        type="button"
                        className="btn-secondary btn-xs btn-color"
                        onClick={addButton}
                      >
                        {t("whatsappTemplates.form.addButton")}
                      </button>
                    </div>
                    <div className="muted small">
                      {t("whatsappTemplates.form.buttonsHelp")}
                    </div>
                  </div>

                  {formState.buttons.map((btn) => (
                    <div
                      key={btn.id}
                      className="wa-template-button-row form-grid-3"
                    >
                      <div className="form-field">
                        <select
                          value={btn.type}
                          onChange={(e) =>
                            updateButton(btn.id, {
                              type: e.target
                                .value as TemplateFormButton["type"],
                              url:
                                e.target.value === "URL"
                                  ? btn.url
                                  : undefined,
                              phone_number:
                                e.target.value === "PHONE_NUMBER"
                                  ? btn.phone_number
                                  : undefined
                            })
                          }
                        >
                          <option value="QUICK_REPLY">
                            {t("whatsappTemplates.buttons.quickReply")}
                          </option>
                          <option value="URL">
                            {t("whatsappTemplates.buttons.url")}
                          </option>
                          <option value="PHONE_NUMBER">
                            {t("whatsappTemplates.buttons.phone")}
                          </option>
                        </select>
                      </div>
                      <div className="form-field">
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) =>
                            updateButton(btn.id, {
                              text: e.target.value
                            })
                          }
                          placeholder={t("whatsappTemplates.buttons.textPlaceholder")}
                          required
                        />
                      </div>
                      <div className="form-field form-field-inline">
                        {btn.type === "URL" && (
                          <input
                            type="url"
                            value={btn.url || ""}
                            onChange={(e) =>
                              updateButton(btn.id, {
                                url: e.target.value
                              })
                            }
                            placeholder="https://example.com"
                            required
                          />
                        )}
                        {btn.type === "PHONE_NUMBER" && (
                          <input
                            type="tel"
                            value={btn.phone_number || ""}
                            onChange={(e) =>
                              updateButton(btn.id, {
                                phone_number: e.target.value
                              })
                            }
                            placeholder="+1 555 123456"
                            required
                          />
                        )}
                        <button
                          type="button"
                          className="btn-ghost btn-xs"
                          onClick={() => removeButton(btn.id)}
                        >
                          {t("whatsappTemplates.buttons.remove")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={formSubmitting}
                  >
                    {formSubmitting
                      ? t("common.saving")
                      : formMode === "create"
                      ? t("whatsappTemplates.actions.create")
                      : t("whatsappTemplates.actions.update")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingLeadAdsPage;
