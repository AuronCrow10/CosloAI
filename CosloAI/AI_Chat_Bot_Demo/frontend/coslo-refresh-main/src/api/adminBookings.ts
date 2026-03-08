// src/api/adminBookings.ts
import { authFetchJson } from "./authorizedClient";

export type AdminBotStatus = "DRAFT" | "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "CANCELED";

export type AdminBookingListItem = {
  id: string;

  bot: {
    id: string;
    name: string;
    slug: string;
    status: AdminBotStatus;
    timeZone: string | null;
    owner: {
      id: string;
      email: string;
      name: string | null;
    };
  };

  name: string;
  email: string;
  phone: string;
  service: string;

  start: string;
  end: string;
  timeZone: string;
  calendarId: string;
  calendarEventId: string | null;

  reminderEmailSentAt: string | null;
  createdAt: string;

  bookingConfig: {
    bookingReminderEmailEnabled: boolean;
    bookingConfirmationEmailEnabled: boolean;
    bookingReminderWindowHours: number | null;
    bookingReminderMinLeadHours: number | null;
  };
};

export type AdminBookingListResponse = {
  items: AdminBookingListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export async function adminListBookings(params: {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  onlyUpcoming?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<AdminBookingListResponse> {
  const qs = new URLSearchParams();

  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  if (params.dateFrom && params.dateFrom.trim()) {
    qs.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo && params.dateTo.trim()) {
    qs.set("dateTo", params.dateTo.trim());
  }
  if (typeof params.onlyUpcoming === "boolean") {
    qs.set("onlyUpcoming", params.onlyUpcoming ? "true" : "false");
  }
  if (typeof params.page === "number") {
    qs.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetchJson<AdminBookingListResponse>(`/admin/bookings${suffix}`);
}
