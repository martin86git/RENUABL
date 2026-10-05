"use client";

import { ArrowLeft, ArrowRight, CalendarCheck, Check, Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { BillUpload } from "@/components/consumer/bill-upload";
import { useFlow, useInstallLead, useSystem } from "@/components/consumer/flow-state";
import { SpendEstimate } from "@/components/consumer/spend-estimate";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, cn, Wordmark } from "@/components/ui/primitives";
import {
  BRIEF_COPY,
  BRIEF_NEXT_STEPS,
  briefSteps,
  profileFromBrief,
  questionById,
  solarVicLook,
  type BriefAnswers,
  type StepKind,
} from "@/lib/domain/brief";
import { earliestInstallLine } from "@/lib/domain/flow-moments";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { INSTALL_ARRIVAL, installDateNote } from "@/lib/domain/scheduling";
import { PRICE_INCLUDES, describeSystem } from "@/lib/domain/recommendation";
import { SPEND_COPY, SPEND_ESTIMATE_ENABLED, isIndicative } from "@/lib/domain/spend-estimate";
import { formatAddress } from "@/lib/mock/addresses";
import { roundDownSavings } from "@/lib/domain/savings-preview";
import { getAvailability, roofImageSrc } from "@/lib/services/consumer";
import { saveBrief, type BriefSummaryInput } from "@/lib/services/brief";
import { BriefBooking } from "./brief-booking";
import { BriefHouse } from "./brief-house";

const stepId = (s: StepKind) => (s.kind === "question" ? `q:${s.id}` : s.kind);

