import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/installer/bits";
import { formatTime } from "@/lib/domain/format";
import { listConversations } from "@/lib/services/installer";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await connection();
  const threads = listConversations();
  return (
    <>
      <PageHeader title="Messages" subtitle="Customer conversations, coordinated by RENUABL" />
      <Panel>
        {threads.length === 0 ? (
          <p className="p-8 text-center text-muted">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <li key={t.jobId}>
                <Link href={`/installer/jobs/${t.jobId}`} className="flex min-h-[72px] items-start gap-4 px-5 py-4 hover:bg-surface-2/40">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-semibold">
                    {t.customer
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-medium">{t.customer}</span>
                      <span className="text-[12px] text-muted">{formatTime(t.last.at)}</span>
                    </span>
                    <span className="block text-[12px] text-muted">{t.reference}</span>
                    <span className="mt-1 block truncate text-[14px] text-ink-2">
                      {t.last.author}: {t.last.body}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
