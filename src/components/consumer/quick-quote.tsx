"use client";

import { ArrowLeft, ArrowRight, Check, Gift, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { billFromSpend } from "@/lib/domain/spend-estimate";
import {
  INTEREST_OPTIONS,
  PERIOD_OPTIONS,
  QUOTE_COPY,
  QUOTE_STEPS,
  bandOptions,
  profileFromQuote,
  quickEstimate,
  type QuoteAnswers,
  type QuoteStep,
} from "@/lib/domain/quick-quote";
import type { Address } from "@/lib/domain/types";
import { formatAddress } from "@/lib/mock/addresses";
import { sendQuickQuote } from "@/lib/services/consumer";
import { trackGoogleConversion } from "@/lib/services/google-ads";
import { trackLead } from "@/lib/services/meta-pixel";
import { useWhoopOpen } from "@/lib/services/whoop";
import { WHOOP_COPY } from "@/lib/domain/whoop-offer";
import { AddressEntry } from "./address-entry";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "./consent-boxes";
import { useFlow } from "./flow-state";
import { stepHref } from "./steps";

const field =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-muted focus:border-ink";

function Choice({ label, hint, chosen, onClick }: { label: string; hint?: string; chosen?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={chosen}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition",
        chosen ? "bg-primary text-primary-ink" : "bg-surface text-ink shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1.5px_var(--ink)]",
      )}
    >
      <span>
        <span className="block text-[16px]">{label}</span>
        {hint && <span className={cn("block text-[13px]", chosen ? "opacity-80" : "text-muted")}>{hint}</span>}
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 opacity-60" strokeWidth={1.6} aria-hidden />
    </button>
  );
}

/**
 * The ad landing page: four one-tap questions, then first name and mobile (the lead, straight to HubSpot),
 * then an indicative estimate with the full plan one tap away. Rules and copy in `domain/quick-quote.ts`.
 */
