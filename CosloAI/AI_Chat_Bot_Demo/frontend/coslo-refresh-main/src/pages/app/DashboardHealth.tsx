import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DashboardBotHealthResponse,
  fetchDashboardBotHealth
} from "@/api/dashboard";

const DashboardHealth = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("it")
    ? "it-IT"
    : i18n.resolvedLanguage?.startsWith("es")
    ? "es-ES"
    : i18n.resolvedLanguage?.startsWith("de")
    ? "de-DE"
    : i18n.resolvedLanguage?.startsWith("fr")
    ? "fr-FR"
    : "en-GB";

  const [data, setData] = useState<DashboardBotHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDashboardBotHealth()
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err: any) => {
        console.error("Failed to load bot health", err);
        if (mounted)
          setError(err?.message || t("dashboard.health.errors.loadFailed"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    return [...data.items].sort((a, b) => b.healthScore - a.healthScore);
  }, [data]);

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t("dashboard.health.title")}
          </h1>
          <p className="page-subtitle">
            {t("dashboard.health.subtitle")}
          </p>
        </div>

        <Link to="/app/dashboard" className="btn-secondary">
          {t("dashboard.health.back")}
        </Link>
      </div>

      {loading && (
        <div className="card">
          <p>{t("dashboard.loading")}</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="dashboard-health-grid">
          {sortedItems.length === 0 ? (
            <div className="card">
              <p className="card-empty">
                {t("dashboard.health.empty")}
              </p>
            </div>
          ) : (
            sortedItems.map((bot) => (
              <div key={bot.botId} className="card dashboard-health-card">
                <div className="dashboard-health-header">
                  <div>
                    <h2 className="dashboard-health-title">{bot.botName}</h2>
                    <p className="dashboard-health-subtitle">
                      {t("dashboard.health.status")}:{" "}
                      <strong>{bot.status}</strong>
                    </p>
                  </div>
                  <div
                    className={
                      "dashboard-health-score" +
                      (bot.healthScore >= 75
                        ? " dashboard-health-score--good"
                        : bot.healthScore >= 50
                        ? " dashboard-health-score--ok"
                        : " dashboard-health-score--poor")
                    }
                  >
                    {bot.healthScore}
                  </div>
                </div>

                <div className="dashboard-health-meta">
                  <span>
                    {t("dashboard.health.lastConversation")}:{" "}
                    {bot.lastConversationAt
                      ? new Date(bot.lastConversationAt).toLocaleString(locale)
                      : "-"}
                  </span>
                  <span>
                    {t("dashboard.health.conversationsLast30")}{" "}
                    <strong>{bot.conversationsLast30Days}</strong>
                  </span>
                </div>

                <div className="dashboard-health-badges">
                  <span className={bot.channels.web ? "badge-ok" : "badge"}>
                    {t("dashboard.health.channels.web")}
                  </span>
                  <span className={bot.channels.whatsapp ? "badge-ok" : "badge"}>
                    {t("dashboard.health.channels.whatsapp")}
                  </span>
                  <span className={bot.channels.facebook ? "badge-ok" : "badge"}>
                    {t("dashboard.health.channels.facebook")}
                  </span>
                  <span
                    className={bot.channels.instagram ? "badge-ok" : "badge"}
                  >
                    {t("dashboard.health.channels.instagram")}
                  </span>
                </div>

                <div className="dashboard-health-flags">
                  <span>
                    {t("dashboard.health.knowledge")}:{" "}
                    {bot.knowledgeEnabled
                      ? t("dashboard.health.statusOn")
                      : t("dashboard.health.statusOff")}
                  </span>
                  <span>
                    {t("dashboard.health.bookings")}:{" "}
                    {bot.calendarEnabled
                      ? t("dashboard.health.statusOn")
                      : t("dashboard.health.statusOff")}
                  </span>
                </div>

                <div className="dashboard-health-actions">
                  <Link
                    to={`/app/bots/${bot.botId}`}
                    className="btn-secondary btn-xs"
                  >
                    {t("dashboard.health.viewBot")}
                  </Link>
                  <Link
                    to={`/app/bots/${bot.botId}/settings`}
                    className="btn-secondary btn-xs"
                  >
                    {t("dashboard.health.settings")}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardHealth;
