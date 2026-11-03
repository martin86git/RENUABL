"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { EMPTY_BILLING, INVOICE_STATUS, type BillingDetails } from "@/lib/domain/design/billing-invoice";
import {
  PLAN_WORDS,
  SEAT_NOTE,
  TOKEN_PACKS,
  designBalanceWords,
  dollars,
  packPriceCents,
  planNow,
  type TokenPack,
} from "@/lib/domain/design/plans";
import { SOL_PACKS, SOL_USE_WORDS, SOL_WORDS, type SolUse } from "@/lib/domain/design/sol-credits";
import {
  buySolCredits,
  buyTokens,
  cancelPlan,
  chooseTwelveMonths,
  invoicePdfUrl,
  loadBilling,
  manageBilling,
  saveBillingDetails,
  type BillingState,
} from "@/lib/services/billing";
import { ui } from "./design-shell";
import type { BillingPart } from "@/lib/domain/design/business-kind";

/** Above an installer's Billing: what it pays for, and what it doesn't. */
const PACKS_ONLY_NOTE = `Your business joined RENUABL free: there are no users to pay for. You pay only for design jobs, ${PLAN_WORDS.token}, bought in packs.`;

const STATUS: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment overdue",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Waiting for the first payment",
  incomplete_expired: "Not started",
  paused: "Paused",
};

const REASON: Record<string, string> = {
  trial: "Free with your trial",
  pack: "Pack bought",
  job: "Roof designed",
  battery: "Battery added to a design",
};

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })
    : "–";

