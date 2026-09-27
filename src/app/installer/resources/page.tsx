import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/installer/bits";
import { listResources } from "@/lib/services/installer";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <>
      <PageHeader title="Resources" subtitle="Standards, checklists and guides for RENUABL installs" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {listResources().map((r) => (
          <article key={r.id} className="rounded-2xl border border-line bg-surface p-5">
            <BookOpen className="h-5 w-5 text-muted" aria-hidden />
            <h2 className="mt-3 text-[16px] font-medium">{r.title}</h2>
            <p className="mt-1 text-[14px] text-muted">{r.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}
