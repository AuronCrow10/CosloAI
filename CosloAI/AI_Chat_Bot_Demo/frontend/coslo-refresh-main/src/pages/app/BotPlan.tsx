// src/pages/app/BotPlanPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bot,
  getBotById,
  fetchUsagePlans,
  UsagePlan,
  startBotCheckout,
  activateFreePlan,
  changeBotUsagePlan,
  getBotPricingPreview
} from "@/api/bots";
import { useTranslation } from "react-i18next";

// Plan images removed per UI request

import { getStoredReferralCode } from "@/utils/referral";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amountCents / 100);

type PlanFeature = {
  id: string;
  label: string;
  available: boolean;
};

// Images removed

const isFreePlan = (plan: UsagePlan): boolean =>
  plan.monthlyAmountCents === 0 || plan.code?.toLowerCase() === "free";

const BotPlan: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<UsagePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);

  const formatEnergyDisplay = (tokens?: number | null): string => {
    if (tokens == null) {
      return t("botPlan.plans.unlimited");
    }
    return (tokens / 10).toLocaleString("en-GB");
  };

  const planFeaturesConfig: Record<string, (plan: UsagePlan) => PlanFeature[]> =
    {
      free: (plan) => [
        {
          id: "energy",
          label: t(
            "botPlan.features.free.energy",
            "{{amount}} Energy per month",
            { amount: formatEnergyDisplay(plan.monthlyTokens) }
          ),
          available: true
        },
        {
          id: "messages",
          label: t("botPlan.features.free.messages"),
          available: true
        },
        {
          id: "pages",
          label: t("botPlan.features.free.pages"),
          available: true
        },
        {
          id: "emails",
          label: t("botPlan.features.free.emails"),
          available: true
        },
        {
          id: "whatsappTemplates",
          label: t("botPlan.features.free.whatsappTemplates"),
          available: false
        }
      ],
      starter: (plan) => [
        {
          id: "energy",
          label: t(
            "botPlan.features.starter.energy",
            "{{amount}} Energy per month",
            { amount: formatEnergyDisplay(plan.monthlyTokens) }
          ),
          available: true
        },
        {
          id: "messages",
          label: t("botPlan.features.starter.messages"),
          available: true
        },
        {
          id: "pages",
          label: t("botPlan.features.starter.pages"),
          available: true
        },
        {
          id: "emails",
          label: t("botPlan.features.starter.emails"),
          available: true
        },
        {
          id: "whatsappTemplates",
          label: t("botPlan.features.starter.whatsappTemplates"),
          available: true
        }
      ],
      growth: (plan) => [
        {
          id: "energy",
          label: t(
            "botPlan.features.growth.energy",
            "{{amount}} Energy per month",
            { amount: formatEnergyDisplay(plan.monthlyTokens) }
          ),
          available: true
        },
        {
          id: "messages",
          label: t("botPlan.features.growth.messages"),
          available: true
        },
        {
          id: "pages",
          label: t("botPlan.features.growth.pages"),
          available: true
        },
        {
          id: "emails",
          label: t("botPlan.features.growth.emails"),
          available: true
        },
        {
          id: "whatsappTemplates",
          label: t("botPlan.features.growth.whatsappTemplates"),
          available: true
        }
      ],
      scale: (plan) => [
        {
          id: "energy",
          label: t(
            "botPlan.features.scale.energy",
            "{{amount}} Energy per month",
            { amount: formatEnergyDisplay(plan.monthlyTokens) }
          ),
          available: true
        },
        {
          id: "messages",
          label: t("botPlan.features.scale.messages"),
          available: true
        },
        {
          id: "pages",
          label: t("botPlan.features.scale.pages"),
          available: true
        },
        {
          id: "emails",
          label: t("botPlan.features.scale.emails"),
          available: true
        },
        {
          id: "whatsappTemplates",
          label: t("botPlan.features.scale.whatsappTemplates"),
          available: true
        }
      ],
      default: (plan) => [
        {
          id: "energy",
          label: t(
            "botPlan.features.default.energy",
            "{{amount}} Energy per month",
            { amount: formatEnergyDisplay(plan.monthlyTokens) }
          ),
          available: true
        }
      ]
    };

  const getPlanFeatures = (plan: UsagePlan): PlanFeature[] => {
    const key = plan.name.toLowerCase();
    const builder = planFeaturesConfig[key] ?? planFeaturesConfig.default;
    return builder(plan);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPlansLoading(true);

    Promise.all([getBotById(id), getBotPricingPreview(id, {}), fetchUsagePlans()])
      .then(([botData, pricing, plansData]) => {
        setBot(botData);
        setPlans(plansData);
        if (plansData.length > 0) setSelectedPlanId(plansData[0].id);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botPlan.errors.loadFailed"));
      })
      .finally(() => {
        setLoading(false);
        setPlansLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botPlan.missingId")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <p>{t("botPlan.loading")}</p>
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="page-container">
        <h1>{t("botPlan.errorTitle")}</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="page-container">
        <h1>{t("botPlan.notFoundTitle")}</h1>
      </div>
    );
  }

  const isActive = bot.status === "ACTIVE";
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null;

  const handleActivateOrChangePlan = async () => {
    if (!id || !bot) return;
    if (!selectedPlanId) {
      setError(t("botPlan.errors.selectPlan"));
      return;
    }

    setCheckoutLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isActive) {
        // Attach referralCode if present (safe, won’t break)
        const referralCode = getStoredReferralCode();
        const payload: Record<string, unknown> = { usagePlanId: selectedPlanId };
        if (referralCode) payload.referralCode = referralCode;

        const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null;
        if (selectedPlan && isFreePlan(selectedPlan)) {
          await activateFreePlan(id, { usagePlanId: selectedPlanId });
          setSuccess(
            t("botPlan.success.planActivated")
          );
          const updatedBot = await getBotById(id);
          setBot(updatedBot);
        } else {
          const { checkoutUrl } = await startBotCheckout(id, payload as any);
          window.location.href = checkoutUrl;
        }
      } else {
        await changeBotUsagePlan(id, { usagePlanId: selectedPlanId });
        setSuccess(t("botPlan.success.planUpdatedProration"));

        const updatedBot = await getBotById(id);
        setBot(updatedBot);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botPlan.errors.updateFailed"));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getStatusPillClass = (status: Bot["status"]) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACTIVE") return "plan-summary-status plan-summary-status-ok";
    if (normalized === "DRAFT") return "plan-summary-status plan-summary-status-warn";
    if (normalized === "CANCELLED" || normalized === "INACTIVE")
      return "plan-summary-status plan-summary-status-error";
    return "plan-summary-status";
  };

  const statusPillClass = getStatusPillClass(bot.status);

  const combinedTotalFormatted =
    selectedPlan
      ? formatCurrency(selectedPlan.monthlyAmountCents, selectedPlan.currency)
      : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{t("botPlan.plans.title")}</h2>
          <p className="usage-plans-subtitle">{t("botPlan.plans.subtitle")}</p>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => navigate(`/app/bots/${bot.id}`)}
          >
            {t("botPlan.backToOverview")}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <div className="detail-layout">
        <section className="detail-main">
          <div className="plan-info-card">
            <div className="plan-info-icon" aria-hidden="true">
              i
            </div>
            <div className="plan-info-body">
              <h3 className="plan-info-title">
                {t("botPlan.energyInfo.title")}
              </h3>
              <p>
                {t("botPlan.energyInfo.main")}
              </p>
              <p className="muted">
                {t(
                  "botPlan.energyInfo.estimates",
                  'The "Up to" values shown in each plan are maximum estimates if you spent all your Energy on a single type of task. Actual usage varies based on message length, document size and context.'
                )}
              </p>
            </div>
          </div>

          {plansLoading && <p>{t("botPlan.plans.loading")}</p>}
          {plansError && <p className="form-error">{plansError}</p>}

          {plans.length === 0 && !plansLoading && (
            <p className="muted">{t("botPlan.plans.empty")}</p>
          )}

          <div className="plan-cards">
            {plans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;

              return (
                <div
                  key={plan.id}
                  className={`plan-card ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div className="plan-card-header">
                    <div className="plan-card-name">{plan.name}</div>
                    <div className="plan-card-price">
                      {formatCurrency(plan.monthlyAmountCents, plan.currency)}/{t("botPlan.perMonth")}
                    </div>
                  </div>

                  {plan.description && (
                    <p className="plan-card-description">{plan.description}</p>
                  )}

                  <ul className="plan-limits">
                    <li>
                      {t("botPlan.plans.tokensPerMonth")}{" "}
                      <strong>{formatEnergyDisplay(plan.monthlyTokens)}</strong>
                    </li>
                  </ul>

                  <ul className="plan-features">
                    {getPlanFeatures(plan).map((feature) => (
                      <li key={feature.id} className="plan-feature">
                        <span
                          className={
                            "plan-feature-icon " +
                            (feature.available
                              ? "plan-feature-icon--ok"
                              : "plan-feature-icon--off")
                          }
                        >
                          {feature.available ? "ok" : "x"}
                        </span>
                        <span className="plan-feature-text">
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlan(plan.id);
                    }}
                  >
                    {isSelected ? t("botPlan.plans.selected") : t("botPlan.plans.select")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="detail-side mt-4">
          <div className="settings-sidebar-card">
            <div className="settings-sidebar-header">
              <div>
                <h3 className="settings-sidebar-title">{t("botPlan.summary.title")}</h3>
              </div>
              <span className={statusPillClass}>
                {t("botPlan.summary.statusLabel")} <strong>{bot.status}</strong>
              </span>
            </div>

            <p className="muted mt-1.5">{t("botPlan.summary.subtitle")}</p>

            <h3 className="mt-4 mb-1.5">{t("botPlan.summary.featuresSubtotal")}</h3>

            <h3 className="mt-5 mb-1">{t("botPlan.summary.selectedPlan")}</h3>

            {selectedPlan ? (
              <div className="plan-summary-lines">
                <div className="plan-summary-line">
                  <span className="plan-summary-line-label">{selectedPlan.name}</span>
                  <span className="plan-summary-line-amount">
                    {formatCurrency(selectedPlan.monthlyAmountCents, selectedPlan.currency)}/{t("botPlan.perMonth")}
                  </span>
                </div>

                <div className="plan-summary-line">
                  <span className="plan-summary-line-label">
                    {t("botPlan.plans.tokensPerMonthLabel")}
                  </span>
                  <span className="plan-summary-line-amount">
                    {formatEnergyDisplay(selectedPlan.monthlyTokens)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="muted">{t("botPlan.summary.noPlanSelected")}</p>
            )}

            {selectedPlan && (
              <ul className="plan-features plan-features--summary">
                {getPlanFeatures(selectedPlan).map((feature) => (
                  <li key={feature.id} className="plan-feature">
                    <span
                      className={
                        "plan-feature-icon " +
                        (feature.available
                          ? "plan-feature-icon--ok"
                          : "plan-feature-icon--off")
                      }
                    >
                      {feature.available ? "ok" : "x"}
                    </span>
                    <span className="plan-feature-text">
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}

              <div className="plan-summary-total mt-6">
                <span>{t("botPlan.summary.totalPerMonth")}</span>
                <strong>{combinedTotalFormatted ?? t("botPlan.summary.selectPlanToSeeTotal")}</strong>
              </div>

            {!isActive && (
              <>
                <button
                  className="btn-primary mt-4"
                  type="button"
                  onClick={handleActivateOrChangePlan}
                  disabled={checkoutLoading || !selectedPlan}
                >
                  {checkoutLoading ? t("botPlan.actions.redirecting") : t("botPlan.actions.activatePay")}
                </button>

                <p className="detail-side-note">{t("botPlan.notes.redirectToStripe")}</p>
              </>
            )}

            {isActive && (
              <>
                <button
                  className="btn-primary mt-4"
                  type="button"
                  onClick={handleActivateOrChangePlan}
                  disabled={checkoutLoading || !selectedPlan}
                >
                  {checkoutLoading ? t("botPlan.actions.updating") : t("botPlan.actions.changePlan")}
                </button>

                <p className="detail-side-note">{t("botPlan.notes.proration")}</p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default BotPlan;
