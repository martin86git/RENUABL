import { ArrowRight, CircleCheck, Clock, MapPin, Sun } from "lucide-react";
import Image from "next/image";
import { Button, Card } from "@/components/ui/primitives";
import { OFFER_HOURS } from "@/lib/domain/offers";
import { PITCH, PITCH_FAQ, PITCH_HANDLED, PITCH_MONEY, PITCH_STEPS, PITCH_TOOLS } from "@/lib/domain/partner-pitch";

/**
 * The /partners pitch, shown before the sign-up form: what RENUABL does for an
 * installer, in the portal's dark theme. The job offer on the right is an
 * example, labelled as one.
 */
export function PartnerPitch({ onStart }: { onStart: () => void }) {
  const cta = (label = "Join in about 10 minutes") => (
    <Button size="lg" className="w-full sm:w-auto sm:px-10" onClick={onStart}>
      {label} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
    </Button>
  );
  const section = "mx-auto w-full max-w-5xl px-5 sm:px-8";
  const h2 = "text-[28px] font-normal leading-tight tracking-[-0.03em] lg:text-[36px]";

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className={`${section} grid gap-10 pt-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-14`}>
        <div>
          <p className="text-[13px] tracking-wide text-leaf">{PITCH.eyebrow}</p>
          <h1 className="mt-3 text-[38px] font-normal leading-[1.04] tracking-[-0.04em] lg:text-[54px]">{PITCH.headline}</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-muted lg:text-[17px]">{PITCH.intro}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {PITCH.promise.map((p) => (
              <li key={p} className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13.5px] text-ink">
                <CircleCheck className="h-4 w-4 text-positive" strokeWidth={1.8} aria-hidden /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {cta()}
            <a href="#how" className="tap-area text-[14px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              How it works
            </a>
          </div>
        </div>
        <ExampleOffer />
      </section>

      {/* How it works */}
      <section id="how" className={`${section} scroll-mt-6 pt-20`}>
        <h2 className={h2}>How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {PITCH_STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-positive/15 text-[15px] text-positive">{i + 1}</span>
                <p className="mt-4 text-[17px] text-ink">{s.title}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.detail}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* What we handle */}
      <section className={`${section} pt-20`}>
        <h2 className={h2}>What we handle for you</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          You do what you&apos;re good at: installing. We take care of the rest.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PITCH_HANDLED.map((h) => (
            <li key={h.title} className="rounded-[var(--radius-card)] border border-line p-5">
              <CircleCheck className="h-5 w-5 text-positive" strokeWidth={1.8} aria-hidden />
              <p className="mt-3 text-[15.5px] text-ink">{h.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{h.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Tools */}
      <section className={`${section} grid gap-10 pt-20 lg:grid-cols-2 lg:items-center`}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-surface">
          <Image
            src="/brand/install-crew.webp"
            alt="A solar installation crew on a roof"
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className={h2}>Everything on your phone</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">One place for every job, from the offer to the handover.</p>
          <ul className="mt-6 space-y-2.5">
            {PITCH_TOOLS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[15px] text-ink-2">
                <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-positive" strokeWidth={1.8} aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Money */}
      <section className={`${section} pt-20`}>
        <h2 className={h2}>The money</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {PITCH_MONEY.map((m) => (
            <li key={m.title}>
              <Card className="h-full p-6">
                <p className="text-[20px] tracking-[-0.02em] text-ink">{m.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{m.detail}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className={`${section} pt-20`}>
        <h2 className={h2}>Questions installers ask</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {PITCH_FAQ.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[16px] text-ink">
                {f.q}
                <span className="text-[22px] leading-none text-muted transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-5 pr-8 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call to action */}
      <section className={`${section} pt-20`}>
        <Card className="flex flex-col items-start gap-5 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[26px] font-normal tracking-[-0.03em] lg:text-[32px]">Ready when you are.</h2>
            <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted">
              About 10 minutes on your phone. Have your ABN, accreditation number, electrical licence and certificate of currency handy.
            </p>
          </div>
          {cta("Become a partner")}
        </Card>
      </section>
    </div>
  );
}

/** A job offer as it appears in the portal (an example, not a real job). */
function ExampleOffer() {
  return (
    <div className="mx-auto w-full max-w-sm" aria-label="Example job offer">
      <Card className="p-5 shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-positive/15 px-2.5 py-1 text-[12px] text-positive">New job offer</span>
          <span className="text-[11.5px] text-muted">Example</span>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[20px] tracking-[-0.02em] text-ink">
          <MapPin className="h-[18px] w-[18px] text-muted" strokeWidth={1.6} aria-hidden /> Kew VIC
        </p>
        <p className="mt-1 flex items-center gap-2 text-[14.5px] text-ink-2">
          <Sun className="h-4 w-4 text-muted" strokeWidth={1.6} aria-hidden /> 6.6 kW solar + 16 kWh battery
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div className="rounded-xl bg-canvas px-3 py-2.5">
            <p className="text-muted">Install day</p>
            <p className="text-ink">Tuesday, 7–9am</p>
          </div>
          <div className="rounded-xl bg-canvas px-3 py-2.5">
            <p className="text-muted">Paid at</p>
            <p className="text-ink">Your rates</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden /> {OFFER_HOURS} hours to accept or pass
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2" aria-hidden>
          <span className="grid h-11 place-items-center rounded-full border border-line-strong text-[14px] text-ink-2">Pass</span>
          <span className="grid h-11 place-items-center rounded-full bg-primary text-[14px] text-primary-ink">Accept</span>
        </div>
      </Card>
    </div>
  );
}
