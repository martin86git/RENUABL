import { LAUNCH_MARKET } from "./market";
import { fromISODate } from "./scheduling";
import type { ISODate } from "./types";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export function formatCurrency(amount: number) {
  return aud.format(amount);
}

const audCents = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** With cents, for invoices. */
export function formatCents(amount: number) {
  return audCents.format(amount);
}

export function formatDate(iso: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return fromISODate(iso).toLocaleDateString("en-AU", opts);
}

export function formatShortDate(iso: ISODate) {
  return formatDate(iso, { weekday: "short", day: "numeric", month: "short" });
}

/** Times of day are always shown in the launch market's time zone, so server and browser agree. */
export const BUSINESS_TIME_ZONE = LAUNCH_MARKET.timeZone;

export function formatTime(isoDateTime: string) {
  return new Date(isoDateTime).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE });
}

export function formatDateTime(isoDateTime: string) {
  return new Date(isoDateTime).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function formatPercent(share: number) {
  return `${Math.round(share * 100)}%`;
}
