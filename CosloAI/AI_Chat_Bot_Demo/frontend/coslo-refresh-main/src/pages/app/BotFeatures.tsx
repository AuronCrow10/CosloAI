// src/pages/app/BotFeaturesPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bot,
  getBotById,
  KnowledgeSource,
  updateBot
} from "@/api/bots";
import { useTranslation } from "react-i18next";
import SettingsLayout from "@/layouts/SettingsLayout";

type BotFeaturesForm = {
  knowledgeSource: KnowledgeSource;
  useDomainCrawler: boolean;
  usePdfCrawler: boolean;
  channelWeb: boolean;
  channelWhatsapp: boolean;
  channelInstagram: boolean;
  channelMessenger: boolean;
  useCalendar: boolean;
  leadWhatsappMessages200: boolean;
  leadWhatsappMessages500: boolean;
  leadWhatsappMessages1000: boolean;
};

const BotFeatures: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<BotFeaturesForm | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    getBotById(id)
      .then((data) => {
        setBot(data);

        const knowledgeSource: KnowledgeSource =
          data.knowledgeSource || "RAG";
        const initialForm: BotFeaturesForm = {
          knowledgeSource,
          useDomainCrawler:
            knowledgeSource === "SHOPIFY" ? false : true,
          usePdfCrawler:
            knowledgeSource === "SHOPIFY" ? false : true,
          channelWeb: data.channelWeb,
          channelWhatsapp: data.channelWhatsapp,
          channelInstagram: data.channelInstagram,
          channelMessenger: data.channelMessenger,
          useCalendar: data.useCalendar,
          leadWhatsappMessages200: data.leadWhatsappMessages200,
          leadWhatsappMessages500: data.leadWhatsappMessages500,
          leadWhatsappMessages1000: data.leadWhatsappMessages1000
        };

        setForm(initialForm);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botFeatures.errors.loadBot"));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleToggle =
    (field: keyof BotFeaturesForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!form || !bot) return;

      const value = (e.target as HTMLInputElement).checked;
      const updatedForm: BotFeaturesForm = { ...form, [field]: value };
      setForm(updatedForm);
    };

  const handleKnowledgeSourceChange = (nextSource: KnowledgeSource) => {
    if (!form) return;
    let nextUseDomain = form.useDomainCrawler;
    let nextUsePdf = form.usePdfCrawler;
    if (nextSource === "SHOPIFY") {
      nextUseDomain = false;
      nextUsePdf = false;
    } else {
      nextUseDomain = true;
      nextUsePdf = true;
    }
    setForm({
      ...form,
      knowledgeSource: nextSource,
      useDomainCrawler: nextUseDomain,
      usePdfCrawler: nextUsePdf
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bot || !form) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        knowledgeSource: form.knowledgeSource,
        useDomainCrawler: form.useDomainCrawler,
        usePdfCrawler: form.usePdfCrawler,
        channelWeb: form.channelWeb,
        channelWhatsapp: form.channelWhatsapp,
        channelMessenger: form.channelMessenger,
        channelInstagram: form.channelInstagram,
        useCalendar: form.useCalendar,
        leadWhatsappMessages200: form.leadWhatsappMessages200,
        leadWhatsappMessages500: form.leadWhatsappMessages500,
        leadWhatsappMessages1000: form.leadWhatsappMessages1000
      };

      const updated = await updateBot(bot.id, payload);
      setBot(updated);

      setSuccess(t("botFeatures.success.saved"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botFeatures.errors.saveFeatures"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !bot || !form) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>{t("botFeatures.title")}</h1>
        </div>
        <div className="card">
          <p className="muted">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsLayout
      header={
        <div className="page-header">
          <div>
            <h1>{t("botFeatures.title")}</h1>
          </div>

          <div className="page-header-actions">
            <Link
              className="btn-secondary"
              to={`/app/bots/${encodeURIComponent(bot.id)}`}
            >
              {t("botFeatures.actions.backToBot")}
            </Link>
          </div>
        </div>
      }
      main={
        <>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h2 className="settings-card-title">{t("botFeatures.title")}</h2>
                <p className="settings-card-subtitle">
                  {t("botFeatures.subtitle", { name: bot.name || "" })}
                </p>
              </div>
            </div>

            <form className="form settings-form" onSubmit={handleSave}>
              <fieldset className="form-fieldset feature-group">
                <legend>{t("botFeatures.groups.knowledge")}</legend>
                <div className="feature-options">
                  <label
                    className={
                      "feature-option" +
                      (form.knowledgeSource === "RAG"
                        ? " feature-option-checked"
                        : "")
                    }
                  >
                    <input
                      type="radio"
                      name="knowledgeSource"
                      checked={form.knowledgeSource === "RAG"}
                      onChange={() => handleKnowledgeSourceChange("RAG")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.knowledge.source.rag.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.knowledge.source.rag.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={
                      "feature-option" +
                      (form.knowledgeSource === "SHOPIFY"
                        ? " feature-option-checked"
                        : "")
                    }
                  >
                    <input
                      type="radio"
                      name="knowledgeSource"
                      checked={form.knowledgeSource === "SHOPIFY"}
                      onChange={() => handleKnowledgeSourceChange("SHOPIFY")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.knowledge.source.shopify.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.knowledge.source.shopify.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-fieldset feature-group">
                <legend>{t("botFeatures.groups.channels")}</legend>
                <div className="feature-options">
                  <label
                    className={
                      "feature-option" +
                      (form.channelWeb ? " feature-option-checked" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.channelWeb}
                      onChange={handleToggle("channelWeb")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.channels.web.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.channels.web.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={
                      "feature-option" +
                      (form.channelWhatsapp ? " feature-option-checked" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.channelWhatsapp}
                      onChange={handleToggle("channelWhatsapp")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.channels.whatsapp.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.channels.whatsapp.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={
                      "feature-option" +
                      (form.channelMessenger ? " feature-option-checked" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.channelMessenger}
                      onChange={handleToggle("channelMessenger")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.channels.messenger.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.channels.messenger.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={
                      "feature-option" +
                      (form.channelInstagram ? " feature-option-checked" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.channelInstagram}
                      onChange={handleToggle("channelInstagram")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.channels.instagram.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.channels.instagram.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-fieldset feature-group">
                <legend>{t("botFeatures.groups.calendar")}</legend>
                <div className="feature-options">
                  <label
                    className={
                      "feature-option" +
                      (form.useCalendar ? " feature-option-checked" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.useCalendar}
                      onChange={handleToggle("useCalendar")}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.calendar.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.calendar.description")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-fieldset feature-group">
                <legend>{t("botFeatures.groups.leadAds")}</legend>
                <div className="feature-options">
                  <label
                    className={
                      "feature-option" +
                      ((form.leadWhatsappMessages200 ||
                        form.leadWhatsappMessages500 ||
                        form.leadWhatsappMessages1000) &&
                      form.channelWhatsapp
                        ? " feature-option-checked"
                        : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.channelWhatsapp &&
                        (form.leadWhatsappMessages200 ||
                          form.leadWhatsappMessages500 ||
                          form.leadWhatsappMessages1000)
                      }
                      disabled={!form.channelWhatsapp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => {
                          if (!prev || !bot) return prev;

                          let next: BotFeaturesForm;

                          if (!checked) {
                            next = {
                              ...prev,
                              leadWhatsappMessages200: false,
                              leadWhatsappMessages500: false,
                              leadWhatsappMessages1000: false
                            };
                          } else {
                            if (
                              !prev.leadWhatsappMessages200 &&
                              !prev.leadWhatsappMessages500 &&
                              !prev.leadWhatsappMessages1000
                            ) {
                              next = {
                                ...prev,
                                leadWhatsappMessages200: true,
                                leadWhatsappMessages500: false,
                                leadWhatsappMessages1000: false
                              };
                            } else {
                              next = prev;
                            }
                          }

                          return next;
                        });
                      }}
                    />
                    <div className="feature-option-content">
                      <div className="feature-option-header">
                        <div>
                          <div className="feature-option-title">
                            {t("botFeatures.leadAds.whatsapp.title")}
                          </div>
                          <p className="feature-option-description">
                            {t("botFeatures.leadAds.whatsapp.description")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2">
                        <select
                          disabled={
                            !form.channelWhatsapp ||
                            !(
                              form.leadWhatsappMessages200 ||
                              form.leadWhatsappMessages500 ||
                              form.leadWhatsappMessages1000
                            )
                          }
                          value={
                            form.leadWhatsappMessages1000
                              ? "1000"
                              : form.leadWhatsappMessages500
                              ? "500"
                              : form.leadWhatsappMessages200
                              ? "200"
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((prev) => {
                              if (!prev || !bot) return prev;

                              const next: BotFeaturesForm = {
                                ...prev,
                                leadWhatsappMessages200: v === "200",
                                leadWhatsappMessages500: v === "500",
                                leadWhatsappMessages1000: v === "1000"
                              };
                              return next;
                            });
                          }}
                        >
                          <option value="" disabled>
                            {t("botFeatures.leadAds.whatsapp.selectTier")}
                          </option>
                          <option value="200">
                            {t("botFeatures.leadAds.whatsapp.tier200")}
                          </option>
                          <option value="500">
                            {t("botFeatures.leadAds.whatsapp.tier500")}
                          </option>
                          <option value="1000">
                            {t("botFeatures.leadAds.whatsapp.tier1000")}
                          </option>
                        </select>
                      </div>

                      {!form.channelWhatsapp && (
                        <p className="muted mt-2">
                          {t("botFeatures.leadAds.whatsapp.requiresWhatsapp")}
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              </fieldset>

              <div className="settings-form-actions">
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving
                    ? t("botFeatures.actions.saving")
                    : t("botFeatures.actions.save")}
                </button>
              </div>
            </form>
          </div>
        </>
      }
    />
  );
};

export default BotFeatures;
