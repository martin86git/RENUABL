"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { formatAddress } from "@/lib/mock/addresses";
import { requestFollowUp } from "@/lib/services/consumer";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "./consent-boxes";
import { useFlow } from "./flow-state";

const field =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-ink";

/**
 * "Don't have your bill handy?": the visitor leaves their email, mobile or both
 * (at least one) so we can follow up, instead of leaving. They still need the
 * bill to continue.
 */
export function BillLater() {
  const { state } = useFlow();
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);

  if (state.bill) return null;
  const given = Boolean(email.trim() || mobile.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!given) {
      setProblem("Enter your email or mobile so we can get in touch.");
      return;
    }
    if (!consent.terms) {
      setConsentMissing(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    const r = await requestFollowUp({
      email: email.trim() || undefined,
      mobile: mobile.trim() || undefined,
      home: state.address ? formatAddress(state.address) : undefined,
      source: [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      consent,
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setProblem(r.message ?? "That didn't send. Please try again.");
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-sage px-5 py-4 text-forest" role="status">
        <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        <p className="text-[14px]">Thanks. We&apos;ll be in touch, and you can come back and add your bill any time.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="rounded-[var(--radius-card)] bg-sage px-5 py-5">
      <p className="text-[16px] text-forest">Don&apos;t have your bill handy right now?</p>
      <p className="mt-0.5 text-[13px] text-ink-2">Leave your email or mobile and we&apos;ll get in touch. You only need one.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>
          <span className="sr-only">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className="sr-only">Mobile</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className={field}
          />
        </label>
      </div>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} className="mt-3" />
      <Button type="submit" className="mt-3 w-full" disabled={busy || !given}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get in touch"}
      </Button>
    </form>
  );
}
