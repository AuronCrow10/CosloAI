// src/pages/app/BillingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BillingOverviewResponse,
  PaymentSummary,
  getPaymentInvoiceUrl,
  fetchBillingOverview,
  BotTopUpOptionsResponse,
  fetchTopUpOptions,
  startTopUpCheckout,
  cancelBotSubscription
} from "@/api/billing";

function getLocaleFromLanguage(language: string | undefined): string {
  const code = (language || "en").split("-")[0];
  switch (code) {
    case "it":
      return "it-IT";
    case "es":
      return "es-ES";
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    default:
      return "en-GB";
  }
}

function formatAmount(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(cents / 100);
}

// UI-only token scaling: show tokens/10 to users, keep raw under the hood.
function tokensUi(rawTokens: number): number {
  return Math.round(rawTokens / 10);
}

// Map Stripe status -> badge class using your generic status-badge styles
function subscriptionStatusBadgeClass(status: string): string {
  const base = "status-badge ";
  switch (status) {
    case "ACTIVE":
    case "TRIALING":
      return base + "status-badge-ok";
    case "PAST_DUE":
    case "UNPAID":
    case "INCOMPLETE":
    case "INCOMPLETE_EXPIRED":
      return base + "status-badge-warn";
    case "CANCELED":
    default:
      return base + "status-badge-error";
  }
}

// Usage badge (per bot) - also uses status-badge styles
function usageStatusBadgeClass(usagePercent: number | null): string | null {
  if (usagePercent == null) return null;
  const base = "status-badge ";
  if (usagePercent >= 100) return base + "status-badge-error";
  if (usagePercent >= 90) return base + "status-badge-warn";
  if (usagePercent >= 75) return base + "status-badge-warn";
  return base + "status-badge-ok";
}

