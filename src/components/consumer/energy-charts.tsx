import type { DayTotal, HourPoint } from "@/lib/mock/home-energy";

/** Soft area chart: solar generation vs home usage across the day. */
export function DayCurve({ points, height = 180 }: { points: HourPoint[]; height?: number }) {
  const w = 600;
  const max = Math.max(...points.map((p) => Math.max(p.solar, p.usage))) * 1.1;
  const x = (h: number) => (h / 23) * w;
  const y = (v: number) => height - (v / max) * height;
  const path = (key: "solar" | "usage") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.hour).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const solarArea = `${path("solar")} L${w},${height} L0,${height} Z`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${height + 24}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Solar generation and home usage today"
      >
        <defs>
          <linearGradient id="solar-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--leaf)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--leaf)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={solarArea} fill="url(#solar-fill)" />
        <path d={path("solar")} fill="none" stroke="var(--leaf)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path("usage")} fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        {[0, 6, 12, 18, 23].map((h) => (
          <text
            key={h}
            x={x(h)}
            y={height + 18}
            fontSize="12"
            fill="var(--muted)"
            textAnchor={h === 0 ? "start" : h === 23 ? "end" : "middle"}
          >
            {h === 0 ? "12am" : h === 12 ? "12pm" : h === 23 ? "11pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex gap-5 text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-leaf" /> Solar
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-ink" /> Your home
        </span>
      </figcaption>
    </figure>
  );
}

export function WeekBars({ days }: { days: DayTotal[] }) {
  const max = Math.max(...days.map((d) => Math.max(d.solarKwh, d.usageKwh)));
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-4" role="img" aria-label="Solar and usage by day this week">
      {days.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-40 w-full items-end justify-center gap-1">
            <div
              className="w-1/2 max-w-5 rounded-full bg-leaf"
              style={{ height: `${(d.solarKwh / max) * 100}%` }}
              title={`${d.solarKwh} kWh solar`}
            />
            <div
              className="w-1/2 max-w-5 rounded-full bg-line-strong"
              style={{ height: `${(d.usageKwh / max) * 100}%` }}
              title={`${d.usageKwh} kWh used`}
            />
          </div>
          <span className="text-[12px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Small green bar sparkline from the brand sheet ("24.8 kWh generated today"). */
export function Sparkbars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 0.01);
  return (
    <div className={`flex h-12 items-end gap-[3px] ${className ?? ""}`} aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-[4px] rounded-full"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: i >= values.length - 4 ? "var(--leaf)" : "color-mix(in srgb, var(--leaf) 45%, transparent)",
          }}
        />
      ))}
    </div>
  );
}
