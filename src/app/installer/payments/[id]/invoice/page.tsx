import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PrintButton } from "@/components/installer/print-button";
import { formatAbn } from "@/lib/domain/partner";
import { formatCents, formatDate } from "@/lib/domain/format";
import { payoutInvoice } from "@/lib/domain/payouts";
import { variationsFor } from "@/lib/server/job-records";
import { getCurrentInstaller, getJob, getPartnerPayout } from "@/lib/services/installer";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/installer/payments/[id]/invoice">) {
  await connection();
  const { id } = await params;
  const job = getJob(id);
  if (!job) notFound();
  const payout = getPartnerPayout(id, (await variationsFor([job.recordKey]))[job.recordKey]);
  if (!payout || payout.status === "upcoming") notFound();
  const partner = getCurrentInstaller();
  // PREVIEW: GST status comes from the partner's account once logins are live.
  const inv = payoutInvoice(payout, { name: partner.name, abn: partner.abn ?? "", gstRegistered: true });
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/installer/payments/${id}`} className="text-[14px] text-muted hover:text-ink">
          ← Payout
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-[14px] text-[#1a1a1a] sm:p-10 print:rounded-none print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[20px] tracking-[0.28em]">RENUABL</p>
            <h1 className="mt-3 text-[22px]">{inv.title}</h1>
          </div>
          <dl className="text-right text-[13px]">
            <dt className="text-[#6b6b6b]">Number</dt>
            <dd>{inv.number}</dd>
            <dt className="mt-1 text-[#6b6b6b]">Date</dt>
            <dd>{formatDate(inv.issued, { day: "numeric", month: "long", year: "numeric" })}</dd>
          </dl>
        </header>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#6b6b6b]">Supplier</p>
            <p className="mt-1 font-medium">{inv.supplier.name}</p>
            <p>ABN {inv.supplier.abn ? formatAbn(inv.supplier.abn) : "to be confirmed"}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#6b6b6b]">Recipient</p>
            <p className="mt-1 font-medium">{inv.recipient.name}</p>
            {inv.recipient.tradingAs && <p>Trading as {inv.recipient.tradingAs}</p>}
            <p>ABN {formatAbn(inv.recipient.abn)}</p>
          </div>
        </div>
        <p className="mt-6 text-[13px] text-[#6b6b6b]">
          Installation services for {payout.reference}, installed{" "}
          {formatDate(payout.installDate, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d9d4cc] text-left text-[12px] uppercase tracking-wider text-[#6b6b6b]">
              <th className="py-2 font-normal">Description</th>
              <th className="py-2 text-right font-normal">Amount ex GST</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-[#ece7e0]">
                <td className="py-2 pr-4">{l.description}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tabular-nums">
            <tr>
              <td className="pt-3 text-right text-[#6b6b6b]">Subtotal</td>
              <td className="pt-3 text-right">{formatCents(inv.subtotal)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-right text-[#6b6b6b]">GST</td>
              <td className="pt-1 text-right">{formatCents(inv.gst)}</td>
            </tr>
            <tr className="text-[16px] font-medium">
              <td className="pt-2 text-right">Total</td>
              <td className="pt-2 text-right">{formatCents(inv.total)}</td>
            </tr>
          </tfoot>
        </table>
        <ul className="mt-8 space-y-1 text-[12px] text-[#6b6b6b]">
          {inv.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </>
  );
}
