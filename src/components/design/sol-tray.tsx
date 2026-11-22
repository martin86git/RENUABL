"use client";

/**
 * Sol holds the designer's tools on a phone held upright (21 Nov 2026, Martin: "sol becoming the repository for the
 * tools", and "use sol for things like tap 1 deg 5 deg"). The picture stays clear: pressing Sol brings up a tray over
 * the lower part of the screen with the way to ask him in words and every tool in groups; picking one folds it away.
 * With panels picked, Sol's card in place of the dial turns them, lays them portrait or landscape, tilts or removes them.
 */
import { clsx } from "clsx";
import {
  Cable,
  ChevronRight,
  Eraser,
  Hand,
  House,
  Maximize,
  Minus,
  MessageCircle,
  MousePointer2,
  PenTool,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  SunMedium,
  Tag,
  Trash2,
  TriangleRight,
  Plus,
  Undo2,
  WandSparkles,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SolMark } from "./sol-sun";

type TrayTool = "select" | "panel" | "erase" | "trace" | "string" | "rule" | "label" | "comment" | "pan";

const GROUPS: { title: string; items: { tool: TrayTool; icon: LucideIcon; name: string }[] }[] = [
  {
    title: "Draw",
    items: [
      { tool: "select", icon: MousePointer2, name: "Select" },
      { tool: "erase", icon: Eraser, name: "Erase" },
      { tool: "trace", icon: PenTool, name: "Trace roof" },
    ],
  },
  {
    title: "Wire and mark",
    items: [
      { tool: "string", icon: Cable, name: "Strings" },
      { tool: "rule", icon: Ruler, name: "Guide line" },
      { tool: "label", icon: Tag, name: "Label" },
      { tool: "comment", icon: MessageCircle, name: "Comment" },
    ],
  },
];

function Item(props: { icon: ReactNode; name: string; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.on}
      className="flex w-[4.25rem] flex-col items-center gap-1 text-[10.5px] leading-tight text-white/80 disabled:opacity-40"
    >
      <span
        className={clsx(
          "flex size-10 items-center justify-center rounded-full",
          props.on ? "bg-sun-line text-white" : "bg-white/10 text-white",
        )}
      >
        {props.icon}
      </span>
      {props.name}
    </button>
  );
}