/** Settings → Billing: the business's plan with RENUABL, its design tokens, buying a pack and Stripe's page for the card. */
export function BillingPanel() {
  const [state, setState] = useState<BillingState | { error: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    void loadBilling().then(setState);
  }, []);

  const go = async (key: string, ask: () => Promise<{ ok: boolean; url?: string; message?: string }>) => {
    setBusy(key);
    setNote(null);
    const a = await ask();
    if (a.ok && a.url) window.location.assign(a.url);
    else {
      setBusy(null);
      setNote(a.message ?? "That didn't go through.");
    }
  };

  if (!state) return <div className="min-h-[30dvh]" aria-busy="true" />;
  if ("error" in state) return <p className="text-sm text-ink-2">{state.error}</p>;
  const plan = state.plan;
  const sol = state.sol;
  const has = (part: BillingPart) => state.parts.includes(part);
  // An installer (business-kind.ts) is free to join: no plan, users or Sol, only design jobs bought in packs.
  const packsOnly = !has("plan");
  const now = plan ? planNow(plan, state.today, day) : null;
  // Choosing the 12-month plan or cancelling changes the plan here: the page is read again afterwards.
  const change = async (key: string, ask: () => Promise<{ ok: boolean; message?: string; chargedCents?: unknown }>, done: string) => {
    setBusy(key);
    setNote(null);
    const a = await ask();
    setBusy(null);
    setConfirming(false);
    if (!a.ok) return setNote(a.message ?? "That didn't go through.");
    const charged =
      typeof a.chargedCents === "number" && a.chargedCents > 0
        ? ` ${dollars(a.chargedCents)} was charged for leaving the 12-month plan early.`
        : "";
    setNote(done + charged);
    setState(await loadBilling());
  };
  const bought = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bought");

  return (
    <div className="space-y-6">
      {packsOnly && <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{PACKS_ONLY_NOTE}</p>}
      {has("plan") && (
        <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Your plan</h2>
          {plan && now ? (
            <dl className="space-y-3 text-sm">
              <Row
                k="Plan"
                v={`${STATUS[plan.status] ?? plan.status} · ${plan.seats} ${plan.seats === 1 ? "user" : "users"} · ${now.termWords}`}
              />
              <Row
                k="Next bill"
                v={
                  plan.interval === "year"
                    ? `${dollars(now.nextPerUserCents * plan.seats)} a year, including GST, on ${day(plan.periodEnd)}`
                    : `${dollars(now.nextPerUserCents * plan.seats)}, including GST, on ${day(plan.periodEnd)} (${dollars(now.nextPerUserCents)} a user)`
                }
              />
              {plan.status === "trialing" && <Row k="Trial ends" v={`${day(plan.trialEnd)}. Nothing is charged before then.`} />}
            </dl>
          ) : (
            <p className="text-sm text-ink-2">
              No plan yet. Start one from the sign-up page: {PLAN_WORDS.seat}. {PLAN_WORDS.gst}
            </p>
          )}
          {/* The 12-month plan, offered while month to month: $29 a user instead of $59 (plans.ts). */}
          {plan && now?.canCommit && state.payments && !["canceled", "incomplete_expired"].includes(plan.status) && (
            <div className="space-y-2 rounded-xl bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">The 12-month plan: {PLAN_WORDS.commit.replace(" on the 12-month plan", "")}</p>
              <p className="text-sm leading-relaxed text-ink-2">{PLAN_WORDS.commitExplained}</p>
              <button
                className={ui.primary}
                disabled={busy !== null}
                onClick={() => void change("commit", chooseTwelveMonths, "You're on the 12-month plan.")}
              >
                {busy === "commit" ? "Choosing…" : "Choose the 12-month plan"}
              </button>
            </div>
          )}
          {plan && state.payments && (
            <div className="flex flex-wrap gap-2">
              <button className={ui.quiet} disabled={busy !== null} onClick={() => void go("portal", manageBilling)}>
                {busy === "portal" ? "Opening Stripe…" : "Change your card or billing details"}
              </button>
              {!["canceled", "incomplete_expired"].includes(plan.status) && !confirming && (
                <button className={ui.quiet} disabled={busy !== null} onClick={() => setConfirming(true)}>
                  Cancel the plan
                </button>
              )}
            </div>
          )}
          {/* Cancelling says what it costs before it is done: on the 12-month plan, what it saved is paid back. */}
          {plan && now && confirming && (
            <div className="space-y-2 rounded-xl border border-line p-4" role="alertdialog" aria-label="Cancel the plan">
              <p className="text-sm leading-relaxed text-ink">
                Your plan runs to the end of the month you&apos;ve paid for ({day(plan.periodEnd)}), then stops.
                {now.exitCents > 0
                  ? ` You're leaving the 12-month plan early, so ${dollars(now.exitCents)} (what it has saved you) is charged today.`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={ui.primary}
                  disabled={busy !== null}
                  onClick={() => void change("cancel", cancelPlan, "Your plan is cancelled at the end of the month you've paid for.")}
                >
                  {busy === "cancel" ? "Cancelling…" : now.exitCents > 0 ? `Pay ${dollars(now.exitCents)} and cancel` : "Cancel the plan"}
                </button>
                <button className={ui.quiet} disabled={busy !== null} onClick={() => setConfirming(false)}>
                  Keep my plan
                </button>
              </div>
            </div>
          )}
          {plan && <p className="text-xs leading-relaxed text-muted">{SEAT_NOTE}</p>}
        </section>
      )}

      {sol && (
        <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")} aria-labelledby="sol-credits">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="sol-credits" className="text-base font-semibold text-ink">
              Sol credits
            </h2>
            <p className="text-sm text-ink-2">
              <span className="text-2xl font-semibold tabular-nums text-ink">{sol.left.toLocaleString("en-AU")}</span> left
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink-2">{SOL_WORDS.explained}</p>
          <dl className="space-y-3 text-sm">
            <Row
              k="This month's"
              v={`${Math.min(sol.usedIncluded, sol.included).toLocaleString("en-AU")} of ${sol.included.toLocaleString("en-AU")} used`}
            />
            <Row k="Bought, never expire" v={sol.bought.toLocaleString("en-AU")} />
          </dl>
          {sol.included > 0 && (
            <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (sol.usedIncluded / sol.included) * 100)}%` }} />
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {SOL_PACKS.map((p) => (
              <button
                key={p.credits}
                className={clsx(ui.quiet, "h-auto flex-col py-3")}
                disabled={busy !== null || !state.payments}
                onClick={() => void go(`sol-${p.credits}`, () => buySolCredits(p.credits))}
              >
                <span className="text-base font-semibold text-ink">{p.credits.toLocaleString("en-AU")} credits</span>
                <span className="text-xs tabular-nums text-ink-2">
                  {busy === `sol-${p.credits}` ? "Opening Stripe…" : dollars(p.cents)}
                </span>
              </button>
            ))}
          </div>
          {state.solUses.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {state.solUses.map((u) => (
                <li key={u.use} className="flex justify-between gap-4 py-2">
                  <span className="text-ink-2">{SOL_USE_WORDS[u.use as SolUse] ?? u.use}</span>
                  <span className="tabular-nums text-ink">{u.count.toLocaleString("en-AU")} this month</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Design jobs</h2>
          <p className="text-sm text-ink-2">
            <span className="text-2xl font-semibold tabular-nums text-ink">{dollars(Math.max(0, state.tokens) * 100)}</span> left
            <span className="ml-2 text-xs text-muted">{designBalanceWords(state.tokens).split(" · ")[1]}</span>
          </p>
        </div>
        <p className="text-sm leading-relaxed text-ink-2">{PLAN_WORDS.tokenExplained}</p>
        {bought && (
          <p className="rounded-md bg-positive-soft px-3 py-2 text-sm text-positive">
            Thanks. Your pack is added as soon as Stripe confirms it.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {TOKEN_PACKS.map((pack: TokenPack) => (
            <button
              key={pack}
              className={clsx(ui.quiet, "h-auto flex-col py-3")}
              disabled={busy !== null || !state.payments}
              onClick={() => void go(`pack-${pack}`, () => buyTokens(pack))}
            >
              <span className="text-base font-semibold text-ink">{pack} design jobs</span>
              <span className="text-xs tabular-nums text-ink-2">
                {busy === `pack-${pack}` ? "Opening Stripe…" : dollars(packPriceCents(pack))}
              </span>
            </button>
          ))}
        </div>
        {!state.payments && <p className="text-xs text-muted">Payments aren&apos;t switched on yet.</p>}
        {packsOnly && !state.ledger.length && <p className="text-sm text-ink-2">No design jobs bought or used yet.</p>}
        {state.ledger.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {state.ledger.slice(0, 12).map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-2">
                <span className="text-ink-2">
                  {REASON[l.reason] ?? l.reason}
                  <span className="ml-2 text-xs text-muted">{day(l.at)}</span>
                </span>
                <span className={clsx("tabular-nums", l.change > 0 ? "text-positive" : "text-ink")}>
                  {l.change > 0 ? `+${dollars(l.change * 100)}` : `−${dollars(-l.change * 100)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Invoices invoices={state.invoices} />
      <DetailsForm saved={state.details} />
      {note && <p className="text-sm text-danger">{note}</p>}
      <p className="text-xs leading-relaxed text-muted">
        Payments are taken by Stripe. RENUABL never sees or keeps your card details. {PLAN_WORDS.gst}
      </p>
    </div>
  );
}

/** RENUABL's invoices to the business, each as a tax invoice PDF and Stripe's own page. */
function Invoices({ invoices }: { invoices: BillingState["invoices"] }) {
  return (
    <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")} aria-labelledby="invoices">
      <h2 id="invoices" className="text-base font-semibold text-ink">
        Invoices
      </h2>
      {invoices === null ? (
        <p className="text-sm text-ink-2">Your invoices couldn&apos;t be loaded just now. Try again in a moment.</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-ink-2">No invoices yet. Each payment to RENUABL will be here as a tax invoice.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1 text-ink">
                {day(new Date(inv.created * 1000).toISOString())}
                <span className="ml-2 text-xs text-muted">{inv.number ?? ""}</span>
              </span>
              <span className={clsx("text-xs", inv.status === "paid" ? "text-positive" : "text-ink-2")}>
                {INVOICE_STATUS[inv.status] ?? inv.status}
              </span>
              <span className="w-20 text-right tabular-nums text-ink">{dollars(inv.totalCents)}</span>
              <a className="tap-area text-xs text-ink underline underline-offset-2" href={invoicePdfUrl(inv.id)}>
                Tax invoice
              </a>
              {inv.hostedUrl && (
                <a
                  className="tap-area text-xs text-ink-2 underline underline-offset-2"
                  href={inv.hostedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {inv.status === "open" ? "Pay" : "Receipt"}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Who RENUABL bills: on every tax invoice, and given to Stripe for its own. */
function DetailsForm({ saved }: { saved: BillingDetails | null }) {
  const [form, setForm] = useState<BillingDetails>(saved ?? EMPTY_BILLING);
  const [state, setState] = useState<{ busy: boolean; text: string | null; error: boolean }>({ busy: false, text: null, error: false });
  const field = (key: keyof BillingDetails, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-1 text-sm">
      <span className="text-ink-2">{label}</span>
      <input className={ui.input} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </label>
  );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, text: null, error: false });
    const a = await saveBillingDetails(form);
    if (a.ok) {
      setForm(a.details);
      setState({ busy: false, text: "Saved. They'll be on your next invoice.", error: false });
    } else setState({ busy: false, text: a.message, error: true });
  };
  return (
    <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")} aria-labelledby="billing-details">
      <div>
        <h2 id="billing-details" className="text-base font-semibold text-ink">
          Billing details
        </h2>
        <p className="mt-1 text-sm text-ink-2">On every tax invoice from RENUABL. Your ABN is needed on invoices of $1,000 or more.</p>
      </div>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {field("legalName", "Business name for invoices", { maxLength: 120, autoComplete: "organization" })}
        {field("abn", "ABN", { maxLength: 20, inputMode: "numeric" })}
        {field("email", "Email for invoices and receipts", { type: "email", maxLength: 200, autoComplete: "email" })}
        {field("address", "Address", { maxLength: 240, autoComplete: "street-address" })}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className={ui.primary} disabled={state.busy}>
            {state.busy ? "Saving…" : "Save billing details"}
          </button>
          {state.text && <p className={clsx("text-sm", state.error ? "text-danger" : "text-positive")}>{state.text}</p>}
        </div>
      </form>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-2">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}
