"use client";

/**
 * The proposal builder (15 Nov 2026, Martin: "the proposal builder should feel like a builder… you should have to toggle
 * to builder, because you may not always want to change the proposal"). Turned on above the business's preview of a
 * deal's proposal, it makes the preview the thing being built:
 *
 * - **Standard or Custom** (`BrandKit.design`): the standard design is every block in its usual place under the
 *   template; a custom design is the business's own, and publishing one is the paid add-on (`custom-proposals.ts`).
 * - Everyone: the logo and the cover photo dropped straight onto the page, and the colours and type.
 * - Custom: every block framed with its tools (drag to move, up and down, hide, its picture left, across or right, a
 *   dark ground for the blocks of the business's own words, its heading and words), a picture dropped onto any block,
 *   and the business's own blocks dragged in from the tray.
 *
 * What it never allows: a figure changed (they come from the design and are what the customer signs), the cover, the
 * price, going ahead or the terms taken out, the standard terms reworded, or anything placed freely (blocks sit in
 * fixed layouts, so they work on a phone and in the PDF). Every change is saved to the business's brand kit at once, so
 * it holds for its next proposals; the page here changes first, then the server's own preview catches up.
 */

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  ImagePlus,
  LayoutTemplate,
  Lock,
  Moon,
  PanelLeft,
  PanelRight,
  PanelTop,
  Pencil,
  Info,
  Plus,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BLOCKS,
  blockHeading,
  BLOCK_SET,
  blocksForView,
  isCustom,
  isFixed,
  isLocked,
  mayGoDark,
  moveBlock,
  viewBlocks,
  nextOwnBlock,
  placeBlock,
  type BlockId,
  type BlockSetting,
  type ViewBlock,
  STEP_LIMITS,
  TITLE_FIELDS,
  type StepWords,
} from "@/lib/domain/design/blocks";
import { CHART_STYLES, FONTS, type BrandImage, type BrandKit, type ImageKind } from "@/lib/domain/design/brand";
import { CHART_TONES, chartColours } from "@/lib/domain/design/proposal-charts";
import { ChartThumb } from "./proposal-thumbs";
import { customPriceWords } from "@/lib/domain/design/custom-proposals";
import { INDICATIVE_INTRO, INDICATIVE_STEPS, type ProposalView } from "@/lib/domain/design/proposal";
import { addBrandImage, loadBrand, removeBrandImage, saveBrand } from "@/lib/services/proposals";
import { ui } from "./design-shell";
import type { BuildHooks } from "./proposal-view";

const BLOCK_DRAG = "application/x-renuabl-block";
const NEW_BLOCK = "application/x-renuabl-new-block";
const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const nameOf = (id: BlockId) => BLOCKS.find((b) => b.id === id)?.name ?? id;
const pictureIn = (e: React.DragEvent) => [...e.dataTransfer.items].some((i) => i.kind === "file");

export interface Builder {
  ready: boolean;
  kit: BrandKit | null;
  images: BrandImage[];
  busy: string | null;
  problem: string | null;
  setProblem: (text: string | null) => void;
  /** Saves a change to the kit, showing it on the page first. */
  change: (patch: Partial<BrandKit>) => void;
  /** Puts a picture up for the logo, the cover or a block. */
  upload: (kind: ImageKind, file: File, block?: BlockId) => Promise<void>;
  setBlock: (id: BlockId, patch: Partial<BlockSetting>) => void;
  hooks: BuildHooks;
}

/**
 * The builder's state for one preview: the brand kit and its pictures, read once it is first turned on. `onView` puts
 * the change on the page at once; `onSaved` asks the server for its preview again (a moment after the last change).
 */
