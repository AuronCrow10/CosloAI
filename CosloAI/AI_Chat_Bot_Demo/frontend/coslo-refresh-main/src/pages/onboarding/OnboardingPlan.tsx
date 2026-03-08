import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { Button } from "@/components/ui/button";
import {
  Bot,
  UsagePlan,
  activateFreePlan,
  changeBotUsagePlan,
  fetchUsagePlans,
  getBotById,
  startBotCheckout
} from "@/api/bots";
import { getStoredReferralCode } from "@/utils/referral";

type PlanFeature = {
  id: string;
  label: string;
  available: boolean;
};

const MOST_POPULAR_PLAN_KEY = "growth";
const PLAN_ORDER = ["free", "starter", "growth", "scale"];

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amountCents / 100);

const sortPlans = (items: UsagePlan[]): UsagePlan[] =>
  [...items].sort((a, b) => {
    const ai = PLAN_ORDER.indexOf(a.name.toLowerCase());
    const bi = PLAN_ORDER.indexOf(b.name.toLowerCase());
    const safeAi = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const safeBi = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (safeAi !== safeBi) return safeAi - safeBi;
    return a.monthlyAmountCents - b.monthlyAmountCents;
  });

const OnboardingPlanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
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
    if (tokens == null) return t("botPlan.plans.unlimited");
    return (tokens / 10).toLocaleString("en-GB");
  };

  const getPlanFeatures = (plan: UsagePlan): PlanFeature[] => {
    const key = plan.name.toLowerCase();
    const knownKey = PLAN_ORDER.includes(key) ? key : "default";

    if (knownKey === "default") {
      return [
        {
          id: "energy",
          label: t("botPlan.features.default.energy", "{{amount}} Energy per month", {
            amount: formatEnergyDisplay(plan.monthlyTokens)
          }),
          available: true
        }
      ];
    }

    return [
      {
        id: "energy",
        label: t(`botPlan.features.${knownKey}.energy`, "{{amount}} Energy per month", {
          amount: formatEnergyDisplay(plan.monthlyTokens)
        }),
        available: true
      },
      {
        id: "messages",
        label: t(`botPlan.features.${knownKey}.messages`),
        available: true
      },
      {
        id: "pages",
        label: t(`botPlan.features.${knownKey}.pages`),
        available: true
      },
      {
        id: "emails",
        label: t(`botPlan.features.${knownKey}.emails`),
        available: true
      },
      {
        id: "whatsappTemplates",
        label: t(`botPlan.features.${knownKey}.whatsappTemplates`),
        available: knownKey !== "free"
      }
    ];
  };

  const orderedPlans = useMemo(() => sortPlans(plans), [plans]);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setPlansLoading(true);
    setError(null);
    setPlansError(null);

    Promise.all([getBotById(id), fetchUsagePlans()])
      .then(([botRes, plansRes]) => {
        const sortedPlans = sortPlans(plansRes);
        setBot(botRes);
        setPlans(sortedPlans);

        const currentUsagePlanId =
          (botRes as Bot & { usagePlanId?: string | null }).usagePlanId || null;

        if (currentUsagePlanId && sortedPlans.some((p) => p.id === currentUsagePlanId)) {
          setSelectedPlanId(currentUsagePlanId);
        } else if (sortedPlans.length > 0) {
          setSelectedPlanId(sortedPlans[0].id);
        }
      })
      .catch((err: any) => {
        console.error("Failed to load onboarding plan data", err);
        setError(err?.message || t("botPlan.errors.loadFailed"));
        setPlansError(err?.message || t("botPlan.errors.loadFailed"));
      })
      .finally(() => {
        setLoading(false);
        setPlansLoading(false);
      });
  }, [id, t]);

  const handleBack = () => {
    if (!id) return;
    navigate(`/onboarding/bots/${encodeURIComponent(id)}/type`);
  };

  const handleActivateOrChangePlan = async () => {
    if (!id || !bot || !selectedPlanId) return;

    const isActive = bot.status === "ACTIVE";
    const selectedPlan = orderedPlans.find((plan) => plan.id === selectedPlanId) || null;

    setCheckoutLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isActive) {
        const referralCode = getStoredReferralCode();
        const payload: Record<string, unknown> = { usagePlanId: selectedPlanId };
        if (referralCode) payload.referralCode = referralCode;

        const isFree =
          selectedPlan &&
          (selectedPlan.monthlyAmountCents === 0 || selectedPlan.code?.toLowerCase() === "free");

        if (isFree) {
          await activateFreePlan(id, { usagePlanId: selectedPlanId });
          navigate(`/onboarding/bots/${encodeURIComponent(id)}/knowledge`, { replace: true });
        } else {
          const { checkoutUrl } = await startBotCheckout(id, payload as any);
          window.location.href = checkoutUrl;
        }
      } else {
        await changeBotUsagePlan(id, { usagePlanId: selectedPlanId });
        setSuccess(t("botPlan.success.planUpdatedProration"));
        const updatedBot = await getBotById(id);
        setBot(updatedBot);
        navigate(`/onboarding/bots/${encodeURIComponent(id)}/knowledge`, { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botPlan.errors.updateFailed"));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!id) return null;

  const selectedPlan = orderedPlans.find((plan) => plan.id === selectedPlanId) || null;
  const totalFormatted = selectedPlan
    ? formatCurrency(selectedPlan.monthlyAmountCents, selectedPlan.currency)
    : null;
  const isActive = bot?.status === "ACTIVE";

  return (
    <OnboardingLayout
      currentStep="plan"
      botId={id}
      flow="assistantType"
      title={t("botPlan.onboarding.title")}
      subtitle={t("botPlan.onboarding.subtitle")}
      layout="full"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <div className="font-medium">{t("botPlan.success.title")}</div>
            <div>{success}</div>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("botPlan.energyInfo.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("botPlan.energyInfo.main")}</p>
              <p className="text-xs text-muted-foreground">{t("botPlan.energyInfo.estimates")}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold text-foreground">{t("botPlan.plans.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("botPlan.plans.subtitle")}</p>
          </header>

          {plansLoading && (
            <p className="text-sm text-muted-foreground">{t("botPlan.plans.loading")}</p>
          )}

          {!plansLoading && plansError && (
            <p className="text-sm text-destructive">{plansError}</p>
          )}

          {!plansLoading && orderedPlans.length === 0 && !plansError && (
            <p className="text-sm text-muted-foreground">{t("botPlan.plans.empty")}</p>
          )}

          {orderedPlans.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {orderedPlans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                const features = getPlanFeatures(plan);
                const isMostPopular = plan.name.toLowerCase() === MOST_POPULAR_PLAN_KEY;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setSuccess(null);
                    }}
                    className={[
                      "group relative rounded-2xl border bg-background/70 p-4 text-left transition-all",
                      "hover:border-primary/60 hover:bg-primary/[0.03]",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border"
                    ].join(" ")}
                  >
                    <div className="flex min-h-[21rem] flex-col">
                      <div className="mb-4 flex items-start justify-between gap-2">
                        <div className="font-display text-lg font-semibold text-foreground">
                          {plan.name}
                        </div>
                        {isMostPopular && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {t("botPlan.plans.mostPopular")}
                          </span>
                        )}
                      </div>

                      <div className="mb-1 text-2xl font-semibold text-foreground">
                        {formatCurrency(plan.monthlyAmountCents, plan.currency)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          /{t("botPlan.perMonth")}
                        </span>
                      </div>

                      {plan.description && (
                        <p className="mb-4 text-sm text-muted-foreground">{plan.description}</p>
                      )}

                      <p className="mb-4 text-xs text-muted-foreground">
                        {t("botPlan.plans.tokensPerMonthLabel")}: {" "}
                        <span className="font-medium text-foreground">
                          {formatEnergyDisplay(plan.monthlyTokens)}
                        </span>
                      </p>

                      <ul className="space-y-2">
                        {features.map((feature) => (
                          <li key={feature.id} className="flex items-start gap-2">
                            {feature.available ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="text-sm text-foreground/90">{feature.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedPlan && (
          <section className="rounded-xl border border-border bg-background/60 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-muted-foreground">{t("botPlan.summary.selectedPlan")}:</span>{" "}
                <span className="font-medium text-foreground">{selectedPlan.name}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{t("botPlan.summary.totalPerMonth")}:</span>{" "}
                <span className="font-semibold text-foreground">
                  {totalFormatted ?? t("botPlan.summary.selectPlanToSeeTotal")}
                </span>
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={handleBack}
            disabled={checkoutLoading || loading}
          >
            {t("common.back")}
          </Button>
          <Button
            type="button"
            onClick={handleActivateOrChangePlan}
            disabled={checkoutLoading || !selectedPlan || loading}
          >
            {checkoutLoading
              ? isActive
                ? t("botPlan.actions.updating")
                : t("botPlan.actions.redirecting")
              : isActive
                ? t("botPlan.actions.changePlan")
                : t("botPlan.actions.activatePay")}
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingPlanPage;