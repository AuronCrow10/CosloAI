// src/pages/app/ReferrerPortalPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getReferralsMe,
  getReferralsMeStats,
  monthKeyForDateUTC,
  ReferralsMeResponse,
  ReferralsMeStatsResponse
} from "@/api/referrals";

const formatCurrency = (amountCents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amountCents / 100);

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyForDateUTC(d);
}

const Referrals: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = useMemo(() => (
    i18n.resolvedLanguage?.startsWith("it")
      ? "it-IT"
      : i18n.resolvedLanguage?.startsWith("es")
      ? "es-ES"
      : i18n.resolvedLanguage?.startsWith("de")
      ? "de-DE"
      : i18n.resolvedLanguage?.startsWith("fr")
      ? "fr-FR"
      : "en-GB"
  ), [
    i18n.resolvedLanguage
  ]);

  const [monthKey, setMonthKey] = useState<string>(() => monthKeyForDateUTC(new Date()));

  const [me, setMe] = useState<ReferralsMeResponse | null>(null);
  const [stats, setStats] = useState<ReferralsMeStatsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryCode = useMemo(() => {
    const active = me?.codes?.find((c) => c.isActive)?.code;
    return active || me?.codes?.[0]?.code || null;
  }, [me]);

  const referralLink = useMemo(() => {
    if (!primaryCode) return null;
    return `${window.location.origin}/?ref=${encodeURIComponent(primaryCode)}`;
  }, [primaryCode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [meRes, statsRes] = await Promise.all([getReferralsMe(), getReferralsMeStats(monthKey)]);
        if (!mounted) return;
        setMe(meRes);
        setStats(statsRes);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load referrer data.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []); // initial

  useEffect(() => {
    if (!me) return;
    let mounted = true;

    (async () => {
      setLoadingStats(true);
      setError(null);
      try {
        const statsRes = await getReferralsMeStats(monthKey);
        if (!mounted) return;
        setStats(statsRes);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load stats.");
      } finally {
        if (!mounted) return;
        setLoadingStats(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [monthKey, me]);

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1>{t("referrer.title")}</h1>
          <p className="muted">{t("referrer.subtitle")}</p>
        </div>

        <div className="page-header-actions">
          <button className="btn-secondary" type="button" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}>
            ← {t("common.prev")}
          </button>
          <div className="month-pill">{monthKey}</div>
          <button className="btn-secondary" type="button" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}>
            {t("common.next")} →
          </button>
        </div>
      </div>

      {loading && <div className="card"><p>{t("common.loading")}</p></div>}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && me && (
        <>
          <div className="card">
            <h2 className="card-title">{t("referrer.yourCodes")}</h2>

            {me.codes.length === 0 ? (
              <p className="muted">{t("referrer.noCodes")}</p>
            ) : (
              <div className="ref-codes">
                {me.codes.map((c) => (
                  <span key={c.code} className={`badge ${c.isActive ? "badge-ok" : ""}`}>
                    {c.code} {c.isActive ? "• active" : ""}
                  </span>
                ))}
              </div>
            )}

            {referralLink && (
              <>
                <div className="ref-link-row">
                  <input className="ref-link-input" type="text" readOnly value={referralLink} />
                  <button className="btn-secondary" type="button" onClick={handleCopy}>
                    {t("common.copy")}
                  </button>
                </div>
                <p className="muted mt-2">
                  {t("referrer.linkHint")}
                </p>
              </>
            )}
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h2>{t("referrer.statsTitle")}</h2>
              <p className="card-subtitle">{loadingStats ? t("common.loading") : t("referrer.statsSub")}</p>
            </div>

            {stats && (
              <>
                <div className="ref-stats-grid">
                  <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label">{t("referrer.activeClients")}</div>
                    <div className="dashboard-kpi-value">{stats.activeAttributions}</div>
                  </div>

                  <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label">{t("referrer.conversions")}</div>
                    <div className="dashboard-kpi-value">{stats.conversionsThisMonth}</div>
                  </div>

                  <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label">
                      {t("referrer.referredUsers")}
                    </div>
                    <div className="dashboard-kpi-value">{stats.referredUsersTotal}</div>
                  </div>
                </div>

                <hr className="section-separator" />

                <h3 className="m-0">{t("referrer.totalsByCurrency")}</h3>

                {stats.totalsByCurrency.length === 0 ? (
                  <p className="muted mt-2">
                    {t("referrer.noTotals")}
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("common.currency")}</th>
                          <th>{t("referrer.revenue")}</th>
                          <th>{t("referrer.commission")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.totalsByCurrency.map((r) => (
                          <tr key={r.currency}>
                            <td>{r.currency.toUpperCase()}</td>
                            <td>{formatCurrency(r.revenueCents, r.currency, locale)}</td>
                            <td>{formatCurrency(r.commissionCents, r.currency, locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="mt-5">{t("referrer.payoutPeriods")}</h3>
                {stats.payoutPeriods.length === 0 ? (
                  <p className="muted">{t("referrer.noPayouts")}</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("common.currency")}</th>
                          <th>{t("common.amount")}</th>
                          <th>{t("common.status")}</th>
                          <th>{t("common.paidAt")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.payoutPeriods.map((p, idx) => (
                          <tr key={`${p.currency}-${idx}`}>
                            <td>{p.currency.toUpperCase()}</td>
                            <td>{formatCurrency(p.amountCents, p.currency, locale)}</td>
                            <td>{p.status}</td>
                            <td>{p.paidAt ? new Date(p.paidAt).toLocaleString(locale) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="mt-5">
                  {t("referrer.referredUsersList")}
                </h3>
                {stats.referredUsers.length === 0 ? (
                  <p className="muted">
                    {t("referrer.noReferredUsers")}
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("common.email")}</th>
                          <th>{t("referrer.referredAt")}</th>
                          <th>{t("referrer.referralCode")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.referredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.email}</td>
                            <td>{new Date(u.createdAt).toLocaleString(locale)}</td>
                              <td>{u.referralCode ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Referrals;
