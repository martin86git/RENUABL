import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PrintButton } from "@/components/installer/print-button";
import { poText } from "@/lib/domain/design/pickup-slip";
import { formatDate } from "@/lib/domain/format";
import { slipByToken } from "@/lib/server/design-pickup-repo";

/** Kept out of search, and never tells a page it links to where it came from: the address is the key to it. */
export const metadata: Metadata = {
  title: { absolute: "Pickup slip" },
  description: "Materials ordered for collection.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Pickup slip", description: "Materials ordered for collection.", locale: "en_AU" },
  twitter: { card: "summary", title: "Pickup slip", description: "Materials ordered for collection." },
};

const LONG: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" };

/**
 * A job's pickup slip, opened by the installer at its private link, no sign-in: one page a wholesaler, as evidence at
 * the counter of what was ordered, with our PO and the wholesaler's SO. Printed, each wholesaler starts a new page.
 * Nothing of the customer, and no prices (domain/design/pickup-slip.ts).
 */
export default async function PickupSlipPage({ params }: PageProps<"/pickup/[token]">) {
  // The order can change up to the day: always as it stands now.
  await connection();
  const { token } = await params;
  const slip = await slipByToken(token).catch(() => null);
  if (!slip) notFound();
  const fact = (label: string, value: string | null) =>
    value ? (
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-0.5 text-[15px] font-medium text-ink">{value}</dd>
      </div>
    ) : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <p className="text-sm text-muted">Show this at the counter, or print it.</p>
          <PrintButton />
        </div>

        {slip.pages.length === 0 && (
          <p className="rounded-lg border border-line bg-surface px-5 py-4 text-sm text-ink-2">
            Nothing on this job&apos;s order has a wholesaler yet. {slip.business} will set it on their order.
          </p>
        )}

        {slip.pages.map((p, n) => (
          <section
            key={p.wholesaler}
            className="mb-8 break-after-page rounded-lg border border-line bg-surface p-6 last:break-after-auto print:mb-0 print:rounded-none print:border-0 print:p-0"
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Pickup slip</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{p.wholesaler}</h1>
                <p className="mt-1 text-sm text-ink-2">Ordered by {slip.business}</p>
              </div>
              <p className="text-sm text-muted">{slip.pages.length > 1 && `${n + 1} of ${slip.pages.length}`}</p>
            </header>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {fact("Our order (PO)", slip.reference ? poText(slip.reference) : null)}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Wholesaler Sales Order (SO)</dt>
                <dd className="mt-0.5 text-[15px] font-medium text-ink">{p.so || <span className="text-muted">Not entered</span>}</dd>
              </div>
              {fact("Collecting for", slip.installDate ? formatDate(slip.installDate, LONG) : null)}
              {fact("Job in", slip.suburb || null)}
              {fact("Collected by", slip.installer)}
              {fact("Ordered", slip.orderedOn ? formatDate(slip.orderedOn, LONG) : null)}
            </dl>

            <table className="mt-6 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="w-16 py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="w-14 py-2 text-center font-medium">Got</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((i, k) => (
                  <tr key={k} className="border-b border-line align-top">
                    <td className="py-2 pr-3 font-medium tabular-nums">{i.qty}</td>
                    <td className="py-2 pr-3">{i.item}</td>
                    <td className="py-2 pr-3 font-mono text-[13px] text-ink-2">{i.sku || "--"}</td>
                    <td className="py-2 text-center">
                      <span className="inline-block h-4 w-4 rounded-sm border border-ink-2" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              {p.items.length} {p.items.length === 1 ? "line" : "lines"}, {p.units} {p.units === 1 ? "unit" : "units"}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {["Collected by (name)", "Signature", "Date"].map((l) => (
                <div key={l}>
                  <div className="h-8 border-b border-ink-2" />
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{l}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {slip.unsourced.length > 0 && (
          <section className="rounded-lg border border-line bg-sun p-5 text-sun-ink print:hidden">
            <h2 className="text-sm font-semibold">Not on any wholesaler&apos;s order yet</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {slip.unsourced.map((i, k) => (
                <li key={k}>
                  {i.qty} x {i.item}
                  {i.sku && ` (${i.sku})`}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">Check with {slip.business} where to collect these.</p>
          </section>
        )}
      </div>
    </main>
  );
}
