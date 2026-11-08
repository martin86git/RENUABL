"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { FileText, ImagePlus, List, ListOrdered, Omega, Paperclip, Plus, X } from "lucide-react";
import clsx from "clsx";
import {
  EMAIL_SYMBOLS,
  FILE_ACCEPT,
  PICTURE_ACCEPT,
  atCaret,
  emailFileName,
  emailFilesProblem,
  fileSize,
  isPicture,
  listEnter,
  pictureBudget,
  withList,
  type ListKind,
} from "@/lib/domain/design/email-compose";

/**
 * The parts every email composer shares (a deal's Email tab, sending a proposal): bullets, numbering and symbols on
 * the words, and pictures and files to send with it. The words stay plain text with "• " and "1. " in them; the
 * server makes real lists of them for the email (domain/design/email-compose.ts).
 */

interface Item {
  id: number;
  /** As chosen: pictures are shrunk again from this whenever the budget changes. */
  original: File;
  /** What is sent. */
  file: File;
  preview?: string;
}

export interface EmailFiles {
  files: File[];
  items: readonly Item[];
  add: (files: readonly File[]) => void;
  remove: (id: number) => void;
  clear: () => void;
  /** Why these can't be sent (in red under the box), or null. */
  problem: string | null;
  /** Pictures still being made smaller. */
  busy: boolean;
  onPaste: (e: ClipboardEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

const JPEG = "image/jpeg";

/** A picture redrawn as JPEG, a little smaller each time, until it fits its share of the 4 MB. GIFs are left as they are. */
async function shrink(file: File, budget: number): Promise<File> {
  if (!isPicture(file.type) || file.type === "image/gif" || file.size <= budget) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  let side = Math.min(2400, Math.max(bitmap.width, bitmap.height));
  let best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const scale = side / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    // JPEG has no transparency: a screenshot's clear parts go white, not black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, JPEG, 0.82));
    if (blob) best = blob;
    if (!blob || blob.size <= budget || side <= 480) break;
    side = Math.round(side * 0.75);
  }
  bitmap.close();
  return best && best.size < file.size ? new File([best], emailFileName(file.name, JPEG), { type: JPEG }) : file;
}

/** The pictures and files going with an email: chosen, pasted or dropped, shrunk to fit, shown as chips. */
export function useEmailFiles(): EmailFiles {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const next = useRef(1);
  const round = useRef(0);
  const live = useRef<Item[]>([]);

  // Each change shares the budget again, so every picture is shrunk afresh from what was chosen.
  const refit = useCallback(async (list: Item[]) => {
    live.current = list;
    setItems(list);
    const pictures = list.filter((i) => isPicture(i.original.type) && i.original.type !== "image/gif");
    const mine = ++round.current;
    if (!pictures.length) return setBusy(false);
    const others = list.filter((i) => !pictures.includes(i)).reduce((a, i) => a + i.file.size, 0);
    const budget = pictureBudget(others, pictures.length);
    setBusy(true);
    const shrunk = await Promise.all(list.map(async (i) => (pictures.includes(i) ? { ...i, file: await shrink(i.original, budget) } : i)));
    if (mine !== round.current) return;
    live.current = shrunk;
    setItems(shrunk);
    setBusy(false);
  }, []);

  const add = useCallback(
    (files: readonly File[]) => {
      let pictures = live.current.filter((i) => isPicture(i.file.type)).length;
      const added = files.map((f) => {
        if (isPicture(f.type)) pictures += 1;
        const named = new File([f], emailFileName(f.name, f.type, pictures), { type: f.type });
        return { id: next.current++, original: named, file: named, preview: isPicture(f.type) ? URL.createObjectURL(f) : undefined };
      });
      void refit([...live.current, ...added]);
    },
    [refit],
  );
  const remove = useCallback(
    (id: number) => {
      const gone = live.current.find((i) => i.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      void refit(live.current.filter((i) => i.id !== id));
    },
    [refit],
  );
  const clear = useCallback(() => {
    for (const i of live.current) if (i.preview) URL.revokeObjectURL(i.preview);
    round.current++;
    live.current = [];
    setItems([]);
    setBusy(false);
  }, []);
  // The previews go with the box.
  useEffect(() => {
    return () => {
      for (const i of live.current) if (i.preview) URL.revokeObjectURL(i.preview);
    };
  }, []);

  const files = items.map((i) => i.file);
  return {
    files,
    items,
    add,
    remove,
    clear,
    problem: emailFilesProblem(files),
    busy,
    // Only a paste of files is taken over: ordinary text pastes as it always does.
    onPaste: (e) => {
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (!pasted.length) return;
      e.preventDefault();
      add(pasted);
    },
    onDragOver: (e) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
    },
    onDrop: (e) => {
      const dropped = Array.from(e.dataTransfer?.files ?? []);
      if (!dropped.length) return;
      e.preventDefault();
      add(dropped);
    },
  };
}

/** Puts the caret or selection back once the new text is on screen. */
function placeCaret(el: HTMLTextAreaElement | null, start: number, end = start) {
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
  });
}