export function SolTray(props: {
  open: boolean;
  onClose: () => void;
  onAsk: () => void;
  tool: string;
  onTool: (tool: TrayTool) => void;
  shadeOn: boolean;
  onShade: () => void;
  drawn: boolean;
  onDrawn: () => void;
  zooming: boolean;
  onZoom: () => void;
  pitchShown: boolean;
  onPitch: () => void;
  pitchWords: string;
  onDesignForMe?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onWhole: () => void;
  /** The house from its sides (Nearmap), when it can be had: its own button and window. */
  sides?: ReactNode;
  /** Which picture is under the design (Google or Nearmap). */
  pictureMenu?: ReactNode;
  /** Room left at the tray's foot for the designer's own row (save, ready, designs, record and the rest). */
  footRoom: number;
}) {
  if (!props.open) return null;
  const pick = (tool: TrayTool) => {
    props.onTool(tool);
    props.onClose();
  };
  const then = (act: () => void) => () => {
    act();
    props.onClose();
  };
  return (
    <>
      {/* A press on the picture above it puts the tray away. */}
      <div className="fixed inset-0 z-[94] bg-black/25" onClick={props.onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Sol's tools"
        data-popup
        className="fixed inset-x-0 bottom-0 z-[95] mx-auto flex max-h-[88dvh] max-w-[52rem] flex-col rounded-t-[22px] bg-[#26282c] text-white shadow-[0_-12px_32px_rgba(0,0,0,0.35)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/25" aria-hidden />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                props.onClose();
                props.onAsk();
              }}
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white/10 pl-1.5 pr-4 text-left text-[13px] text-white/70"
            >
              <span className="sol-orb flex size-8 shrink-0 items-center justify-center rounded-full">
                <SolMark className="size-[26px]" />
              </span>
              <span className="min-w-0 flex-1 truncate">Ask Sol to change the design</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              onClick={props.onClose}
              aria-label="Put Sol's tools away"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {/* Sideways (a wide, short screen) the groups sit two across, so more of them fit before it scrolls. */}
          <div className="sm:grid sm:grid-cols-2 sm:gap-x-6">
            {GROUPS.map((group) => (
              <section key={group.title} className="mt-2.5">
                <h4 className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/50">{group.title}</h4>
                <div className="grid grid-cols-4 justify-items-center gap-y-2">
                  {group.items.map(({ tool, icon: Icon, name }) => (
                    <Item
                      key={tool}
                      icon={<Icon className="size-[18px]" aria-hidden />}
                      name={name}
                      on={props.tool === tool}
                      onClick={() => pick(tool)}
                    />
                  ))}
                </div>
              </section>
            ))}
            <section className="mt-2.5">
              <h4 className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/50">Check</h4>
              <div className="grid grid-cols-4 justify-items-center gap-y-2">
                <Item
                  icon={<SunMedium className="size-[18px]" aria-hidden />}
                  name="Shade"
                  on={props.shadeOn}
                  onClick={then(props.onShade)}
                />
                <Item
                  icon={<TriangleRight className="size-[18px]" aria-hidden />}
                  name={props.pitchWords}
                  on={props.pitchShown}
                  onClick={then(props.onPitch)}
                />
                <Item
                  icon={<WandSparkles className="size-[18px]" aria-hidden />}
                  name="Design it for me"
                  onClick={then(() => props.onDesignForMe?.())}
                  disabled={!props.onDesignForMe}
                />
              </div>
            </section>
            <section className="mt-2.5">
              <h4 className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/50">View</h4>
              <div className="grid grid-cols-4 justify-items-center gap-y-2">
                <Item
                  icon={<Search className="size-[18px]" aria-hidden />}
                  name="Pinch zoom"
                  on={props.zooming}
                  onClick={then(props.onZoom)}
                />
                <Item
                  icon={<Hand className="size-[18px]" aria-hidden />}
                  name="Move map"
                  on={props.tool === "pan"}
                  onClick={() => pick("pan")}
                />
                <Item icon={<Maximize className="size-[18px]" aria-hidden />} name="Whole map" onClick={then(props.onWhole)} />
                <Item
                  icon={<House className="size-[18px]" aria-hidden />}
                  name={props.drawn ? "Photo" : "Drawn roof"}
                  onClick={then(props.onDrawn)}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Item icon={<Undo2 className="size-[18px]" aria-hidden />} name="Undo" onClick={props.onUndo} />
                <Item icon={<Redo2 className="size-[18px]" aria-hidden />} name="Redo" onClick={props.onRedo} />
                {props.sides && <div className="rounded-full bg-white/10 p-0.5">{props.sides}</div>}
                {props.pictureMenu && <div className="ml-auto">{props.pictureMenu}</div>}
              </div>
            </section>
          </div>
        </div>
        {/* The designer's own row (save, ready to install, strings, shade, record and the rest) stands in this strip. */}
        <div
          className="shrink-0 border-t border-white/10 px-3.5 pt-1.5"
          style={{ height: `calc(${props.footRoom}px + env(safe-area-inset-bottom))` }}
        >
          <h4 className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/50">This design</h4>
        </div>
      </div>
    </>
  );
}

/** Where Sol's round sits on a plate moulded round him: the notch cut out of its top edge. */
export const solNotch = (centreY: number, radius = 27) => {
  const mask = `radial-gradient(circle ${radius}px at 50% ${centreY}px, transparent ${radius - 0.5}px, #000 ${radius + 0.5}px)`;
  return { WebkitMaskImage: mask, maskImage: mask };
};

/**
 * Sol's controller for what is picked (22 Nov 2026, Martin: "it should feel like a controller… the +1 and -1 should be
 * positioned so that the left thumb and right thumb can engage in tapping"; only ±1°; the tool bar "molded around sol…
 * not to overlay the map"). Upright it is a plate under the picture with a notch where Sol's round sits, turning a
 * degree anticlockwise under the left thumb and clockwise under the right, and between them portrait or landscape, the
 * tilt and delete. Sideways the two thumbs sit in the picture's bottom corners and the rest is a slim pill round Sol.
 * Undo comes into sight once anything changes while panels are picked (`canUndo`).
 */
