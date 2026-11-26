"use client";

/**
 * Sol holds the designer's tools on a phone held upright (21 Nov 2026, Martin: "sol becoming the repository for the
 * tools", and "use sol for things like tap 1 deg 5 deg"). The picture stays clear: pressing Sol brings up a tray over
 * the lower part of the screen with the way to ask him in words and every tool in groups; picking one folds it away.
 * With panels picked, Sol's card in place of the dial turns them, lays them portrait or landscape, tilts or removes them.
 */
import { clsx } from "clsx";
import {
  Calculator,
  ChevronRight,
  Columns2,
  LayoutGrid,
  Minus,
  MessageCircle,
  PenTool,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  Tag,
  Trash2,
  TriangleRight,
  Plus,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SolMark } from "./sol-sun";

type TrayTool = "select" | "panel" | "erase" | "trace" | "string" | "rule" | "label" | "comment" | "pan";

// Three rows of four (24 Nov 2026, Martin: "revamp and clean up this menu"): what you draw, what you check, how you look.
// Erase, Select, Add a panel, the hand and zoom are on the map itself, so they aren't repeated here.
const DRAW: { tool: TrayTool; icon: LucideIcon; name: string }[] = [
  { tool: "trace", icon: PenTool, name: "Trace roof" },
  { tool: "rule", icon: Ruler, name: "Guide line" },
  { tool: "label", icon: Tag, name: "Label" },
];

function Item(props: { icon: ReactNode; name: string; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.on}
      title={props.name}
      className={clsx(
        "flex h-[4.25rem] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-[11px] font-medium transition-colors disabled:opacity-35",
        props.on ? "bg-sun-line text-white" : "bg-white/[0.07] text-white/85 active:bg-white/15",
      )}
    >
      <span className="text-white [&>svg]:size-5">{props.icon}</span>
      <span className="max-w-full truncate">{props.name}</span>
    </button>
  );
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3">
      <h4 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{props.title}</h4>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">{props.children}</div>
    </section>
  );
}

const roundBtn = "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20";

