// src/pages/app/BotSettingsPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bot, getBotById, updateBot, BookingWeeklySchedule, Weekday } from "@/api/bots";

const BASE_BOOKING_FIELDS = ["name", "email", "phone", "service", "datetime"];


const WEEKDAYS_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

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

interface SettingsForm {
  // Bot basics
  timeZone: string;
  calendarId: string;

  // Booking & reminders
  bookingMinLeadHours: string;
  bookingMaxAdvanceDays: string;
  bookingReminderWindowHours: string;
  bookingReminderMinLeadHours: string;

  // Emails
  bookingConfirmationEmailEnabled: boolean;
  bookingReminderEmailEnabled: boolean;

  bookingConfirmationSubjectTemplate: string;
  bookingReminderSubjectTemplate: string;
  bookingCancellationSubjectTemplate: string;    // NEW

  bookingConfirmationBodyTextTemplate: string;
  bookingReminderBodyTextTemplate: string;
  bookingCancellationBodyTextTemplate: string;   // NEW

  bookingConfirmationBodyHtmlTemplate: string;
  bookingReminderBodyHtmlTemplate: string;
  bookingCancellationBodyHtmlTemplate: string;

  customBookingFields: string[];
  services: ServiceForm[];
}

type StringFieldKey =
  | "calendarId"
  | "timeZone"
  | "bookingMinLeadHours"
  | "bookingMaxAdvanceDays"
  | "bookingReminderWindowHours"
  | "bookingReminderMinLeadHours"
  | "bookingConfirmationSubjectTemplate"
  | "bookingReminderSubjectTemplate"
  | "bookingCancellationSubjectTemplate"
  | "bookingConfirmationBodyTextTemplate"
  | "bookingReminderBodyTextTemplate"
  | "bookingCancellationBodyTextTemplate"
  | "bookingConfirmationBodyHtmlTemplate"
  | "bookingReminderBodyHtmlTemplate"
  | "bookingCancellationBodyHtmlTemplate";

type ToggleFieldKey =
  | "bookingConfirmationEmailEnabled"
  | "bookingReminderEmailEnabled";

