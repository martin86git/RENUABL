import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/installer/bits";
import { MATERIALS_NOTE, MaterialsActions, MaterialsList } from "@/components/installer/materials";
import { cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { combineMaterials } from "@/lib/domain/materials";
import { listJobsToOrder } from "@/lib/services/installer";

export const metadata = { title: "Materials" };

const RANGES = [7, 14, 30] as const;

export default async function MaterialsPage({ searchParams }: PageProps<"/installer/materials">) {
  await connection();
  const { days: raw } = await searchParams;
  const days = RANGES.find((r) => String(r) === raw) ?? 14;
  const jobs = listJobsToOrder(days);
  const lines = combineMaterials(jobs);
  return (
    <>
      <PageHeader title="Materials" subtitle="Everything your accepted and confirmed jobs need, added up for one order" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Installing within" className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/installer/materials?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-2 text-[14px]",
                r === days ? "bg-surface font-medium text-ink" : "text-muted hover:text-ink",
              )}
            >
              Next {r} days
            </Link>
          ))}
        </nav>
        <MaterialsActions lines={lines} filename={`materials-next-${days}-days.csv`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="To order">
          <div className="px-5 py-4">
            {lines.length ? (
              <>
                <p className="mb-4 text-[13px] text-muted">{MATERIALS_NOTE}</p>
                <MaterialsList lines={lines} />
              </>
            ) : (
              <p className="text-[15px] text-ink-2">No accepted or confirmed jobs install in the next {days} days.</p>
            )}
          </div>
        </Panel>
        <Panel className="lg:col-span-4" title={`Jobs · ${jobs.length}`}>
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/installer/jobs/${j.id}`} className="block px-5 py-3 hover:bg-surface-2">
                  <span className="block text-[14px] font-medium">
                    {j.reference} · {j.customer.name}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {formatDate(j.preferredDate, { weekday: "short", day: "numeric", month: "short" })} · {j.packageName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
