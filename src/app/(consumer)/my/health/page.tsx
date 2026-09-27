import { CircleCheck, TriangleAlert } from "lucide-react";
import { Badge, Card, Eyebrow, StatRow } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getHousehold, getSystemHealth } from "@/lib/services/home";

export const metadata = { title: "System health" };

export default function HealthPage() {
  const items = getSystemHealth();
  const household = getHousehold();
  const attention = items.filter((i) => i.status === "attention");

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>System health</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">
          {attention.length === 0 ? "Everything is running well." : "Running well, with one thing to check."}
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="divide-y divide-line lg:col-span-8">
          {items.map((i) => (
            <div key={i.id} className="flex items-start gap-4 p-5 sm:p-6">
              {i.status === "good" ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive" aria-label="Good" />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-label="Needs attention" />
              )}
              <div className="flex-1">
                <p className="text-[16px] font-medium">{i.label}</p>
                <p className="text-[15px] text-muted">{i.detail}</p>
              </div>
              {i.status === "attention" && <Badge tone="warning">Check</Badge>}
            </div>
          ))}
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-4">
          <h2 className="text-[17px] font-medium">Your system</h2>
          <div className="mt-2 divide-y divide-line">
            <StatRow label="Solar" value={`${household.solarKw} kW`} />
            <StatRow label="Battery" value={`${household.batteryKwh} kWh`} />
            <StatRow label="Installed" value={formatDate(household.installedOn, { day: "numeric", month: "short", year: "numeric" })} />
            <StatRow label="Installation partner" value={household.installer} />
          </div>
        </Card>
      </div>
    </div>
  );
}