export function QuickQuote({ preset }: { preset?: QuoteAnswers["interest"] }) {
  const router = useRouter();
  const { state, update } = useFlow();
  const whoopOpen = useWhoopOpen();
  const [answers, setAnswers] = useState<QuoteAnswers>({ period: "quarterly", interest: preset });
  const [stepIndex, setStepIndex] = useState(preset ? 1 : 0);
  const [address, setAddress] = useState<Address | null>(null);
  const [firstName, setFirstName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ emailed: boolean } | null>(null);

  const step: QuoteStep = QUOTE_STEPS[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, QUOTE_STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));
  const set = (patch: Partial<QuoteAnswers>, advance = true) => {
    setAnswers((a) => ({ ...a, ...patch }));
    if (advance) next();
  };
  const estimate = quickEstimate(answers);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return setProblem("Enter your first name.");
    if (!mobile.trim()) return setProblem("Enter your mobile so we can call you.");
    if (!consent.terms) return setConsentMissing(true);
    setBusy(true);
    setProblem(null);
    const r = await sendQuickQuote({
      firstName: firstName.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      answers,
      home: address ? formatAddress(address) : undefined,
      suburb: address?.suburb,
      source: [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      entry: preset === "battery-existing" ? "Quick quote (battery)" : "Quick quote",
      consent,
    });
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't send. Please try again.");
    // The lead is in HubSpot: counted once for the ads, with no details.
    if (!state.quoteTracked) {
      trackLead();
      trackGoogleConversion("follow-up");
    }
    // Carry everything into the full plan, so nothing is asked twice.
    update({
      ...(address ? { address } : {}),
      bill:
        answers.band && answers.period && answers.interest !== "battery-existing"
          ? billFromSpend(answers.period, answers.band)
          : state.bill,
      profile: { ...state.profile, ...profileFromQuote(answers) },
      tier: answers.interest === "solar-only" ? "essential" : "recommended",
      config: null,
      earlyContact: true,
      quoteTracked: true,
      spendTracked: true,
      contact: { firstName: firstName.trim(), lastName: "", mobile: mobile.trim(), email: email.trim() },
    });
    setDone({ emailed: Boolean(r.emailed) });
  }

  if (done) {
    return (
      <div className="space-y-5">
        <h1 className="text-[30px] font-normal leading-tight tracking-[-0.03em] lg:text-[38px]">
          {QUOTE_COPY.resultHeading(firstName.trim())}
        </h1>
        <div className="rounded-[var(--radius-card)] bg-sage px-6 py-6 text-forest">
          {estimate ? (
            <>
              <p className="text-[15px]">{estimate.withBattery ? QUOTE_COPY.resultSaving : QUOTE_COPY.resultSavingSolar}</p>
              <p className="mt-1 text-[44px] leading-none tracking-[-0.03em] tabular-nums">
                ${estimate.amount.toLocaleString("en-AU")}
                <span className="ml-2 text-[16px] tracking-normal">{QUOTE_COPY.perYear}</span>
              </p>
              <p className="mt-3 text-[12.5px] leading-snug opacity-90">{QUOTE_COPY.resultNote}</p>
            </>
          ) : (
            <p className="text-[15px] leading-snug">{QUOTE_COPY.resultBattery}</p>
          )}
        </div>
        {done.emailed && (
          <p className="flex items-center gap-2 text-[13.5px] text-ink-2">
            <Check className="h-4 w-4 text-positive" strokeWidth={2} aria-hidden /> {QUOTE_COPY.emailed}
          </p>
        )}
        <div>
          <Button size="lg" className="w-full" onClick={() => router.push(address ? stepHref("analysing") : "/")}>
            {QUOTE_COPY.continue} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Button>
          <p className="mt-2 text-center text-[12.5px] text-muted">{QUOTE_COPY.continueNote}</p>
        </div>
        <Link
          href="/book-a-call"
          className="tap-area flex items-center justify-center gap-2 text-[14px] text-forest underline-offset-4 hover:underline"
        >
          <Phone className="h-4 w-4" strokeWidth={1.7} aria-hidden /> {QUOTE_COPY.call}
        </Link>
      </div>
    );
  }

  const questionCount = QUOTE_STEPS.length;
  return (
    <div>
      {stepIndex === 0 && (
        <div className="mb-7">
          <p className="text-[13px] tracking-[0.02em] text-forest">{QUOTE_COPY.eyebrow}</p>
          <h1 className="mt-3 text-[34px] font-normal leading-[1.06] tracking-[-0.035em] sm:text-[44px]">{QUOTE_COPY.headline}</h1>
          <p className="mt-3 text-[15px] text-ink-2">{QUOTE_COPY.sub}</p>
        </div>
      )}
      <div className="mb-4 flex items-center gap-3">
        {stepIndex > 0 && (
          <button type="button" onClick={back} aria-label="Back" className="tap-area -ml-1 grid h-8 w-8 place-items-center text-ink-2">
            <ArrowLeft className="h-5 w-5" strokeWidth={1.6} />
          </button>
        )}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / questionCount) * 100}%` }} />
        </div>
        <span className="text-[12px] tabular-nums text-muted">{QUOTE_COPY.progress(stepIndex + 1, questionCount)}</span>
      </div>

      {step === "interest" && (
        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-[20px] text-ink">{QUOTE_COPY.interest}</legend>
          {INTEREST_OPTIONS.map((o) => (
            <Choice
              key={o.value}
              label={o.label}
              hint={o.hint}
              chosen={answers.interest === o.value}
              onClick={() => set({ interest: o.value })}
            />
          ))}
        </fieldset>
      )}

      {step === "bill" && (
        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-[20px] text-ink">{QUOTE_COPY.bill}</legend>
          <div className="mb-1 flex gap-2" role="radiogroup" aria-label="How often are you billed?">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={answers.period === p.value}
                onClick={() => set({ period: p.value }, false)}
                className={cn(
                  "h-9 rounded-full px-4 text-[13.5px] transition",
                  answers.period === p.value ? "bg-ink text-canvas" : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {bandOptions(answers.period ?? "quarterly").map((o) => (
            <Choice key={o.value} label={o.label} chosen={answers.band === o.value} onClick={() => set({ band: o.value })} />
          ))}
        </fieldset>
      )}

      {step === "owner" && (
        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-[20px] text-ink">{QUOTE_COPY.owner}</legend>
          <Choice label="Yes" chosen={answers.owner === true} onClick={() => set({ owner: true })} />
          <Choice label="No, I'm renting" chosen={answers.owner === false} onClick={() => set({ owner: false }, false)} />
          {answers.owner === false && (
            <div className="rounded-2xl bg-surface-2 px-5 py-4">
              <p className="text-[13.5px] leading-snug text-ink-2">{QUOTE_COPY.ownerNo}</p>
              <Button variant="secondary" className="mt-3" onClick={next}>
                Continue anyway
              </Button>
            </div>
          )}
        </fieldset>
      )}

      {step === "address" && (
        <div>
          <p className="text-[20px] text-ink">{QUOTE_COPY.address}</p>
          <p className="mt-1 text-[13.5px] text-muted">{QUOTE_COPY.addressNote}</p>
          <AddressEntry
            className="mt-4"
            entry={preset === "battery-existing" ? "battery" : undefined}
            onPick={(a) => {
              setAddress(a);
              next();
            }}
          />
        </div>
      )}

      {step === "contact" && (
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
          <p className="text-[20px] text-ink">{QUOTE_COPY.contact}</p>
          <p className="-mt-1 text-[13.5px] text-muted">{QUOTE_COPY.contactNote}</p>
          <label className="block">
            <span className="sr-only">First name</span>
            <input
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={field}
            />
          </label>
          <label className="block">
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
          <label className="block">
            <span className="sr-only">Email (optional)</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email (optional, for a copy)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>
          <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} />
          {problem && (
            <p className="text-[13px] text-danger" role="alert">
              {problem}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : QUOTE_COPY.submit}
          </Button>
        </form>
      )}

      <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted">
        {QUOTE_COPY.trust.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2.2} aria-hidden /> {t}
          </li>
        ))}
      </ul>
      {whoopOpen && answers.interest !== "solar-only" && (
        <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[13px] leading-snug text-canvas">
          <Gift className="mt-0.5 h-4 w-4 shrink-0 text-sun-bright" strokeWidth={1.7} aria-hidden />
          <span>{WHOOP_COPY.strip}</span>
        </p>
      )}
    </div>
  );
}
