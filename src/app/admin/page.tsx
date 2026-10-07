import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PartnerDecision } from "@/components/admin/partner-decision";
import { PriceUpload } from "@/components/admin/price-upload";
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
import { listPriceUploads } from "@/lib/server/prices-repo";
import { allHealthAnswers } from "@/lib/server/home-health-repo";
import { listWhoopClaims } from "@/lib/server/whoop-repo";
import { WhoopActions } from "@/components/admin/healthy-actions";
import { interestSummary } from "@/lib/domain/home-health";
import { WHOOP_ENDS, WHOOP_OFFER } from "@/lib/domain/whoop-offer";
import { BriefSender } from "@/components/admin/brief-sender";
import { SCORE_LABELS, cleanBriefAnswers, scoreBrief } from "@/lib/domain/brief";
import { listBriefs } from "@/lib/server/briefs-repo";
import { noteUnfinishedBriefs } from "@/lib/server/brief-hubspot";

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
  // Briefs left partway for a few hours get their "not finished" note when staff look (and from the daily cron).
  await noteUnfinishedBriefs();
  const [partners, jobs, uploads, claims, checks, briefs] = await Promise.all([
    listPartners(),
    listAllJobs(),
    listPriceUploads(),
    listWhoopClaims(),
    allHealthAnswers(),
    listBriefs(),
  ]);
  const tallies = interestSummary(checks);
  const held = claims.filter((c) => c.status !== "released").length;
  const names = new Map(partners.map((p) => [p.id, p.business_name]));
  const pending = partners.filter((p) => p.status === "pending").length;

  return (
    <>
      <PageHeader title="Partners and jobs" subtitle={`Signed in as ${session.email}`} />
      <p className="-mt-2 mb-6 text-[13px] text-muted">
        Leads not reaching HubSpot?{" "}
        <a href="/api/admin/hubspot-test" target="_blank" rel="noreferrer" className="underline underline-offset-4">
          Test HubSpot
        </a>{" "}
        saves a note on RENUABL&apos;s own test contact and shows HubSpot&apos;s reply.
      </p>
      <Panel title="Send a brief">
        <BriefSender />
      </Panel>
      {briefs.length > 0 && (
        <Panel className="mt-6" title={`Briefs · ${briefs.length}`}>
          <ul className="divide-y divide-line">
            {briefs.map((b) => {
              const answers = cleanBriefAnswers(b.answers);
              const { score, flags } = scoreBrief({ answers, billRead: Boolean(b.summary?.billRead), booked: b.status === "booked" });
              return (
                <li key={b.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium">{b.first_name}</span>
                    <Badge tone={b.status === "booked" ? "positive" : b.status === "started" ? "info" : "neutral"}>
                      {b.status === "booked" ? "Call booked" : b.status === "started" ? "Filling it in" : "Sent"}
                    </Badge>
                    <Badge tone={score === "hot" ? "positive" : score === "warm" ? "warning" : "neutral"}>{SCORE_LABELS[score]}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {b.mobile ?? "No mobile"} · {Object.keys(answers).length} answers · updated{" "}
                    {b.updated_on ? formatDate(b.updated_on, { day: "numeric", month: "short" }) : ""}
                    {b.call_label ? ` · call ${b.call_label}` : ""}
                  </p>
                  {b.summary && (
                    <p className="text-[13px] text-muted">
                      {[b.summary.home, b.summary.usage, b.summary.system, b.summary.price].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {b.status !== "sent" && flags.length > 0 && <p className="text-[12.5px] text-warning">{flags.join(". ")}</p>}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      <Panel className="mt-6" title={`Partners${pending ? ` · ${pending} to review` : ""}`}>
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

      <Panel className="mt-6" title="Supplier prices">
        <PriceUpload />
        <div className="border-t border-line px-5 py-4">
          <p className="text-[14px] text-ink">Upload history</p>
          {uploads.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted">No price lists uploaded yet. Prices come from the AWM Clayton August 2026 list.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {uploads.map((u) => (
                <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block text-ink">
                      {u.supplier} · {u.filename}
                    </span>
                    <span className="block text-muted">
                      Uploaded{" "}
                      {new Date(u.uploadedAt).toLocaleString("en-AU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Australia/Melbourne",
                      })}{" "}
                      by {u.uploadedBy} · {u.changes.length} changed, {u.unchanged} unchanged
                      {u.decidedAt && u.decidedBy
                        ? ` · ${u.status === "applied" ? "applied" : "discarded"} ${new Date(u.decidedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" })} by ${u.decidedBy}`
                        : ""}
                    </span>
                    {u.status === "applied" && u.changes.length > 0 && (
                      <details className="mt-1 text-muted">
                        <summary className="cursor-pointer">What changed</summary>
                        <ul className="mt-1 space-y-0.5">
                          {u.changes.map((c) => (
                            <li key={c.sku}>
                              {c.name}: ${c.oldCost} → ${c.newCost}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </span>
                  <Badge tone={u.status === "applied" ? "positive" : u.status === "pending" ? "warning" : "neutral"}>
                    {u.status === "pending" ? "not applied" : u.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title={`Home Health answers · ${checks.length} ${checks.length === 1 ? "check" : "checks"}`}>
        <p className="px-5 pt-4 text-[13px] text-muted">
          Research only: we don&apos;t offer healthy home products yet. These tallies show which ones customers want most. Skipped questions
          aren&apos;t counted, and the allergies answer is never shown here.
        </p>
        {checks.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-muted">No checks yet. They come from the Home Health check.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tallies.map((t) => (
              <li key={t.id} className="px-5 py-3.5 text-[14px]">
                <p className="font-medium">{t.prompt}</p>
                <p className="text-[12.5px] text-muted">{t.answered} answered</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {t.counts.map((c) => (
                    <li key={c.label} className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-ink-2">
                      {c.label} · {c.count}
                      {t.answered ? ` (${Math.round((c.count / t.answered) * 100)}%)` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`WHOOP ${WHOOP_OFFER.name.toLowerCase()} · ${held} of ${WHOOP_OFFER.cap} claimed`}>
        {claims.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-muted">
            No claims yet. Each reservation with a battery claims one {WHOOP_ENDS ? `until the end of ${WHOOP_ENDS} or ` : ""}until all{" "}
            {WHOOP_OFFER.cap} are taken.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li key={c.job_reference} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[14px]">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.job_reference}</span>
                    <Badge tone={c.status === "delivered" ? "positive" : c.status === "released" ? "neutral" : "info"}>{c.status}</Badge>
                  </span>
                  <span className="block text-[13px] text-muted">
                    {c.name ?? "Unknown"}
                    {c.install_date
                      ? ` · installs ${formatDate(c.install_date, { weekday: "short", day: "numeric", month: "short" })}`
                      : ""}
                  </span>
                </span>
                <WhoopActions reference={c.job_reference} status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
