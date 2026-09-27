import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Panel, StageBadge } from "@/components/installer/bits";
import { listCustomers } from "@/lib/services/installer";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  await connection();
  const customers = listCustomers();
  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} customers matched to you by RENUABL`} />
      <Panel>
        <ul className="divide-y divide-line">
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/installer/jobs/${c.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-surface-2/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-medium">
                  {c.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{c.name}</span>
                  <span className="block text-[13px] text-muted">
                    {c.suburb} · {c.reference}
                  </span>
                </span>
                <span className="hidden text-[14px] tabular-nums text-ink-2 sm:block">{c.phone}</span>
                <StageBadge stage={c.stage} />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
