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
  MessageCircle,
  MousePointer2,
  PenTool,
  Redo2,
  Ruler,
  Search,
  SquarePlus,
  SunMedium,
  Tag,
  Trash2,
  TriangleRight,
  Undo2,
  WandSparkles,
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
      { tool: "panel", icon: SquarePlus, name: "Add panel" },
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

/** Sol's card for what is picked, in place of the dial: turns, portrait or landscape, tilt, delete. */
export function SolPicksCard(props: {
  count: number;
  panels: number;
  tilt: number | null;
  facing: string | null;
  landscape: boolean | null;
  onTurn: (degrees: number) => void;
  onLandscape: (landscape: boolean) => void;
  onTilt: (by: number) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const chip = "flex h-8 flex-1 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums";
  return (
    <div
      role="group"
      aria-label="What is picked"
      className="rounded-[18px] bg-[#26282c] p-2.5 text-white shadow-[0_10px_26px_rgba(0,0,0,0.35)]"
    >
      <div className="mb-2 flex items-center gap-2 text-[12px]">
        <p className="min-w-0 flex-1 truncate text-white/75">
          <b className="font-semibold text-white">
            {props.panels ? `${props.panels} panel${props.panels === 1 ? "" : "s"} picked` : `${props.count} picked`}
          </b>
          {props.panels > 0 && props.tilt !== null && ` · tilt ${props.tilt}°`}
          {props.panels > 0 && props.facing && ` · facing ${props.facing}`}
        </p>
        <button
          type="button"
          onClick={props.onDone}
          aria-label="Pick none"
          className="flex size-7 items-center justify-center rounded-full bg-white/10"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {props.panels > 0 && (
        <>
          <div className="flex gap-1.5">
            {[-5, -1, 90, 1, 5].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => props.onTurn(step)}
                aria-label={`Turn ${Math.abs(step)} degree${Math.abs(step) === 1 ? "" : "s"} ${step < 0 ? "anticlockwise" : "clockwise"}`}
                className={clsx(chip, step === 90 ? "bg-sun-line" : "bg-white/10")}
              >
                {step === 90 ? "90°" : `${step > 0 ? "+" : "−"}${Math.abs(step)}°`}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {([false, true] as const).map((land) => (
              <button
                key={String(land)}
                type="button"
                onClick={() => props.onLandscape(land)}
                aria-pressed={props.landscape === land}
                className={clsx(chip, "font-medium", props.landscape === land ? "bg-white text-[#26282c]" : "bg-white/10")}
              >
                {land ? "Landscape" : "Portrait"}
              </button>
            ))}
            <span className="flex flex-1 items-center justify-between rounded-full bg-white/10 px-1 text-[12px]">
              <button
                type="button"
                onClick={() => props.onTilt(-1)}
                aria-label="Tilt down a degree"
                className="flex size-6 items-center justify-center"
              >
                −
              </button>
              Tilt
              <button
                type="button"
                onClick={() => props.onTilt(1)}
                aria-label="Tilt up a degree"
                className="flex size-6 items-center justify-center"
              >
                +
              </button>
            </span>
          </div>
        </>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <button type="button" onClick={props.onDelete} className={clsx(chip, "max-w-[8rem] gap-1 bg-white/10 font-medium text-[#ff6b5e]")}>
          <Trash2 className="size-3.5" aria-hidden /> Delete
        </button>
        {props.panels > 0 && <p className="flex-1 text-right text-[10.5px] text-white/50">or tell Sol: “turn them 3° left”</p>}
      </div>
    </div>
  );
}
