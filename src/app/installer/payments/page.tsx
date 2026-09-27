import { connection } from "next/server";
import { Metric, PageHeader, Panel } from "@/components/installer/bits";
import { Badge } from "@/components/ui/primitives";
import { formatCurrency, formatShortDate } from "@/lib/domain/format";
import { getPerformance, listPayouts } from "@/lib/services/installer";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await connection();
  const payouts = listPayouts();
  const perf = getPerformance();
  return (
    <>
      <PageHeader title="Payments" subtitle="Payouts are released when a job is commissioned and documents are lodged" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:max-w-xl">
        <Metric label="Paid this month" value={formatCurrency(perf.payoutsThisMonth)} positive />
        <Metric label="Pending" value={formatCurrency(perf.pendingPayouts)} />
      </div>
      <Panel title="Recent payouts">
        <ul className="divide-y divide-line">
          {payouts.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-4 px-5 py-3 text-[14px]">
              <span className="flex-1 font-medium">{p.reference}</span>
              <span className="text-muted">{formatShortDate(p.date)}</span>
              <span className="w-28 text-right tabular-nums">{formatCurrency(p.amount)}</span>
              <Badge tone={p.status === "paid" ? "positive" : "neutral"}>{p.status === "paid" ? "Paid" : "Pending"}</Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
