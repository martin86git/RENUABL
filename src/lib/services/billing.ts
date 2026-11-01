/**
 * RENUABL's own plans, as the browser sees them: starting a sign-up (Stripe's page), the welcome back from it, the
 * business's plan and design tokens, buying a pack, and the questions the sign-up page takes. All of it is asked of the
 * server; the browser never decides a price.
 */
import type { BillingInterval, TokenPack } from "@/lib/domain/design/plans";

type Answer = { ok: true; url?: string; message?: string } | { ok: false; message: string };

async function post(path: string, body: unknown): Promise<Answer & Record<string, unknown>> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & Record<string, unknown>;
    if (!res.ok || !json.ok) return { ok: false, message: json.message ?? "That didn't go through. Please try again." };
    return { ...json, ok: true };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL just now. Check your connection and try again." };
  }
}

/** Starts the free trial: answers with Stripe's secure page to go to. */
export function startTrial(o: { email: string; seats: number; interval: BillingInterval }) {
  return post("/api/design/subscribe", o);
}

/** Back from Stripe: checks the sign-up and sends the sign-in link. */
export async function welcomeBack(sessionId: string): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const a = await post("/api/design/welcome", { sessionId });
  return a.ok ? { ok: true, email: String(a.email ?? "") } : a;
}

export function registerInterest(email: string) {
  return post("/api/design/interest", { email });
}

export function askSales(o: { name: string; business: string; email: string; mobile: string; users: string; note: string }) {
  return post("/api/design/sales-enquiry", o);
}

export interface BillingState {
  plan: { status: string; interval: BillingInterval; seats: number; trialEnd: string | null; periodEnd: string | null } | null;
  tokens: number;
  ledger: { change: number; reason: string; by: string | null; at: string }[];
  payments: boolean;
}

export async function loadBilling(): Promise<BillingState | { error: string }> {
  try {
    const res = await fetch("/api/design/billing", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as BillingState & { ok?: boolean; message?: string };
    if (!res.ok || !json.ok) return { error: json.message ?? "Billing couldn't be loaded." };
    return json;
  } catch {
    return { error: "Billing couldn't be loaded." };
  }
}

export function buyTokens(pack: TokenPack) {
  return post("/api/design/billing", { do: "tokens", pack });
}

export function manageBilling() {
  return post("/api/design/billing", { do: "portal" });
}
