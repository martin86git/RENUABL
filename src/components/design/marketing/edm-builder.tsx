"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  Heading,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Minus,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import {
  EDM_BLOCK_KINDS,
  EDM_BLOCK_WORDS,
  EDM_LIMITS,
  EMPTY_TILE,
  MERGE_FIELDS,
  TILE_COLUMNS,
  cleanColumns,
  cleanLink,
  moveBlock,
  newBlock,
  renderEdm,
  type EdmBlock,
  type EdmBlockKind,
  type EdmBrand,
  type EdmContent,
  type EdmSender,
  type EdmTile,
} from "@/lib/domain/marketing/edm";
import { EDM_SOL_LIMITS, claimsToCheck, type EdmSolPart } from "@/lib/domain/marketing/edm-sol";
import { uploadMarketingImage, writeWithSol } from "@/lib/services/marketing";
import { SolAsk, type SolAskResult } from "./edm-sol-ask";
import { SolIcon } from "../sol-icon";

export const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-ink/40";
const ICONS: Record<EdmBlockKind, typeof Heading> = {
  heading: Heading,
  text: Type,
  image: ImagePlus,
  tiles: LayoutGrid,
  button: MousePointerClick,
  divider: Minus,
};

/** A change to one block: its new fields, or a function of the block as it stands when the change lands. */
type BlockPatch = Partial<EdmBlock> | ((b: EdmBlock) => Partial<EdmBlock>);

/** The email as a reader sees it, with a sample name and company, nothing tracked. */
export function EdmPreview({
  content,
  brand,
  sender,
  phone = false,
}: {
  content: EdmContent;
  brand: EdmBrand;
  sender: EdmSender;
  phone?: boolean;
}) {
  const html = useMemo(
    () =>
      renderEdm(
        content,
        brand,
        sender,
        { firstName: "Sam", company: "Sunrise Solar" },
        {
          click: (_i, url) => url,
          pixel: null,
          unsubscribe: "#",
          // The whole address: a sandboxed frame doesn't take its page's address, so "/api/…" alone loads nothing.
          image: (id) => `${typeof window === "undefined" ? "" : window.location.origin}/api/m/i/${id}`,
        },
      ).html,
    [content, brand, sender],
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="border-b border-line bg-surface px-4 py-2.5 text-[12px]">
        <p className="truncate font-medium text-ink">{brand.fromName || sender.name}</p>
        <p className="truncate text-ink-2">{content.subject || "No subject yet"}</p>
        {content.preview && <p className="truncate text-muted">{content.preview}</p>}
      </div>
      <iframe
        title="Email preview"
        // Still no scripts, forms or pop-ups: only "same origin", without which the frame loads none of its pictures.
        sandbox="allow-same-origin"
        srcDoc={html}
        className={cn("mx-auto block h-[640px] w-full bg-[#f4f4f5]", phone && "max-w-[390px]")}
      />
    </div>
  );
}