/** The guided brief for a lead we already have: one thing a screen, ending in a booked call. */
export function BriefFlow({
  briefKey,
  firstName,
  mobile,
  email,
  initialAnswers,
  booked,
}: {
  briefKey: string;
  firstName: string;
  mobile: string | null;
  email: string | null;
  initialAnswers: BriefAnswers;
  booked: string | null;
}) {
  const { state, update, hydrated } = useFlow();
  const system = useSystem();
  const lead = useInstallLead();
  const [answers, setAnswers] = useState<BriefAnswers>(initialAnswers);
  const [at, setAt] = useState<string>("welcome");
  const [unfinished, setUnfinished] = useState(false);
  const [done, setDone] = useState<{ call: string; emailed: boolean } | null>(booked ? { call: booked, emailed: false } : null);
  const steps = useMemo(() => briefSteps(answers, state.address?.state ?? null), [answers, state.address?.state]);
  const index = Math.max(
    0,
    steps.findIndex((s) => stepId(s) === at),
  );
  const step = done ? ({ kind: "done" } as StepKind) : steps[index];
  const indicative = isIndicative(state.bill);
  // "Hi Martin", even when staff typed the full name.
  const greetingName = firstName.trim().split(/\s+/)[0] || "there";

  // Pick up where they left off on this device.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(`renuabl.brief.${briefKey}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore once after mount
      if (saved) setAt(saved);
    } catch {
      /* storage unavailable */
    }
  }, [briefKey]);
  useEffect(() => {
    try {
      localStorage.setItem(`renuabl.brief.${briefKey}`, at);
    } catch {
      /* storage unavailable */
    }
    window.scrollTo({ top: 0 });
  }, [at, briefKey]);

  // The answers drive the same sizing and pricing as the main flow.
  useEffect(() => {
    if (!hydrated) return;
    const patch = profileFromBrief(answers);
    const sv = solarVicLook(answers) === "likely";
    update({
      profile: { ...state.profile, ...patch },
      config: null,
      tier: patch.wantsBattery === false ? "essential" : state.tier === "essential" && patch.wantsBattery ? "recommended" : state.tier,
      solarVic: { ...state.solarVic, rebate: answers.sv_income ? sv : state.solarVic.rebate },
    });
    // Only when the answers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, hydrated]);

  const summary = useCallback((): BriefSummaryInput => {
    const { price, config } = system;
    return {
      home: state.address ? formatAddress(state.address) : undefined,
      usage: state.bill
        ? `${state.bill.dailyUsageKwh} kWh a day${indicative ? " (indicative, from what they spend)" : " (from their bill)"}`
        : undefined,
      system: state.bill ? describeSystem(config) : undefined,
      price: state.bill ? `${formatCurrency(price.total)} after ${formatCurrency(price.rebates)} in rebates` : undefined,
      rebates: price.rebateLines.length ? price.rebateLines.map((r) => r.label).join(", ") : undefined,
      installDate: state.installDate ? formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long" }) : undefined,
      billRead: Boolean(state.bill && !indicative),
    };
  }, [system, state.address, state.bill, state.installDate, indicative]);

  // Save as they go (a moment after each change).
  useEffect(() => {
    if (!hydrated || done) return;
    const t = setTimeout(() => void saveBrief(briefKey, answers, summary()), 800);
    return () => clearTimeout(t);
  }, [answers, at, hydrated, done, briefKey, summary]);

  const go = (delta: number) => {
    const next = steps[Math.min(steps.length - 1, Math.max(0, index + delta))];
    if (next) setAt(stepId(next));
  };
  const answer = (id: string, value: string) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setTimeout(() => {
      // Work out the next step with the new answer in place (it can add or remove steps).
      const after = briefSteps({ ...answers, [id]: value }, state.address?.state ?? null);
      const i = after.findIndex((s) => stepId(s) === `q:${id}`);
      const next = after[i + 1];
      if (next) setAt(stepId(next));
    }, 220);
  };
  const toBooking = () => {
    setUnfinished(true);
    setAt("booking");
  };

  const total = steps.length - 1; // "done" isn't a step to count
  const shown = Math.min(index + 1, total);
  const beforeBooking = step.kind !== "booking" && step.kind !== "done" && step.kind !== "welcome";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-5">
      <header className="flex items-center justify-between">
        <Wordmark className="text-[17px]" />
        {step.kind !== "welcome" && step.kind !== "done" && (
          <span className="text-[12.5px] text-muted">
            Step {shown} of {total}
          </span>
        )}
      </header>
      {step.kind !== "welcome" && step.kind !== "done" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${(shown / total) * 100}%` }} />
        </div>
      )}
      {step.kind !== "welcome" && step.kind !== "done" && (
        <button
          type="button"
          onClick={() => go(-1)}
          className="tap-area mt-4 inline-flex w-fit items-center gap-1.5 text-[13.5px] text-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </button>
      )}

      <main className="mt-5 flex-1 animate-fade-up" key={done ? "done" : stepId(step)}>
        {step.kind === "welcome" && (
          // Fills the first screen: a roomy greeting, the three steps, and the button at the bottom.
          <section className="flex min-h-[calc(100svh-7.5rem)] flex-col lg:min-h-0">
            <div className="pt-8 lg:pt-16">
              <h1 className="text-[42px] lg:text-[52px] font-normal leading-[1.05] tracking-[-0.03em]">Hi {greetingName}.</h1>
              <p className="mt-4 text-[22px] leading-snug text-ink-2">{BRIEF_COPY.welcomeLead}</p>
            </div>
            <ol className="mt-12 space-y-6">
              {BRIEF_COPY.welcomeSteps.map((s, i) => (
                <li key={s} className="flex items-center gap-4 text-[16px] leading-snug text-ink-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] border-sun-line text-[13px] text-sun-line-ink">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-auto pt-12 lg:mt-14 lg:pt-0">
              <p className="text-[13.5px] leading-relaxed text-muted">{BRIEF_COPY.welcomeTime}</p>
              <Button size="lg" className="mt-5 w-full" onClick={() => go(1)}>
                Let&apos;s start <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </Button>
            </div>
          </section>
        )}

        {step.kind === "address" && (
          <section>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">Where&apos;s your home?</h1>
            {state.address ? (
              <div className="mt-5">
                {typeof state.address.lat === "number" && typeof state.address.lng === "number" && (
                  // eslint-disable-next-line @next/next/no-img-element -- our own satellite photo route
                  <img
                    src={roofImageSrc(state.address.lat, state.address.lng)}
                    alt="Your home from above"
                    className="aspect-square w-full rounded-[var(--radius-card)] bg-surface-2 object-cover"
                  />
                )}
                <p className="mt-3 text-[15px] text-ink">{formatAddress(state.address)}</p>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button size="lg" onClick={() => go(1)}>
                    That&apos;s my home
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => update({ address: null })}>
                    Change address
                  </Button>
                </div>
              </div>
            ) : (
              <AddressEntry className="mt-5" onPick={() => undefined} />
            )}
          </section>
        )}

        {step.kind === "question" && <QuestionScreen id={step.id} value={answers[step.id]} onAnswer={answer} onSkip={() => go(1)} />}

        {step.kind === "date" && (
          <DateScreen
            leadDays={lead.days}
            solarVic={lead.solarVic}
            value={state.installDate}
            onPick={(installDate) => update({ installDate, windowId: INSTALL_ARRIVAL.id })}
            onNext={() => go(1)}
          />
        )}

        {step.kind === "bill" && (
          <section>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.billTitle}</h1>
            <p className="mt-2 text-[14px] text-muted">We size your system to what your home actually uses.</p>
            <div className="mt-5 space-y-4">
              <BillUpload
                bill={isIndicative(state.bill) ? null : state.bill}
                address={state.address ? formatAddress(state.address) : undefined}
                onRead={(bill) => update({ bill, config: null })}
              />
              {SPEND_ESTIMATE_ENABLED && (!state.bill || indicative) && (
                <>
                  <p className="flex items-center gap-3 text-[12.5px] uppercase tracking-[0.12em] text-muted" aria-hidden>
                    <span className="h-px flex-1 bg-line" />
                    {SPEND_COPY.or}
                    <span className="h-px flex-1 bg-line" />
                  </p>
                  <SpendEstimate bill={state.bill} onPick={(bill) => update({ bill, config: null })} />
                </>
              )}
            </div>
            <Button size="lg" className="mt-6 w-full" disabled={!state.bill} onClick={() => go(1)}>
              Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Button>
          </section>
        )}

        {step.kind === "house" && (
          <section>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.houseTitle}</h1>
            <div className="mt-5">
              {state.bill ? <BriefHouse system={system} indicative={indicative} /> : <p className="text-muted">Add your bill first.</p>}
            </div>
            <Button size="lg" className="mt-6 w-full" onClick={() => go(1)}>
              Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Button>
          </section>
        )}

        {step.kind === "price" && (
          <PriceScreen
            system={system}
            tier={state.tier}
            indicative={indicative}
            productsChosen={answers.products === "choose"}
            hasBill={Boolean(state.bill)}
            onTier={(tier) => update({ tier, config: null })}
            onNext={() => go(1)}
          />
        )}

        {step.kind === "notes" && (
          <section>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.notesTitle}</h1>
            <p className="mt-2 text-[14px] text-muted">{BRIEF_COPY.notesHelp}</p>
            <textarea
              value={answers.notes ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value.slice(0, 1000) }))}
              rows={5}
              className="mt-5 w-full rounded-2xl border border-line bg-surface p-4 text-[15px] text-ink outline-none focus:border-ink"
              placeholder="e.g. Can we add a battery later? Is my switchboard OK?"
            />
            <div className="mt-4">
              <AskRenuabl context="recommendation" variant="link" title="Or ask Revo now" />
            </div>
            <Button size="lg" className="mt-6 w-full" onClick={() => go(1)}>
              Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Button>
          </section>
        )}

        {step.kind === "booking" && (
          <section>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.bookingTitle}</h1>
            <p className="mt-2 text-[14px] text-muted">
              We&apos;ll call you to confirm your roof, switchboard and design, and answer your questions. No obligation.
            </p>
            <div className="mt-5">
              <BriefBooking
                briefKey={briefKey}
                mobile={mobile}
                email={email}
                payload={() => ({ answers, summary: summary(), unfinished })}
                onBooked={(r) => {
                  setDone(r);
                  setAt("done");
                }}
              />
            </div>
          </section>
        )}

        {step.kind === "done" && (
          <section>
            <CalendarCheck className="h-9 w-9 text-positive" strokeWidth={1.6} aria-hidden />
            <h1 className="mt-3 text-[32px] font-normal leading-tight tracking-[-0.03em]">{BRIEF_COPY.doneTitle}</h1>
            {done && <p className="mt-2 text-[15px] text-ink-2">We&apos;ll call you on {done.call}.</p>}
            {done?.emailed && <p className="mt-1 text-[13.5px] text-muted">We&apos;ve emailed you the details with a calendar invite.</p>}
            <h2 className="mt-8 text-[15px] font-medium">If you go ahead, here&apos;s what happens</h2>
            <ol className="mt-3 space-y-3">
              {BRIEF_NEXT_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage text-[12px] text-forest">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[14.5px] text-ink">{s.title}</span>
                    <span className="block text-[13px] leading-snug text-muted">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      {beforeBooking && (
        <button
          type="button"
          onClick={toBooking}
          className="tap-area mx-auto mt-8 inline-flex items-center gap-1.5 text-[13.5px] text-forest underline underline-offset-4"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden /> {BRIEF_COPY.shortcut}
        </button>
      )}
    </div>
  );
}

function QuestionScreen({
  id,
  value,
  onAnswer,
  onSkip,
}: {
  id: string;
  value: string | undefined;
  onAnswer: (id: string, v: string) => void;
  onSkip: () => void;
}) {
  const q = questionById(id);
  if (!q) return null;
  return (
    <section>
      {q.eyebrow && <p className="text-[12.5px] uppercase tracking-[0.12em] text-forest">{q.eyebrow}</p>}
      <h1 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">{q.title}</h1>
      {q.help && <p className="mt-2 text-[14px] leading-snug text-muted">{q.help}</p>}
      {(q.id === "pref_panels" || q.id === "pref_battery") && <p className="mt-2 text-[12.5px] text-muted">{BRIEF_COPY.productsNote}</p>}
      <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={q.title}>
        {q.choices.map((c) => {
          const on = value === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onAnswer(q.id, c.value)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition",
                on ? "bg-primary text-primary-ink" : "bg-surface text-ink shadow-[var(--shadow-soft)] hover:shadow-md",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[15.5px]">{c.label}</span>
                {c.hint && <span className={cn("block text-[12.5px]", on ? "opacity-80" : "text-muted")}>{c.hint}</span>}
                {c.facts && <span className={cn("mt-1 block text-[12.5px]", on ? "opacity-80" : "text-muted")}>{c.facts.join(" · ")}</span>}
              </span>
              {on && <Check className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden />}
            </button>
          );
        })}
      </div>
      {q.id === "budget" && (
        <button type="button" onClick={onSkip} className="tap-area mt-4 text-[13.5px] text-muted underline underline-offset-4">
          Skip
        </button>
      )}
    </section>
  );
}

function DateScreen({
  leadDays,
  solarVic,
  value,
  onPick,
  onNext,
}: {
  leadDays: number;
  solarVic: boolean;
  value: string | null;
  onPick: (d: string) => void;
  onNext: () => void;
}) {
  const days = useMemo(() => getAvailability("brief", leadDays).map((a) => a.date), [leadDays]);
  const line = value ? `Held for ${formatDate(value, { weekday: "long", day: "numeric", month: "long" })}.` : earliestInstallLine(days[0]);
  return (
    <section>
      <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.dateTitle}</h1>
      {line && <p className="mt-3 rounded-2xl bg-sun px-4 py-3 text-[14px] text-sun-ink">{line}</p>}
      <div className="mt-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <MonthCalendar available={days} value={value} onChange={onPick} />
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-muted">
        {BRIEF_COPY.dateNote} {value ? installDateNote(solarVic) : ""}
      </p>
      <Button size="lg" className="mt-6 w-full" disabled={!value} onClick={onNext}>
        Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
      </Button>
    </section>
  );
}

function PriceScreen({
  system,
  tier,
  indicative,
  productsChosen,
  hasBill,
  onTier,
  onNext,
}: {
  system: ReturnType<typeof useSystem>;
  tier: string;
  indicative: boolean;
  productsChosen: boolean;
  hasBill: boolean;
  onTier: (t: "essential" | "recommended") => void;
  onNext: () => void;
}) {
  if (!hasBill) return <p className="text-muted">Add your bill first.</p>;
  const { options } = system;
  const cards = [options.recommended, options.essential].filter(
    (o, i, all) => i === 0 || o.config.batteryKwh !== all[0].config.batteryKwh || o.config.panelCount !== all[0].config.panelCount,
  );
  return (
    <section>
      <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em]">{BRIEF_COPY.priceTitle}</h1>
      {indicative && (
        <p className="mt-2 text-[13px] text-ink-2">
          <span className="mr-1.5 rounded-full bg-surface-2 px-2 py-px text-[11px] text-muted">{SPEND_COPY.indicative}</span>
          {SPEND_COPY.priceNote}
        </p>
      )}
      <div className="mt-5 space-y-3" role="radiogroup" aria-label="Your system">
        {cards.map((o) => {
          const on = tier === o.tier || (tier === "independence" && o.tier === "recommended");
          return (
            <button
              key={o.tier}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onTier(o.tier as "essential" | "recommended")}
              className={cn(
                "w-full rounded-[var(--radius-card)] p-5 text-left transition",
                on ? "bg-surface shadow-[0_0_0_2px_var(--forest)]" : "bg-surface shadow-[var(--shadow-soft)]",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-ink">{o.config.batteryKwh > 0 ? "Solar and battery" : "Solar only"}</span>
                <span className="text-[22px] tabular-nums text-ink">{formatCurrency(o.price.total)}</span>
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{describeSystem(o.config)}</span>
              {o.price.rebateLines.length > 0 && (
                <span className="mt-2 block text-[12.5px] text-positive">
                  After {formatCurrency(o.price.rebates)} in rebates: {o.price.rebateLines.map((r) => r.label).join(", ")}
                </span>
              )}
              <span className="mt-1 block text-[12.5px] text-ink-2">
                Saves about {formatCurrency(roundDownSavings(o.outcome.annualSavings))} a year
                {o.outcome.paybackYears ? `, paying for itself in about ${Math.round(o.outcome.paybackYears)} years` : ""}.
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] leading-snug text-muted">
        {PRICE_INCLUDES} {BRIEF_COPY.priceNote}
        {productsChosen ? ` ${BRIEF_COPY.productsNote}` : ""}
      </p>
      <Button size="lg" className="mt-6 w-full" onClick={onNext}>
        Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
      </Button>
    </section>
  );
}
