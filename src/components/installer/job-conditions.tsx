import { CloudRain, House, Sun, Wind } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { facing, roofFit } from "@/lib/domain/solar-roof";
import type { Outlook } from "@/lib/domain/weather";
import type { JobConditions } from "@/lib/services/installer";

const OUTLOOK = {
  good: { tone: "positive", label: "Good for roof work" },
  watch: { tone: "warning", label: "Keep an eye on it" },
  risky: { tone: "danger", label: "Weather risk" },
} as const satisfies Record<Outlook, { tone: string; label: string }>;

/** The roof from Google's satellite data, and the install day's forecast. */
export function JobConditionsPanel({ conditions, panelCount }: { conditions: JobConditions; panelCount: number }) {
  const { roof, forecast, outlook, daysAway } = conditions;
  const fit = roof ? roofFit(roof, panelCount) : null;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-[15px] font-medium">
          <Sun className="h-4 w-4 text-muted" /> Install-day weather
        </h3>
        {forecast && outlook ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={OUTLOOK[outlook.outlook].tone}>{OUTLOOK[outlook.outlook].label}</Badge>
              <span className="text-[14px] text-ink-2">
                {forecast.summary}
                {forecast.maxC !== null ? ` · ${Math.round(forecast.minC ?? forecast.maxC)}–${Math.round(forecast.maxC)}°` : ""}
              </span>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="flex items-center gap-1">
                <CloudRain className="h-3.5 w-3.5" /> {forecast.rainChance ?? 0}% rain{forecast.rainMm ? ` · ${forecast.rainMm} mm` : ""}
              </span>
              {forecast.gustKmh !== null && (
                <span className="flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5" /> gusts {Math.round(forecast.gustKmh)} km/h
                </span>
              )}
            </p>
            {outlook.outlook !== "good" && (
              <p className="mt-1.5 text-[13px] text-ink-2">
                {outlook.reasons.join(", ")}.{" "}
                {outlook.outlook === "risky" ? "If it isn't safe, call the customer early to move the day." : ""}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted">
            {daysAway < 0 ? "Install day has passed." : `The forecast appears 10 days out (install is in ${daysAway} days).`}
          </p>
        )}
      </div>

      {roof && (
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-medium">
            <House className="h-4 w-4 text-muted" /> Roof (Google satellite data)
          </h3>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Room for about {roof.panelsThatFit} panels on {roof.usableAreaM2} m² · this system uses {panelCount}
            {fit === "comfortable"
              ? " (fits comfortably)"
              : fit === "snug"
                ? " (snug: check the layout)"
                : " (may not fit: check before install)"}
          </p>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {roof.faces.slice(0, 4).map((f, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span>{facing(f.azimuth)}</span>
                <span className="text-muted tabular-nums">
                  {f.pitch}° pitch · {f.areaM2} m²{f.sunshineHours ? ` · ${f.sunshineHours.toLocaleString("en-AU")} sun hrs/yr` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-muted">
            Estimated from {roof.imageryDate ? `imagery dated ${roof.imageryDate}` : "aerial imagery"}. Confirm on site.
          </p>
        </div>
      )}
    </div>
  );
}
