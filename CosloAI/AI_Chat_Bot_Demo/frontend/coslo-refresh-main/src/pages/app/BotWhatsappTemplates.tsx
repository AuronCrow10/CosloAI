// src/pages/app/BotWhatsappTemplatesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  // Lead Ads / meta leads:
  fetchMetaLeadAutomation,
  upsertMetaLeadAutomation,
  fetchMetaLeads,
  MetaLead,
  MetaLeadAutomationSettings
} from "@/api/bots";

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
    buttons: buttonsComp?.buttons?.map((b, idx) => ({
        id: `${tpl.id}-btn-${idx}`,
        type: b.type,
        text: b.text,
        url: b.url,
        phone_number: b.phone_number
      })) ?? []
  };
}

const BotWhatsappTemplates: React.FC = () => {
  const { t } = useTranslation();
  const { id: botId } = useParams<{ id: string }>();

  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    search: string;
    status: "ALL" | WhatsappTemplateStatus;
    category: "ALL" | "UTILITY" | "MARKETING" | "AUTHENTICATION";
  }>({
    search: "",
    status: "ALL",
    category: "ALL"
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formTemplateId, setFormTemplateId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<TemplateFormState>(DEFAULT_FORM_STATE);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Lead Ads → WhatsApp automation config
  const [leadConfig, setLeadConfig] =
    useState<MetaLeadAutomationSettings | null>(null);
  const [leadConfigDraft, setLeadConfigDraft] =
    useState<MetaLeadAutomationSettings>({
      phoneFieldName: "phone_number",
      consentFieldName: "whatsapp_opt_in",
      requiresWhatsappOptIn: true,
      templateName: "",
      templateLanguage: ""
    });
  const [leadConfigLoading, setLeadConfigLoading] = useState(false);
  const [leadConfigSaving, setLeadConfigSaving] = useState(false);

  // Leads log
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

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

  const hasLeadAdsFeature = useMemo(() => {
    if (!bot) return false;
    return (
      bot.leadWhatsappMessages200 ||
      bot.leadWhatsappMessages500 ||
      bot.leadWhatsappMessages1000
    );
  }, [bot]);

  useEffect(() => {
    if (!botId) return;

    const safeBotId: string = botId;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [botRes, channelRes] = await Promise.all([
          getBotById(safeBotId),
          fetchChannels(safeBotId)
        ]);

        setBot(botRes);
        setChannels(channelRes);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to load bot or channels.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [botId]);

  async function loadTemplates() {
    // Still only load templates when WhatsApp is actually connected
    if (!botId || !isWhatsAppConnected) return;

    try {
      setTemplatesLoading(true);
      setError(null);
      const res = await fetchWhatsappTemplates(botId, { limit: 50 });
      setTemplates(res.items);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load WhatsApp templates.");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadLeadAutomationAndLeads() {
    if (!botId) return;

    try {
      setLeadConfigLoading(true);
      setLeadsLoading(true);
      setError(null);

      const [cfg, leadsRes] = await Promise.all([
        fetchMetaLeadAutomation(botId),
        fetchMetaLeads(botId, { limit: 50 })
      ]);

      if (cfg) {
        setLeadConfig(cfg);
        setLeadConfigDraft({
          phoneFieldName: cfg.phoneFieldName || "phone_number",
          consentFieldName: cfg.consentFieldName || "",
          requiresWhatsappOptIn: cfg.requiresWhatsappOptIn,
          templateName: cfg.templateName || "",
          templateLanguage: cfg.templateLanguage || ""
        });
      } else {
        setLeadConfig(null);
        setLeadConfigDraft({
          phoneFieldName: "phone_number",
          consentFieldName: "whatsapp_opt_in",
          requiresWhatsappOptIn: true,
          templateName: "",
          templateLanguage: ""
        });
      }

      setLeads(leadsRes.items);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "Failed to load lead automation settings or leads."
      );
    } finally {
      setLeadConfigLoading(false);
      setLeadsLoading(false);
    }
  }

  useEffect(() => {
    if (!botId || !hasLeadAdsFeature) return;

    (async () => {
      await loadLeadAutomationAndLeads();
      await loadTemplates();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, hasLeadAdsFeature, isWhatsAppConnected]);

  const approvedTemplates = useMemo(
    () => templates.filter((tpl) => tpl.status === "APPROVED"),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (filters.status !== "ALL" && tpl.status !== filters.status) {
        return false;
      }
      if (filters.category !== "ALL" && tpl.category !== filters.category) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !tpl.name.toLowerCase().includes(q) &&
          !tpl.language.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [templates, filters]);

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
    // Normalise to WhatsApp naming rules (lowercase snake_case)
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
    setSelectedTemplateId(null);
    setSuccess(null);
    setIsFormOpen(true);
  }

  function openEdit(tpl: WhatsappTemplate) {
    setFormMode("edit");
    setFormTemplateId(tpl.id);
    setFormState(formStateFromTemplate(tpl));
    setSelectedTemplateId(tpl.id);
    setSuccess(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botId) return;
    setFormSubmitting(true);
    setError(null);
    setSuccess(null);

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
        setSuccess(
          t("whatsappTemplates.messages.created")
        );
        setFormState(DEFAULT_FORM_STATE);
      } else if (formMode === "edit" && formTemplateId) {
        await updateWhatsappTemplate(botId, formTemplateId, payload);
        setSuccess(
          t("whatsappTemplates.messages.updated")
        );
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

  async function handleSaveLeadAutomation(e: React.FormEvent) {
    e.preventDefault();
    if (!botId) return;
    setLeadConfigSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: MetaLeadAutomationSettings = {
        phoneFieldName: leadConfigDraft.phoneFieldName || "phone_number",
        consentFieldName: leadConfigDraft.consentFieldName || "",
        requiresWhatsappOptIn: leadConfigDraft.requiresWhatsappOptIn,
        templateName: leadConfigDraft.templateName || "",
        templateLanguage: leadConfigDraft.templateLanguage || ""
      };

      const saved = await upsertMetaLeadAutomation(botId, payload);
      setLeadConfig(saved);
      setSuccess(
        t("whatsappTemplates.leadAutomation.saveSuccess")
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("whatsappTemplates.leadAutomation.saveError")
      );
    } finally {
      setLeadConfigSaving(false);
    }
  }

  async function handleRefreshLeads() {
    if (!botId) return;
    try {
      setLeadsLoading(true);
      setError(null);
      const res = await fetchMetaLeads(botId, { limit: 50 });
      setLeads(res.items);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("whatsappTemplates.leads.refreshError")
      );
    } finally {
      setLeadsLoading(false);
    }
  }

  if (!botId) {
    return null;
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>
            {t("whatsappTemplates.titleFallback")}
          </h1>
        </div>
        <div className="card">
          <p className="muted">
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  const showTemplatesUi = hasLeadAdsFeature;
  const warningClass =
    "alert-warning border border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-100";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>
            {t("whatsappTemplates.title")}
          </h1>
          {bot && (
            <p className="muted">
              {t("whatsappTemplates.subtitle", {
                defaultValue: "Lead Ads → WhatsApp automation for {{name}}",
                name: bot.name
              })}
            </p>
          )}
        </div>
        <div className="page-header-actions">
          <Link to={`/app/bots/${botId}`} className="btn-secondary">
                    {t("botChannels.backToBot")}
          </Link>
          {showTemplatesUi && isWhatsAppConnected && (
            <button
              type="button"
              className="btn-primary"
              onClick={openCreate}
            >
              {t("whatsappTemplates.addTemplate")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <div>{success}</div>
        </div>
      )}

      {showTemplatesUi && !isFacebookConnected && (
        <div className={`${warningClass} mb-4`}>
          <strong>
            {t("whatsappTemplates.status.facebookStatus")}
            :{" "}
            {t("whatsappTemplates.status.facebookNotConnected")}
          </strong>{" "}
          {t("whatsappTemplates.facebookNotConnectedBody")}
        </div>
      )}

      {showTemplatesUi && !isWhatsAppConnected && (
        <div className={`${warningClass} mb-2`}>
          <strong>
            {t("whatsappTemplates.status.whatsappStatus")}
            :{" "}
            {t("whatsappTemplates.status.notConnected")}
          </strong>{" "}
          {t("whatsappTemplates.notConnectedBody")}
        </div>
      )}

      {!showTemplatesUi && (
        <div className="card">
          <h2>
            {t("whatsappTemplates.leadFeatureNotEnabledTitle")}
          </h2>
          <p className="muted">
            {t("whatsappTemplates.leadFeatureNotEnabledBody")}
          </p>
          <Link
            to={`/app/bots/${encodeURIComponent(botId)}/features`}
            className="btn-primary"
          >
            {t("whatsappTemplates.leadFeatureGoToFeatures")}
          </Link>
        </div>
      )}

      {showTemplatesUi && (
        <>
          <div className="wa-templates-stack">
            {/* Lead Ads config */}
            <section className="card wa-lead-automation-card">
              <form onSubmit={handleSaveLeadAutomation} className="form">
                <div className="form-header-row">
                  <h2>
                    {t("whatsappTemplates.leadAutomation.title")}
                  </h2>
                </div>

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
                          placeholder={t("whatsappTemplates.placeholders.phoneField")}
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
                          placeholder={t("whatsappTemplates.placeholders.consentField")}
                        />
                        <div className="muted small">
                          {t("whatsappTemplates.leadAutomation.consentFieldHelp")}
                        </div>
                      </div>
                    </div>

                    <div className="form-field form-field-inline">
                      <label>
                        <input
                          type="checkbox"
                          checked={leadConfigDraft.requiresWhatsappOptIn}
                          onChange={(e) =>
                            setLeadConfigDraft((prev) => ({
                              ...prev,
                              requiresWhatsappOptIn: e.target.checked
                            }))
                          }
                        />{" "}
                        {t("whatsappTemplates.leadAutomation.requireOptIn")}
                      </label>
                    </div>

                    <hr />

                    <div className="form-grid-2">
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
                          required
                          disabled={approvedTemplates.length === 0}
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
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={leadConfigSaving}
                      >
                        {leadConfigSaving
                          ? t("common.saving")
                          : t("whatsappTemplates.leadAutomation.save")}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </section>

            {/* Template history */}
            <section className="card wa-template-list-card">
              <div className="card-header-row">
                <h2>
                  {t("whatsappTemplates.history.title")}
                </h2>
                {isWhatsAppConnected && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={openCreate}
                  >
                    {t("whatsappTemplates.addTemplate")}
                  </button>
                )}
              </div>

              <div className="wa-template-filters">
                <div className="form-field">
                  <label>
                    {t("whatsappTemplates.filters.search")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("whatsappTemplates.filters.searchPlaceholder")}
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: e.target.value
                      }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>
                    {t("whatsappTemplates.filters.status")}
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        status: e.target.value as any
                      }))
                    }
                  >
                    <option value="ALL">
                      {t("whatsappTemplates.filters.statusAll")}
                    </option>
                    <option value="APPROVED">
                      {t("whatsappTemplates.filters.statusApproved")}
                    </option>
                    <option value="PENDING">
                      {t("whatsappTemplates.filters.statusPending")}
                    </option>
                    <option value="REJECTED">
                      {t("whatsappTemplates.filters.statusRejected")}
                    </option>
                  </select>
                </div>
                <div className="form-field">
                  <label>
                    {t("whatsappTemplates.filters.category")}
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value as any
                      }))
                    }
                  >
                    <option value="ALL">
                      {t("whatsappTemplates.filters.categoryAll")}
                    </option>
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

              {templatesLoading ? (
                <p className="muted">
                  {t("whatsappTemplates.loadingTemplates")}
                </p>
              ) : !isWhatsAppConnected ? (
                <p className="muted">
                  {t("whatsappTemplates.templates.requireWhatsapp")}
                </p>
              ) : filteredTemplates.length === 0 ? (
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
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>
                          {t("whatsappTemplates.columns.name")}
                        </th>
                        <th>
                          {t("whatsappTemplates.columns.status")}
                        </th>
                        <th>
                          {t("whatsappTemplates.columns.updated")}
                        </th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((tpl) => (
                        <tr
                          key={tpl.id}
                          className={
                            "wa-template-row" +
                            (tpl.id === selectedTemplateId
                              ? " wa-template-row--active"
                              : "")
                          }
                          onClick={() => setSelectedTemplateId(tpl.id)}
                        >
                          <td>
                            <div className="wa-template-name">
                              {tpl.name}
                            </div>
                            <div className="wa-template-meta">
                              <span>{tpl.language}</span>
                              <span> · {tpl.category}</span>
                            </div>
                          </td>
                          <td>
                            <span className={toStatusClass(tpl.status)}>
                              {tpl.status}
                            </span>
                          </td>
                          <td>
                            {tpl.lastUpdatedAt ? (
                              <span className="muted">
                                {new Date(
                                  tpl.lastUpdatedAt
                                ).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="wa-template-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(tpl);
                              }}
                              disabled={!isWhatsAppConnected}
                            >
                              {t("whatsappTemplates.actions.edit")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Leads history */}
            <section className="card wa-leads-card">
              <div className="card-header-row">
                <h2>
                  {t("whatsappTemplates.leads.title")}
                </h2>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleRefreshLeads}
                  disabled={leadsLoading}
                >
                  {leadsLoading
                    ? t("common.loading")
                    : t("whatsappTemplates.leads.refresh")}
                </button>
              </div>

              {leadsLoading ? (
                <p className="muted">
                  {t("whatsappTemplates.leads.loading")}
                </p>
              ) : !isFacebookConnected ? (
                <p className="muted">
                  {t("whatsappTemplates.leads.requireFacebook")}
                </p>
              ) : leads.length === 0 ? (
                <p className="muted">
                  {t("whatsappTemplates.leads.empty")}
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>
                          {t("whatsappTemplates.leads.createdAt")}
                        </th>
                        <th>
                          {t("whatsappTemplates.leads.phone")}
                        </th>
                        <th>
                          {t("whatsappTemplates.leads.messageSent")}
                        </th>
                        <th>
                          {t("whatsappTemplates.leads.status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => {
                        const messageSent = lead.whatsappStatus === "SENT";
                        return (
                          <tr key={lead.id}>
                            <td>
                              <span className="muted">
                                {new Date(
                                  lead.createdAt
                                ).toLocaleString()}
                              </span>
                            </td>
                            <td>{lead.phone || t("common.notAvailable")}</td>
                            <td>
                              {messageSent
                                ? t("common.booleanTrue")
                                : t("common.booleanFalse")}
                            </td>
                            <td>
                              <span className="muted">
                                {lead.whatsappStatus}
                                {lead.whatsappError
                                  ? ` · ${lead.whatsappError}`
                                  : ""}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

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
                <form onSubmit={handleSubmit} className="form">
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>
                        {t("whatsappTemplates.form.name")}
                      </label>
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(e) =>
                          handleNameChange(e.target.value)
                        }
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
                        placeholder={t("whatsappTemplates.placeholders.language")}
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
                            handleFormChange(
                              "headerEnabled",
                              e.target.checked
                            )
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
                            handleFormChange(
                              "headerText",
                              e.target.value
                            )
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
                            handleFormChange(
                              "footerEnabled",
                              e.target.checked
                            )
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
                            handleFormChange(
                              "footerText",
                              e.target.value
                            )
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
                          className="btn-secondary btn-xs"
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
                                type:
                                  e.target.value as TemplateFormButton["type"],
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
                              placeholder={t("whatsappTemplates.placeholders.phoneExample")}
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
        </>
      )}
    </div>
  );
};

export default BotWhatsappTemplates;
