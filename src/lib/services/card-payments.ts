/**
 * Card payments on proposals, as the browser sees them: the business connecting its own Stripe account, switching
 * card payments on or off, and a customer paying the next amount due from their link. The browser never decides an
 * amount: the server works it out from the accepted proposal.
 */
import type { DueKey } from "@/lib/domain/design/proposal-payments";

export interface ConnectView {
  connected: boolean;
  /** The business opened a standard Stripe account of its own before card payments ran through RENUABL (24 Nov 2026). */
  older: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  cardsOn: boolean;
  words: string;
  fees: { month: string; payments: number; amountCents: number; feeCents: number }[];
  available: boolean;
}

type Answer = { ok: true; url?: string; clientSecret?: string } | { ok: false; message: string };

async function post(path: string, body: unknown): Promise<Answer> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; url?: string; clientSecret?: string };
    if (!res.ok || !json.ok) return { ok: false, message: json.message ?? "That didn't go through. Please try again." };
    return { ok: true, url: json.url, clientSecret: json.clientSecret };
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

/** Opens the business's account, run by RENUABL (or one in place of an older standard account). */
export const startCardPayments = () => post("/api/design/connect", { do: "start" });
export const switchCards = (on: boolean) => post("/api/design/connect", { do: "cards", on });

/** The customer paying the next amount due: answers with Stripe's page. */
export const payByCard = (token: string, due: DueKey) => post(`/api/proposal/${encodeURIComponent(token)}`, { action: "pay", due });

/**
 * The same, as Stripe's card form on our page (19 Nov 2026, Martin: pressing Place order opens a card box for the
 * deposit): the session's client secret and the business's Stripe account the form is opened for.
 */
export async function cardFormFor(
  token: string,
  due: DueKey,
  back: "proposal" | "order",
): Promise<{ ok: true; secret: string; account: string } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/proposal/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", due, form: back }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; secret?: string; account?: string };
    if (!res.ok || !json.ok || !json.secret || !json.account)
      return { ok: false, message: json.message ?? "The card form couldn't be opened. Please try again." };
    return { ok: true, secret: json.secret, account: json.account };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Check your connection and try again." };
  }
}

/*
 * Stripe's own forms and lists for the business's account, shown inside RENUABL (Connect's embedded components): its
 * details and bank account, what Stripe still needs, balance and payouts, and payments. One instance a page, made the
 * first time one is shown; each key it asks for is short-lived and made by our server for the signed-in owner.
 */
type ConnectInstance = Awaited<ReturnType<typeof import("@stripe/connect-js").loadConnectAndInitialize>>;
let instance: ConnectInstance | null = null;

export async function connectInstance(publishableKey: string): Promise<ConnectInstance> {
  if (instance) return instance;
  const { loadConnectAndInitialize } = await import("@stripe/connect-js");
  instance = loadConnectAndInitialize({
    publishableKey,
    locale: "en-AU",
    fetchClientSecret: async () => {
      const a = await post("/api/design/connect", { do: "session" });
      if (!a.ok || !a.clientSecret) throw new Error(a.ok ? "No key" : a.message);
      return a.clientSecret;
    },
    appearance: {
      overlays: "dialog",
      variables: {
        fontFamily: "Inter, system-ui, sans-serif",
        colorPrimary: "#26282c",
        colorText: "#1d1d1f",
        colorBackground: "#ffffff",
        borderRadius: "10px",
        fontSizeBase: "14px",
      },
    },
  });
  return instance;
}