const BotSettings: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [bot, setBot] = useState<Bot | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [newCustomField, setNewCustomField] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const fromApiSchedule = (
    apiSchedule: BookingWeeklySchedule | null | undefined,
    defaultSlots: string
  ): WeeklyScheduleForm => {
    const base = buildEmptyWeeklySchedule();

    if (!apiSchedule) {
      return base;
    }

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

  const parseOptionalPositiveInt = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  };

  const normalizeWeeklyScheduleForApi = (
    formSchedule: WeeklyScheduleForm
  ): BookingWeeklySchedule | null => {
    const result: BookingWeeklySchedule = {};

    WEEKDAYS_ORDER.forEach((day) => {
      const dayForm = formSchedule[day];
      if (!dayForm.enabled) {
        return;
      }

      const validWindows: OpeningWindowForm[] = [];
      dayForm.windows.forEach((w) => {
        const start = w.start.trim();
        const end = w.end.trim();
        if (!start || !end) return;
        if (start >= end) return; // ignore invalid ranges
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
          maxSimultaneousBookings: parseOptionalPositiveInt(
            w.maxSimultaneousBookings
          )
        }));
      }
    });

    return Object.keys(result).length > 0 ? result : null;
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    getBotById(id)
      .then((botData) => {
        setBot(botData);

        const existingRequired = botData.bookingRequiredFields || [];
        const customFields = existingRequired.filter(
          (f) => !BASE_BOOKING_FIELDS.includes(f)
        );

        const toStringOrEmpty = (value: number | null | undefined): string =>
          typeof value === "number" ? String(value) : "";
        const toStringOrDefault = (
          value: number | null | undefined,
          fallback: number
        ): string => (typeof value === "number" ? String(value) : String(fallback));

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
                    durationMinutes: botData.defaultDurationMinutes
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

        setForm({
          // Bot basics
          timeZone: botData.timeZone || "",
          calendarId: botData.calendarId || "",

          // Booking rules
          bookingMinLeadHours: toStringOrEmpty(botData.bookingMinLeadHours),
          bookingMaxAdvanceDays: toStringOrEmpty(botData.bookingMaxAdvanceDays),
          bookingReminderWindowHours: toStringOrDefault(
            botData.bookingReminderWindowHours,
            1
          ),
          bookingReminderMinLeadHours: toStringOrDefault(
            botData.bookingReminderMinLeadHours,
            1
          ),

          // Email toggles
            bookingConfirmationEmailEnabled:
              botData.bookingConfirmationEmailEnabled ?? true,
            bookingReminderEmailEnabled:
              botData.bookingReminderEmailEnabled ?? true,

          // Email templates
          bookingConfirmationSubjectTemplate:
            botData.bookingConfirmationSubjectTemplate ?? "",
          bookingReminderSubjectTemplate:
            botData.bookingReminderSubjectTemplate ?? "",
          bookingCancellationSubjectTemplate:
            botData.bookingCancellationSubjectTemplate ?? "",
          bookingConfirmationBodyTextTemplate:
            botData.bookingConfirmationBodyTextTemplate ?? "",
          bookingReminderBodyTextTemplate:
            botData.bookingReminderBodyTextTemplate ?? "",
          bookingCancellationBodyTextTemplate:
            botData.bookingCancellationBodyTextTemplate ?? "",
          bookingConfirmationBodyHtmlTemplate:
            botData.bookingConfirmationBodyHtmlTemplate ?? "",
          bookingReminderBodyHtmlTemplate:
            botData.bookingReminderBodyHtmlTemplate ?? "",
          bookingCancellationBodyHtmlTemplate:             // NEW
            botData.bookingCancellationBodyHtmlTemplate ?? "",

          // Booking fields
          customBookingFields: customFields,
          services,
        });
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botSettings.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  const handleStringFieldChange =
    (field: StringFieldKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!form) return;
      const value = e.target.value;
      setForm({ ...form, [field]: value });
    };

  const handleToggleChange =
    (field: ToggleFieldKey) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      setForm({ ...form, [field]: e.target.checked });
    };

  const handleAddCustomField = () => {
    if (!form) return;

    const trimmed = newCustomField.trim();
    if (!trimmed) return;

    // Avoid duplicates, case-insensitive
    const exists = form.customBookingFields.some(
      (f) => f.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists || BASE_BOOKING_FIELDS.includes(trimmed)) {
      setNewCustomField("");
      return;
    }

    setForm({
      ...form,
      customBookingFields: [...form.customBookingFields, trimmed]
    });
    setNewCustomField("");
  };

  const handleRemoveCustomField = (field: string) => {
    if (!form) return;
    setForm({
      ...form,
      customBookingFields: form.customBookingFields.filter((f) => f !== field)
    });
  };

  const handleServiceChange =
    (index: number, field: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      const services = [...form.services];
      services[index] = { ...services[index], [field]: e.target.value };
      setForm({ ...form, services });
    };

  const handleServiceDayEnabledChange = (
    serviceIndex: number,
    day: Weekday,
    enabled: boolean
  ): void => {
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
  ): void => {
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

  const handleServiceAddWindow = (
    serviceIndex: number,
    day: Weekday
  ): void => {
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
  ): void => {
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

  const handleServiceActiveDayChange = (
    serviceIndex: number,
    day: Weekday
  ): void => {
    if (!form) return;
    const services = [...form.services];
    services[serviceIndex] = { ...services[serviceIndex], activeDay: day };
    setForm({ ...form, services });
  };

  const handleAddService = (): void => {
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

  const handleRemoveService = (index: number): void => {
    if (!form) return;
    const services = form.services.filter((_, i) => i !== index);
    setForm({ ...form, services: services.length ? services : [] });
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

  const normalizeTemplate = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const handleSave: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!id || !form) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanedCustomFields = Array.from(
        new Set(
          form.customBookingFields
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        )
      );

      const bookingRequiredFields =
        cleanedCustomFields.length > 0
          ? [...BASE_BOOKING_FIELDS, ...cleanedCustomFields]
          : [...BASE_BOOKING_FIELDS];

      const basePayload = {
        timeZone: form.timeZone.trim() || null,
        calendarId: form.calendarId.trim() || null,
        bookingMinLeadHours: coerceNullableNumber(form.bookingMinLeadHours),
        bookingMaxAdvanceDays: coerceNullableNumber(form.bookingMaxAdvanceDays),
        bookingReminderWindowHours: coerceNumberWithDefault(
          form.bookingReminderWindowHours,
          1
        ),
        bookingReminderMinLeadHours: coerceNumberWithDefault(
          form.bookingReminderMinLeadHours,
          1
        ),
        bookingConfirmationEmailEnabled: form.bookingConfirmationEmailEnabled,
        bookingReminderEmailEnabled: form.bookingReminderEmailEnabled,
        bookingConfirmationSubjectTemplate: normalizeTemplate(
          form.bookingConfirmationSubjectTemplate
        ),
        bookingReminderSubjectTemplate: normalizeTemplate(
          form.bookingReminderSubjectTemplate
        ),
        bookingCancellationSubjectTemplate: normalizeTemplate(
          form.bookingCancellationSubjectTemplate
        ),
        bookingConfirmationBodyTextTemplate: normalizeTemplate(
          form.bookingConfirmationBodyTextTemplate
        ),
        bookingReminderBodyTextTemplate: normalizeTemplate(
          form.bookingReminderBodyTextTemplate
        ),
        bookingCancellationBodyTextTemplate: normalizeTemplate(
          form.bookingCancellationBodyTextTemplate
        ),
        bookingConfirmationBodyHtmlTemplate: normalizeTemplate(
          form.bookingConfirmationBodyHtmlTemplate
        ),
        bookingReminderBodyHtmlTemplate: normalizeTemplate(
          form.bookingReminderBodyHtmlTemplate
        ),
        bookingCancellationBodyHtmlTemplate: normalizeTemplate(
          form.bookingCancellationBodyHtmlTemplate
        ),
        bookingRequiredFields
      };

      for (const service of form.services) {
        for (const day of WEEKDAYS_ORDER) {
          const dayForm = service.weeklySchedule[day];
          if (!dayForm.enabled) continue;
          for (const w of dayForm.windows) {
            const slots = parseOptionalPositiveInt(
              w.maxSimultaneousBookings
            );
            if (!slots) {
              setError(
                t("botSettings.sections.availability.slotsRequired")
              );
              return;
            }
          }
        }
      }

      let updated: Bot;
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
        setError(
          t("botSettings.onboarding.booking.serviceNameRequired")
        );
        return;
      }
      if (bookingServices.length === 0) {
        setError(
          t("botSettings.onboarding.booking.servicesRequired")
        );
        return;
      }

      const primary = bookingServices[0];

      updated = await updateBot(id, {
        ...basePayload,
        bookingServices,
        calendarId: primary?.calendarId || null,
        defaultDurationMinutes: primary?.durationMinutes || 30,
          bookingMaxSimultaneousBookings:
            primary?.maxSimultaneousBookings ?? null,
          bookingWeeklySchedule: primary?.weeklySchedule ?? null
      });

      setBot(updated);
      setSuccess(t("botSettings.success.saved"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botSettings.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="page-container">
        <p>{t("botSettings.missingId")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <p>{t("botSettings.loading")}</p>
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="page-container">
        <h1>{t("botSettings.title")}</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!bot || !form) {
    return (
      <div className="page-container">
        <h1>{t("botSettings.title")}</h1>
        <p>{t("botSettings.notFound")}</p>
      </div>
    );
  }

  const warningClass =
    "alert-warning mb-4 border border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-100";

  const calendarEnabled = bot.useCalendar;

  const isMultiService = form.services.length > 1;

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="bot-title">{t("botSettings.title")}</h1>
        </div>

        <div className="page-header-actions">
          <Link to={`/app/bots/${bot.id}`} className="btn-secondary">
            {t("botSettings.backToOverview")}
          </Link>
        </div>
      </div>

      <div className="detail-layout">
        {/* MAIN */}
        <section className="detail-main bot-settings-main">
          <p className="muted bot-settings-intro">{t("botSettings.intro")}</p>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          {!calendarEnabled && (
            <div className={warningClass}>
              <strong>{t("botSettings.calendarDisabled.title")}</strong>{" "}
              {t("botSettings.calendarDisabled.body")}{" "}
              <Link to={`/app/bots/${bot.id}/features`}>
                {t("botSettings.featuresAndPlan")}
              </Link>
              .
            </div>
          )}

          <form className="form" onSubmit={handleSave}>
            {/* CALENDAR BASICS */}
            <fieldset className="form-fieldset bot-settings-section">
              <legend>{t("botSettings.sections.timezone.title")}</legend>

              <p className="muted bot-settings-hint">
                {t("botSettings.sections.timezone.hint")}
              </p>

              <div className="bot-settings-grid">
                <label className="form-field">
                  <span>{t("botSettings.fields.timeZone.label")}</span>
                  <input
                    type="text"
                    value={form.timeZone}
                    onChange={handleStringFieldChange("timeZone")}
                    placeholder={t("botSettings.fields.timeZone.placeholder")}
                  />
                  <span className="bot-settings-help">
                    {t("botSettings.fields.timeZone.help")}
                  </span>
                </label>
              </div>
            </fieldset>

            
            <fieldset className="form-fieldset bot-settings-section">
              <legend>{t("botSettings.sections.services.title")}</legend>

              <p className="muted bot-settings-hint">
                {t("botSettings.sections.services.hint")}
              </p>

              {form.services.map((service, serviceIndex) => (
                <div key={serviceIndex} className="booking-day-detail-card mb-5">
                  <div className="booking-day-detail-header">
                    <div>
                      <h3 className="booking-day-detail-title">
                        {service.name || t("botSettings.sections.services.unnamed")}
                      </h3>
                      <p className="booking-day-detail-subtitle">
                        {t("botSettings.sections.services.cardHint")}
                      </p>
                    </div>
                    {form.services.length > 1 && (
                      <button
                        type="button"
                        className="btn-link booking-remove-range"
                        onClick={() => handleRemoveService(serviceIndex)}
                      >
                        {t("botSettings.sections.services.remove")}
                      </button>
                    )}
                  </div>

                  <div className="bot-settings-grid mb-4">
                    <label className="form-field">
                      <span>
                        {isMultiService
                          ? t("botSettings.services.fields.name")
                          : t("botSettings.services.fields.labelOptional")}
                      </span>
                      <input
                        type="text"
                        value={service.name}
                        onChange={handleServiceChange(serviceIndex, "name")}
                        placeholder={t(
                          isMultiService
                            ? "botSettings.services.fields.namePlaceholder"
                            : "botSettings.services.fields.labelPlaceholder",
                          isMultiService ? "e.g. Haircut" : "e.g. General"
                        )}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.services.fields.aliases")}</span>
                      <input
                        type="text"
                        value={service.aliases}
                        onChange={handleServiceChange(serviceIndex, "aliases")}
                        placeholder={t("botSettings.services.fields.aliasesPlaceholder")}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.fields.calendarId.label")}</span>
                      <input
                        type="text"
                        value={service.calendarId}
                        onChange={handleServiceChange(serviceIndex, "calendarId")}
                        placeholder={t("botSettings.fields.calendarId.placeholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.fields.calendarId.help")} <code>primary</code>
                      </span>
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.services.fields.duration")}</span>
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={service.durationMinutes}
                        onChange={handleServiceChange(serviceIndex, "durationMinutes")}
                        placeholder={t("botSettings.fields.defaultDurationMinutes.placeholder")}
                      />
                    </label>

                  </div>

                  <div className="booking-day-tabs">
                    {WEEKDAYS_ORDER.map((dayKey) => {
                      const dayForm = service.weeklySchedule[dayKey];
                      const isActive = service.activeDay === dayKey;
                      const isEnabled = dayForm.enabled;

                      const className = [
                        "booking-day-pill",
                        isActive && "booking-day-pill--active"
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <button
                          key={`${serviceIndex}-${dayKey}`}
                          type="button"
                          className={className}
                          onClick={() =>
                            handleServiceActiveDayChange(serviceIndex, dayKey)
                          }
                        >
                          <span className="booking-day-pill-label">
                            {t(`botSettings.weekdays.${dayKey}`)}
                          </span>
                          <span
                            className={
                              "booking-day-pill-dot" +
                              (isEnabled ? " booking-day-pill-dot--on" : "")
                            }
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const day = service.activeDay;
                    const dayForm = service.weeklySchedule[day];

                    return (
                      <div className="booking-day-detail-card">
                        <div className="booking-day-detail-header">
                          <div>
                            <h3 className="booking-day-detail-title">
                              {t(`botSettings.weekdays.${day}`)}
                            </h3>
                            <p className="booking-day-detail-subtitle">
                              {dayForm.enabled
                                ? t("botSettings.sections.availability.enabledHint")
                                : t("botSettings.sections.availability.disabledHint")}
                            </p>
                          </div>

                          <label className="booking-toggle">
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
                            <span className="booking-toggle-slider" />
                            <span className="booking-toggle-label">
                              {t("botSettings.sections.availability.acceptBookings")}
                            </span>
                          </label>
                        </div>

                        <div className="booking-day-ranges">
                          {dayForm.windows.map((window, idx) => (
                            <div key={`${serviceIndex}-${day}-${idx}`} className="booking-day-range-row">
                              <div className="booking-day-range-inputs">
                                <label>
                                  <span className="booking-range-label">
                                    {t("botSettings.sections.availability.from")}
                                  </span>
                                  <input
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
                                </label>

                                <label>
                                  <span className="booking-range-label">
                                    {t("botSettings.sections.availability.to")}
                                  </span>
                                  <input
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
                                </label>

                                <label>
                                  <span className="booking-range-label">
                                    {t("botSettings.sections.availability.slots")}
                                  </span>
                                  {(() => {
                                    const slotsInvalid =
                                      dayForm.enabled &&
                                      !parseOptionalPositiveInt(
                                        window.maxSimultaneousBookings
                                      );
                                    return (
                                      <>
                                        <input
                                          type="number"
                                          min={1}
                                          className={
                                            slotsInvalid ? "input-error" : undefined
                                          }
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
                                          placeholder={t("botSettings.sections.availability.slotsPlaceholder")}
                                        />
                                        {slotsInvalid && (
                                          <div className="field-error">
                                            {t("botSettings.sections.availability.slotsRequired")}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </label>
                              </div>

                              {idx > 0 && (
                                <button
                                  type="button"
                                  className="btn-link booking-remove-range"
                                  onClick={() =>
                                    handleServiceRemoveWindow(
                                      serviceIndex,
                                      day,
                                      idx
                                    )
                                  }
                                >
                                  {t("botSettings.sections.availability.removeRange")}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="btn-secondary btn-xs booking-add-range btn-color"
                          onClick={() => handleServiceAddWindow(serviceIndex, day)}
                        >
                          {t("botSettings.sections.availability.addRange")}
                        </button>

                        <p className="muted bot-settings-hint">
                          {t("botSettings.sections.availability.note")}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ))}

              <button
                type="button"
                className="btn-secondary booking-custom-field-add-btn"
                onClick={handleAddService}
              >
                {t("botSettings.sections.services.add")}
              </button>
            </fieldset>

            

            {/* Booking rules */}
                <fieldset className="form-fieldset bot-settings-section">
                  <legend>{t("botSettings.sections.bookingRules.title")}</legend>

                <p className="muted bot-settings-hint">
                  {t("botSettings.sections.bookingRules.hint")}
                </p>

                  <div className="bot-settings-grid">
                    <label className="form-field">
                      <span>{t("botSettings.fields.bookingMinLeadHours.label")}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingMinLeadHours}
                        onChange={handleStringFieldChange("bookingMinLeadHours")}
                        placeholder={t("botSettings.fields.bookingMinLeadHours.placeholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.fields.bookingMinLeadHours.help")}
                      </span>
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.fields.bookingMaxAdvanceDays.label")}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingMaxAdvanceDays}
                        onChange={handleStringFieldChange("bookingMaxAdvanceDays")}
                        placeholder={t("botSettings.fields.bookingMaxAdvanceDays.placeholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.fields.bookingMaxAdvanceDays.help")}
                      </span>
                    </label>
                </div>
              </fieldset>

            {/* ADVANCED TOGGLE */}
            <div
              className={`flex items-center justify-between mt-4 ${advancedOpen ? "mb-2.5" : ""}`}
            >
              <span className="bot-settings-help">
                {t("botSettings.advanced.prompt")}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                {advancedOpen
                  ? t("botSettings.advanced.hide")
                  : t("botSettings.advanced.show")}
              </button>
            </div>

            {/* ADVANCED SETTINGS */}
            {advancedOpen && (
              <>
                {/* Reminder rules */}
                <fieldset className="form-fieldset bot-settings-section">
                  <legend>{t("botSettings.sections.reminderWindow.title")}</legend>

                  <p className="muted bot-settings-hint">
                    {t("botSettings.sections.reminderWindow.hint")}
                  </p>

                  <div className="bot-settings-grid">
                    <label className="form-field">
                      <span>{t("botSettings.fields.bookingReminderWindowHours.label")}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingReminderWindowHours}
                        onChange={handleStringFieldChange("bookingReminderWindowHours")}
                        placeholder={t("botSettings.fields.bookingReminderWindowHours.placeholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.fields.bookingReminderWindowHours.help")}
                      </span>
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.fields.bookingReminderMinLeadHours.label")}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.bookingReminderMinLeadHours}
                        onChange={handleStringFieldChange("bookingReminderMinLeadHours")}
                        placeholder={t("botSettings.fields.bookingReminderMinLeadHours.placeholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.fields.bookingReminderMinLeadHours.help")}
                      </span>
                    </label>
                  </div>
                </fieldset>

                {/* Email settings */}
                <fieldset className="form-fieldset bot-settings-section">
                  <legend>{t("botSettings.sections.emails.title")}</legend>

                  <p className="muted bot-settings-hint">
                    {t("botSettings.sections.emails.hint")}{" "}
                    <code>{"{{client.name}}"}</code>,{" "}
                    <code>{"{{client.email}}"}</code>,{" "}
                    <code>{"{{booking.start}}"}</code>,{" "}
                    <code>{"{{booking.end}}"}</code>,{" "}
                    <code>{"{{booking.service}}"}</code>,{" "}
                    <code>{"{{bot.name}}"}</code>.
                  </p>

                  <div className="bot-settings-email-toggles">
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={form.bookingConfirmationEmailEnabled}
                        onChange={handleToggleChange("bookingConfirmationEmailEnabled")}
                      />
                      <span>{t("botSettings.toggles.confirmationEmail")}</span>
                    </label>

                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={form.bookingReminderEmailEnabled}
                        onChange={handleToggleChange("bookingReminderEmailEnabled")}
                      />
                      <span>{t("botSettings.toggles.reminderEmail")}</span>
                    </label>
                  </div>

                  {/* Confirmation templates */}
                  <div className="bot-settings-email-group">
                    <h3 className="bot-settings-subtitle">
                      {t("botSettings.emailGroups.confirmation.title")}
                    </h3>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.subject")}</span>
                      <input
                        type="text"
                        value={form.bookingConfirmationSubjectTemplate}
                        onChange={handleStringFieldChange("bookingConfirmationSubjectTemplate")}
                        placeholder={t("botSettings.emailGroups.confirmation.subjectPlaceholder")}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.bodyText")}</span>
                      <textarea
                        rows={4}
                        value={form.bookingConfirmationBodyTextTemplate}
                        onChange={handleStringFieldChange("bookingConfirmationBodyTextTemplate")}
                        placeholder={t("botSettings.emailGroups.confirmation.textPlaceholder")}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.bodyHtmlOptional")}</span>
                      <textarea
                        rows={5}
                        value={form.bookingConfirmationBodyHtmlTemplate}
                        onChange={handleStringFieldChange("bookingConfirmationBodyHtmlTemplate")}
                        placeholder={t("botSettings.emailGroups.confirmation.htmlPlaceholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.emailGroups.confirmation.htmlHelp")}
                      </span>
                    </label>
                  </div>

                  {/* Reminder templates */}
                  <div className="bot-settings-email-group">
                    <h3 className="bot-settings-subtitle">
                      {t("botSettings.emailGroups.reminder.title")}
                    </h3>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.subject")}</span>
                      <input
                        type="text"
                        value={form.bookingReminderSubjectTemplate}
                        onChange={handleStringFieldChange("bookingReminderSubjectTemplate")}
                        placeholder={t("botSettings.emailGroups.reminder.subjectPlaceholder")}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.bodyText")}</span>
                      <textarea
                        rows={4}
                        value={form.bookingReminderBodyTextTemplate}
                        onChange={handleStringFieldChange("bookingReminderBodyTextTemplate")}
                        placeholder={t("botSettings.emailGroups.reminder.textPlaceholder")}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.bodyHtmlOptional")}</span>
                      <textarea
                        rows={5}
                        value={form.bookingReminderBodyHtmlTemplate}
                        onChange={handleStringFieldChange("bookingReminderBodyHtmlTemplate")}
                        placeholder={t("botSettings.emailGroups.reminder.htmlPlaceholder")}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.emailGroups.reminder.htmlHelp")}
                      </span>
                    </label>
                  </div>
                  {/* Cancellation templates */}
                  <div className="bot-settings-email-group">
                    <h3 className="bot-settings-subtitle">
                      {t("botSettings.emailGroups.cancellation.title")}
                    </h3>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.subject")}</span>
                      <input
                        type="text"
                        value={form.bookingCancellationSubjectTemplate}
                        onChange={handleStringFieldChange(
                          "bookingCancellationSubjectTemplate"
                        )}
                        placeholder={t(
                          "botSettings.emailGroups.cancellation.subjectPlaceholder"
                        )}
                      />
                    </label>

                    <label className="form-field">
                      <span>{t("botSettings.emailFields.bodyText")}</span>
                      <textarea
                        rows={4}
                        value={form.bookingCancellationBodyTextTemplate}
                        onChange={handleStringFieldChange(
                          "bookingCancellationBodyTextTemplate"
                        )}
                        placeholder={t(
                          "botSettings.emailGroups.cancellation.textPlaceholder"
                        )}
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        {t("botSettings.emailFields.bodyHtmlOptional")}
                      </span>
                      <textarea
                        rows={5}
                        value={form.bookingCancellationBodyHtmlTemplate}
                        onChange={handleStringFieldChange(
                          "bookingCancellationBodyHtmlTemplate"
                        )}
                        placeholder={t(
                          "botSettings.emailGroups.cancellation.htmlPlaceholder"
                        )}
                      />
                      <span className="bot-settings-help">
                        {t("botSettings.emailGroups.cancellation.htmlHelp")}
                      </span>
                    </label>
                  </div>
                </fieldset>

                {/* Booking fields */}
                <fieldset className="form-fieldset bot-settings-section">
                  <legend>{t("botSettings.sections.bookingFields.title")}</legend>

                  <p className="muted bot-settings-hint">
                    {t("botSettings.sections.bookingFields.hint")}
                  </p>

                  <div className="bot-settings-booking-fields">
                    <div>
                      <h3 className="bot-settings-subtitle">
                        {t("botSettings.bookingFields.alwaysRequiredTitle")}
                      </h3>
                      <ul className="booking-base-fields-list">
                        {BASE_BOOKING_FIELDS.map((field) => (
                          <li key={field} className="booking-base-field-pill">
                            <span>{field}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="bot-settings-help mt-2.5">
                        {t("botSettings.bookingFields.alwaysRequiredHelp")}
                      </p>
                    </div>

                    <div>
                      <h3 className="bot-settings-subtitle">
                        {t("botSettings.bookingFields.additionalTitle")}
                      </h3>

                      {form.customBookingFields.length === 0 && (
                        <p className="bot-settings-help">
                          {t("botSettings.bookingFields.additionalEmpty")}{" "}
                          <code>notes</code>, <code>company</code>, <code>guests_count</code>.
                        </p>
                      )}

                      {form.customBookingFields.length > 0 && (
                        <div className="booking-custom-fields-chips">
                          {form.customBookingFields.map((field) => (
                            <div key={field} className="booking-custom-field-chip">
                              <span>{field}</span>
                              <button
                                type="button"
                                className="booking-custom-field-remove"
                                onClick={() => handleRemoveCustomField(field)}
                                aria-label={t("botSettings.bookingFields.removeFieldAria", { field })}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3">
                                  <path
                                    d="M6 6l12 12M18 6l-12 12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="booking-custom-field-form">
                        <input
                          type="text"
                          value={newCustomField}
                          onChange={(e) => setNewCustomField(e.target.value)}
                          placeholder={t("botSettings.bookingFields.addPlaceholder")}
                        />
                        <button
                          type="button"
                          className="btn-secondary booking-custom-field-add-btn"
                          onClick={handleAddCustomField}
                        >
                          {t("botSettings.bookingFields.addButton")}
                        </button>
                      </div>

                      <p className="bot-settings-help">
                        {t("botSettings.bookingFields.keysHelp")}
                      </p>
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            <div className="form-actions-inline mt-4">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? t("botSettings.actions.saving") : t("botSettings.actions.save")}
              </button>
              <span className="bot-settings-help">{t("botSettings.actions.note")}</span>
            </div>
          </form>
        </section>

        {/* SIDE PANEL */}
        <section className="detail-side bot-settings-side bot-settings-side--offset">
          <div className="settings-sidebar-card">
            <div className="settings-sidebar-header">
              <div>
                <h3 className="settings-sidebar-title">
                  {t("botSettings.side.title")}
                </h3>
                <p className="settings-sidebar-subtitle">
                  {t("botSettings.side.subtitle")}
                </p>
              </div>
            </div>

            <div className="settings-sidebar-list">
              <div className="settings-sidebar-item settings-sidebar-item--muted">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botSettings.side.cards.calendar.title")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botSettings.side.cards.calendar.text")}
                  </span>
                </div>
              </div>

              <div className="settings-sidebar-item settings-sidebar-item--muted">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botSettings.side.cards.timeRules.title")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botSettings.side.cards.timeRules.text")}
                  </span>
                </div>
              </div>

              <div className="settings-sidebar-item settings-sidebar-item--muted">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botSettings.side.cards.emailTemplates.title")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botSettings.side.cards.emailTemplates.text")}{" "}
                    <code>{"{{client.name}}"}</code>{" "}
                    {t("botSettings.side.cards.emailTemplates.and")}{" "}
                    <code>{"{{booking.start}}"}</code>{" "}
                    {t("botSettings.side.cards.emailTemplates.replaced")}.
                  </span>
                </div>
              </div>

              <div className="settings-sidebar-item settings-sidebar-item--muted">
                <div className="settings-sidebar-item-main">
                  <span className="settings-sidebar-item-title">
                    {t("botSettings.side.cards.bookingFields.title")}
                  </span>
                  <span className="settings-sidebar-item-subtitle">
                    {t("botSettings.side.cards.bookingFields.text")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BotSettings;

