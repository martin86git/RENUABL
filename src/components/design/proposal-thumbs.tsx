"use client";

import clsx from "clsx";
import { lookOf, themeVars, type BrandKit, type ChartStyle, type TemplateId } from "@/lib/domain/design/brand";

type Theme = Pick<BrandKit, "palette" | "primary" | "accent">;

/** A grey line standing for a line of text. */
const Bar = ({ w, className }: { w: string; className?: string }) => (
  <span className={clsx("block h-[3px] rounded-full bg-[color:var(--muted)] opacity-40", className)} style={{ width: w }} />
);

/**
 * A small picture of a proposal design in the business's own colours: how it
 * opens and how its parts sit (boxed or between lines, headings above or down
 * the left). Drawn from the same look the page uses (`lookOf`), so the
 * picture can't promise a layout the page doesn't have.
 */
export function TemplateThumb({ template, theme }: { template: TemplateId; theme: Theme }) {
  const look = lookOf(template);
  const part = (key: number) => (
    <div
      key={key}
      className={clsx(
        "flex gap-1.5",
        look.headings === "side" ? "flex-row" : "flex-col",
        look.parts === "boxed" ? "rounded-[3px] border border-line bg-surface p-1.5" : "border-t border-line pt-1.5",
      )}
    >
      <span className="flex shrink-0 items-center gap-1" style={{ width: look.headings === "side" ? "30%" : undefined }}>
        {look.numbered && <span className="text-[6px] leading-none text-muted">0{key}</span>}
        <span className="block h-[4px] w-8 rounded-full bg-ink opacity-70" />
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <Bar w="90%" />
        <Bar w="70%" />
      </span>
    </div>
  );
  const title = (onColour?: boolean) => (
    <span className="flex flex-col gap-1">
      <span className={clsx("block h-[6px] w-3/4 rounded-full", onColour ? "bg-[color:var(--primary-ink)]" : "bg-ink")} />
      <span className={clsx("block h-[3px] w-1/2 rounded-full opacity-50", onColour ? "bg-[color:var(--primary-ink)]" : "bg-ink")} />
    </span>
  );
  return (
    <div
      style={themeVars(theme) as React.CSSProperties}
      className="aspect-[3/4] w-full overflow-hidden rounded-md bg-canvas p-2"
      aria-hidden
    >
      <div className="flex h-full flex-col gap-1.5">
        {look.cover === "photo" && (
          <>
            <span className="block h-7 rounded-[3px] bg-[color:var(--muted)] opacity-30" />
            {title()}
          </>
        )}
        {look.cover === "figures" && (
          <>
            {title()}
            <span className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-4 rounded-[3px] border border-line bg-surface" />
              ))}
            </span>
          </>
        )}
        {look.cover === "colour" && <span className="flex h-12 items-center rounded-[3px] bg-primary px-1.5">{title(true)}</span>}
        {look.cover === "plain" && (
          <span className="flex flex-col gap-1 border-b border-line pb-2 pt-2">
            <span className="block h-[8px] w-11/12 rounded-full bg-ink opacity-80" />
            <span className="block h-[8px] w-2/3 rounded-full bg-ink opacity-80" />
          </span>
        )}
        {look.cover === "split" && (
          <span className="grid grid-cols-2 items-center gap-1.5">
            <span className="block h-11 rounded-[3px] bg-primary opacity-80" />
            {title()}
          </span>
        )}
        <span className="mt-0.5 flex flex-col gap-1.5">{[1, 2, 3].map(part)}</span>
      </div>
    </div>
  );
}

/** A small picture of a chart style: twelve months drawn that way, in the business's main colour. */
export function ChartThumb({ style, theme }: { style: ChartStyle; theme: Theme }) {
  const months = [0.45, 0.55, 0.7, 0.8, 0.92, 1, 0.97, 0.88, 0.75, 0.6, 0.5, 0.42];
  const pts = months.map((m, i) => `${(i + 0.5) * 10},${44 - m * 36}`);
  return (
    <div style={themeVars(theme) as React.CSSProperties} className="h-16 w-full overflow-hidden rounded-md bg-surface p-1.5" aria-hidden>
      {style === "table" ? (
        <span className="grid h-full grid-cols-4 gap-x-1.5 gap-y-1">
          {months.map((_, i) => (
            <span key={i} className="flex flex-col justify-center gap-0.5 border-b border-line">
              <span className="block h-[2px] w-3 rounded-full bg-[color:var(--muted)] opacity-50" />
              <span className="block h-[3px] w-5 rounded-full bg-ink opacity-70" />
            </span>
          ))}
        </span>
      ) : (
        <svg viewBox="0 0 120 48" className="h-full w-full" preserveAspectRatio="none">
          {style === "bars" &&
            months.map((m, i) => <rect key={i} x={i * 10 + 2} y={46 - m * 38} width={6} height={m * 38} rx={1} fill="var(--primary)" />)}
          {style === "area" && <path d={`M${pts.join(" L")} L115,48 L5,48 Z`} fill="var(--primary)" opacity={0.2} />}
          {style !== "bars" && (
            <polyline points={pts.join(" ")} fill="none" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      )}
    </div>
  );
}
