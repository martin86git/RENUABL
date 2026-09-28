import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { BankDetailsCard } from "@/components/installer/bank-details";
import { Metric, PageHeader, Panel } from "@/components/installer/bits";
import { Badge } from "@/components/ui/primitives";
import { formatCurrency, formatShortDate } from "@/lib/domain/format";
import { PAYOUT_DAYS_AFTER_INSTALL, payoutTotals, type Payout } from "@/lib/domain/payouts";
import { variationsFor } from "@/lib/server/job-records";
import { listJobs, listPartnerPayouts } from "@/lib/services/installer";

export const metadata = { title: "Payments" };

const STATUS = {
  upcoming: { tone: "neutral", label: "Upcoming" },
  processing: { tone: "info", label: "Processing" },
  paid: { tone: "positive", label: "Paid" },
} as const;

function PayoutRows({ payouts }: { payouts: Payout[] }) {
  return (
    <ul className="divide-y divide-line">
      {payouts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/installer/payments/${p.id}`}
            className="flex min-h-16 items-center gap-3 px-5 py-3 text-[14px] hover:bg-surface-2/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {p.reference} · {p.customer}
              </span>
              <span className="block text-[13px] text-muted">
                {p.status === "paid" ? "Paid" : p.status === "processing" ? "Due" : "Expected"} {formatShortDate(p.date)}
              </span>
            </span>
            <span className="text-right tabular-nums">{formatCurrency(p.subtotal)}</span>
            <span className="hidden sm:block">
              <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function PaymentsPage() {
  await connection();
  const variations = await variationsFor((await listJobs()).map((j) => j.recordKey));
  const payouts = await listPartnerPayouts(variations);
  const totals = payoutTotals(payouts);
  const upcoming = payouts.filter((p) => p.status === "upcoming").reverse();
  const past = payouts.filter((p) => p.status !== "upcoming");
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`Paid ${PAYOUT_DAYS_AFTER_INSTALL} days after the install, once it's commissioned and the documents are in. Amounts are ex GST.`}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:max-w-3xl">
        <Metric label="Paid" value={formatCurrency(totals.paid)} positive />
        <Metric label="Processing" value={formatCurrency(totals.processing)} />
        <Metric label="Upcoming" value={formatCurrency(totals.upcoming)} detail="Accepted and confirmed jobs" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Panel title="Upcoming">
            {upcoming.length ? <PayoutRows payouts={upcoming} /> : <p className="px-5 py-4 text-[14px] text-muted">No upcoming payouts.</p>}
          </Panel>
          <Panel title="Past">
            {past.length ? <PayoutRows payouts={past} /> : <p className="px-5 py-4 text-[14px] text-muted">No payouts yet.</p>}
          </Panel>
        </div>
        <div className="lg:col-span-4">
          <BankDetailsCard />
        </div>
      </div>
    </>
  );
}
