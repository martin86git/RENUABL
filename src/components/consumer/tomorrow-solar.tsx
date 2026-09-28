import { CloudSun, Sun, Cloud } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { solarDayOutlook, type DayForecast } from "@/lib/domain/weather";
import { getTomorrowSolar } from "@/lib/services/my-account";

/** Shown to homes without their own forecast yet (the example home): clearly an example. */
const EXAMPLE_DAY: DayForecast = {
  date: "",
  summary: "Sunny",
  rainChance: 5,
  rainMm: 0,
  thunderChance: 0,
  maxC: 24,
  minC: 12,
  windKmh: 12,
  gustKmh: 20,
  cloudCover: 10,
};

const ICON = { strong: Sun, fair: CloudSun, quiet: Cloud } as const;

/** "Tomorrow looks sunny: expect a strong solar day", from the forecast for the customer's home. */
export async function TomorrowSolar({ example }: { example: { battery: boolean; ev: boolean } }) {
  const real = await getTomorrowSolar().catch(() => null);
  const o = real ?? { ...solarDayOutlook(EXAMPLE_DAY, example), maxC: EXAMPLE_DAY.maxC };
  const Icon = ICON[o.day];
  return (
    <Card className="flex gap-4 p-5">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
      <div>
        <p className="text-[13px] text-muted">
          Tomorrow{o.maxC !== null ? ` · ${Math.round(o.maxC)}°` : ""}
          {real ? "" : " · example"}
        </p>
        <p className="mt-0.5 text-[15px] text-ink">{o.headline}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{o.tip}</p>
      </div>
    </Card>
  );
}
