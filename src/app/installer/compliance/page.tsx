import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/installer/bits";
import { ComplianceRenewal } from "@/components/installer/compliance-renewal";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getCompliance } from "@/lib/services/installer";

export const metadata = { title: "Compliance" };

const TONE = { current: "positive", expiring: "warning", expired: "danger", missing: "danger" } as const;
const LABEL = { current: "Current", expiring: "Expiring soon", expired: "Expired", missing: "Not on file" } as const;

export default async function CompliancePage() {
  await connection();
  const { items, paused, reasons } = getCompliance();
  return (
    <>
      <PageHeader title="Compliance" subtitle="Your licences and insurance. Keep them current to keep receiving job offers." />
      <p className="mb-5 max-w-2xl text-[14px] text-ink-2">
        {paused
          ? `New job offers are paused: ${reasons.join("; ").toLowerCase()}. Jobs you've already accepted carry on.`
          : "We'll remind you by email and text 60, 30, 14 and 7 days before anything expires, and the day before. If something lapses, new offers pause until it's updated; accepted jobs carry on."}
      </p>
      <Panel className="max-w-2xl">
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.kind} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[16px] font-medium">{i.label}</span>
                <Badge tone={TONE[i.status]}>{LABEL[i.status]}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">{i.detail}</p>
              {i.record && (
                <p className="mt-2 text-[14px] text-ink-2">
                  {i.record.amount ? `$${(i.record.amount / 1_000_000).toLocaleString("en-AU")} million cover · ` : ""}
                  {i.record.number ? `${i.record.number} · ` : ""}
                  {i.phrase === "not on file"
                    ? ""
                    : `${i.phrase[0].toUpperCase()}${i.phrase.slice(1)} (${formatDate(i.record.expires, { day: "numeric", month: "long", year: "numeric" })})`}
                </p>
              )}
              <ComplianceRenewal kind={i.kind} label={i.label} />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
