"use client";

import { Check, Loader2, Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { landingLabel } from "@/lib/domain/landing";
import { formatAddress } from "@/lib/mock/addresses";
import { requestFollowUp } from "@/lib/services/consumer";
import { trackGoogleConversion } from "@/lib/services/google-ads";
import { trackFollowUp } from "@/lib/services/meta-pixel";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "./consent-boxes";
import { useFlow } from "./flow-state";

const field =
  "h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-ink";

/**
 * Top of "About your home", before the bill: an optional email, mobile or both
 * (at least one) so the team can get in touch to help (speed to lead). The
 * server emails them (and texts, when SMS is set up) straight away, and tells
 * staff to get in touch now. Hidden once a bill is read.
 */
export function EarlyContact() {
  const { state, update } = useFlow();
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);

  if (state.earlyContact) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-sage px-5 py-4 text-forest" role="status">
        <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        <p className="text-[14px]">Thanks. We&apos;ll be in touch soon. Carry on below in the meantime, if you like.</p>
      </div>
    );
  }
  if (state.bill) return null;
  const given = Boolean(email.trim() || mobile.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!given) return setProblem("Enter your email or mobile so we can get in touch.");
    if (!consent.terms) return setConsentMissing(true);
    setBusy(true);
    setProblem(null);
    const r = await requestFollowUp({
      email: email.trim() || undefined,
      mobile: mobile.trim() || undefined,
      stage: "started",
      home: state.address ? formatAddress(state.address) : undefined,
      suburb: state.address?.suburb,
      source: [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      entry: landingLabel(state.entry),
      consent,
    });
    setBusy(false);
    if (r.ok) {
      // A real lead (it's in HubSpot): counted for the ads, with no details.
      trackFollowUp();
      trackGoogleConversion("follow-up");
      update({ earlyContact: true });
    } else setProblem(r.message ?? "That didn't send. Please try again.");
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]"
    >
      <p className="flex items-center gap-2 text-[15px] text-ink">
        <Phone className="h-4 w-4 text-forest" strokeWidth={1.7} aria-hidden />
        Prefer a hand with this?
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        Leave your email or mobile and someone from our team will get in touch to help. Optional.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0">
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
        <label className="flex min-w-0">
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
      {/* The tickboxes and button appear once they start typing, so the card stays small for everyone else. */}
      {given && (
        <>
          <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} className="mt-3" />
          <Button type="submit" className="mt-3 w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get in touch"}
          </Button>
        </>
      )}
    </form>
  );
}
