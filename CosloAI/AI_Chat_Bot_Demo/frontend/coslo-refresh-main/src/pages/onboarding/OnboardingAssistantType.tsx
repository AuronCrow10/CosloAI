import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Calendar, ShoppingBag } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { getBotById, updateBot, type Bot, type UpdateBotPayload } from "@/api/bots";

type AssistantType = "service" | "shopify";

const SERVICE_PRESET: UpdateBotPayload = {
  knowledgeSource: "RAG",
  useDomainCrawler: true,
  usePdfCrawler: true,
  channelWeb: true,
  channelWhatsapp: true,
  channelInstagram: true,
  channelMessenger: true,
  useCalendar: true,
  leadWhatsappMessages200: true,
  leadWhatsappMessages500: false,
  leadWhatsappMessages1000: false
};

const SHOPIFY_PRESET: UpdateBotPayload = {
  knowledgeSource: "SHOPIFY",
  useDomainCrawler: false,
  usePdfCrawler: false,
  channelWeb: true,
  channelWhatsapp: true,
  channelInstagram: true,
  channelMessenger: true,
  useCalendar: false,
  leadWhatsappMessages200: true,
  leadWhatsappMessages500: false,
  leadWhatsappMessages1000: false
};

const OnboardingAssistantType = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssistantType>("service");
  const [bot, setBot] = useState<Bot | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    getBotById(id)
      .then((b) => {
        setBot(b);
        const inferred: AssistantType =
          b.knowledgeSource === "SHOPIFY" ? "shopify" : "service";
        setSelected(inferred);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("assistantType.errors.loadBot"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  const selection = useMemo(
    () => (selected === "shopify" ? SHOPIFY_PRESET : SERVICE_PRESET),
    [selected]
  );

  const handleContinue = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBot(id, selection);
      setBot(updated);
      navigate(`/onboarding/bots/${encodeURIComponent(id)}/plan`);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          t("assistantType.errors.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return null;
  }

  const renderCard = (
    type: AssistantType,
    title: string,
    subtitle: string,
    features: string[],
    icon: ReactNode
  ) => {
    const isSelected = selected === type;
    return (
      <button
        type="button"
        onClick={() => setSelected(type)}
        className={[
          "relative w-full text-left rounded-2xl border bg-card p-6 md:p-7 shadow-sm transition",
          "hover:border-primary/60 hover:shadow-md",
          isSelected
            ? "border-primary ring-2 ring-primary/20"
            : "border-border"
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {title}
                </h2>
                {isSelected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("assistantType.selected")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-foreground/90">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/70" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </button>
    );
  };

  return (
    <OnboardingLayout
      currentStep="assistantType"
      botId={id}
      flow="assistantType"
      layout="full"
      title={t("assistantType.title")}
      subtitle={t("assistantType.subtitle")}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {renderCard(
              "service",
              t("assistantType.service.title"),
              t("assistantType.service.subtitle"),
              [
                t("assistantType.service.feature1"),
                t("assistantType.service.feature2"),
                t("assistantType.service.feature3"),
                t("assistantType.service.feature4")
              ],
              <Calendar className="h-6 w-6" />
            )}

            {renderCard(
              "shopify",
              t("assistantType.shopify.title"),
              t("assistantType.shopify.subtitle"),
              [
                t("assistantType.shopify.feature1"),
                t("assistantType.shopify.feature2"),
                t("assistantType.shopify.feature3")
              ],
              <ShoppingBag className="h-6 w-6" />
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <button
            type="button"
            className="btn-secondary btn-color"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            {t("common.back")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleContinue}
            disabled={saving || loading}
          >
            {saving
              ? t("assistantType.actions.saving")
              : t("assistantType.actions.continue")}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingAssistantType;
