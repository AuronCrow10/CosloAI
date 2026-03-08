import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Trash2
} from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookingWeeklySchedule,
  Bot,
  BotChannel,
  Weekday,
  fetchChannels,
  getBotById,
  updateBot
} from "@/api/bots";
import { ALWAYS_ON_FEATURES } from "./onboardingFeatureHelpers";

const WEEKDAYS_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const BASE_BOOKING_FIELDS = ["name", "email", "phone", "service", "datetime"];
const DEFAULT_BOOKING_MIN_LEAD_HOURS = 3;
const DEFAULT_BOOKING_MAX_ADVANCE_DAYS = 30;
const DEFAULT_BOOKING_REMINDER_WINDOW_HOURS = 1;
const DEFAULT_BOOKING_REMINDER_MIN_LEAD_HOURS = 1;

const isConnectedChannel = (channel: BotChannel | null): boolean => {
  if (!channel) return false;
  const meta = (channel.meta as any) || {};
  return meta.needsReconnect !== true;
};

const hasLeadAdsConnectedChannels = (items: BotChannel[]): boolean => {
  const facebook = items.find((c) => c.type === "FACEBOOK") || null;
  const whatsapp = items.find((c) => c.type === "WHATSAPP") || null;
  return isConnectedChannel(facebook) && isConnectedChannel(whatsapp);
};

interface OpeningWindowForm {
  start: string;
  end: string;
  maxSimultaneousBookings: string;
}

interface DayScheduleForm {
  enabled: boolean;
  windows: OpeningWindowForm[];
}

type WeeklyScheduleForm = Record<Weekday, DayScheduleForm>;

interface ServiceForm {
  name: string;
  aliases: string;
  calendarId: string;
  durationMinutes: string;
  maxSimultaneousBookings: string;
  weeklySchedule: WeeklyScheduleForm;
  activeDay: Weekday;
}

interface BookingOnboardingForm {
  useCalendar: boolean;
  timeZone: string;
  bookingMinLeadHours: string;
  bookingMaxAdvanceDays: string;
  services: ServiceForm[];
}

const buildEmptyWeeklySchedule = (): WeeklyScheduleForm => {
  const schedule: Partial<WeeklyScheduleForm> = {};
  WEEKDAYS_ORDER.forEach((day) => {
    schedule[day] = {
      enabled: false,
      windows: [{ start: "", end: "", maxSimultaneousBookings: "" }]
    };
  });
  return schedule as WeeklyScheduleForm;
};

const toStringOrEmpty = (value: number | null | undefined): string =>
  typeof value === "number" ? String(value) : "";

const parseOptionalPositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const coerceNullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const coerceNumberWithDefault = (value: string, fallback: number): number => {
  const parsed = coerceNullableNumber(value);
  return parsed == null ? fallback : parsed;
};

const parseIntWithDefault = (value: string, defaultValue: number): number => {
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return Math.floor(parsed);
};

const parseBotIntWithDefault = (
  value: number | null | undefined,
  defaultValue: number
): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : defaultValue;

const normalizeTemplate = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeRequiredFields = (
  value: string[] | null | undefined
): string[] => {
  const deduped = new Set(BASE_BOOKING_FIELDS);
  if (Array.isArray(value)) {
    value.forEach((field) => {
      const trimmed = field.trim();
      if (trimmed) deduped.add(trimmed);
    });
  }
  return Array.from(deduped);
};

const fromApiSchedule = (
  apiSchedule: BookingWeeklySchedule | null | undefined,
  defaultSlots: string
): WeeklyScheduleForm => {
  const base = buildEmptyWeeklySchedule();

  if (!apiSchedule) return base;

  WEEKDAYS_ORDER.forEach((day) => {
    const windows = apiSchedule[day];
    if (windows && windows.length > 0) {
      base[day] = {
        enabled: true,
        windows: windows.map((w) => ({
          start: w.start,
          end: w.end,
          maxSimultaneousBookings:
            typeof w.maxSimultaneousBookings === "number"
              ? String(w.maxSimultaneousBookings)
              : defaultSlots
        }))
      };
    }
  });

  return base;
};

