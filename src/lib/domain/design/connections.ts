/**
 * The directory and connections (1 Nov 2026, Martin: a business finds the businesses it already works with and sends
 * something like a friend request; the directory is opt-in). A business is in the directory only once it has chosen to
 * be listed, with its name, kind, suburb and state (and its ABN, when it gives one, to tell two names apart). Any
 * business may search the listed ones and ask to connect; the other accepts or declines, and either may disconnect.
 * **A connection shares nothing by itself**: jobs pass between connected businesses one at a time (later steps). A
 * business's id never leaves the server: the directory knows each by a key of its own. Pure, tested.
 */
import { isAbn } from "./brand";
import { kindLabel, type BusinessKind } from "./business-kind";

export const STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;
export type AuState = (typeof STATES)[number];

/** What a business shows in the directory, as it chose. */
export interface Listing {
  listed: boolean;
  suburb: string;
  state: AuState | "";
  /** Eleven digits, or empty. */
  abn: string;
}

export const NOT_LISTED: Listing = { listed: false, suburb: "", state: "", abn: "" };

/** A listing as sent: a suburb and state are needed to be listed; an ABN is checked when given. */
export function cleanListing(raw: unknown): { ok: true; listing: Listing } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const suburb =
    typeof r.suburb === "string"
      ? r.suburb
          .replace(/[\u0000-\u001f<>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60)
      : "";
  const state = (STATES as readonly string[]).includes(String(r.state)) ? (r.state as AuState) : "";
  const abn = typeof r.abn === "string" ? r.abn.replace(/\D/g, "") : "";
  const listed = r.listed === true;
  if (abn && !isAbn(abn)) return { ok: false, message: "That ABN doesn't look right. Check the 11 digits, or leave it empty." };
  if (listed && (!suburb || !state)) return { ok: false, message: "Give your suburb and state to be listed." };
  return { ok: true, listing: { listed, suburb, state, abn } };
}

/** A business as the directory and connections show it: never its id, its people or their emails. */
export interface DirectoryEntry {
  key: string;
  name: string;
  kind: BusinessKind;
  suburb: string;
  state: string;
}

/** Where this business stands with another. */
export type Standing = "none" | "requested" | "incoming" | "connected";

export const KIND_FILTERS = ["all", "retailer", "installer", "inspector"] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Whether an entry matches a search: every word in its name, suburb, state or ABN; an ABN typed with spaces counts. */
export function matchesSearch(entry: Pick<DirectoryEntry, "name" | "suburb" | "state"> & { abn?: string }, query: string): boolean {
  const digits = query.replace(/\D/g, "");
  if (digits.length === 11 && entry.abn === digits) return true;
  const hay = words(`${entry.name} ${entry.suburb} ${entry.state}`);
  const need = words(query);
  return need.length > 0 && need.every((w) => hay.some((h) => h.startsWith(w)));
}

/** The most results a search gives, and the least a search needs typed. */
export const MAX_RESULTS = 30;
export const MIN_QUERY = 2;

/** Why this business can't ask to connect with that one, or null. */
export function requestRefusal(standing: Standing, self: boolean): string | null {
  if (self) return "That's your own business.";
  if (standing === "connected") return "You're already connected.";
  if (standing === "requested") return "You've already asked. They'll see it on their Connections page.";
  if (standing === "incoming") return "They've already asked you: accept their request instead.";
  return null;
}

/** "Installer · Glen Waverley, VIC". */
export const entryLine = (e: Pick<DirectoryEntry, "kind" | "suburb" | "state">) =>
  [kindLabel(e.kind), [e.suburb, e.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email to a business asked to connect, from RENUABL: who asked, and the way to answer. Nothing else. */
export function requestEmail(input: { from: string; kind: BusinessKind; link: string }) {
  const who = `${input.from} (${kindLabel(input.kind)})`;
  return {
    subject: `${input.from} wants to connect on RENUABL`,
    text: `${who} has asked to connect with your business on RENUABL. Once connected, you can pass jobs between you.\n\nAccept or decline: ${input.link}`,
    html: `<p>${esc(who)} has asked to connect with your business on RENUABL. Once connected, you can pass jobs between you.</p><p><a href="${esc(input.link)}">Accept or decline</a></p>`,
  };
}

/** The email to the business that asked, once accepted. */
export function acceptedEmail(input: { by: string; link: string }) {
  return {
    subject: `${input.by} accepted your request on RENUABL`,
    text: `${input.by} accepted your request to connect on RENUABL.\n\nYour connections: ${input.link}`,
    html: `<p>${esc(input.by)} accepted your request to connect on RENUABL.</p><p><a href="${esc(input.link)}">Your connections</a></p>`,
  };
}
