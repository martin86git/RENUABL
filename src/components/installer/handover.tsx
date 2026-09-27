"use client";

import { Camera, CircleCheck, Circle, ExternalLink, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import {
  HANDOVER_PHOTOS,
  MAX_ARRAYS,
  batteryModuleCount,
  handoverProgress,
  parseSerials,
  type EvidenceId,
  type HandoverPhoto,
  type HandoverRecord,
} from "@/lib/domain/handover";
import type { Job } from "@/lib/domain/types";
import { addHandoverPhoto, loadHandover, photoSrc, removeHandoverPhoto, saveHandover, type Backend } from "@/lib/services/handover";

function Thumb({ record, photo, onRemove }: { record: HandoverRecord; photo: HandoverPhoto; onRemove?: () => void }) {
  const recordKey = record.key;
  const { id: photoId, path } = photo;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void photoSrc(recordKey, photoId, path).then((s) => {
      url = s;
      if (live) setSrc(s);
    });
    return () => {
      live = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [recordKey, photoId, path]);
  return (
    <span className="relative block aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- private photos from our own route or this device
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

function PhotoSlot({
  label,
  detail,
  photos,
  record,
  busy,
  locked,
  onAdd,
  onRemove,
}: {
  label: string;
  detail: string;
  photos: HandoverPhoto[];
  record: HandoverRecord;
  busy: boolean;
  locked: boolean;
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = photos.length > 0;
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        {done ? (
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive" strokeWidth={1.8} aria-label="Done" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} aria-label="Needed" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink">{label}</p>
          <p className="text-[12.5px] leading-snug text-muted">{detail}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 pl-8 sm:grid-cols-4">
        {photos.map((p) => (
          <Thumb key={p.id} record={record} photo={p} onRemove={locked ? undefined : () => onRemove(p.id)} />
        ))}
        {!locked && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line-strong text-muted hover:text-ink disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1 text-[13px]">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
              {busy ? "Saving" : "Add photo"}
            </span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </li>
  );
}

function SerialList({
  label,
  expected,
  value,
  locked,
  onChange,
}: {
  label: string;
  expected: number;
  value: string[];
  locked: boolean;
  onChange: (serials: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  const parsed = parseSerials(text);
  const count = parsed.serials.length;
  return (
    <label className="block py-4">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-ink">{label}</span>
        <span className={cn("text-[13px] tabular-nums", count === expected ? "text-positive" : "text-muted")}>
          {count} of {expected}
        </span>
      </span>
      <span className="mt-0.5 block text-[12.5px] text-muted">One per line. Paste them, or scan each barcode into the box.</span>
      <textarea
        value={text}
        readOnly={locked}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(parsed.serials)}
        rows={Math.min(8, Math.max(3, expected))}
        spellCheck={false}
        autoCapitalize="characters"
        className="mt-2 w-full rounded-xl bg-canvas px-4 py-3 font-mono text-[14px] text-ink outline-none ring-1 ring-line focus:ring-ink/40"
      />
      {(parsed.duplicates.length > 0 || parsed.invalid.length > 0 || count > expected) && (
        <span className="mt-1.5 block text-[12.5px] text-warning">
          {[
            parsed.duplicates.length ? `Listed twice: ${parsed.duplicates.join(", ")}` : "",
            parsed.invalid.length ? `Not a serial: ${parsed.invalid.slice(0, 3).join(", ")}` : "",
            count > expected ? `That's more than the ${expected} on this job` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </label>
  );
}

/**
 * The handover: every photo and serial number the job needs, captured on site.
 * It becomes the customer's installation record in My RENUABL.
 */
export function Handover({ job, installer, installedOn }: { job: Job; installer: string; installedOn: string }) {
  const [record, setRecord] = useState<HandoverRecord | null>(null);
  const [backend, setBackend] = useState<Backend>("server");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const modules = batteryModuleCount(job.system);

  useEffect(() => {
    let live = true;
    void loadHandover(job.recordKey, job.reference).then((r) => {
      if (!live) return;
      setRecord(r.record);
      setBackend(r.backend);
    });
    return () => {
      live = false;
    };
  }, [job.recordKey, job.reference]);

  async function save(next: HandoverRecord, opts: { submit?: boolean } = {}) {
    setRecord(next);
    setProblem(null);
    const summary = { address: `${job.address.line}, ${job.address.suburb}`, system: job.packageName, installer, installedOn };
    try {
      setRecord(await saveHandover(next, backend, { ...opts, summary }));
    } catch {
      setProblem("That didn't save. Check your signal and try again.");
    }
  }

  if (!record) {
    return (
      <p className="flex items-center gap-2 py-6 text-[14px] text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the handover
      </p>
    );
  }

  const progress = handoverProgress(record, job.system);
  const done = progress.items.filter((i) => i.done).length;
  const locked = Boolean(record.submittedAt);

  async function add(category: EvidenceId, array: number | undefined, files: FileList) {
    const slot = `${category}-${array ?? 0}`;
    setBusy(slot);
    setProblem(null);
    let current = record!;
    try {
      for (const file of Array.from(files).slice(0, 6)) current = await addHandoverPhoto(current, backend, category, array, file);
      setRecord(current);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That photo didn't upload. Try again.");
    }
    setBusy(null);
  }

  async function remove(id: string) {
    try {
      setRecord(await removeHandoverPhoto(record!, backend, id));
    } catch {
      setProblem("Couldn't remove that photo. Try again.");
    }
  }

  const photosFor = (category: EvidenceId, array?: number) =>
    record.photos.filter((p) => p.category === category && (array === undefined || p.array === array));

  return (
    <div>
      <div className="rounded-2xl bg-surface-2 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] text-ink">{locked ? "Handover submitted" : "Handover"}</p>
          <p className="text-[13px] tabular-nums text-muted">
            {done} of {progress.items.length} done
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-positive transition-all" style={{ width: `${(done / progress.items.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-muted">
          {locked
            ? `Submitted ${new Date(record.submittedAt!).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. It's now the customer's installation record.`
            : "Everything here becomes the customer's installation record in My RENUABL, so whoever services the system later has its history."}
        </p>
        {backend === "device" && (
          <p className="mt-2 text-[12.5px] leading-snug text-warning">
            RENUABL storage isn&apos;t set up yet, so this handover is saved on this device only.
          </p>
        )}
      </div>

      {!locked && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <span className="text-[14px] text-ink-2">Arrays installed</span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              aria-label="One fewer array"
              disabled={record.arrays <= 1}
              onClick={() => void save({ ...record, arrays: record.arrays - 1 })}
              className="grid h-10 w-10 place-items-center rounded-full border border-line-strong disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-[17px] tabular-nums">{record.arrays}</span>
            <button
              type="button"
              aria-label="One more array"
              disabled={record.arrays >= MAX_ARRAYS}
              onClick={() => void save({ ...record, arrays: record.arrays + 1 })}
              className="grid h-10 w-10 place-items-center rounded-full border border-line-strong disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      <p className="mt-6 text-[13px] text-muted">Photos</p>
      <ul className="divide-y divide-line">
        {HANDOVER_PHOTOS.flatMap((slot) =>
          slot.id === "array"
            ? Array.from({ length: record.arrays }, (_, i) => (
                <PhotoSlot
                  key={`array-${i + 1}`}
                  label={`Array ${i + 1} installed`}
                  detail={slot.detail}
                  photos={photosFor("array", i + 1)}
                  record={record}
                  busy={busy === `array-${i + 1}`}
                  locked={locked}
                  onAdd={(f) => void add("array", i + 1, f)}
                  onRemove={(id) => void remove(id)}
                />
              ))
            : [
                <PhotoSlot
                  key={slot.id}
                  label={slot.label}
                  detail={slot.detail}
                  photos={photosFor(slot.id)}
                  record={record}
                  busy={busy === `${slot.id}-0`}
                  locked={locked}
                  onAdd={(f) => void add(slot.id, undefined, f)}
                  onRemove={(id) => void remove(id)}
                />,
              ],
        )}
      </ul>

      <p className="mt-6 text-[13px] text-muted">Serial numbers</p>
      <div className="divide-y divide-line">
        {job.system.panelCount > 0 && (
          <SerialList
            label="Panels"
            expected={job.system.panelCount}
            value={record.serials.panels}
            locked={locked}
            onChange={(panels) => void save({ ...record, serials: { ...record.serials, panels } })}
          />
        )}
        <label className="block py-4">
          <span className="text-[15px] text-ink">Inverter</span>
          <input
            defaultValue={record.serials.inverter}
            readOnly={locked}
            autoCapitalize="characters"
            spellCheck={false}
            onBlur={(e) => void save({ ...record, serials: { ...record.serials, inverter: e.target.value.trim().toUpperCase() } })}
            className="mt-2 h-12 w-full rounded-xl bg-canvas px-4 font-mono text-[15px] text-ink outline-none ring-1 ring-line focus:ring-ink/40"
          />
        </label>
        {modules > 0 && (
          <SerialList
            label="Battery modules"
            expected={modules}
            value={record.serials.batteries}
            locked={locked}
            onChange={(batteries) => void save({ ...record, serials: { ...record.serials, batteries } })}
          />
        )}
      </div>

      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}

      {!locked ? (
        <div className="mt-6">
          <Button size="lg" className="w-full" disabled={!progress.complete} onClick={() => void save(record, { submit: true })}>
            Submit handover
          </Button>
          {!progress.complete && (
            <p className="mt-2 text-[12.5px] text-muted">
              Still needed:{" "}
              {progress.items
                .filter((i) => !i.done)
                .map((i) => i.label)
                .join(", ")}
              .
            </p>
          )}
        </div>
      ) : (
        <Link
          href={`/my/installation?record=${record.key}`}
          className="mt-6 inline-flex items-center gap-2 text-[14px] text-ink underline underline-offset-4"
        >
          View the customer&apos;s installation record <ExternalLink className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
