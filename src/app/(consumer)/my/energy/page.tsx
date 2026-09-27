import { DayCurve, WeekBars } from "@/components/consumer/energy-charts";
import { Card, Eyebrow, StatRow } from "@/components/ui/primitives";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { getMonthSummary, getToday, getWeek } from "@/lib/services/home";

export const metadata = { title: "Energy" };

export default function EnergyPage() {
  const week = getWeek();
  const month = getMonthSummary();
  const today = getToday();
  const weekSolar = week.reduce((s, d) => s + d.solarKwh, 0);
  const weekUse = week.reduce((s, d) => s + d.usageKwh, 0);
  const weekGrid = week.reduce((s, d) => s + d.gridKwh, 0);

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>This week</Eyebrow>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">
          You made {Math.round(weekSolar)} kWh and used {Math.round(weekUse)}.
        </h1>
        <p className="mt-2 text-[16px] text-muted">Only {Math.round(weekGrid)} kWh came from the grid — mostly on cloudy Wednesday.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="p-5 sm:p-6 lg:col-span-8">
          <h2 className="mb-4 text-[17px] font-semibold">Solar vs. usage</h2>
          <WeekBars days={week} />
          <div className="mt-4 flex gap-5 text-[13px] text-muted">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sun" /> Solar
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /> Used
            </span>
          </div>
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-4">
          <h2 className="text-[17px] font-semibold">This month</h2>
          <div className="mt-2 divide-y divide-line">
            <StatRow label="Saved" value={formatCurrency(month.savings)} />
            <StatRow label="Since install" value={formatCurrency(month.savingsSinceInstall)} />
            <StatRow label="Powered by sun" value={formatPercent(month.selfPoweredShare)} />
            <StatRow label="CO₂ avoided" value={`${month.co2AvoidedKg} kg`} />
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-[17px] font-semibold">Today, hour by hour</h2>
        <DayCurve points={today.curve} height={200} />
      </Card>
    </div>
  );
}
