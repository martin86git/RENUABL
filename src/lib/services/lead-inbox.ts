"use client";

import type { LeadInboxEntry, LeadInboxRun, LeadInboxSettings } from "@/lib/domain/design/lead-inbox";
import { ask } from "./crm";

export interface LeadInboxView {
  settings: LeadInboxSettings;
  mailboxes: { owner: string; address: string }[];
  recent: LeadInboxEntry[];
  lastRunAt: string | null;
  lastRun: LeadInboxRun | null;
}

/** The lead inbox as set, the business's connected mailboxes and the latest emails it looked at. */
export const loadLeadInbox = () => ask<LeadInboxView>("/api/design/lead-inbox");

/** Keeps the lead inbox's setting. */
export const saveLeadInbox = (s: { on: boolean; owner: string | null; address: string | null; label: string | null }) =>
  ask<Pick<LeadInboxView, "settings" | "lastRunAt" | "lastRun">>("/api/design/lead-inbox", { method: "POST", body: { do: "save", ...s } });

/** Checks the mailbox now. */
export const checkLeadInbox = () =>
  ask<{ run: LeadInboxRun; recent: LeadInboxEntry[] }>("/api/design/lead-inbox", { method: "POST", body: { do: "check" } });
