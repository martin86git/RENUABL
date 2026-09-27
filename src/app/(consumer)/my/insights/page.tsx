import { Lightbulb, Sparkle, TrendingUp } from "lucide-react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { getInsights } from "@/lib/services/home";

export const metadata = { title: "Insights" };

const ICON = { positive: TrendingUp, tip: Lightbulb, neutral: Sparkle } as const;

export default function InsightsPage() {
  const insights = getInsights();
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Insights</Eyebrow>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">What your home is telling us</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {insights.map((i) => {
          const Icon = ICON[i.tone];
          return (
            <Card key={i.id} className="p-6">
              <Icon className="h-5 w-5 text-muted" aria-hidden />
              <p className="mt-4 text-[18px] font-semibold leading-snug">{i.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{i.body}</p>
            </Card>
          );
        })}
      </div>
      <AskRenuabl context="my" prompt="Ask about your insights" />
    </div>
  );
}
