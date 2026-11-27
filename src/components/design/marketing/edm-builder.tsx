"use client";

import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Heading,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Minus,
  Monitor,
  MoveVertical,
  MousePointerClick,
  Pencil,
  Plus,
  Redo2,
  Share2,
  Smartphone,
  Trash2,
  Type,
  Undo2,
  X,
  ShoppingBag,
  Timer,
  CirclePlay,
  PanelTop,
  PaintBucket,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import {
  EDM_BLOCK_KINDS,
  EDM_BLOCK_WORDS,
  EDM_LIMITS,
  EMPTY_TILE,
  EMPTY_PRODUCT,
  PRODUCT_BUTTON,
  MERGE_FIELDS,
  SOCIAL_NETWORKS,
  SOCIAL_WORDS,
  SPACER_SIZES,
  BUTTON_SHAPES,
  BUTTON_SHAPE_WORDS,
  BUTTON_SIZES,
  BUTTON_SIZE_WORDS,
  buttonLook,
  buttonShapeOf,
  buttonSizeOf,
  SPACER_WORDS,
  SOCIAL_LOOKS,
  SOCIAL_LOOK_WORDS,
  cleanSocialLook,
  TILE_COLUMNS,
  cleanSpace,
  networkOf,
  cleanColumns,
  cleanLink,
  footerLines,
  inksOn,
  BAR_BUTTON,
  BLOCK_WIDTHS,
  BLOCK_WIDTH_WORDS,
  blockSide,
  blockWidthOf,
  hasWidth,
  fromNameOf,
  lookOf,
  letterWarnings,
  EDM_LOOKS,
  EDM_LOOK_WORDS,
  type EdmLook,
  inksOf,
  isDefaultStyle,
  styleOf,
  styleProblem,
  DEFAULT_STYLE,
  HEADING_INK,
  WORDS_INK,
  moveBlock,
  newBlock,
  renderEdm,
  type EdmBlock,
  type EdmBlockKind,
  type EdmBrand,
  type EdmContent,
  type EdmSender,
  type EdmSocial,
  type SocialNetwork,
  type SpacerSize,
  type SocialLook,
  type EdmStyle,
  type EdmTile,
  type EdmProduct,
} from "@/lib/domain/marketing/edm";
import { VIDEO_LINE, videoStillKey, youTubeId } from "@/lib/domain/marketing/edm-video";
import { COUNTDOWN_UNITS, cleanEndsAt, endsAtMs, endsWords } from "@/lib/domain/marketing/countdown";
import { EDM_SOL_LIMITS, claimsToCheck, type EdmSolPart } from "@/lib/domain/marketing/edm-sol";
import { saveMarketingLogo, uploadMarketingImage, writeWithSol } from "@/lib/services/marketing";
import { emptyHistory, record, redo as redoHistory, undo as undoHistory } from "@/lib/domain/marketing/edm-history";
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
  spacer: MoveVertical,
  social: Share2,
  products: ShoppingBag,
  countdown: Timer,
  video: CirclePlay,
  bar: PanelTop,
};

const KIND_TYPE = "application/x-renuabl-edm-kind";
const MOVE_TYPE = "application/x-renuabl-edm-move";
/** The blocks on the left, in Klaviyo's and instant's way: the everyday ones first. */
const BLOCK_GROUPS: { name: string; kinds: EdmBlockKind[] }[] = [
  { name: "Basics", kinds: ["heading", "text", "button", "image", "video", "products", "countdown"] },
  { name: "Layout", kinds: ["bar", "tiles", "divider", "spacer", "social"] },
];

