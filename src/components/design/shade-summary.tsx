"use client";

import { clsx } from "clsx";
import { shadePercent, shadeWords, type RoofShade } from "@/lib/domain/design/design-shade";
import { accessColour } from "@/lib/domain/design/shade";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * The shade on the customer's panels (19 Nov 2026, Martin: the designer's shade analysis "also into the proposal"):
 * the share of the year's direct sun that reaches them, the months as bars coloured from open to shaded, a line about
 * the panels and where the figures come from. On the proposal page in the page's colours, over the configurator's
 * picture on dark. Always an estimate (`shadeWords`).
 */
export function ShadeSummary({ shade, dark = false, className }: { shade: RoofShade; dark?: boolean; className?: string }) {
  const words = shadeWords(shade);
  return (
    <section aria-label="Shade on your panels" className={clsx(dark ? "text-white" : "text-ink", className)}>
      <p className={clsx("text-[11px] font-medium uppercase tracking-[0.18em]", dark ? "text-white/60" : "text-muted")}>
        Sun on your panels · estimate
      </p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[30px] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums]">
          {shadePercent(shade.access)}
        </span>
        <span className={clsx("text-[13px] leading-snug", dark ? "text-white/80" : "text-ink")}>
          of the year&apos;s direct sun reaches your panels
        </span>
      </p>
      <p className={clsx("mt-1.5 text-[12.5px]", dark ? "text-white/70" : "text-muted")}>{words.panels}</p>
      <div className="mt-3 grid grid-cols-12 items-end gap-1" aria-hidden>
        {shade.byMonth.map((m, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={clsx("flex h-10 w-full items-end overflow-hidden rounded-[3px]", dark ? "bg-white/10" : "bg-line")}>
              <div
                className="w-full rounded-[3px]"
                style={{ height: `${Math.max(10, Math.min(100, ((m - 0.5) / 0.5) * 100))}%`, background: accessColour(m) }}
              />
            </div>
            <span className={clsx("text-[10px]", dark ? "text-white/55" : "text-muted")}>{MONTHS[i]}</span>
          </div>
        ))}
      </div>
      <p className={clsx("mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]", dark ? "text-white/70" : "text-muted")}>
        <Key colour={accessColour(1)} label="Open" />
        <Key colour={accessColour(0.8)} label="Some shade" />
        <Key colour={accessColour(0.5)} label="Mostly shaded" />
      </p>
      <p className={clsx("mt-2.5 text-[11px] leading-relaxed", dark ? "text-white/50" : "text-muted")}>{words.note}</p>
    </section>
  );
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-full" style={{ background: colour }} />
      {label}
    </span>
  );
}
