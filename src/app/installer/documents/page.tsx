import { FileText } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/installer/bits";
import { Badge } from "@/components/ui/primitives";
import { listJobs } from "@/lib/services/installer";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  await connection();
  const outstanding = (await listJobs()).flatMap((j) => j.documents.filter((d) => d.status === "required").map((d) => ({ ...d, job: j })));
  return (
    <>
      <PageHeader title="Documents" subtitle={`${outstanding.length} documents outstanding across your jobs`} />
      <Panel>
        <ul className="divide-y divide-line">
          {outstanding.map((d) => (
            <li key={`${d.job.id}-${d.id}`}>
              <Link href={`/installer/jobs/${d.job.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-surface-2/40">
                <FileText className="h-5 w-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{d.name}</span>
                  <span className="block text-[13px] text-muted">
                    {d.job.reference} · {d.job.customer.name}
                  </span>
                </span>
                <Badge tone="warning">Required</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
