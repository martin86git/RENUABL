"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
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
