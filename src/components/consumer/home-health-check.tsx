"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "@/components/consumer/consent-boxes";
import { useFlow } from "@/components/consumer/flow-state";
import { Button, Card, cn } from "@/components/ui/primitives";
import { PACKAGES } from "@/lib/domain/healthy-home";
import { HEALTH_QUESTIONS, SENSITIVE_CONSENT, healthPlan, HEALTH_RESULTS_COPY as COPY, type HealthAnswers } from "@/lib/domain/home-health";
import { formatAddress } from "@/lib/mock/addresses";
import { saveHomeHealth } from "@/lib/services/home-health";

const TOTAL = HEALTH_QUESTIONS.length;

/**
 * The Home Health check: one optional question per screen, then the plan.
 * After a reservation it's saved on the order straight away; otherwise it
 * ends by asking for an email to save the plan.
 */
export function HomeHealthCheck() {
  const { state } = useFlow();
  const linked = Boolean(state.reservation?.reservationId && state.contact?.email);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<HealthAnswers>({});
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const done = index >= TOTAL;
  const exit = linked ? "/my" : "/";

  const q = HEALTH_QUESTIONS[Math.min(index, TOTAL - 1)];
  const next = () => {
    setIndex((i) => Math.min(i + 1, TOTAL));
    window.scrollTo({ top: 0 });
  };
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  function pick(optionId: string) {
    if (q.multi) {
      const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      const only = ["none", "nothing-right-now"];
      const updated = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : only.includes(optionId)
          ? [optionId]
          : [...current.filter((x) => !only.includes(x)), optionId];
      setAnswers((a) => ({ ...a, [q.id]: updated }));
      return;
    }
    setAnswers((a) => ({ ...a, [q.id]: optionId }));
    window.setTimeout(next, 220);
  }

  if (done) return <HealthResults answers={answers} sensitiveConsent={sensitiveConsent} linked={linked} exit={exit} onBack={back} />;

  const selected = answers[q.id];
  const isPicked = (id: string) => (Array.isArray(selected) ? selected.includes(id) : selected === id);
  const locked = q.sensitive && !sensitiveConsent;

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>
          {q.section} · {index + 1} of {TOTAL}
        </span>
        <Link href={exit} className="tap-area underline-offset-4 hover:text-ink hover:underline">
          Skip for now
        </Link>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL}
      >
        <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${((index + 1) / TOTAL) * 100}%` }} />
      </div>

      <h1 className="mt-8 text-[28px] font-normal leading-tight tracking-[-0.03em] lg:text-[34px]">{q.prompt}</h1>
      {q.multi && <p className="mt-2 text-[14px] text-muted">Choose any that apply.</p>}
      {q.sensitive && (
        <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-snug text-ink-2">
          <p>
            Optional. We only use this for your recommendations. See our{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={sensitiveConsent}
              onChange={(e) => {
                setSensitiveConsent(e.target.checked);
                if (!e.target.checked) setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== q.id)));
              }}
              className="mt-px h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>{SENSITIVE_CONSENT}</span>
          </label>
        </div>
      )}

      <div className="mt-6 grid gap-2.5">
        {q.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={locked}
            onClick={() => pick(opt.id)}
            aria-pressed={isPicked(opt.id)}
            className={cn(
              "flex min-h-14 items-center justify-between rounded-2xl border px-5 text-left text-[16px] transition",
              isPicked(opt.id) ? "border-forest bg-sage text-forest" : "border-line-strong bg-surface text-ink hover:border-ink",
              locked && "cursor-not-allowed border-line bg-surface-2 text-muted hover:border-line",
            )}
          >
            {opt.label}
            {isPicked(opt.id) && <Check className="h-5 w-5" strokeWidth={2} aria-hidden />}
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {index > 0 && (
          <Button variant="secondary" size="lg" onClick={back} aria-label="Back">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Button>
        )}
        {q.multi ? (
          <Button size="lg" className="flex-1 sm:flex-none sm:px-10" onClick={next}>
            Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Button>
        ) : null}
        <button
          type="button"
          onClick={next}
          className="tap-area ml-auto text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Skip
        </button>
      </div>
      {state.address && !linked && index === 0 && <p className="mt-10 text-[12.5px] text-muted">For {formatAddress(state.address)}</p>}
    </div>
  );
}

function HealthResults({
  answers,
  sensitiveConsent,
  linked,
  exit,
  onBack,
}: {
  answers: HealthAnswers;
  sensitiveConsent: boolean;
  linked: boolean;
  exit: string;
  onBack: () => void;
}) {
  const { state } = useFlow();
  const plan = useMemo(() => healthPlan(answers), [answers]);
  const [id, setId] = useState<string | null>(null);
  const [email, setEmail] = useState(state.contact?.email ?? "");
  const [address, setAddress] = useState(state.address ? formatAddress(state.address) : "");
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const autoSaved = useRef(false);

  async function save(extra: { email?: string; address?: string; consent?: ConsentState }) {
    setBusy(true);
    setProblem(null);
    const r = await saveHomeHealth({
      answers,
      sensitiveConsent,
      reference: linked ? state.reservation?.reservationId : undefined,
      email: linked ? state.contact?.email : extra.email,
      address: extra.address,
      consent: extra.consent,
    });
    setBusy(false);
    if (!r.ok || !r.id) {
      setProblem(r.message ?? "We couldn't save your answers just now. Please try again.");
      if (r.consent) setConsentMissing(true);
      return;
    }
    setId(r.id);
  }

  // After a reservation the plan is saved on the order straight away.
  useEffect(() => {
    if (!linked || autoSaved.current) return;
    autoSaved.current = true;
    void save({ address: state.address ? formatAddress(state.address) : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [linked]);

  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent.terms) {
      setConsentMissing(true);
      return;
    }
    void save({ email, address, consent });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-20 pt-6 sm:px-8 lg:pt-12">
      <button type="button" onClick={onBack} className="tap-area inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.6} /> Back to the questions
      </button>
      <p className="mt-6 text-[13px] tracking-[0.02em] text-forest">Your Home Health check</p>
      <h1 className="mt-2 text-[32px] font-normal leading-tight tracking-[-0.035em] lg:text-[40px]">
        {plan.recommendations.length ? COPY.heading : COPY.headingNone}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{plan.recommendations.length ? COPY.intro : COPY.introNone}</p>

      {plan.recommendations.length > 0 && (
        <ol className="mt-8 space-y-3">
          {plan.recommendations.map((r, i) => {
            return (
              <li key={r.item}>
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage text-[14px] text-forest">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] text-ink">{r.title}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted">{r.why}</p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <Card className="mt-6 bg-sage p-5 text-forest">
        <p className="flex items-center gap-2 text-[15px]">
          <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden /> Free {plan.freeFixes.length > 1 ? "fixes" : "fix"}
        </p>
        <ul className="mt-2 space-y-2">
          {plan.freeFixes.map((f) => (
            <li key={f.title} className="text-[14px] leading-relaxed">
              <span className="font-medium">{f.title}.</span> {f.why}
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 rounded-2xl border border-line px-5 py-4 text-[13.5px] leading-relaxed text-muted">{COPY.notYet}</p>

      {plan.longTerm && (
        <Card className="mt-6 p-5">
          <p className="text-[16px] text-ink">Staying for the long run?</p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Since you plan to stay 10 years or more, these are the kinds of upgrades worth keeping in mind over time.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PACKAGES.cards[1].chips.map((c) => (
              <li key={c} className="rounded-full bg-sage px-3 py-1.5 text-[13px] text-forest">
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {problem && (
        <p className="mt-6 text-[13.5px] text-danger" role="alert">
          {problem}
        </p>
      )}

      {!linked && !id && (
        <form onSubmit={saveForm} className="mt-8 rounded-[var(--radius-card)] border border-line p-5">
          <p className="text-[17px] text-ink">{COPY.save}</p>
          <p className="mt-1 text-[13.5px] text-muted">{COPY.saveWhy}</p>
          <label className="mt-4 block">
            <span className="text-[12.5px] text-muted">Your home address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12.5px] text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink outline-none focus:border-ink"
            />
          </label>
          <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} className="mt-4" />
          <Button type="submit" size="lg" className="mt-5 w-full sm:w-auto sm:px-10" disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save my answers"}
          </Button>
        </form>
      )}

      {id && (
        <p className="mt-8 flex items-center gap-2 text-[14px] text-positive" role="status">
          <Check className="h-4 w-4" strokeWidth={2} /> {linked ? COPY.savedLinked : COPY.saved}
        </p>
      )}
      {linked && busy && !id && <p className="mt-8 text-[14px] text-muted">Saving to your order…</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        {linked ? (
          <Link href="/my" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] text-primary-ink">
            Go to My RENUABL <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        ) : (
          <Link href="/#plan" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] text-primary-ink">
            Get my solar and battery plan <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        )}
        {!linked && (
          <Link
            href={exit}
            className="tap-area inline-flex items-center text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Back to home
          </Link>
        )}
      </div>
    </div>
  );
}
