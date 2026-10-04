"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { ChoiceChips, Segmented } from "@/components/ui/controls";
import type { BillSummary } from "@/lib/domain/bill";
import {
  BILLING_PERIODS,
  SPEND_BANDS,
  SPEND_COPY,
  billFromSpend,
  spendBandLabel,
  type BillingPeriod,
  type SpendBandId,
} from "@/lib/domain/spend-estimate";

/** "Or tell us roughly what you spend": a billing period and a spend range give an indicative plan. */
export function SpendEstimate({ bill, onPick }: { bill: BillSummary | null; onPick: (bill: BillSummary) => void }) {
  const chosen = bill?.estimate ?? null;
  const [period, setPeriod] = useState<BillingPeriod>(chosen?.period ?? "quarterly");

  return (
    <section className="rounded-[var(--radius-card)] bg-surface px-5 py-5 shadow-[var(--shadow-soft)]" aria-label={SPEND_COPY.heading}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] text-ink">{SPEND_COPY.heading}</p>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] text-muted">{SPEND_COPY.indicative}</span>
      </div>
      <p className="mt-0.5 text-[13px] leading-snug text-muted">{SPEND_COPY.subheading}</p>
      <p className="mt-4 text-[13px] text-ink-2">{SPEND_COPY.periodLabel}</p>
      <Segmented<BillingPeriod>
        className="mt-2"
        label={SPEND_COPY.periodLabel}
        value={period}
        onChange={(p) => {
          setPeriod(p);
          // Keep the same band when they switch period, so the figure follows.
          if (chosen) onPick(billFromSpend(p, chosen.band));
        }}
        options={BILLING_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
      />
      <p className="mt-4 text-[13px] text-ink-2">{SPEND_COPY.bandLabel}</p>
      <div className="mt-2">
        <ChoiceChips<SpendBandId>
          label={SPEND_COPY.bandLabel}
          value={chosen && chosen.period === period ? chosen.band : undefined}
          onChange={(band) => onPick(billFromSpend(period, band))}
          options={SPEND_BANDS.map((b) => ({ value: b.id, label: spendBandLabel(b.id, period) }))}
        />
      </div>
      {bill?.estimate && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-sage/60 px-3.5 py-3 text-forest" aria-live="polite">
          <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
          <div className="text-[13px] leading-snug">
            <p>
              {SPEND_COPY.chosen}: about <span className="font-medium">{bill.dailyUsageKwh} kWh a day</span>.
            </p>
            <p className="mt-1 text-forest/80">{SPEND_COPY.upgrade}</p>
          </div>
        </div>
      )}
    </section>
  );
}
