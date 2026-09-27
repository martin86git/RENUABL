import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/installer/bits";
import { buttonClass } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { variationsFor } from "@/lib/server/job-records";
import { getJob, getPartnerPayout } from "@/lib/services/installer";

export const metadata = { title: "Payout" };

export default async function PayoutPage({ params }: PageProps<"/installer/payments/[id]">) {
  await connection();
  const { id } = await params;
  const job = getJob(id);
  if (!job) notFound();
  const variations = (await variationsFor([job.recordKey]))[job.recordKey];
  const payout = getPartnerPayout(id, variations);
  if (!payout) notFound();
  const when = formatDate(payout.date, { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <Link href="/installer/payments" className="text-[14px] text-muted hover:text-ink">
        ← Payments
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`${payout.reference} · ${payout.customer}`}
          subtitle={
            payout.status === "paid"
              ? `Paid ${when}`
              : payout.status === "processing"
                ? `Due ${when}`
                : `Expected ${when}, after the install`
          }
          action={
            payout.status !== "upcoming" ? (
              <Link href={`/installer/payments/${id}/invoice`} className={buttonClass("secondary", "sm")}>
                View invoice
              </Link>
            ) : undefined
          }
        />
      </div>
      <Panel className="max-w-2xl" title="What you're paid for">
        <ul className="divide-y divide-line">
          {payout.lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-5 py-3 text-[14px]">
              <span className="text-ink-2">{l.description}</span>
              <span className="tabular-nums">{formatCurrency(l.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 px-5 py-3.5 text-[15px] font-medium">
            <span>Total, ex GST</span>
            <span className="tabular-nums">{formatCurrency(payout.subtotal)}</span>
          </li>
        </ul>
      </Panel>
      <p className="mt-4 max-w-2xl text-[13px] text-muted">
        At your installation rates. Approved variations are added here. Equipment is supplied by RENUABL, so it isn&apos;t part of your
        payout.
      </p>
    </>
  );
}