const Billing: React.FC = () => {
  const { t, i18n } = useTranslation();

  const locale = useMemo(
    () => getLocaleFromLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage]
  );

  const [data, setData] = useState<BillingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);

  const [topUpState, setTopUpState] = useState<{
    botId: string | null;
    loading: boolean;
    options: BotTopUpOptionsResponse | null;
    selectedCode: string | null;
    checkoutLoading: boolean;
    error: string | null;
  }>({
    botId: null,
    loading: false,
    options: null,
    selectedCode: null,
    checkoutLoading: false,
    error: null
  });

  const subscriptionStatusLabel = (status: string): string => {
    switch (status) {
      case "ACTIVE":
        return t("billing.subscriptionStatus.active");
      case "PAST_DUE":
        return t("billing.subscriptionStatus.pastDue");
      case "CANCELED":
        return t("billing.subscriptionStatus.canceled");
      case "TRIALING":
        return t("billing.subscriptionStatus.trial");
      case "UNPAID":
        return t("billing.subscriptionStatus.unpaid");
      case "INCOMPLETE":
        return t("billing.subscriptionStatus.incomplete");
      case "INCOMPLETE_EXPIRED":
        return t("billing.subscriptionStatus.incompleteExpired");
      default:
        return status;
    }
  };

  const usageStatusLabel = (usagePercent: number | null): string | null => {
    if (usagePercent == null) return null;
    if (usagePercent >= 100) return t("billing.usageStatus.overLimit");
    if (usagePercent >= 90) return t("billing.usageStatus.atLimit");
    if (usagePercent >= 75) return t("billing.usageStatus.highUsage");
    return t("billing.usageStatus.healthyUsage");
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBillingOverview()
      .then((res) => setData(res))
      .catch((err: any) =>
        setError(err?.message || t("billing.errors.loadFailed"))
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadInvoice = async (payment: PaymentSummary) => {
    if (!payment.hasInvoice) return;
    setInvoiceLoadingId(payment.id);
    setError(null);

    try {
      const { url } = await getPaymentInvoiceUrl(payment.id);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setError(t("billing.errors.invoiceUnavailable"));
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || t("billing.errors.invoiceDownloadFailed")
      );
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleCancelSubscription = async (botId: string) => {
    const confirmed = window.confirm(
      t("billing.cancel.confirm", {
        defaultValue:
          "Cancel this subscription at the end of the current billing period?"
      })
    );
    if (!confirmed) return;

    setCancelLoadingId(botId);
    setError(null);
    setSuccess(null);

    try {
      const result = await cancelBotSubscription(botId);
      const periodEndText = result.periodEnd
        ? new Date(result.periodEnd).toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
            day: "numeric"
          })
        : null;

      setSuccess(
        periodEndText
          ? t("billing.cancel.successWithDate", {
              defaultValue:
                "Cancellation scheduled. Your plan stays active until {{date}}.",
              date: periodEndText
            })
          : t("billing.cancel.success", {
              defaultValue:
                "Cancellation scheduled. Your plan stays active until the end of the current billing period."
            })
      );

      const refreshed = await fetchBillingOverview();
      setData(refreshed);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("billing.cancel.error", {
            defaultValue: "Failed to cancel subscription."
          })
      );
    } finally {
      setCancelLoadingId(null);
    }
  };


  const openTopUpModal = async (botId: string) => {
    setTopUpState({
      botId,
      loading: true,
      options: null,
      selectedCode: null,
      checkoutLoading: false,
      error: null
    });

    try {
      const result = await fetchTopUpOptions(botId);
      setTopUpState((prev) => ({
        ...prev,
        loading: false,
        options: result,
          selectedCode: result.options[0]?.code ?? null
      }));
    } catch (err: any) {
      console.error(err);
      setTopUpState((prev) => ({
        ...prev,
        loading: false,
        error:
          err?.message ||
          t("billing.topUp.errors.loadFailed", {
            defaultValue: "Unable to load top-up options."
          })
      }));
    }
  };

  const closeTopUpModal = () => {
    setTopUpState({
      botId: null,
      loading: false,
      options: null,
      selectedCode: null,
      checkoutLoading: false,
      error: null
    });
  };

  const handleTopUpCheckout = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!topUpState.botId || !topUpState.selectedCode) return;

    setTopUpState((prev) => ({
      ...prev,
      checkoutLoading: true,
      error: null
    }));

    try {
      const { checkoutUrl } = await startTopUpCheckout(
        topUpState.botId,
        topUpState.selectedCode
      );
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setTopUpState((prev) => ({
          ...prev,
          checkoutLoading: false,
          error: t("billing.topUp.errors.checkoutMissingUrl", {
            defaultValue: "Unable to start checkout for this top-up."
          })
        }));
      }
    } catch (err: any) {
      console.error(err);
      setTopUpState((prev) => ({
        ...prev,
        checkoutLoading: false,
        error:
          err?.message ||
          t("billing.topUp.errors.checkoutFailed", {
            defaultValue: "Top-up checkout failed. Please try again."
          })
      }));
    }
  };

  // -------------------------
  // Global usage aggregation
  // -------------------------

  // TOKENS (raw totals; UI displays /10)
  const totalUsedTokensRaw =
    data?.subscriptions.reduce(
      (sum, s) => sum + s.usedTokensThisPeriod,
      0
    ) ?? 0;

  const totalLimitTokensRaw =
    data?.subscriptions.reduce(
      (sum, s) => sum + (s.monthlyTokens || 0),
      0
    ) ?? 0;

  const hasAnyTokenLimit = totalLimitTokensRaw > 0;

  const globalTokenUsagePercent = hasAnyTokenLimit
    ? Math.min(
        100,
        Math.round((totalUsedTokensRaw / totalLimitTokensRaw) * 100)
      )
    : null;

  const globalTokenUsageBadgeClass =
    usageStatusBadgeClass(globalTokenUsagePercent);
  const globalTokenUsageBadgeLabel =
    usageStatusLabel(globalTokenUsagePercent);
  const paymentLabels = {
    date: t("billing.paymentHistory.table.date"),
    bot: t("billing.paymentHistory.table.bot"),
    amount: t("billing.paymentHistory.table.amount"),
    status: t("billing.paymentHistory.table.status"),
    period: t("billing.paymentHistory.table.period"),
    actions: t("billing.paymentHistory.table.actions")
  };

  return (
    <div className="billing-page">
      <div className="page-hero billing-hero">
        <div>
          <p className="page-hero-eyebrow">{t("billing.title")}</p>
          <h1 className="page-hero-title">{t("billing.title")}</h1>
          <p className="page-hero-subtitle">{t("billing.subtitle")}</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      {loading && (
        <div className="detail-main mt-4">
          <p>{t("billing.loading")}</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Subscriptions + global usage summary */}
          <section className="app-card billing-summary-card">
            <div className="billing-summary-header">
              <div>
                <h2 className="card-title">{t("billing.activeSubscriptions")}</h2>
                <p className="muted">
                  {t("billing.totalMonthlyAcrossAllBots")}{" "}
                  <strong>
                    {data.totalMonthlyAmountFormatted}
                  </strong>
                </p>
              </div>

              {/* Global usage pills (Tokens) */}
              <div className="billing-summary-usage">
                {/* TOKENS */}
                <div className="billing-summary-usage-top">
                  {globalTokenUsageBadgeClass &&
                    globalTokenUsageBadgeLabel && (
                      <span className={globalTokenUsageBadgeClass}>
                        {globalTokenUsageBadgeLabel}
                      </span>
                    )}
                </div>

                <div className="billing-summary-usage-label">
                  {t("billing.thisMonth")}{" "}
                  <strong>
                    {tokensUi(
                      totalUsedTokensRaw
                    ).toLocaleString(locale)}{" "}
                    {t("billing.tokens")}
                  </strong>
                  {hasAnyTokenLimit && (
                    <>
                      {" "}
                      <span className="muted">
                        {t("billing.of")}
                      </span>{" "}
                      <strong>
                        {tokensUi(
                          totalLimitTokensRaw
                        ).toLocaleString(locale)}
                      </strong>
                    </>
                  )}
                </div>

                {hasAnyTokenLimit &&
                  globalTokenUsagePercent != null && (
                    <div className="billing-summary-usage-bar">
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${globalTokenUsagePercent}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                <p className="muted mt-2 text-xs">
                  {t("billing.tokensHint", {
                    defaultValue:
                      "Tokens include OpenAI, knowledge, emails and WhatsApp templates."
                  })}
                </p>
              </div>
            </div>

            {data.subscriptions.length === 0 && (
              <p className="muted mt-2">
                {t("billing.noActiveSubscriptions")}
              </p>
            )}

            {data.subscriptions.length > 0 && (
              <div className="billing-subscriptions">
                {data.subscriptions.map((sub) => {
                  const currency = sub.currency || "eur";

                  // TOKENS
                  const tokenUsagePercent =
                    sub.usagePercent != null
                      ? sub.usagePercent
                      : null;
                  const hasTokenLimit =
                    sub.monthlyTokens != null &&
                    sub.monthlyTokens > 0;

                  const isPaidPlan = sub.planAmountCents > 0;
                  const cancelScheduled = !!sub.cancelAtPeriodEnd;
                    const cancelAtDate =
                      sub.cancelAtPeriodEndDate ?? null;

                  // EMAILS
                  const emailUsagePercent =
                    sub.emailUsagePercent != null
                      ? sub.emailUsagePercent
                      : null;
                  const hasEmailLimit =
                    sub.monthlyEmails != null &&
                    sub.monthlyEmails > 0;

                  // WHATSAPP LEADS
                  const whatsappUsagePercent =
                    sub.whatsappUsagePercent != null
                      ? sub.whatsappUsagePercent
                      : null;
                  const hasWhatsappLimit =
                    sub.monthlyWhatsappLeads != null &&
                    sub.monthlyWhatsappLeads > 0;

                  return (
                    <article
                      key={sub.botId}
                      className="billing-subscription-card billing-subscription-card--compact"
                    >
                      <div className="billing-subscription-header">
                        <div className="billing-subscription-title-block">
                          <h3 className="billing-subscription-title">
                            {sub.botName}
                          </h3>
                          <p className="billing-subscription-subtitle">
                            {t("billing.slugLabel")}:{" "}
                            <code>{sub.botSlug}</code>
                          </p>
                        </div>

                        <div className="billing-subscription-right">
                          <div
                            className={subscriptionStatusBadgeClass(
                              sub.subscriptionStatus
                            )}
                          >
                            {subscriptionStatusLabel(
                              sub.subscriptionStatus
                            )}
                          </div>

                          <div className="billing-subscription-price">
                            {sub.totalMonthlyAmountFormatted}
                            {sub.usagePlanName && (
                              <span className="billing-subscription-plan-label">
                                /{t("billing.perMonth")} &middot;{" "}
                                {sub.usagePlanName}
                              </span>
                            )}
                          </div>

                          {cancelScheduled && (
                            <span className="billing-subscription-plan-label">
                              {t("billing.cancel.scheduled", {
                                defaultValue: "Cancellation scheduled"
                              })}
                              {cancelAtDate
                                ? " " +
                                  t("billing.cancel.until", {
                                    defaultValue: "until"
                                  }) +
                                  " " +
                                  new Date(cancelAtDate).toLocaleDateString(locale, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                  })
                                : ""}
                            </span>
                          )}

                          {isPaidPlan &&
                            !cancelScheduled &&
                            sub.subscriptionStatus !== "CANCELED" && (
                              <button
                                type="button"
                                className="btn-danger btn-small"
                                onClick={() =>
                                  handleCancelSubscription(sub.botId)
                                }
                                disabled={cancelLoadingId === sub.botId}
                              >
                                {cancelLoadingId === sub.botId
                                  ? t("billing.cancel.processing", {
                                      defaultValue: "Canceling"
                                    })
                                  : t("billing.cancel.cta", {
                                      defaultValue: "Cancel subscription"
                                    })}
                              </button>
                            )}
                        </div>
                      </div>

                      {/* Compact meters - you can think of this as "energy used" per bot */}
                      <div className="billing-subscription-meters">
                        {/* TOKENS */}
                        <div className="billing-meter">
                          <div className="billing-meter-top">
                            <span className="billing-meter-title">
                              {t("billing.tokens")}
                            </span>

                            {hasTokenLimit &&
                            tokenUsagePercent != null ? (
                              <span className="billing-meter-meta">
                                <span
                                  className={usageStatusBadgeClass(tokenUsagePercent)}
                                >
                                  {tokenUsagePercent}%
                                </span>
                              </span>
                            ) : (
                              <span className="billing-meter-meta muted">
                                {t(
                                  "billing.noConfiguredLimit"
                                )}
                              </span>
                            )}
                          </div>

                          <div className="billing-meter-value">
                            <strong>
                              {tokensUi(
                                sub.usedTokensThisPeriod
                              ).toLocaleString(locale)}
                            </strong>
                            {hasTokenLimit ? (
                              <span className="muted">
                                {" "}
                                /{" "}
                                  {tokensUi(
                                    sub.monthlyTokens ?? 0
                                  ).toLocaleString(locale)}
                              </span>
                            ) : null}
                          </div>

                          {hasTokenLimit &&
                            tokenUsagePercent != null && (
                              <div className="usage-bar usage-bar--sm">
                                <div
                                  className="usage-bar-fill"
                                  style={{
                                    width: `${tokenUsagePercent}%`
                                  }}
                                />
                              </div>
                            )}
                        </div>
                      </div>

                      {hasTokenLimit &&
                            isPaidPlan &&
                            tokenUsagePercent != null &&
                            tokenUsagePercent >= 90 && (
                              <div className="billing-topup-cta">
                                <button
                                  type="button"
                                  onClick={() => openTopUpModal(sub.botId)}
                                >
                                  {t("billing.topUp.buttonLabel", {
                                    defaultValue:
                                      "Add extra tokens for this period"
                                  })}
                                </button>
                              </div>
                            )}

                      {/* Details (real breakdown: tokens / emails / WhatsApp) */}
                      <details className="billing-subscription-details">
                        <summary className="billing-subscription-details-summary">
                          {t("billing.details", {
                            defaultValue: "Details"
                          })}
                        </summary>

                        <div className="billing-subscription-details-body">
                          {/* Price breakdown */}
                          <div className="billing-subscription-breakdown">
                            <span>
                              {t("billing.breakdown.features")}
                              {": "}
                              <strong>
                                {formatAmount(
                                  sub.featuresAmountCents,
                                  currency,
                                  locale
                                )}
                              </strong>
                            </span>
                            {sub.planAmountCents > 0 && (
                              <span>
                                {t("billing.breakdown.plan")}
                                {": "}
                                <strong>
                                  {formatAmount(
                                    sub.planAmountCents,
                                    currency,
                                    locale
                                  )}
                                </strong>
                              </span>
                            )}
                          </div>

                          {/* Usage breakdown */}
                          <div className="billing-subscription-usage-details mt-3">
                            <h4
                              className="muted text-xs mb-1.5"
                            >
                              {t("billing.usageThisPeriod", {
                                defaultValue: "Usage this period"
                              })}
                            </h4>

                            <ul className="billing-usage-list">
  {/* TOKENS card */}
  <li className="billing-usage-row">
    <div className="billing-usage-row-header">
      <span className="billing-usage-row-label">
        {t("billing.tokens")}
      </span>

      {tokenUsagePercent != null && (
        <span className={usageStatusBadgeClass(tokenUsagePercent)}>
          {usageStatusLabel(tokenUsagePercent) ?? `${tokenUsagePercent}%`}
        </span>
      )}
    </div>

    <div className="billing-usage-row-main">
      <span className="billing-usage-row-value">
        {tokensUi(sub.usedTokensThisPeriod).toLocaleString(locale)}
      </span>
      {hasTokenLimit ? (
        <span className="muted">
          {" "}
          /{" "}
            {tokensUi(sub.monthlyTokens ?? 0).toLocaleString(locale)}
        </span>
      ) : (
        <span className="muted">
          {" "}
          {t("billing.noConfiguredLimit")}
        </span>
      )}
    </div>

    {hasTokenLimit && tokenUsagePercent != null && (
      <div className="usage-bar usage-bar--xs">
        <div
          className="usage-bar-fill"
          style={{ width: `${tokenUsagePercent}%` }}
        />
      </div>
    )}
  </li>

  {/* EMAILS card */}
  <li className="billing-usage-row">
    <div className="billing-usage-row-header">
      <span className="billing-usage-row-label">
        {t("billing.emails", { defaultValue: "Emails" })}
      </span>

      {emailUsagePercent != null && (
        <span className={usageStatusBadgeClass(emailUsagePercent)}>
          {usageStatusLabel(emailUsagePercent) ?? `${emailUsagePercent}%`}
        </span>
      )}
    </div>

    <div className="billing-usage-row-main">
      <span className="billing-usage-row-value">
        {sub.usedEmailsThisPeriod.toLocaleString(locale)}
      </span>
      {hasEmailLimit ? (
        <span className="muted">
          {" "}
          /{" "}
          {(sub.monthlyEmails ?? 0).toLocaleString(locale)}
        </span>
      ) : (
        <span className="muted">
          {" "}
          {t("billing.noConfiguredLimit")}
        </span>
      )}
    </div>

    {hasEmailLimit && emailUsagePercent != null && (
      <div className="usage-bar usage-bar--xs">
        <div
          className="usage-bar-fill"
          style={{ width: `${emailUsagePercent}%` }}
        />
      </div>
    )}
  </li>

  {/* WHATSAPP LEADS card */}
  <li className="billing-usage-row">
    <div className="billing-usage-row-header">
      <span className="billing-usage-row-label">
        {t("billing.whatsappLeads", {
          defaultValue: "WhatsApp leads"
        })}
      </span>

      {whatsappUsagePercent != null && (
        <span className={usageStatusBadgeClass(whatsappUsagePercent)}>
          {usageStatusLabel(whatsappUsagePercent) ??
            `${whatsappUsagePercent}%`}
        </span>
      )}
    </div>

    <div className="billing-usage-row-main">
      <span className="billing-usage-row-value">
        {sub.usedWhatsappLeadsThisPeriod.toLocaleString(locale)}
      </span>
      {hasWhatsappLimit ? (
        <span className="muted">
          {" "}
          /{" "}
          {(sub.monthlyWhatsappLeads ?? 0).toLocaleString(locale)}
        </span>
      ) : (
        <span className="muted">
          {" "}
          {t("billing.noConfiguredLimit")}
        </span>
      )}
    </div>

    {hasWhatsappLimit && whatsappUsagePercent != null && (
      <div className="usage-bar usage-bar--xs">
        <div
          className="usage-bar-fill"
          style={{ width: `${whatsappUsagePercent}%` }}
        />
      </div>
    )}
  </li>
</ul>
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Payment history */}
          <section className="app-card billing-history-card mt-6">
            <h2 className="card-title">{t("billing.paymentHistory.title")}</h2>

            {data.payments.length === 0 && (
              <p className="muted mt-2">
                {t("billing.paymentHistory.empty")}
              </p>
            )}

            {data.payments.length > 0 && (
              <div className="table-responsive payments-table-wrapper">
                <table
                  className="table payments-table mt-3"
                >
                  <thead>
                    <tr>
                      <th>{paymentLabels.date}</th>
                      <th>{paymentLabels.bot}</th>
                      <th>{paymentLabels.amount}</th>
                      <th>{paymentLabels.status}</th>
                      <th>{paymentLabels.period}</th>
                      <th className="payments-actions-header">
                        {paymentLabels.actions}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td data-label={paymentLabels.date}>
                          {new Date(
                            p.createdAt
                          ).toLocaleDateString(locale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })}
                        </td>
                        <td data-label={paymentLabels.bot}>
                          {p.botName}
                          {p.kind === "TOP_UP" && (
                            <span className="muted">
                              {" "}
                              ({t("billing.payments.topUpTag", {
                                defaultValue: "top-up"
                              })})
                            </span>
                          )}
                        </td>
                        <td data-label={paymentLabels.amount}>
                          {formatAmount(
                            p.amountCents,
                            p.currency,
                            locale
                          )}
                        </td>
                        <td data-label={paymentLabels.status}>{p.status}</td>
                        <td data-label={paymentLabels.period}>
                          {p.periodStart && p.periodEnd ? (
                            <>
                              {new Date(
                                p.periodStart
                              ).toLocaleDateString(locale)}{" "}
                              -{" "}
                              {new Date(
                                p.periodEnd
                              ).toLocaleDateString(locale)}
                            </>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>

                        <td
                          className="payments-actions-cell"
                          data-label={paymentLabels.actions}
                        >
                          {p.hasInvoice ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() =>
                                handleDownloadInvoice(p)
                              }
                              disabled={
                                invoiceLoadingId === p.id
                              }
                              aria-label={
                                invoiceLoadingId === p.id
                                  ? t(
                                      "billing.invoice.ariaOpening"
                                    )
                                  : t(
                                      "billing.invoice.ariaDownload"
                                    )
                              }
                              title={
                                invoiceLoadingId === p.id
                                  ? t(
                                      "billing.invoice.titleOpening"
                                    )
                                  : t(
                                      "billing.invoice.titleDownload"
                                    )
                              }
                            >
                              <span className="payments-actions-icon">{invoiceLoadingId === p.id
                                ? "..."
                                : "down"}</span>
                              
                              <span className="payments-actions-text">
                                {invoiceLoadingId === p.id
                                  ? t("billing.invoice.labelOpening")
                                  : t("billing.invoice.labelDownload")}
                              </span>
<span className="sr-only">
                                {invoiceLoadingId === p.id
                                  ? t(
                                      "billing.invoice.srOpening"
                                    )
                                  : t(
                                      "billing.invoice.srDownload"
                                    )}
                              </span>
                            </button>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {topUpState.botId && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("billing.topUp.title", {
              defaultValue: "Token top-up"
            })}
          >
            <div className="modal-header">
              <h2>
                {t("billing.topUp.title", {
                  defaultValue: "Token top-up"
                })}
              </h2>
              <button type="button" onClick={closeTopUpModal}>
                x
              </button>
            </div>

            <div className="modal-body">
              {topUpState.loading && (
                <p className="muted">
                  {t("billing.topUp.loading", {
                    defaultValue: "Loading available top-up options..."
                  })}
                </p>
              )}

              {!topUpState.loading && topUpState.options && (
                <>
                  <p className="muted">
                    {t("billing.topUp.description", {
                      defaultValue:
                        "Top-ups let you temporarily increase your token limit for the current billing period. You'll pay immediately and receive extra tokens right away."
                    })}
                  </p>

                  <p>
                    <strong>{topUpState.options.botName}</strong>{" "}
                    {topUpState.options.usagePlanName && (
                      <>- {topUpState.options.usagePlanName}</>
                    )}
                  </p>

                  <p className="muted">
                    {t("billing.topUp.basePlanInfo", {
                      defaultValue:
                        "Current plan: {{price}} / month, {{tokens}} tokens",
                      price:
                        topUpState.options.baseMonthlyAmountFormatted,
                      tokens: topUpState.options.baseMonthlyTokens
                        ? tokensUi(
                            topUpState.options.baseMonthlyTokens
                          )
                        : t("billing.unlimited")
                    })}
                  </p>

                  <form onSubmit={handleTopUpCheckout}>
                    <div className="topup-options-list">
                      {topUpState.options.options.map((opt) => (
                        <label
                          key={opt.code}
                          className="topup-option-row"
                        >
                          <input
                            type="radio"
                            name="topup-option"
                            value={opt.code}
                            checked={
                              topUpState.selectedCode === opt.code
                            }
                            onChange={() =>
                              setTopUpState((prev) => ({
                                ...prev,
                                selectedCode: opt.code
                              }))
                            }
                          />
                          <div className="topup-option-content">
                            <div>
                              {t("billing.topUp.optionLabel", {
                                defaultValue:
                                  "+{{percent}}% tokens for {{price}}% of monthly price",
                                percent: opt.percentTokens,
                                price: opt.percentPrice
                              })}
                            </div>
                            <div className="muted">
                              {t("billing.topUp.optionDetails", {
                                defaultValue:
                                  "+{{tokens}} tokens for {{amount}}",
                                tokens: tokensUi(opt.extraTokens),
                                amount: opt.priceFormatted
                              })}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {topUpState.error && (
                      <p className="error-text">{topUpState.error}</p>
                    )}

                    <div className="modal-actions">
                      <button type="button" onClick={closeTopUpModal}>
                        {t("common.cancel", {
                          defaultValue: "Cancel"
                        })}
                      </button>
                      <button
                        type="submit"
                        disabled={
                          !topUpState.selectedCode ||
                          topUpState.checkoutLoading
                        }
                      >
                        {topUpState.checkoutLoading
                          ? t("billing.topUp.processing", {
                              defaultValue: "Processing..."
                            })
                          : t("billing.topUp.checkoutCta", {
                              defaultValue: "Proceed to secure checkout"
                            })}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {!topUpState.loading &&
                !topUpState.options &&
                !topUpState.error && (
                  <p className="muted">
                    {t("billing.topUp.noOptions", {
                      defaultValue: "No top-up options are available."
                    })}
                  </p>
                )}

              {topUpState.error && !topUpState.options && (
                <p className="error-text">{topUpState.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default Billing;



