"use client";

import {
  Check,
  ChevronDown,
  CircleCheck,
  CloudOff,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Accordion, Tabs } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Button, buttonClass, cn } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "@/lib/domain/format";
import { FIELD_STATUS_FLOW, stageForFieldStatus } from "@/lib/domain/job-status";
import { panelsToKw } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import type { Crew, Job, JobStage } from "@/lib/domain/types";
import { Handover } from "@/components/installer/handover";
import { JobDocuments } from "@/components/installer/job-documents";
import { JobMaterials } from "@/components/installer/materials";
import { JobConnection } from "@/components/installer/job-connection";
import { JobVariations, type PartnerTerms } from "@/components/installer/job-variations";
import { jobMaterials } from "@/lib/domain/materials";
import { HomePhoto, homeBannerFor, homePhotoFor } from "@/components/ui/brand-art";
import { ImageTile, StageBadge } from "./bits";
import { useFieldStatus } from "./use-field-status";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium">{children}</dd>
    </div>
  );
}

function StatusTimeline({ history }: { history: Job["statusHistory"] }) {
  return (
    <ol className="space-y-0">
      {FIELD_STATUS_FLOW.map((s, i) => {
        const event = history.find((h) => h.status === s.id);
        const isCurrent = history.at(-1)?.status === s.id;
        return (
          <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < FIELD_STATUS_FLOW.length - 1 && (
              <span className={cn("absolute left-[11px] top-6 h-[calc(100%-18px)] w-px", event ? "bg-positive/50" : "bg-line")} />
            )}
            <span
              className={cn(
                "relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                event ? "border-positive bg-positive text-[#0d0f12]" : "border-line-strong bg-surface",
                isCurrent && "ring-4 ring-positive/20",
              )}
            >
              {event && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <div className="flex flex-1 items-baseline justify-between gap-2">
              <p className={cn("text-[15px]", event ? "font-medium text-ink" : "text-muted")}>{s.label}</p>
              {event && <p className="text-[13px] tabular-nums text-muted">{formatTime(event.at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Checklist({ items, onToggle }: { items: Job["checklist"]; onToggle: (id: string) => void }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.id}>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
            <input type="checkbox" checked={c.done} onChange={() => onToggle(c.id)} className="peer sr-only" />
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-info",
                c.done ? "border-positive bg-positive text-[#0d0f12]" : "border-line-strong",
              )}
            >
              {c.done && <Check className="h-4 w-4" strokeWidth={3} />}
            </span>
            <span className={cn("text-[15px]", c.done && "text-muted line-through")}>{c.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function Messages({ messages }: { messages: Job["messages"] }) {
  if (!messages.length) return <p className="py-4 text-[14px] text-muted">No messages yet.</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li
          key={m.id}
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-3",
            m.from === "installer" ? "ml-auto bg-primary text-primary-ink" : "bg-surface-2",
          )}
        >
          <p className="text-[12px] opacity-70">
            {m.author} · {formatTime(m.at)}
          </p>
          <p className="mt-0.5 text-[15px]">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

function ContactButtons({ job, className }: { job: Job; className?: string }) {
  const maps = `https://maps.google.com/?q=${encodeURIComponent(`${job.address.line}, ${job.address.suburb} ${job.address.state}`)}`;
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <a href={`tel:${job.customer.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "lg", "rounded-xl px-0")}>
        <Phone className="h-5 w-5" /> Call
      </a>
      <a href={`sms:${job.customer.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "lg", "rounded-xl px-0")}>
        <MessageCircle className="h-5 w-5" /> Text
      </a>
      <a href={maps} target="_blank" rel="noreferrer" className={buttonClass("secondary", "lg", "rounded-xl px-0")}>
        <Navigation className="h-5 w-5" /> Route
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export function JobWorkspace({
  job,
  crews,
  installerName,
  partner,
}: {
  job: Job;
  crews: Crew[];
  installerName: string;
  partner: PartnerTerms;
}) {
  const field = useFieldStatus(job.id, job.statusHistory);
  const [checklist, setChecklist] = useState(job.checklist);
  const [stage, setStage] = useState<JobStage>(job.stage);
  const [crewId, setCrewId] = useState(job.crewId);
  const [confirming, setConfirming] = useState(false);

  const effectiveStage = stage === "new" || stage === "accepted" ? stage : stageForFieldStatus(field.current, stage);
  const window = getWindow(job.windowId);
  const crew = crews.find((c) => c.id === crewId);
  const doneCount = checklist.filter((c) => c.done).length;
  const canStartField = effectiveStage === "scheduled" || effectiveStage === "in-progress";

  const toggle = (id: string) => setChecklist((cs) => cs.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));

  function advance() {
    setConfirming(true);
    field.advance();
    setTimeout(() => setConfirming(false), 450);
  }

  const primaryCta =
    effectiveStage === "new" ? (
      <Button size="lg" className="w-full rounded-2xl" onClick={() => setStage("accepted")}>
        Accept job
      </Button>
    ) : effectiveStage === "accepted" ? (
      <Button size="lg" className="w-full rounded-2xl" disabled={!crewId} onClick={() => setStage("scheduled")}>
        {crewId ? "Confirm schedule" : "Assign a crew to confirm"}
      </Button>
    ) : field.next ? (
      <Button size="lg" className="h-16 w-full rounded-2xl text-[17px]" onClick={advance} disabled={!canStartField || confirming}>
        {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : field.next.action}
      </Button>
    ) : (
      <div className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-positive-soft text-[16px] font-medium text-positive">
        <CircleCheck className="h-5 w-5" /> Installation complete
      </div>
    );

  const syncNote = (
    <div aria-live="polite" className="min-h-5 text-[13px]">
      {!field.online ? (
        <p className="flex items-center gap-1.5 text-warning">
          <CloudOff className="h-4 w-4" /> Offline — {field.pending.length} update{field.pending.length === 1 ? "" : "s"} will sync
          automatically
        </p>
      ) : field.pending.length > 0 ? (
        <p className="flex items-center gap-1.5 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Syncing…
        </p>
      ) : field.lastSync ? (
        <p className="text-muted">
          <span className="text-positive">✓</span> {field.lastSync.label} recorded{field.lastSync.notified ? " · customer notified" : ""}
        </p>
      ) : null}
    </div>
  );

  const crewSelect = (
    <label className="block">
      <span className="text-[12px] text-muted">Crew</span>
      <select
        value={crewId ?? ""}
        onChange={(e) => setCrewId(e.target.value || null)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px] text-ink"
      >
        <option value="">Unassigned</option>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.lead}
          </option>
        ))}
      </select>
    </label>
  );

  const materials = jobMaterials(job);

  const systemFacts = (
    <dl className="grid grid-cols-2 gap-4">
      <Fact label="Solar">
        {panelsToKw(job.system.panelCount)} kW · {job.system.panelCount} panels
      </Fact>
      <Fact label="Battery">{job.system.batteryKwh ? `${job.system.batteryKwh} kWh` : "None"}</Fact>
      <Fact label="EV charger">{job.system.evCharger ? "Yes" : "No"}</Fact>
      <Fact label="Job value">{formatCurrency(job.value)}</Fact>
    </dl>
  );

  const siteFacts = (
    <dl className="grid grid-cols-2 gap-4">
      <Fact label="Storeys">{job.site.storeys === "double" ? "Double" : "Single"}</Fact>
      <Fact label="Roof">{job.site.roof}</Fact>
      <Fact label="Orientation">{job.site.orientation}</Fact>
      <Fact label="Approvals">{job.documents.find((d) => d.kind === "approval")?.status === "required" ? "Outstanding" : "Granted"}</Fact>
    </dl>
  );

  return (
    <>
      {/* ------------------------------------------------ Mobile (field) */}
      <div className="lg:hidden">
        <Link href="/installer/jobs" className="text-[14px] text-muted">
          ← Jobs
        </Link>
        <HomePhoto src={homeBannerFor(job.id)} className="mt-3 h-32 w-full rounded-2xl" sizes="100vw" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-muted">{job.reference}</p>
            <h1 className="text-[26px] font-normal leading-tight tracking-[-0.03em]">{job.customer.name}</h1>
          </div>
          <StageBadge stage={effectiveStage} />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[16px] text-ink-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {job.address.line}, {job.address.suburb} {job.address.postcode}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4">
          <Fact label="Install">
            {formatDate(job.preferredDate, { weekday: "short", day: "numeric", month: "short" })} · {window?.label}
          </Fact>
          <Fact label="Status">{field.current ? FIELD_STATUS_FLOW.find((f) => f.id === field.current)!.label : "Not started"}</Fact>
          <div className="col-span-2">
            <Fact label="System">{job.packageName}</Fact>
          </div>
        </dl>

        <div className="mt-4 space-y-2">
          {primaryCta}
          {syncNote}
        </div>

        <Accordion.Root
          type="multiple"
          defaultValue={["access"]}
          className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface"
        >
          {[
            {
              id: "site",
              title: "Site notes",
              body: (
                <>
                  {siteFacts}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {job.site.imagery.map((i) => (
                      <ImageTile key={i.id} label={i.label} />
                    ))}
                  </div>
                </>
              ),
            },
            { id: "access", title: "Access", icon: KeyRound, body: <p className="text-[15px] leading-relaxed">{job.site.accessNotes}</p> },
            {
              id: "system",
              title: "System",
              body: (
                <>
                  {systemFacts}
                  <p className="mt-4 text-[14px] text-ink-2">
                    <Zap className="mr-1 inline h-4 w-4 text-warning" />
                    {job.site.switchboardNotes}
                  </p>
                </>
              ),
            },
            {
              id: "materials",
              title: `Materials · ${materials.length} items`,
              body: <JobMaterials reference={job.reference} lines={materials} />,
            },
            {
              id: "variations",
              title: "Variations",
              body: <JobVariations job={job} partner={partner} />,
            },
            {
              id: "connection",
              title: "Grid connection & rebates",
              body: <JobConnection job={job} partnerType={partner.type} />,
            },
            {
              id: "checklist",
              title: `Checklist · ${doneCount}/${checklist.length}`,
              body: <Checklist items={checklist} onToggle={toggle} />,
            },
            {
              id: "handover",
              title: "Handover · photos & serials",
              body: <Handover job={job} installer={installerName} installedOn={job.preferredDate} />,
            },
            { id: "docs", title: "Documents", body: <JobDocuments job={job} docs={job.documents} /> },
            {
              id: "contact",
              title: "Customer contact",
              body: (
                <>
                  <p className="text-[15px]">
                    {job.customer.name} · {job.customer.phone}
                  </p>
                  <ContactButtons job={job} className="mt-3" />
                </>
              ),
            },
          ].map((s) => (
            <Accordion.Item key={s.id} value={s.id}>
              <Accordion.Header>
                <Accordion.Trigger className="group flex min-h-14 w-full items-center justify-between px-4 text-left text-[16px] font-medium">
                  {s.title}
                  <ChevronDown className="h-5 w-5 text-muted transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="px-4 pb-4">{s.body}</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>

      {/* ------------------------------------------------ Desktop (site pack) */}
      <div className="hidden lg:block">
        <Link href="/installer/jobs" className="text-[13px] text-muted hover:text-ink">
          ← All jobs
        </Link>
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <HomePhoto src={homePhotoFor(job.id)} className="h-20 w-24 shrink-0 rounded-xl" sizes="96px" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[30px] font-normal tracking-[-0.03em]">{job.customer.name}</h1>
                <StageBadge stage={effectiveStage} />
              </div>
              <p className="mt-1 text-[14px] text-muted">
                {job.reference} · {job.address.line}, {job.address.suburb} {job.address.state} {job.address.postcode}
              </p>
            </div>
          </div>
          <div className="w-72 space-y-2">
            {primaryCta}
            {syncNote}
          </div>
        </div>

        <Tabs.Root defaultValue="overview" className="mt-6">
          <Tabs.List className="flex gap-1 overflow-x-auto border-b border-line" aria-label="Job sections">
            {["Overview", "Site", "System", "Materials", "Variations", "Handover", "Connection", "Documents", "Messages", "Activity"].map(
              (t) => (
                <Tabs.Trigger
                  key={t}
                  value={t.toLowerCase()}
                  className="-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-3 text-[14px] text-muted hover:text-ink data-[state=active]:border-ink data-[state=active]:font-medium data-[state=active]:text-ink"
                >
                  {t}
                </Tabs.Trigger>
              ),
            )}
          </Tabs.List>

          <Tabs.Content value="overview" className="mt-6 grid grid-cols-12 gap-6">
            <div className="col-span-8 space-y-6">
              <section className="rounded-2xl border border-line bg-surface p-6">
                <dl className="grid grid-cols-3 gap-6">
                  <Fact label="Install date">{formatDate(job.preferredDate)}</Fact>
                  <Fact label="Arrival window">
                    {window?.label} ({window?.detail})
                  </Fact>
                  <Fact label="Package">{job.packageName}</Fact>
                  <Fact label="Customer">{job.customer.name}</Fact>
                  <Fact label="Phone">
                    <a href={`tel:${job.customer.phone.replace(/\s/g, "")}`} className="hover:underline">
                      {job.customer.phone}
                    </a>
                  </Fact>
                  <Fact label="Email">
                    <a href={`mailto:${job.customer.email}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="h-3.5 w-3.5" />
                      {job.customer.email}
                    </a>
                  </Fact>
                </dl>
              </section>
              <div className="grid grid-cols-2 gap-6">
                <section className="rounded-2xl border border-line bg-surface p-6">
                  <h2 className="flex items-center gap-2 text-[15px] font-medium">
                    <KeyRound className="h-4 w-4 text-muted" /> Access notes
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{job.site.accessNotes}</p>
                </section>
                <section className="rounded-2xl border border-line bg-surface p-6">
                  <h2 className="flex items-center gap-2 text-[15px] font-medium">
                    <Zap className="h-4 w-4 text-warning" /> Switchboard
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{job.site.switchboardNotes}</p>
                </section>
              </div>
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="text-[15px] font-medium">Roof & site imagery</h2>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {job.site.imagery.map((i) => (
                    <ImageTile key={i.id} label={i.label} />
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="text-[15px] font-medium">
                  Approvals & checklist · {doneCount}/{checklist.length}
                </h2>
                <div className="mt-2">
                  <Checklist items={checklist} onToggle={toggle} />
                </div>
              </section>
            </div>
            <div className="col-span-4 space-y-6">
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="mb-4 text-[15px] font-medium">Field status</h2>
                <StatusTimeline history={field.history} />
              </section>
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="mb-3 text-[15px] font-medium">Crew</h2>
                {crewSelect}
                {crew && <p className="mt-2 text-[13px] text-muted">Lead: {crew.lead}</p>}
              </section>
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="mb-2 text-[15px] font-medium">Required documents</h2>
                <JobDocuments job={job} docs={job.documents.filter((d) => d.status !== "ready")} />
              </section>
            </div>
          </Tabs.Content>

          <Tabs.Content value="site" className="mt-6 grid grid-cols-12 gap-6">
            <section className="col-span-5 space-y-6 rounded-2xl border border-line bg-surface p-6">
              {siteFacts}
              <div>
                <p className="text-[12px] text-muted">Access</p>
                <p className="mt-1 text-[14px] text-ink-2">{job.site.accessNotes}</p>
              </div>
              <div>
                <p className="text-[12px] text-muted">Switchboard</p>
                <p className="mt-1 text-[14px] text-ink-2">{job.site.switchboardNotes}</p>
              </div>
            </section>
            <section className="col-span-7 rounded-2xl border border-line bg-surface p-6">
              <div className="grid grid-cols-2 gap-3">
                {job.site.imagery.map((i) => (
                  <ImageTile key={i.id} label={i.label} />
                ))}
              </div>
            </section>
          </Tabs.Content>

          <Tabs.Content value="materials" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <JobMaterials reference={job.reference} lines={materials} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="variations" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <JobVariations job={job} partner={partner} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="connection" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[17px] font-medium">Grid connection & rebates</h2>
              <p className="mt-1 text-[14px] text-ink-2">
                Tick off your steps as they&apos;re done. RENUABL&apos;s steps are shown so you can see where it&apos;s up to.
              </p>
              <div className="mt-3">
                <JobConnection job={job} partnerType={partner.type} />
              </div>
            </section>
          </Tabs.Content>

          <Tabs.Content value="handover" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <Handover job={job} installer={installerName} installedOn={job.preferredDate} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="system" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <p className="text-[17px] font-medium">{job.packageName}</p>
              <div className="mt-5">{systemFacts}</div>
              <p className="mt-6 text-[13px] text-muted">Design and panel layout are in Documents.</p>
            </section>
          </Tabs.Content>

          <Tabs.Content value="documents" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface px-6 py-2">
              <JobDocuments job={job} docs={job.documents} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="messages" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <Messages messages={job.messages} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="activity" className="mt-6">
            <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
              <ul className="space-y-3">
                {[
                  ...job.activity.map((a) => ({ label: a.label, at: a.at })),
                  ...field.history.map((h) => ({ label: FIELD_STATUS_FLOW.find((f) => f.id === h.status)!.label, at: h.at })),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((a, i) => (
                    <li key={i} className="flex justify-between gap-4 text-[14px]">
                      <span>{a.label}</span>
                      <span className="tabular-nums text-muted">{formatDateTime(a.at)}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </>
  );
}
