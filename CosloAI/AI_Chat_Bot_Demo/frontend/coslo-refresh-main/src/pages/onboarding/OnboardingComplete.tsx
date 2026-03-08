import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bot, getBotById } from "@/api/bots";

const CONFETTI_ITEMS = [
  { left: "8%", top: "14%", delay: "0s", duration: "2.4s", tone: "bg-primary/50" },
  { left: "18%", top: "30%", delay: "0.4s", duration: "2.1s", tone: "bg-success/50" },
  { left: "28%", top: "8%", delay: "0.9s", duration: "2.8s", tone: "bg-warning/60" },
  { left: "38%", top: "24%", delay: "0.2s", duration: "2.6s", tone: "bg-primary/40" },
  { left: "48%", top: "12%", delay: "0.7s", duration: "2.2s", tone: "bg-success/40" },
  { left: "58%", top: "28%", delay: "1.1s", duration: "2.7s", tone: "bg-primary/60" },
  { left: "68%", top: "10%", delay: "0.3s", duration: "2.3s", tone: "bg-warning/50" },
  { left: "78%", top: "26%", delay: "1.3s", duration: "2.5s", tone: "bg-success/60" },
  { left: "88%", top: "16%", delay: "0.6s", duration: "2.9s", tone: "bg-primary/45" }
];

const OnboardingComplete = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadBot = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBotById(id);
        if (!cancelled) {
          setBot(data);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(err?.message || t("onboardingComplete.errors.loadBot"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadBot();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const botSlug = useMemo(() => (bot?.slug || "").trim(), [bot?.slug]);

  const goToDemo = () => {
    if (!botSlug) return;
    navigate(`/demo/${encodeURIComponent(botSlug)}`);
  };

  const goToBots = () => {
    navigate("/app/bots");
  };

  if (!id) return null;

  return (
    <section className="auth-landing">
      <div className="lp-container">
        <div className="mx-auto w-full max-w-4xl py-10 md:py-14">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm md:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/10 to-transparent" />
              {CONFETTI_ITEMS.map((item, idx) => (
                <span
                  key={`confetti-${idx}`}
                  className={`absolute h-2.5 w-2.5 rounded-full ${item.tone} animate-bounce`}
                  style={{
                    left: item.left,
                    top: item.top,
                    animationDelay: item.delay,
                    animationDuration: item.duration
                  }}
                />
              ))}
            </div>

            <div className="relative mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success shadow-sm">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                <Sparkles className="h-3.5 w-3.5" />
                {t("onboardingComplete.badge")}
              </div>

              <h1 className="mt-4 font-display text-3xl font-semibold text-foreground md:text-4xl">
                {t("onboardingComplete.title")}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground md:text-base">
                {t("onboardingComplete.subtitle")}
              </p>

              {loading ? (
                <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("onboardingComplete.loading")}
                </div>
              ) : error ? (
                <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <p className="mt-6 text-sm text-foreground/90">
                  {t("onboardingComplete.readyWithName", {
                    name: bot?.name || t("onboardingComplete.fallbackBotName")
                  })}
                </p>
              )}

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button type="button" onClick={goToDemo} disabled={!botSlug}>
                  {t("onboardingComplete.tryAssistant")}
                </Button>
                <Button type="button" variant="outline" onClick={goToBots}>
                  {t("onboardingComplete.goToBots")}
                </Button>
              </div>

              {!loading && !botSlug && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("onboardingComplete.missingSlugHint")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OnboardingComplete;
