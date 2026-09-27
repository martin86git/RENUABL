"use client";

import { FileText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CaptureButtons } from "@/components/ui/capture";
import { Badge } from "@/components/ui/primitives";
import { DOCUMENT_UPLOAD, documentFiles, handoverProgress, type HandoverDocument, type HandoverRecord } from "@/lib/domain/handover";
import type { Job, JobDocument } from "@/lib/domain/types";
import { addHandoverDocument, documentSrc, loadHandover, removeHandoverDocument, type Backend } from "@/lib/services/handover";

const TONE = { ready: "positive", submitted: "info", required: "warning" } as const;

function FileLink({ record, file, onRemove }: { record: HandoverRecord; file: HandoverDocument; onRemove: () => void }) {
  const [href, setHref] = useState<string | null>(null);
  const recordKey = record.key;
  const { id, path } = file;
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void documentSrc(recordKey, id, path).then((s) => {
      url = s;
      if (live) setHref(s);
    });
    return () => {
      live = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [recordKey, id, path]);
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <a
        href={href ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-ink-2 underline underline-offset-4"
      >
        {file.contentType === "application/pdf"
          ? file.name
          : `Photo · ${new Date(file.uploadedAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`}
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * The job's documents. Required paperwork (e.g. the Certificate of Electrical
 * Safety) can be photographed page by page or uploaded as a PDF from a phone;
 * it's kept with the installation record. Installation photos live in the Handover.
 */
export function JobDocuments({ job, docs }: { job: Job; docs: JobDocument[] }) {
  const [record, setRecord] = useState<HandoverRecord | null>(null);
  const [backend, setBackend] = useState<Backend>("server");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  async function add(doc: JobDocument, files: File[]) {
    const docId = doc.id;
    if (!record) return;
    setBusy(docId);
    setProblem(null);
    let current = record;
    try {
      for (const f of files.slice(0, 10)) {
        if (!(DOCUMENT_UPLOAD.types as readonly string[]).includes(f.type) && !f.type.startsWith("image/")) {
          throw new Error("Send a PDF or a photo.");
        }
        current = await addHandoverDocument(current, backend, { id: docId, label: doc.name }, f);
      }
      setRecord(current);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't upload. Try again.");
    }
    setBusy(null);
  }

  async function remove(id: string) {
    if (!record) return;
    try {
      setRecord(await removeHandoverDocument(record, backend, id));
    } catch {
      setProblem("Couldn't remove that file. Try again.");
    }
  }

  const photosDone = record ? handoverProgress(record, job.system).complete : false;

  return (
    <div>
      <ul className="divide-y divide-line">
        {docs.map((d) => {
          const files = record ? documentFiles(record, d.id) : [];
          const suppliedByPartner = d.status !== "ready" && d.kind !== "photo";
          const status: JobDocument["status"] =
            d.kind === "photo" ? (photosDone ? "submitted" : d.status) : files.length ? "submitted" : d.status;
          const label =
            d.kind === "photo"
              ? photosDone
                ? "In handover"
                : "Add in Handover"
              : status === "submitted"
                ? `Uploaded${files.length > 1 ? ` · ${files.length} pages` : ""}`
                : status === "ready"
                  ? "Ready"
                  : "Required";
          return (
            <li key={d.id} className="py-3">
              <div className="flex min-h-11 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted" />
                <span className="flex-1 text-[15px]">{d.name}</span>
                <Badge tone={TONE[status]}>{label}</Badge>
              </div>
              {suppliedByPartner && record && (
                <div className="mt-2 pl-8">
                  {files.length > 0 && (
                    <ul className="mb-2 space-y-0.5">
                      {files.map((f) => (
                        <FileLink key={f.id} record={record} file={f} onRemove={() => void remove(f.id)} />
                      ))}
                    </ul>
                  )}
                  <CaptureButtons
                    size="sm"
                    multiple
                    busy={busy === d.id}
                    photoLabel={files.length ? "Photo of next page" : "Take a photo"}
                    fileLabel="Upload a PDF"
                    desktopLabel={files.length ? "Add another file" : "Upload a PDF or photo"}
                    onFiles={(f) => void add(d, f)}
                  />
                  <p className="mt-1.5 text-[12px] text-muted">Several pages? Take one photo per page, flat and in good light.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {backend === "device" && docs.some((d) => d.status !== "ready" && d.kind !== "photo") && (
        <p className="mt-2 text-[12px] text-warning">Storage isn&apos;t set up yet, so documents are saved on this device only.</p>
      )}
    </div>
  );
}
