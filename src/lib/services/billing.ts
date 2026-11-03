/**
 * RENUABL's own plans, as the browser sees them: starting a sign-up (Stripe's page), the welcome back from it, the
 * business's plan and design tokens, buying a pack, and the questions the sign-up page takes. All of it is asked of the
 * server; the browser never decides a price.
 */
import type { BillingPart } from "@/lib/domain/design/business-kind";
import type { BillingDetails } from "@/lib/domain/design/billing-invoice";
import type { BillingInterval, TokenPack } from "@/lib/domain/design/plans";
import type { SolBalance } from "@/lib/domain/design/sol-credits";

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

/** Starts the plan: answers with Stripe's secure page to go to. */
export function startPlan(o: { email: string; seats: number; interval: BillingInterval }) {
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
  /** What this kind of business is billed for (business-kind.ts): an installer, design-job packs only. */
  parts: BillingPart[];
  plan: { status: string; interval: BillingInterval; seats: number; trialEnd: string | null; periodEnd: string | null } | null;
  tokens: number;
  ledger: { change: number; reason: string; by: string | null; at: string }[];
  /** Null for a business with no Sol (an installer). */
  sol: SolBalance | null;
  solUses: { use: string; count: number }[];
  solPacks: { credits: number; by: string | null; at: string }[];
  details: BillingDetails | null;
  /** Null when Stripe couldn't be asked just now. */
  invoices: { id: string; number: string | null; created: number; status: string; totalCents: number; hostedUrl: string | null }[] | null;
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

export function buySolCredits(credits: number) {
  return post("/api/design/billing", { do: "sol", credits });
}

export async function saveBillingDetails(
  details: BillingDetails,
): Promise<{ ok: true; details: BillingDetails } | { ok: false; message: string }> {
  const a = await post("/api/design/billing", { do: "details", ...details });
  return a.ok ? { ok: true, details: a.details as BillingDetails } : { ok: false, message: a.message ?? "That didn't save." };
}

/** Where a tax invoice PDF is downloaded from. */
export const invoicePdfUrl = (id: string) => `/api/design/billing/invoices/${encodeURIComponent(id)}`;
