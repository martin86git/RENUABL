"use client";

import { CalendarCheck, Loader2, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, ButtonLink, cn } from "@/components/ui/primitives";
import { HUBSPOT_MEETINGS_URL } from "@/lib/config";
import { CONSULT_CALL, formatCallTime, hubspotEmbedSrc } from "@/lib/domain/booking";
import { formatDate } from "@/lib/domain/format";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { bookConsultCall, getCallAvailability } from "@/lib/services/consumer";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "./consent-boxes";
import { useFlow } from "./flow-state";

const field =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-ink";

type Details = { firstName: string; lastName: string; mobile: string; email: string };

/** /book-a-call: pick a time (Monday to Saturday), leave name, mobile and email, and the team calls. HubSpot Meetings when configured. */
export function BookACall() {
  const { state } = useFlow();
  const availability = useMemo(() => getCallAvailability(null), []);
  const [date, setDate] = useState<string | null>(availability[0]?.date ?? null);
  const [time, setTime] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({ firstName: "", lastName: "", mobile: "", email: "" });
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ call: string; emailed: boolean } | null>(null);
  const day = availability.find((d) => d.date === date);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setProblem("Choose a day and time for your call.");
      return;
    }
    if (!consent.terms) {
      setConsentMissing(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    setErrors({});
    const r = await bookConsultCall({
      ...details,
      date,
      time,
      source: [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      consent,
    });
    setBusy(false);
    if (r.ok && r.call) setBooked({ call: r.call, emailed: Boolean(r.emailed) });
    else {
      setErrors(r.errors ?? {});
      setProblem(r.message ?? (r.errors ? "Please check your details." : "That didn't send. Please try again."));
    }
  }

  const header = (
    <>
      <h1 className="text-[34px] font-normal leading-[1.05] tracking-[-0.03em] lg:text-[44px]">{CONSULT_CALL.title}</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{CONSULT_CALL.intro}</p>
      <p className="mt-2 max-w-xl text-[13px] text-muted">{CONSULT_CALL.note}</p>
    </>
  );

  if (HUBSPOT_MEETINGS_URL) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:py-12">
        {header}
        <iframe
          src={hubspotEmbedSrc(HUBSPOT_MEETINGS_URL)}
          title="Book a 15-minute call"
          className="mt-6 h-[760px] w-full rounded-2xl bg-white"
        />
      </div>
    );
  }

  if (booked) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-12 lg:py-16" role="status">
        <CalendarCheck className="h-9 w-9 text-positive" strokeWidth={1.6} aria-hidden />
        <h1 className="mt-4 text-[34px] font-normal leading-[1.05] tracking-[-0.03em]">Your call is booked.</h1>
        <p className="mt-3 text-[15px] text-ink-2">We&apos;ll call you on {booked.call}.</p>
        <p className="mt-2 text-[13.5px] text-muted">
          {booked.emailed
            ? "We've emailed you the details with a calendar invite."
            : "Need a different time? Reply to any of our emails, or contact us."}
        </p>
        <ButtonLink href="/" variant="secondary" className="mt-6">
          See your home plan
        </ButtonLink>
      </div>
    );
  }

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) => setDetails({ ...details, [k]: e.target.value });
  const err = (k: keyof Details) =>
    errors[k] ? (
      <span className="mt-1 block text-[12px] text-danger" role="alert">
        {errors[k]}
      </span>
    ) : null;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mx-auto w-full max-w-4xl px-5 py-8 pb-16 lg:py-12">
      {header}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <section className="rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-soft)]" aria-label="Choose a time">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
            <MonthCalendar
              available={availability.map((d) => d.date)}
              value={date}
              onChange={(d) => {
                setDate(d);
                setTime(null);
              }}
            />
            <div>
              <p className="text-[14px] text-ink">
                {day ? formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Pick a day"}
              </p>
              <p className="text-[12px] text-muted">Times in {LAUNCH_MARKET.capital} time</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Call time">
                {day?.times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={time === t}
                    onClick={() => setTime(t)}
                    className={cn(
                      "h-10 rounded-full text-[13.5px] tabular-nums transition",
                      time === t
                        ? "bg-primary text-primary-ink"
                        : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong)]",
                    )}
                  >
                    {formatCallTime(t)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="space-y-3 rounded-[var(--radius-card)] bg-sage p-5" aria-label="Your details">
          <p className="flex items-center gap-2 text-[15px] text-forest">
            <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden /> Who should we call?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">First name</span>
              <input
                autoComplete="given-name"
                placeholder="First name"
                value={details.firstName}
                onChange={set("firstName")}
                className={field}
              />
              {err("firstName")}
            </label>
            <label>
              <span className="sr-only">Last name</span>
              <input
                autoComplete="family-name"
                placeholder="Last name"
                value={details.lastName}
                onChange={set("lastName")}
                className={field}
              />
              {err("lastName")}
            </label>
          </div>
          <label className="block">
            <span className="sr-only">Mobile</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Mobile"
              value={details.mobile}
              onChange={set("mobile")}
              className={field}
            />
            {err("mobile")}
          </label>
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email (for your calendar invite)"
              value={details.email}
              onChange={set("email")}
              className={field}
            />
            {err("email")}
          </label>
          <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} />
          {problem && (
            <p className="text-[13px] text-danger" role="alert">
              {problem}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : date && time ? (
              `Book ${formatDate(date, { weekday: "short", day: "numeric", month: "short" })} at ${formatCallTime(time)}`
            ) : (
              "Book my call"
            )}
          </Button>
        </section>
      </div>
    </form>
  );
}
