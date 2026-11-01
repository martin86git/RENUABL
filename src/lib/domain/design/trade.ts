/**
 * The Marketplace, part two: trading spare equipment (1 Nov 2026, Martin: "allowing installers / retailers to trade
 * unwanted solar equipment - panels / inverters / batteries etc etc. it would work like facebook marketplace").
 * A business puts up spare stock with photos, a price each (or offers) and where it is, to the suburb; other businesses
 * browse it as photo cards near them and message the seller about it; the seller marks it pending or sold. Messages
 * are between the two businesses (each sees only its own conversation about an item). RENUABL takes no part in the
 * sale: no payment passes through it. Pure, tested.
 */
import { todayInMarket } from "../market";
import { kmBetween, publicWords, type Distance } from "./marketplace";

export const TRADE_CATEGORIES = ["Panels", "Inverters", "Batteries", "Mounting and racking", "Electrical", "EV chargers", "Other"] as const;
export type TradeCategory = (typeof TRADE_CATEGORIES)[number];
export const CONDITIONS = ["New, in the box", "New, opened", "Ex-display", "Used, working", "For parts"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const HANDOVER = ["Pick up", "Can deliver", "Pick up or delivery"] as const;
export type Handover = (typeof HANDOVER)[number];
export const ITEM_STATES = ["available", "pending", "sold", "withdrawn"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const TITLE_MAX = 90;
export const DESCRIPTION_MAX = 1500;
export const MESSAGE_MAX = 1500;
export const MAX_PRICE = 500_000;
export const MAX_QTY = 10_000;
export const PHOTOS_MAX = 6;

export interface TradeItem {
  id: string;
  /** The selling business, by name (its id never leaves the server). */
  business: string;
  category: TradeCategory;
  title: string;
  make: string;
  model: string;
  qty: number;
  condition: Condition;
  /** Each, ex GST; null: make an offer. */
  price: number | null;
  handover: Handover;
  description: string;
  suburb: string;
  /** Rounded to about a kilometre, for distance only. */
  near: { lat: number; lng: number } | null;
  status: ItemState;
  photos: string[];
  createdAt: string;
  mine: boolean;
  /** For the seller: how many businesses have asked about it, and how many conversations have lines unread. */
  threads: number;
  unread: number;
}

export interface TradeMessage {
  id: string;
  /** Whether this line is from the business reading it. */
  own: boolean;
  /** The writing business's name. */
  business: string;
  text: string;
  at: string;
}

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

export interface ItemInput {
  category: TradeCategory;
  title: string;
  make: string;
  model: string;
  qty: number;
  condition: Condition;
  price: number | null;
  handover: Handover;
  description: string;
}

/** What a seller puts up, as sent: the kind of thing, what it is, how many, its condition and price; or why not. */
export function cleanItemInput(raw: unknown): { ok: true; value: ItemInput } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const category = TRADE_CATEGORIES.find((c) => c === r.category);
  const condition = CONDITIONS.find((c) => c === r.condition);
  const handover = HANDOVER.find((h) => h === r.handover) ?? "Pick up";
  const title = line(r.title, TITLE_MAX);
  const qty = Math.round(Number(r.qty));
  const price = r.price === null || r.price === "" || r.price === undefined ? null : Math.round(Number(r.price) * 100) / 100;
  if (!category) return { ok: false, message: "Choose what kind of equipment it is." };
  if (!title) return { ok: false, message: "Give it a title: what it is, in a few words." };
  if (!condition) return { ok: false, message: "Choose its condition." };
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, message: "How many are there?" };
  if (price !== null && (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE))
    return { ok: false, message: "A price each is a dollar amount, or leave it for offers." };
  return {
    ok: true,
    value: {
      category,
      title: publicWords(title, TITLE_MAX),
      make: line(r.make, 60),
      model: line(r.model, 80),
      qty,
      condition,
      price,
      handover,
      description: publicWords(r.description, DESCRIPTION_MAX),
    },
  };
}

/** A message about an item: plain words within bounds (businesses may share their own contact here, by choice). */
export const cleanMessage = (raw: unknown) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, MESSAGE_MAX)
    : "";

export const TRADE_FILTERS = ["All", ...TRADE_CATEGORIES] as const;

/** Items a business browses: for sale (available or pending), not its own, of a kind, within reach, matching every word; newest first. */
export function browseItems(
  items: readonly TradeItem[],
  opts: { base: { lat: number; lng: number } | null; within: Distance; category: string; search: string },
): (TradeItem & { km: number | null })[] {
  const words = opts.search.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .filter((i) => !i.mine && (i.status === "available" || i.status === "pending"))
    .filter((i) => opts.category === "All" || i.category === opts.category)
    .filter((i) => words.every((w) => `${i.title} ${i.make} ${i.model} ${i.category} ${i.suburb}`.toLowerCase().includes(w)))
    .map((i) => ({ ...i, km: opts.base && i.near ? Math.round(kmBetween(opts.base, i.near)) : null }))
    .filter((i) => opts.within === null || i.km === null || i.km <= opts.within)
    .sort((a, b) => Number(a.status === "pending") - Number(b.status === "pending") || b.createdAt.localeCompare(a.createdAt));
}

/** "$180 each", "$1,250 each", "Make an offer". */
export const priceWords = (price: number | null) =>
  price === null ? "Make an offer" : `$${price.toLocaleString("en-AU", { maximumFractionDigits: price % 1 ? 2 : 0 })} each`;

/** "Listed today", "Listed 3 days ago". */
export function listedWords(createdAt: string, now: Date = new Date()): string {
  const days = Math.max(
    0,
    Math.round(
      (Date.parse(`${todayInMarket(now)}T00:00:00Z`) - Date.parse(`${todayInMarket(new Date(createdAt))}T00:00:00Z`)) / 86_400_000,
    ),
  );
  return days === 0 ? "Listed today" : days === 1 ? "Listed yesterday" : `Listed ${days} days ago`;
}

/** "Someone asked about your item" email to the seller, from RENUABL: the item and who, never the message's contact. */
export function askedEmail(input: { item: string; buyer: string; text: string; link: string }) {
  const short = input.text.length > 300 ? `${input.text.slice(0, 299)}…` : input.text;
  return {
    subject: `${input.buyer} asked about your ${input.item}`,
    text: `${input.buyer} wrote about your ${input.item} on the RENUABL marketplace:\n\n"${short}"\n\nReply there: ${input.link}`,
    html: `<p>${esc(input.buyer)} wrote about your ${esc(input.item)} on the RENUABL marketplace:</p><blockquote style="margin:12px 0;padding-left:12px;border-left:3px solid #ddd">${esc(short)}</blockquote><p><a href="${esc(input.link)}">Reply there</a></p>`,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
