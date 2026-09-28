import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PartnerDecision } from "@/components/admin/partner-decision";
import { PageHeader, Panel } from "@/components/installer/bits";
import { Badge } from "@/components/ui/primitives";
import { formatAbn } from "@/lib/domain/partner";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { timeLeft } from "@/lib/domain/offers";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { listAllJobs } from "@/lib/server/jobs-repo";
import { processOffersSoon } from "@/lib/server/offers-engine";
import { listPartners } from "@/lib/server/partners-repo";

export const metadata = { title: "Partners and jobs" };

const PARTNER_TONE = { pending: "warning", approved: "positive", declined: "neutral", paused: "neutral" } as const;
const JOB_LABEL: Record<string, string> = {
  unassigned: "Waiting for a partner",
  offered: "Offered",
  accepted: "Accepted",
  scheduled: "Confirmed",
  "in-progress": "Installing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function AdminPage() {
  await connection();
  if (!dbConfigured()) {
    return <PageHeader title="Staff" subtitle="Connect the database (DATABASE_URL) to manage partners and jobs." />;
  }
  const session = await currentSession();
  if (session?.role !== "staff") redirect("/login?as=partner&next=/admin");
  await processOffersSoon();
  const [partners, jobs] = await Promise.all([listPartners(), listAllJobs()]);
  const names = new Map(partners.map((p) => [p.id, p.business_name]));
  const pending = partners.filter((p) => p.status === "pending").length;

  return (
    <>
      <PageHeader title="Partners and jobs" subtitle={`Signed in as ${session.email}`} />
      <Panel title={`Partners${pending ? ` · ${pending} to review` : ""}`}>
        {partners.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-muted">No applications yet. Partners apply at /partners.</p>
        ) : (
          <ul className="divide-y divide-line">
            {partners.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-medium">{p.business_name}</span>
                    <Badge tone={PARTNER_TONE[p.status]}>{p.status}</Badge>
                    {p.priority > 0 && <Badge tone="info">Installer of choice</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {p.type === "retailer" ? "Retailer" : "Installer"} · {p.reference} · ABN {p.abn ? formatAbn(p.abn) : "?"} ·{" "}
                    {p.full_name}, {p.email}, {p.mobile}
                  </p>
                  <p className="text-[13px] text-muted">
                    Base {p.base?.suburb ?? "?"} {p.base?.postcode ?? ""} · within {p.radius_km} km · insured to{" "}
                    {p.insurance_expires ? formatDate(p.insurance_expires, { day: "numeric", month: "short", year: "numeric" }) : "?"}
                  </p>
                </div>
                <PartnerDecision id={p.id} status={p.status} priority={p.priority} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6" title={`Jobs · ${jobs.length}`}>
        {jobs.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-muted">No reservations yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {j.reference} · {j.customer.name} · {j.address.suburb}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {j.packageName} · {formatCurrency(j.value)}
                    {j.installDate ? ` · installs ${formatDate(j.installDate, { day: "numeric", month: "short" })}` : ""}
                  </span>
                </span>
                <span className="text-right text-[13px]">
                  <Badge tone={j.status === "unassigned" ? "warning" : j.status === "offered" ? "info" : "positive"}>
                    {JOB_LABEL[j.status]}
                  </Badge>
                  <span className="mt-1 block text-muted">
                    {j.status === "offered" && j.offer?.partner_id
                      ? `${names.get(j.offer.partner_id) ?? "Partner"} · ${j.offer.expires_at ? timeLeft(j.offer.expires_at).label : ""}`
                      : j.partnerId
                        ? names.get(j.partnerId)
                        : "No partner in range yet"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
