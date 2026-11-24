"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { FileText, Paperclip, Plus, X } from "lucide-react";
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

/** Past this a picture is redrawn smaller as a JPEG (a retina screenshot as a PNG is often 3 to 6 MB). */
const PICTURE_MOST = 900_000;
const PICTURE_SIDE = 2000;

/** A picture made small enough to send to Sol; a PDF, a GIF or a small picture is left as it is. */
async function fitPicture(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size <= PICTURE_MOST) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let side = Math.min(PICTURE_SIDE, Math.max(bitmap.width, bitmap.height));
    let best: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      const scale = side / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#fff"; // JPEG has no see-through: a screenshot's clear parts go white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
      if (blob) best = blob;
      if (!blob || blob.size <= PICTURE_MOST || side <= 800) break;
      side = Math.round(side * 0.75);
    }
    bitmap.close();
    if (!best || best.size >= file.size) return file;
    return new File([best], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

let pasted = 0;

/** Files on the clipboard (a screenshot pasted with Ctrl V or ⌘ V), each given a name of its own. */
export function filesFromPaste(e: ClipboardEvent<HTMLElement>): File[] {
  const out: File[] = [];
  for (const item of Array.from(e.clipboardData?.items ?? [])) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (!f) continue;
    const plain = !f.name || /^image\.(png|jpe?g|gif|webp)$/i.test(f.name);
    const ext = (f.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
    out.push(plain && f.type.startsWith("image/") ? new File([f], `screenshot-${++pasted}.${ext}`, { type: f.type }) : f);
  }
  return out;
}

/**
 * Checks files for Sol (PDFs and pictures only, up to `MAX_FILES`, not too big together), large pictures made smaller.
 * Answers the files to keep, or a problem to say.
 */
export async function fitForSol(have: readonly File[], list: readonly File[]): Promise<{ files: File[]; problem: string }> {
  const picked = list.filter((f) => (SOL_FILE_TYPES as readonly string[]).includes(f.type));
  let problem = picked.length < list.length ? "Sol reads PDFs and pictures (PNG, JPG, WebP, GIF)." : "";
  const fitted = await Promise.all(picked.map(fitPicture));
  const next = [...have, ...fitted].slice(0, MAX_FILES);
  if (next.reduce((n, f) => n + f.size, 0) * 1.37 > MAX_FILE_CHARS)
    return { files: [...have], problem: "Those are too big together: send one at a time." };
  if (have.length + fitted.length > MAX_FILES) problem = `Sol takes up to ${MAX_FILES} files on a message.`;
  return { files: next, problem };
}

/** The PDFs and pictures put on a message to Sol: chosen or pasted, up to `MAX_FILES`, and not too big together. */
export function useSolAttach() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState("");
  const live = useRef<File[]>([]);
  useEffect(() => {
    live.current = files;
  }, [files]);
  const add = async (list: FileList | readonly File[] | null) => {
    setProblem("");
    const r = await fitForSol(live.current, Array.from(list ?? []));
    live.current = r.files;
    setFiles(r.files);
    setProblem(r.problem);
  };
  /** A paste with a file in it attaches it; a paste of words carries on as usual. */
  const onPaste = (e: ClipboardEvent<HTMLElement>) => {
    const got = filesFromPaste(e);
    if (!got.length) return;
    e.preventDefault();
    void add(got);
  };
  const clear = () => {
    setFiles([]);
    setProblem("");
  };
  return { files, problem, setProblem, add, onPaste, clear, remove: (i: number) => setFiles((f) => f.filter((_, k) => k !== i)) };
}

export type SolAttach = ReturnType<typeof useSolAttach>;

/** The paperclip (or a +, as Claude Code's box has): a PDF (a bill, a datasheet) or a picture to put on the message. */
export function AttachButton({ attach, size = "size-9", plus = false }: { attach: SolAttach; size?: string; plus?: boolean }) {
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
          void attach.add(Array.from(e.target.files ?? []));
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
        {plus ? <Plus className="size-[18px]" aria-hidden /> : <Paperclip className="size-[18px]" aria-hidden />}
      </button>
    </>
  );
}

/** A picture's preview address while it is on the box, let go once it comes off. */
function usePreview(file: File): string | null {
  const url = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

function FileTile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = usePreview(file);
  return (
    <span className="group relative inline-flex shrink-0" title={file.name}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of a pasted picture, never from the web
        <img src={url} alt={file.name} className="size-16 rounded-xl object-cover ring-1 ring-line" />
      ) : (
        <span className="flex h-16 w-36 items-center gap-2 rounded-xl bg-canvas px-2.5 text-xs text-ink ring-1 ring-line">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sun-line">
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{file.name}</span>
            <span className="block text-[10px] uppercase tracking-[0.1em] text-muted">{file.type.split("/")[1] ?? "file"}</span>
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Take off ${file.name}`}
        className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-ink text-white shadow ring-2 ring-surface transition hover:bg-ink/80"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/**
 * The files on a message to Sol, shown inside the box as Claude's box shows them (24 Nov 2026, Martin): a picture as
 * its own small preview, a PDF as a tile with its name, each with a cross on its corner; then any problem with them.
 */
export function FileTiles({
  files,
  problem,
  onRemove,
  className = "",
}: {
  files: readonly File[];
  problem?: string;
  onRemove: (i: number) => void;
  className?: string;
}) {
  if (!files.length && !problem) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2.5 pt-1.5 ${className}`}>
      {files.map((f, i) => (
        <FileTile key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => onRemove(i)} />
      ))}
      {problem && <span className="text-xs text-danger">{problem}</span>}
    </div>
  );
}

/** The files on the message, each with a cross to take it off, and any problem with them. */
export function AttachedFiles({ attach }: { attach: SolAttach }) {
  return <FileTiles files={attach.files} problem={attach.problem} onRemove={attach.remove} className="pb-1.5 pr-2" />;
}
