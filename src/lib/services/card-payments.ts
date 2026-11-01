/**
 * Card payments on proposals, as the browser sees them: the business connecting its own Stripe account, switching
 * card payments on or off, and a customer paying the next amount due from their link. The browser never decides an
 * amount: the server works it out from the accepted proposal.
 */
import type { DueKey } from "@/lib/domain/design/proposal-payments";

export interface ConnectView {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  cardsOn: boolean;
  words: string;
  fees: { month: string; payments: number; amountCents: number; feeCents: number }[];
  available: boolean;
}

type Answer = { ok: true; url?: string } | { ok: false; message: string };

async function post(path: string, body: unknown): Promise<Answer> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; url?: string };
    if (!res.ok || !json.ok) return { ok: false, message: json.message ?? "That didn't go through. Please try again." };
    return { ok: true, url: json.url };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Check your connection and try again." };
  }
}

export async function loadConnect(): Promise<ConnectView | { error: string }> {
  try {
    const res = await fetch("/api/design/connect", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as ConnectView & { ok?: boolean; message?: string };
    return res.ok && json.ok ? json : { error: json.message ?? "Card payments couldn't be loaded." };
  } catch {
    return { error: "Card payments couldn't be loaded." };
  }
}

export const connectStripe = () => post("/api/design/connect", { do: "connect" });
export const switchCards = (on: boolean) => post("/api/design/connect", { do: "cards", on });

/** The customer paying the next amount due: answers with Stripe's page. */
export const payByCard = (token: string, due: DueKey) => post(`/api/proposal/${encodeURIComponent(token)}`, { action: "pay", due });
