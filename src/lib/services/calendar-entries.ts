/** Entries put on the install calendar by hand: tentative installs, days off, notes. */
import type { CalendarEntry, EntryInput } from "@/lib/domain/design/calendar-entries";
import { ask } from "./crm";

export type { CalendarEntry, EntryInput };

export const loadEntries = (from: string, to: string) =>
  ask<{ entries: CalendarEntry[] }>(`/api/design/schedule/entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const addEntry = (entry: EntryInput) =>
  ask<{ entry: CalendarEntry }>("/api/design/schedule/entries", { method: "POST", body: entry });
export const saveEntry = (id: string, entry: EntryInput) =>
  ask<{ entry: CalendarEntry }>(`/api/design/schedule/entries/${encodeURIComponent(id)}`, { method: "PUT", body: entry });
export const removeEntry = (id: string) =>
  ask<Record<string, never>>(`/api/design/schedule/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
