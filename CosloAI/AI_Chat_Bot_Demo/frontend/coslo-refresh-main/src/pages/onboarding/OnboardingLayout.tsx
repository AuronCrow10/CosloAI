// src/pages/onboarding/OnboardingLayout.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

export type OnboardingStepKey =
  | "bot"
  | "assistantType"
  | "shopify"
  | "channels"
  | "booking"
  | "leadAds"
  | "plan"
  | "knowledge";

export interface OnboardingLayoutProps {
  currentStep: OnboardingStepKey;
  botId?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  layout?: "split" | "full";
  rightAction?: React.ReactNode;
  flow?: "default" | "shopify" | "assistantType";
  includeAssistantBookingStep?: boolean;
  includeAssistantLeadAdsStep?: boolean;
}

interface OnboardingStep {
  key: OnboardingStepKey;
  label: string;
  description: string;
  path: (botId: string) => string;
}

function getSteps(
  t: TFunction<"translation">,
  currentStep: OnboardingStepKey,
  botId?: string,
  flow: "default" | "shopify" | "assistantType" = "default",
  includeAssistantBookingStep = false,
  includeAssistantLeadAdsStep = false
): OnboardingStep[] {
  const safeBotId = botId || "__bot__";

  const mkBotDepPath =
    (suffix: string) =>
    (id: string): string =>
      `/onboarding/bots/${encodeURIComponent(id || safeBotId)}${suffix}`;

  if (flow === "shopify") {
    return [
      {
        key: "bot",
        label: t("onboardingLayout.steps.bot"),
        description: t("onboardingLayout.steps.botDescription"),
        path: () => "/onboarding/bots/new"
      },
      {
        key: "shopify",
        label: t("onboardingLayout.steps.shopify"),
        description: t("onboardingLayout.steps.shopifyDescription"),
        path: mkBotDepPath("/shopify")
      },
      {
        key: "channels",
        label: t("onboardingLayout.steps.channels"),
        description: t("onboardingLayout.steps.channelsDescription"),
        path: mkBotDepPath("/channels")
      },
      {
        key: "booking",
        label: t("onboardingLayout.steps.booking"),
        description: t("onboardingLayout.steps.bookingDescription"),
        path: mkBotDepPath("/booking")
      },
      {
        key: "leadAds",
        label: t("onboardingLayout.steps.leadAds"),
        description: t("onboardingLayout.steps.leadAdsDescription"),
        path: mkBotDepPath("/lead-ads")
      },
      {
        key: "plan",
        label: t("onboardingLayout.steps.plan"),
        description: t("onboardingLayout.steps.planDescription"),
        path: mkBotDepPath("/plan")
      },
      {
        key: "knowledge",
        label: t("onboardingLayout.steps.knowledge"),
        description: t("onboardingLayout.steps.knowledgeDescription"),
        path: mkBotDepPath("/knowledge")
      }
    ];
  }

  if (flow === "assistantType") {
    const creationSteps: OnboardingStep[] = [
      {
        key: "bot",
        label: t("onboardingLayout.steps.bot"),
        description: t("onboardingLayout.steps.botDescription"),
        path: () => "/onboarding/bots/new"
      },
      {
        key: "assistantType",
        label: t("onboardingLayout.steps.assistantType"),
        description: t("onboardingLayout.steps.assistantTypeDescription"),
        path: mkBotDepPath("/type")
      },
      {
        key: "plan",
        label: t("onboardingLayout.steps.plan"),
        description: t("onboardingLayout.steps.planDescription"),
        path: mkBotDepPath("/plan")
      }
    ];

    const configurationSteps: OnboardingStep[] = [
      {
        key: "knowledge",
        label: t("onboardingLayout.steps.knowledge"),
        description: t("onboardingLayout.steps.knowledgeDescription"),
        path: mkBotDepPath("/knowledge")
      },
      {
        key: "channels",
        label: t("onboardingLayout.steps.channels"),
        description: t("onboardingLayout.steps.channelsDescription"),
        path: mkBotDepPath("/channels")
      }
    ];

    const shouldIncludeBooking =
      includeAssistantBookingStep || currentStep === "booking";
    const shouldIncludeLeadAds =
      includeAssistantLeadAdsStep || currentStep === "leadAds";

    if (shouldIncludeBooking) {
      configurationSteps.push({
        key: "booking",
        label: t("onboardingLayout.steps.booking"),
        description: t("onboardingLayout.steps.bookingDescription"),
        path: mkBotDepPath("/booking")
      });
    }

    if (shouldIncludeLeadAds) {
      configurationSteps.push({
        key: "leadAds",
        label: t("onboardingLayout.steps.leadAds"),
        description: t("onboardingLayout.steps.leadAdsDescription"),
        path: mkBotDepPath("/lead-ads")
      });
    }

    const isCreationPhase =
      currentStep === "bot" ||
      currentStep === "assistantType" ||
      currentStep === "plan";

    return isCreationPhase ? creationSteps : configurationSteps;
  }

  return [
    {
      key: "bot",
      label: t("onboardingLayout.steps.bot"),
      description: t("onboardingLayout.steps.botDescription"),
      path: () => "/onboarding/bots/new"
    },
    {
      key: "channels",
      label: t("onboardingLayout.steps.channels"),
      description: t("onboardingLayout.steps.channelsDescription"),
      path: mkBotDepPath("/channels")
    },
    {
      key: "booking",
      label: t("onboardingLayout.steps.booking"),
      description: t("onboardingLayout.steps.bookingDescription"),
      path: mkBotDepPath("/booking")
    },
    {
      key: "leadAds",
      label: t("onboardingLayout.steps.leadAds"),
      description: t("onboardingLayout.steps.leadAdsDescription"),
      path: mkBotDepPath("/lead-ads")
    },
    {
      key: "plan",
      label: t("onboardingLayout.steps.plan"),
      description: t("onboardingLayout.steps.planDescription"),
      path: mkBotDepPath("/plan")
    },
    {
      key: "knowledge",
      label: t("onboardingLayout.steps.knowledge"),
      description: t("onboardingLayout.steps.knowledgeDescription"),
      path: mkBotDepPath("/knowledge")
    }
  ];
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  currentStep,
  botId,
  title,
  subtitle,
  children,
  layout,
  rightAction,
  flow = "default",
  includeAssistantBookingStep = false,
  includeAssistantLeadAdsStep = false
}) => {
  const { t } = useTranslation();
  const steps = getSteps(
    t,
    currentStep,
    botId,
    flow,
    includeAssistantBookingStep,
    includeAssistantLeadAdsStep
  );

  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const totalSteps = steps.length;
  const isFull = (layout ?? "split") === "full";

  return (
    <section className="auth-landing">
      <div className="lp-container">
        <div className="auth-layout-onboarding">
          {/* TOP: eyebrow + horizontal stepper */}
          <header className="onboarding-header">
            <div className="onboarding-header-top">
              <p className="auth-eyebrow">
                {t("onboardingLayout.eyebrow")
                  .replace("{current}", String(currentIndex + 1))
                  .replace("{total}", String(totalSteps))}
              </p>
            </div>

            <ol className="onboarding-steps">
              {steps.map((step, index) => {
                const isActive = step.key === currentStep;
                const isCompleted = index < currentIndex;
                const isFuture = index > currentIndex;

                const stepClassName = [
                  "onboarding-step",
                  isActive && "onboarding-step--active",
                  isCompleted && "onboarding-step--done",
                  isFuture && "onboarding-step--future"
                ]
                  .filter(Boolean)
                  .join(" ");

                const canClick = step.key === "bot" || !!botId;
                const stepLabel = step.label.replace(/^\s*\d+\.\s*/, "");

                const content = (
                  <>
                    <div className="onboarding-step-index">
                      {isCompleted ? "\u2713" : index + 1}
                    </div>
                    <div className="onboarding-step-text">
                      <div className="onboarding-step-label">{stepLabel}</div>
                      <div className="onboarding-step-description">
                        {step.description}
                      </div>
                    </div>
                  </>
                );

                if (!canClick) {
                  return (
                    <li key={step.key} className={stepClassName}>
                      <div
                        className="onboarding-step-inner onboarding-step-inner--disabled"
                        aria-disabled="true"
                      >
                        {content}
                      </div>
                    </li>
                  );
                }

                const to =
                  step.key === "bot"
                    ? step.path("__ignored__")
                    : step.path(botId as string);

                return (
                  <li key={step.key} className={stepClassName}>
                    <Link className="onboarding-step-inner" to={to}>
                      {content}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </header>

          {/* MAIN: text + content */}
          <div
            className={
              isFull
                ? "onboarding-main onboarding-main--full"
                : "onboarding-main"
            }
          >
            <div
              className={
                isFull
                  ? "onboarding-main-copy onboarding-main-copy--full"
                  : "onboarding-main-copy"
              }
            >
              <h1 className="auth-title">{title}</h1>
              {subtitle && <p className="auth-subtitle">{subtitle}</p>}
              <div className="onboarding-title-row">
                {rightAction && (
                  <div className="onboarding-header-actions">
                    {rightAction}
                  </div>
                )}
              </div>
            </div>

            <div
              className={
                isFull
                  ? "auth-card onboarding-card onboarding-main-card onboarding-main-card--full"
                  : "auth-card onboarding-card onboarding-main-card"
              }
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OnboardingLayout;

