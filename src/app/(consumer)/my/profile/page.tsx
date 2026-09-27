import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, Eyebrow, StatRow } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getHousehold } from "@/lib/services/home";

export const metadata = { title: "Profile" };

export default function ProfilePage() {
  const household = getHousehold();
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">{household.owner}</h1>
        <p className="mt-1 text-[15px] text-muted">{household.address}</p>
      </div>
      <Card className="px-5">
        <div className="divide-y divide-line">
          <StatRow label="System" value={`${household.solarKw} kW solar · ${household.batteryKwh} kWh battery`} />
          <StatRow label="Installed" value={formatDate(household.installedOn, { day: "numeric", month: "short", year: "numeric" })} />
          <StatRow label="Installer" value={household.installer} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line text-[14.5px]">
          {[
            { href: "/my/health", label: "System health" },
            { href: "/my/upgrades", label: "Upgrades" },
            { href: "/my/service", label: "Book a service" },
            { href: "/my/support", label: "Help & support" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center justify-between px-5 py-4 hover:bg-canvas/60">
                {l.label}
                <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.5} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
