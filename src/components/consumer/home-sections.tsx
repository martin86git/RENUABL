import { ArrowRight, Droplets, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { EXAMPLE_PLAN, HEALTH_TEASER, HOW_IT_WORKS, PACKAGES } from "@/lib/domain/healthy-home";
import { WhoopStrip } from "./whoop-promo";

const section = "mx-auto w-full max-w-[1440px] px-5 pt-16 sm:px-8 lg:px-10 lg:pt-24";
const h2 = "text-[30px] font-normal leading-tight tracking-[-0.03em] lg:text-[42px]";

/** "Your home plan — Example": what a finished plan looks like, beside the hero. */
export function ExamplePlanCard() {
  return (
    <div className="w-full max-w-md">
      <Card className="p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-baseline justify-between">
          <p className="text-[18px] tracking-[-0.02em] text-ink">Your home plan</p>
          <span className="text-[12px] text-muted">Example</span>
        </div>
        <div className="mt-4 space-y-4">
          {EXAMPLE_PLAN.map((group, gi) => (
            <div key={group.name} className={gi === 0 ? "rounded-2xl bg-canvas p-4" : "rounded-2xl bg-sage/60 p-4"}>
              <p className="flex items-center gap-2 text-[13px] text-forest">
                {gi === 0 ? (
                  <Sun className="h-4 w-4 text-sun-ink" strokeWidth={1.8} aria-hidden />
                ) : (
                  <Droplets className="h-4 w-4" strokeWidth={1.6} aria-hidden />
                )}
                {group.name}
              </p>
              <ul className="mt-2 divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 py-2 text-[14px]">
                    <span className="text-ink-2">{item.label}</span>
                    <span className="text-ink">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <WhoopStrip className="mt-3" />
    </div>
  );
}

export function PackagesSection() {
  return (
    <section className={section}>
      <h2 className={h2}>{PACKAGES.heading}</h2>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{PACKAGES.intro}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {PACKAGES.cards.map((card, ci) => (
          <Card key={card.name} className="overflow-hidden">
            {/* Photo slot: a neutral placeholder until each package's photo arrives. */}
            {card.image ? (
              <div className="relative aspect-[1200/628] bg-surface-2">
                <Image src={card.image.src} alt={card.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              </div>
            ) : (
              <div className={ci === 0 ? "aspect-[1200/628] bg-surface-2" : "aspect-[1200/628] bg-sage/70"} aria-hidden />
            )}
            <div className="p-6">
              <p className="text-[20px] tracking-[-0.02em] text-ink">{card.name}</p>
              <p className="mt-1 text-[15px] text-muted">{card.line}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {card.chips.map((chip) => (
                  <li
                    key={chip}
                    className={
                      ci === 0
                        ? "rounded-full bg-primary px-3 py-1.5 text-[13px] text-primary-ink"
                        : "rounded-full bg-sage px-3 py-1.5 text-[13px] text-forest"
                    }
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className={section}>
      <h2 className={h2}>How it works</h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title}>
            <Card className="h-full p-6">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sage text-[14px] text-forest">{i + 1}</span>
              <p className="mt-4 text-[17px] text-ink">{step.title}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{step.detail}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HealthTeaser() {
  return (
    <section className={section}>
      <div className="grid gap-8 rounded-[var(--radius-card)] bg-sage p-6 text-forest sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className={h2}>{HEALTH_TEASER.heading}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-forest/80">{HEALTH_TEASER.copy}</p>
          <ButtonLink href="/home-health" size="lg" className="mt-6">
            {HEALTH_TEASER.button} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </ButtonLink>
        </div>
        <ul className="flex flex-wrap gap-2.5">
          {HEALTH_TEASER.chips.map((q) => (
            <li key={q}>
              <Link href="/home-health" className="block rounded-full bg-surface/70 px-4 py-2.5 text-[14px] text-forest hover:bg-surface">
                {q}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
