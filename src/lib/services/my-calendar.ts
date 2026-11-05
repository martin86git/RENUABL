/** Each member's own calendar (Google or Outlook), as the screens reach it (/api/design/calendar): read only. */
import { CALENDAR_MESSAGE, type CalendarProvider, type MyEvent } from "@/lib/domain/design/my-calendar";
import { ask } from "./crm";

export interface CalendarAnswer {
  connected: boolean;
  provider?: CalendarProvider;
  address?: string;
  /** The owner is viewing as someone else: their calendar isn't read. */
  viewing?: boolean;
  /** The provider stopped answering for this member (revoked): connect again. */
  broken?: string;
  events: MyEvent[];
}

export const loadMyCalendar = (from: string, to: string) =>
  ask<CalendarAnswer>(`/api/design/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const disconnectMyCalendar = () => ask<object>("/api/design/calendar", { method: "DELETE" });

const connectHref = (provider: CalendarProvider, back: string, popup: boolean) =>
  `/api/auth/calendar?${new URLSearchParams({ provider, back, ...(popup ? { popup: "1" } : {}) })}`;

/**
 * Connects a calendar without leaving the page: the provider's sign-in opens in a small window over it, and `done` hears
 * how it went when that window closes itself. Only if the browser blocks the window does the page itself go to sign in
 * (and comes back to `back`).
 */
export function connectMyCalendar(provider: CalendarProvider, back: string, done: (result: string) => void): () => void {
  const w = 520;
  const h = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
  const win = window.open(connectHref(provider, back, true), "renuabl-calendar", `popup,width=${w},height=${h},left=${left},top=${top}`);
  if (!win) {
    window.location.href = connectHref(provider, back, false);
    return () => undefined;
  }
  const heard = (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== win) return;
    const data = e.data as { type?: string; result?: string } | null;
    if (data?.type !== CALENDAR_MESSAGE || typeof data.result !== "string") return;
    stop();
    done(data.result);
  };
  // Closed by hand before finishing: nothing changed, so the prompt simply stays.
  const shut = window.setInterval(() => {
    if (win.closed) {
      stop();
      done("closed");
    }
  }, 600);
  const stop = () => {
    window.removeEventListener("message", heard);
    window.clearInterval(shut);
  };
  window.addEventListener("message", heard);
  return stop;
}