/** Blocks the staff member puts together: a heading, words, a picture, a button, a divider; the footer is fixed. */
export function EdmBuilder({
  content,
  brand,
  sender,
  onChange,
  readOnly = false,
}: {
  content: EdmContent;
  brand: EdmBrand;
  sender: EdmSender;
  onChange: (c: EdmContent) => void;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"builder" | "preview">(readOnly ? "preview" : "builder");
  const [phone, setPhone] = useState(false);
  const set = (patch: Partial<EdmContent>) => onChange({ ...content, ...patch });
  // The email as it stands now, for changes that land after a wait (a picture uploading): two pictures going into two
  // tiles at once each change the latest email, not the one on screen when their upload began.
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  }, [content]);
  const setBlock = (id: string, patch: BlockPatch) => {
    const now = latest.current;
    const next = {
      ...now,
      blocks: now.blocks.map((b) => (b.id === id ? { ...b, ...(typeof patch === "function" ? patch(b) : patch) } : b)),
    };
    latest.current = next;
    onChange(next);
  };

  // Sol writing the email (edm-sol.ts): from the brief, one part or all four; the last fill can be undone.
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<EdmContent | null>(null);
  const [solMsg, setSolMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Which field's Sol box is open (its block's id, else the part): what to change, then options to choose from.
  const [asking, setAsking] = useState<string | null>(null);
  const draftFor = (blockId?: string) => {
    const target = blockId ? content.blocks.find((b) => b.id === blockId) : undefined;
    const firstOf = (kind: "heading" | "text") => content.blocks.find((b) => b.kind === kind);
    return {
      target,
      draft: {
        subject: content.subject,
        preview: content.preview,
        heading: (target?.kind === "heading" ? target : firstOf("heading"))?.text ?? "",
        text: (target?.kind === "text" ? target : firstOf("text"))?.text ?? "",
      },
    };
  };
  const flag = (written: string) => {
    const flagged = claimsToCheck(written);
    setSolMsg({
      ok: !flagged.length,
      text: flagged.length
        ? `Sol wrote it. Check these words before sending, they would need proof: ${flagged.join(", ")}.`
        : "Sol wrote it. Change anything you like; nothing is sent.",
    });
  };
  /** Sol's box on one field: a choice of a one-line part (nothing changes until one is pressed), or the words rewritten. */
  async function ask(part: Exclude<EdmSolPart, "all">, blockId: string | undefined, note: string, avoid: string[]): Promise<SolAskResult> {
    if (part === "text")
      return (await sol(part, blockId, note)) ? { ok: true } : { ok: false, message: "Sol couldn't write that just now." };
    const r = await writeWithSol({ part, brief, draft: draftFor(blockId).draft, note, options: true, avoid });
    return r.ok ? { ok: true, options: r.options ?? [] } : { ok: false, message: r.message };
  }
  function pick(part: Exclude<EdmSolPart, "all">, blockId: string | undefined, line: string) {
    setUndo(content);
    if (blockId) onChange({ ...content, blocks: content.blocks.map((b) => (b.id === blockId ? { ...b, text: line } : b)) });
    else if (part === "subject" || part === "preview") onChange({ ...content, [part]: line });
    flag(line);
  }
  const putBack = () => {
    if (!undo) return;
    onChange(undo);
    setUndo(null);
    setSolMsg(null);
  };
  const solAsk = (part: Exclude<EdmSolPart, "all">, current: string, blockId?: string) =>
    !readOnly && asking === (blockId ?? part) ? (
      <SolAsk
        part={part}
        current={current}
        onAsk={(note, avoid) => ask(part, blockId, note, avoid)}
        onPick={(line) => pick(part, blockId, line)}
        onUndo={putBack}
        onClose={() => setAsking(null)}
      />
    ) : null;

  async function sol(part: EdmSolPart, blockId?: string, note?: string): Promise<boolean> {
    const { target, draft } = draftFor(blockId);
    setBusy(blockId ?? part);
    setSolMsg(null);
    const r = await writeWithSol({ part, brief, draft, note });
    setBusy(null);
    if (!r.ok) return (setSolMsg({ ok: false, text: r.message }), false);
    const before = content;
    let blocks = content.blocks;
    const fill = (kind: "heading" | "text", words: string | undefined) => {
      if (words === undefined) return;
      const id = (target?.kind === kind ? target : blocks.find((b) => b.kind === kind))?.id;
      if (id) blocks = blocks.map((b) => (b.id === id ? { ...b, text: words } : b));
      else if (blocks.length < EDM_LIMITS.blocks) {
        const at = kind === "heading" ? 0 : blocks.findIndex((b) => b.kind === "heading") + 1;
        blocks = [...blocks.slice(0, at), { ...newBlock(kind), text: words }, ...blocks.slice(at)];
      }
    };
    fill("heading", r.heading);
    fill("text", r.text);
    onChange({ subject: r.subject ?? content.subject, preview: r.preview ?? content.preview, blocks });
    setUndo(before);
    flag([r.subject, r.preview, r.heading, r.text].filter(Boolean).join(" "));
    return true;
  }
  // Sol's button beside a field opens his box under it: what to change, then a choice. It no longer rewrites on a press.
  const solRound = (part: EdmSolPart, label: string, blockId?: string) =>
    readOnly ? null : (
      <SolRound
        label={label}
        busy={busy === (blockId ?? part)}
        on={asking === (blockId ?? part)}
        disabled={busy !== null}
        onClick={() => setAsking(asking === (blockId ?? part) ? null : (blockId ?? part))}
      />
    );

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-xl border border-line bg-canvas p-3">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <SolIcon className="size-4" /> Write it with Sol
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
            <textarea
              value={brief}
              maxLength={EDM_SOL_LIMITS.brief}
              rows={2}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What's this email about? Who it's for, what you want them to do, and any facts or offers to mention."
              className={cn(field, "h-auto flex-1 py-2 leading-relaxed")}
            />
            <button
              disabled={busy !== null || !brief.trim()}
              onClick={() => void sol("all")}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-line disabled:text-muted"
            >
              {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <SolIcon className="size-4" />}
              Write subject, preview, heading and words
            </button>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Sol uses only what you write here and what the email already says: no figures, offers or promises of its own. To change one
            part, press the Sol button beside it: tell him what to change and pick from his options. Each answer uses Sol credits.
          </p>
          {(solMsg || undo) && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
              {solMsg && <span className={solMsg.ok ? "text-positive" : "text-danger"}>{solMsg.text}</span>}
              {undo && (
                <button
                  onClick={() => (onChange(undo), setUndo(null), setSolMsg(null))}
                  className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
                >
                  <Undo2 className="size-3.5" /> Undo
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={cn(asking === "subject" && "sm:col-span-2")}>
          <label className="block text-[12px] text-muted">
            <span className="flex items-center justify-between">Subject {solRound("subject", "Improve the subject with Sol")}</span>
            <input
              value={content.subject}
              disabled={readOnly}
              maxLength={EDM_LIMITS.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="What the inbox shows first"
              className={cn(field, "mt-1")}
            />
          </label>
          {solAsk("subject", content.subject)}
        </div>
        <div className={cn(asking === "preview" && "sm:col-span-2")}>
          <label className="block text-[12px] text-muted">
            <span className="flex items-center justify-between">
              Preview line {solRound("preview", "Improve the preview line with Sol")}
            </span>
            <input
              value={content.preview}
              disabled={readOnly}
              maxLength={EDM_LIMITS.preview}
              onChange={(e) => set({ preview: e.target.value })}
              placeholder="Shown after the subject in most inboxes"
              className={cn(field, "mt-1")}
            />
          </label>
          {solAsk("preview", content.preview)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="View" className="inline-flex rounded-full bg-canvas p-1">
          {(readOnly ? (["preview"] as const) : (["builder", "preview"] as const)).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium",
                mode === m ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
              )}
            >
              {m === "builder" ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
              {m === "builder" ? "Builder" : "Preview"}
            </button>
          ))}
        </div>
        {mode === "preview" && (
          <div className="inline-flex rounded-full bg-canvas p-1 text-[12px]">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                onClick={() => setPhone(p)}
                className={cn("rounded-full px-3 py-1", phone === p ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted")}
              >
                {p ? "Phone" : "Desktop"}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "preview" ? (
        <EdmPreview content={content} brand={brand} sender={sender} phone={phone} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="space-y-3">
            {content.blocks.length === 0 && (
              <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-[13px] text-muted">
                Add a block to start.
              </p>
            )}
            {content.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                first={i === 0}
                last={i === content.blocks.length - 1}
                onChange={(patch) => setBlock(b.id, patch)}
                onMove={(by) => set({ blocks: moveBlock(content.blocks, b.id, by) })}
                onRemove={() => set({ blocks: content.blocks.filter((x) => x.id !== b.id) })}
                sol={
                  b.kind === "heading"
                    ? solRound("heading", "Improve the heading with Sol", b.id)
                    : b.kind === "text"
                      ? solRound("text", "Improve the words with Sol", b.id)
                      : null
                }
                solAsk={b.kind === "heading" || b.kind === "text" ? solAsk(b.kind, b.text, b.id) : null}
              />
            ))}
            <div className="rounded-xl border border-dashed border-line-strong p-3">
              <p className="mb-2 text-[12px] text-muted">Add a block</p>
              <div className="flex flex-wrap gap-2">
                {EDM_BLOCK_KINDS.map((k) => {
                  const Icon = ICONS[k];
                  return (
                    <button
                      key={k}
                      disabled={content.blocks.length >= EDM_LIMITS.blocks}
                      onClick={() => set({ blocks: [...content.blocks, newBlock(k)] })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] hover:border-ink/40 disabled:text-muted"
                    >
                      <Icon className="size-4" /> {EDM_BLOCK_WORDS[k]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl bg-canvas p-3 text-[12px] text-muted">
              <span className="font-medium text-ink-2">Footer (always on, can&apos;t be removed):</span> your business&apos;s name, ABN and
              how to reach us, why they&apos;re getting it, and an unsubscribe link. Set its wording in Settings. Personalise with{" "}
              {MERGE_FIELDS.join(" or ")}.
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <EdmPreview content={content} brand={brand} sender={sender} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockCard({
  block: b,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  sol,
  solAsk,
}: {
  block: EdmBlock;
  first: boolean;
  last: boolean;
  onChange: (patch: BlockPatch) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  sol?: ReactNode;
  /** Sol's box for this block, open under its field. */
  solAsk?: ReactNode;
}) {
  const Icon = ICONS[b.kind];
  const badLink = b.url === null && (b.kind === "button" || b.kind === "image");
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-muted" />
        <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{EDM_BLOCK_WORDS[b.kind]}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {sol}
          {b.kind !== "divider" && b.kind !== "image" && (
            <Toggle
              on={b.align === "center"}
              onClick={() => onChange({ align: b.align === "center" ? "left" : "center" })}
              label="Centre it"
            >
              <span className="text-[11px] font-semibold">Ctr</span>
            </Toggle>
          )}
          <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label="Remove block" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconButton>
        </span>
      </div>
      {b.kind === "heading" && (
        <input value={b.text} maxLength={EDM_LIMITS.heading} onChange={(e) => onChange({ text: e.target.value })} className={field} />
      )}
      {b.kind === "text" && (
        <textarea
          value={b.text}
          maxLength={EDM_LIMITS.text}
          rows={5}
          onChange={(e) => onChange({ text: e.target.value })}
          className={cn(field, "h-auto py-2 leading-relaxed")}
        />
      )}
      {solAsk}
      {b.kind === "button" && (
        <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <input
            value={b.text}
            maxLength={EDM_LIMITS.label}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Label"
            className={field}
          />
          <LinkInput value={b.url} onChange={(url) => onChange({ url })} />
        </div>
      )}
      {b.kind === "image" && <ImageFields block={b} onChange={onChange} />}
      {b.kind === "tiles" && <TilesFields block={b} onChange={onChange} />}
      {b.kind === "divider" && <div className="h-px bg-line" />}
      {badLink && b.kind === "button" && <p className="mt-1 text-[12px] text-muted">A button needs an https link.</p>}
    </div>
  );
}

/** Sol's button beside a field: opens his box under it, to say what to change. */
function SolRound({
  label,
  busy,
  on,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={on}
      disabled={disabled}
      onClick={(e) => (e.preventDefault(), onClick())}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium hover:bg-sun hover:text-sun-ink disabled:text-muted disabled:hover:bg-transparent",
        on ? "bg-sun text-sun-ink" : "text-ink-2",
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <SolIcon className="size-3.5" />}
      Improve
    </button>
  );
}

/** Keeps what's typed while it isn't a link yet; the block holds the cleaned link or null. */
function LinkInput({
  value,
  onChange,
  placeholder = "https://renuabl.com.au/business",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  const ok = !text || cleanLink(text) !== null;
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(cleanLink(e.target.value));
      }}
      placeholder={placeholder}
      className={cn(field, !ok && "border-danger")}
    />
  );
}

function ImageFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: Partial<EdmBlock>) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await uploadMarketingImage(file);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    onChange({ imageId: r.id });
  }
  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        {b.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/m/i/${b.imageId}`} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-line" />
        ) : (
          <div className="grid h-16 w-24 place-items-center rounded-lg bg-canvas text-muted ring-1 ring-line">
            <ImagePlus className="size-5" />
          </div>
        )}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-[13px] hover:border-ink/40">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {b.imageId ? "Change picture" : "Choose a picture"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <span className="text-[12px] text-muted">or drop one here</span>
      </div>
      {problem && <p className="text-[12px] text-danger">{problem}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={b.text}
          maxLength={EDM_LIMITS.alt}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="What it shows (for screen readers)"
          className={field}
        />
        <LinkInput value={b.url} onChange={(url) => onChange({ url })} />
      </div>
    </div>
  );
}

/**
 * A tiles block: as many pictures as the section needs (up to the limit), one, two or three across, each with a line
 * under it and a link. Several files can be dropped on it at once. A spot with no picture is never sent.
 */
function TilesFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const tiles = b.tiles ?? [];
  const columns = cleanColumns(b.columns);
  const [busy, setBusy] = useState<number | "many" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const full = tiles.length >= EDM_LIMITS.tiles;
  const setTile = (i: number, patch: Partial<EdmTile>) => onChange({ tiles: tiles.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  /** Puts the first picture in the spot named, the rest in the empty spots, then in new ones while there is room. */
  async function add(files: File[], at?: number) {
    const pictures = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (!pictures.length) {
      if (files.length) setProblem("Pictures are JPEG, PNG or WebP.");
      return;
    }
    setProblem(null);
    setBusy(pictures.length === 1 && at !== undefined ? at : "many");
    let left = false;
    for (const [n, file] of pictures.entries()) {
      const r = await uploadMarketingImage(file);
      if (!r.ok) {
        setProblem(r.message);
        break;
      }
      // Placed in the block as it stands once the upload is in, so pictures going up together don't undo each other.
      onChange((now) => {
        const next = now.tiles ?? [];
        const spot = n === 0 && at !== undefined && at < next.length ? at : next.findIndex((t) => !t.imageId);
        if (spot >= 0) return { tiles: next.map((t, j) => (j === spot ? { ...t, imageId: r.id } : t)) };
        if (next.length >= EDM_LIMITS.tiles) {
          left = true;
          return {};
        }
        return { tiles: [...next, { ...EMPTY_TILE, imageId: r.id }] };
      });
      if (left) break;
    }
    setBusy(null);
    if (left) setProblem(`A block holds up to ${EDM_LIMITS.tiles} pictures. Add another Picture tiles block for more.`);
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void add([...e.dataTransfer.files]);
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <span>Across</span>
        <span className="inline-flex rounded-full bg-canvas p-0.5">
          {TILE_COLUMNS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={columns === c}
              onClick={() => onChange({ columns: c })}
              className={cn(
                "h-7 min-w-8 rounded-full px-2 text-[12px] font-medium",
                columns === c ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
              )}
            >
              {c}
            </button>
          ))}
        </span>
        <span className="ml-auto">
          {tiles.filter((t) => t.imageId).length} of {EDM_LIMITS.tiles} pictures · drop several here at once
        </span>
      </div>
      <div className={cn("grid gap-3", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {tiles.map((t, i) => (
          <div key={i} className="rounded-lg border border-line p-2">
            <div
              className="relative"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void add([...e.dataTransfer.files], i);
              }}
            >
              <label
                className={cn(
                  "grid cursor-pointer place-items-center overflow-hidden rounded-md bg-canvas text-muted hover:text-ink",
                  columns === 1 ? "aspect-[16/7]" : "aspect-[4/3]",
                  !t.imageId && "border border-dashed border-line-strong",
                )}
              >
                {t.imageId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/m/i/${t.imageId}`} alt="" className="size-full object-cover" />
                ) : busy === i ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[12px]">
                    <ImagePlus className="size-5" /> Drop or choose a picture
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    void add([...(e.target.files ?? [])], i);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                aria-label="Remove this picture"
                title="Remove this picture"
                onClick={() => onChange({ tiles: tiles.filter((_, j) => j !== i) })}
                className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-surface text-ink-2 shadow-[var(--shadow-soft)] hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <input
              value={t.text}
              maxLength={EDM_LIMITS.caption}
              onChange={(e) => setTile(i, { text: e.target.value })}
              placeholder="Caption (optional)"
              className={cn(field, "mt-2")}
            />
            <div className="mt-1.5">
              <LinkInput value={t.url} onChange={(url) => setTile(i, { url })} placeholder="Link (optional)" />
            </div>
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => onChange({ tiles: [...tiles, EMPTY_TILE] })}
            className="grid min-h-24 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted hover:border-ink/40 hover:text-ink"
          >
            <span className="flex items-center gap-1.5">
              {busy === "many" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add a picture
            </span>
          </button>
        )}
      </div>
      {problem && <p className="text-[12px] text-danger">{problem}</p>}
      <p className="text-[12px] text-muted">A spot with no picture is left out of the email.</p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-canvas disabled:text-line-strong"
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn("grid h-8 min-w-8 place-items-center rounded-full px-1.5", on ? "bg-ink text-canvas" : "text-ink-2 hover:bg-canvas")}
    >
      {children}
    </button>
  );
}
