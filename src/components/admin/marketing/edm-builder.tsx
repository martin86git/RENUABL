"use client";

import { ArrowDown, ArrowUp, Eye, Heading, ImagePlus, Loader2, Minus, MousePointerClick, Pencil, Trash2, Type } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import {
  EDM_BLOCK_KINDS,
  EDM_BLOCK_WORDS,
  EDM_LIMITS,
  MERGE_FIELDS,
  cleanLink,
  moveBlock,
  newBlock,
  renderEdm,
  type EdmBlock,
  type EdmBlockKind,
  type EdmBrand,
  type EdmContent,
} from "@/lib/domain/marketing/edm";
import { uploadMarketingImage } from "@/lib/services/marketing";

export const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-ink/40";
const ICONS: Record<EdmBlockKind, typeof Heading> = {
  heading: Heading,
  text: Type,
  image: ImagePlus,
  button: MousePointerClick,
  divider: Minus,
};

/** The email as a reader sees it, with a sample name and company, nothing tracked. */
export function EdmPreview({ content, brand, phone = false }: { content: EdmContent; brand: EdmBrand; phone?: boolean }) {
  const html = useMemo(
    () =>
      renderEdm(
        content,
        brand,
        { firstName: "Sam", company: "Sunrise Solar" },
        {
          click: (_i, url) => url,
          pixel: null,
          unsubscribe: "#",
          image: (id) => `/api/m/i/${id}`,
        },
      ).html,
    [content, brand],
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="border-b border-line bg-surface px-4 py-2.5 text-[12px]">
        <p className="truncate font-medium text-ink">{brand.fromName}</p>
        <p className="truncate text-ink-2">{content.subject || "No subject yet"}</p>
        {content.preview && <p className="truncate text-muted">{content.preview}</p>}
      </div>
      <iframe
        title="Email preview"
        sandbox=""
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
  onChange,
  readOnly = false,
}: {
  content: EdmContent;
  brand: EdmBrand;
  onChange: (c: EdmContent) => void;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"builder" | "preview">(readOnly ? "preview" : "builder");
  const [phone, setPhone] = useState(false);
  const set = (patch: Partial<EdmContent>) => onChange({ ...content, ...patch });
  const setBlock = (id: string, patch: Partial<EdmBlock>) =>
    set({ blocks: content.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-muted">
          Subject
          <input
            value={content.subject}
            disabled={readOnly}
            maxLength={EDM_LIMITS.subject}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="What the inbox shows first"
            className={cn(field, "mt-1")}
          />
        </label>
        <label className="text-[12px] text-muted">
          Preview line
          <input
            value={content.preview}
            disabled={readOnly}
            maxLength={EDM_LIMITS.preview}
            onChange={(e) => set({ preview: e.target.value })}
            placeholder="Shown after the subject in most inboxes"
            className={cn(field, "mt-1")}
          />
        </label>
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
        <EdmPreview content={content} brand={brand} phone={phone} />
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
              <span className="font-medium text-ink-2">Footer (always on, can&apos;t be removed):</span> RENUABL&apos;s name, ABN and how to
              reach us, why they&apos;re getting it, and an unsubscribe link. Set its wording in Settings. Personalise with{" "}
              {MERGE_FIELDS.join(" or ")}.
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <EdmPreview content={content} brand={brand} />
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
}: {
  block: EdmBlock;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<EdmBlock>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const Icon = ICONS[b.kind];
  const badLink = b.url === null && (b.kind === "button" || b.kind === "image");
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-muted" />
        <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{EDM_BLOCK_WORDS[b.kind]}</span>
        <span className="ml-auto flex items-center gap-0.5">
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
      {b.kind === "divider" && <div className="h-px bg-line" />}
      {badLink && b.kind === "button" && <p className="mt-1 text-[12px] text-muted">A button needs an https link.</p>}
    </div>
  );
}

/** Keeps what's typed while it isn't a link yet; the block holds the cleaned link or null. */
function LinkInput({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [text, setText] = useState(value ?? "");
  const ok = !text || cleanLink(text) !== null;
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(cleanLink(e.target.value));
      }}
      placeholder="https://renuabl.com.au/business"
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
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
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
