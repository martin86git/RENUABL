import { ArrowRight, BatteryMedium, Leaf, Sun } from "lucide-react";
import Link from "next/link";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { DayCurve } from "@/components/consumer/energy-charts";
import { EnergyOrb } from "@/components/ui/energy-orb";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { getHousehold, getInsights, getToday, getUpgrades } from "@/lib/services/home";

export const metadata = { title: "Today" };

export default function TodayPage() {
  const household = getHousehold();
  const today = getToday();
  const insight = getInsights()[0];
  const upgrade = getUpgrades()[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Eyebrow>Good afternoon, {household.owner}</Eyebrow>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight sm:text-[40px]">{today.headline}</h1>
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted lg:text-[17px]">{today.narrative}</p>
        </div>
        <div className="hidden justify-center lg:col-span-5 lg:flex">
          <EnergyOrb size={220} mood="happy" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Today at a glance">
        {[
          { icon: Sun, label: "Solar today", value: `${today.solarKwh} kWh` },
          { icon: Leaf, label: "From the sun", value: formatPercent(today.selfPoweredShare) },
          { icon: BatteryMedium, label: "Battery", value: `${today.batteryPercent}%` },
          { icon: ArrowRight, label: "Saved today", value: formatCurrency(today.savedToday) },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-5">
            <Icon className="h-5 w-5 text-muted" aria-hidden />
            <p className="mt-4 text-[26px] font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="text-[13px] text-muted">{label}</p>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="p-5 sm:p-6 lg:col-span-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">Your day</h2>
            <Link href="/my/energy" className="text-[14px] text-muted hover:text-ink">
              See energy
            </Link>
          </div>
          <DayCurve points={today.curve} />
        </Card>
        <div className="space-y-4 lg:col-span-4">
          <Card className="p-5 sm:p-6">
            <Eyebrow>Insight</Eyebrow>
            <p className="mt-2 text-[17px] font-semibold">{insight.title}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">{insight.body}</p>
            <Link href="/my/insights" className="mt-3 inline-block text-[14px] font-medium text-ink">
              More insights →
            </Link>
          </Card>
          <Card className="p-5 sm:p-6">
            <Eyebrow>Made for your home</Eyebrow>
            <p className="mt-2 text-[17px] font-semibold">{upgrade.title}</p>
            <p className="mt-1 text-[15px] text-muted">{upgrade.body}</p>
            <Link href="/my/upgrade" className="mt-3 inline-block text-[14px] font-medium text-ink">
              Explore upgrades →
            </Link>
          </Card>
        </div>
      </section>

      <AskRenuabl context="my" prompt="Ask RENUABL about your energy" />
    </div>
  );
}