/** When a change was made, for grouping typing into one undo step. */
const clock = () => Date.now();

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
          social: (network, colour) => `${typeof window === "undefined" ? "" : window.location.origin}/api/m/s/${network}.png?c=${colour}`,
          countdown: (end, colour) => `${typeof window === "undefined" ? "" : window.location.origin}/api/m/t/${end}.gif?c=${colour}`,
          video: (key, colour) => `${typeof window === "undefined" ? "" : window.location.origin}/api/m/v/${key}.jpg?c=${colour}`,
        },
      ).html,
    [content, brand, sender],
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="border-b border-line bg-surface px-4 py-2.5 text-[12px]">
        <p className="truncate font-medium text-ink">{fromNameOf(content, brand, sender)}</p>
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
  onBrand,
  sender,
  onChange,
  readOnly = false,
}: {
  content: EdmContent;
  brand: EdmBrand;
  /** The settings as saved after the logo changes (it is set once for every email). */
  onBrand?: (b: EdmBrand) => void;
  sender: EdmSender;
  onChange: (c: EdmContent) => void;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"builder" | "preview">(readOnly ? "preview" : "builder");
  const [phone, setPhone] = useState(false);
  // The email as it stands now, for changes that land after a wait (a picture uploading): two pictures going into two
  // tiles at once each change the latest email, not the one on screen when their upload began.
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  }, [content]);
  const [undo, setUndo] = useState(false);
  const [solMsg, setSolMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Undo and redo (edm-history.ts): every change made here is a step; another email loaded starts a fresh history.
  const [history, setHistory] = useState(() => emptyHistory<EdmContent>());
  const [own, setOwn] = useState(content);
  if (content !== own) {
    setOwn(content);
    setHistory(emptyHistory<EdmContent>());
  }
  const emit = (next: EdmContent) => {
    latest.current = next;
    setOwn(next);
    onChange(next);
  };
  /** Every change to the email goes through here, so it can be undone. A key groups typing in one field. */
  const change = (next: EdmContent, key: string | null = null) => {
    const before = latest.current;
    const now = clock();
    setHistory((h) => record(h, before, key, now));
    emit(next);
  };
  const step = (way: "undo" | "redo") => {
    const r = (way === "undo" ? undoHistory : redoHistory)(history, latest.current);
    if (!r) return;
    setHistory(r.history);
    emit(r.value);
    setUndo(false);
    setSolMsg(null);
  };
  // Ctrl+Z / ⌘Z, and Ctrl+Y or ⇧⌘Z, anywhere in the editor, and on the page itself once a press has taken the focus
  // away (a block removed): never in another field on the page, which keeps its own undo.
  const root = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  useEffect(() => {
    if (readOnly || mode !== "builder") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const t = e.target as Node | null;
      const inside = !!t && !!root.current?.contains(t);
      if (!inside && t !== document.body && t !== document.documentElement) return;
      e.preventDefault();
      stepRef.current(k === "y" || e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, mode]);
  const set = (patch: Partial<EdmContent>, key: string | null = null) => change({ ...latest.current, ...patch }, key);
  const style = styleOf(content);
  const ink = inksOf(style);
  const letter = lookOf(content) === "letter";
  /** Designed or a personal letter: one step to undo. */
  const setLook = (look: EdmLook) => {
    const { look: _old, ...rest } = latest.current;
    void _old;
    change(look === "letter" ? { ...rest, look } : rest, null);
  };
  const setFrom = (name: string) => {
    const { fromName: _old, ...rest } = latest.current;
    void _old;
    change(name ? { ...rest, fromName: name } : rest, "fromName");
  };
  /** A colour changed: dragging the picker is one step until it rests, as typing is. */
  const setStyle = (next: EdmStyle, which: string) => {
    const { style: _old, ...rest } = latest.current;
    void _old;
    change(isDefaultStyle(next) ? rest : { ...rest, style: next }, `style:${which}`);
  };
  const setBlock = (id: string, patch: BlockPatch) => {
    const now = latest.current;
    // Typing (words, a label, a link, a caption) is one step per field while it carries on.
    const part = typeof patch === "function" ? "" : Object.keys(patch).join();
    const typed = ["text", "url", "tiles", "socials", "products", "endsAt"].includes(part);
    change(
      {
        ...now,
        blocks: now.blocks.map((b) => (b.id === id ? { ...b, ...(typeof patch === "function" ? patch(b) : patch) } : b)),
      },
      typed ? `${part}:${id}` : null,
    );
  };

  // Sol writing the email (edm-sol.ts): from the brief, one part or all four; the last fill can be undone.
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
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
    setUndo(true);
    if (blockId) change({ ...content, blocks: content.blocks.map((b) => (b.id === blockId ? { ...b, text: line } : b)) });
    else if (part === "subject" || part === "preview") change({ ...content, [part]: line });
    flag(line);
  }
  const putBack = () => {
    if (!undo) return;
    step("undo");
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
    change({ ...content, subject: r.subject ?? content.subject, preview: r.preview ?? content.preview, blocks });
    setUndo(true);
    flag([r.subject, r.preview, r.heading, r.text].filter(Boolean).join(" "));
    return true;
  }
  // The member's direction for the whole email, and whether there is an email yet to change.
  const [direction, setDirection] = useState("");
  const hasDraft = Boolean(
    content.subject.trim() ||
    content.preview.trim() ||
    content.blocks.some((b) => (b.kind === "text" || b.kind === "heading") && b.text.trim() && b.text.trim() !== "Hi {firstName},"),
  );
  async function changeEmail() {
    const { draft } = draftFor();
    setBusy("direction");
    setSolMsg(null);
    const r = await writeWithSol({ part: "all", brief, draft, note: direction });
    setBusy(null);
    if (!r.ok) return setSolMsg({ ok: false, text: r.message });
    let blocks = content.blocks;
    const fill = (kind: "heading" | "text", words: string | undefined) => {
      if (words === undefined) return;
      const id = blocks.find((b) => b.kind === kind)?.id;
      if (id) blocks = blocks.map((b) => (b.id === id ? { ...b, text: words } : b));
    };
    fill("heading", r.heading);
    fill("text", r.text);
    change({ ...content, subject: r.subject ?? content.subject, preview: r.preview ?? content.preview, blocks });
    setUndo(true);
    setDirection("");
    flag([r.subject, r.preview, r.heading, r.text].filter(Boolean).join(" "));
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

  // Which block is picked on the canvas (its tools and settings show), and where a new block is being added.
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const full = content.blocks.length >= EDM_LIMITS.blocks;
  const insert = (at: number, kind: EdmBlockKind) => {
    if (full) return;
    const b = newBlock(kind);
    set({ blocks: [...content.blocks.slice(0, at), b, ...content.blocks.slice(at)] });
    setSelected(b.id);
    setAdding(null);
  };
  const afterPicked = () => {
    const i = content.blocks.findIndex((b) => b.id === selected);
    return i < 0 ? content.blocks.length : i + 1;
  };

  // Drag and drop: a kind from the left, or a block on the email being moved; where it would land, as an index.
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [solOpen, setSolOpen] = useState(false);
  const dragged = (e: React.DragEvent) => e.dataTransfer.types.includes(KIND_TYPE) || e.dataTransfer.types.includes(MOVE_TYPE);
  const drop = (e: React.DragEvent, at: number) => {
    const kind = e.dataTransfer.getData(KIND_TYPE) as EdmBlockKind;
    const id = e.dataTransfer.getData(MOVE_TYPE);
    setDropAt(null);
    if (kind && (EDM_BLOCK_KINDS as readonly string[]).includes(kind)) return insert(at, kind);
    if (!id) return;
    const from = content.blocks.findIndex((x) => x.id === id);
    if (from < 0) return;
    const blocks = [...content.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(at > from ? at - 1 : at, 0, moved);
    set({ blocks });
    setSelected(id);
  };
  const overBlock = (e: React.DragEvent, i: number) => {
    if (!dragged(e)) return;
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < box.top + box.height / 2 ? i : i + 1);
  };
  const line = (at: number) => (dropAt === at ? <div className="mx-5 my-1 h-1 rounded-full bg-sun-line" aria-hidden /> : null);

  if (mode === "preview" || readOnly)
    return (
      <div className="space-y-3">
        <ViewBar mode={readOnly ? "preview" : mode} readOnly={readOnly} onMode={setMode} phone={phone} onPhone={setPhone} />
        <EdmPreview content={content} brand={brand} sender={sender} phone={phone} />
      </div>
    );

  return (
    <div className="space-y-3" ref={root}>
      <ViewBar
        mode={mode}
        readOnly={readOnly}
        onMode={setMode}
        phone={phone}
        onPhone={setPhone}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onStep={step}
      />
      <div className="grid overflow-hidden rounded-2xl border border-line lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Down the left: the blocks, dragged onto the email or pressed to add. */}
        <aside className="border-b border-line bg-surface p-4 lg:border-r lg:border-b-0">
          <div className="lg:sticky lg:top-4">
            <p className="text-[14px] font-semibold text-ink">Add blocks</p>
            <p className="mt-0.5 text-[11px] text-muted">Drag one onto the email, or press it to add it.</p>
            {BLOCK_GROUPS.map((g) => (
              <div key={g.name} className="mt-4">
                <p className="mb-2 text-[11px] font-medium tracking-wide text-ink-2 uppercase">{g.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.kinds.map((k) => {
                    const Icon = ICONS[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        draggable={!full}
                        disabled={full}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(KIND_TYPE, k);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onDragEnd={() => setDropAt(null)}
                        onClick={() => insert(afterPicked(), k)}
                        className="group/k flex min-h-10 cursor-grab items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-[12px] font-medium text-ink shadow-[var(--shadow-soft)] hover:border-ink/50 hover:text-ink active:cursor-grabbing disabled:cursor-not-allowed disabled:text-muted"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="text-left leading-tight">{EDM_BLOCK_WORDS[k]}</span>
                        <GripVertical className="ml-auto size-3.5 shrink-0 text-line-strong group-hover/k:text-muted" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <LookPanel look={letter ? "letter" : "designed"} onLook={setLook} warnings={letter ? letterWarnings(content) : []} />
            {!letter && <StylePanel style={style} onChange={setStyle} />}
            <p className="mt-5 border-t border-line pt-4 text-[11px] leading-snug text-muted">
              Personalise with {MERGE_FIELDS.join(" or ")}. The footer is always on: your business&apos;s name, ABN, how to reach you, why
              they&apos;re getting it and an unsubscribe link (wording in Settings).
            </p>
          </div>
        </aside>

        {/* The email itself on a dotted canvas, edited where it is. */}
        <div
          className="relative min-h-[40rem] bg-line px-3 py-6 sm:px-6"
          style={{ backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
          onClick={() => (setSelected(null), setAdding(null))}
        >
          <div className={cn("mx-auto w-full space-y-4", phone ? "max-w-[390px]" : "max-w-[680px]")}>
            <div
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-soft)]"
              onClick={(e) => e.stopPropagation()}
            >
              <InboxRow label="From" improve={null}>
                <input
                  value={content.fromName ?? ""}
                  maxLength={60}
                  onChange={(e) => setFrom(e.target.value.replace(/[<>"@]/g, ""))}
                  placeholder={`${brand.fromName || sender.name} (from Settings)`}
                  className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </InboxRow>
              <InboxRow label="Subject" improve={solRound("subject", "Improve the subject with Sol")}>
                <input
                  value={content.subject}
                  maxLength={EDM_LIMITS.subject}
                  onChange={(e) => set({ subject: e.target.value }, "subject")}
                  placeholder="What the inbox shows first"
                  className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </InboxRow>
              {solAsk("subject", content.subject) && <div className="px-4 pb-3">{solAsk("subject", content.subject)}</div>}
              <InboxRow label="Preview" improve={solRound("preview", "Improve the preview line with Sol")}>
                <input
                  value={content.preview}
                  maxLength={EDM_LIMITS.preview}
                  onChange={(e) => set({ preview: e.target.value }, "preview")}
                  placeholder="Shown after the subject in most inboxes"
                  className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </InboxRow>
              {solAsk("preview", content.preview) && <div className="px-4 pb-3">{solAsk("preview", content.preview)}</div>}
            </div>

            <div
              className={cn(
                "pt-7 pb-6",
                letter
                  ? "rounded-md bg-white shadow-[0_1px_4px_rgba(20,20,30,0.12)]"
                  : "rounded-2xl shadow-[0_6px_24px_rgba(20,20,30,0.12)] ring-1 ring-black/5",
              )}
              style={letter ? undefined : { background: style.background }}
              onDragOver={(e) => {
                if (!dragged(e)) return;
                e.preventDefault();
                if (!content.blocks.length) setDropAt(0);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
              }}
              onDrop={(e) => {
                if (!dragged(e)) return;
                e.preventDefault();
                drop(e, dropAt ?? content.blocks.length);
              }}
            >
              {letter ? (
                <p className="mx-5 mb-3 rounded-lg bg-canvas px-3 py-2 text-[12px] leading-snug text-muted">
                  Sent as a personal letter: plain words on white, buttons as links, no logo or colours. Preview shows it as it goes.
                </p>
              ) : (
                <LogoField brand={brand} sender={sender} ink={ink} readOnly={readOnly} onBrand={onBrand} />
              )}
              {content.blocks.length === 0 && (
                <p
                  className={cn(
                    "mx-5 my-2 rounded-xl border-2 border-dashed p-10 text-center text-[13px] text-muted",
                    dropAt === 0 ? "border-sun-line bg-sun/30" : "border-line-strong",
                  )}
                >
                  Drag a block here to start, or press Edit with Sol to have him write it.
                </p>
              )}
              {content.blocks.map((b, i) => (
                <div key={b.id} onDragOver={(e) => overBlock(e, i)}>
                  {line(i)}
                  {i > 0 && dropAt === null && (
                    <Inserter
                      open={adding === i}
                      disabled={full}
                      onOpen={() => setAdding(adding === i ? null : i)}
                      onPick={(k) => insert(i, k)}
                    />
                  )}
                  <CanvasBlock
                    block={b}
                    ink={b.fill && b.kind !== "bar" ? inksOn(b.fill, style) : ink}
                    picked={selected === b.id}
                    onPick={() => (setSelected(b.id), setAdding(null))}
                    onDragEnd={() => setDropAt(null)}
                    colour={brand.colour}
                    first={i === 0}
                    last={i === content.blocks.length - 1}
                    onChange={(patch) => setBlock(b.id, patch)}
                    onMove={(by) => set({ blocks: moveBlock(content.blocks, b.id, by) })}
                    onRemove={() => (set({ blocks: content.blocks.filter((x) => x.id !== b.id) }), setSelected(null))}
                    sol={
                      b.kind === "heading"
                        ? solRound("heading", "Improve the heading with Sol", b.id)
                        : b.kind === "text"
                          ? solRound("text", "Improve the words with Sol", b.id)
                          : null
                    }
                    solAsk={b.kind === "heading" || b.kind === "text" ? solAsk(b.kind, b.text, b.id) : null}
                  />
                </div>
              ))}
              {content.blocks.length > 0 && line(content.blocks.length)}
              {content.blocks.length > 0 && dropAt === null && (
                <Inserter
                  open={adding === content.blocks.length}
                  disabled={full}
                  onOpen={() => setAdding(adding === content.blocks.length ? null : content.blocks.length)}
                  onPick={(k) => insert(content.blocks.length, k)}
                />
              )}
            </div>
            <div className={cn("px-8 pb-2 text-[12px] leading-relaxed text-[#7b7d84]", letter ? "text-left" : "text-center")}>
              {footerLines(brand, sender).map((l) => (
                <p key={l}>{l}</p>
              ))}
              <p>
                <span className="underline">Unsubscribe</span> from these emails.
              </p>
            </div>
          </div>

          {/* Sol, floating in the corner: write the whole email from a few words. */}
          <div className="sticky bottom-4 mt-4 flex justify-end" onClick={(e) => e.stopPropagation()}>
            {solOpen ? (
              <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)]">
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  <SolIcon className="size-5" /> Edit with Sol
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setSolOpen(false)}
                    className="ml-auto grid size-7 place-items-center rounded-full hover:bg-canvas"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {/* Direction for the whole email once there is one (26 Nov 2026, Martin: "the ability to provide sol feedback
                    in a text box to give direction around the marketing"): Sol rewrites it as told, keeping what works. */}
                {hasDraft && (
                  <div className="mt-3">
                    <label htmlFor="sol-direction" className="text-[12px] font-medium text-ink-2">
                      Tell Sol what to change
                    </label>
                    <textarea
                      id="sol-direction"
                      autoFocus
                      value={direction}
                      maxLength={EDM_SOL_LIMITS.direction}
                      rows={3}
                      onChange={(e) => setDirection(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && direction.trim()) void changeEmail();
                      }}
                      placeholder="e.g. Lead with the voice agent booking calls. Shorter, less salesy. Make the subject a question."
                      className={cn(field, "mt-1 h-auto resize-none py-2 text-[13px] leading-relaxed")}
                    />
                    <button
                      disabled={busy !== null || !direction.trim()}
                      onClick={() => void changeEmail()}
                      className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-line disabled:text-muted"
                    >
                      {busy === "direction" ? <Loader2 className="size-4 animate-spin" /> : <SolIcon className="size-4" />}
                      Change the email
                    </button>
                    <p className="mt-3 text-[12px] font-medium text-ink-2">Or write it again from a brief</p>
                  </div>
                )}
                <textarea
                  autoFocus={!hasDraft}
                  value={brief}
                  maxLength={EDM_SOL_LIMITS.brief}
                  rows={4}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="What's this email about? Who it's for, what you want them to do, any facts or offers."
                  className={cn(field, "mt-3 h-auto resize-none py-2 text-[13px] leading-relaxed")}
                />
                <button
                  disabled={busy !== null || !brief.trim()}
                  onClick={() => void sol("all")}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-line disabled:text-muted"
                >
                  {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <SolIcon className="size-4" />}
                  Write the email
                </button>
                {(solMsg || undo) && (
                  <div className="mt-2 space-y-1 text-[12px]">
                    {solMsg && <p className={solMsg.ok ? "text-positive" : "text-danger"}>{solMsg.text}</p>}
                    {undo && (
                      <button
                        onClick={() => step("undo")}
                        className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
                      >
                        <Undo2 className="size-3.5" /> Undo
                      </button>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-snug text-muted">
                  Sol writes the subject, preview, heading and words from this alone: no figures, offers or promises of his own. To change
                  one part, press Improve beside it. Each answer uses Sol credits.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSolOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-medium shadow-[var(--shadow-lift)] hover:border-ink/40"
              >
                <SolIcon className="size-4" /> Edit with Sol
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit or Preview, and the email's width: a computer's inbox or a phone's. */
function ViewBar({
  mode,
  readOnly,
  onMode,
  phone,
  onPhone,
  canUndo = false,
  canRedo = false,
  onStep,
}: {
  mode: "builder" | "preview";
  readOnly: boolean;
  onMode: (m: "builder" | "preview") => void;
  phone: boolean;
  onPhone: (p: boolean) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Undo or redo a change; only while editing. */
  onStep?: (way: "undo" | "redo") => void;
}) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="View" className="inline-flex rounded-full bg-canvas p-1">
        {(readOnly ? (["preview"] as const) : (["builder", "preview"] as const)).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => onMode(m)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium",
              mode === m ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
            )}
          >
            {m === "builder" ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
            {m === "builder" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>
      {onStep && mode === "builder" && (
        <div className="inline-flex rounded-full bg-canvas p-1">
          {(["undo", "redo"] as const).map((way) => {
            const label = way === "undo" ? `Undo (${mac ? "⌘Z" : "Ctrl+Z"})` : `Redo (${mac ? "⇧⌘Z" : "Ctrl+Y"})`;
            return (
              <button
                key={way}
                type="button"
                aria-label={label}
                title={label}
                disabled={way === "undo" ? !canUndo : !canRedo}
                onClick={() => onStep(way)}
                className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface hover:text-ink disabled:text-line-strong disabled:hover:bg-transparent"
              >
                {way === "undo" ? <Undo2 className="size-4" /> : <Redo2 className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="ml-auto inline-flex rounded-full bg-canvas p-1">
        {[false, true].map((p) => (
          <button
            key={String(p)}
            aria-label={p ? "Phone" : "Computer"}
            title={p ? "Phone" : "Computer"}
            aria-pressed={phone === p}
            onClick={() => onPhone(p)}
            className={cn(
              "grid size-8 place-items-center rounded-full",
              phone === p ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
            )}
          >
            {p ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One line of the inbox's view at the top of the email: "Subject:" and what it says, with Improve. */
function InboxRow({ label, improve, children }: { label: string; improve: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="shrink-0 text-[14px] text-muted">{label}:</span>
      <div className="min-w-0 flex-1">{children}</div>
      {improve}
    </div>
  );
}

/** A box that grows with what is typed in it, set in the email's own type. */
function AutoText({
  value,
  onChange,
  max,
  placeholder,
  className,
  align,
  colour,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
  className: string;
  align: "left" | "center";
  colour: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ textAlign: align, color: colour }}
      className={cn("block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-[#b4b5bb]", className)}
    />
  );
}

/** Between two blocks: a + that shows on hover and opens the kinds of block to put there. */
function Inserter({
  open,
  disabled,
  onOpen,
  onPick,
}: {
  open: boolean;
  disabled: boolean;
  onOpen: () => void;
  onPick: (k: EdmBlockKind) => void;
}) {
  if (disabled && !open) return <div className="h-2" />;
  return (
    <div className={cn("group/ins relative mx-5", open ? "py-1" : "h-2")} onClick={(e) => e.stopPropagation()}>
      <div
        className={cn(
          "flex items-center gap-2",
          !open &&
            "pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 opacity-0 group-hover/ins:opacity-100 focus-within:opacity-100",
        )}
      >
        <span className="h-px flex-1 bg-sun-line/50" />
        <button
          type="button"
          aria-label="Add a block here"
          title="Add a block here"
          onClick={onOpen}
          className="pointer-events-auto grid size-6 place-items-center rounded-full bg-sun-line text-white shadow-[var(--shadow-soft)]"
        >
          {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
        </button>
        <span className="h-px flex-1 bg-sun-line/50" />
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {EDM_BLOCK_KINDS.map((k) => {
            const Icon = ICONS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onPick(k)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] hover:border-ink/40"
              >
                <Icon className="size-3.5" /> {EDM_BLOCK_WORDS[k]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One block drawn as it will look in the email, typed into where it is; its tools and settings show when picked. */
function CanvasBlock({
  block: b,
  picked,
  onPick,
  onDragEnd,
  colour,
  ink,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  sol,
  solAsk,
}: {
  block: EdmBlock;
  picked: boolean;
  onPick: () => void;
  onDragEnd: () => void;
  colour: string;
  /** The colours a heading and the words are drawn in. */
  ink: { heading: string; words: string };
  first: boolean;
  last: boolean;
  onChange: (patch: BlockPatch) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  sol?: ReactNode;
  solAsk?: ReactNode;
}) {
  const align = b.align === "center" ? "center" : "left";
  const tiles = (b.tiles ?? []).filter((t) => t.imageId);
  const cols = cleanColumns(b.columns);
  return (
    <div
      onClick={(e) => (e.stopPropagation(), onPick())}
      onFocus={onPick}
      data-edm-block
      className={cn(
        "group relative mx-5 my-1 rounded-lg px-3 py-2",
        picked ? "outline-2 outline-sun-line outline-solid" : "outline-1 outline-dashed",
      )}
      // The dashed edge is drawn in the words' own colour, so it shows on a dark background as on a light one.
      style={{
        ...(picked ? {} : { outlineColor: `color-mix(in srgb, ${ink.words} 28%, transparent)` }),
        ...(b.fill && b.kind !== "bar" ? { background: b.fill } : {}),
        // The block's width as the email draws it: the builder's own margin and padding make the column (32 px a side).
        ...(hasWidth(b.kind) ? { marginInline: 20 + blockSide(b) - 32 } : {}),
      }}
    >
      <div
        className={cn(
          "absolute -top-4 right-2 z-10 pl-1.5 items-center gap-0.5 rounded-full border border-line bg-surface py-0.5 pr-0.5 shadow-[var(--shadow-soft)]",
          picked ? "flex" : "hidden group-hover:flex",
        )}
      >
        <span
          draggable
          title="Drag to move"
          onDragStart={(e) => {
            e.dataTransfer.setData(MOVE_TYPE, b.id);
            e.dataTransfer.effectAllowed = "move";
            const card = (e.currentTarget as HTMLElement).closest("[data-edm-block]");
            if (card) e.dataTransfer.setDragImage(card, 24, 16);
          }}
          onDragEnd={onDragEnd}
          className="mr-1 flex cursor-grab items-center gap-1 text-[10px] font-medium tracking-wide text-muted uppercase active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" /> {EDM_BLOCK_WORDS[b.kind]}
        </span>
        {sol}
        {b.kind !== "divider" && b.kind !== "image" && b.kind !== "spacer" && (
          <Toggle on={b.align === "center"} onClick={() => onChange({ align: b.align === "center" ? "left" : "center" })} label="Centre it">
            <AlignCenter className="size-3.5" />
          </Toggle>
        )}
        <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton label="Remove block" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>

      {b.kind === "bar" && <BarView block={b} colour={colour} picked={picked} onChange={onChange} />}
      {b.kind === "heading" && (
        <AutoText
          value={b.text}
          max={EDM_LIMITS.heading}
          align={align}
          onChange={(text) => onChange({ text })}
          placeholder="A heading"
          className="text-[24px] leading-tight font-semibold"
          colour={ink.heading}
        />
      )}
      {b.kind === "text" && (
        <AutoText
          value={b.text}
          max={EDM_LIMITS.text}
          align={align}
          onChange={(text) => onChange({ text })}
          placeholder="Write here…"
          className="text-[15px] leading-relaxed"
          colour={ink.words}
        />
      )}
      {solAsk && <div onClick={(e) => e.stopPropagation()}>{solAsk}</div>}
      {b.kind === "button" && (
        <div className="py-2" style={{ textAlign: align }}>
          <span className={b.wide ? "block text-center" : "inline-block"} style={buttonStyle(b, colour)}>
            <input
              value={b.text}
              maxLength={EDM_LIMITS.label}
              size={Math.max(6, b.text.length)}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Button"
              className="bg-transparent text-center font-semibold outline-none placeholder:text-current placeholder:opacity-70"
              style={{ color: "inherit", fontSize: "inherit" }}
            />
          </span>
          {picked && (
            <div className="mt-3 text-left">
              <ButtonLookFields block={b} colour={colour} onChange={onChange} />
              <div className="h-2" />
              <LinkInput value={b.url} onChange={(url) => onChange({ url })} />
              {b.url === null && <p className="mt-1 text-[12px] text-muted">A button needs an https link.</p>}
            </div>
          )}
        </div>
      )}
      {b.kind === "image" &&
        (picked ? (
          <ImageFields block={b} onChange={onChange} />
        ) : b.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/m/i/${b.imageId}`} alt={b.text} className="block w-full rounded-lg" />
        ) : (
          <div className="grid aspect-[16/7] place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <ImagePlus className="size-4" /> Press to add a picture
            </span>
          </div>
        ))}
      {b.kind === "tiles" &&
        (picked ? (
          <TilesFields block={b} onChange={onChange} />
        ) : tiles.length ? (
          <div className={cn("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {tiles.map((t, i) => (
              <div key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/m/i/${t.imageId}`} alt={t.text} className="block w-full rounded-lg" />
                {t.text && (
                  <p className="pt-2 text-[13px]" style={{ textAlign: align, color: ink.words }}>
                    {t.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid aspect-[16/5] place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="size-4" /> Press to add pictures
            </span>
          </div>
        ))}
      {b.kind === "divider" && <div className="my-2 h-px bg-[#e4e4e7]" />}
      {b.kind === "spacer" && (
        <div
          className="grid place-items-center rounded-md bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(127,127,127,0.12)_6px_7px)] text-[11px]"
          style={{ height: SPACER_SIZES[cleanSpace(b.space)], color: `color-mix(in srgb, ${ink.words} 55%, transparent)` }}
        >
          {picked ? null : `Space · ${SPACER_WORDS[cleanSpace(b.space)]}`}
        </div>
      )}
      {b.kind === "spacer" && picked && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-surface p-2 text-[12px] ring-1 ring-line"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-muted">Height</span>
          {(Object.keys(SPACER_SIZES) as SpacerSize[]).map((k) => (
            <Toggle key={k} on={cleanSpace(b.space) === k} onClick={() => onChange({ space: k })} label={`${SPACER_WORDS[k]} space`}>
              <span className="px-1 text-[12px]">{SPACER_WORDS[k]}</span>
            </Toggle>
          ))}
        </div>
      )}
      {b.kind === "social" && <SocialPills socials={b.socials ?? []} look={cleanSocialLook(b.socialLook)} colour={colour} align={align} />}
      {b.kind === "social" && picked && <SocialFields block={b} onChange={onChange} />}
      {b.kind === "video" && <VideoView block={b} colour={colour} align={align} />}
      {b.kind === "video" && picked && <VideoFields block={b} onChange={onChange} />}
      {b.kind === "countdown" && (
        <>
          <AutoText
            value={b.text}
            max={EDM_LIMITS.caption}
            align={align}
            onChange={(text) => onChange({ text })}
            placeholder="A line over the timer (optional)"
            className="text-[17px] leading-snug font-semibold"
            colour={ink.heading}
          />
          <CountdownView endsAt={b.endsAt ?? null} colour={colour} ink={ink} align={align} />
          {picked && <CountdownFields block={b} onChange={onChange} />}
        </>
      )}
      {picked && hasWidth(b.kind) && <WidthField block={b} onChange={onChange} />}
      {picked && (
        <PanelColour
          value={b.fill ?? null}
          colour={colour}
          label={b.kind === "bar" ? "Bar colour" : "Panel colour"}
          onChange={(fill) => onChange(() => ({ fill: fill ?? undefined }))}
        />
      )}
      {b.kind === "products" &&
        (picked ? (
          <ProductsFields block={b} onChange={onChange} />
        ) : (
          <ProductCards products={b.products ?? []} columns={cols} align={align} colour={colour} ink={ink} />
        ))}
    </div>
  );
}

/** A social links block as it will look: each network's icon, icon and name, or name, in the button colour; until a link is in, a hint. */
function SocialPills({
  socials,
  look,
  colour,
  align,
}: {
  socials: EdmSocial[];
  look: SocialLook;
  colour: string;
  align: "left" | "center";
}) {
  const shown = socials.filter((s) => s.url);
  if (!shown.length)
    return (
      <div className="grid h-12 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <Share2 className="size-4" /> Press to add your social links
        </span>
      </div>
    );
  const icon = (n: SocialNetwork) => `/api/m/s/${n}.png?c=${colour.replace("#", "")}`;
  return (
    <div
      className={cn("flex flex-wrap py-1", look === "icons" ? "gap-2.5" : "gap-2")}
      style={{ justifyContent: align === "center" ? "center" : "flex-start" }}
    >
      {shown.map((s) =>
        look === "icons" ? (
          // eslint-disable-next-line @next/next/no-img-element -- the same picture the email carries
          <img key={s.network} src={icon(s.network)} alt={SOCIAL_WORDS[s.network]} width={32} height={32} className="size-8" />
        ) : (
          <span
            key={s.network}
            className={cn(
              "inline-flex items-center rounded-full border text-[13px] font-semibold",
              look === "both" ? "gap-1.5 py-1 pr-3.5 pl-1.5" : "px-3.5 py-1.5",
            )}
            style={{ borderColor: colour, color: colour }}
          >
            {look === "both" && (
              // eslint-disable-next-line @next/next/no-img-element -- the same picture the email carries
              <img src={icon(s.network)} alt="" width={20} height={20} className="size-5" />
            )}
            {SOCIAL_WORDS[s.network]}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * A social links block's settings: a row a network with its link, and the networks not yet in it to add. A link
 * pasted into the first box finds its own network.
 */
function SocialFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const socials = b.socials ?? [];
  const [paste, setPaste] = useState("");
  const missing = SOCIAL_NETWORKS.filter((n) => !socials.some((s) => s.network === n));
  // Typing a link is an object patch, so it is one undo step while it carries on (setBlock's typing key).
  const set = (network: SocialNetwork, url: string | null) =>
    onChange({ socials: socials.map((s) => (s.network === network ? { ...s, url } : s)) });
  const add = (network: SocialNetwork, url: string | null = null) =>
    onChange((now) =>
      (now.socials ?? []).some((s) => s.network === network) ? {} : { socials: [...(now.socials ?? []), { network, url }] },
    );
  const remove = (network: SocialNetwork) => onChange((now) => ({ socials: (now.socials ?? []).filter((s) => s.network !== network) }));
  const pasted = cleanLink(paste);
  const pastedNetwork = pasted && !pasted.startsWith("mailto:") ? networkOf(pasted) : null;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-left ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="text-muted">Show as</span>
        {SOCIAL_LOOKS.map((k) => (
          <Toggle key={k} on={cleanSocialLook(b.socialLook) === k} onClick={() => onChange({ socialLook: k })} label={SOCIAL_LOOK_WORDS[k]}>
            <span className="px-1 text-[12px]">{SOCIAL_LOOK_WORDS[k]}</span>
          </Toggle>
        ))}
      </div>
      {socials.map((s) => (
        <div key={s.network} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[13px] font-medium text-ink">{SOCIAL_WORDS[s.network]}</span>
          <div className="min-w-0 flex-1">
            <LinkInput value={s.url} onChange={(url) => set(s.network, url)} placeholder={`Your ${SOCIAL_WORDS[s.network]} link`} />
          </div>
          <IconButton label={`Take ${SOCIAL_WORDS[s.network]} out`} onClick={() => remove(s.network)}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      ))}
      {missing.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pastedNetwork && missing.includes(pastedNetwork)) {
                  e.preventDefault();
                  add(pastedNetwork, pasted);
                  setPaste("");
                }
              }}
              placeholder="Paste a link to add it"
              className={field}
            />
            <button
              type="button"
              disabled={!pastedNetwork || !missing.includes(pastedNetwork)}
              onClick={() => {
                if (!pastedNetwork) return;
                add(pastedNetwork, pasted);
                setPaste("");
              }}
              className="h-10 shrink-0 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-line disabled:text-muted"
            >
              {pastedNetwork ? `Add ${SOCIAL_WORDS[pastedNetwork]}` : "Add"}
            </button>
          </div>
          {pastedNetwork && !missing.includes(pastedNetwork) && (
            <p className="text-[12px] text-muted">{SOCIAL_WORDS[pastedNetwork]} is already in. Change its link above.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-muted">Or add</span>
            {missing.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => add(n)}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[12px] hover:border-ink/40"
              >
                <Plus className="size-3" /> {SOCIAL_WORDS[n]}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="text-[12px] text-muted">Where an inbox blocks pictures, each icon shows its network&apos;s name instead.</p>
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
  placeholder = "Link, e.g. https://yoursite.com.au",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  // A link changed from outside (undo, redo) shows; what's typed and not a link yet stays while it is the same link.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (cleanLink(text) !== value) setText(value ?? "");
  }
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

/** A products block as it will look: each named product's picture, name, price, words and button; until one is named, a hint. */
function ProductCards({
  products,
  columns,
  align,
  colour,
  ink,
}: {
  products: EdmProduct[];
  columns: number;
  align: "left" | "center";
  colour: string;
  ink: { heading: string; words: string };
}) {
  const shown = products.filter((p) => p.name);
  if (!shown.length)
    return (
      <div className="grid h-24 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="size-4" /> Press to add your products
        </span>
      </div>
    );
  const cols = Math.min(columns, shown.length);
  return (
    <div className={cn("grid gap-4", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3")} style={{ textAlign: align }}>
      {shown.map((p, i) => (
        <div key={i}>
          {p.imageId && (
            // eslint-disable-next-line @next/next/no-img-element -- the same picture the email carries
            <img src={`/api/m/i/${p.imageId}`} alt={p.name} className="mb-2.5 block w-full rounded-lg" />
          )}
          <p className="text-[16px] leading-snug font-semibold" style={{ color: ink.heading }}>
            {p.name}
          </p>
          {p.price && (
            <p className="pt-0.5 text-[15px] font-semibold" style={{ color: colour }}>
              {p.price}
            </p>
          )}
          {p.text && (
            <p className="pt-1.5 text-[13px] leading-normal" style={{ color: ink.words }}>
              {p.text}
            </p>
          )}
          {p.url && (
            <span
              className="mt-3 inline-block rounded-full px-[18px] py-[9px] text-[13px] font-semibold text-white"
              style={{ background: colour }}
            >
              {p.label || PRODUCT_BUTTON}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A products block's settings: one, two or three across, and a card a product with its picture, name, price, words,
 * button words and link. A product with no name is left out of the email; one with no link has no button.
 */
function ProductsFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const products = b.products ?? [];
  const columns = cleanColumns(b.columns);
  const [busy, setBusy] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const full = products.length >= EDM_LIMITS.products;
  // Typing is an object patch, so it is one undo step while it carries on (setBlock's typing key).
  const setProduct = (i: number, patch: Partial<EdmProduct>) =>
    onChange({ products: products.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  async function picture(file: File | undefined, i: number) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setProblem("Pictures are JPEG, PNG or WebP.");
      return;
    }
    setProblem(null);
    setBusy(i);
    const r = await uploadMarketingImage(file);
    setBusy(null);
    if (!r.ok) {
      setProblem(r.message);
      return;
    }
    // Placed in the block as it stands once the upload is in.
    onChange((now) => ({ products: (now.products ?? []).map((p, j) => (j === i ? { ...p, imageId: r.id } : p)) }));
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface p-3 text-left ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
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
          {products.filter((p) => p.name).length} of {EDM_LIMITS.products} products
        </span>
      </div>
      <div className={cn("grid gap-3", columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {products.map((p, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-line p-2">
            <div className="relative">
              <label
                className={cn(
                  "grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-md bg-canvas text-muted hover:text-ink",
                  !p.imageId && "border border-dashed border-line-strong",
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void picture(e.dataTransfer.files[0], i);
                }}
              >
                {p.imageId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/m/i/${p.imageId}`} alt="" className="size-full object-cover" />
                ) : busy === i ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[12px]">
                    <ImagePlus className="size-5" /> Drop or choose a picture
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    void picture(e.target.files?.[0], i);
                    e.target.value = "";
                  }}
                />
              </label>
              {p.imageId && (
                <button
                  type="button"
                  aria-label="Remove the picture"
                  title="Remove the picture"
                  onClick={() => setProduct(i, { imageId: null })}
                  className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-surface text-ink-2 shadow-[var(--shadow-soft)] hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <input
              value={p.name}
              maxLength={EDM_LIMITS.productName}
              onChange={(e) => setProduct(i, { name: e.target.value })}
              placeholder="Product name"
              aria-label="Product name"
              className={field}
            />
            <input
              value={p.price}
              maxLength={EDM_LIMITS.price}
              onChange={(e) => setProduct(i, { price: e.target.value })}
              placeholder="Price, e.g. From $9,990 installed (optional)"
              aria-label="Price"
              className={field}
            />
            <textarea
              value={p.text}
              maxLength={EDM_LIMITS.productText}
              onChange={(e) => setProduct(i, { text: e.target.value })}
              placeholder="A line or two about it (optional)"
              aria-label="About the product"
              rows={2}
              className={cn(field, "h-auto py-2")}
            />
            <div className="space-y-1.5">
              <input
                value={p.label}
                maxLength={EDM_LIMITS.label}
                onChange={(e) => setProduct(i, { label: e.target.value })}
                placeholder={PRODUCT_BUTTON}
                aria-label="Button words"
                className={field}
              />
              <div>
                <LinkInput
                  value={p.url}
                  onChange={(url) => setProduct(i, { url })}
                  placeholder="Link (the button shows once there is one)"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ products: products.filter((_, j) => j !== i) })}
              className="text-[12px] text-muted hover:text-danger"
            >
              Remove this product
            </button>
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => onChange({ products: [...products, EMPTY_PRODUCT] })}
            className="grid min-h-24 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted hover:border-ink/40 hover:text-ink"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-4" /> Add a product
            </span>
          </button>
        )}
      </div>
      {problem && <p className="text-[12px] text-danger">{problem}</p>}
      <p className="text-[12px] text-muted">
        A product with no name is left out of the email. Prices are as you type them: check they are ones you can honour.
      </p>
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

/** A top bar: its line beside a button, the strip in a soft grey (or its own colour), as the email will show it. */
function BarView({
  block: b,
  colour,
  picked,
  onChange,
}: {
  block: EdmBlock;
  colour: string;
  picked: boolean;
  onChange: (patch: BlockPatch) => void;
}) {
  const ground = b.fill ?? "#f4f4f5";
  const on = inksOn(ground, DEFAULT_STYLE);
  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: ground }}>
        <input
          value={b.text}
          maxLength={EDM_LIMITS.heading}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Ready to get started?"
          aria-label="The bar's line"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: on.heading }}
        />
        <span className="shrink-0" style={buttonStyle(b, colour)}>
          <input
            value={b.label ?? ""}
            maxLength={EDM_LIMITS.label}
            size={Math.max(6, (b.label ?? "").length)}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={BAR_BUTTON}
            aria-label="The bar's button"
            className="bg-transparent text-center font-semibold outline-none placeholder:text-current placeholder:opacity-70"
            style={{ color: "inherit", fontSize: "inherit" }}
          />
        </span>
      </div>
      {picked && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <LinkInput value={b.url} onChange={(url) => onChange({ url })} />
          <p className="mt-1 text-[12px] text-muted">
            {b.url === null ? "The button needs an https link. " : ""}At the top of the email, it shows above your logo.
          </p>
          <ButtonLookFields block={b} colour={colour} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

/**
 * How wide a block is drawn (27 Nov 2026, Martin: a top bar wider than the picture under it): to the card's edge, the
 * column the words and pictures sit in, or narrower. The block in the builder takes the width as it is picked.
 */
function WidthField({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const now = blockWidthOf(b);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] font-medium text-muted">Width</span>
      <div className="flex rounded-full bg-canvas p-0.5" role="radiogroup" aria-label="Width">
        {BLOCK_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={now === w}
            onClick={() => onChange(() => ({ width: w === blockWidthOf({ kind: b.kind }) ? undefined : w }))}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              now === w ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
            )}
          >
            {BLOCK_WIDTH_WORDS[w]}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-muted">Column lines it up with the words and pictures.</span>
    </div>
  );
}

/** A button's box in the builder, as the email will draw it. */
function buttonStyle(b: EdmBlock, colour: string) {
  const l = buttonLook(b, colour);
  return {
    background: l.background,
    color: l.ink,
    fontSize: l.fontSize,
    padding: `${l.padY}px ${l.padX}px`,
    borderRadius: l.radius,
  };
}

/**
 * A button's look (26 Nov 2026, Martin: "edit button shapes and sizes, button colors"): its shape, its size, how wide
 * (a Button block only) and its colour, the brand's unless another is picked. Its words are typed on the button itself.
 */
const BUTTON_SWATCHES = ["#0b0b0c", "#ff5a1f", "#1f6feb", "#16a34a"];
function ButtonLookFields({ block: b, colour, onChange }: { block: EdmBlock; colour: string; onChange: (patch: BlockPatch) => void }) {
  const shape = buttonShapeOf(b);
  const size = buttonSizeOf(b);
  const swatches = BUTTON_SWATCHES.filter((c) => c !== colour.toLowerCase());
  const group = "flex items-center gap-1";
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface p-2 text-[12px] text-ink ring-1 ring-line"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={group} role="group" aria-label="Button shape">
        <span className="pr-1 text-muted">Shape</span>
        {BUTTON_SHAPES.map((k) => (
          <Toggle
            key={k}
            on={shape === k}
            onClick={() => onChange(() => ({ shape: k === buttonShapeOf({ kind: b.kind }) ? undefined : k }))}
            label={`${BUTTON_SHAPE_WORDS[k]} button`}
          >
            <span
              className="block h-3 w-6 border-[1.5px] border-current"
              style={{ borderRadius: k === "pill" ? 999 : k === "rounded" ? 4 : 0 }}
            />
          </Toggle>
        ))}
      </div>
      <div className={group} role="group" aria-label="Button size">
        <span className="pr-1 text-muted">Size</span>
        {BUTTON_SIZES.map((k) => (
          <Toggle
            key={k}
            on={size === k}
            onClick={() => onChange(() => ({ size: k === "medium" ? undefined : k }))}
            label={`${BUTTON_SIZE_WORDS[k]} button`}
          >
            <span className="px-0.5 font-medium">{BUTTON_SIZE_WORDS[k][0]}</span>
          </Toggle>
        ))}
      </div>
      {b.kind === "button" && (
        <div className={group} role="group" aria-label="Button width">
          <span className="pr-1 text-muted">Width</span>
          <Toggle on={!b.wide} onClick={() => onChange(() => ({ wide: undefined }))} label="As wide as its words">
            <span className="px-1 font-medium">Fit</span>
          </Toggle>
          <Toggle on={b.wide === true} onClick={() => onChange(() => ({ wide: true }))} label="As wide as the email">
            <span className="px-1 font-medium">Full</span>
          </Toggle>
        </div>
      )}
      <div className={group} role="group" aria-label="Button colour">
        <span className="pr-1 text-muted">Colour</span>
        <button
          type="button"
          onClick={() => onChange(() => ({ colour: undefined }))}
          aria-pressed={!b.colour}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full px-2.5 ring-1",
            b.colour ? "ring-line hover:ring-ink/40" : "bg-ink text-canvas ring-ink",
          )}
        >
          <span className="size-3 rounded-full ring-1 ring-white/40" style={{ background: colour }} />
          Brand
        </button>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Button colour ${c}`}
            aria-pressed={b.colour === c}
            onClick={() => onChange({ colour: c })}
            className={cn(
              "size-7 rounded-full ring-1 ring-black/15",
              b.colour === c && "outline-2 outline-offset-2 outline-sun-line outline-solid",
            )}
            style={{ background: c }}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/15" title="Another colour">
          <span className="grid size-full place-items-center bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
          <input
            type="color"
            value={b.colour ?? colour}
            onChange={(e) => onChange({ colour: e.target.value.toLowerCase() })}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Another button colour"
          />
        </label>
      </div>
    </div>
  );
}

/** A panel behind the block: none, a few quiet colours, the brand colour or any other. Blocks in a row of one colour make one panel. */
const PANEL_SWATCHES = ["#f4f4f5", "#eef2ff", "#fff3ea", "#e8f5ec", "#26282c"];
function PanelColour({
  value,
  colour,
  label,
  onChange,
}: {
  value: string | null;
  colour: string;
  label: string;
  onChange: (fill: string | null) => void;
}) {
  const swatches = [...PANEL_SWATCHES, colour.toLowerCase()].filter((c, i, all) => all.indexOf(c) === i);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-surface p-2 text-[12px] text-ink ring-1 ring-line"
      onClick={(e) => e.stopPropagation()}
    >
      <PaintBucket className="size-3.5 text-muted" />
      <span className="text-muted">{label}</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn("h-7 rounded-full px-2.5 ring-1", value ? "ring-line hover:ring-ink/40" : "bg-ink text-canvas ring-ink")}
      >
        None
      </button>
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Panel colour ${c}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "size-7 rounded-full ring-1 ring-black/15",
            value === c && "outline-2 outline-offset-2 outline-sun-line outline-solid",
          )}
          style={{ background: c }}
        />
      ))}
      <label className="relative size-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/15" title="Another colour">
        <span className="grid size-full place-items-center bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] text-[10px]" />
        <input
          type="color"
          value={value ?? "#eef2ff"}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <span className="basis-full pt-0.5 text-[11px] text-muted">Blocks next to each other in one colour make one panel.</span>
    </div>
  );
}

/** Designed or a personal letter, with what in a letter would read as a newsletter. */
function LookPanel({ look, onLook, warnings }: { look: EdmLook; onLook: (l: EdmLook) => void; warnings: string[] }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-[14px] font-semibold text-ink">Look</p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1" role="radiogroup" aria-label="Look">
        {EDM_LOOKS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={look === l}
            onClick={() => onLook(l)}
            className={cn(
              "h-8 rounded-md text-[12px] font-medium",
              look === l ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink",
            )}
          >
            {EDM_LOOK_WORDS[l]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        {look === "letter"
          ? "Reads like an email from a person, which gives it the best chance of Gmail's Primary tab. Nothing can promise it: Gmail also learns from whether people open and reply."
          : "Your logo, colours and buttons. Gmail usually files designed emails under Promotions."}
      </p>
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] leading-snug text-[#9a5b00]">
          {warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The email's colours: its background and its words, each a picker with its hex, and a word when they won't read. */
function StylePanel({ style, onChange }: { style: EdmStyle; onChange: (s: EdmStyle, which: string) => void }) {
  const problem = styleProblem(style);
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-[14px] font-semibold text-ink">Style</p>
      <ColourField
        label="Background"
        value={style.background}
        onChange={(v) => onChange({ ...style, background: v }, "background")}
        reset={
          style.background === DEFAULT_STYLE.background
            ? null
            : () => onChange({ ...style, background: DEFAULT_STYLE.background }, "background")
        }
      />
      <ColourField
        label="Text colour"
        value={style.text ?? HEADING_INK}
        note={style.text ? undefined : `Ours: near-black headings, ${WORDS_INK} words`}
        onChange={(v) => onChange({ ...style, text: v }, "text")}
        reset={style.text ? () => onChange({ ...style, text: null }, "text") : null}
      />
      {problem && <p className="mt-2 text-[12px] leading-snug text-danger">{problem}</p>}
    </div>
  );
}

function ColourField({
  label,
  value,
  note,
  onChange,
  reset,
}: {
  label: string;
  value: string;
  note?: string;
  onChange: (v: string) => void;
  reset: (() => void) | null;
}) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-2">{label}</span>
        {reset && (
          <button type="button" onClick={reset} className="text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline">
            Back to ours
          </button>
        )}
      </div>
      <div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-2">
        <label
          className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-black/15"
          style={{ background: value }}
        >
          <span className="sr-only">Pick a colour for {label.toLowerCase()}</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim();
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          aria-label={`${label} as a hex colour`}
          className="w-full bg-transparent font-mono text-[13px] text-ink outline-none"
        />
      </div>
      {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}

/** A countdown as it will look: the timer as it stands now, the units and the end in words; until it has an end, a hint. */
function CountdownView({
  endsAt,
  colour,
  ink,
  align,
}: {
  endsAt: string | null;
  colour: string;
  ink: { heading: string; words: string };
  align: "left" | "center";
}) {
  if (!endsAt)
    return (
      <div className="mt-2 grid h-20 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <Timer className="size-4" /> Press to set when it ends
        </span>
      </div>
    );
  const src = `/api/m/t/${Math.round(endsAtMs(endsAt) / 1000)}.gif?c=${colour.replace("#", "")}`;
  return (
    <div className="mt-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={endsWords(endsAt)} className="block w-full" />
      <div className="grid grid-cols-4 pt-1.5">
        {COUNTDOWN_UNITS.map((u) => (
          <span key={u} className="text-center text-[11px] tracking-[0.08em] uppercase" style={{ color: ink.words }}>
            {u}
          </span>
        ))}
      </div>
      <p className="pt-2 text-[13px]" style={{ textAlign: align, color: ink.words }}>
        {endsWords(endsAt)}
      </p>
    </div>
  );
}

/** A countdown's settings: the day and time it ends, in the market's time, and how the timer behaves. */
function CountdownFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const [now] = useState(Date.now);
  const passed = b.endsAt ? endsAtMs(b.endsAt) <= now : false;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-left ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
      <label className="block text-[12px] text-muted">
        Ends (Melbourne time)
        <input
          type="datetime-local"
          value={b.endsAt ?? ""}
          onChange={(e) => onChange({ endsAt: cleanEndsAt(e.target.value) })}
          className={cn(field, "mt-1")}
        />
      </label>
      {passed && <p className="text-[12px] font-medium text-warning">That time has passed: the timer will show zeros.</p>}
      <p className="text-[12px] leading-snug text-muted">
        Each time someone opens the email, the timer shows the time left then and counts down for a minute. Where an inbox blocks pictures,
        the end in words still shows. Only set an end you&apos;ll keep to.
      </p>
    </div>
  );
}

/**
 * The business's logo at the top of the email (22 Nov 2026, Martin: "we need a clear upload business logo drop field"):
 * with none, a plain drop field that says what it is for; with one, the logo with Change and Remove. It is saved as the
 * business's marketing setting at once, so it heads every email, not only this one.
 */
function LogoField({
  brand,
  sender,
  ink,
  readOnly,
  onBrand,
}: {
  brand: EdmBrand;
  sender: EdmSender;
  ink: { heading: string; words: string };
  readOnly: boolean;
  onBrand?: (b: EdmBrand) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const files = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const keep = async (id: string | null) => {
    const r = await saveMarketingLogo(id);
    if (!r.ok) return setProblem(r.message);
    onBrand?.(r.settings.brand);
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    const r = await uploadMarketingImage(file, "logo");
    if (r.ok) await keep(r.id);
    else setProblem(r.message);
    setBusy(false);
  };
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(false);
      void upload(e.dataTransfer.files[0]);
    },
  };
  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  if (readOnly || !onBrand)
    return brand.logoId ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/m/i/${brand.logoId}`} alt={sender.name} className="mx-8 mb-2 block h-11 w-auto max-w-[240px]" />
    ) : (
      <p className="px-8 pb-2 text-[15px] font-bold" style={{ color: ink.heading }}>
        {sender.name}
      </p>
    );
  return (
    <div className="px-5 pb-2" onClick={(e) => e.stopPropagation()}>
      {picker}
      {brand.logoId ? (
        <div
          {...dropProps}
          className={cn(
            "group/logo relative flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-transparent hover:ring-line",
            over && "bg-sun/30 ring-sun-line",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/m/i/${brand.logoId}`} alt={sender.name} className="block h-11 w-auto max-w-[240px]" />
          <div className="ml-auto flex gap-1.5 opacity-0 transition-opacity group-focus-within/logo:opacity-100 group-hover/logo:opacity-100">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="h-8 rounded-full bg-surface px-3 text-[12px] font-medium text-ink ring-1 ring-line hover:ring-ink/40"
            >
              {busy ? "Uploading…" : "Change logo"}
            </button>
            <button
              type="button"
              onClick={() => void keep(null)}
              disabled={busy}
              className="h-8 rounded-full bg-surface px-3 text-[12px] font-medium text-ink ring-1 ring-line hover:ring-ink/40"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          {...dropProps}
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition-colors",
            over ? "border-sun-line bg-sun/30" : "border-line-strong hover:border-ink/40 hover:bg-canvas",
          )}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-muted">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-ink">{busy ? "Uploading your logo…" : "Add your business logo"}</span>
            <span className="block text-[12px] text-muted">
              Drop it here, or press to choose. A PNG with a clear background works best. It heads every email; until then,{" "}
              {sender.name || "your business name"} shows in words.
            </span>
          </span>
        </button>
      )}
      {problem && <p className="mt-1.5 px-1 text-[12px] text-warning">{problem}</p>}
    </div>
  );
}

/** A video block as it will look: its still with the play button and the line under it; until it has one, a hint. */
function VideoView({ block: b, colour, align }: { block: EdmBlock; colour: string; align: "left" | "center" }) {
  const key = videoStillKey(b.imageId, b.url);
  return (
    <div className="mt-1">
      {key ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/m/v/${key}.jpg?c=${colour.replace("#", "")}`} alt="" className="block w-full rounded-lg" />
      ) : (
        <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <CirclePlay className="size-4" /> Press to add the video&apos;s link
          </span>
        </div>
      )}
      <p className="pt-2.5 text-[14px] font-semibold" style={{ textAlign: align, color: colour }}>
        &#9654;&nbsp;{b.text || VIDEO_LINE}
      </p>
    </div>
  );
}

/**
 * A video block's settings: the link where it plays, the line under it, and the still (a YouTube link brings its own;
 * any other needs a picture). Mail apps don't play video, so the still and the line open the link.
 */
function VideoFields({ block: b, onChange }: { block: EdmBlock; onChange: (patch: BlockPatch) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const yt = youTubeId(b.url);
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
    <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-left ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
      <LinkInput
        value={b.url}
        onChange={(url) => onChange({ url: url && url.startsWith("https://") ? url : null })}
        placeholder="The video's link: YouTube, Vimeo, your website…"
      />
      <input
        value={b.text}
        maxLength={EDM_LIMITS.caption}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={`The line under it (blank: ${VIDEO_LINE})`}
        className={field}
      />
      <div
        className="flex flex-wrap items-center gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-[13px] hover:border-ink/40">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {b.imageId ? "Change the picture" : yt ? "Use my own picture" : "Choose a picture"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {b.imageId && (
          <button
            type="button"
            onClick={() => onChange({ imageId: null })}
            className="h-9 rounded-full px-3 text-[13px] text-muted hover:text-ink"
          >
            {yt ? "Use YouTube's picture" : "Remove the picture"}
          </button>
        )}
      </div>
      {problem && <p className="text-[12px] text-danger">{problem}</p>}
      <p className="text-[12px] leading-snug text-muted">
        {yt && !b.imageId
          ? "The video's own picture from YouTube is used, with a play button on it."
          : b.url && !b.imageId
            ? "Add a picture to show for the video: only YouTube links bring their own."
            : "Mail apps don't play video, so the picture and the line under it open the video's link."}
      </p>
    </div>
  );
}
