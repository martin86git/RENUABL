"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { PLAN_WORDS, TOKEN_PACKS, dollars, packPriceCents, priceFor, type TokenPack } from "@/lib/domain/design/plans";
import { buyTokens, loadBilling, manageBilling, type BillingState } from "@/lib/services/billing";
import { ui } from "./design-shell";

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

const REASON: Record<string, string> = { trial: "Free with your trial", pack: "Pack bought", job: "Roof designed" };

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })
    : "–";

/** Settings → Billing: the business's plan with RENUABL, its design tokens, buying a pack and Stripe's page for the card. */
export function BillingPanel() {
  const [state, setState] = useState<BillingState | { error: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
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
  const price = plan ? priceFor(plan.seats, plan.interval) : null;
  const bought = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bought");

  return (
    <div className="space-y-6">
      <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
        <h2 className="text-base font-semibold text-ink">Your plan</h2>
        {plan && price ? (
          <dl className="space-y-3 text-sm">
            <Row k="Plan" v={`${STATUS[plan.status] ?? plan.status} · ${plan.seats} ${plan.seats === 1 ? "user" : "users"}`} />
            <Row
              k="What you pay"
              v={`${dollars(price.chargeCents)} ${plan.interval === "month" ? "a month" : "a year"}, including GST${
                plan.interval === "year" ? ` (${PLAN_WORDS.yearly})` : ""
              }`}
            />
            {plan.status === "trialing" && <Row k="Trial ends" v={`${day(plan.trialEnd)}. Nothing is charged before then.`} />}
            {plan.status !== "trialing" && <Row k="Next bill" v={day(plan.periodEnd)} />}
          </dl>
        ) : (
          <p className="text-sm text-ink-2">
            No plan yet. Start the {PLAN_WORDS.trial} from the sign-up page: {PLAN_WORDS.seat}, {PLAN_WORDS.gst.toLowerCase()}
          </p>
        )}
        {plan && state.payments && (
          <button className={ui.quiet} disabled={busy !== null} onClick={() => void go("portal", manageBilling)}>
            {busy === "portal" ? "Opening Stripe…" : "Change users, card or plan, and see invoices"}
          </button>
        )}
      </section>

      <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Design jobs</h2>
          <p className="text-sm text-ink-2">
            <span className="text-2xl font-semibold tabular-nums text-ink">{state.tokens}</span> left
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
              <span className="text-base font-semibold text-ink">{pack} jobs</span>
              <span className="text-xs tabular-nums text-ink-2">
                {busy === `pack-${pack}` ? "Opening Stripe…" : dollars(packPriceCents(pack))}
              </span>
            </button>
          ))}
        </div>
        {!state.payments && <p className="text-xs text-muted">Payments aren&apos;t switched on yet.</p>}
        {state.ledger.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {state.ledger.slice(0, 12).map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-2">
                <span className="text-ink-2">
                  {REASON[l.reason] ?? l.reason}
                  <span className="ml-2 text-xs text-muted">{day(l.at)}</span>
                </span>
                <span className={clsx("tabular-nums", l.change > 0 ? "text-positive" : "text-ink")}>
                  {l.change > 0 ? `+${l.change}` : l.change}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {note && <p className="text-sm text-danger">{note}</p>}
      <p className="text-xs leading-relaxed text-muted">
        Payments are taken by Stripe. RENUABL never sees or keeps your card details. {PLAN_WORDS.gst}
      </p>
    </div>
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
