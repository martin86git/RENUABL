"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, CreditCard } from "lucide-react";
import clsx from "clsx";
import { money } from "@/lib/domain/design/deposit";
import { payCardNote, type PublicPayments } from "@/lib/domain/design/proposal-payments";
import { cardFormFor, payByCard } from "@/lib/services/card-payments";
import { mountDepositForm, stripeFormAvailable } from "@/lib/services/stripe-form";

/** The address doesn't change while the page is open, so there is nothing to listen to. */
const noSubscribe = () => () => {};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" });

/**
 * What the customer pays and when, on their accepted proposal: the deposit then each milestone, each paid one ticked,
 * and "Pay by card" for the next one due when the business takes cards through its own Stripe account. The amount is
 * worked out on the server; pressing it opens Stripe's page. Coming back from Stripe says thanks; the tick appears once
 * Stripe has told the server, which can take a few seconds.
 */
export function PaySchedule(props: {
  token: string;
  business: string;
  payments: PublicPayments;
  /** The page it sits on: the card form opens here and comes back to it (19 Nov 2026, Martin). */
  form?: "proposal" | "order";
  /** Open the card form at once (just after ordering). */
  openNow?: boolean;
}) {
  const { payments, business } = props;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Stripe's card form on this page, where its key is set; else Stripe's own page.
  const formHere = Boolean(props.form) && stripeFormAvailable();
  const [boxOpen, setBoxOpen] = useState(Boolean(props.openNow && formHere && payments.cards && payments.next));
  // Back from Stripe's page (read once in the browser; the server's render never has it).
  const back = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).has("paid"),
    () => false,
  );

  const pay = async () => {
    if (!payments.next) return;
    if (formHere) return setBoxOpen(true);
    setBusy(true);
    setProblem(null);
    const a = await payByCard(props.token, payments.next);
    if (a.ok && a.url) window.location.assign(a.url);
    else {
      setBusy(false);
      setProblem(a.ok ? "That didn't go through." : a.message);
    }
  };

  const next = payments.dues.find((d) => d.key === payments.next) ?? null;
  return (
    <div id="pay" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Payments</p>
      <h3 className="mt-2 text-[20px] leading-tight text-ink">
        {next ? `Next: ${next.name.toLowerCase()} of ${money(next.amount)}` : `All paid. Thank you.`}
      </h3>
      {back && (
        <p className="mt-3 rounded-md bg-positive-soft px-3 py-2 text-[13px] text-positive" role="status">
          Thank you. Your payment is with Stripe; it shows as paid here once Stripe confirms it, usually within a minute.
        </p>
      )}
      <ol className="mt-4 divide-y divide-line rounded-lg border border-line">
        {payments.dues.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-[15px] text-ink">
              {d.paidAt ? (
                <Check className="size-4 text-positive" aria-label="Paid" />
              ) : (
                <span className="size-4 rounded-full border border-line" aria-hidden />
              )}
              {d.name}
            </span>
            <span className={clsx("text-right text-[15px] tabular-nums", d.paidAt ? "text-positive" : "text-ink")}>
              {money(d.amount)}
              {d.paidAt && <span className="block text-[12px] text-muted">Paid {day(d.paidAt)}</span>}
            </span>
          </li>
        ))}
      </ol>
      {next && payments.cards && boxOpen && props.form && (
        <CardBox
          token={props.token}
          due={next.key}
          back={props.form}
          onFallback={() => {
            setBoxOpen(false);
            void (async () => {
              setBusy(true);
              const a = await payByCard(props.token, next.key);
              if (a.ok && a.url) window.location.assign(a.url);
              else {
                setBusy(false);
                setProblem(a.ok ? "That didn't go through." : a.message);
              }
            })();
          }}
        />
      )}
      {next && payments.cards && !boxOpen && (
        <>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
            disabled={busy}
            onClick={() => void pay()}
          >
            <CreditCard className="size-4" aria-hidden /> {busy ? "Opening Stripe…" : `Pay ${money(next.amount)} by card`}
          </button>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{payCardNote(business)}</p>
        </>
      )}
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

/**
 * Stripe's card form for the next amount due, on the page (19 Nov 2026, Martin: "upon pressing it a Stripe powered card
 * payment box should appear for the deposit"). The session is made on the server for the business's own Stripe
 * account; the card goes to Stripe, never to us. If the form can't open, Stripe's own page is offered instead.
 */
function CardBox(props: { token: string; due: PublicPayments["dues"][number]["key"]; back: "proposal" | "order"; onFallback: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let live = true;
    let unmount: (() => void) | null = null;
    void (async () => {
      const got = await cardFormFor(props.token, props.due, props.back);
      if (!live) return;
      if (!got.ok) {
        setLoading(false);
        return setProblem(got.message);
      }
      try {
        unmount = await mountDepositForm(el, Promise.resolve(got.secret), (m) => live && setProblem(m), got.account);
      } catch {
        if (live) setProblem("The card form couldn't load just now.");
      }
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
      unmount?.();
    };
  }, [props.token, props.due, props.back]);
  return (
    <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <CreditCard className="size-4" aria-hidden /> Pay by card · secured by Stripe
      </p>
      {loading && <p className="mt-3 text-[13px] text-muted">Opening the card form…</p>}
      <div ref={host} className="mt-3" />
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}{" "}
          <button type="button" className="underline underline-offset-2" onClick={props.onFallback}>
            Pay on Stripe&apos;s page instead
          </button>
        </p>
      )}
    </div>
  );
}
