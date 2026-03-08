// src/pages/app/admin/AdminBookingsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListBookings,
  AdminBookingListItem
} from "@/api/adminBookings";

const PAGE_SIZE = 20;

const AdminBookings: React.FC = () => {
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [onlyUpcoming, setOnlyUpcoming] = useState<boolean>(false);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const loadBookings = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      setLoading(true);
      setError(null);
      try {
        const res = await adminListBookings({
          q: query || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          onlyUpcoming: onlyUpcoming ? true : undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });

        setBookings(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: any) {
        console.error("Failed to load bookings:", err);
        setError(err?.message || "Failed to load bookings");
      } finally {
        setLoading(false);
      }
    },
    [page, query, dateFrom, dateTo, onlyUpcoming]
  );

  useEffect(() => {
    loadBookings();
  }, [query, dateFrom, dateTo, onlyUpcoming, page, loadBookings]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setOnlyUpcoming(false);
    setPage(1);
  };

  const formatDateTime = (iso: string, tz?: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    };

    try {
      return d.toLocaleString(undefined, tz ? { ...options, timeZone: tz } : options);
    } catch {
      return d.toLocaleString(undefined, options);
    }
  };

  const formatNumber = (n: number): string => n.toLocaleString(undefined);

  const computeReminderStatus = (
    booking: AdminBookingListItem
  ): { label: string; variant: "ok" | "warn" | "muted" } => {
    const cfg = booking.bookingConfig;
    const tz = booking.timeZone || booking.bot.timeZone || undefined;
    const now = new Date();
    const start = new Date(booking.start);

    if (!cfg.bookingReminderEmailEnabled) {
      return { label: "Reminders off (bot config)", variant: "muted" };
    }

    if (booking.reminderEmailSentAt) {
      return {
        label: `Sent ${formatDateTime(booking.reminderEmailSentAt, tz)}`,
        variant: "ok"
      };
    }

    if (start.getTime() <= now.getTime()) {
      return { label: "Missed (no reminder sent)", variant: "warn" };
    }

    return { label: "Pending (not sent yet)", variant: "muted" };
  };

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Bookings admin</h1>
        <p className="page-subtitle">
          Inspect bookings across all bots. Check calendar integration, timezones and reminder
          delivery status.
        </p>
      </header>

      <section aria-label="Booking filters" className="card">
        <form className="admin-filters-bar admin-filters-bar--4" onSubmit={handleApplyFilters}>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="booking-search">
              Search
            </label>
            <input
              id="booking-search"
              className="input"
              type="search"
              placeholder="Search by name, email, phone, service, bot name or slug"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="booking-date-from">
              From
            </label>
            <input
              id="booking-date-from"
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="booking-date-to">
              To
            </label>
            <input
              id="booking-date-to"
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="booking-upcoming">
              Upcoming only
            </label>
            <div className="flex items-center gap-2">
              <input
                id="booking-upcoming"
                type="checkbox"
                checked={onlyUpcoming}
                onChange={(e) => {
                  setOnlyUpcoming(e.target.checked);
                  setPage(1);
                }}
              />
              <span className="admin-filters-note">
                Show only bookings with start time in the future
              </span>
            </div>
          </div>

          <div className="admin-filter-actions">
            <button type="submit" className="btn-secondary" disabled={loading}>
              Apply
            </button>
            <button
              type="button"
              className="btn-link-small"
              onClick={handleClearFilters}
              disabled={
                loading &&
                !query &&
                !dateFrom &&
                !dateTo &&
                !onlyUpcoming
              }
            >
              Clear
            </button>
          </div>
        </form>

        <div className="admin-filters-meta">
          <span>
            Page {page} of {totalPages} • {formatNumber(total)} bookings
          </span>
        </div>
      </section>

      {loading && (
        <div className="card">
          <p>Loading bookings…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="card">
          <p>No bookings match your filters.</p>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <section aria-label="Bookings list" className="card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Bot</th>
                  <th>When</th>
                  <th>Calendar</th>
                  <th>Reminder</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const tz = b.timeZone || b.bot.timeZone || undefined;
                  const reminder = computeReminderStatus(b);

                  const reminderClass =
                    reminder.variant === "ok"
                      ? "status-pill status-pill-success"
                      : reminder.variant === "warn"
                        ? "status-pill status-pill-warning"
                        : "status-pill status-pill-muted";

                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="admin-booking-main">
                          <div className="admin-booking-name">
                            {b.name} · <span className="muted">{b.service}</span>
                          </div>
                          <div className="admin-booking-meta">
                            <span>{b.email}</span>
                            {b.phone && <span>{b.phone}</span>}
                            <span className="muted">
                              ID <code>{b.id.slice(0, 8)}…</code>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-bot-main">
                          <div className="admin-bot-name">{b.bot.name}</div>
                          <div className="admin-bot-meta">
                            <span className="admin-bot-slug">/{b.bot.slug}</span>
                            <span className="muted">{b.bot.owner.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span>{formatDateTime(b.start, tz)}</span>
                          <span className="admin-number-sub">
                            {formatDateTime(b.end, tz)}
                          </span>
                          <span className="admin-number-sub">
                            TZ {tz || "n/a"} (stored: {b.timeZone})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span className="admin-number-sub">
                            Calendar:{" "}
                            {b.calendarId ? (
                              <code>{b.calendarId}</code>
                            ) : (
                              <span className="muted">none</span>
                            )}
                          </span>
                          <span className="admin-number-sub">
                            Event:{" "}
                            {b.calendarEventId ? (
                              <code>{b.calendarEventId}</code>
                            ) : (
                              <span className="muted">none</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span className={reminderClass}>{reminder.label}</span>
                          <span className="admin-number-sub">
                            Conf. emails:{" "}
                            {b.bookingConfig.bookingConfirmationEmailEnabled
                              ? "on"
                              : "off"}
                          </span>
                        </div>
                      </td>
                      <td>{formatDateTime(b.createdAt, tz)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="admin-table-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => !disabledPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={disabledPrev}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                !disabledNext && setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={disabledNext}
            >
              Next →
            </button>
          </footer>
        </section>
      )}
    </div>
  );
};

export default AdminBookings;