/** For the box's onKeyDown: Enter on a list line carries the list on, or ends it on an empty item. */
export function listKey(e: KeyboardEvent<HTMLTextAreaElement>, setText: (text: string) => void) {
  if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
  const el = e.currentTarget;
  if (el.selectionStart !== el.selectionEnd) return;
  const done = listEnter(el.value, el.selectionStart);
  if (!done) return;
  e.preventDefault();
  setText(done.text);
  placeCaret(el, done.caret);
}

const tool =
  "flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink disabled:text-muted disabled:hover:bg-transparent";

/** Bullets, Numbering, symbols, then Add a picture and Attach a file, working on the box through its ref. */
export function EmailFormatBar(props: {
  area: RefObject<HTMLTextAreaElement | null>;
  text: string;
  setText: (text: string) => void;
  files: EmailFiles;
  disabled?: boolean;
  className?: string;
  /** One "+" that takes pictures and files alike, first in the bar, in place of the two buttons (the inbox's Compose). */
  plus?: boolean;
}) {
  const { area, text, setText, files, disabled, plus } = props;
  const [symbols, setSymbols] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const pictureInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const anyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!symbols) return;
    const away = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node)) setSymbols(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSymbols(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [symbols]);

  const selection = () => {
    const el = area.current;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : { start: text.length, end: text.length };
  };
  const list = (kind: ListKind) => {
    const { start, end } = selection();
    const done = withList(text, start, end, kind);
    setText(done.text);
    placeCaret(area.current, done.start, done.end);
  };
  const symbol = (s: string) => {
    const { start, end } = selection();
    const done = atCaret(text, start, end, s);
    setText(done.text);
    setSymbols(false);
    placeCaret(area.current, done.caret);
  };
  const chosen = (input: HTMLInputElement) => {
    files.add(Array.from(input.files ?? []));
    input.value = "";
  };

  return (
    <div className={clsx("flex flex-wrap items-center gap-0.5", props.className)} role="toolbar" aria-label="Format the email">
      {plus && (
        <>
          <button
            type="button"
            className={tool}
            title="Add pictures or files"
            aria-label="Add pictures or files"
            disabled={disabled}
            onClick={() => anyInput.current?.click()}
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <input
            ref={anyInput}
            type="file"
            accept={`${PICTURE_ACCEPT},${FILE_ACCEPT}`}
            multiple
            hidden
            onChange={(e) => chosen(e.currentTarget)}
          />
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        </>
      )}
      {/* mousedown kept from the box, so its selection is still there when the button acts. */}
      <button
        type="button"
        className={tool}
        title="Bullet points"
        aria-label="Bullet points"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => list("bullets")}
      >
        <List className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={tool}
        title="Numbering"
        aria-label="Numbering"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => list("numbers")}
      >
        <ListOrdered className="size-4" aria-hidden />
      </button>
      <div className="relative" ref={pop}>
        <button
          type="button"
          className={clsx(tool, symbols && "bg-surface-2 text-ink")}
          title="Symbols and emoji"
          aria-label="Symbols and emoji"
          aria-expanded={symbols}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setSymbols((v) => !v)}
        >
          <Omega className="size-4" aria-hidden />
        </button>
        {symbols && (
          <div
            role="dialog"
            aria-label="Symbols and emoji"
            className="absolute bottom-full left-0 z-30 mb-1 grid w-64 grid-cols-8 gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-lg"
          >
            {EMAIL_SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                className="flex size-7 items-center justify-center rounded text-[15px] text-ink hover:bg-surface-2"
                aria-label={`Put in ${s}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => symbol(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {!plus && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
      <button
        type="button"
        className={clsx(tool, plus && "hidden")}
        title="Add a picture"
        aria-label="Add a picture"
        disabled={disabled}
        onClick={() => pictureInput.current?.click()}
      >
        <ImagePlus className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={clsx(tool, plus && "hidden")}
        title="Attach a file"
        aria-label="Attach a file"
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
      >
        <Paperclip className="size-4" aria-hidden />
      </button>
      <input ref={pictureInput} type="file" accept={PICTURE_ACCEPT} multiple hidden onChange={(e) => chosen(e.currentTarget)} />
      <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden onChange={(e) => chosen(e.currentTarget)} />
    </div>
  );
}

/** The pictures and files under the box, each with a cross to take it off, and what's wrong in red. */
export function EmailFileChips({ files }: { files: EmailFiles }) {
  if (!files.items.length) return null;
  return (
    <div className="mt-2">
      <ul className="flex flex-wrap gap-1.5">
        {files.items.map((i) => (
          <li key={i.id} className="flex h-10 max-w-60 items-center gap-2 rounded-lg border border-line bg-surface pl-1 pr-1 text-xs">
            {i.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen picture
              <img src={i.preview} alt="" className="size-8 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-2 text-muted">
                <FileText className="size-4" aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-ink">{i.file.name}</span>
              <span className="block tabular-nums text-muted">{fileSize(i.file.size)}</span>
            </span>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              aria-label={`Take off ${i.file.name}`}
              onClick={() => files.remove(i.id)}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {files.busy ? (
        <p className="mt-1.5 text-xs text-muted">Making the pictures smaller…</p>
      ) : (
        files.problem && (
          <p className="mt-1.5 text-xs text-danger" role="alert">
            {files.problem}
          </p>
        )
      )}
    </div>
  );
}
