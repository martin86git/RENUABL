"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { MAX_FILE_CHARS, MAX_FILES, SOL_FILE_TYPES, type SolFile } from "@/lib/domain/design/sol";

function base64Of(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

/** Files read for Sol (base64), or null when one couldn't be read. */
export async function solFilesOf(files: readonly File[]): Promise<SolFile[] | null> {
  try {
    return await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type as SolFile["type"], data: await base64Of(f) })));
  } catch {
    return null;
  }
}

/** The PDFs and pictures put on a message to Sol: up to `MAX_FILES`, and not too big together. */
export function useSolAttach() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState("");
  const add = (list: FileList | null) => {
    setProblem("");
    const picked = Array.from(list ?? []).filter((f) => (SOL_FILE_TYPES as readonly string[]).includes(f.type));
    if (list && picked.length < list.length) setProblem("Sol reads PDFs and pictures (PNG, JPG, WebP, GIF).");
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (next.reduce((n, f) => n + f.size, 0) * 1.37 > MAX_FILE_CHARS) setProblem("Those are too big together: send one at a time.");
    else setFiles(next);
  };
  const clear = () => {
    setFiles([]);
    setProblem("");
  };
  return { files, problem, setProblem, add, clear, remove: (i: number) => setFiles((f) => f.filter((_, k) => k !== i)) };
}

export type SolAttach = ReturnType<typeof useSolAttach>;

/** The paperclip: a PDF (a bill, a datasheet) or a picture to put on the message. */
export function AttachButton({ attach, size = "size-9" }: { attach: SolAttach; size?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const full = attach.files.length >= MAX_FILES;
  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        accept={SOL_FILE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          attach.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => picker.current?.click()}
        disabled={full}
        aria-label="Attach a PDF or a picture"
        title="Attach a PDF (an electricity bill, a datasheet) or a picture"
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-canvas hover:text-ink disabled:text-muted`}
      >
        <Paperclip className="size-[18px]" aria-hidden />
      </button>
    </>
  );
}

/** The files on the message, each with a cross to take it off, and any problem with them. */
export function AttachedFiles({ attach }: { attach: SolAttach }) {
  if (!attach.files.length && !attach.problem) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1 text-xs">
      {attach.files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-canvas px-2 py-1 text-ink-2 ring-1 ring-line"
        >
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{f.name}</span>
          <button
            type="button"
            onClick={() => attach.remove(i)}
            aria-label={`Take off ${f.name}`}
            className="rounded-full p-0.5 hover:text-ink"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {attach.problem && <span className="text-danger">{attach.problem}</span>}
    </div>
  );
}