export function useProposalBuilder(
  on: boolean,
  view: ProposalView | null,
  onView: (view: ProposalView) => void,
  onSaved: () => void,
): Builder {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [images, setImages] = useState<BrandImage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlockId | null>(null);
  const [dropAt, setDropAt] = useState<{ id: BlockId; after: boolean } | null>(null);
  const [dragging, setDragging] = useState<BlockId | null>(null);
  const settle = useRef<number | null>(null);
  const latest = useRef({ view, kit, images });
  useEffect(() => {
    latest.current = { view, kit, images };
  });

  useEffect(() => {
    if (!on || kit) return;
    let gone = false;
    void loadBrand().then((res) => {
      if (gone) return;
      if (!res.ok) return setProblem(res.message);
      setKit(res.brand);
      setImages(res.images);
    });
    return () => {
      gone = true;
    };
  }, [on, kit]);

  /** The page as the kit now has it: its blocks, logo, cover, colours and type. */
  const show = (next: BrandKit, pics: BrandImage[]) => {
    const current = latest.current.view;
    if (!current) return;
    const pic = (kind: ImageKind) => pics.find((i) => i.kind === kind) ?? null;
    onView({
      ...current,
      business: { ...current.business, logo: pic("logo"), cover: pic("cover") },
      theme: {
        ...current.theme,
        primary: next.primary,
        accent: next.accent,
        font: next.font,
        chart: next.chart,
        ...(() => {
          const c = chartColours(next);
          return { chartFrom: c.from, chartTo: c.to };
        })(),
      },
      blocks: blocksForView(next.design, next.blocks, pics),
      blockSet: BLOCK_SET,
    });
  };

  const change = (patch: Partial<BrandKit>) => {
    const current = latest.current.kit;
    if (!current) return;
    const next = { ...current, ...patch };
    setKit(next);
    show(next, latest.current.images);
    void saveBrand(patch).then((res) => {
      if (!res.ok) return setProblem(res.message);
      setProblem(null);
      setKit(res.brand);
      if (settle.current) window.clearTimeout(settle.current);
      settle.current = window.setTimeout(onSaved, 700);
    });
  };

  const setBlock = (id: BlockId, patch: Partial<BlockSetting>) => {
    const current = latest.current.kit;
    if (current) change({ blocks: current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const upload = async (kind: ImageKind, file: File, block?: BlockId) => {
    if (!PICTURE_TYPES.includes(file.type)) return setProblem("Use a JPEG, PNG or WebP picture.");
    setBusy(block ?? kind);
    const res = await addBrandImage(kind, file);
    setBusy(null);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    let pics = res.images;
    const current = latest.current.kit;
    if (block && current) {
      // The picture it replaces is taken out of the kit (proposals already sent keep theirs), so the limit counts only what is in use.
      const before = current.blocks.find((b) => b.id === block)?.image;
      if (before) {
        const after = await removeBrandImage(before);
        if (after.ok) pics = after.images;
      }
      setImages(pics);
      latest.current.images = pics;
      setBlock(block, { image: res.image.id });
      return;
    }
    setImages(pics);
    latest.current.images = pics;
    if (current) show(current, pics);
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(onSaved, 400);
  };

  const custom = kit?.design === "custom";

  /** A drop on a block: a picture from the computer, a block being moved, or a new block of the business's own. */
  const dropOn = (e: React.DragEvent, target: BlockId) => {
    e.preventDefault();
    const at = dropAt;
    setDropAt(null);
    setDragging(null);
    if (!kit) return;
    const file = [...e.dataTransfer.files].find((f) => PICTURE_TYPES.includes(f.type));
    if (file) {
      if (!custom) return setProblem("Switch to a custom design to put pictures on the blocks.");
      if (isFixed(target)) return;
      void upload("block", file, target);
      return;
    }
    const index = kit.blocks.findIndex((b) => b.id === target) + (at?.after ? 1 : 0);
    const moving = e.dataTransfer.getData(BLOCK_DRAG) as BlockId;
    if (moving) return change({ blocks: placeBlock(kit.blocks, moving, index) });
    if (e.dataTransfer.getData(NEW_BLOCK)) {
      const id = nextOwnBlock(kit.blocks);
      if (!id) return setProblem("All six of your own blocks are on the proposal.");
      const shown = kit.blocks.map((b) => (b.id === id ? { ...b, on: true } : b));
      change({ blocks: placeBlock(shown, id, index) });
      setEditing(id);
    }
  };

  const hooks: BuildHooks = {
    logo: (node) => (
      <PictureSpot label="Drop your logo here" busy={busy === "logo"} onFile={(file) => void upload("logo", file)}>
        {node}
      </PictureSpot>
    ),
    cover: (node) => (
      <PictureSpot
        label="Drop a cover photo here"
        note="Shown by the Classic and Split templates"
        busy={busy === "cover"}
        onFile={(file) => void upload("cover", file)}
        wide
      >
        {node}
      </PictureSpot>
    ),
    // A picture is resized and moved in place on a custom design (15 Nov 2026, Martin).
    placePicture: (block: ViewBlock) => (custom && !isFixed(block.id) ? (place) => setBlock(block.id, place) : null),
    block: (block: ViewBlock, node) => {
      const setting = kit?.blocks.find((b) => b.id === block.id);
      const index = kit?.blocks.findIndex((b) => b.id === block.id) ?? -1;
      const line = dropAt?.id === block.id;
      const fixed = isFixed(block.id);
      const movable = custom && !fixed;
      const addHere = () => {
        if (!kit) return;
        const id = nextOwnBlock(kit.blocks);
        if (!id) return setProblem("All six of your own blocks are on the proposal.");
        const shown = kit.blocks.map((b) => (b.id === id ? { ...b, on: true } : b));
        change({ blocks: placeBlock(shown, id, index + 1) });
        setEditing(id);
      };
      return (
        <div
          key={block.id}
          className={clsx(
            // Every block a dashed box with its name on the edge (15 Nov 2026, Martin: "i cant tell whats customizable").
            "group/block relative rounded-2xl border-2 border-dashed px-4 pb-5 pt-7 transition-colors sm:px-6",
            movable
              ? "border-sun-line/45 hover:border-sun-line hover:bg-sun-line/[0.03]"
              : "border-line-strong/70 hover:border-line-strong",
          )}
          onDragOver={(e) => {
            if (!custom && !pictureIn(e)) return;
            e.preventDefault();
            const box = e.currentTarget.getBoundingClientRect();
            setDropAt({ id: block.id, after: e.clientY > box.top + box.height / 2 });
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt((d) => (d?.id === block.id ? null : d));
          }}
          onDrop={(e) => dropOn(e, block.id)}
        >
          {line && dragging !== block.id && (
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute inset-x-0 z-20 h-1 rounded-full bg-sun-line",
                dropAt.after ? "-bottom-[27px]" : "-top-[27px]",
              )}
            />
          )}
          {!custom && (
            <span className="absolute -top-[15px] left-3 z-30 inline-flex h-7 items-center gap-1.5 rounded-md bg-surface px-2 text-[12px] font-medium text-ink-2 shadow-sm ring-1 ring-line">
              <Lock className="size-3.5 text-muted" aria-hidden />
              {nameOf(block.id)}
              <button
                type="button"
                onClick={() => change({ design: "custom" })}
                className="ml-1 hidden rounded px-1.5 py-0.5 text-[11.5px] font-medium text-sun-ink hover:bg-sun group-hover/block:inline"
              >
                Switch to Custom to move or change it
              </button>
            </span>
          )}
          {custom && setting && (
            <BlockTools
              setting={setting}
              first={index <= 1}
              last={index >= (kit?.blocks.length ?? 0) - 2}
              busy={busy === block.id}
              editing={editing === block.id}
              onEdit={() => setEditing(editing === block.id ? null : block.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData(BLOCK_DRAG, block.id);
                e.dataTransfer.effectAllowed = "move";
                setDragging(block.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropAt(null);
              }}
              onMove={(by) => {
                if (!kit) return;
                // Past whatever isn't on the page, so each press moves it on the page.
                const onPage = new Set((view ? viewBlocks(view) : []).map((b) => b.id));
                change({ blocks: moveBlock(kit.blocks, block.id, by, (id) => !view || onPage.has(id)) });
              }}
              onSet={(patch) => setBlock(block.id, patch)}
              onPicture={(file) => void upload("block", file, block.id)}
              onRemovePicture={() => {
                if (setting.image) void removeBrandImage(setting.image).then((res) => res.ok && setImages(res.images));
                setBlock(block.id, { image: null });
              }}
            />
          )}
          {kit && (block.id === "production" || block.id === "bill") && (
            <div className="mb-4 rounded-xl bg-surface p-2.5 shadow-sm ring-1 ring-line">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Chart style</p>
              <ChartPicker kit={kit} onChange={change} inline />
            </div>
          )}
          <div className={clsx(dragging === block.id && "opacity-40")}>{node}</div>
          {custom && setting && editing === block.id && (
            <BlockWords setting={setting} onSet={(patch) => setBlock(block.id, patch)} onDone={() => setEditing(null)} />
          )}
          {movable && !isFixed(kit?.blocks[index + 1]?.id ?? "terms") && nextOwnBlock(kit?.blocks ?? []) && (
            // Between this block and the next: a place to add a block of their own, lit as the pointer comes to it.
            <button
              type="button"
              onClick={addHere}
              className="group/add absolute inset-x-0 top-[calc(100%+6px)] z-20 flex h-9 items-center justify-center"
              aria-label="Add a block of your own here"
            >
              <span
                aria-hidden
                className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-sun-line/0 group-hover/add:border-sun-line/60"
              />
              <span className="relative inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-muted opacity-0 shadow-sm ring-1 ring-line transition-opacity group-hover/add:text-sun-ink group-hover/add:opacity-100 group-hover/add:ring-sun-line focus-visible:opacity-100">
                <Plus className="size-3.5" aria-hidden /> Add a block here
              </span>
            </button>
          )}
        </div>
      );
    },
  };

  return { ready: Boolean(kit), kit, images, busy, problem, setProblem, change, upload, setBlock, hooks };
}

/** A place on the page a picture is dropped on (or picked for, by pressing it). */
function PictureSpot(props: {
  label: string;
  note?: string;
  busy: boolean;
  wide?: boolean;
  onFile: (file: File) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <div
      className={clsx(
        "group/spot relative rounded-xl outline-dashed outline-2 outline-offset-[6px]",
        over ? "outline-solid outline-sun-line" : "outline-sun-line/45 hover:outline-sun-line",
      )}
      onDragOver={(e) => {
        if (!pictureIn(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const file = [...e.dataTransfer.files][0];
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        props.onFile(file);
      }}
    >
      {props.children}
      <button
        type="button"
        onClick={() => pick.current?.click()}
        className={clsx(
          "absolute z-10 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg backdrop-blur",
          props.wide ? "right-3 top-3" : "-right-2 top-1/2 translate-x-full -translate-y-1/2",
          over || props.busy ? "opacity-100" : "opacity-0 group-hover/spot:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Upload className="size-3.5" aria-hidden />
        {props.busy ? "Putting it up…" : over ? "Let go to use it" : props.label}
        {props.note && !over && !props.busy && <span className="text-white/60">· {props.note}</span>}
      </button>
      <input
        ref={pick}
        type="file"
        accept={PICTURE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) props.onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** A block's tools, along its top on hover: move, picture, layout, ground, words, hide. */
function BlockTools(props: {
  setting: BlockSetting;
  first: boolean;
  last: boolean;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (by: -1 | 1) => void;
  onSet: (patch: Partial<BlockSetting>) => void;
  onPicture: (file: File) => void;
  onRemovePicture: () => void;
}) {
  const { setting } = props;
  const pick = useRef<HTMLInputElement>(null);
  const fixed = isFixed(setting.id);
  // The cover is always first: its title, words and picture change, but it never moves.
  const pinned = setting.id === "cover";
  const tool = "flex size-7 items-center justify-center rounded-md text-white/85 hover:bg-white/15 hover:text-white disabled:opacity-30";
  const lit = "bg-white/20 text-white";
  return (
    <div className={clsx("absolute -top-[17px] left-3 z-30 flex h-8 items-center gap-0.5 rounded-lg bg-ink px-1 shadow-lg")}>
      {!fixed && !pinned && (
        <span
          draggable
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          title="Drag to move"
          className={clsx(tool, "cursor-grab active:cursor-grabbing")}
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
      )}
      <span className="px-1.5 text-[12px] font-medium text-white">{nameOf(setting.id)}</span>
      {fixed ? (
        <span className="inline-flex items-center gap-1 px-1.5 text-[11.5px] text-white/60">
          <Lock className="size-3" aria-hidden /> Always last, never reworded
        </span>
      ) : (
        <span
          className={clsx(
            "items-center gap-0.5",
            props.editing || props.busy ? "flex" : "hidden group-hover/block:flex group-focus-within/block:flex",
          )}
        >
          {!pinned && (
            <>
              <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
              <button
                type="button"
                className={tool}
                disabled={props.first}
                onClick={() => props.onMove(-1)}
                title="Move up"
                aria-label="Move up"
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={tool}
                disabled={props.last}
                onClick={() => props.onMove(1)}
                title="Move down"
                aria-label="Move down"
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
            </>
          )}
          <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            className={clsx(tool, props.editing && lit)}
            onClick={props.onEdit}
            title={pinned ? "Title and words" : "Heading and words"}
            aria-label={pinned ? "Title and words" : "Heading and words"}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            onClick={() => pick.current?.click()}
            title={setting.image ? "Change the picture" : "Add a picture"}
            aria-label="Picture"
          >
            <ImagePlus className="size-4" aria-hidden />
          </button>
          {setting.image && (
            <>
              {(
                [
                  ["left", PanelLeft, "Picture on the left"],
                  ["stack", PanelTop, "Picture across"],
                  ["right", PanelRight, "Picture on the right"],
                ] as const
              ).map(([layout, Icon, label]) => (
                <button
                  key={layout}
                  type="button"
                  className={clsx(tool, setting.layout === layout && lit)}
                  onClick={() => props.onSet({ layout })}
                  title={label}
                  aria-label={label}
                  aria-pressed={setting.layout === layout}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                className={tool}
                onClick={props.onRemovePicture}
                title="Take the picture off"
                aria-label="Take the picture off"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </>
          )}
          {mayGoDark(setting.id) && (
            <button
              type="button"
              className={tool}
              onClick={() => props.onSet({ tone: setting.tone === "dark" ? "light" : "dark" })}
              title={setting.tone === "dark" ? "Light ground" : "Dark ground"}
              aria-label={setting.tone === "dark" ? "Light ground" : "Dark ground"}
            >
              {setting.tone === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </button>
          )}
          {!isLocked(setting.id) && (
            <>
              <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
              <button
                type="button"
                className={tool}
                onClick={() => props.onSet({ on: false })}
                title="Hide this block"
                aria-label="Hide this block"
              >
                <EyeOff className="size-4" aria-hidden />
              </button>
            </>
          )}
          {props.busy && <span className="px-1.5 text-[11.5px] text-white/70">Putting it up…</span>}
        </span>
      )}
      <input
        ref={pick}
        type="file"
        accept={PICTURE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) props.onPicture(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** A block's own heading and words, written under it. Saved a moment after typing stops. */
function BlockWords({
  setting,
  onSet,
  onDone,
}: {
  setting: BlockSetting;
  onSet: (patch: Partial<BlockSetting>) => void;
  onDone: () => void;
}) {
  const [heading, setHeading] = useState(setting.heading);
  const [words, setWords] = useState(setting.words);
  // How we work's three steps, in the business's words (blank is ours).
  const [steps, setSteps] = useState<StepWords[]>(() =>
    INDICATIVE_STEPS.map((_, i) => ({ name: setting.steps?.[i]?.name ?? "", words: setting.steps?.[i]?.words ?? "" })),
  );
  const how = setting.id === "how";
  const cover = setting.id === "cover";
  const wait = useRef<number | null>(null);
  const later = (patch: Partial<BlockSetting>) => {
    if (wait.current) window.clearTimeout(wait.current);
    wait.current = window.setTimeout(() => onSet(patch), 600);
  };
  const usual = blockHeading({ id: setting.id, heading: "" });
  return (
    <div className="theme-studio relative z-20 mt-4 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)]">
      <label className={ui.label}>
        {cover ? "Title" : "Heading"}
        <input
          className={clsx(ui.input, "mt-1.5")}
          value={heading}
          maxLength={80}
          placeholder={cover ? "{firstName}'s home, powered by the sun" : usual || "A heading of your own"}
          onChange={(e) => {
            setHeading(e.target.value);
            later({ heading: e.target.value, words, ...(how ? { steps } : {}) });
          }}
        />
      </label>
      <label className={clsx(ui.label, "mt-3 block")}>
        {how ? "Its opening line" : `Your words ${isCustom(setting.id) ? "" : "(shown at the top of this block)"}`}
        <textarea
          className={clsx(ui.input, "mt-1.5 py-2", how ? "min-h-16" : "min-h-24")}
          value={words}
          maxLength={1500}
          placeholder={how ? INDICATIVE_INTRO : undefined}
          onChange={(e) => {
            setWords(e.target.value);
            later({ heading, words: e.target.value, ...(how ? { steps } : {}) });
          }}
        />
      </label>
      {how &&
        INDICATIVE_STEPS.map((usual, i) => (
          <fieldset key={i} className="mt-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-xs font-medium text-muted">
              Step {i + 1}
              {i === 0 ? " · You are here" : ""}
            </legend>
            <input
              className={ui.input}
              value={steps[i].name}
              maxLength={STEP_LIMITS.name}
              placeholder={usual.name}
              aria-label={`Step ${i + 1}'s name`}
              onChange={(e) => {
                const next = steps.map((s, j) => (j === i ? { ...s, name: e.target.value } : s));
                setSteps(next);
                later({ heading, words, steps: next });
              }}
            />
            <textarea
              className={clsx(ui.input, "mt-2 min-h-16 py-2")}
              value={steps[i].words}
              maxLength={STEP_LIMITS.words}
              placeholder={usual.words}
              aria-label={`Step ${i + 1}'s words`}
              onChange={(e) => {
                const next = steps.map((s, j) => (j === i ? { ...s, words: e.target.value } : s));
                setSteps(next);
                later({ heading, words, steps: next });
              }}
            />
          </fieldset>
        ))}
      <p className="mt-2 text-xs text-muted">
        {cover
          ? `The title is used on every proposal: write ${TITLE_FIELDS} to fill in each customer's. Blank keeps ours.`
          : how
            ? "Anything left blank keeps our wording, shown faint in the box."
            : "The figures in a block come from the design, so they can't be written over here."}
      </p>
      <button
        type="button"
        className={clsx(ui.quiet, "mt-3")}
        onClick={() => {
          if (wait.current) window.clearTimeout(wait.current);
          onSet({ heading, words, ...(how ? { steps } : {}) });
          onDone();
        }}
      >
        Done
      </button>
    </div>
  );
}

/** A line of help kept behind a small mark, shown on hover or focus (19 Nov 2026, Martin: "alot of explainer text"). */
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="group/hint relative inline-flex align-middle">
      <button type="button" aria-label="What this is" className="rounded-full text-muted hover:text-ink focus-visible:text-ink">
        <Info className="size-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden w-60 rounded-lg bg-ink px-3 py-2 text-[12px] font-normal leading-snug tracking-normal text-canvas shadow-lg group-focus-within/hint:block group-hover/hint:block"
      >
        {children}
      </span>
    </span>
  );
}

/**
 * How the charts are drawn and in what colours. In the side panel, and `inline` on the chart's own block on the page,
 * so a style is tried where it shows (19 Nov 2026, Martin: "im having to scroll back up to find the chart options").
 */
function ChartPicker({ kit, onChange, inline }: { kit: BrandKit; onChange: (patch: Partial<BrandKit>) => void; inline?: boolean }) {
  return (
    <div>
      <div className={inline ? "flex flex-wrap gap-1.5" : "mt-1.5 grid grid-cols-3 gap-1.5"}>
        {CHART_STYLES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={kit.chart === c.id}
            title={c.blurb}
            onClick={() => onChange({ chart: c.id })}
            className={clsx(
              "rounded-lg border bg-surface text-left",
              inline ? "px-2.5 py-1 text-[12px] font-medium text-ink" : "p-1.5",
              kit.chart === c.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
            )}
          >
            {inline ? (
              c.name
            ) : (
              <>
                <span className="block [&>div]:h-10">
                  <ChartThumb style={c.id} theme={kit} />
                </span>
                <span className="mt-1 block text-[11.5px] font-medium text-ink">{c.name}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {(kit.chart === "live" || kit.chart === "ring") && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CHART_TONES.map((t) => {
            const c = chartColours({ ...kit, chartTone: t.id });
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={kit.chartTone === t.id}
                title={t.blurb}
                onClick={() => onChange({ chartTone: t.id })}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border bg-surface py-1 pl-1 pr-2.5 text-[12px] text-ink",
                  kit.chartTone === t.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
                )}
              >
                <span className="size-4 rounded-full" style={{ background: `linear-gradient(to top, ${c.from}, ${c.to})` }} aria-hidden />
                {t.name}
              </button>
            );
          })}
          {kit.chartTone === "own" &&
            (["chartFrom", "chartTo"] as const).map((k) => (
              <input
                key={k}
                type="color"
                aria-label={k === "chartFrom" ? "The chart's bottom colour" : "The chart's top colour"}
                className="h-7 w-9 cursor-pointer rounded-md border border-line bg-surface"
                value={kit[k]}
                onChange={(e) => onChange({ [k]: e.target.value })}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/** The builder's side panel: the design (standard or custom), the brand, and in a custom design the tray of blocks. */
export function BuilderPanel({ builder, customAllowed }: { builder: Builder; customAllowed: boolean }) {
  const { kit } = builder;
  if (!kit) return <p className="text-sm text-muted">{builder.problem ?? "Opening the builder…"}</p>;
  const custom = kit.design === "custom";
  const hidden = kit.blocks.filter((b) => !b.on && !isCustom(b.id));
  const ownLeft = kit.blocks.filter((b) => isCustom(b.id) && !b.on).length;
  const addOwn = () => {
    const id = nextOwnBlock(kit.blocks);
    if (!id) return;
    // A new block of their own goes just before going ahead, where it reads as part of the story.
    const shown = kit.blocks.map((b) => (b.id === id ? { ...b, on: true } : b));
    builder.change({
      blocks: placeBlock(
        shown,
        id,
        shown.findIndex((b) => b.id === "accept"),
      ),
    });
  };
  return (
    <div className="space-y-5">
      {builder.problem && (
        <p className="text-sm text-danger" role="alert">
          {builder.problem}
        </p>
      )}
      <fieldset>
        <legend className={clsx(ui.label, "flex items-center gap-1.5")}>
          Design
          <Hint>
            {custom
              ? "Each dashed box on the page is a block. Drag one by its handle to move it, hover it for its picture, words and layout, or add a block between two."
              : "Each dashed box on the page is a block. In Standard they keep their usual order: switch to Custom to move them, add your own and put pictures on them."}
          </Hint>
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="radiogroup">
          {(
            [
              ["standard", "Standard", "Your template, logo, cover and colours. Included."],
              ["custom", "Custom", "Your own blocks, pictures and layout."],
            ] as const
          ).map(([id, name, blurb]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kit.design === id}
              title={blurb}
              onClick={() => builder.change({ design: id })}
              className={clsx(
                "rounded-md border px-3 py-1.5 text-center",
                kit.design === id ? "border-ink bg-surface-2" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block text-sm font-medium text-ink">{name}</span>
            </button>
          ))}
        </div>
        {custom && (
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
            {customPriceWords()}
            {!customAllowed && " Publishing a custom design needs the add-on."}
          </p>
        )}
      </fieldset>

      <div>
        <p className={clsx(ui.label, "flex items-center gap-1.5")}>
          Your brand
          <Hint>Drop your logo onto the top of the proposal and a cover photo onto its cover, or press them to pick a picture.</Hint>
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-2">
            Main colour
            <input
              type="color"
              className="mt-1 block h-7 w-full cursor-pointer rounded-md border border-line bg-surface"
              value={kit.primary}
              onChange={(e) => builder.change({ primary: e.target.value })}
            />
          </label>
          <label className="text-xs text-ink-2">
            Second colour
            <input
              type="color"
              className="mt-1 block h-7 w-full cursor-pointer rounded-md border border-line bg-surface"
              value={kit.accent}
              onChange={(e) => builder.change({ accent: e.target.value })}
            />
          </label>
        </div>
        <fieldset className="mt-3">
          <legend className={ui.label}>Type</legend>
          {/* Each choice set in its own faces, so it is picked by eye (15 Nov 2026, Martin: more font styles). */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FONTS.map((f) => {
              const on = kit.font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  title={`${f.blurb} ${f.pdf}`}
                  onClick={() => builder.change({ font: f.id })}
                  style={{ fontFamily: f.heading }}
                  className={clsx(
                    "rounded-full border bg-surface px-3 py-1 text-[13px] text-ink transition-colors",
                    on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
                  )}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        {/* How the output and saving are drawn, and in what colours (19 Nov 2026, Martin: "allow for the colours to be customized"). */}
        <fieldset className="mt-3">
          <legend className={ui.label}>Charts</legend>
          <ChartPicker kit={kit} onChange={builder.change} />
        </fieldset>
      </div>

      {custom ? (
        <div>
          <p className={clsx(ui.label, "flex items-center gap-1.5")}>
            Add to the proposal
            <Hint>
              Drag a block of your own onto the page where you want it, or press it. Hover over any block to move it, give it a picture or
              change its words. The cover, the price, going ahead and the terms always stay on, and no figure can be written over: they come
              from the design and are what your customer signs.
            </Hint>
          </p>
          <button
            type="button"
            draggable={ownLeft > 0}
            disabled={ownLeft === 0}
            onDragStart={(e) => {
              e.dataTransfer.setData(NEW_BLOCK, "1");
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={addOwn}
            title="Words and a picture: your team, a past job, why you."
            className="mt-1.5 flex w-full cursor-grab items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2 text-left hover:border-sun-line active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-sun text-sun-ink">
              <Plus className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">A block of your own</span>
              <span className="block text-xs text-muted">{ownLeft > 0 ? `${ownLeft} left` : "All six are on the proposal."}</span>
            </span>
          </button>
          {hidden.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-2">Hidden</p>
              <ul className="mt-1.5 space-y-1">
                {hidden.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink"
                  >
                    {nameOf(b.id)}
                    <button type="button" className={ui.link} onClick={() => builder.setBlock(b.id, { on: true })}>
                      Show
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <LayoutTemplate className="size-4 text-ink-2" aria-hidden /> Make it your own
            <Hint>
              A custom design lets you move every block, add your own with words and pictures, put pictures beside the words and give blocks
              a dark ground.
            </Hint>
          </p>
          <button type="button" className={clsx(ui.primary, "mt-2")} onClick={() => builder.change({ design: "custom" })}>
            Start a custom design
          </button>
        </div>
      )}
    </div>
  );
}
