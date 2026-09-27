import { ArrowRight, ChevronRight, CircleCheck, Headphones, Triangle, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { DayCurve, Sparkbars } from "@/components/consumer/energy-charts";
import { HomePhoto, Mascot } from "@/components/ui/brand-art";
import { Card } from "@/components/ui/primitives";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { greeting } from "@/lib/domain/market";
import { getHousehold, getInsights, getSystemHealth, getToday } from "@/lib/services/home";

export const metadata = { title: "Home" };

function Row({ href, icon: Icon, title, detail }: { href: string; icon: LucideIcon; title: string; detail: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/60">
        <Icon className="h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] text-ink">{title}</span>
          <span className="block truncate text-[12.5px] text-muted">{detail}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.5} />
      </Link>
    </li>
  );
}

export default async function MyHomePage() {
  await connection(); // greeting and "today" are per request
  const household = getHousehold();
  const today = getToday();
  const health = getSystemHealth();
  const insight = getInsights()[0];
  const allGood = health.every((h) => h.status === "good");
  const daylight = today.curve.filter((p) => p.hour >= 6 && p.hour <= 19).map((p) => p.solar);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <section className="lg:col-span-7">
        <h1 className="text-[34px] font-normal leading-[1.05] tracking-[-0.035em] lg:text-[44px]">
          {greeting()},<br className="lg:hidden" /> {household.owner}.
        </h1>
        <p className="mt-1 text-[16px] text-muted lg:text-[17px]">
          {allGood ? "Your system is performing well." : "Your system is running — one thing needs a look."}
        </p>

        <Link href="/my/energy" className="mt-6 block">
          <Card className="flex items-end justify-between gap-4 p-5 transition hover:shadow-[var(--shadow-lift)]">
            <div>
              <p className="text-[13px] text-muted">Today</p>
              <p className="mt-1 text-[30px] font-normal tracking-tight tabular-nums">{today.solarKwh} kWh</p>
              <p className="text-[13px] text-muted">generated</p>
            </div>
            <Sparkbars values={daylight} className="flex-1 justify-end" />
            <ArrowRight className="mb-1 h-5 w-5 shrink-0 self-start text-ink" strokeWidth={1.5} />
          </Card>
        </Link>

        <Card className="mt-4 overflow-hidden">
          <ul className="divide-y divide-line">
            <Row href="/my/savings" icon={Zap} title="Energy insights" detail="See your usage, savings and impact" />
            <Row
              href="/my/health"
              icon={CircleCheck}
              title="System health"
              detail={allGood ? "All systems online" : health.find((h) => h.status !== "good")!.detail}
            />
            <Row href="/my/support" icon={Headphones} title="Support" detail="Get help or book a service" />
            <Row href="/my/upgrades" icon={Triangle} title="Upgrade" detail="Explore new products" />
          </ul>
        </Card>

        <div className="mt-4">
          <AskRenuabl context="my" title="Ask RENUABL" subtitle="How can I improve my savings?" />
        </div>
      </section>

      <aside className="hidden space-y-5 lg:col-span-5 lg:block">
        <Card className="p-6">
          <p className="text-[13px] text-muted">Your day</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{today.narrative}</p>
          <div className="mt-5">
            <DayCurve points={today.curve} height={150} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px]">
            <div>
              <p className="text-muted">From the sun</p>
              <p className="mt-0.5 text-[17px] text-ink">{formatPercent(today.selfPoweredShare)}</p>
            </div>
            <div>
              <p className="text-muted">Battery</p>
              <p className="mt-0.5 text-[17px] text-ink">{today.batteryPercent}%</p>
            </div>
            <div>
              <p className="text-muted">Saved today</p>
              <p className="mt-0.5 text-[17px] text-ink">{formatCurrency(today.savedToday)}</p>
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-5 overflow-hidden p-5">
          <Mascot className="h-auto w-20 shrink-0" />
          <div>
            <p className="text-[14px] text-ink">{insight.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{insight.body}</p>
          </div>
        </Card>
        <div className="flex items-center gap-4">
          <HomePhoto src="/brand/home-6.webp" className="h-20 w-28 rounded-xl" sizes="112px" />
          <p className="text-[13px] text-muted">
            {household.solarKw} kW solar · {household.batteryKwh} kWh battery
            <br />
            {household.address}
          </p>
        </div>
      </aside>
    </div>
  );
}
