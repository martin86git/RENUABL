import { Lightbulb, Sparkle, TrendingUp } from "lucide-react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { getInsights, getMonthSummary } from "@/lib/services/home";

export const metadata = { title: "Savings" };

const ICON = { positive: TrendingUp, tip: Lightbulb, neutral: Sparkle } as const;

export default function SavingsPage() {
  const insights = getInsights();
  const month = getMonthSummary();
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Savings &amp; insights</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">What your home is telling us</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          { label: "Saved this month", value: formatCurrency(month.savings) },
          { label: "Saved since install", value: formatCurrency(month.savingsSinceInstall) },
          { label: "Powered by the sun", value: formatPercent(month.selfPoweredShare) },
          { label: "CO₂ avoided", value: `${month.co2AvoidedKg} kg` },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-[26px] font-normal tracking-tight tabular-nums">{s.value}</p>
            <p className="text-[13px] text-muted">{s.label}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {insights.map((i) => {
          const Icon = ICON[i.tone];
          return (
            <Card key={i.id} className="p-6">
              <Icon className="h-5 w-5 text-muted" aria-hidden />
              <p className="mt-4 text-[18px] font-medium leading-snug">{i.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{i.body}</p>
            </Card>
          );
        })}
      </div>
      <AskRenuabl context="my" title="Ask RENUABL" subtitle="How can I improve my savings?" />
    </div>
  );
}
