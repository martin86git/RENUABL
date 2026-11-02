"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, ClipboardCheck, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  OUTCOMES,
  OUTCOME_WORDS,
  inspectionLive,
  inspectionWords,
  type InspectionLine,
  type InspectionView,
  type Outcome,
} from "@/lib/domain/design/inspections";
import type { JobCardView } from "@/lib/server/design-job-card-repo";
import {
  certificateHref,
  declineInspection,
  inspectionFileHref,
  inspectionRoofHref,
  jobInspection,
  loadInspection,
  loadInspections,
  loadNomination,
  nominateInspector,
  recordInspection,
  takeNominationBack,
} from "@/lib/services/inspections";
import { PageHead, ui } from "./design-shell";
import { ReadOnlyJobCard } from "./job-card";

const head = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

/** Where an inspection stands, in a line, with its certificate when there is one. Seen by all three businesses. */
function Standing({ inspection: i }: { inspection: InspectionView }) {
  const tone = i.state === "passed" ? "text-positive" : i.state === "defects" ? "text-warning" : "text-ink";
  return (
    <div className="space-y-1">
      <p className={clsx("text-sm", tone)}>{inspectionWords(i)}</p>
      {i.notes && i.state !== "nominated" && <p className="whitespace-pre-line text-xs text-ink-2">{i.notes}</p>}
      {i.certificate && (
        <a
          href={certificateHref(i.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink underline underline-offset-4"
        >
          <FileText className="size-3.5" aria-hidden /> Certificate
        </a>
      )}
    </div>
  );
}

/** On an installer's accepted job: nominate a connected inspector, then where it stands, and Take it back. */
export function NominateInspector({ shareId }: { shareId: string }) {
  const [data, setData] = useState<{ inspection: InspectionView | null; inspectors: { key: string; name: string }[] } | null>(null);
  const [to, setTo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadNomination(shareId).then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, [shareId]);
  if (!data) return null;
  const live = data.inspection && inspectionLive(data.inspection.state) ? data.inspection : null;
  const run = async (work: () => ReturnType<typeof takeNominationBack>) => {
    const res = await work();
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setData({ ...data, inspection: res.inspection });
  };
  return (
    <section className={clsx(ui.card, "p-5")}>
      <p className={head}>Inspection</p>
      {live ? (
        <div className="mt-1.5">
          <Standing inspection={live} />
          {live.state === "nominated" || live.state === "booked" ? (
            <button
              type="button"
              onClick={() =>
                window.confirm(`Take the nomination back from ${live.inspector}?`) && void run(() => takeNominationBack(shareId))
              }
              className="mt-1.5 text-xs text-muted underline underline-offset-4 hover:text-danger"
            >
              Take it back
            </button>
          ) : null}
        </div>
      ) : data.inspectors.length ? (
        <>
          {data.inspection && <p className="mt-1 text-xs text-muted">{inspectionWords(data.inspection)}.</p>}
          <div className="mt-1.5 flex gap-2">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Connected inspector"
              className={clsx(ui.input, "h-9 flex-1")}
            >
              <option value="">Choose a connected inspector…</option>
              {data.inspectors.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!to}
              onClick={() => void run(() => nominateInspector(shareId, to))}
              className={clsx(ui.primary, "h-9")}
            >
              <ClipboardCheck className="size-4" aria-hidden /> Nominate
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            They see this job read only: the design, the system and every note and photo on the card. Never the customer&apos;s email.
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-ink-2">
          No inspectors connected yet.{" "}
          <Link href="/design/connections" className={ui.link}>
            Connect with the inspector you use
          </Link>
          .
        </p>
      )}
      {problem && <p className="mt-1.5 text-xs text-warning">{problem}</p>}
    </section>
  );
}

/** On the retailer's job card: the inspection the installer nominated, as it stands. Nothing when there is none. */
export function InspectionStatus({ jobId }: { jobId: string }) {
  const [inspection, setInspection] = useState<InspectionView | null>(null);
  useEffect(() => {
    void jobInspection(jobId).then((res) => res.ok && setInspection(res.inspection));
  }, [jobId]);
  if (!inspection) return null;
  return (
    <div>
      <p className={head}>Inspection</p>
      <div className="mt-1">
        <Standing inspection={inspection} />
        <p className="mt-0.5 text-xs text-muted">Nominated by {inspection.installer}</p>
      </div>
    </div>
  );
}

/** An inspector's Inspections: jobs installers have nominated it for, those to book first. */
export function InspectionsPage() {
  const [list, setList] = useState<InspectionLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadInspections().then((res) => (res.ok ? setList(res.inspections) : setProblem(res.message)));
  }, []);
  return (
    <div className={clsx(ui.page, "space-y-6")}>
      <PageHead title="Inspections" />
      <p className="-mt-3 max-w-2xl text-sm text-ink-2">
        The jobs installers you&apos;re connected with nominate you for. Open one to see its design and their photos, then book it, pass it,
        or note the defects with your certificate.
      </p>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!list ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !list.length ? (
        <div className={clsx(ui.card, "max-w-2xl p-6")}>
          <p className="text-[15px] text-ink">No inspections yet.</p>
          <p className="mt-1 text-sm text-ink-2">
            When an installer you&apos;re connected with nominates you for a job, it lands here.{" "}
            <Link href="/design/connections" className={ui.link}>
              Connect with the installers you inspect for
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className={clsx(ui.card, "divide-y divide-line px-5")}>
          {list.map((i) => {
            const on = i.on ?? i.installDate;
            return (
              <li key={i.id}>
                <Link href={`/design/inspections/${encodeURIComponent(i.id)}`} className="group flex flex-wrap items-center gap-3 py-3">
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-2 py-1.5 text-center">
                    <span className="text-[10px] uppercase tracking-wide text-muted">{on ? weekday(on) : "Day"}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-ink">{on ? dayMonth(on) : "TBC"}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-[15px] font-medium text-ink">
                      <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden /> {i.suburb}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {i.system} · nominated by {i.from}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium",
                      i.state === "nominated" ? "bg-sun-line text-white" : "bg-surface-2 text-ink-2",
                    )}
                  >
                    {i.state === "nominated" ? "To book" : OUTCOME_WORDS[i.state as Outcome]}
                  </span>
                  <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** One inspection: the job read only, and where it stands with the inspector's notes and certificate. */
export function InspectionPage({ id }: { id: string }) {
  const [got, setGot] = useState<{ card: JobCardView; inspection: InspectionView } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadInspection(id).then((res) => (res.ok ? setGot(res) : setProblem(res.message)));
  }, [id]);
  return (
    <div className={clsx(ui.page, "space-y-4")}>
      <Link href="/design/inspections" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Inspections
      </Link>
      {problem && !got ? (
        <p className={clsx(ui.card, "p-6 text-sm text-ink-2")}>{problem}</p>
      ) : !got ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div>
            <p className={head}>
              Inspection for {got.card.business} · nominated by {got.inspection.installer}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {got.card.job.address.split(",")[0] || got.card.job.title}
            </h1>
          </div>
          <ReadOnlyJobCard
            card={got.card}
            picture={got.card.roof ? inspectionRoofHref(id) : null}
            fileHref={(fileId) => inspectionFileHref(id, fileId)}
            aside={
              <div className="sm:col-span-2">
                <Outcome
                  id={id}
                  inspection={got.inspection}
                  onSaved={(next) => {
                    setGot(next);
                    window.dispatchEvent(new Event("renuabl:inspections"));
                  }}
                />
              </div>
            }
          />
        </>
      )}
    </div>
  );
}

/** The inspector's record: booked for a day, passed, or defects found, with notes and the certificate. */
function Outcome({
  id,
  inspection,
  onSaved,
}: {
  id: string;
  inspection: InspectionView;
  onSaved: (next: { card: JobCardView; inspection: InspectionView }) => void;
}) {
  const [state, setState] = useState<Outcome>(inspection.state === "nominated" ? "booked" : (inspection.state as Outcome));
  const [on, setOn] = useState(inspection.on ?? "");
  const [notes, setNotes] = useState(inspection.notes);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  if (declined) return <p className="text-sm text-ink-2">Declined. The installer can nominate someone else.</p>;
  return (
    <div className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <p className={head}>Your inspection</p>
      <div className="mt-1">
        <Standing inspection={inspection} />
      </div>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await recordInspection(id, { state, on, notes }, file);
          setBusy(false);
          if (!res.ok) return setProblem(res.message);
          setProblem(null);
          setFile(null);
          onSaved(res);
        }}
      >
        <div role="radiogroup" aria-label="Where it stands" className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={state === o}
              onClick={() => setState(o)}
              className={clsx(
                "h-8 rounded-full px-3 text-[13px]",
                state === o ? "bg-ink text-canvas" : "bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              {OUTCOME_WORDS[o]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Inspection day{state === "booked" ? "" : " (optional)"}
            <input type="date" value={on} onChange={(e) => setOn(e.target.value)} className={clsx(ui.input, "mt-1")} />
          </label>
          <label className={ui.label}>
            Certificate (PDF or photo)
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
          </label>
        </div>
        <label className={ui.label}>
          Notes{state === "defects" ? ": what needs putting right" : " (optional)"}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            className={clsx(ui.input, "mt-1 min-h-20 py-2")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={ui.primary}>
            {busy ? "Saving…" : "Save"}
          </button>
          {inspection.state === "nominated" && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Decline this inspection? The installer can nominate someone else.")) return;
                const res = await declineInspection(id);
                if (res.ok) setDeclined(true);
                else setProblem(res.message);
              }}
              className="text-xs text-muted underline underline-offset-4 hover:text-danger"
            >
              Decline
            </button>
          )}
        </div>
        <p className="text-xs text-muted">The installer and the retailer see where it stands, your notes and the certificate.</p>
        {problem && <p className="text-sm text-warning">{problem}</p>}
      </form>
    </div>
  );
}