export function SolTray(props: {
  open: boolean;
  onClose: () => void;
  onAsk: () => void;
  tool: string;
  onTool: (tool: TrayTool) => void;
  drawn: boolean;
  zooming: boolean;
  /** Pinch zoom, on a touch screen only (the desktop has the wheel and its own zoom rounds). */
  onZoom?: () => void;
  pitchShown: boolean;
  /** The pitch marks, on a phone only (the desktop shows them on the picture). */
  onPitch?: () => void;
  pitchWords: string;
  onDesignForMe?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Sol's size-a-system calculator (25 Nov 2026, Martin: "add the calculator into the phone"). */
  onCalc?: () => void;
  calcOn?: boolean;
  /** The main switchboard's mark (25 Nov 2026, Martin: off the map's kit, into Sol's tools). */
  msb?: { on: boolean; icon: ReactNode; onClick: () => void };
  /** The house from its sides (Nearmap), when it can be had: its own button and window. */
  sides?: ReactNode;
  /** Which picture is under the design (Google or Nearmap). */
  pictureMenu?: ReactNode;
  /** Room left at the tray's foot for the designer's own row (save, ready, designs, record and the rest); 0 for none. */
  footRoom: number;
}) {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
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
        className="fixed inset-x-0 bottom-0 z-[95] mx-auto flex max-h-[min(88dvh,calc(100%-1rem))] max-w-[52rem] flex-col rounded-t-[22px] bg-[#26282c] text-white shadow-[0_-12px_32px_rgba(0,0,0,0.35)]"
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
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white/10 pl-1.5 pr-4 text-left text-[13px] text-white/75"
            >
              <span className="sol-orb flex size-8 shrink-0 items-center justify-center rounded-full">
                <SolMark className="size-[26px]" />
              </span>
              <span className="min-w-0 flex-1 truncate">Ask Sol to change it</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </button>
            {/* Undo and redo stay put in the head (they don't close the tray), beside close. */}
            <button type="button" onClick={props.onUndo} aria-label="Undo" title="Undo" className={roundBtn}>
              <Undo2 className="size-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={props.onRedo} aria-label="Redo" title="Redo" className={roundBtn}>
              <Redo2 className="size-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={props.onClose} aria-label="Put Sol's tools away" className={roundBtn}>
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
          {/* Sideways (a wide, short screen) the groups sit two across, so more of them fit before it scrolls. */}
          <div className="sm:grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-4">
            <Group title="Draw">
              {DRAW.map(({ tool, icon: Icon, name }) => (
                <Item key={tool} icon={<Icon aria-hidden />} name={name} on={props.tool === tool} onClick={() => pick(tool)} />
              ))}
              {props.msb && <Item icon={props.msb.icon} name="Switchboard" on={props.msb.on} onClick={then(props.msb.onClick)} />}
            </Group>
            <Group title="Check">
              {props.onPitch && (
                <Item icon={<TriangleRight aria-hidden />} name={props.pitchWords} on={props.pitchShown} onClick={then(props.onPitch)} />
              )}
              <Item icon={<MessageCircle aria-hidden />} name="Comment" on={props.tool === "comment"} onClick={() => pick("comment")} />
              <Item
                icon={<WandSparkles aria-hidden />}
                name="Auto design"
                onClick={then(() => props.onDesignForMe?.())}
                disabled={!props.onDesignForMe}
              />
            </Group>
            <Group title="View">
              {props.onCalc && <Item icon={<Calculator aria-hidden />} name="Calculator" on={props.calcOn} onClick={then(props.onCalc)} />}
              {props.sides}
              {props.onZoom && <Item icon={<Search aria-hidden />} name="Pinch zoom" on={props.zooming} onClick={then(props.onZoom)} />}
            </Group>
            {props.pictureMenu && (
              <section className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] py-1.5 pl-3.5 pr-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Picture</span>
                {props.pictureMenu}
              </section>
            )}
          </div>
        </div>
        {/* The designer's own row (save, ready to install, strings, shade, record and the rest) stands in this strip. */}
        {props.footRoom > 0 && (
          <div
            className="shrink-0 border-t border-white/10 px-3.5 pt-1.5"
            style={{ height: `calc(${props.footRoom}px + env(safe-area-inset-bottom))` }}
          >
            <h4 className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/50">This design</h4>
          </div>
        )}
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
  /** How many panels are in the array(s) of what is picked, when more than are picked: the button picks them all. */
  wholeArray?: number | null;
  onWholeArray?: () => void;
  /** How many panels the picked one's own line (column or row) holds, when that is less than the whole array. */
  wholeLine?: number | null;
  onWholeLine?: () => void;
  /** A double tap's first tap turned the panels this far: turn them back, leaving nothing to undo. */
  onTakeBack: (degrees: number) => void;
  /** A press and hold on a 1° button begins (true) and ends (false): its turns are one step to undo. */
  onHold?: (holding: boolean) => void;
  /** Upright: the least the plate stands (to the foot of the screen when its contents are taller than the room). */
  height?: number;
  /** Upright: how tall its contents are, so the dock is only as tall as what it holds and the map takes the rest
      (26 Nov 2026, Martin: "The dock height should auto adjust relative to the information it's showing"). */
  onHeight?: (px: number) => void;
  /** Upright: folded down to its header by the grab bar on its top edge. */
  folded?: boolean;
  onFold?: (folded: boolean) => void;
  /** While Add a panel is in hand: the panel counter, drawn in the plate's middle. */
  counter?: ReactNode;
}) {
  const upright = props.layout === "upright";
  const what = props.panels ? `${props.panels} panel${props.panels === 1 ? "" : "s"}` : `${props.count} picked`;
  const detail = [props.tilt !== null && props.panels ? `${props.tilt}°` : null, props.panels ? props.facing : null]
    .filter(Boolean)
    .join(" · ");
  const seg = "flex items-center rounded-xl bg-white/[0.08] p-[3px]";
  const small = "flex items-center justify-center rounded-[9px] text-white/85 hover:bg-white/10";
  // A double tap on either thumb turns both to 5° a press, and another back to 1° (22 Nov 2026, Martin). Kept for the visit.
  const [stepBy, setStepBy] = useState(turnStep);
  const thumb = (by: -1 | 1) => {
    const Turn = by < 0 ? RotateCcw : RotateCw;
    return (
      <HoldButton
        onStep={(times) => props.onTurn(by * stepBy * times)}
        onHold={props.onHold}
        onDoubleTap={() => {
          // The first tap of the two turned the panels: take it back, so a double tap only changes the step.
          props.onTakeBack(by * stepBy);
          turnStep = turnStep === 1 ? 5 : 1;
          setStepBy(turnStep);
        }}
        aria-label={`Turn ${stepBy} degree${stepBy === 1 ? "" : "s"} ${by < 0 ? "anticlockwise" : "clockwise"} (double tap for ${stepBy === 1 ? 5 : 1}°)`}
        className={clsx(
          "pointer-events-auto flex flex-col items-center justify-center rounded-full bg-[#3a3d43] text-white shadow-[0_6px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10 active:scale-95 active:bg-[#4a4e55] motion-reduce:active:scale-100",
          upright ? "size-[4.25rem]" : "size-[3.4rem]",
        )}
      >
        <Turn className={upright ? "size-6" : "size-5"} aria-hidden />
        <span className={clsx("mt-0.5 text-[11px] font-semibold tabular-nums", stepBy === 1 ? "text-white/80" : "text-sun-line")}>
          {stepBy}°
        </span>
      </HoldButton>
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
            "flex items-center justify-center rounded-[9px]",
            // Larger on a phone held upright, so a thumb finds it (26 Nov 2026, Martin).
            upright ? "h-12 w-16" : "h-8 w-9",
            props.landscape === land ? "bg-white text-[#1d1f23]" : "text-white/75 hover:bg-white/10",
          )}
        >
          <span
            className={clsx(
              "rounded-[2px] border-current",
              upright ? "border-2" : "border-[1.5px]",
              upright ? (land ? "h-[14px] w-[24px]" : "h-[24px] w-[14px]") : land ? "h-[9px] w-[15px]" : "h-[15px] w-[9px]",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
  // The tilt's − and + step on the press itself, and keep stepping while held (26 Nov 2026, Martin: "The + and - panel
  // adjusters aren't working" on his iPhone): a press, not a click, as the thumbs are.
  const tiltStep = (by: -1 | 1) => (
    <HoldButton
      onStep={(times) => props.onTilt(by * times)}
      onHold={props.onHold}
      aria-label={by < 0 ? "Tilt down a degree" : "Tilt up a degree"}
      className={clsx(small, "pointer-events-auto h-9 w-10 active:bg-white/15")}
    >
      {by < 0 ? <Minus className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
    </HoldButton>
  );
  const tilt = props.panels > 0 && (
    <div className={seg} role="group" aria-label="Tilt">
      {tiltStep(-1)}
      <span className="min-w-[3.25rem] text-center text-[12px] tabular-nums">
        <span className="text-white/55">tilt </span>
        <b className="font-semibold">{props.tilt === null ? "–" : `${props.tilt}°`}</b>
      </span>
      {tiltStep(1)}
    </div>
  );
  const remove = (
    <button
      type="button"
      onClick={props.onDelete}
      aria-label="Delete what is picked"
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-[#ff6b5e] hover:bg-white/15",
        upright ? "size-[54px]" : "size-[38px]",
      )}
    >
      <Trash2 className={upright ? "size-5" : "size-4"} aria-hidden />
    </button>
  );
  // One panel picked, the rest of its array a press away (22 Nov 2026, Martin: "a select all button").
  const whole = Boolean(props.wholeArray && props.onWholeArray) && (
    <button
      type="button"
      onClick={props.onWholeArray}
      aria-label={`Pick the whole array: ${props.wholeArray} panels`}
      title="Pick every panel in this array"
      className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.08] px-2.5 text-[12px] font-semibold text-white hover:bg-white/15"
    >
      <LayoutGrid className="size-4 text-sun-line" aria-hidden />
      All {props.wholeArray}
    </button>
  );
  // Its column or row alone (24 Nov 2026, Martin: "without selecting the row of panels above it").
  const line = Boolean(props.wholeLine && props.onWholeLine) && (
    <button
      type="button"
      onClick={props.onWholeLine}
      aria-label={`Pick the panel's line: ${props.wholeLine} panels`}
      title="Pick the column or row this panel is in"
      className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.08] px-2.5 text-[12px] font-semibold text-white hover:bg-white/15"
    >
      <Columns2 className="size-4 text-sun-line" aria-hidden />
      Line {props.wholeLine}
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
      <UprightPlate
        {...props}
        what={what}
        detail={detail}
        undo={undo}
        done={done}
        orient={orient}
        remove={remove}
        tiltRow={tilt}
        thumb={thumb}
      />
    );

  return (
    <div role="group" aria-label="What is picked" className="pointer-events-none absolute inset-0">
      {props.panels > 0 && <div className="absolute bottom-3 left-3">{thumb(-1)}</div>}
      {props.panels > 0 && <div className="absolute bottom-3 right-3">{thumb(1)}</div>}
      <div
        className="pointer-events-auto absolute bottom-2.5 left-1/2 flex h-[2.9rem] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#26282c] px-1.5 text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        style={solNotch(13, 30)}
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
        <span className="w-[4.25rem] shrink-0" aria-hidden />
        <div className="flex w-[17.5rem] items-center gap-1.5">
          {line}
          {whole}
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
 * Sol on a phone (22 Nov 2026, Martin: a + "emerging out of him" in place of tools in words; then "the + icon and the
 * spanner are for the same thing… just leave the + icon… big enough that it's not hard to press"): his sun with a
 * large orange + coming out of its upper right on a short stem of light, part of his button, so a press on it opens his
 * tools. With a tool in hand, that tool's mark rides on his upper left so it is plain what is in hand. With his tray up
 * the + turns to a cross.
 */
export function SolEmerging({
  tray,
  held,
  small = false,
  onPlus,
}: {
  tray: boolean;
  held: LucideIcon | null;
  small?: boolean;
  /** A press on the + alone (25 Nov 2026, Martin: Sol opens his chat, the + his tools). */
  onPlus?: () => void;
}) {
  const Held = held;
  return (
    <span className="pointer-events-none absolute inset-0">
      <span
        aria-hidden
        className="absolute -right-[9px] -top-[7px] h-[3px] w-5 origin-left -rotate-[35deg] rounded-full bg-gradient-to-r from-[#ffb347]/0 to-[#ffb347]/70"
      />
      {Held && (
        <span
          aria-hidden
          className="sol-emerge absolute -left-[12px] -top-[12px] flex size-7 items-center justify-center rounded-full bg-sun-line text-white ring-2 ring-[#26282c] [--emerge-x:12px]"
        >
          <Held className="size-4" strokeWidth={2.4} />
        </span>
      )}
      {/* Pressable as part of Sol's button (its own pointer events, so a press on it isn't passed to the map). */}
      <span
        role={onPlus ? "button" : undefined}
        aria-hidden={onPlus ? undefined : true}
        aria-label={onPlus ? (tray ? "Put Sol's tools away" : "Sol's tools") : undefined}
        title={onPlus ? (tray ? "Put Sol's tools away" : "Sol's tools") : undefined}
        onClick={
          onPlus
            ? (e) => {
                e.stopPropagation();
                e.preventDefault();
                onPlus();
              }
            : undefined
        }
        tabIndex={onPlus ? 0 : undefined}
        onKeyDown={
          onPlus
            ? (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.stopPropagation();
                e.preventDefault();
                onPlus();
              }
            : undefined
        }
        className={clsx(
          "sol-emerge pointer-events-auto absolute flex cursor-pointer items-center justify-center rounded-full bg-sun-line text-white shadow-[0_3px_10px_rgba(255,90,31,0.5)] ring-[3px] ring-[#26282c] transition-transform duration-300 motion-reduce:transition-none",
          // On a computer, drawn at full size, a smaller + (the phone's controls are drawn at 0.68).
          small ? "-right-[12px] -top-[12px] size-8 [--emerge-x:-12px]" : "-right-[22px] -top-[22px] size-11 [--emerge-x:-22px]",
          tray && "rotate-45",
        )}
      >
        <Plus className={small ? "size-5" : "size-7"} strokeWidth={3} />
      </span>
    </span>
  );
}

/** How long a press is held before it repeats, and how often it repeats then. */
/** The degrees a thumb turns a press: 1, or 5 after a double tap; kept for the visit, so a new pick keeps it. */
let turnStep: 1 | 5 = 1;
/** A second tap this soon after a short first one is a double tap. */
const DOUBLE_TAP_MS = 320;
const HOLD_START_MS = 380;
const HOLD_EVERY_MS = 90;
/** A slow redraw never jumps more than this in one go. */
const HOLD_MOST_AT_ONCE = 5;

/**
 * A button that steps once on a press and keeps stepping while held (22 Nov 2026, Martin: "press and hold and it should
 * continue to successively add or subtract 1 deg so I don't have to keep tapping"). A keyboard press steps once.
 */
/**
 * The controller on a phone held upright: a plate under the picture moulded round Sol, as tall as what it holds (26 Nov
 * 2026, Martin: it stood open to the foot of the screen with nothing in it), the foot row's rounds standing on its top
 * edge, a grab bar at its top left that folds it to its header and opens it again.
 */
function UprightPlate(
  props: Parameters<typeof SolController>[0] & {
    what: string;
    detail: string;
    undo: ReactNode;
    done: ReactNode;
    orient: ReactNode;
    remove: ReactNode;
    tiltRow: ReactNode;
    thumb: (by: -1 | 1) => ReactNode;
  },
) {
  const inside = useRef<HTMLDivElement | null>(null);
  const report = useRef(props.onHeight);
  useEffect(() => {
    report.current = props.onHeight;
  });
  useEffect(() => {
    const el = inside.current;
    if (!el) return;
    const measure = () => report.current?.(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const folded = Boolean(props.folded);
  return (
    <div
      role="group"
      aria-label="What is picked"
      className="pointer-events-auto relative rounded-t-[26px] bg-[#26282c] text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
      style={{ minHeight: props.height, ...solNotch(0, 30) }}
    >
      {props.onFold && (
        <button
          type="button"
          onClick={() => props.onFold?.(!folded)}
          aria-expanded={!folded}
          aria-label={folded ? "Open the controls" : "Fold the controls away"}
          title={folded ? "Open the controls" : "Fold the controls away for more of the map"}
          className="group absolute left-3 top-0 z-10 flex h-5 w-11 touch-none items-center justify-center"
        >
          <span className="h-1 w-8 rounded-full bg-white/35 transition-colors group-hover:bg-white/70" aria-hidden />
        </button>
      )}
      <div ref={inside} className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-7">
        {/* Under the foot row's rounds: what is picked on the left; undo and pick none on the right, Sol's notch between. */}
        <div className="flex items-center">
          <p className="w-[calc(50%-2.25rem)] min-w-0 truncate text-[12px] text-white/60">
            <b className="font-semibold text-white">{props.what}</b>
            {props.detail && ` · ${props.detail}`}
          </p>
          <span className="w-[4.5rem] shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            {props.undo}
            {props.done}
          </div>
        </div>
        {!folded && (props.wholeLine || props.wholeArray) && (
          <div className="mt-2 flex justify-center gap-2">
            {props.wholeLine && props.onWholeLine && (
              <button
                type="button"
                onClick={props.onWholeLine}
                aria-label={`Pick the panel's line: ${props.wholeLine} panels`}
                className="flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                <Columns2 className="size-3.5 text-sun-line" aria-hidden />
                Line {props.wholeLine}
              </button>
            )}
            {props.wholeArray && props.onWholeArray && (
              <button
                type="button"
                onClick={props.onWholeArray}
                aria-label={`Pick the whole array: ${props.wholeArray} panels`}
                className="flex h-7 items-center gap-1.5 rounded-full bg-sun-line px-3.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(255,90,31,0.35)]"
              >
                <LayoutGrid className="size-3.5" aria-hidden />
                Select all {props.wholeArray}
              </button>
            )}
          </div>
        )}
        {/* The panel counter while panels are being laid. */}
        {!folded && props.counter && <div className="mt-2 flex justify-center">{props.counter}</div>}
        {!folded && (
          <div className="mt-2.5 flex items-end justify-between gap-2">
            {props.panels > 0 ? props.thumb(-1) : <span />}
            <div className="flex min-w-0 flex-col items-center gap-1.5 pb-0.5">
              <div className="flex items-center gap-1.5">
                {props.orient}
                {props.remove}
              </div>
              {props.tiltRow}
            </div>
            {props.panels > 0 ? props.thumb(1) : <span />}
          </div>
        )}
      </div>
    </div>
  );
}

function HoldButton({
  onStep,
  onHold,
  onDoubleTap,
  className,
  children,
  "aria-label": label,
}: {
  /** How many steps are due: one on the press, then as many as the time held since the last asks for. */
  onStep: (times: number) => void;
  onHold?: (holding: boolean) => void;
  /** A second short tap straight after a first: nothing steps on it. */
  onDoubleTap?: () => void;
  className?: string;
  children: ReactNode;
  "aria-label": string;
}) {
  const step = useRef(onStep);
  const held = useRef(false);
  const timer = useRef<number | null>(null);
  const due = useRef(0);
  const last = useRef(0);
  // When the press began, and when the last short tap ended (0 after a double tap, so a third tap starts afresh).
  const pressedAt = useRef(0);
  const tapEnded = useRef(0);
  const owed = () => {
    const now = Date.now();
    const times = Math.min(HOLD_MOST_AT_ONCE, Math.max(1, Math.round((now - last.current) / HOLD_EVERY_MS)));
    last.current = now;
    return times;
  };
  // Each repeat waits until the last step has been drawn (this runs after every render), so it turns from where the
  // panels now are, never from a stale copy, however slow the redraw.
  useEffect(() => {
    step.current = onStep;
    if (!held.current || timer.current !== null) return;
    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        if (held.current) step.current(owed());
      },
      Math.max(HOLD_EVERY_MS, due.current - Date.now()),
    );
  });
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (held.current) {
      held.current = false;
      onHold?.(false);
    }
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(className, "touch-none select-none [-webkit-touch-callout:none]")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        stop();
        // Timed by when the finger touched (the event's own time), not when this runs: a redraw of the first tap's turn
        // can hold this up, and a quick double tap would read as two single ones.
        const now = e.timeStamp;
        if (onDoubleTap && tapEnded.current && now - tapEnded.current < DOUBLE_TAP_MS) {
          tapEnded.current = 0;
          pressedAt.current = 0;
          onDoubleTap();
          return;
        }
        pressedAt.current = now;
        held.current = true;
        due.current = Date.now() + HOLD_START_MS;
        last.current = due.current - HOLD_EVERY_MS;
        onHold?.(true);
        step.current(1);
      }}
      onPointerUp={(e) => {
        // A short press is a tap that a second may make a double tap; a hold isn't.
        tapEnded.current = pressedAt.current && e.timeStamp - pressedAt.current < HOLD_START_MS ? e.timeStamp : 0;
        pressedAt.current = 0;
        stop();
      }}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // A keyboard press (no pointer) steps once; a pointer's press already stepped.
        if (e.detail === 0) step.current(1);
      }}
    >
      {children}
    </button>
  );
}

