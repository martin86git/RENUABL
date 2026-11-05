/** Each member's own Google Calendar, as the screens reach it (/api/design/calendar): read only. */
import type { MyEvent } from "@/lib/domain/design/my-calendar";
import { ask } from "./crm";

export interface CalendarAnswer {
  connected: boolean;
  address?: string;
  /** Google's sign-in is set up here (without it, connecting can't work). */
  ready?: boolean;
  /** The owner is viewing as someone else: their calendar isn't read. */
  viewing?: boolean;
  /** Google stopped answering for this member (revoked): connect again. */
  broken?: string;
  events: MyEvent[];
}

export const loadMyCalendar = (from: string, to: string) =>
  ask<CalendarAnswer>(`/api/design/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const disconnectMyCalendar = () => ask<object>("/api/design/calendar", { method: "DELETE" });
export const connectCalendarHref = (back: string) => `/api/auth/calendar?back=${encodeURIComponent(back)}`;