const normalizeWeeklyScheduleForApi = (
  formSchedule: WeeklyScheduleForm
): BookingWeeklySchedule | null => {
  const result: BookingWeeklySchedule = {};

  WEEKDAYS_ORDER.forEach((day) => {
    const dayForm = formSchedule[day];
    if (!dayForm.enabled) return;

    const validWindows: OpeningWindowForm[] = [];
    dayForm.windows.forEach((w) => {
      const start = w.start.trim();
      const end = w.end.trim();
      if (!start || !end) return;
      if (start >= end) return;
      validWindows.push({
        start,
        end,
        maxSimultaneousBookings: w.maxSimultaneousBookings
      });
    });

    if (validWindows.length > 0) {
      result[day] = validWindows.map((w) => ({
        start: w.start,
        end: w.end,
        maxSimultaneousBookings: parseOptionalPositiveInt(w.maxSimultaneousBookings)
      }));
    }
  });

  return Object.keys(result).length > 0 ? result : null;
};

const OnboardingBookingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [bot, setBot] = useState<Bot | null>(null);
  const [form, setForm] = useState<BookingOnboardingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeLeadAdsStep, setIncludeLeadAdsStep] = useState(false);

  const resolvePostBookingPath = async (botId: string): Promise<string> => {
    const channels = await fetchChannels(botId);
    if (hasLeadAdsConnectedChannels(channels)) {
      return `/onboarding/bots/${encodeURIComponent(botId)}/lead-ads`;
    }
    return `/onboarding/bots/${encodeURIComponent(botId)}/complete`;
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [botData, channels] = await Promise.all([
          getBotById(id),
          fetchChannels(id)
        ]);
        if (cancelled) return;

        if (botData.knowledgeSource === "SHOPIFY") {
          navigate("/app/bots", { replace: true });
          return;
        }
        setIncludeLeadAdsStep(hasLeadAdsConnectedChannels(channels));

        const servicesFromApi = Array.isArray(botData.bookingServices)
          ? botData.bookingServices
          : [];

        const services: ServiceForm[] =
          servicesFromApi.length > 0
            ? servicesFromApi.map((service) => {
                const schedule = fromApiSchedule(
                  service.weeklySchedule ?? null,
                  toStringOrEmpty(service.maxSimultaneousBookings)
                );
                const activeDay =
                  WEEKDAYS_ORDER.find((d) => schedule[d].enabled) ?? "monday";

                return {
                  name: service.name || "",
                  aliases: (service.aliases || []).join(", "),
                  calendarId: service.calendarId || "",
                  durationMinutes:
                    typeof service.durationMinutes === "number"
                      ? String(service.durationMinutes)
                      : "30",
                  maxSimultaneousBookings: toStringOrEmpty(
                    service.maxSimultaneousBookings
                  ),
                  weeklySchedule: schedule,
                  activeDay
                };
              })
            : [
                (() => {
                  const schedule = fromApiSchedule(
                    botData.bookingWeeklySchedule ?? null,
                    toStringOrEmpty(botData.bookingMaxSimultaneousBookings)
                  );
                  const activeDay =
                    WEEKDAYS_ORDER.find((d) => schedule[d].enabled) ?? "monday";

                  return {
                    name: "General",
                    aliases: "",
                    calendarId: botData.calendarId || "",
                    durationMinutes:
                      typeof botData.defaultDurationMinutes === "number"
                        ? String(botData.defaultDurationMinutes)
                        : "30",
                    maxSimultaneousBookings: toStringOrEmpty(
                      botData.bookingMaxSimultaneousBookings
                    ),
                    weeklySchedule: schedule,
                    activeDay
                  };
                })()
              ];

        setBot(botData);
        setForm({
          useCalendar: !!botData.useCalendar,
          timeZone: botData.timeZone || "",
          bookingMinLeadHours: toStringOrEmpty(botData.bookingMinLeadHours),
          bookingMaxAdvanceDays: toStringOrEmpty(botData.bookingMaxAdvanceDays),
          services
        });
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(err?.message || t("botSettings.errors.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, t]);

  const updateForm = (next: Partial<BookingOnboardingForm>) => {
    if (!form) return;
    setForm({ ...form, ...next });
  };

  const handleServiceChange =
    (index: number, field: keyof ServiceForm) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      const services = [...form.services];
      services[index] = { ...services[index], [field]: e.target.value };
      setForm({ ...form, services });
    };

  const handleServiceDayEnabledChange = (
    serviceIndex: number,
    day: Weekday,
    enabled: boolean
  ) => {
    if (!form) return;
    const services = [...form.services];
    const service = services[serviceIndex];
    services[serviceIndex] = {
      ...service,
      weeklySchedule: {
        ...service.weeklySchedule,
        [day]: {
          ...service.weeklySchedule[day],
          enabled
        }
      }
    };
    setForm({ ...form, services });
  };

  const handleServiceWindowChange = (
    serviceIndex: number,
    day: Weekday,
    index: number,
    field: "start" | "end" | "maxSimultaneousBookings",
    value: string
  ) => {
    if (!form) return;
    const services = [...form.services];
    const service = services[serviceIndex];
    const daySchedule = service.weeklySchedule[day];
    const windows = [...daySchedule.windows];
    windows[index] = {
      ...windows[index],
      [field]: value
    };
    services[serviceIndex] = {
      ...service,
      weeklySchedule: {
        ...service.weeklySchedule,
        [day]: {
          ...daySchedule,
          windows
        }
      }
    };
    setForm({ ...form, services });
  };

  const handleServiceAddWindow = (serviceIndex: number, day: Weekday) => {
    if (!form) return;
    const services = [...form.services];
    const service = services[serviceIndex];
    const daySchedule = service.weeklySchedule[day];
    services[serviceIndex] = {
      ...service,
      weeklySchedule: {
        ...service.weeklySchedule,
        [day]: {
          ...daySchedule,
          windows: [
            ...daySchedule.windows,
            { start: "", end: "", maxSimultaneousBookings: "" }
          ]
        }
      }
    };
    setForm({ ...form, services });
  };

  const handleServiceRemoveWindow = (
    serviceIndex: number,
    day: Weekday,
    index: number
  ) => {
    if (!form) return;
    const services = [...form.services];
    const service = services[serviceIndex];
    const daySchedule = service.weeklySchedule[day];
    const windows = daySchedule.windows.filter((_, i) => i !== index);
    services[serviceIndex] = {
      ...service,
      weeklySchedule: {
        ...service.weeklySchedule,
        [day]: {
          ...daySchedule,
          windows:
            windows.length > 0
              ? windows
              : [{ start: "", end: "", maxSimultaneousBookings: "" }]
        }
      }
    };
    setForm({ ...form, services });
  };
  const handleServiceActiveDayChange = (serviceIndex: number, day: Weekday) => {
    if (!form) return;
    const services = [...form.services];
    services[serviceIndex] = { ...services[serviceIndex], activeDay: day };
    setForm({ ...form, services });
  };

  const handleAddService = () => {
    if (!form) return;
    const services = [...form.services];
    if (services.length === 1 && !services[0].name.trim()) {
      services[0] = { ...services[0], name: "General" };
    }
    const newService: ServiceForm = {
      name: "",
      aliases: "",
      calendarId: "",
      durationMinutes: "30",
      maxSimultaneousBookings: "",
      weeklySchedule: buildEmptyWeeklySchedule(),
      activeDay: "monday"
    };
    setForm({ ...form, services: [...services, newService] });
  };

  const handleRemoveService = (index: number) => {
    if (!form) return;
    const services = form.services.filter((_, i) => i !== index);
    setForm({ ...form, services: services.length ? services : [] });
  };

  const handleSkip = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const nextPath = await resolvePostBookingPath(id);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!id || !form) return;

    setSaving(true);
    setError(null);

    try {
      if (!form.useCalendar) {
        await updateBot(id, {
          ...ALWAYS_ON_FEATURES,
          useCalendar: false
        });
        const nextPath = await resolvePostBookingPath(id);
        navigate(nextPath, { replace: true });
        return;
      }

      for (const service of form.services) {
        for (const day of WEEKDAYS_ORDER) {
          const dayForm = service.weeklySchedule[day];
          if (!dayForm.enabled) continue;
          for (const w of dayForm.windows) {
            const slots = parseOptionalPositiveInt(w.maxSimultaneousBookings);
            if (!slots) {
              setError(t("botSettings.sections.availability.slotsRequired"));
              return;
            }
          }
        }
      }

      const isMultiService = form.services.length > 1;
      const bookingServices = form.services
        .map((service) => {
          const name = service.name.trim();
          const calendarId = service.calendarId.trim();
          if (isMultiService && !name) return null;
          if (!calendarId) return null;

          const durationMinutes = coerceNumberWithDefault(
            service.durationMinutes,
            30
          );
          const weeklySchedule = normalizeWeeklyScheduleForApi(
            service.weeklySchedule
          );
          const aliases = service.aliases
            .split(",")
            .map((alias) => alias.trim())
            .filter((alias) => alias.length > 0);

          return {
            name: name || "General",
            aliases,
            calendarId,
            durationMinutes,
            maxSimultaneousBookings: coerceNullableNumber(
              service.maxSimultaneousBookings
            ),
            weeklySchedule
          };
        })
        .filter(Boolean) as Array<{
          name: string;
          aliases: string[];
          calendarId: string;
          durationMinutes: number;
          maxSimultaneousBookings: number | null;
          weeklySchedule: BookingWeeklySchedule | null;
        }>;

      if (isMultiService && bookingServices.length !== form.services.length) {
        setError(t("botSettings.onboarding.booking.serviceNameRequired"));
        return;
      }

      if (bookingServices.length === 0) {
        setError(t("botSettings.onboarding.booking.servicesRequired"));
        return;
      }

      const primary = bookingServices[0];
      const bookingRequiredFields = normalizeRequiredFields(
        bot?.bookingRequiredFields
      );

      const basePayload = {
        ...ALWAYS_ON_FEATURES,
        useCalendar: true,
        timeZone: form.timeZone.trim() || null,
        bookingMinLeadHours: parseIntWithDefault(
          form.bookingMinLeadHours,
          DEFAULT_BOOKING_MIN_LEAD_HOURS
        ),
        bookingMaxAdvanceDays: parseIntWithDefault(
          form.bookingMaxAdvanceDays,
          DEFAULT_BOOKING_MAX_ADVANCE_DAYS
        ),
        bookingReminderWindowHours: parseBotIntWithDefault(
          bot?.bookingReminderWindowHours,
          DEFAULT_BOOKING_REMINDER_WINDOW_HOURS
        ),
        bookingReminderMinLeadHours: parseBotIntWithDefault(
          bot?.bookingReminderMinLeadHours,
          DEFAULT_BOOKING_REMINDER_MIN_LEAD_HOURS
        ),
        bookingConfirmationEmailEnabled:
          bot?.bookingConfirmationEmailEnabled ?? true,
        bookingReminderEmailEnabled: bot?.bookingReminderEmailEnabled ?? true,
        bookingConfirmationSubjectTemplate: normalizeTemplate(
          bot?.bookingConfirmationSubjectTemplate
        ),
        bookingReminderSubjectTemplate: normalizeTemplate(
          bot?.bookingReminderSubjectTemplate
        ),
        bookingCancellationSubjectTemplate: normalizeTemplate(
          bot?.bookingCancellationSubjectTemplate
        ),
        bookingConfirmationBodyTextTemplate: normalizeTemplate(
          bot?.bookingConfirmationBodyTextTemplate
        ),
        bookingReminderBodyTextTemplate: normalizeTemplate(
          bot?.bookingReminderBodyTextTemplate
        ),
        bookingCancellationBodyTextTemplate: normalizeTemplate(
          bot?.bookingCancellationBodyTextTemplate
        ),
        bookingConfirmationBodyHtmlTemplate: normalizeTemplate(
          bot?.bookingConfirmationBodyHtmlTemplate
        ),
        bookingReminderBodyHtmlTemplate: normalizeTemplate(
          bot?.bookingReminderBodyHtmlTemplate
        ),
        bookingCancellationBodyHtmlTemplate: normalizeTemplate(
          bot?.bookingCancellationBodyHtmlTemplate
        ),
        bookingRequiredFields
      };

      const updated = await updateBot(id, {
        ...basePayload,
        bookingServices,
        calendarId: primary?.calendarId || null,
        defaultDurationMinutes: primary?.durationMinutes || 30,
        bookingMaxSimultaneousBookings:
          primary?.maxSimultaneousBookings ?? null,
        bookingWeeklySchedule: primary?.weeklySchedule ?? null
      });

      setBot(updated);
      const nextPath = await resolvePostBookingPath(id);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botSettings.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!id) return null;

  const isMultiService = form ? form.services.length > 1 : false;

  return (
    <OnboardingLayout
      currentStep="booking"
      botId={id}
      flow="assistantType"
      includeAssistantBookingStep={bot?.knowledgeSource === "RAG"}
      includeAssistantLeadAdsStep={includeLeadAdsStep}
      title={t("botSettings.onboarding.booking.title")}
      subtitle={t("botSettings.onboarding.booking.subtitle")}
      layout="full"
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading || !form ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 shadow-sm md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {t("botSettings.onboarding.booking.toggleTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {form.useCalendar
                      ? t("botSettings.onboarding.booking.toggleSubtitle")
                      : t("botSettings.onboarding.booking.toggleOffHint")}
                  </p>
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 transition hover:border-primary/30">
                <input
                  type="checkbox"
                  checked={form.useCalendar}
                  onChange={(e) => updateForm({ useCalendar: e.target.checked })}
                />
                <span className="text-sm font-medium text-foreground">
                  {form.useCalendar
                    ? t("botSettings.onboarding.booking.toggleOn")
                    : t("botSettings.onboarding.booking.toggleOff")}
                </span>
              </label>
            </section>

            {form.useCalendar && (
              <>
                <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 shadow-sm md:p-6">
                  <div className="flex items-center gap-2 text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold md:text-base">
                      {t("botSettings.sections.timezone.title")}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("botSettings.sections.timezone.hint")}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>{t("botSettings.fields.timeZone.label")}</Label>
                      <Input
                        className="mt-1"
                        value={form.timeZone}
                        onChange={(e) => updateForm({ timeZone: e.target.value })}
                        placeholder={t("botSettings.fields.timeZone.placeholder")}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botSettings.fields.timeZone.help")}
                      </p>
                    </div>

                    <div>
                      <Label>{t("botSettings.fields.bookingMinLeadHours.label")}</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingMinLeadHours}
                        onChange={(e) =>
                          updateForm({ bookingMinLeadHours: e.target.value })
                        }
                        placeholder={t("botSettings.fields.bookingMinLeadHours.placeholder")}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botSettings.fields.bookingMinLeadHours.help")}
                      </p>
                    </div>

                    <div>
                      <Label>{t("botSettings.fields.bookingMaxAdvanceDays.label")}</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingMaxAdvanceDays}
                        onChange={(e) =>
                          updateForm({ bookingMaxAdvanceDays: e.target.value })
                        }
                        placeholder={t("botSettings.fields.bookingMaxAdvanceDays.placeholder")}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("botSettings.fields.bookingMaxAdvanceDays.help")}
                      </p>
                    </div>
                  </div>
                </section>
                <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground md:text-base">
                        {t("botSettings.sections.services.title")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("botSettings.sections.services.hint")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddService}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("botSettings.sections.services.add")}
                    </Button>
                  </div>

                  <div className="space-y-6">
                    {form.services.map((service, serviceIndex) => {
                      const day = service.activeDay;
                      const dayForm = service.weeklySchedule[day];

                      return (
                        <article
                          key={`service-${serviceIndex}`}
                          className="space-y-4 rounded-xl border border-border bg-background/70 p-4 shadow-sm md:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-medium text-foreground">
                                {service.name ||
                                  t("botSettings.sections.services.unnamed")}
                              </h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t("botSettings.sections.services.cardHint")}
                              </p>
                            </div>

                            {form.services.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveService(serviceIndex)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                {t("botSettings.sections.services.remove")}
                              </Button>
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label>
                                {isMultiService
                                  ? t("botSettings.services.fields.name")
                                  : t("botSettings.services.fields.labelOptional")}
                              </Label>
                              <Input
                                className="mt-1"
                                value={service.name}
                                onChange={handleServiceChange(serviceIndex, "name")}
                                placeholder={t(
                                  isMultiService
                                    ? "botSettings.services.fields.namePlaceholder"
                                    : "botSettings.services.fields.labelPlaceholder"
                                )}
                              />
                            </div>

                            <div>
                              <Label>{t("botSettings.services.fields.aliases")}</Label>
                              <Input
                                className="mt-1"
                                value={service.aliases}
                                onChange={handleServiceChange(serviceIndex, "aliases")}
                                placeholder={t(
                                  "botSettings.services.fields.aliasesPlaceholder"
                                )}
                              />
                            </div>

                            <div>
                              <Label>{t("botSettings.fields.calendarId.label")}</Label>
                              <Input
                                className="mt-1"
                                value={service.calendarId}
                                onChange={handleServiceChange(serviceIndex, "calendarId")}
                                placeholder={t("botSettings.fields.calendarId.placeholder")}
                              />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t("botSettings.fields.calendarId.help")} <code>primary</code>
                              </p>
                            </div>

                            <div>
                              <Label>{t("botSettings.services.fields.duration")}</Label>
                              <Input
                                className="mt-1"
                                type="number"
                                min={5}
                                max={480}
                                value={service.durationMinutes}
                                onChange={handleServiceChange(
                                  serviceIndex,
                                  "durationMinutes"
                                )}
                                placeholder={t(
                                  "botSettings.fields.defaultDurationMinutes.placeholder"
                                )}
                              />
                            </div>
                          </div>

                          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
                            {WEEKDAYS_ORDER.map((dayKey) => {
                              const isActive = service.activeDay === dayKey;
                              const isEnabled = service.weeklySchedule[dayKey].enabled;
                              return (
                                <button
                                  key={`${serviceIndex}-${dayKey}`}
                                  type="button"
                                  onClick={() =>
                                    handleServiceActiveDayChange(serviceIndex, dayKey)
                                  }
                                  className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition sm:min-w-0 sm:flex-1 ${
                                    isActive
                                      ? "border-primary/60 bg-primary/10 ring-1 ring-primary/20"
                                      : "border-border bg-card hover:border-primary/30"
                                  }`}
                                >
                                  <div className="font-medium capitalize text-foreground">
                                    {t(`botSettings.weekdays.${dayKey}`)}
                                  </div>
                                  <div
                                    className={`mt-1 h-1.5 w-1.5 rounded-full ${
                                      isEnabled ? "bg-success" : "bg-muted-foreground/40"
                                    }`}
                                    aria-hidden="true"
                                  />
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-4 rounded-lg border border-border bg-card/80 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h5 className="font-medium capitalize text-foreground">
                                  {t(`botSettings.weekdays.${day}`)}
                                </h5>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {dayForm.enabled
                                    ? t("botSettings.sections.availability.enabledHint")
                                    : t("botSettings.sections.availability.disabledHint")}
                                </p>
                              </div>

                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={dayForm.enabled}
                                  onChange={(e) =>
                                    handleServiceDayEnabledChange(
                                      serviceIndex,
                                      day,
                                      e.target.checked
                                    )
                                  }
                                />
                                <span>
                                  {t("botSettings.sections.availability.acceptBookings")}
                                </span>
                              </label>
                            </div>

                            <div className="space-y-3">
                              {dayForm.windows.map((window, idx) => {
                                const slotsInvalid =
                                  dayForm.enabled &&
                                  !parseOptionalPositiveInt(
                                    window.maxSimultaneousBookings
                                  );

                                return (
                                  <div
                                    key={`${serviceIndex}-${day}-${idx}`}
                                    className="rounded-lg border border-border bg-background/80 p-3"
                                  >
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                      <div>
                                        <Label className="text-xs">
                                          {t("botSettings.sections.availability.from")}
                                        </Label>
                                        <Input
                                          className="mt-1"
                                          type="time"
                                          value={window.start}
                                          onChange={(e) =>
                                            handleServiceWindowChange(
                                              serviceIndex,
                                              day,
                                              idx,
                                              "start",
                                              e.target.value
                                            )
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">
                                          {t("botSettings.sections.availability.to")}
                                        </Label>
                                        <Input
                                          className="mt-1"
                                          type="time"
                                          value={window.end}
                                          onChange={(e) =>
                                            handleServiceWindowChange(
                                              serviceIndex,
                                              day,
                                              idx,
                                              "end",
                                              e.target.value
                                            )
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">
                                          {t("botSettings.sections.availability.slots")}
                                        </Label>
                                        <Input
                                          className={`mt-1 ${
                                            slotsInvalid ? "border-destructive" : ""
                                          }`}
                                          type="number"
                                          min={1}
                                          value={window.maxSimultaneousBookings}
                                          onChange={(e) =>
                                            handleServiceWindowChange(
                                              serviceIndex,
                                              day,
                                              idx,
                                              "maxSimultaneousBookings",
                                              e.target.value
                                            )
                                          }
                                          placeholder={t(
                                            "botSettings.sections.availability.slotsPlaceholder"
                                          )}
                                        />
                                        {slotsInvalid && (
                                          <p className="mt-1 text-xs text-destructive">
                                            {t(
                                              "botSettings.sections.availability.slotsRequired"
                                            )}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-end justify-start lg:justify-end">
                                        {idx > 0 ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="w-full text-destructive hover:text-destructive sm:w-auto"
                                            onClick={() =>
                                              handleServiceRemoveWindow(
                                                serviceIndex,
                                                day,
                                                idx
                                              )
                                            }
                                          >
                                            <Trash2 className="mr-1 h-4 w-4" />
                                            {t(
                                              "botSettings.sections.availability.removeRange"
                                            )}
                                          </Button>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            {t("botSettings.sections.availability.note")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleServiceAddWindow(serviceIndex, day)}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              {t("botSettings.sections.availability.addRange")}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  navigate(`/onboarding/bots/${encodeURIComponent(id)}/channels`)
                }
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {t("common.back")}
              </Button>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleSkip}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  {t("botSettings.onboarding.common.skip")}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("botSettings.onboarding.booking.finish")}
                </Button>
              </div>
            </div>

            {!form.useCalendar && (
              <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {t("botSettings.onboarding.booking.toggleOffHint")}
              </div>
            )}
          </>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingBookingPage;
