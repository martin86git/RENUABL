"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import type { DealClock, DealHeat, DealPulse } from "@/lib/domain/design/deal-heat";
import { TEAM_FILE_ACCEPT, isTeamPicture } from "@/lib/domain/design/team-chat";
import { dealFileHref, deleteDealFile, listDealFiles, uploadDealFiles, type DealFile } from "@/lib/services/deal-pulse";
import { ui } from "./design-shell";

const BAND = {
  green: { bar: "bg-positive", text: "text-positive", ring: "ring-positive/30 bg-positive-soft" },
  amber: { bar: "bg-warning", text: "text-warning", ring: "ring-warning/30 bg-warning-soft" },
  red: { bar: "bg-danger", text: "text-danger", ring: "ring-danger/30 bg-warning-soft" },
  over: { bar: "bg-danger", text: "text-danger", ring: "ring-danger bg-warning-soft" },
} as const;

export const HEAT = {
  hot: { label: "Hot", dot: "bg-danger", ring: "ring-danger/30 bg-warning-soft text-danger" },
  warm: { label: "Warm", dot: "bg-sun-line", ring: "ring-sun-line/40 bg-sun text-sun-ink" },
  cold: { label: "Cold", dot: "bg-muted", ring: "ring-line bg-surface-2 text-ink-2" },
} as const;

/**
 * Beside the customer's name on a deal still being sold (as Primero's): the deal clock, a day a segment counting down
 * the usual days from new lead to signed sale (green, amber, red by thirds), and the deal's temperature, which opens
 * to say why. A reading of what is on the deal, never a forecast.
 */
export function DealPulseBadges({ clock, heat }: { clock: DealClock | null; heat: DealHeat }) {
  const h = HEAT[heat.heat];
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {clock && (
        <div
          className={clsx("inline-flex items-center gap-2 rounded-full px-2.5 py-1 ring-1", BAND[clock.band].ring)}
          title={`Day ${clock.day} since the lead came in. The usual time from new lead to signed sale is ${clock.total} days: green with more than two thirds left, amber with more than a third, then red.`}
        >
          <span className={clsx("text-[12px] font-semibold tabular-nums", BAND[clock.band].text)}>{clock.words}</span>
          <span className="flex gap-[2px]" aria-hidden>
            {Array.from({ length: clock.total }, (_, i) => (
              <span
                key={i}
                className={clsx("h-2.5 w-[2px] rounded-full", i < Math.max(0, clock.left) ? BAND[clock.band].bar : "bg-ink/15")}
              />
            ))}
          </span>
        </div>
      )}
      <div ref={box} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title="How engaged the customer is: press for why"
          className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", h.ring)}
        >
          <span className={clsx("size-2 rounded-full", h.dot)} aria-hidden />
          {h.label}
        </button>
        {open && (
          <div className="absolute left-0 z-30 mt-2 w-72 rounded-2xl bg-surface p-4 text-sm shadow-xl ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Why {h.label.toLowerCase()}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 rounded-full p-1 text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            {heat.reasons.length === 0 && <p className="mt-2 text-ink-2">Nothing on the deal to go on yet.</p>}
            <ul className="mt-2 space-y-1.5">
              {heat.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className={clsx("w-4 shrink-0 font-semibold", r.weight > 0 ? "text-positive" : "text-danger")} aria-hidden>
                    {r.weight > 0 ? "+" : "−"}
                  </span>
                  <span className="text-ink">{r.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Read from the customer&apos;s chat, emails, calls and proposal on this deal, by rule. A guide, not a forecast.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** On a board card: the temperature as a dot, the clock in words, and "Call first" for the top three. */
export function PulseMarks({ pulse }: { pulse: DealPulse | undefined }) {
  if (!pulse) return null;
  const h = HEAT[pulse.heat.heat];
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
      {pulse.rank && <span className="rounded-full bg-sun-line px-1.5 py-0.5 font-semibold text-white">Call first {pulse.rank}</span>}
      <span
        className="inline-flex items-center gap-1 text-ink-2"
        title={pulse.heat.reasons.map((r) => r.text).join("\n") || "Nothing to go on yet"}
      >
        <span className={clsx("size-1.5 rounded-full", h.dot)} aria-hidden />
        {h.label}
      </span>
      <span className={clsx("tabular-nums", BAND[pulse.clock.band].text)}>· {pulse.clock.words}</span>
    </p>
  );
}

/** The deal's Attachments tab: files kept on the deal (bills, photos, signed forms), added by the paperclip or by dropping them. */
export function DealFiles({ jobId }: { jobId: string }) {
  const [files, setFiles] = useState<DealFile[] | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let gone = false;
    void listDealFiles(jobId).then((r) => {
      if (gone) return;
      if (r.ok) setFiles(r.files);
      else setProblem(r.message);
    });
    return () => {
      gone = true;
    };
  }, [jobId]);
  const add = async (list: File[]) => {
    if (!list.length || busy) return;
    setBusy(true);
    const r = await uploadDealFiles(jobId, list);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setProblem("");
    setFiles(r.files);
  };
  const remove = async (f: DealFile) => {
    if (!window.confirm(`Take ${f.name} off this deal?`)) return;
    const r = await deleteDealFile(jobId, f.id);
    if (!r.ok) return setProblem(r.message);
    setFiles((all) => (all ?? []).filter((x) => x.id !== f.id));
  };
  return (
    <div
      className={clsx(ui.card, "p-5", dropping && "ring-2 ring-sun-line")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        void add([...e.dataTransfer.files]);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Bills, photos, signed forms and anything else for this deal. Drop files here, or:</p>
        <input
          ref={picker}
          type="file"
          multiple
          accept={TEAM_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => picker.current?.click()} disabled={busy} className={ui.quiet}>
          <Paperclip className="size-4" aria-hidden /> {busy ? "Adding…" : "Add files"}
        </button>
      </div>
      {problem && <p className="mt-3 text-sm text-danger">{problem}</p>}
      {files === null && !problem && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {files?.length === 0 && <p className="mt-4 text-sm text-muted">Nothing kept on this deal yet.</p>}
      {files && files.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg bg-canvas p-2 pr-3">
              <a href={dealFileHref(jobId, f.id)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                {isTeamPicture(f.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a file kept on the deal, served privately
                  <img src={dealFileHref(jobId, f.id)} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface text-sun-line ring-1 ring-line">
                    <FileText className="size-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {Math.max(1, Math.round(f.size / 1024))} KB · {f.by.split("@")[0]} ·{" "}
                    {new Date(f.at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
              </a>
              <button
                type="button"
                onClick={() => void remove(f)}
                aria-label={`Take ${f.name} off`}
                className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
