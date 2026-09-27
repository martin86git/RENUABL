"use client";

import { Check, Gift } from "lucide-react";
import { useState } from "react";
import { MascotAvatar } from "@/components/ui/brand-art";
import { Segmented } from "@/components/ui/controls";
import { Button, Card, cn } from "@/components/ui/primitives";
import { CARE_FREE_MONTHS, CARE_PLAN, careIncludedValue, carePriceLabel, careYearlySaving, type CareBilling } from "@/lib/domain/care";

/**
 * RENUABL Care upsell at checkout. Opt-in only — never pre-selected — and
 * clearly not charged today: billing starts after the system is switched on.
 */
export function CareUpsell({ value, onChange }: { value: CareBilling | null; onChange: (v: CareBilling | null) => void }) {
  const [billing, setBilling] = useState<CareBilling>(value ?? "yearly");
  const added = value !== null;

  const choose = (b: CareBilling) => {
    setBilling(b);
    if (added) onChange(b);
  };

  return (
    <Card className={cn("p-5 transition", added && "ring-1 ring-forest/40")}>
      <div className="flex items-start gap-3">
        <MascotAvatar className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] text-ink">{added ? `${CARE_PLAN.name} added` : `Add ${CARE_PLAN.name}`}</p>
            <span className="rounded-full bg-sage px-2 py-0.5 text-[11px] text-forest">{CARE_PLAN.tier}</span>
          </div>
          <p className="text-[12.5px] leading-snug text-muted">
            Peace of mind after install. We keep an eye on your system so you don&apos;t have to.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {CARE_PLAN.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[13px] text-ink-2">
            <Check className="h-4 w-4 shrink-0 text-positive" strokeWidth={2} aria-hidden /> {f}
          </li>
        ))}
      </ul>

      <Segmented<CareBilling>
        className="mt-4"
        label="Care billing"
        value={billing}
        onChange={choose}
        options={[
          { value: "monthly", label: `$${CARE_PLAN.monthly} / month` },
          { value: "yearly", label: `$${CARE_PLAN.yearly} / year · save $${careYearlySaving()}` },
        ]}
      />

      {added ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] text-positive">
            <Check className="h-4 w-4" strokeWidth={2.2} /> {carePriceLabel(billing)} · starts after switch-on
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => onChange(billing)}>
          Add {CARE_PLAN.name} · {carePriceLabel(billing)}
        </Button>
      )}
      <p className="mt-3 text-[11.5px] leading-snug text-muted">
        Not charged today. Billing starts once your system is switched on. Cancel any time.
      </p>
    </Card>
  );
}

/** Highlight shown when the top package is chosen: 12 months of RENUABL Care free. */
export function CareIncludedCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-card)] bg-sage/70 p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-white">
          <Gift className="h-5 w-5" strokeWidth={1.6} aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-medium text-forest">
            {CARE_FREE_MONTHS} months free {CARE_PLAN.name}
          </p>
          <p className="text-[12.5px] text-forest/80">Valued at ${careIncludedValue()} · included with Higher independence</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {CARE_PLAN.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[12.5px] text-forest">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden /> {f}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-forest/75">
        After {CARE_FREE_MONTHS} months you can choose to continue. We&apos;ll never charge you automatically.
      </p>
    </div>
  );
}