/**
 * The panel counter in the dock while Add a panel is in hand (26 Nov 2026, Martin: "a panel counter in the dock so I
 * can see how many panels left until target… only exist whilst I'm laying panels… large enough so I can see it and it
 * should also show how many kWs"). The panels and kW large, what is left to the target under them.
 */
export function PanelCounter(props: { panels: number; kw: string; line: string | null; state: "short" | "on" | "over" | "none" }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center text-white">
      <p className="flex items-baseline gap-2 whitespace-nowrap">
        <b className="text-[34px] font-semibold leading-none tabular-nums">{props.panels}</b>
        <span className="text-[13px] text-white/60">{props.panels === 1 ? "panel" : "panels"}</span>
        <span className="mx-1 h-6 w-px self-center bg-white/20" aria-hidden />
        <b className="text-[24px] font-semibold leading-none tabular-nums text-sun-line">{props.kw}</b>
        <span className="text-[13px] text-white/60">kW</span>
      </p>
      {props.line && (
        <p
          className={clsx(
            "mt-1.5 rounded-full px-3 py-0.5 text-[12.5px] font-semibold tabular-nums",
            props.state === "on" && "bg-positive/25 text-[#7ee2a8]",
            props.state === "over" && "bg-danger/25 text-[#ff8a80]",
            props.state === "short" && "bg-white/10 text-white/85",
          )}
        >
          {props.line}
        </p>
      )}
    </div>
  );
}
