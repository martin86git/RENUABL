"use client";

import { ArrowUpRight } from "lucide-react";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { Card } from "@/components/ui/primitives";
import { todayInMarket } from "@/lib/domain/market";
import { SOURCES_FOOTNOTE, dataSources } from "@/lib/domain/sources";

/** "How we worked this out": the sources behind this home's recommendation and price. */
export function DataSources() {
  const { state } = useFlow();
  const { config, rates } = useSystem();
  const sources = dataSources({
    bill: state.bill,
    address: state.address,
    sunshine: state.sunshine,
    rates,
    newSolar: config.panelCount > 0 && !config.existingSolar,
    today: todayInMarket(),
  });

  return (
    <Card className="p-5">
      <p className="text-[15px] text-ink">How we worked this out</p>
      <p className="text-[12.5px] text-muted">Your recommendation is built from trusted data, not guesswork.</p>
      <ul className="mt-3 divide-y divide-line">
        {sources.map((s) => (
          <li key={s.id} className="py-2.5">
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[14px] text-ink underline-offset-4 hover:underline"
              >
                {s.name}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted" strokeWidth={1.7} aria-hidden />
              </a>
            ) : (
              <p className="text-[14px] text-ink">{s.name}</p>
            )}
            <p className="text-[12.5px] leading-snug text-muted">{s.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-snug text-muted">{SOURCES_FOOTNOTE}</p>
    </Card>
  );
}
