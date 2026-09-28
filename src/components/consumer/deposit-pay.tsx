"use client";

import { Apple, CreditCard, Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/domain/format";
import { startDepositPayment, startHostedDepositPayment } from "@/lib/services/consumer";
import { mountDepositForm, stripeFormAvailable } from "@/lib/services/stripe-form";

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** How long the embedded form gets to appear before we offer Stripe's own page instead. */
const FORM_TIMEOUT_MS = 12_000;

/**
 * Stripe's embedded payment form for the deposit, on our own page. If it
 * can't load (no publishable key, Stripe.js blocked, a Stripe error), the
 * customer gets a button to Stripe's own secure payment page instead.
 */
export function DepositPay({ reference, email, amount }: { reference: string; email: string | null; amount: number }) {
  const formRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "form" | "backup">(stripeFormAvailable() ? "loading" : "backup");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const el = formRef.current;
    if (!el || !stripeFormAvailable()) return;
    let cleanup: (() => void) | undefined;
    let live = true;
    const fallBack = (why: unknown) => {
      if (!live) return;
      console.warn("deposit form unavailable, offering Stripe's page", why);
      setState((s) => (s === "form" ? s : "backup"));
    };
    const timer = setTimeout(() => fallBack("timed out"), FORM_TIMEOUT_MS);
    const clientSecret = startDepositPayment(reference, email).then((r) => {
      if (!r.ok) throw new Error(r.message);
      return r.clientSecret;
    });
    clientSecret.catch(fallBack);
    mountDepositForm(el, clientSecret, (m) => live && setProblem(m))
      .then((c) => {
        cleanup = c;
        clearTimeout(timer);
        if (live) setState("form");
        else c();
      })
      .catch(fallBack);
    return () => {
      live = false;
      clearTimeout(timer);
      cleanup?.();
    };
  }, [reference, email]);

  async function payOnStripe() {
    setBusy(true);
    setProblem(null);
    const r = await startHostedDepositPayment(reference, email);
    if (r.ok) window.location.assign(r.url);
    else {
      setProblem(r.message);
      setBusy(false);
    }
  }

  return (
    <div>
      {state === "loading" && (
        <p className="flex items-center justify-center gap-2 py-6 text-[14px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading secure payment
        </p>
      )}
      <div id="checkout-form" ref={formRef} className={state === "backup" ? "hidden" : undefined} />
      {state === "backup" && (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => void payOnStripe()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${formatCurrency(amount)} deposit`}
        </Button>
      )}
      {state === "form" && (
        <button
          type="button"
          onClick={() => void payOnStripe()}
          disabled={busy}
          className="tap-area relative mx-auto mt-3 block text-[13px] text-muted underline underline-offset-4"
        >
          Trouble with the form? Pay on Stripe&apos;s secure page
        </button>
      )}
      <div className="mt-3 flex items-center justify-center gap-2" aria-label="Card, Apple Pay or Google Pay">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-white">
          <CreditCard className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white">
          <Apple className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white ring-1 ring-line">
          <GoogleG />
        </span>
        <span className="text-[12px] font-extrabold italic tracking-tight text-[#1A1F71]">VISA</span>
        <span className="relative flex h-3.5 w-[22px]" aria-hidden>
          <span className="absolute left-0 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
          <span className="absolute right-0 h-3.5 w-3.5 rounded-full bg-[#F79E1B] mix-blend-multiply" />
        </span>
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-muted">
        <Lock className="h-3.5 w-3.5" strokeWidth={1.6} /> Secure payment by Stripe. Fully refundable.
      </p>
      {problem && (
        <p className="mt-3 text-center text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
