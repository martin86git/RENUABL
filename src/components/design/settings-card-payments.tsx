"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { dollars } from "@/lib/domain/design/plans";
import { PLATFORM_FEE } from "@/lib/domain/design/proposal-payments";
import { connectStripe, loadConnect, switchCards, type ConnectView } from "@/lib/services/card-payments";
import { ui } from "./design-shell";

const monthName = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Settings → Card payments from customers: the business connects its own Stripe account so its customers can pay the
 * deposit and each milestone by card from their proposal. The money goes to the business's Stripe account; RENUABL
 * takes its fee from each payment and never holds the rest.
 */
export function CardPaymentsSettings() {
  const [state, setState] = useState<ConnectView | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void loadConnect().then(setState);
  }, []);

  const connect = async () => {
    setBusy(true);
    setNote(null);
    const a = await connectStripe();
    if (a.ok && a.url) window.location.assign(a.url);
    else {
      setBusy(false);
      setNote(a.ok ? "That didn't go through." : a.message);
    }
  };
  const toggle = async (on: boolean) => {
    if (!state || "error" in state) return;
    setBusy(true);
    const a = await switchCards(on);
    setBusy(false);
    if (a.ok) setState({ ...state, cardsOn: on });
    else setNote(a.message);
  };

  const fee = `${Math.round(PLATFORM_FEE * 100)}%`;
  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Card payments from customers</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Let customers pay their deposit and each payment milestone by card, straight from their proposal. Payments go into your own Stripe
          account and reach your bank on Stripe&apos;s usual schedule. RENUABL takes {fee} of each payment (including GST); Stripe&apos;s
          own card fees are charged by Stripe, as on any Stripe account. Bank transfer stays on offer beside it.
        </p>
      </div>
      {!state ? (
        <div className="min-h-[20dvh]" aria-busy="true" />
      ) : "error" in state ? (
        <p className="text-sm text-ink-2">{state.error}</p>
      ) : (
        <>
          <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">Your Stripe account</h2>
              <span className={clsx("text-sm", state.chargesEnabled ? "text-positive" : "text-ink-2")}>{state.words}</span>
            </div>
            {!state.available ? (
              <p className="text-sm text-ink-2">Payments aren&apos;t set up on RENUABL yet.</p>
            ) : !state.chargesEnabled ? (
              <>
                <p className="text-sm leading-relaxed text-ink-2">
                  {state.connected
                    ? "Finish giving Stripe your details. Stripe checks them, usually within minutes, and card payments switch on by themselves."
                    : "Connect a Stripe account you own, or open a new one. Stripe asks for your business details and the bank account to pay into."}
                </p>
                <button className={ui.primary} disabled={busy} onClick={() => void connect()}>
                  {busy ? "Opening Stripe…" : state.connected ? "Finish with Stripe" : "Connect Stripe"}
                </button>
              </>
            ) : (
              <>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    checked={state.cardsOn}
                    disabled={busy}
                    onChange={(e) => void toggle(e.target.checked)}
                  />
                  <span className="text-ink">
                    Offer card payments on accepted proposals
                    <span className="block text-xs text-muted">
                      Customers see &quot;Pay by card&quot; for the next amount due. Paid deposits are marked received for you.
                    </span>
                  </span>
                </label>
                <a className={clsx(ui.quiet, "w-fit")} href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">
                  Open your Stripe Dashboard
                </a>
              </>
            )}
            {note && <p className="text-sm text-danger">{note}</p>}
          </section>

          {state.fees.length > 0 && (
            <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
              <h2 className="text-base font-semibold text-ink">Payments and RENUABL&apos;s fee</h2>
              <ul className="divide-y divide-line text-sm">
                {state.fees.map((m) => (
                  <li key={m.month} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                    <span className="text-ink">{monthName(m.month)}</span>
                    <span className="tabular-nums text-ink-2">
                      {m.payments} {m.payments === 1 ? "payment" : "payments"} · {dollars(m.amountCents)} · fee {dollars(m.feeCents)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Each fee is shown in your Stripe Dashboard as an application fee.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
