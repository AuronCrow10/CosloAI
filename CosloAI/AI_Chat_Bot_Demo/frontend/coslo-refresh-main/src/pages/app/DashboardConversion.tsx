import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DashboardConversionResponse,
  fetchDashboardConversion
} from "@/api/dashboard";

const RANGE_PRESETS = [7, 14, 30, 60];

const DashboardConversion = () => {
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

  const [rangeDays, setRangeDays] = useState<number>(30);
  const [data, setData] = useState<DashboardConversionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchDashboardConversion(rangeDays)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err: any) => {
        console.error("Failed to load conversion data", err);
        if (mounted)
          setError(err?.message || "Failed to load conversion data.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [rangeDays]);

  const sorted = useMemo(() => {
    if (!data?.perBot) return [];
    return [...data.perBot].sort((a, b) => b.bookings - a.bookings);
  }, [data]);

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t("dashboard.conversion.title")}
          </h1>
          <p className="page-subtitle">
            {t("dashboard.conversion.subtitle")}
          </p>
        </div>

        <Link to="/app/dashboard" className="btn-secondary">
          {t("dashboard.conversion.back")}
        </Link>
      </div>

      <div className="dashboard-range-row">
        <div className="dashboard-range-left">
          <span className="dashboard-range-label">
            {t("dashboard.range.label")}
          </span>
          <div className="dashboard-range-pills">
            {RANGE_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                className={
                  "dashboard-range-pill" +
                  (rangeDays === d ? " dashboard-range-pill--active" : "")
                }
                onClick={() => setRangeDays(d)}
              >
                {t("dashboard.range.last")} {d}{" "}
                {t("dashboard.range.days")}
              </button>
            ))}
          </div>
        </div>
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

      {!loading && !error && data && (
        <>
          <div className="card dashboard-conversion-summary">
            <div className="dashboard-conversion-grid">
              <div>
                <div className="dashboard-conversion-value">
                  {data.totals.conversations.toLocaleString(locale)}
                </div>
                <div className="dashboard-conversion-label">
                  {t("dashboard.conversion.conversations")}
                </div>
              </div>
              <div>
                <div className="dashboard-conversion-value">
                  {data.totals.leads.toLocaleString(locale)}
                </div>
                <div className="dashboard-conversion-label">
                  {t("dashboard.conversion.leads")}
                </div>
                <div className="dashboard-conversion-rate">
                  {data.totals.conversations > 0
                    ? `${data.totals.leadRate.toFixed(1)}%`
                    : "-"}
                </div>
              </div>
              <div>
                <div className="dashboard-conversion-value">
                  {data.totals.bookings.toLocaleString(locale)}
                </div>
                <div className="dashboard-conversion-label">
                  {t("dashboard.conversion.bookings")}
                </div>
                <div className="dashboard-conversion-rate">
                  {data.totals.leads > 0 ||
                  data.totals.conversations > 0 ||
                  data.totals.bookings > 0
                    ? `${data.totals.bookingRate.toFixed(1)}%`
                    : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>{t("dashboard.conversion.perBot")}</h2>
              <p className="card-subtitle">
                {t("dashboard.conversion.perBotSubtitle")}
              </p>
            </div>

            {sorted.length === 0 ? (
              <p className="card-empty">
                {t("dashboard.conversion.empty")}
              </p>
            ) : (
              <div className="dashboard-conversion-table">
                <div className="dashboard-conversion-row dashboard-conversion-row--head">
                  <span>{t("dashboard.conversion.bot")}</span>
                  <span>
                    {t("dashboard.conversion.conversations")}
                  </span>
                  <span>{t("dashboard.conversion.leads")}</span>
                  <span>{t("dashboard.conversion.bookings")}</span>
                  <span>{t("dashboard.conversion.leadRate")}</span>
                  <span>
                    {t("dashboard.conversion.bookingRate")}
                  </span>
                </div>
                {sorted.map((row) => (
                  <div key={row.botId} className="dashboard-conversion-row">
                    <span
                      className="dashboard-conversion-bot"
                      data-label={t("dashboard.conversion.bot")}
                    >
                      {row.botName}
                    </span>
                    <span
                      data-label={t("dashboard.conversion.conversations")}
                    >
                      {row.conversations.toLocaleString(locale)}
                    </span>
                    <span data-label={t("dashboard.conversion.leads")}>
                      {row.leads.toLocaleString(locale)}
                    </span>
                    <span
                      data-label={t("dashboard.conversion.bookings")}
                    >
                      {row.bookings.toLocaleString(locale)}
                    </span>
                    <span
                      data-label={t("dashboard.conversion.leadRate")}
                    >
                      {row.conversations > 0
                        ? `${row.leadRate.toFixed(1)}%`
                        : "-"}
                    </span>
                    <span
                      data-label={t("dashboard.conversion.bookingRate")}
                    >
                      {row.leads > 0 ||
                      row.conversations > 0 ||
                      row.bookings > 0
                        ? `${row.bookingRate.toFixed(1)}%`
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardConversion;