export function SolController(props: {
  layout: "upright" | "sideways";
  count: number;
  panels: number;
  tilt: number | null;
  facing: string | null;
  landscape: boolean | null;
  canUndo: boolean;
  onUndo: () => void;
  onTurn: (degrees: number) => void;
  onLandscape: (landscape: boolean) => void;
  onTilt: (by: number) => void;
  onDelete: () => void;
  onDone: () => void;
  /** Upright: how tall the plate is. */
  height?: number;
}) {
  const upright = props.layout === "upright";
  const what = props.panels ? `${props.panels} panel${props.panels === 1 ? "" : "s"}` : `${props.count} picked`;
  const detail = [props.tilt !== null && props.panels ? `${props.tilt}°` : null, props.panels ? props.facing : null]
    .filter(Boolean)
    .join(" · ");
  const seg = "flex items-center rounded-xl bg-white/[0.08] p-[3px]";
  const small = "flex items-center justify-center rounded-[9px] text-white/85 hover:bg-white/10";
  const thumb = (by: -1 | 1) => {
    const Turn = by < 0 ? RotateCcw : RotateCw;
    return (
      <button
        type="button"
        onClick={() => props.onTurn(by)}
        aria-label={`Turn 1 degree ${by < 0 ? "anticlockwise" : "clockwise"}`}
        className={clsx(
          "pointer-events-auto flex flex-col items-center justify-center rounded-full bg-[#3a3d43] text-white shadow-[0_6px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10 active:scale-95 active:bg-[#4a4e55] motion-reduce:active:scale-100",
          upright ? "size-[4.25rem]" : "size-[3.4rem]",
        )}
      >
        <Turn className={upright ? "size-6" : "size-5"} aria-hidden />
        <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-white/80">1°</span>
      </button>
    );
  };
  const orient = props.panels > 0 && (
    <div className={seg} role="radiogroup" aria-label="Portrait or landscape">
      {([false, true] as const).map((land) => (
        <button
          key={String(land)}
          type="button"
          role="radio"
          aria-checked={props.landscape === land}
          aria-label={land ? "Landscape" : "Portrait"}
          onClick={() => props.onLandscape(land)}
          className={clsx(
            "flex h-8 w-9 items-center justify-center rounded-[9px]",
            props.landscape === land ? "bg-white text-[#1d1f23]" : "text-white/75 hover:bg-white/10",
          )}
        >
          <span
            className={clsx("rounded-[2px] border-[1.5px] border-current", land ? "h-[9px] w-[15px]" : "h-[15px] w-[9px]")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
  const tilt = props.panels > 0 && (
    <div className={seg} role="group" aria-label="Tilt">
      <button type="button" onClick={() => props.onTilt(-1)} aria-label="Tilt down a degree" className={clsx(small, "h-8 w-8")}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="min-w-[3.25rem] text-center text-[12px] tabular-nums">
        <span className="text-white/55">tilt </span>
        <b className="font-semibold">{props.tilt === null ? "–" : `${props.tilt}°`}</b>
      </span>
      <button type="button" onClick={() => props.onTilt(1)} aria-label="Tilt up a degree" className={clsx(small, "h-8 w-8")}>
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
  const remove = (
    <button
      type="button"
      onClick={props.onDelete}
      aria-label="Delete what is picked"
      className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-[#ff6b5e] hover:bg-white/15"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
  const undo = props.canUndo && (
    <button
      type="button"
      onClick={props.onUndo}
      aria-label="Undo"
      className="sol-emerge flex h-8 shrink-0 items-center gap-1 rounded-full bg-sun-line pl-2 pr-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(255,90,31,0.45)]"
    >
      <Undo2 className="size-3.5" aria-hidden />
      Undo
    </button>
  );
  const done = (
    <button
      type="button"
      onClick={props.onDone}
      aria-label="Pick none"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );

  if (upright)
    return (
      <div
        role="group"
        aria-label="What is picked"
        className="pointer-events-auto relative rounded-t-[26px] bg-[#26282c] text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
        style={{ height: props.height ?? 140, ...solNotch(0, 24) }}
      >
        {/* Beside Sol's notch: what is picked on the left; undo and pick none on the right. */}
        <div className="absolute inset-x-3 top-2 flex items-center">
          <p className="w-[calc(50%-2.25rem)] min-w-0 truncate text-[12px] text-white/60">
            <b className="font-semibold text-white">{what}</b>
            {detail && ` · ${detail}`}
          </p>
          <span className="w-[3.75rem] shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            {undo}
            {done}
          </div>
        </div>
        {/* The thumbs, in the two bottom corners; between them portrait or landscape, the tilt and delete. */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          {props.panels > 0 ? thumb(-1) : <span />}
          <div className="flex min-w-0 flex-col items-center gap-1.5 pb-0.5">
            <div className="flex items-center gap-1.5">
              {orient}
              {remove}
            </div>
            {tilt}
          </div>
          {props.panels > 0 ? thumb(1) : <span />}
        </div>
      </div>
    );

  return (
    <div role="group" aria-label="What is picked" className="pointer-events-none absolute inset-0">
      {props.panels > 0 && <div className="absolute bottom-3 left-3">{thumb(-1)}</div>}
      {props.panels > 0 && <div className="absolute bottom-3 right-3">{thumb(1)}</div>}
      <div
        className="pointer-events-auto absolute bottom-2.5 left-1/2 flex h-[2.9rem] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#26282c] px-1.5 text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        style={solNotch(18, 25)}
      >
        {/* Two sides of one width, so Sol's notch is dead centre whatever stands beside it. */}
        <div className="flex w-[17.5rem] items-center justify-end gap-1.5">
          <p className="min-w-0 truncate pl-2 text-[11.5px] text-white/60">
            <b className="font-semibold text-white">{what}</b>
            {detail && <span className="block truncate text-[10.5px]">{detail}</span>}
          </p>
          {orient}
          {tilt}
        </div>
        <span className="w-[3.4rem] shrink-0" aria-hidden />
        <div className="flex w-[17.5rem] items-center gap-1.5">
          {remove}
          {undo}
          <span className="flex-1" />
          {done}
        </div>
      </div>
    </div>
  );
}

/**
 * Sol on a phone (22 Nov 2026, Martin: "a tool and + icon somehow emerging out of him", in place of tools in words):
 * his sun with a spanner coming out of its upper left and a + out of its upper right, each on a short stem of light
 * from him, so it reads as Sol holding the tools and adding things. With a tool in hand, that tool's mark takes the
 * spanner's place, lit orange. With his tray up the + turns to a cross. Drawn over his orb.
 */
export function SolEmerging({ tray, held }: { tray: boolean; held: LucideIcon | null }) {
  const Tool = held ?? Wrench;
  const badge =
    "sol-emerge absolute flex size-6 items-center justify-center rounded-full ring-2 ring-[#26282c] shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-300 motion-reduce:transition-none";
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute -left-[7px] -top-[5px] h-[3px] w-4 origin-right rotate-[35deg] rounded-full bg-gradient-to-l from-[#ffb347]/0 to-[#ffb347]/70" />
      <span className="absolute -right-[7px] -top-[5px] h-[3px] w-4 origin-left -rotate-[35deg] rounded-full bg-gradient-to-r from-[#ffb347]/0 to-[#ffb347]/70" />
      <span
        className={clsx(badge, "-left-[14px] -top-[14px] [--emerge-x:14px]", held ? "bg-sun-line text-white" : "bg-white text-[#1d1f23]")}
      >
        <Tool className="size-3.5" strokeWidth={2.4} />
      </span>
      <span
        className={clsx(
          badge,
          "-right-[14px] -top-[14px] bg-sun-line text-white [--emerge-x:-14px] [animation-delay:90ms]",
          tray && "rotate-45",
        )}
      >
        <Plus className="size-4" strokeWidth={2.8} />
      </span>
    </span>
  );
}
