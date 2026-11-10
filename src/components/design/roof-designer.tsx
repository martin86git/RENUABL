"use client";

import Link from "next/link";
import { accessColour, shadeHint, shadeReport, type ShadeReport } from "@/lib/domain/design/shade";
import { loadTerrain, type Heights } from "@/lib/services/terrain";
import { loadRoofCheck } from "@/lib/services/roof-check";
import { useDesignTips } from "./design-tips";
import { SideViewsButton } from "./side-views";
import { batteryFill } from "@/lib/domain/design/battery-fill";
import {
  HAS_SOLAR_NOTE,
  REPLACING_NOTE,
  EXISTING_QUESTION,
  avoidFor,
  hasSolar,
  keptClearWords,
  notRoofWords,
  roofFacesOnly,
  thingLabel,
  withoutExisting,
  type RoofCheck,
} from "@/lib/domain/design/roof-check";
import { loadModelFit, loadRoofInfo, loadRoofModel } from "@/lib/services/roof-model";
import { loadNearmapOutline } from "@/lib/services/nearmap";
import { OLD_FACE_CORNERS, mendCutOutline, outlineNote } from "@/lib/domain/design/nearmap";
import { MOUNT_STANDOFF, clearanceFor, inRows, laidAs, packFaces, reorient, splitPartner } from "@/lib/domain/design/pack";
import { edgeShift, snapShift } from "@/lib/domain/design/snap";
import { faceFromAspect, readAspect, type AspectReading } from "@/lib/domain/design/face-aspect";
import { faceAt, facesFoundNote, facesFromHeights } from "@/lib/domain/design/roof-faces";
import { PITCH_NOT_READ, pitchOfRoof, pitchReadWords, type PitchReading } from "@/lib/domain/design/roof-pitch";
import { NO_BILL_KW, SELF_DESIGN_AIMS, SELF_DESIGN_LABELS, selfDesign, type SelfDesignResult } from "@/lib/domain/design/self-design";
import { todayInMarket } from "@/lib/domain/market";
import { GROUND_COLOURS, faceShade, facesFromModel, groundOf, tidyGround, type DrawnFace, type Ground } from "@/lib/domain/design/drawing";
import { CELLS_UP_TO } from "@/lib/domain/design/illustrated-roof";
import { FlowLine, PanelArt, RoofArt, WallStrip, useRoofGhost, type ArtFace } from "./illustrated-roof";
import { DayOverlay, HomeDayCard, useHomeDay } from "./home-day";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  BatteryCharging,
  Cable,
  Check,
  Copy,
  Eraser,
  Hand,
  Maximize,
  MessageCircle,
  MousePointer2,
  PenTool,
  ReceiptText,
  Plus,
  PlugZap,
  Redo2,
  Ruler,
  SquarePlus,
  Save,
  Star,
  Tag,
  TriangleAlert,
  WandSparkles,
  Sparkles,
  FileText,
  Layers,
  SunMedium,
  Brush,
  House,
  Sunrise,
  LayoutGrid,
  Radio,
  Send,
  ThumbsUp,
  Trash2,
  X,
  ChevronDown,
  Ellipsis,
  Move,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
  Calculator,
} from "lucide-react";
import { DESIGN_TEMPERATURES, HOT_CELL, checkString, type StringCheck } from "@/lib/domain/design/electrical";
import type { CatalogueBattery, CatalogueCharger, CatalogueInverter, CataloguePanel } from "@/lib/domain/design/catalogue";
import { DRAFT_WAIT_MS, keptWhen } from "@/lib/domain/design/draft";
import { FavouriteStar, useFavourites } from "./favourite-star";
import type { Workspace } from "@/lib/domain/design/pricing";
import { listed } from "@/lib/domain/design/pricing";
import {
  costSystem,
  MAX_ROOFS,
  stcValue,
  editedLines,
  solarVicBar,
  defaultQuote,
  sharedHome,
  withHomeOf,
  lineKey,
  undecidedLines,
  DAY,
  designFinance,
  type BillInterval,
  type DesignExtras,
  type QuoteFields,
  type SystemSpec,
} from "@/lib/domain/design/quote";
import type { RebateRates } from "@/lib/domain/rebates";
import { DesignQuote, HomeToggles } from "./design-quote";
import { SOL_TOGGLE } from "@/lib/services/sol";
import {
  endLive as endLiveLink,
  liveLink,
  liveStatus as liveStatusOf,
  pushLive as pushLiveSnapshot,
  startLive as startLiveLink,
  type LiveStatus,
} from "@/lib/services/live";
import { LIVE_LIMITS, LIVE_POLL_MS, liveStatusWords, type LiveSnapshot } from "@/lib/domain/design/live";
import { SolIcon, SolMark, SolStars } from "./sol-icon";
import type { RoofModel } from "@/lib/domain/roof-layout";
import { mismatchNote, modelOffset, suggestPanels } from "@/lib/domain/design/suggest";
import { shiftingKwhOf, systemSpecOf } from "@/lib/domain/design/system";
import { arrayOversize, suggestInverters, type InverterSuggestion } from "@/lib/domain/design/inverter-suggest";
import { autoStringDesign } from "@/lib/domain/design/auto-string";
import { suggestBatteries } from "@/lib/domain/design/battery-suggest";
import { TILT, bestTilt, compass, gainOverFlat } from "@/lib/domain/design/tilt";
import { applySettle, settleToEdges, type RoofEdge } from "@/lib/domain/design/edge-gravity";
import { billFieldsFromPhoto, billWith, dailyFromBillFields, usageFromAmount, type BillPhotoRead } from "@/lib/domain/design/design-bill";
import { openingAdvice, quickSize, type BatteryChoice, type KwSize } from "@/lib/domain/design/quick-size";
import { SolCalculator, SolOpening, type Opening } from "./sol-opening";
import { SolThinking } from "./sol-thinking";
import { CaptureButtons } from "@/components/ui/capture";
import { switchboardAdvice, type SwitchboardAdvice, type SwitchboardRead } from "@/lib/domain/design/switchboard";
import { readiness, readinessLight, type ReadinessItem } from "@/lib/domain/design/readiness";
import {
  faces as facesWay,
  parseCommand,
  allByQuery,
  pricesInWords,
  pickByQuery,
  confirmWord,
  deleteQuestion,
  type Choice,
  type DesignCommand,
  type Facing as Way,
} from "@/lib/domain/design/design-commands";
import { DictateButton } from "./dictate";
import { usePageAbout } from "@/lib/services/page-context";
import { MAX_PROPOSAL_OPTIONS } from "@/lib/domain/design/proposal";
import {
  DESIGN_GOALS,
  FACINGS,
  LABEL_KINDS,
  MAX_BATTERY_QTY,
  MAX_DESIGNS,
  MAX_INVERTERS,
  ROOF_IMAGE,
  angleOfLongestEdge,
  applyCommentOp,
  designPanels,
  designSummary,
  faceArea,
  faceFacing,
  freed,
  inverterSpot,
  inside,
  clearOf,
  flushGhostAt,
  facingLike,
  looseCorners,
  ARRAY_GAP,
  panelGap,
  metresPerPixel,
  monthlyProduction,
  panelFacing,
  panelOf,
  panelPlaces,
  planSize,
  stringIsMixed,
  type DesignBattery,
  type DesignCharger,
  type DesignComment,
  type DesignSet,
  type DesignLabel,
  type Face,
  type Facing,
  type GuideLine,
  type InverterSpec,
  type LabelKind,
  type LoosePanel,
  type PanelSize,
  type PanelSpec,
  type PanelString,
  type Point,
  type DesignGoal,
  type RoofDesign,
  roofAfterRemoving,
  roofOf,
} from "@/lib/domain/design/roof-design";

const GOLD = "var(--sun-line)";
/**
 * The inverter, battery, main switchboard and EV charger are drawn this much smaller than the picture's other marks
 * (5 Nov 2026, Martin, as Primero's: they were too big beside the house), so they sit in proportion to it.
 */
const KIT_SIZE = 0.6;

/** How much lighter the roof being designed is drawn than the buildings around it, in drawing mode. */
const OWN_ROOF_LIFT = 62;
/** One colour a string, so they can be told apart on the roof. */
const STRING_COLOURS = ["#86efac", "#f9a8d4", "#fdba74", "#fde047", "#7dd3fc", "#c4b5fd", "#fca5a5", "#5eead4"];
/**
 * Each of the home's roofs in a colour of its own, when there are several (10 Nov 2026, Martin: Roof 1 and Roof 2 on the
 * left edge didn't say which panels were on which): the mark carries it, and the panels and faces on that roof are
 * edged in it. Never the signal orange, which is for what is picked.
 */
const ROOF_COLOURS = ["#38bdf8", "#c084fc", "#34d399", "#fbbf24"];
/** Strings are lettered: A, B, C. */
const letter = (index: number) => String.fromCharCode(65 + (index % 26));
/** A string check's verdict as a mark and a colour. */
const VERDICT: Record<StringCheck["verdict"], { mark: string; tone: string; pad: string }> = {
  good: { mark: "✓", tone: "text-positive", pad: "bg-white/10 text-white" },
  caution: { mark: "!", tone: "text-sun-ink", pad: "bg-sun-bright text-ink" },
  bad: { mark: "✕", tone: "text-danger", pad: "bg-[#fdecea] text-danger" },
  unknown: { mark: "?", tone: "text-muted", pad: "bg-white/10 text-white/80" },
};

type Tool = "select" | "pan" | "erase" | "trace" | "rule" | "panel" | "string" | "label" | "comment";
const TOOLS: { tool: Tool; icon: LucideIcon; name: string; hint: string }[] = [
  {
    tool: "select",
    icon: MousePointer2,
    name: "Select",
    hint: "Click a panel or label to pick it. Shift-click, or drag a box, to pick several. Drag to move them. Ctrl+C then Ctrl+V pastes a copy under the pointer.",
  },
  {
    tool: "pan",
    icon: Hand,
    name: "Move the picture",
    hint: "Zoom in with Ctrl (⌘ on a Mac) and the mouse wheel, a pinch, or the + button, then press and drag the picture to move around it.",
  },
  {
    tool: "trace",
    icon: PenTool,
    name: "Trace a roof face",
    hint: "Click each corner of the roof face, in order. The rows line up with its longest edge.",
  },
  {
    tool: "rule",
    icon: Ruler,
    name: "Guide line",
    hint: "Click one end of a roof edge, then the other: a gold line stays there to line panels up with, and picked panels show how far they are from it. Click a guide line with this tool to remove it.",
  },
  {
    tool: "panel",
    icon: SquarePlus,
    name: "Add a panel",
    hint: "The outline of the next panel follows the pointer: beside a panel it takes the place the pointer is in, laid the same way; in the open it sits under the pointer. Click to place it, or press and drag to lay rows. Traced roof faces light up in gold, with the distance to each edge. What you've just laid stays picked: drag its round white handle to spin it into position.",
  },
  {
    tool: "string",
    icon: Cable,
    name: "String panels",
    hint: "Press and drag across panels to wire them in the order you pass over them, round corners and from row to row; or click them one at a time. Click one again to take it off. The strings are listed on the picture: start a new one there, and set the inverter input each is on. Hover over a string to see it checked against the inverter.",
  },
  { tool: "label", icon: Tag, name: "Add a label", hint: "Click where the inverter, battery, switchboard or a note belongs." },
  {
    tool: "erase",
    icon: Eraser,
    name: "Eraser",
    hint: "Click a panel, a label or a guide line to take it away, or press and drag across panels to clear them as you go. Undo brings them back.",
  },
  {
    tool: "comment",
    icon: MessageCircle,
    name: "Comment",
    hint: "Click a spot and type your remark in the box that opens there. Comments are kept with the designs.",
  },
];

/**
 * The controls that float on the picture share one look: a soft, slightly see-through plate with rounded corners,
 * so they read as one family resting on the roof rather than as boxes stuck to it.
 */
type SideView = "designer" | "quote" | "proposal";
const SIDE_KEY = "renuabl.design.side";
/** Where the device keeps whether the roof is shown drawn (the Drawn view) or as the photo. */
const ART_KEY = "renuabl.design.drawn-roof";
const SIDE_VIEWS: { id: SideView; label: string; hint: string }[] = [
  { id: "designer", label: "Designer", hint: "The home's roof, storeys and phase, Sol, and the deal's notes" },
  { id: "quote", label: "Quote", hint: "The quote, worked out as you draw" },
  { id: "proposal", label: "Proposal", hint: "The proposal, the chat with the customer and what has been sent" },
];

/** What the card says when the three designs were made by themselves as the roof opened. */
/** A face with this many corners or more, alone on the roof, is the home's outline put down whole, not a face traced by hand. */
const OUTLINE_FACE_CORNERS = 8;
const AUTO_DESIGNED = "Designed as the roof opened, from Google's roof data and your prices: check each against the photo before sending.";

/** A key for each tool (2 Nov 2026, Martin: speed), as the shortcuts card lists them. */
const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  p: "panel",
  s: "string",
  t: "trace",
  e: "erase",
  h: "pan",
  g: "rule",
  l: "label",
  c: "comment",
};
const SHORTCUTS: [keys: string, does: string][] = [
  ["Ctrl S", "Save"],
  ["V", "Select"],
  ["P", "Add a panel (portrait, landscape or follow the roof)"],
  ["S", "String panels"],
  ["T", "Trace a roof face"],
  ["E", "Erase"],
  ["H", "Move the picture"],
  ["G", "Guide line"],
  ["L", "Add a label"],
  ["C", "Comment"],
  ["/", "Ask Sol to change it"],
  ["Arrows", "Nudge what is picked 5 cm (Shift: 50 cm)"],
  ["Ctrl A", "Pick every panel"],
  ["Ctrl C · Ctrl V", "Copy and paste what is picked"],
  ["Ctrl Z · Ctrl Y", "Undo and redo"],
  ["Delete", "Take out what is picked"],
  ["Q · D", "The Quote, or the Designer view"],
  ["Ctrl + wheel", "Zoom"],
  ["Esc", "Pick nothing, close what is open"],
  ["?", "These shortcuts"],
];

import { KnifeMenu, ToolFan } from "./tool-fan";

const GLASS = "rounded-2xl border border-line bg-surface/75 shadow-lift backdrop-blur-md backdrop-saturate-150";
/**
 * A kit round lit because its part is on the design (10 Nov 2026, Martin: "light up, like a light, when they exist in a
 * design … it should feel like it's been selected"): the signal orange ring, a soft glow and an orange glyph.
 */
const KIT_LIT =
  "border-sun-line bg-surface text-sun-line ring-1 ring-sun-line shadow-[0_0_0_3px_rgb(255_90_31/0.18),0_0_18px_rgb(255_90_31/0.45)] hover:bg-canvas";

/** A panel's outline before it is placed, with the edge it shares with the panel it clicks against. */
type Ghost = LoosePanel & { join?: [Point, Point] };
/** A ghost as the panel it becomes: the join is only for drawing. */
const bare = ({ join, ...panel }: Ghost): LoosePanel => (void join, panel);

/** Something picked on the drawing: a panel in a row, a panel placed by hand, or a label. */
type Pick = { kind: "grid"; face: string; index: number } | { kind: "loose"; id: string } | { kind: "label"; id: string };

const keyOf = (p: Pick) => (p.kind === "grid" ? `g:${p.face}:${p.index}` : p.kind === "loose" ? `l:${p.id}` : `n:${p.id}`);
const same = (a: Pick, b: Pick) => keyOf(a) === keyOf(b);
// Ids are made many at a time when an array is laid, so they count up as well as carrying the time.
let made = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${(made++ % 46656).toString(36)}`;
const middle = (corners: readonly Point[]): Point => ({
  x: corners.reduce((n, c) => n + c.x, 0) / corners.length,
  y: corners.reduce((n, c) => n + c.y, 0) / corners.length,
});
/** Where each of the dial's rounds sits on its arc: degrees from straight left, up (negative) or down. */
const DIAL_STEPS: [step: number, at: number][] = [
  [-5, -40],
  [-1, -20],
  [90, 0],
  [1, 20],
  [5, 40],
];

/** What was read of a face's slope from Google's data, with the way to read it again. */
/**
 * The designer's bar; in the pop-up (8 Nov 2026, Martin: "so many it's overwhelming") its controls fold into one round that
 * brings them out down the left on hover or a press, with a dot while the work isn't saved and the customer's count.
 */
function BarRow(props: {
  tight?: boolean;
  panel?: { title: string; body: React.ReactNode; back: () => void };
  hold: boolean;
  unsaved: boolean;
  waiting: number;
  /** In the pop-up, the drawing tools: a second leg out to the right (8 Nov 2026, Martin: fewer icons on the map). */
  tools?: React.ReactNode;
  /** In the pop-up, the tools used most, as rounds beneath the knife (8 Nov 2026, Martin: stringing and shade). */
  quick?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!props.tight) return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5 lg:flex-nowrap">{props.children}</div>;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <KnifeMenu
        label="Save, publish, the designs and the checks; stringing, tracing, the guide line, undo and redo"
        hold={props.hold}
        panel={props.panel}
        rank={knifeRank}
        sections={[{ title: "This design", children: props.children }, ...(props.tools ? [{ title: "Draw", children: props.tools }] : [])]}
        main={({ open }) => (
          <span
            className={clsx(
              "relative flex size-11 items-center justify-center rounded-full shadow-lift ring-1 transition",
              open ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink ring-line hover:bg-canvas",
            )}
          >
            <Settings2 className="size-5" aria-hidden />
            {props.unsaved && (
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-sun-line ring-2 ring-surface" aria-label="not saved" />
            )}
            {props.waiting > 0 && (
              <span className="absolute -bottom-1 -right-1 min-w-5 rounded-full bg-sun-line px-1 text-center text-[10px] font-semibold leading-5 text-white ring-2 ring-surface">
                {props.waiting}
              </span>
            )}
          </span>
        )}
      />
      {props.quick && (
        <div className="flex flex-col items-center gap-2 border-t border-line pt-2.5" role="toolbar" aria-label="Quick tools">
          {props.quick}
        </div>
      )}
    </div>
  );
}

/**
 * The knife's rows in the order a designer reaches for them (8 Nov 2026, Martin): the customer, then saving, the checks,
 * the designs and the primary, a draft to throw away, sharing live and the chat, and finding another address last.
 */
function knifeRank(name: string): number {
  const order: [RegExp, number][] = [
    [/^save|^saved/i, 2],
    [/to fix|ready to install/i, 3],
    [/^designs?\b/i, 4],
    [/primary/i, 5],
    [/discard|draft/i, 6],
    [/live/i, 7],
    [/chat/i, 8],
    [/another address/i, 9],
  ];
  return order.find(([re]) => re.test(name))?.[1] ?? 1;
}

/** A round on a fan's leg. */
function Leg(props: { label: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.on}
      className={clsx(
        "flex size-11 items-center justify-center rounded-full border shadow-lift backdrop-blur-md",
        props.on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface/95 text-ink hover:bg-surface",
      )}
    >
      {props.children}
    </button>
  );
}

function SlopeNote(props: {
  slope: AspectReading | "busy" | "none" | undefined;
  onRead: () => void;
  /** Whose heights are read: Nearmap's (with the capture's day in words) while its picture is in use, else Google's. */
  nearmap?: string | null;
}) {
  const { slope } = props;
  const whose = props.nearmap ? "Nearmap's" : "Google's";
  const heightsWords = props.nearmap ? `Nearmap's height data (${props.nearmap})` : "Google's height data";
  if (slope === "busy") return <p className="text-sm text-muted">Reading this face&apos;s slope from {heightsWords}…</p>;
  const again = (
    <button className="tap-area font-medium text-ink underline underline-offset-2" onClick={props.onRead}>
      {slope ? "Read it again" : `Read the slope from ${whose} data`}
    </button>
  );
  if (!slope) return <p className="text-sm text-ink-2">{again}</p>;
  if (slope === "none")
    return (
      <p className="text-sm text-ink-2">
        {whose} data couldn&apos;t tell which way this face slopes. Set the direction and pitch below. {again}
      </p>
    );
  const { aspect, disagrees } = slope;
  return (
    <p className="text-sm text-ink-2">
      {aspect.flat
        ? `Read as flat (about ${Math.round(aspect.pitch)}°) from ${aspect.from === "heights" ? heightsWords : "Google's roof model"}.`
        : `Slope read from ${aspect.from === "heights" ? heightsWords : "Google's roof model"}: down towards ${compass(aspect.azimuth)} at about ${Math.round(aspect.pitch)}°.`}{" "}
      {disagrees && <strong className="font-semibold text-ink">Google&apos;s roof model points another way. </strong>}
      {aspect.from === "heights" && props.nearmap ? "Measured when that picture was taken" : "Google's data can be older than the roof"}:
      check it against the photo. {again}
    </p>
  );
}

/**
 * The dial for whatever is picked: a half-round on the right edge of the picture, with the turns set round its arc
 * (a quarter turn in the middle, the fine ones either side), the cross to let go at the top and the bin at the foot,
 * and what it is about (how many are picked, their tilt and what that tilt makes) set inside it.
 */
function Dial(props: {
  label: string;
  /** Turns what is picked by so many degrees; null when there is nothing to turn (a label). */
  onTurn: ((degrees: number) => void) | null;
  onClose: () => void;
  closeTitle: string;
  onRemove?: () => void;
  /** Graphite with an orange ring (as Primero's, for what is picked), in place of the light plate. */
  dark?: boolean;
  children: React.ReactNode;
}) {
  // In rem: the dial's radius, and how far out from its centre (the middle of the picture's right edge) the rounds sit.
  const R = 12.5;
  const at = (degrees: number, out: number) => {
    const a = (degrees * Math.PI) / 180;
    return { left: `${R - out * Math.cos(a)}rem`, top: `${R + out * Math.sin(a)}rem` };
  };
  const round =
    "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-lift ring-1 ring-line hover:ring-ink-2";
  return (
    <div
      className={clsx(
        "absolute right-0 top-[56%] z-10 -translate-y-1/2 rounded-l-full border border-r-0 shadow-lift backdrop-blur-md",
        // Black glass, as the menus over the picture (10 Nov 2026, Martin): the map shows through, softened.
        props.dark
          ? "border-sun-line bg-surface/75 text-white ring-2 ring-sun-line backdrop-saturate-150"
          : "border-line bg-surface/75 backdrop-saturate-150",
      )}
      style={{ width: `${R}rem`, height: `${R * 2}rem` }}
      role="group"
      aria-label={props.label}
    >
      <button
        className={clsx(round, "size-9 text-ink-2 hover:text-ink")}
        style={at(-60, R - 3)}
        onClick={props.onClose}
        title={props.closeTitle}
        aria-label={props.closeTitle}
      >
        <X className="size-4" aria-hidden />
      </button>
      {props.onTurn &&
        DIAL_STEPS.map(([step, degrees]) => (
          <button
            key={step}
            className={clsx(round, "size-9 text-[12.5px] font-semibold tabular-nums text-ink")}
            style={at(degrees, R - 2.1)}
            onClick={() => props.onTurn?.(step)}
            aria-label={`Turn ${Math.abs(step)} degree${Math.abs(step) === 1 ? "" : "s"} ${step < 0 ? "anticlockwise" : "clockwise"}`}
          >
            {step === 90 ? "" : step > 0 ? "+" : "−"}
            {Math.abs(step)}°
          </button>
        ))}
      {props.onRemove && (
        <button
          className={clsx(round, "size-9 text-danger")}
          style={at(60, R - 3)}
          onClick={props.onRemove}
          title="Take out what is picked (Delete)"
          aria-label="Take out what is picked"
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
      )}
      {/* On the glass, the words sit on a small frosted card of their own so they read over any roof. */}
      <div
        className={clsx(
          "absolute right-3 top-1/2 w-[6.75rem] -translate-y-1/2 text-right",
          !props.dark && "rounded-2xl bg-surface/80 p-2.5 shadow-lift ring-1 ring-white/60 backdrop-blur-md",
        )}
      >
        {props.children}
      </div>
    </div>
  );
}

// A panel's angle goes all the way round: turned half way it looks the same, but faces the other way.
const full = (angle: number) => ((angle % 360) + 360) % 360;
/** What a tilt and direction make over a year beside lying flat, in words. */
const besideFlat = (tilt: number, facing: number) => {
  if (tilt === 0) return "Lying flat";
  const gain = Math.round(gainOverFlat(tilt, facing) * 100);
  return gain === 0 ? "The same as lying flat" : `${Math.abs(gain)}% ${gain > 0 ? "more" : "less"} than lying flat`;
};
const cm = (n: number) => Math.round(n * 100) / 100;

/**
 * Where panels being moved or drawn click into place: flush against the panels near them (`snapShift`), else at the
 * wind clearance from a traced face's edge or a guide line they come near (`edgeShift`; a face's own setback when
 * larger). Null when nothing is near.
 */
function placeShift(group: LoosePanel[], others: LoosePanel[], faces: Face[], guides: GuideLine[], size: PanelSize): Point | null {
  const flush = snapShift(group, others, size);
  if (flush) return flush;
  const wind = clearanceFor(MOUNT_STANDOFF);
  const shifts = [
    ...faces.map((f) =>
      edgeShift(
        group,
        f.points.map((a, i) => ({ a, b: f.points[(i + 1) % f.points.length] })),
        size,
        Math.max(wind, f.setback),
      ),
    ),
    edgeShift(group, guides, size, wind),
  ].filter((x): x is Point => x !== null);
  return shifts.length ? shifts.reduce((p, q) => (Math.hypot(q.x, q.y) < Math.hypot(p.x, p.y) ? q : p)) : null;
}

/** The main switchboard, as its button draws it: a board with two rows of breakers. */
function SwitchboardGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <rect x="3" y="2.5" width="14" height="15" rx="1.5" />
      <path d="M6.5 5.5v3M10 5.5v3M13.5 5.5v3M6.5 11v3M10 11v3M13.5 11v3" strokeLinecap="round" />
    </svg>
  );
}

/** A panel as the Landscape button draws it: a rectangle with a small triangle at one end, so its way round reads. */
/** A product's model number (its code on the price list) under its name in the panel, inverter and battery lists (as Primero's). */
function ModelNo({ sku }: { sku: string }) {
  if (!sku) return null;
  return (
    <span className="block font-mono text-[11px] leading-tight text-ink-2" title="Model number (the code on the price list)">
      {sku}
    </span>
  );
}

/** A panel drawn with its cells, upright or on its side: the card's two choices. */
function PanelDrawing({ landscape, size = 14 }: { landscape: boolean; size?: number }) {
  const w = landscape ? size : size * 0.64;
  const h = landscape ? size * 0.64 : size;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <g transform={`translate(${(size - w) / 2} ${(size - h) / 2})`}>
        <rect
          x={0.5}
          y={0.5}
          width={w - 1}
          height={h - 1}
          rx={1}
          fill="currentColor"
          fillOpacity={0.18}
          stroke="currentColor"
          strokeWidth={1}
        />
        {landscape ? (
          <>
            <line x1={w / 3} y1={1} x2={w / 3} y2={h - 1} stroke="currentColor" strokeWidth={0.5} />
            <line x1={(2 * w) / 3} y1={1} x2={(2 * w) / 3} y2={h - 1} stroke="currentColor" strokeWidth={0.5} />
            <line x1={1} y1={h / 2} x2={w - 1} y2={h / 2} stroke="currentColor" strokeWidth={0.8} />
          </>
        ) : (
          <>
            <line x1={1} y1={h / 3} x2={w - 1} y2={h / 3} stroke="currentColor" strokeWidth={0.5} />
            <line x1={1} y1={(2 * h) / 3} x2={w - 1} y2={(2 * h) / 3} stroke="currentColor" strokeWidth={0.5} />
            <line x1={w / 2} y1={1} x2={w / 2} y2={h - 1} stroke="currentColor" strokeWidth={0.8} />
          </>
        )}
      </g>
    </svg>
  );
}

function PanelGlyph(props: { across: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
      {props.across ? (
        <>
          <rect x="2" y="5.5" width="16" height="9" rx="1" />
          <path d="M4.5 8 L7 10 L4.5 12 Z" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="5.5" y="2" width="9" height="16" rx="1" />
          <path d="M8 4.5 L10 7 L12 4.5 Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
/** A roof's slope drawn at its pitch: a base line, the slope rising from its left end, and the angle between them in orange. */
function RoofAngle({ pitch, size = 22 }: { pitch: number; size?: number }) {
  const t = (Math.min(60, Math.max(0, pitch)) * Math.PI) / 180;
  const x0 = 3;
  const y0 = 19;
  const x1 = x0 + 18 * Math.cos(t);
  const y1 = y0 - 18 * Math.sin(t);
  const r = 8;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={`M${x0} ${y0} H21`} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.45} />
      <path d={`M${x0} ${y0} L${x1.toFixed(2)} ${y1.toFixed(2)}`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path
        d={`M${x0 + r} ${y0} A${r} ${r} 0 0 0 ${(x0 + r * Math.cos(t)).toFixed(2)} ${(y0 - r * Math.sin(t)).toFixed(2)}`}
        className="stroke-sun-line"
        strokeWidth={1.6}
        fill="none"
      />
    </svg>
  );
}

/** The pitch with − and +, the figure itself a box to tap and type over (3 Nov 2026, Martin). Enter sets it, where it can. */
function PitchStepper({ pitch, onPitch, onEnter }: { pitch: number; onPitch: (pitch: number) => void; onEnter?: () => void }) {
  const [typed, setTyped] = useState<string | null>(null);
  const take = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setTyped(digits);
    if (digits) onPitch(Math.min(70, Math.max(0, Number(digits))));
  };
  return (
    <div className="mt-1.5 flex items-center justify-center gap-2.5">
      <button
        onClick={() => onPitch(Math.max(0, pitch - 1))}
        className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold hover:bg-line"
        aria-label="Roof pitch down a degree"
      >
        −
      </button>
      <label className="flex items-baseline rounded-md px-1 ring-1 ring-transparent focus-within:ring-sun-line hover:ring-line">
        <input
          type="text"
          inputMode="numeric"
          value={typed ?? String(pitch)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => take(e.target.value)}
          onBlur={() => setTyped(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-label="Roof pitch in degrees"
          className="w-[2.6ch] bg-transparent text-right text-2xl font-semibold tabular-nums outline-none"
        />
        <span className="text-2xl font-semibold">°</span>
      </label>
      <button
        onClick={() => onPitch(Math.min(70, pitch + 1))}
        className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold hover:bg-line"
        aria-label="Roof pitch up a degree"
      >
        +
      </button>
    </div>
  );
}

/** The roof pitch as a small mark on the picture's left edge: the angle and its degrees; pressed, a pad to change it. */
/**
 * The home's roofs and their pitches, on the picture's left edge (3 Nov 2026, Martin: a house and a garage at different
 * angles; a flat roof keeps its mark, to be changed). One mark a roof, the one ringed the roof new panels go down at:
 * pressing another makes it that one (and lays any panels picked at its pitch); pressing the ringed one opens it to
 * change; + adds a roof. Roof 1 is the home's own pitch, flat when the roof is set flat.
 */
function RoofPitches(props: {
  roofs: number[];
  flat: boolean;
  active: number;
  open: boolean;
  onActive: (index: number) => void;
  onOpen: (open: boolean) => void;
  onPitch: (index: number, pitch: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onNotFlat: () => void;
  /** What Nearmap's heights read for the home's roof, said beside the mark until put away. */
  note?: string | null;
  onNoteClose?: () => void;
  /** Reads the home's pitch from Nearmap's heights and sets it: offered on a Nearmap picture. */
  onRead?: () => void;
  reading?: boolean;
}) {
  const { roofs, flat, active, open } = props;
  const pitch = roofs[active] ?? 0;
  const several = roofs.length > 1;
  return (
    <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1.5">
        {roofs.map((p, i) => {
          const isFlat = i === 0 && flat;
          return (
            <button
              key={i}
              onClick={() => (i === active ? props.onOpen(!open) : props.onActive(i))}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 text-ink",
                GLASS,
                i === active ? "ring-2 ring-sun-line" : "opacity-80 hover:opacity-100",
              )}
              title={
                i === active
                  ? `${several ? `Roof ${i + 1}: ` : ""}${isFlat ? "flat" : `${p}°`}. New panels go down at it. Press to change it.`
                  : `Roof ${i + 1}, ${isFlat ? "flat" : `${p}°`}: lay new panels (and any picked) at it`
              }
              aria-expanded={i === active ? open : undefined}
              aria-label={`Roof ${i + 1}, ${isFlat ? "flat" : `${p} degrees`}${i === active ? ", in use: change it" : ": use it"}`}
            >
              <RoofAngle pitch={isFlat ? 0 : p} />
              <span className="text-xs font-semibold tabular-nums leading-none">{isFlat ? "Flat" : `${p}°`}</span>
              {several && <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted">Roof {i + 1}</span>}
              {several && (
                <span className="mt-0.5 h-1 w-7 rounded-full" style={{ background: ROOF_COLOURS[i % ROOF_COLOURS.length] }} aria-hidden />
              )}
            </button>
          );
        })}
        {roofs.length < MAX_ROOFS && (
          <button
            onClick={props.onAdd}
            className={clsx("flex size-8 items-center justify-center text-ink-2 hover:text-ink", GLASS)}
            title="Another roof at its own pitch (a garage, a patio)"
            aria-label="Add another roof pitch"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-full top-1/2 ml-2 w-56 -translate-y-1/2 rounded-2xl bg-surface p-3 text-ink shadow-lift ring-1 ring-line">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {several ? `Roof ${active + 1} pitch` : "Roof pitch"}
            </span>
            <button onClick={() => props.onOpen(false)} className="text-xs font-medium text-muted hover:text-ink">
              Done
            </button>
          </div>
          {active === 0 && flat ? (
            <>
              <p className="mt-2 text-sm text-ink-2">Set as a flat roof: panels lie flat unless tilted on frames.</p>
              <button
                onClick={props.onNotFlat}
                className="mt-2 w-full rounded-full bg-surface py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-surface-2"
              >
                It isn&apos;t flat: set a pitch
              </button>
            </>
          ) : (
            <PitchStepper pitch={pitch} onPitch={(n) => props.onPitch(active, n)} onEnter={() => props.onOpen(false)} />
          )}
          {active === 0 && props.onRead && (
            <button
              onClick={props.onRead}
              disabled={props.reading}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-surface py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-surface-2 disabled:text-muted"
              title="Measure the roof's pitch from Nearmap's height survey and set it"
            >
              <Ruler className="size-3.5" aria-hidden />
              {props.reading ? "Reading the heights…" : "Read it from Nearmap"}
            </button>
          )}
          {active === 0 && props.note && <p className="mt-2 text-[11px] leading-snug text-ink-2">{props.note}</p>}
          {active > 0 && (
            <button onClick={() => props.onRemove(active)} className="mt-2 w-full text-xs font-medium text-muted hover:text-danger">
              Remove roof {active + 1}
            </button>
          )}
        </div>
      )}
      {!open && props.note && (
        <div
          className="absolute left-full top-1/2 ml-2 flex w-60 -translate-y-1/2 items-start gap-1.5 rounded-2xl bg-surface p-2.5 text-ink shadow-lift ring-1 ring-line"
          role="status"
        >
          <Ruler className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-ink-2">{props.note}</p>
          <button
            onClick={props.onNoteClose}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            aria-label="Put the note away"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The roof's pitch, asked for on a new site (1 Nov 2026, Martin, as Primero's: so it isn't forgotten, above all on a
 * flat roof left at the 22° start). It comes in after a moment, small and to the side, so the roof is seen first. Kept
 * with the design's quote settings, so it asks again only if left unsaved.
 */
function PitchFirst(props: {
  pitch: number;
  flat: boolean;
  onSet: (pitch: number, roof?: "flat") => void;
  /** What Nearmap's heights suggest, when too little of the roof agreed to set it without asking. */
  hint?: string | null;
  reading?: boolean;
}) {
  const [pitch, setPitch] = useState(props.pitch);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div className="absolute right-3 top-1/2 z-30 w-52 -translate-y-1/2">
      <div className={clsx("p-3 text-ink", GLASS)} role="dialog" aria-label="Set the roof pitch">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">First, the roof</p>
        <h3 className="mt-0.5 text-[15px] font-semibold tracking-tight">What is the roof&apos;s pitch?</h3>
        <div className="mt-1 flex justify-center text-ink">
          <RoofAngle pitch={pitch} size={44} />
        </div>
        <PitchStepper pitch={pitch} onPitch={setPitch} onEnter={() => props.onSet(pitch)} />
        <p className="mt-1.5 text-center text-[11px] leading-snug text-muted">
          {props.hint ?? (props.reading ? "Reading Nearmap's heights for it…" : "Tap the figure to type it. New panels start at it.")}
        </p>
        {/* The flat roof is a button of its own beside Set (Martin: it was easy to miss as a line of text). */}
        <div className="mt-2.5 flex gap-1.5">
          <button
            onClick={() => (props.flat ? props.onSet(pitch) : props.onSet(props.pitch, "flat"))}
            className="flex-1 rounded-full bg-surface py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-surface-2"
          >
            {props.flat ? "Flat: carry on" : "It’s flat"}
          </button>
          <button
            onClick={() => props.onSet(pitch)}
            className="flex-1 rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-ink hover:bg-forest"
          >
            Set {pitch}°
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The widest the picture may be and still fit the window with the bar and the figures above it: the picture is
 * given all the room there is, since it is where the work is done.
 */
const FIT = `calc((100dvh - 14rem) * ${ROOF_IMAGE.width / ROOF_IMAGE.height})`;
const WHOLE: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: ROOF_IMAGE.width, h: ROOF_IMAGE.height };
/**
 * How far in the designer opens on the roof: the middle of the picture, this many times closer than the whole of it.
 * One press of the zoom button (1.4×) back from 1.6 (3 Nov 2026, Martin: "too zoomed in").
 */
const OPEN_ZOOM = 1.6 / 1.4;
const OPENED: typeof WHOLE = {
  x: (ROOF_IMAGE.width - ROOF_IMAGE.width / OPEN_ZOOM) / 2,
  y: (ROOF_IMAGE.height - ROOF_IMAGE.height / OPEN_ZOOM) / 2,
  w: ROOF_IMAGE.width / OPEN_ZOOM,
  h: ROOF_IMAGE.height / OPEN_ZOOM,
};
/**
 * Where the view may sit: up to half of it past any edge of the picture (as Primero's: a view held inside the picture
 * can't move at all while the whole picture is showing, so the hand did nothing). A roof near an edge can be dragged to
 * the middle, and at least half the view always shows the picture.
 */
const within = (at: number, size: number, whole: number) => Math.min(Math.max(-size / 2, at), whole - size / 2);

/**
 * The roof designer: the roof from above, to scale, with a bar of tools down
 * its side. Trace roof faces and panels fill them in rows; pick panels one or
 * several at a time and move, turn or remove them; place single panels;
 * string panels up in wiring order; pin labels for the inverter, battery and
 * switchboard; zoom in and move around. Everything is saved with the design.
 */
export function RoofDesigner(props: {
  address: string;
  image: string;
  /** The designs for this roof: up to five options, one of them the primary. */
  set: DesignSet;
  /** The panels, inverters and batteries to choose from. Never their costs. */
  catalogue: CataloguePanel[];
  inverters: CatalogueInverter[];
  batteries: CatalogueBattery[];
  /** The EV chargers on the business's price lists (none signed out or without a list). Never their costs. */
  chargers?: CatalogueCharger[];
  /** When the work it opens on was kept as a draft (an earlier visit's unsaved work); null or left out when it opens on what is saved. */
  draftAt?: string | null;
  /** Keeps the work not yet saved as a draft, a moment after it stops changing (`closing`: the page is going). Answers a problem or null. */
  onDraft?: (set: DesignSet, extras: DesignExtras, closing: boolean) => Promise<string | null>;
  /** Throws the draft away and opens the roof as it was last saved. */
  onDiscardDraft?: () => void;
  yieldPerKwDay: number;
  /** The business's price lists, parts, installation rates and margin: what the quote is worked out from. */
  workspace: Workspace;
  /** The STC rules, as last read. */
  rates: RebateRates;
  /** For the quote's rebate zone. */
  postcode: string;
  /** The customer's bill, and each design's quote settings and hand changes, as last saved. */
  extras: DesignExtras;
  /** Keeps the designs, the bill and the quotes: resolves to an error message when they couldn't be kept. */
  onSave: (set: DesignSet, extras: DesignExtras, net: number | null) => Promise<string | null>;
  /** Inside the designer pop-up (8 Nov 2026): a squarer window, so the bar is trimmed to one line and the picture fits it. */
  tight?: boolean;
  /** What to say once saved: where the work is kept ("Saved to your account", "Saved on this device"). */
  savedLabel?: string;
  /** Makes the proposal from the design just saved. Answers with what went wrong, or null. */
  onPublish?: () => Promise<string | null>;
  /** For a roof opened from a deal: sends a note to the customer in the job's conversation, with the proposal just published. Answers what happened. */
  onNote?: (text: string) => Promise<{ ok: boolean; message: string }>;
  /** An installer's designer (business-kind.ts): sites only, so no Publish, no Proposal view and no Sol panel to open. */
  sitesOnly?: boolean;
  /** Looks for a product's datasheet online and keeps its figures, unchecked (datasheet-finder.ts). */
  onFindSheet?: (product: { kind: "panel" | "inverter"; sku: string; name: string }) => Promise<{ ok: boolean; message: string }>;
  /** The roof picture's menu (Google or a Nearmap capture), in the picture's bottom right corner. */
  pictureMenu?: React.ReactNode;
  /** Nearmap is set up for this roof, so its angled photos (Sides) can be shown beside the roof. */
  sidesReady?: boolean;
  /** The picture under the design is Nearmap's: drawn straight down, so Google's roof model needs no shifting onto it. */
  nearmapPicture?: boolean;
  /** When that Nearmap picture was captured, in words ("25 Apr 2026"), for the notes that name it. */
  nearmapCaptured?: string | null;
  /** A site with no deal: what Publish opens instead (the way to put it on a deal), since a proposal needs a customer. */
  noDeal?: React.ReactNode;
  /** Who the note goes to, for the box's wording. */
  customerName?: string;
  /** Where this roof's proposal is, once there is one. */
  proposalHref?: string | null;
  /**
   * The person may not see costs (the owner's setting, enforced on the server, which sends them no costs at all):
   * no quote and no price are shown, and no price is handed on when saving.
   */
  costsHidden?: boolean;
  /** Told whenever the design gains or loses unsaved changes, so the page can ask before leaving it. */
  onUnsaved?: (unsaved: boolean) => void;
  /** The start of the bar at the top of the page (the wordmark and the address), and the way out, drawn by the page. */
  bar?: React.ReactNode;
  /** The Designer view's foot: the deal's notes, for a roof opened from a deal. */
  notes?: React.ReactNode;
  /** The Proposal view under its buttons: the chat with the customer and the timeline of what was sent, or for a site with no deal, why not. */
  proposal?: React.ReactNode;
  /** How many of the customer's lines wait for an answer: a count on the Proposal tab. */
  waiting?: number;
  /** The deal this roof is on: Sol can look through its file for the customer's usage. */
  jobId?: string;
}) {
  // The design being worked on is held in the states below; the others wait in `designs`, whose entry for the
  // one being worked on is out of date until it is put away again (`everyDesign`).
  const first = props.set.designs[props.set.primary] ?? props.set.designs[0];
  const spot = { lat: first.lat, lng: first.lng };
  const [designs, setDesigns] = useState<RoofDesign[]>(props.set.designs);
  const [active, setActive] = useState(props.set.primary);
  const [primary, setPrimary] = useState(props.set.primary);
  // What is typed to narrow a list on the bar (the inverters, the batteries): emptied whenever a list opens or closes.
  const [seek, setSeek] = useState("");
  const [menu, setMenu] = useState<"designs" | "panels" | "inverters" | "batteries" | "chargers" | "bill" | false>(false);
  // A press anywhere outside a list's own holder puts the open list away.
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-menu-host]")) {
        setMenu(false);
        setSeek("");
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);
  /** Opens one of the bar's lists, or closes them: always with the search box empty. */
  const openMenu = (to: typeof menu) => {
    setMenu(to);
    setSeek("");
  };
  // The battery on this design, and where it stands on the picture.
  const [battery, setBattery] = useState<DesignBattery | undefined>(first.battery);
  // The EV charger on this design, and where it will be mounted (5 Nov 2026): from the business's price lists.
  const [charger, setCharger] = useState<DesignCharger | undefined>(first.charger);
  // This person's favourite products: starred ones come first in each list.
  const favourites = useFavourites();
  // The customer's electricity bill, as typed in from it: what the summary's bill, saving and payback are worked out from.
  const [bill, setBillFields] = useState(props.extras.bill);
  // Sol looking through the deal's file for the customer's usage (1 Nov 2026, as Primero's): the figures go into the box
  // with the words he found them in, to check before saving; figures typed while he looked are kept.
  const [usageRead, setUsageRead] = useState<{ busy: boolean; notes: string[]; error?: string; photo?: boolean } | null>(null);
  // The switchboard from a photo (2 Nov 2026, Martin): what Sol reads on it, and the suggestions for the lines decided
  // on each job, applied to the quote in one press (and changed there like any decision).
  const [board, setBoard] = useState<{ busy: boolean; advice?: SwitchboardAdvice; error?: string; applied?: boolean } | null>(null);
  const readBoard = async (file: File) => {
    setBoard({ busy: true });
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/design/switchboard", { method: "POST", body: form });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; read?: SwitchboardRead };
      if (!j.ok || !j.read) return setBoard({ busy: false, error: j.message ?? "The photo couldn't be read." });
      setBoard({ busy: false, advice: switchboardAdvice(j.read, { battery: Boolean(battery), ev: Boolean(charger) }) });
    } catch {
      setBoard({ busy: false, error: "We couldn't reach the server." });
    }
  };
  const applyBoard = (advice: SwitchboardAdvice) => {
    const edits = { ...quoteNow.edits };
    const decide = (label: string, include: boolean | null) => {
      if (include === null) return;
      edits[lineKey({ group: "Switchboard", label })] = include ? { on: true } : { removed: true };
    };
    decide("Switchboard upgrade", advice.upgrade);
    decide("RCBO", advice.rcbo);
    setQuote({ form: advice.phase ? { ...quoteNow.form, phase: advice.phase } : quoteNow.form, edits });
    setBoard({ busy: false, advice, applied: true });
  };
  // A bill photo or PDF read into the box (2 Nov 2026, Martin), by the homeowner site's own reader: nothing kept.
  const readBillPhoto = async (file: File) => {
    billTouched.current = false;
    setUsageRead({ busy: true, notes: [], photo: true });
    try {
      const form = new FormData();
      form.append("bill", file);
      form.append("address", props.address);
      const res = await fetch("/api/design/bill", { method: "POST", body: form });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; read?: BillPhotoRead };
      if (!j.ok || !j.read) return setUsageRead({ busy: false, notes: [], error: j.message ?? "That bill couldn't be read.", photo: true });
      const out = billFieldsFromPhoto(j.read, bill);
      if (!billTouched.current) {
        setBillFields(out.fields);
        setSaved("changed");
      }
      setUsageRead({ busy: false, notes: out.notes, photo: true });
    } catch {
      setUsageRead({ busy: false, notes: [], error: "We couldn't reach the server.", photo: true });
    }
  };
  const solLooked = useRef(false);
  const billTouched = useRef(false);
  /** Sol looks through the deal's file for what the home uses; answers with what he found (null when nothing). */
  const askSol = async (): Promise<{ fields: typeof bill; notes: string[] } | null> => {
    if (!props.jobId) return null;
    solLooked.current = true;
    billTouched.current = false;
    setUsageRead({ busy: true, notes: [] });
    try {
      const res = await fetch(`/api/design/jobs/${encodeURIComponent(props.jobId)}/usage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: bill }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; fields?: typeof bill; notes?: string[] };
      if (j.ok && j.fields) {
        const kept = billTouched.current;
        if (!kept) {
          setBillFields(j.fields);
          setSaved("changed");
        }
        setUsageRead({
          busy: false,
          notes: kept ? ["You changed the box while Sol looked, so yours are kept.", ...(j.notes ?? [])] : (j.notes ?? []),
        });
        return { fields: j.fields, notes: j.notes ?? [] };
      } else setUsageRead({ busy: false, notes: [], error: j.message ?? "Sol couldn't find it." });
    } catch {
      setUsageRead({ busy: false, notes: [], error: "We couldn't reach the server." });
    }
    return null;
  };
  // Each design's quote settings and hand changes, in the designs' order.
  // The home (phase, storeys, roof) and the costs decided on each job are the same on every design: brought into line with
  // the primary as the roof opens, then kept so (`sharedHome`).
  const [quotes, setQuotes] = useState<QuoteFields[]>(() => sharedHome(props.extras.quotes, props.set.primary));
  // The price after STCs, as the quote builder last worked it out; null when there is nothing to price.
  const [net, setNet] = useState<number | null>(null);
  // Someone who may not see costs has no real costs to price with: the quote's figure is never taken up.
  const costsHidden = Boolean(props.costsHidden);
  const onNet = useCallback((value: number | null) => setNet(costsHidden ? null : value), [costsHidden]);
  // The design someone has asked to delete, until they say they mean it.
  const [doomed, setDoomed] = useState<number | null>(null);
  const [faces, setFaces] = useState<Face[]>(first.faces);
  // What was read of each face's slope from Google's data this visit (`readSlope`), by face.
  const [slopes, setSlopes] = useState<Record<string, AspectReading | "busy" | "none">>({});
  const [loose, setLoose] = useState<LoosePanel[]>(first.loose ?? []);
  const [strings, setStrings] = useState<PanelString[]>(first.strings ?? []);
  /** What String automatically did, in plain words, until the strings are next changed by hand. */
  const [autoNote, setAutoNote] = useState<{
    ok: boolean;
    note: string;
    /** The product whose figures aren't on file, to look for its datasheet online. */
    missing?: { kind: "panel" | "inverter"; sku: string; name: string };
  } | null>(null);
  const [findingSheet, setFindingSheet] = useState(false);
  const [labels, setLabels] = useState<DesignLabel[]>(first.labels ?? []);
  const [panel, setPanel] = useState<PanelSpec | undefined>(first.panel);
  const [designLabel, setDesignLabel] = useState(first.label ?? "");
  // Guide lines along roof edges, and the one being drawn: its first end, and where the pointer has it reaching.
  const [rules, setRules] = useState<GuideLine[]>(first.guides ?? []);
  // The main switchboard (MSB), marked on the drawing like the inverter and battery, and dragged to where it is.
  const [msb, setMsb] = useState<Point | null>(first.switchboard ?? null);
  const [ruling, setRuling] = useState<{ a: Point; b: Point } | null>(null);
  // The inverters on this design: one, or more on a larger system.
  const [fitted, setFitted] = useState<InverterSpec[]>(first.inverters ?? []);
  // Whether the inverter list is showing its suggestions for the panels on the design.
  const [suggesting, setSuggesting] = useState(false);
  // The string the pointer is over, on the picture or in the list of strings: its check is shown.
  const [hover, setHover] = useState<string | null>(null);
  // The string whose check is open on the picture: opened from its tick or cross in the strings box, never by hovering
  // (Martin: the check covered the roof as soon as the pointer crossed a string).
  const [checking, setChecking] = useState<string | null>(null);
  // Which way Add a panel lays new panels: chosen from the two bubbles beside the tool (Martin).
  // New panels' way round: portrait, landscape, or (null) following the roof face or the panel beside them.
  const [addLandscape, setAddLandscape] = useState<boolean | null>(null);
  // The two bubbles fanned out of Add a panel, like a hand of cards: open from a press on the tool, gone once one is chosen.
  const [fanOpen, setFanOpen] = useState(false);
  // The battery or the inverter under the pointer: its details show beside it.
  const [kit, setKit] = useState<"battery" | number | null>(null);
  // The kit picked on the picture (9 Nov 2026, Martin: delete an inverter or battery straight from the map): an inverter
  // by its place, the battery, the main switchboard or the EV charger. A small bar over it takes it off.
  const [kitPick, setKitPick] = useState<"battery" | "msb" | "charger" | number | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  // The tools, opened by a right click where the pointer is (1 Nov 2026, Martin, as Primero's): in % of the picture.
  const [toolMenu, setToolMenu] = useState<{ x: number; y: number } | null>(null);
  // An array just laid (as Primero's): its tilt is offered beside the turn buttons, to change or keep, while it is picked.
  const [tiltPop, setTiltPop] = useState<string[]>([]);
  // Faces traced this visit whose pitch nobody has looked at yet (as Primero's): their pitch pulses in orange until checked.
  const [pitchDue, setPitchDue] = useState<string[]>([]);
  // Beside the picture, one view at a time (1 Nov 2026, Martin: Primero's Designer / Quote / Proposal): the home and the
  // deal's notes, the quote, or the proposal with its chat and timeline. As Primero's, the tabs sit at the top of the
  // column beside the picture, which always shows. The choice is kept on this device.
  const [side, setSide] = useState<SideView | null>("designer");
  useEffect(() => {
    try {
      const kept = window.localStorage.getItem(SIDE_KEY);
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (kept === "quote" || kept === "proposal" || kept === "designer") setSide(kept);
    } catch {
      // Storage is off: the Designer view opens.
    }
  }, []);
  // The quote's short view (smaller, group totals only), so the picture spreads out; kept on this device like the open state.
  const [quoteShort, setQuoteShort] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem("renuabl.design.quote-short") === "1") setQuoteShort(true);
    } catch {
      // Storage is off: the full quote shows.
    }
  }, []);
  const shown: SideView | null = side === "quote" && costsHidden ? "designer" : side;
  const shortQuote = (next: boolean) => {
    setQuoteShort(next);
    try {
      window.localStorage.setItem("renuabl.design.quote-short", next ? "1" : "0");
    } catch {
      // Nothing to do: it still changes for this visit.
    }
  };
  // The column beside the picture lies over it (8 Nov 2026, Martin: the picture as large as the first fold allows, the
  // column revealed by hovering the handle on the right edge), out only while looked at or worked in.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<number | null>(null);
  const holdPeek = () => {
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
    peekTimer.current = null;
  };
  const sideNow = useRef({ side, peek });
  useEffect(() => {
    sideNow.current = { side, peek };
  });
  const showSide = (view: SideView) => {
    holdPeek();
    setPeek(true);
    setSide(view);
    try {
      window.localStorage.setItem(SIDE_KEY, view);
    } catch {
      // Nothing to do: it still opens and closes for this visit.
    }
  };
  useEffect(() => {
    const open = (v: unknown, toggle: boolean) => {
      if (v !== "quote" && v !== "designer" && v !== "proposal") return;
      if (toggle && sideNow.current.peek && sideNow.current.side === v) return setPeek(false);
      setSide(v);
      setPeek(true);
    };
    open(new URLSearchParams(window.location.search).get("side"), false);
    const hear = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const asked = (e.data as { renuablDesign?: { side?: unknown; save?: unknown } } | null)?.renuablDesign;
      // The window round it asks for a save before it shows the proposal (design-drawer.tsx, `saveThen`).
      if (asked?.save === true) window.dispatchEvent(new Event("renuabl:design-save"));
      open(asked?.side, true);
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, []);
  // "Design it for me": working, or the three designs it made and what to know about them.
  const [mine, setMine] = useState<"idle" | "busy" | SelfDesignResult>("idle");
  // Whether "Design it for me" is saying what it will do, before it does it.
  const [mineIntro, setMineIntro] = useState(false);
  // Whether that card is open: it folds to a chip once a design is picked, so the roof has the room.
  const [mineOpen, setMineOpen] = useState(true);
  /** Takes up a tool, leaving behind anything half-drawn with the last one. */
  const pickTool = (t: Tool) => {
    setTool(t);
    setToolMenu(null);
    setFanOpen(false);
    setTracing([]);
    setRuling(null);
    setArrayHint(null);
    setOnPanel(false);
  };
  const [view, setView] = useState(OPENED);
  const [selected, setSelected] = useState<string | null>(first.faces[0]?.id ?? null);
  const [picks, setPicks] = useState<Pick[]>([]);
  // Drawing mode (the photo put away and the roof drawn plainly) has no button now; the code stays for later.
  const [drawn] = useState(false);
  // The Drawn view (10 Nov 2026, Martin): the roof as an illustration in place of the photo, its surroundings a dim
  // ghost of it, panels drawn as panels and the kit on a wall of its own. Made in the browser from what is already
  // loaded (illustrated-roof.tsx). The choice is kept on the device.
  const [illustrated, setIllustrated] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(ART_KEY) === "1") setIllustrated(true);
    } catch {
      // Storage is off: the photo shows.
    }
  }, []);
  const toggleIllustrated = () => {
    const next = !illustrated;
    setIllustrated(next);
    try {
      window.localStorage.setItem(ART_KEY, next ? "1" : "0");
    } catch {
      // Nothing to do: it still changes for this visit.
    }
  };
  const ghost = useRoofGhost(props.image, illustrated, ROOF_IMAGE.width, ROOF_IMAGE.height);
  // The roof's faces from Google's roof model, for the drawing: null until asked for, "none" when there is no data.
  const [modelFaces, setModelFaces] = useState<DrawnFace[] | "none" | null>(null);
  // The drawing view has no button now (8 Nov 2026, Martin: no use to him); it stays off, whatever a device kept.
  useEffect(() => {
    // The first time the drawing is asked for on a roof, Google's roof model is fetched once (the server keeps it).
    // The Drawn view asks for it only while no face is traced: traced faces are the roof.
    if (!(drawn || (illustrated && faces.length === 0)) || modelFaces !== null) return;
    let gone = false;
    void loadRoofModel(spot.lat, spot.lng).then((model) => {
      if (gone) return;
      const found = model ? facesFromModel(model, spot) : [];
      setModelFaces(found.length ? found : "none");
    });
    return () => {
      gone = true;
    };
    // The roof is the same for the life of this designer: its place never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, illustrated, faces.length, modelFaces]);
  // The ground around the roof for the drawing (lawn, trees, paving), painted from the photo's own colours: a small
  // picture made in the browser from the photo already loaded, so it costs nothing and is there at once.
  const [ground, setGround] = useState<string | null>(null);
  const photo = props.image;
  useEffect(() => {
    if (!drawn || !photo) return;
    let gone = false;
    const img = new window.Image();
    img.onload = () => {
      if (gone) return;
      try {
        // A third of the picture's size is plenty: the result is plain shapes, and it is tidied in a blink.
        const w = Math.round(ROOF_IMAGE.width / 3);
        const h = Math.round(ROOF_IMAGE.height / 3);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const cells = new Array<Ground>(w * h);
        for (let i = 0; i < w * h; i++) cells[i] = groundOf(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2]);
        const tidy = tidyGround(cells, w, h);
        for (let i = 0; i < w * h; i++) {
          const [r, g, b] = GROUND_COLOURS[tidy[i]];
          data.data[i * 4] = r;
          data.data[i * 4 + 1] = g;
          data.data[i * 4 + 2] = b;
          data.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        setGround(canvas.toDataURL("image/png"));
      } catch {
        // The photo can't be read here: the drawing keeps its plain ground.
      }
    };
    img.src = photo;
    return () => {
      gone = true;
    };
  }, [drawn, photo]);
  // The better ground, from Google's heights, building outline and photo together (the server makes it once for a
  // roof and keeps it): buildings, trees, lawn and paving told apart properly. Until it arrives, or where there is
  // no data for the place, the ground read from the photo's colours stands in.
  const measuredUrl = `/api/design/roof/ground?lat=${spot.lat}&lng=${spot.lng}`;
  const [measured, setMeasured] = useState<"asking" | "there" | "none">("asking");
  useEffect(() => {
    if (!drawn || measured !== "asking") return;
    let gone = false;
    const img = new window.Image();
    img.onload = () => !gone && setMeasured("there");
    img.onerror = () => !gone && setMeasured("none");
    img.src = measuredUrl;
    return () => {
      gone = true;
    };
  }, [drawn, measured, measuredUrl]);
  // The heights of everything around the roof: asked for the first time the shade analysis is wanted.
  // Nearmap's heights go with Nearmap's picture (9 Nov 2026, Martin): kept by which were asked for, so switching the
  // picture asks for the other's.
  const heightsFrom = props.nearmapPicture ? "nearmap" : "google";
  const [terrainBy, setTerrainBy] = useState<{ asked: string; t: Heights | "none" } | null>(null);
  const terrain = terrainBy?.asked === heightsFrom ? terrainBy.t : null;
  const setTerrain = (t: Heights | "none") => setTerrainBy({ asked: heightsFrom, t });
  /** The capture's day in words when the heights in use are Nearmap's. */
  const nearmapHeights =
    terrain && terrain !== "none" && terrain.from === "nearmap"
      ? terrain.captured
        ? new Date(`${terrain.captured}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
        : "Nearmap"
      : null;
  const [shadeOn, setShadeOn] = useState(false);
  // The shade on the design as it stands: each panel's access to the sun by its key, and the design's as a whole.
  const [shade, setShade] = useState<{ report: ShadeReport; keys: string[] } | null>(null);
  // The heights are read once there are panels on the roof, so shaded panels show as they are laid (10 Nov 2026,
  // Martin), not only once the shade view is opened.
  const anyPanels = loose.length > 0 || faces.length > 0;
  useEffect(() => {
    if (!(shadeOn || anyPanels) || terrain !== null) return;
    let gone = false;
    void loadTerrain(spot.lat, spot.lng, { nearmap: props.nearmapPicture }).then((found) => !gone && setTerrain(found ?? "none"));
    return () => {
      gone = true;
    };
    // The roof's place never changes for the life of this designer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadeOn, anyPanels, terrain]);
  const toggleShade = () => {
    setShadeOn(!shadeOn);
    setArraysOpen(false);
  };
  // The arrays on the design, listed (and each marked with its size on the picture) while this is open.
  const [arraysOpen, setArraysOpen] = useState(false);
  // The pointer is over a panel while adding panels: the arrow takes over there, so the panel can be picked and moved.
  const [onPanel, setOnPanel] = useState(false);
  // The array under the pointer, with the spot of the small round that picks all of it.
  const [arrayHint, setArrayHint] = useState<{ picks: Pick[]; keys: string[]; at: Point; box: [number, number, number, number] } | null>(
    null,
  );
  const [wiring, setWiring] = useState<string | null>(first.strings?.[0]?.id ?? null);
  const [labelKind, setLabelKind] = useState<LabelKind>("Inverter");
  const [labelText, setLabelText] = useState("");
  // The corners of a face being traced, before it is closed.
  const [tracing, setTracing] = useState<Point[]>([]);
  // The box being dragged out to pick several things.
  const [band, setBand] = useState<{ a: Point; b: Point } | null>(null);
  // The outline of the panel the "place a panel" tool would put down.
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  // Which way a picked group's turn handle points, in degrees from straight up: it follows the pointer while the group is spun.
  const [spinAt, setSpinAt] = useState(0);
  // The discussion: saved the moment something is said, apart from the drawing.
  const [comments, setComments] = useState<DesignComment[]>(props.set.comments);
  // The bubble that is open: one already there, or a spot waiting for its first words.
  const [thread, setThread] = useState<{ id: string } | { at: Point } | null>(null);
  const [words, setWords] = useState("");
  const [talking, setTalking] = useState<"idle" | "sending" | { error: string }>("idle");

  const say = (op: Record<string, unknown>) => {
    const next = applyCommentOp(comments, op, "You", new Date().toISOString().slice(0, 16), newId("c"));
    if (!next) return setTalking({ error: "That couldn't be saved." });
    setComments(next);
    setWords("");
    setTalking("idle");
    setSaved("changed");
    // A new bubble opens as itself; one that has been removed closes.
    if (op.do === "add") setThread(next.length ? { id: next[next.length - 1].id } : null);
    if (op.do === "remove") setThread(null);
  };
  // Opened on a draft from an earlier visit, the work is there but not yet saved.
  // Opened on a draft: there is work to save. (Designs brought into line with the primary's home as the roof opens are
  // not: the proposal does the same with what is saved, so nothing waits on a save; 8 Nov 2026, Martin.)
  const [saved, setSaved] = useState<"saved" | "saving" | "changed" | { error: string }>(props.draftAt ? "changed" : "saved");
  // The draft this designer opened on (when), shown until it is saved or thrown away; and whether the work as it stands is kept as one.
  const [resumed, setResumed] = useState<string | null>(props.draftAt ?? null);
  const [drafted, setDrafted] = useState(Boolean(props.draftAt));
  // Work not kept anywhere yet: what leaving should ask about. Work kept as a draft opens again where it was left.
  const unkept = (saved === "changed" || typeof saved === "object") && !(drafted && props.onDraft);
  const { onUnsaved } = props;
  useEffect(() => onUnsaved?.(saved === "saving" || unkept), [onUnsaved, saved, unkept]);
  const svg = useRef<SVGSVGElement>(null);
  // The whole picture in the first fold (1 Nov 2026, Martin: its foot was cut off): measured from where the figures
  // strip starts on the page to the foot of the window, since the bar above it changes height with what it holds.
  // The strip may arrive after the designer mounts, so it is watched from its own ref.
  const [fitPx, setFitPx] = useState<number | null>(null);
  // The first fold from the top of the figures strip, which the column beside the picture keeps within.
  const [foldPx, setFoldPx] = useState<number | null>(null);
  const stripBox = useCallback((strip: HTMLElement | null) => {
    if (!strip) return;
    const measure = () => {
      const box = strip.getBoundingClientRect();
      const top = box.top + window.scrollY;
      const room = window.innerHeight - top - box.height - 8 - 16;
      setFitPx(Math.max(360, Math.round(room * (ROOF_IMAGE.width / ROOF_IMAGE.height))));
      setFoldPx(Math.max(320, Math.round(window.innerHeight - top - 16)));
    };
    // Measured at once too: a tab in the background gets no resize callbacks until it is shown.
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(strip);
    watch.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const fit = fitPx ? `${fitPx}px` : FIT;
  // A press that may turn into a drag: of what is picked, of a box to pick with, or of the picture itself.
  const press = useRef<
    | { mode: "move"; at: Point; picks: Pick[]; starts: Record<string, Point> | null; others?: LoosePanel[] }
    | { mode: "band"; at: Point; face: string | null; add: boolean; moved: boolean }
    | { mode: "pan"; x: number; y: number; from: typeof WHOLE }
    | { mode: "turn"; id: string; centre: Point }
    | { mode: "array"; anchor: LoosePanel }
    | { mode: "wire"; id: string; first: string; had: boolean; dragged: boolean }
    | { mode: "battery"; dx: number; dy: number }
    | { mode: "msb"; dx: number; dy: number }
    | { mode: "charger"; dx: number; dy: number }
    | { mode: "inverter"; n: number; dx: number; dy: number }
    | { mode: "erase"; faceGone?: boolean }
    | { mode: "spin"; centre: Point; from: number; starts: Record<string, LoosePanel> }
    | null
  >(null);

  // Undo and redo. The drawing (faces, panels, strings, labels) is remembered each time it changes: once for
  // a click, and once for a whole drag however far it went. Comments aren't part of it: they are saved as posted.
  const drawing = useMemo(
    () => ({ faces, loose, strings, labels, panel, fitted, rules, battery, charger }),
    [faces, loose, strings, labels, panel, fitted, rules, battery, charger],
  );
  const history = useRef({ past: [] as (typeof drawing)[], future: [] as (typeof drawing)[], last: drawing, restoring: false });
  // Bumped when a drag ends, so the drawing is looked at again once the pointer has let go.
  const [settled, setSettled] = useState(0);
  // A slider being dragged changes the drawing at every notch: it is one step too.
  const sliding = useRef(false);
  const slides = {
    onPointerDown: () => {
      sliding.current = true;
    },
    onPointerUp: () => {
      sliding.current = false;
      setSettled((n) => n + 1);
    },
    onPointerCancel: () => {
      sliding.current = false;
      setSettled((n) => n + 1);
    },
  };
  useEffect(() => {
    const h = history.current;
    if (h.last === drawing) return;
    if (h.restoring) {
      // This change is an undo or redo itself: it is where we are now, not a new step.
      h.restoring = false;
      h.last = drawing;
      return;
    }
    // Mid-drag, every movement changes the drawing: wait for the drag to end, and remember where it began.
    if (press.current || sliding.current) return;
    h.past.push(h.last);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    h.last = drawing;
  }, [drawing, settled]);

  const restore = (to: typeof drawing) => {
    history.current.restoring = true;
    setFaces(to.faces);
    setLoose(to.loose);
    setStrings(to.strings);
    setLabels(to.labels);
    setPanel(to.panel);
    setFitted(to.fitted);
    setRules(to.rules);
    setBattery(to.battery);
    setCharger(to.charger);
    setRuling(null);
    setPicks([]);
    setGhosts([]);
    setSaved("changed");
  };
  const undo = () => {
    const h = history.current;
    const back = h.past.pop();
    if (!back) return;
    h.future.push(h.last);
    restore(back);
  };
  const redo = () => {
    const h = history.current;
    const forward = h.future.pop();
    if (!forward) return;
    h.past.push(h.last);
    restore(forward);
  };

  const scale = metresPerPixel(spot.lat);
  // Line weights and sizes are in picture pixels, so they are thinned as the view is drawn in closer.
  const u = view.w / ROOF_IMAGE.width;
  // The kit on the roof (inverter, battery, switchboard, EV charger) is drawn smaller, in proportion to the house.
  const ku = u * KIT_SIZE;
  const px = (p: Point) => [ROOF_IMAGE.width / 2 + p.x / scale, ROOF_IMAGE.height / 2 + p.y / scale] as const;
  const path = (points: readonly Point[]) => points.map((p) => px(p).join(",")).join(" ");
  // What the Drawn view draws as the roof: the faces traced here (exact), else Google's faces for the home. With
  // neither there is nothing to draw, and the photo stays.
  const artFaces = useMemo<ArtFace[]>(() => {
    if (!illustrated) return [];
    const at = (p: Point) => [ROOF_IMAGE.width / 2 + p.x / scale, ROOF_IMAGE.height / 2 + p.y / scale] as const;
    if (faces.length) return faces.map((f) => ({ id: f.id, points: f.points.map(at), azimuth: faceFacing(f), pitch: f.tilt ?? TILT.roof }));
    return Array.isArray(modelFaces)
      ? modelFaces.map((f, i) => ({ id: `model${i}`, points: f.points.map(at), azimuth: f.azimuth, pitch: f.pitch }))
      : [];
  }, [illustrated, faces, modelFaces, scale]);
  const art = illustrated && artFaces.length > 0;
  const wallKit = useMemo(
    () => ({
      inverters: fitted.map((f) => ({ name: f.name, kw: f.kw })),
      battery: battery ? { name: battery.name, kwh: battery.kwh, qty: battery.qty, backup: battery.backup === true } : null,
      charger: charger ? { name: charger.name, kw: charger.kw } : null,
      switchboard: msb !== null,
    }),
    [fitted, battery, charger, msb],
  );
  const design = useMemo(() => ({ faces, loose, panel }), [faces, loose, panel]);
  // The panel this design is drawn with: its size on the roof and its output.
  const size = useMemo(() => panelOf({ panel }), [panel]);
  const chosen = panel?.sku ?? props.catalogue[0]?.sku ?? "";
  const chosenPanel = props.catalogue.find((p) => p.sku === chosen);

  /** The design being worked on, as it would be saved. */
  const working = (): RoofDesign => ({
    ...spot,
    faces,
    loose,
    strings,
    labels,
    ...(panel ? { panel } : {}),
    ...(fitted.length ? { inverters: fitted } : {}),
    ...(rules.length ? { guides: rules } : {}),
    ...(msb ? { switchboard: msb } : {}),
    ...(battery ? { battery } : {}),
    ...(charger ? { charger } : {}),
    ...(designLabel.trim() ? { label: designLabel.trim().slice(0, 40) } : {}),
    // What the open design is for, kept as it is worked on: its goal, and whether it is offered or recommended.
    ...(designs[active]?.goal ? { goal: designs[active].goal } : {}),
    ...(designs[active]?.offer ? { offer: true as const } : {}),
    ...(designs[active]?.recommended ? { recommended: true as const } : {}),
  });
  /**
   * Offered to the customer beside the primary, or not; and the one recommended among those offered (one at most).
   * As Primero's (1 Nov 2026): the next proposal published carries them as options, up to five with the primary.
   */
  const flagDesign = (index: number, flag: "offer" | "recommended") => {
    const list = everyDesign();
    const on = !list[index][flag];
    const offered = list.filter((d, i) => d.offer && i !== primary).length;
    if (flag === "offer" && on && offered >= MAX_PROPOSAL_OPTIONS - 1) return;
    setDesigns(
      list.map((d, i) => {
        const next = { ...d };
        if (i === index) {
          if (on) next[flag] = true;
          else delete next[flag];
        } else if (flag === "recommended" && on) delete next.recommended; // one recommended at most
        return next;
      }),
    );
    setSaved("changed");
  };
  /** Every design, with the one being worked on as it stands now. */
  const everyDesign = () => designs.map((d, i) => (i === active ? working() : d));
  /** Puts a list of designs in place and opens one of them. Undo starts afresh: it doesn't reach across designs. */
  const show = (list: RoofDesign[], index: number) => {
    const next = list[index];
    history.current.past = [];
    history.current.future = [];
    history.current.restoring = true;
    setDesigns(list);
    setActive(index);
    // Fresh lists, so the drawing is seen to have changed even when the design opened is a copy of the last.
    setFaces([...next.faces]);
    setLoose([...(next.loose ?? [])]);
    setStrings(next.strings ?? []);
    setLabels(next.labels ?? []);
    setPanel(next.panel);
    setFitted(next.inverters ?? []);
    setRules(next.guides ?? []);
    setMsb(next.switchboard ?? null);
    setBattery(next.battery);
    setCharger(next.charger);
    setRuling(null);
    setHover(null);
    setDesignLabel(next.label ?? "");
    setSelected(next.faces[0]?.id ?? null);
    setWiring(next.strings?.[0]?.id ?? null);
    setPicks([]);
    setTracing([]);
    setGhosts([]);
    setDoomed(null);
    openMenu(false);
  };
  const setBill = (next: typeof bill) => {
    billTouched.current = true;
    setBillFields(next);
    setSaved("changed");
  };
  // The quote's postcode is the roof's own: the one in the address searched for. One typed before that rule stays only where the address has none.
  const stored = quotes[active] ?? defaultQuote(props.postcode);
  const quoteNow = props.postcode ? { ...stored, form: { ...stored.form, postcode: props.postcode } } : stored;
  const everyQuote = () => designs.map((_, i) => quotes[i] ?? defaultQuote(props.postcode));
  // The home's roofs and their pitches (3 Nov 2026: a house and a garage at different angles): roof 1 is the home's own
  // (flat when the roof is set flat), the rest from `pitches`. New panels and traced faces start at the one in use.
  const roofPitches = [quoteNow.form.roof === "flat" ? 0 : (quoteNow.form.pitch ?? TILT.roof), ...(quoteNow.form.pitches ?? [])];
  const [activeRoof, setActiveRoof] = useState(0);
  const roofInUse = Math.min(activeRoof, roofPitches.length - 1);
  const homePitch = roofPitches[roofInUse];
  // With more than one roof, panels and faces are edged in their roof's colour.
  const severalRoofs = roofPitches.length > 1;
  const roofTag = roofInUse ? { roof: roofInUse } : {};
  const roofEdge = (item: { roof?: number }) => ROOF_COLOURS[roofOf(item) % ROOF_COLOURS.length];
  const [pitchOpen, setPitchOpen] = useState(false);
  // The pitch read from Nearmap's heights (`readRoofPitch`): what it said, for the roof it was read on.
  const spotKey = `${spot.lat},${spot.lng}`;
  const [pitchNote, setPitchNote] = useState<{ words: string; at: string } | null>(null);
  const [pitchGuess, setPitchGuess] = useState<{ read: PitchReading; words: string; at: string } | null>(null);
  const [pitchReading, setPitchReading] = useState(false);
  const setQuote = (next: QuoteFields) => {
    setQuotes(
      sharedHome(
        designs.map((_, i) => (i === active ? next : (quotes[i] ?? defaultQuote(props.postcode)))),
        active,
      ),
    );
    setSaved("changed");
  };
  const addDesign = (copy: boolean) => {
    const list = everyDesign();
    if (list.length >= MAX_DESIGNS) return;
    const made: RoofDesign = copy
      ? { ...working(), label: undefined }
      : // A new design is clean (10 Nov 2026, Martin: the inverter carried over): no panels, no panel or inverter chosen,
        // no battery, strings or marks. Only the home itself (its roof, storeys and phase) is shared, as for every design.
        { ...spot, faces: [], loose: [] };
    // A copy takes its quote's settings and hand changes with it; a new design starts with the same home and no changes.
    setQuotes([...everyQuote(), copy ? quoteNow : { form: quoteNow.form, edits: {} }]);
    show([...list, made], list.length);
    setSaved("changed");
  };
  const removeDesign = (index: number) => {
    const list = everyDesign().filter((_, i) => i !== index);
    if (list.length) setQuotes(everyQuote().filter((_, i) => i !== index));
    if (!list.length) return;
    // Deleting the primary leaves the first design as the primary.
    setPrimary(index === primary ? 0 : index < primary ? primary - 1 : primary);
    if (index === active) show(list, Math.min(index, list.length - 1));
    else {
      setDesigns(list);
      setActive(index < active ? active - 1 : active);
      setDoomed(null);
    }
    setSaved("changed");
  };
  // The inverters, and each string checked against the input it is on.
  const fittedItems = fitted.map((spec) => props.inverters.find((i) => i.sku === spec.sku));
  const fittedKw = Math.round(fitted.reduce((n, i) => n + i.kw, 0) * 100) / 100;
  const inputsOf = (n: number) => fittedItems[n]?.electrical?.mppts.length ?? 4;
  const onInput = (n: number, index: number) => strings.filter((x) => (x.inverter ?? 0) === n && (x.mppt ?? 0) === index).length;
  const checks = strings.map((x) =>
    checkString({
      panels: x.panels.length,
      panel: chosenPanel?.electrical,
      inverter: fittedItems[x.inverter ?? 0]?.electrical,
      inverterChosen: Boolean(fitted[x.inverter ?? 0]),
      panelName: panel?.name ?? chosenPanel?.name,
      mppt: x.mppt ?? 0,
      sharing: onInput(x.inverter ?? 0, x.mppt ?? 0),
      mixed: stringIsMixed(design, x),
    }),
  );
  /** Where a new string goes: the first input, on the first inverter, with a connector to spare. */
  const freeInput = (): { inverter?: number; mppt: number } => {
    for (let n = 0; n < fittedItems.length; n++) {
      const free = fittedItems[n]?.electrical?.mppts.findIndex((m, index) => onInput(n, index) < m.strings) ?? -1;
      if (free >= 0) return { ...(n > 0 ? { inverter: n } : {}), mppt: free };
    }
    return { mppt: 0 };
  };
  /** The inverters that would suit the panels on the design, worked out by rule (`inverter-suggest.ts`). */

  /** Puts a suggestion on the design in place of whatever inverters were there. Strings on an inverter that is gone go back to the first. */
  const takeSuggestion = (to: InverterSuggestion) => {
    setFitted(
      Array.from({ length: to.count }, (_, n) => ({
        sku: to.inverter.sku,
        name: to.inverter.name,
        kw: to.inverter.kw,
        // Where the one it replaces stood, or a place of its own in view.
        x: fitted[n]?.x ?? cm((view.x + view.w * (0.8 - n * 0.06) - ROOF_IMAGE.width / 2) * scale),
        y: fitted[n]?.y ?? cm((view.y + view.h * 0.36 - ROOF_IMAGE.height / 2) * scale),
      })),
    );
    setStrings(strings.map((x) => ((x.inverter ?? 0) < to.count ? x : { id: x.id, panels: x.panels, mppt: 0 })));
    setSuggesting(false);
    openMenu(false);
    setSaved("changed");
  };
  /** The battery: another product from the catalogue (keeping how many, and where it stands), or more or fewer of it. */
  const chooseBattery = (to: CatalogueBattery) => {
    setBattery({
      sku: to.sku,
      name: to.name,
      kwh: to.kwh,
      qty: battery?.qty ?? 1,
      ...(battery?.backup ? { backup: true } : {}),
      // A new battery stands low on the right of what is in view, clear of the roof as a rule, to be dragged to its wall.
      x: battery?.x ?? cm((view.x + view.w * 0.8 - ROOF_IMAGE.width / 2) * scale),
      y: battery?.y ?? cm((view.y + view.h * 0.62 - ROOF_IMAGE.height / 2) * scale),
    });
    openMenu(false);
    setSeek("");
    setSaved("changed");
  };
  const batteryKwh = battery ? Math.round(battery.kwh * battery.qty * 10) / 10 : 0;
  // The battery is drawn as tall as its modules stack; an inverter is one box.
  const batteryLayers = battery ? Math.min(battery.qty, 8) : 0;
  /** The inverter or the battery standing at a point on the drawing, if one is. */
  const kitAt = (p: Point): "battery" | number | null => {
    const n = fitted.findIndex((spec, i) => {
      const at = inverterSpot(spec, i, spot.lat);
      return Math.abs(p.x - at.x) < 13 * ku * scale && Math.abs(p.y - at.y) < 17 * ku * scale;
    });
    if (n >= 0) return n;
    if (battery && Math.abs(p.x - battery.x) < 16 * ku * scale && Math.abs(p.y - battery.y) < ((batteryLayers * 8) / 2 + 12) * ku * scale)
      return "battery";
    return null;
  };
  /** Whether the main switchboard's mark is at a point on the drawing. */
  const msbAt = (p: Point) => msb !== null && Math.abs(p.x - msb.x) < 13 * ku * scale && Math.abs(p.y - msb.y) < 16 * ku * scale;
  /** Whether the EV charger's mark is at a point on the drawing. */
  const chargerAt = (p: Point) =>
    charger !== undefined && Math.abs(p.x - charger.x) < 11 * ku * scale && Math.abs(p.y - charger.y) < 14 * ku * scale;
  /** An EV charger from the lists: put on the drawing low on the right of what is in view (to be dragged to its wall), or swapped for another in place. */
  const chooseCharger = (to: CatalogueCharger) => {
    setCharger({
      sku: to.sku,
      name: to.name,
      kw: to.kw,
      x: charger?.x ?? cm((view.x + view.w * 0.8 - ROOF_IMAGE.width / 2) * scale),
      y: charger?.y ?? cm((view.y + view.h * 0.62 - ROOF_IMAGE.height / 2) * scale),
    });
    openMenu(false);
    changed();
  };
  /** The main switchboard: put on the drawing (low on the left of what is in view, to be dragged to its wall), or taken off. */
  const toggleMsb = () => {
    setMsb(
      msb
        ? null
        : {
            x: cm((view.x + view.w * 0.2 - ROOF_IMAGE.width / 2) * scale),
            y: cm((view.y + view.h * 0.62 - ROOF_IMAGE.height / 2) * scale),
          },
    );
    changed();
  };
  const addInverter = (to: CatalogueInverter) => {
    if (fitted.length >= MAX_INVERTERS) return;
    setFitted([
      ...fitted,
      {
        sku: to.sku,
        name: to.name,
        kw: to.kw,
        // It stands on the drawing at once, to the right of what is in view, to be dragged to its wall.
        x: cm((view.x + view.w * (0.8 - fitted.length * 0.06) - ROOF_IMAGE.width / 2) * scale),
        y: cm((view.y + view.h * 0.36 - ROOF_IMAGE.height / 2) * scale),
      },
    ]);
    openMenu(false);
    setSeek("");
    setSaved("changed");
  };
  /** Takes an inverter off the design. Its strings go to the first input of the first inverter, to be placed again. */
  const removeInverter = (n: number) => {
    setFitted(fitted.filter((_, i) => i !== n));
    setStrings(
      strings.map((x) => {
        const on = x.inverter ?? 0;
        if (on === n) return { id: x.id, panels: x.panels, mppt: 0 };
        return on > n ? { ...x, inverter: on - 1 > 0 ? on - 1 : undefined } : x;
      }),
    );
    setSaved("changed");
  };

  /** Takes the picked kit off the design: an inverter (its strings wait to be placed again), the battery, the MSB or the charger. */
  const removeKit = (which: NonNullable<typeof kitPick>) => {
    setKitPick(null);
    setKit(null);
    if (typeof which === "number") return removeInverter(which);
    if (which === "battery") setBattery(undefined);
    else if (which === "msb") setMsb(null);
    else setCharger(undefined);
    changed();
  };

  /** Another panel from the catalogue. One of another size lays every face's rows out afresh. */
  const choosePanel = (sku: string) => {
    const to = props.catalogue.find((p) => p.sku === sku);
    if (!to) return;
    const resized = to.long !== size.long || to.short !== size.short;
    setPanel({ sku: to.sku, name: to.name, watts: to.watts, long: to.long, short: to.short });
    if (resized) {
      setFaces(faces.map((f) => ({ ...f, off: [] })));
      setStrings(strings.map((x) => ({ ...x, panels: x.panels.filter((k) => !k.startsWith("g:")) })).filter((x) => x.panels.length));
      setPicks([]);
    }
    setSaved("changed");
  };
  const summary = useMemo(() => designSummary(design, props.yieldPerKwDay), [design, props.yieldPerKwDay]);
  const year = useMemo(() => monthlyProduction(design, props.yieldPerKwDay), [design, props.yieldPerKwDay]);
  const centres = useMemo(() => Object.fromEntries(designPanels(design).map((p) => [p.key, middle(p.corners)])), [design]);
  const face = faces.find((f) => f.id === selected) ?? null;
  const isPicked = (pick: Pick) => picks.some((p) => same(p, pick));
  const panelPicks = picks.filter((p) => p.kind !== "label");
  const changed = () => setSaved("changed");
  // Where the open comment's bubble is, as a share of the picture on screen, so its box can open beside it.
  const threadAt = thread ? ("at" in thread ? thread.at : comments.find((c) => c.id === thread.id)) : null;
  const threadSpot = threadAt
    ? {
        left: ((ROOF_IMAGE.width / 2 + threadAt.x / scale - view.x) / view.w) * 100,
        top: ((ROOF_IMAGE.height / 2 + threadAt.y / scale - view.y) / view.h) * 100,
      }
    : null;

  const update = (id: string, patch: Partial<Face>) => {
    setFaces(faces.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    changed();
  };

  /** Where on the roof the pointer is, in metres. */
  const pointAt = (e: { clientX: number; clientY: number }): Point | null => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    const x = view.x + ((e.clientX - box.left) / box.width) * view.w;
    const y = view.y + ((e.clientY - box.top) / box.height) * view.h;
    return { x: cm((x - ROOF_IMAGE.width / 2) * scale), y: cm((y - ROOF_IMAGE.height / 2) * scale) };
  };

  // Ctrl (or ⌘) with the mouse wheel, or a trackpad pinch (which the browser sends as a wheel with Ctrl), zooms in and
  // out about the pointer, so the spot under it stays put. The wheel alone scrolls the page (1 Nov 2026, Martin, as
  // Primero's: scrolling the page kept zooming the picture), and says how to zoom.
  const [wheelHint, setWheelHint] = useState(false);
  const wheelHintOff = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setWheelHint(true);
        if (wheelHintOff.current) clearTimeout(wheelHintOff.current);
        wheelHintOff.current = setTimeout(() => setWheelHint(false), 1400);
        return;
      }
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const fx = (e.clientX - box.left) / box.width;
      const fy = (e.clientY - box.top) / box.height;
      setView((v) => {
        const w = Math.min(ROOF_IMAGE.width, Math.max(40, v.w * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
        const h = (w * ROOF_IMAGE.height) / ROOF_IMAGE.width;
        return {
          x: within(v.x + fx * v.w - fx * w, w, ROOF_IMAGE.width),
          y: within(v.y + fy * v.h - fy * h, h, ROOF_IMAGE.height),
          w,
          h,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelHintOff.current) clearTimeout(wheelHintOff.current);
    };
  }, []);

  /** A picked panel as one placed by hand would be: where its middle is and how it is turned, whichever kind it is. */
  const standing = (pick: Pick): LoosePanel | null => {
    if (pick.kind === "loose") return loose.find((p) => p.id === pick.id) ?? null;
    if (pick.kind !== "grid") return null;
    const from = faces.find((f) => f.id === pick.face);
    const place = from && panelPlaces(from, size).find((p) => p.index === pick.index);
    return from && place && !from.off.includes(pick.index) ? freed(from, place, "x") : null;
  };

  /**
   * The panel the "place a panel" tool would put down at a point. Over a panel already there, it is the next
   * one along: beside it on the side the pointer is nearest, at the same angle, a panel's gap away. Anywhere
   * else it is a panel under the pointer, turned the way the face under it runs.
   */
  const ghostAt = (p: Point): Ghost | null => {
    const hit = hitAt(p);
    const base = hit && !hit.empty && hit.pick.kind !== "label" ? standing(hit.pick) : null;
    if (!base) {
      // In the open, next to a panel: the outline takes the place the pointer is in, beside, above, below or at a
      // corner of the nearest panel, laid the way that panel is. Further off, it is a panel under the pointer.
      // Each panel steps by its own size seen from above (`planSize`: shorter down a slope).
      const stepsOf = (panel: LoosePanel) => {
        const plan = planSize(panel, size);
        return { stepX: plan.w + size.gap, stepY: plan.h + size.gap };
      };
      let beside: { from: LoosePanel; i: number; j: number; away: number } | null = null;
      const standingNow = [
        ...loose,
        ...faces.flatMap((f) =>
          panelPlaces(f, size)
            .filter((place) => !f.off.includes(place.index))
            .map((place) => freed(f, place, "x")),
        ),
      ];
      for (const from of standingNow) {
        // Only beside panels laid the way chosen; a different way is placed freely and clicks flush when drawn.
        if (addLandscape !== null && Boolean(from.across) !== addLandscape) continue;
        const { stepX, stepY } = stepsOf(from);
        const away = Math.hypot(p.x - from.x, p.y - from.y);
        if (away > stepY * 1.6 || (beside && away >= beside.away)) continue;
        const t = (from.angle * Math.PI) / 180;
        const i = Math.round(((p.x - from.x) * Math.cos(t) + (p.y - from.y) * Math.sin(t)) / stepX);
        const j = Math.round((-(p.x - from.x) * Math.sin(t) + (p.y - from.y) * Math.cos(t)) / stepY);
        if ((i || j) && Math.abs(i) <= 1 && Math.abs(j) <= 1) beside = { from, i, j, away };
      }
      // Laid the other way from the panel near it (as Primero's): it clicks flush against it like a magnet, beside it or a
      // row on, facing the same way, with the edge they share lit (`flushSpots`).
      const turned = addLandscape !== null ? flushGhostAt(p, standingNow, addLandscape, size) : null;
      if (turned && (!beside || turned.away < beside.away)) return { ...turned.ghost, join: turned.join };
      if (beside) {
        const { stepX, stepY } = stepsOf(beside.from);
        const t = (beside.from.angle * Math.PI) / 180;
        const x = cm(beside.from.x + beside.i * stepX * Math.cos(t) - beside.j * stepY * Math.sin(t));
        const y = cm(beside.from.y + beside.i * stepX * Math.sin(t) + beside.j * stepY * Math.cos(t));
        if (!standingNow.some((other) => Math.hypot(other.x - x, other.y - y) < 0.4)) return { ...beside.from, id: "ghost", x, y };
      }
      const on = [...faces].reverse().find((f) => inside(p, f.points));
      const open: LoosePanel = on
        ? { ...freed(on, { index: 0, corners: [p, p, p, p] }, "ghost"), x: p.x, y: p.y }
        : { id: "ghost", x: p.x, y: p.y, angle: 0, tilt: homePitch, ...roofTag };
      return addLandscape === null ? open : laidAs(open, addLandscape);
    }
    const a = (base.angle * Math.PI) / 180;
    // The pointer in the panel's own frame: across its short side (lx) and along its long side (ly).
    const dx = p.x - base.x;
    const dy = p.y - base.y;
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const plan = planSize(base, size);
    const across = Math.abs(lx) / (plan.w / 2) > Math.abs(ly) / (plan.h / 2);
    const ox = across ? Math.sign(lx || 1) * (plan.w + size.gap) : 0;
    const oy = across ? 0 : Math.sign(ly || 1) * (plan.h + size.gap);
    const next = {
      ...base,
      id: "ghost",
      x: cm(base.x + ox * Math.cos(a) - oy * Math.sin(a)),
      y: cm(base.y + ox * Math.sin(a) + oy * Math.cos(a)),
      angle: base.angle,
    };
    // Nothing is offered where a panel already stands.
    const taken = designPanels(design).some(
      (panel) => Math.hypot(middle(panel.corners).x - next.x, middle(panel.corners).y - next.y) < 0.4,
    );
    return taken ? null : next;
  };

  /**
   * With Select, the panel that would go next beside a panel when the pointer comes just past one of its edges (8 Nov 2026,
   * Martin: adjusting panels, he had to go back to Add a panel for one more; the outline should show itself at an edge
   * where he is likely to want one). Only in the band half a panel deep along a side, never at a corner, never where a
   * panel already stands; the nearest panel's edge wins. A press places it (dragging pulls out a row, as Add a panel does).
   */
  const edgeGhostAt = (p: Point): Ghost | null => {
    const standingNow = [
      ...loose,
      ...faces.flatMap((f) =>
        panelPlaces(f, size)
          .filter((place) => !f.off.includes(place.index))
          .map((place) => freed(f, place, "x")),
      ),
    ];
    const taken = designPanels(design).map((panel) => middle(panel.corners));
    let best: { ghost: Ghost; out: number } | null = null;
    for (const from of standingNow) {
      const plan = planSize(from, size);
      const a = (from.angle * Math.PI) / 180;
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      if (Math.hypot(dx, dy) > plan.h * 1.2 + plan.w) continue;
      const lx = dx * Math.cos(a) + dy * Math.sin(a);
      const ly = -dx * Math.sin(a) + dy * Math.cos(a);
      const pastX = Math.abs(lx) - plan.w / 2;
      const pastY = Math.abs(ly) - plan.h / 2;
      // Past a side and still alongside it: beside it across, or a row on along.
      const across = pastX > 0 && pastX <= plan.w / 2 && pastY <= 0;
      const along = pastY > 0 && pastY <= plan.h / 2 && pastX <= 0;
      if (!across && !along) continue;
      const out = across ? pastX : pastY;
      if (best && out >= best.out) continue;
      const ox = across ? Math.sign(lx) * (plan.w + size.gap) : 0;
      const oy = along ? Math.sign(ly) * (plan.h + size.gap) : 0;
      const x = cm(from.x + ox * Math.cos(a) - oy * Math.sin(a));
      const y = cm(from.y + ox * Math.sin(a) + oy * Math.cos(a));
      if (taken.some((c) => Math.hypot(c.x - x, c.y - y) < 0.4)) continue;
      best = { ghost: { ...from, id: "ghost", x, y }, out };
    }
    return best?.ghost ?? null;
  };

  /**
   * The panels a drag would place: from the first one, out to the pointer. Dragging across adds panels to the
   * row; dragging up or down adds rows. Everything is in the first panel's own frame, so a turned panel makes a
   * turned array. Places where a panel already stands are left out.
   */
  const arrayFrom = (anchor: LoosePanel, p: Point): LoosePanel[] => {
    const a = (anchor.angle * Math.PI) / 180;
    const dx = p.x - anchor.x;
    const dy = p.y - anchor.y;
    const plan = planSize(anchor, size);
    const stepX = plan.w + size.gap;
    const stepY = plan.h + size.gap;
    // How many panels the pointer is away from the first, across and along, in that panel's frame.
    const across = Math.max(-40, Math.min(40, Math.round((dx * Math.cos(a) + dy * Math.sin(a)) / stepX)));
    const along = Math.max(-20, Math.min(20, Math.round((-dx * Math.sin(a) + dy * Math.cos(a)) / stepY)));
    const standingNow = designPanels(design).map((panel) => middle(panel.corners));
    const out: LoosePanel[] = [];
    for (let j = 0; j <= Math.abs(along); j++) {
      for (let i = 0; i <= Math.abs(across); i++) {
        const ox = i * Math.sign(across) * stepX;
        const oy = j * Math.sign(along) * stepY;
        const x = cm(anchor.x + ox * Math.cos(a) - oy * Math.sin(a));
        const y = cm(anchor.y + ox * Math.sin(a) + oy * Math.cos(a));
        if (standingNow.some((c) => Math.hypot(c.x - x, c.y - y) < 0.4)) continue;
        out.push({ ...anchor, id: `ghost${i}x${j}`, x, y });
      }
    }
    return out;
  };

  // With exactly one panel picked, the select tool shows a grip to drag it by and a handle to turn it with.
  const handles = tool === "select" || tool === "panel";
  const gripPanel = handles && panelPicks.length === 1 && picks.length === 1 ? standing(panelPicks[0]) : null;
  const grip = gripPanel
    ? {
        panel: gripPanel,
        turn: {
          x: gripPanel.x + (size.long / 2 + 10 * u * scale) * Math.sin((gripPanel.angle * Math.PI) / 180),
          y: gripPanel.y - (size.long / 2 + 10 * u * scale) * Math.cos((gripPanel.angle * Math.PI) / 180),
        },
      }
    : null;

  // Several panels picked: one large handle to spin the whole group about its middle. It sits just off the group's
  // edge on the side it points to (not out at the distance of the furthest corner, which left it a long way from a
  // wide array).
  const spinGroup = (() => {
    if (!handles || panelPicks.length < 2) return null;
    const all = panelPicks.map(standing).filter((p): p is LoosePanel => p !== null);
    if (all.length < 2) return null;
    const centre = middle(all);
    const a = (spinAt * Math.PI) / 180;
    const reach =
      Math.max(...all.map((p) => (p.x - centre.x) * Math.sin(a) - (p.y - centre.y) * Math.cos(a))) + size.long / 2 + 12 * u * scale;
    return { centre, turn: { x: centre.x + reach * Math.sin(a), y: centre.y - reach * Math.cos(a) } };
  })();
  /** The direction of a point from a centre, in degrees clockwise from straight up. */
  const bearing = (p: Point, centre: Point) => (Math.atan2(p.x - centre.x, -(p.y - centre.y)) * 180) / Math.PI;

  const zoom = (factor: number) => {
    const w = Math.min(ROOF_IMAGE.width, Math.max(40, view.w * factor));
    const h = (w * ROOF_IMAGE.height) / ROOF_IMAGE.width;
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    setView({
      x: within(cx - w / 2, w, ROOF_IMAGE.width),
      y: within(cy - h / 2, h, ROOF_IMAGE.height),
      w,
      h,
    });
  };

  const finish = (points: Point[]) => {
    setTracing([]);
    if (points.length < 3) return;
    const id = newId("f");
    const made: Face = {
      id,
      points,
      angle: 0,
      landscape: false,
      setback: 0.3,
      facing: "N",
      tilt: homePitch,
      off: [],
      plan: true,
      ...roofTag,
    };
    setFaces([...faces, { ...made, angle: angleOfLongestEdge(made) }]);
    changed();
    setSelected(id);
    setPicks([]);
    setTool("select");
    setPitchDue((due) => [...due, id]);
    void readSlope(id, points, false);
    if (props.nearmapPicture) tips.nudge("face-traced");
  };

  /**
   * Which way a face slopes and how steeply, read from the heights (Nearmap's while its picture is in use, else
   * Google's; else Google's roof model), and the face's rows
   * laid to it: along the gutter, looking down the slope, at the roof's pitch (`face-aspect.ts`). A face just
   * traced takes it only while nobody has turned its rows, picked a direction or set a pitch in the meantime;
   * asked for again (`again`), it always does.
   */
  const readSlope = async (id: string, points: Point[], again: boolean) => {
    setSlopes((s) => ({ ...s, [id]: "busy" }));
    const [heights, model] = await Promise.all([
      loadTerrain(spot.lat, spot.lng, { nearmap: props.nearmapPicture }),
      loadRoofModel(spot.lat, spot.lng),
    ]);
    if (heights && !(terrain && terrain !== "none")) setTerrain(heights);
    const read = readAspect({ points, terrain: heights, model, centre: spot });
    setSlopes((s) => ({ ...s, [id]: read ?? "none" }));
    if (!read) return;
    const sits = faceFromAspect({ points }, read.aspect);
    setFaces((list) =>
      list.map((f) => {
        if (f.id !== id) return f;
        const untouched = f.angle === angleOfLongestEdge(f) && f.facing === "N" && (f.tilt ?? TILT.roof) === TILT.roof;
        return again || untouched ? { ...f, ...sits, off: [] } : f;
      }),
    );
    changed();
  };

  /**
   * The picked panels, all as panels placed by hand: any that were in a row are taken out of it, where they
   * stand. Returns the new faces and panels, the ids of the picked ones, and the new names of any that were
   * renamed (a string must keep hold of a panel that has come out of its row).
   */
  const byHand = (chosen: Pick[]) => {
    let nextFaces = faces;
    const nextLoose = [...loose];
    const ids: string[] = [];
    const renamed: Record<string, string> = {};
    for (const pick of chosen) {
      if (pick.kind === "label") continue;
      if (pick.kind === "loose") {
        ids.push(pick.id);
        continue;
      }
      const from = nextFaces.find((f) => f.id === pick.face);
      const place = from && panelPlaces(from, size).find((p) => p.index === pick.index);
      if (!from || !place || from.off.includes(pick.index)) continue;
      const panel = freed(from, place, newId("p"));
      nextFaces = nextFaces.map((f) => (f.id === from.id ? { ...f, off: [...f.off, pick.index] } : f));
      nextLoose.push(panel);
      ids.push(panel.id);
      renamed[keyOf(pick)] = `l:${panel.id}`;
    }
    const nextStrings = Object.keys(renamed).length
      ? strings.map((s) => ({ ...s, panels: s.panels.map((k) => renamed[k] ?? k) }))
      : strings;
    return { faces: nextFaces, loose: nextLoose, strings: nextStrings, ids };
  };

  /** Every panel standing on the roof as one placed by hand (a face's own ones freed where they stand), for snapping to. */
  const standingAll = (onFaces: Face[], placed: LoosePanel[]): LoosePanel[] => [
    ...placed,
    ...onFaces.flatMap((f) =>
      panelPlaces(f, size)
        .filter((place) => !f.off.includes(place.index))
        .map((place) => freed(f, place, `g${f.id}${place.index}`)),
    ),
  ];

  /** Turns the picked panels together, about the middle of the group. */
  const turn = (degrees: number, on: Pick[] = panelPicks) => {
    if (!on.length) return;
    const next = byHand(on);
    const group = next.loose.filter((p) => next.ids.includes(p.id));
    const centre = middle(group);
    const a = (degrees * Math.PI) / 180;
    setFaces(next.faces);
    setStrings(next.strings);
    setLoose(
      next.loose.map((p) => {
        if (!next.ids.includes(p.id)) return p;
        const dx = p.x - centre.x;
        const dy = p.y - centre.y;
        return {
          ...p,
          x: cm(centre.x + dx * Math.cos(a) - dy * Math.sin(a)),
          y: cm(centre.y + dx * Math.sin(a) + dy * Math.cos(a)),
          angle: full(p.angle + degrees),
        };
      }),
    );
    setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((p) => p.kind === "label")]);
    changed();
  };

  /**
   * Turns the picked panels onto their side, or back upright when every one already is, and lays them again tidily:
   * the same rows and counts, the gutter row's edge kept, each row centred where it was (`reorient`). Strings keep
   * their panels.
   */
  const turnLandscape = (landscape: boolean, on: Pick[] = panelPicks) => {
    if (!on.length) return;
    const next = byHand(on);
    const group = next.loose.filter((p) => next.ids.includes(p.id));
    const turned = new Map(reorient(group, size, landscape).map((p) => [p.id, p]));
    setFaces(next.faces);
    setStrings(next.strings);
    setLoose(next.loose.map((p) => turned.get(p.id) ?? p));
    setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((p) => p.kind === "label")]);
    changed();
  };

  /** Changes each picked panel where it stands (its tilt). One in a row comes out of the row. */
  const amend = (change: (panel: LoosePanel) => LoosePanel, on: Pick[] = panelPicks) => {
    if (!on.length) return;
    const next = byHand(on);
    setFaces(next.faces);
    setStrings(next.strings);
    setLoose(next.loose.map((p) => (next.ids.includes(p.id) ? change(p) : p)));
    setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((p) => p.kind === "label")]);
    changed();
  };

  // Copy and paste (Ctrl+C, Ctrl+X, Ctrl+V): the picked panels as they stand, and where the pointer is on the picture.
  const copied = useRef<{ panels: LoosePanel[]; centre: Point; pointer: Point | null } | null>(null);
  const pointer = useRef<Point | null>(null);
  const copyPicked = () => {
    const panels = panelPicks.map(standing).filter((p): p is LoosePanel => p !== null);
    if (!panels.length) return false;
    copied.current = { panels, centre: middle(panels), pointer: pointer.current };
    return true;
  };
  /**
   * Puts down a copy of what was copied, picked and ready to drag or turn: under the pointer when it has moved
   * since the copy or the last paste, otherwise a panel's width down and across from the last one, so pasting
   * again and again without moving the mouse steps the copies out rather than stacking them.
   */
  const paste = () => {
    const clip = copied.current;
    if (!clip) return;
    const at = pointer.current;
    const moved = at && (!clip.pointer || Math.hypot(at.x - clip.pointer.x, at.y - clip.pointer.y) > 0.2);
    const step = size.short + size.gap;
    const to = moved && at ? at : { x: clip.centre.x + step, y: clip.centre.y + step };
    const placed = clip.panels.map((p) => ({ ...p, id: newId("p"), x: cm(p.x - clip.centre.x + to.x), y: cm(p.y - clip.centre.y + to.y) }));
    // The next paste is measured from this one.
    copied.current = { panels: placed, centre: to, pointer: at };
    setLoose([...loose, ...placed]);
    setPicks(placed.map((p): Pick => ({ kind: "loose", id: p.id })));
    setGhosts([]);
    changed();
  };

  /** Takes panels and labels off the design: a panel in a row leaves its place empty, and comes off any string. */
  const removePicks = (gone: Pick[]) => {
    const keys = new Set(gone.map(keyOf));
    setFaces(
      faces.map((f) => {
        const out = gone.filter((p) => p.kind === "grid" && p.face === f.id).map((p) => (p as { index: number }).index);
        return out.length ? { ...f, off: [...new Set([...f.off, ...out])] } : f;
      }),
    );
    setLoose(loose.filter((p) => !keys.has(`l:${p.id}`)));
    setLabels(labels.filter((l) => !keys.has(`n:${l.id}`)));
    setStrings(strings.map((s) => ({ ...s, panels: s.panels.filter((k) => !keys.has(k)) })).filter((s) => s.panels.length));
    setPicks([]);
    changed();
  };
  const removePicked = () => removePicks(picks);
  /** The eraser: whatever is under the point goes. A panel or a label first; failing that, a guide line close by. */
  /** A traced roof face taken away, with its row panels and their places on strings (8 Nov 2026, Martin: no way to untrace). */
  const removeFace = (id: string) => {
    setFaces((all) => all.filter((f) => f.id !== id));
    setStrings((all) =>
      all.map((s) => ({ ...s, panels: s.panels.filter((k) => !k.startsWith(`g:${id}:`)) })).filter((s) => s.panels.length),
    );
    setSelected(null);
    setPicks([]);
    changed();
  };
  const eraseAt = (p: Point) => {
    if (msbAt(p)) {
      setMsb(null);
      return changed();
    }
    if (chargerAt(p)) {
      setCharger(undefined);
      return changed();
    }
    const hit = hitAt(p);
    if (hit && !hit.empty) return removePicks([hit.pick]);
    const line = rules.find((g) => {
      const dx = g.b.x - g.a.x;
      const dy = g.b.y - g.a.y;
      const t = Math.max(0, Math.min(1, ((p.x - g.a.x) * dx + (p.y - g.a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - (g.a.x + t * dx), p.y - (g.a.y + t * dy)) < 4 * u * scale;
    });
    if (line) {
      setRules(rules.filter((g) => g !== line));
      return changed();
    }
    const on = [...faces].reverse().find((f) => inside(p, f.points));
    if (on && press.current?.mode === "erase" && !press.current.faceGone) {
      press.current.faceGone = true;
      removeFace(on.id);
    }
  };

  // Speed (2 Nov 2026, Martin: "it feels fast"): a key for each tool, the arrows nudge what is picked (5 cm, or 50 cm
  // with Shift), Ctrl+A picks every panel, and ? shows them all.
  const [keysOpen, setKeysOpen] = useState(false);
  const nudge = (dx: number, dy: number, on: Pick[] = panelPicks) => {
    if (!on.length) return;
    const next = byHand(on);
    setFaces(next.faces);
    setStrings(next.strings);
    setLoose(next.loose.map((p) => (next.ids.includes(p.id) ? { ...p, x: cm(p.x + dx), y: cm(p.y + dy) } : p)));
    setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((p) => p.kind === "label")]);
    changed();
  };
  /** Every panel on the design, as picks. */
  const everyPanel = (): Pick[] => [
    ...loose.map((p): Pick => ({ kind: "loose", id: p.id })),
    ...faces.flatMap((fc) =>
      panelPlaces(fc, size)
        .filter((pl) => !fc.off.includes(pl.index))
        .map((pl): Pick => ({ kind: "grid", face: fc.id, index: pl.index })),
    ),
  ];
  const pickEveryPanel = () => setPicks(everyPanel());
  // The keyboard: Delete or Backspace takes out whatever is picked, and Escape picks nothing. Not while typing in a box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "TEXTAREA" ||
          el.isContentEditable ||
          (el.tagName === "INPUT" && !["range", "checkbox", "radio", "button", "submit"].includes((el as HTMLInputElement).type)));
      // An open comment with nothing being typed into it: Delete removes it.
      if (e.key === "Delete" && thread && "id" in thread && !words && talking !== "sending") {
        e.preventDefault();
        void say({ do: "remove", id: thread.id });
        return;
      }
      if (typing) return;
      const command = e.ctrlKey || e.metaKey;
      if (command && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (command && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (command && ["c", "x"].includes(e.key.toLowerCase())) {
        // Not while words on the page are selected: that copy is the browser's.
        if (window.getSelection()?.toString() || !copyPicked()) return;
        e.preventDefault();
        if (e.key.toLowerCase() === "x") removePicked();
      } else if (command && e.key.toLowerCase() === "v") {
        if (!copied.current) return;
        e.preventDefault();
        paste();
      } else if (command && e.key.toLowerCase() === "a") {
        e.preventDefault();
        pickTool("select");
        pickEveryPanel();
      } else if (e.key.startsWith("Arrow") && panelPicks.length && !command) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      } else if (!command && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
        e.preventDefault();
        const to = TOOL_KEYS[e.key.toLowerCase()];
        if (to === "panel") {
          pickTool("panel");
          setFanOpen(true);
        } else pickTool(to);
      } else if (!command && e.key === "?") {
        e.preventDefault();
        setKeysOpen(!keysOpen);
      } else if (!command && e.key.toLowerCase() === "q" && !costsHidden) {
        showSide("quote");
      } else if (!command && e.key.toLowerCase() === "d") {
        showSide("designer");
      } else if ((e.key === "Delete" || e.key === "Backspace") && kitPick !== null && tool === "select") {
        e.preventDefault();
        removeKit(kitPick);
      } else if ((e.key === "Delete" || e.key === "Backspace") && picks.length) {
        e.preventDefault();
        removePicked();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected && faces.some((f) => f.id === selected)) {
        e.preventDefault();
        removeFace(selected);
      } else if (e.key === "Escape") {
        setKeysOpen(false);
        setKitPick(null);
        setPicks([]);
        setTracing([]);
        setThread(null);
        openMenu(false);
        setRuling(null);
        setChecking(null);
        setFanOpen(false);
        setPeek(false);
        if (tool === "string") setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** What is under a point: a label first, then a panel placed by hand, then one in a row. */
  const hitAt = (p: Point): { pick: Pick; face: string | null; empty?: boolean } | null => {
    const label = [...labels].reverse().find((l) => Math.hypot(l.x - p.x, l.y - p.y) < 9 * u * scale);
    if (label) return { pick: { kind: "label", id: label.id }, face: null };
    const hand = [...loose].reverse().find((panel) => inside(p, [...looseCorners(panel, size)]));
    if (hand) return { pick: { kind: "loose", id: hand.id }, face: null };
    for (const f of [...faces].reverse()) {
      if (!inside(p, f.points)) continue;
      const place = panelPlaces(f, size).find((panel) => inside(p, [...panel.corners]));
      if (place) return { pick: { kind: "grid", face: f.id, index: place.index }, face: f.id, empty: f.off.includes(place.index) };
    }
    return null;
  };

  /**
   * The array a panel belongs to: it and every panel that touches it, or as good as (`ARRAY_GAP`), and so on outwards.
   * With where the small round that picks them all goes (just off the array's top right corner) and the box they fill.
   */
  const arrayOf = (start: Pick): NonNullable<typeof arrayHint> | null => {
    const all = [
      ...loose.map((panel) => ({ pick: { kind: "loose", id: panel.id } as Pick, corners: looseCorners(panel, size) })),
      ...faces.flatMap((f) =>
        panelPlaces(f, size)
          .filter((place) => !f.off.includes(place.index))
          .map((place) => ({ pick: { kind: "grid", face: f.id, index: place.index } as Pick, corners: place.corners })),
      ),
    ];
    const first = all.findIndex((x) => same(x.pick, start));
    if (first < 0) return null;
    const inGroup = new Set([first]);
    const queue = [first];
    while (queue.length) {
      const i = queue.pop()!;
      for (let j = 0; j < all.length; j++)
        if (!inGroup.has(j) && panelGap(all[i].corners, all[j].corners) <= ARRAY_GAP) {
          inGroup.add(j);
          queue.push(j);
        }
    }
    if (inGroup.size < 2) return null;
    const group = [...inGroup].map((i) => all[i]);
    const xs = group.flatMap((g) => g.corners.map((c) => c.x));
    const ys = group.flatMap((g) => g.corners.map((c) => c.y));
    const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    return {
      picks: group.map((g) => g.pick),
      keys: group.map((g) => keyOf(g.pick)),
      // Just off the array's own top right panel corner (Martin: off the box round a turned array, it sat well away from it).
      at: (() => {
        const corner = group.flatMap((g) => g.corners).reduce((best, c) => (c.x - c.y > best.x - best.y ? c : best));
        return { x: corner.x + 4 * u * scale, y: corner.y - 4 * u * scale };
      })(),
      box,
    };
  };
  /** Whether a press here is on the small round that picks the whole array. */
  const onArrayHint = (p: Point) => arrayHint !== null && Math.hypot(p.x - arrayHint.at.x, p.y - arrayHint.at.y) < 8 * u * scale;

  const onPointerDown = (e: React.PointerEvent) => {
    // The right button opens the tool menu (onContextMenu); it presses nothing.
    if (e.button === 2) return;
    setToolMenu(null);
    // A press puts the string check away: it would sit over what is being dragged.
    setHover(null);
    // Working on the picture takes the keyboard with it: a slider or button used a moment ago lets go of it.
    const focused = document.activeElement as HTMLElement | null;
    if (focused && focused !== document.body && focused.tagName !== "TEXTAREA") focused.blur();
    const p = pointAt(e);
    if (!p) return;
    if (tapFill && tool === "select") return void fillFaceAt(p);
    if (tool === "pan") {
      svg.current?.setPointerCapture(e.pointerId);
      press.current = { mode: "pan", x: e.clientX, y: e.clientY, from: view };
      return;
    }
    // A speech bubble opens its thread, whichever tool is on. The bubble is drawn up and to the right of the spot
    // it is pinned to, so the click is tested against the bubble itself as well as its point.
    const bubble = [...comments]
      .reverse()
      .find(
        (c) =>
          Math.hypot(c.x - p.x, c.y - p.y) < 5 * u * scale ||
          (Math.abs(p.x - (c.x + 3.5 * u * scale)) < 11 * u * scale && Math.abs(p.y - (c.y - 12 * u * scale)) < 9 * u * scale),
      );
    if (bubble && tool !== "trace") {
      setWords("");
      setTalking("idle");
      setPicks([]);
      return setThread({ id: bubble.id });
    }
    if ((tool === "select" || tool === "panel") && arrayHint && onArrayHint(p)) {
      // The small round beside an array: every panel in it is picked, with the arrow, ready to move or turn together.
      setPicks(arrayHint.picks);
      setArrayHint(null);
      setGhosts([]);
      setOnPanel(false);
      return setTool("select");
    }
    // A press anywhere else puts down the kit picked; pressing kit picks it (its bar shows over it) as well as dragging it.
    setKitPick(null);
    if (tool === "select" && msb && msbAt(p)) {
      // The main switchboard: press it and drag it to the wall it is on.
      svg.current?.setPointerCapture(e.pointerId);
      setPicks([]);
      setKitPick("msb");
      press.current = { mode: "msb", dx: p.x - msb.x, dy: p.y - msb.y };
      return;
    }
    if (tool === "select" && charger && chargerAt(p)) {
      // The EV charger: press it and drag it to the wall it will be mounted on.
      svg.current?.setPointerCapture(e.pointerId);
      setPicks([]);
      setKitPick("charger");
      press.current = { mode: "charger", dx: p.x - charger.x, dy: p.y - charger.y };
      return;
    }
    const grabbed = tool === "select" ? kitAt(p) : null;
    if (grabbed !== null) {
      // The battery or an inverter: press it and drag it to the wall it will go on.
      svg.current?.setPointerCapture(e.pointerId);
      setPicks([]);
      setKit(null);
      setKitPick(grabbed);
      const at = grabbed === "battery" ? (battery as DesignBattery) : inverterSpot(fitted[grabbed], grabbed, spot.lat);
      press.current =
        grabbed === "battery"
          ? { mode: "battery", dx: p.x - at.x, dy: p.y - at.y }
          : { mode: "inverter", n: grabbed, dx: p.x - at.x, dy: p.y - at.y };
      return;
    }
    if (spinGroup && Math.hypot(p.x - spinGroup.turn.x, p.y - spinGroup.turn.y) < 10 * u * scale) {
      // The group's turn handle: every picked panel swings round the middle of the group as the pointer goes round it.
      // Any that were in a row come out of it first.
      svg.current?.setPointerCapture(e.pointerId);
      const next = byHand(panelPicks);
      setFaces(next.faces);
      setLoose(next.loose);
      setStrings(next.strings);
      setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((x) => x.kind === "label")]);
      setGhosts([]);
      press.current = {
        mode: "spin",
        centre: spinGroup.centre,
        from: bearing(p, spinGroup.centre),
        starts: Object.fromEntries(next.loose.filter((x) => next.ids.includes(x.id)).map((x) => [x.id, x])),
      };
      return;
    }
    if (tool === "panel" && grip && Math.hypot(p.x - grip.turn.x, p.y - grip.turn.y) < 8 * u * scale) {
      // The single panel's turn handle, while still adding panels.
      const pick = panelPicks[0];
      if (pick.kind === "loose") {
        svg.current?.setPointerCapture(e.pointerId);
        setGhosts([]);
        press.current = { mode: "turn", id: pick.id, centre: { x: grip.panel.x, y: grip.panel.y } };
        return;
      }
    }
    if (tool === "rule") {
      // A click on a guide line that is there takes it away; otherwise the first click starts one and the second ends it.
      const near = (g: GuideLine) => {
        const dx = g.b.x - g.a.x;
        const dy = g.b.y - g.a.y;
        const t = Math.max(0, Math.min(1, ((p.x - g.a.x) * dx + (p.y - g.a.y) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(p.x - (g.a.x + t * dx), p.y - (g.a.y + t * dy)) < 4 * u * scale;
      };
      const there = ruling ? undefined : rules.find(near);
      if (there) {
        setRules(rules.filter((g) => g !== there));
        return changed();
      }
      if (!ruling) return setRuling({ a: p, b: p });
      if (Math.hypot(p.x - ruling.a.x, p.y - ruling.a.y) >= 0.2) {
        setRules([...rules, { id: newId("r"), a: ruling.a, b: p }]);
        changed();
      }
      return setRuling(null);
    }
    if (tool === "trace") {
      // Clicking back on the first corner closes the face.
      const [fx, fy] = tracing[0] ? px(tracing[0]) : [0, 0];
      const [cx, cy] = px(p);
      if (tracing.length >= 3 && Math.hypot(cx - fx, cy - fy) < 8 * u) return finish(tracing);
      return setTracing([...tracing, p]);
    }
    // Adding panels, a press on a panel that is there is the arrow's: it picks the panel and drags it, as Select would.
    const onOne = tool === "panel" ? hitAt(p) : null;
    if (tool === "panel" && !(onOne && !onOne.empty && onOne.pick.kind !== "label")) {
      // The press starts where the outline was: beside the panel under the pointer, or under the pointer itself. Letting go
      // places it; dragging first pulls it out into a row, and up or down into more rows (see `arrayFrom`).
      const shown = ghostAt(p);
      if (!shown) return;
      svg.current?.setPointerCapture(e.pointerId);
      press.current = { mode: "array", anchor: shown };
      return setGhosts([shown]);
    }
    if (tool === "label") {
      const label: DesignLabel = {
        id: newId("n"),
        x: p.x,
        y: p.y,
        kind: labelKind,
        text: labelKind === "Note" ? labelText.trim().slice(0, 80) : "",
      };
      setLabels([...labels, label]);
      setPicks([{ kind: "label", id: label.id }]);
      setTool("select");
      return changed();
    }
    if (tool === "comment") {
      setWords("");
      setTalking("idle");
      return setThread({ at: p });
    }
    if (tool === "erase") {
      // A click erases what is under it; holding and dragging goes on erasing, and the whole drag is one step to undo.
      svg.current?.setPointerCapture(e.pointerId);
      press.current = { mode: "erase" };
      return eraseAt(p);
    }
    const hit = hitAt(p);
    if (tool === "string") {
      // A click off the panels is done stringing: the strings box closes and Select is back.
      if (!hit || hit.empty) return pickTool("select");
      if (hit.pick.kind === "label") return;
      const key = keyOf(hit.pick);
      const id = wiring && strings.some((s) => s.id === wiring) ? wiring : newId("s");
      const others = strings.map((s) => (s.id === id ? s : { ...s, panels: s.panels.filter((k) => k !== key) }));
      const mine: PanelString = others.find((s) => s.id === id) ?? { id, panels: [], ...freeInput() };
      // A panel not yet on this string joins it at once. One already on it comes off when the press ends as a plain
      // click; if the press turns into a drag, it is where the drag carries on from.
      const had = mine.panels.includes(key);
      const panels = had ? mine.panels : [...mine.panels, key];
      setStrings([...others.filter((s) => s.id !== id && s.panels.length), { ...mine, panels }].sort((a, b) => a.id.localeCompare(b.id)));
      setWiring(id);
      svg.current?.setPointerCapture(e.pointerId);
      press.current = { mode: "wire", id, first: key, had, dragged: false };
      return changed();
    }
    // The select tool.
    svg.current?.setPointerCapture(e.pointerId);
    if (grip && Math.hypot(p.x - grip.turn.x, p.y - grip.turn.y) < 8 * u * scale) {
      // The turn handle: the panel follows the pointer round its middle. One in a row comes out of the row first.
      const pick = panelPicks[0];
      let id = pick.kind === "loose" ? pick.id : null;
      if (pick.kind === "grid") {
        const next = byHand([pick]);
        setFaces(next.faces);
        setLoose(next.loose);
        setStrings(next.strings);
        id = next.ids[0] ?? null;
        if (id) setPicks([{ kind: "loose", id }]);
      }
      if (id) press.current = { mode: "turn", id, centre: { x: grip.panel.x, y: grip.panel.y } };
      return;
    }
    // Just past a panel's edge, the next panel's outline is showing: a press puts it down (a drag pulls out a row).
    const edge = !hit || hit.empty ? edgeGhostAt(p) : null;
    if (edge) {
      press.current = { mode: "array", anchor: edge };
      return setGhosts([edge]);
    }
    if (hit?.empty) {
      // An empty place in a row is empty roof: a click there picks the face, as a click beside the panels would.
      setSelected(hit.face);
      setPicks([]);
      return;
    }
    if (hit) {
      if (hit.face) setSelected(hit.face);
      if (e.shiftKey) return setPicks(isPicked(hit.pick) ? picks.filter((x) => !same(x, hit.pick)) : [...picks, hit.pick]);
      // Pressing something picked keeps the whole group, ready to drag; pressing anything else picks just that.
      const group = isPicked(hit.pick) ? picks : [hit.pick];
      setPicks(group);
      press.current = { mode: "move", at: p, picks: group, starts: null };
      return;
    }
    const on = [...faces].reverse().find((f) => inside(p, f.points));
    press.current = { mode: "band", at: p, face: on?.id ?? null, add: e.shiftKey, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointer.current = pointAt(e);
    const held = press.current;
    if (!held) {
      const under = pointer.current ? hitAt(pointer.current) : null;
      const key = under && !under.empty && under.pick.kind !== "label" ? keyOf(under.pick) : null;
      const over = key ? (strings.find((x) => x.panels.includes(key))?.id ?? null) : null;
      if (over !== hover) setHover(over);
      if (tool === "select" || tool === "panel") {
        // Over a panel in an array, a small round appears beside the array to pick all of it. It stays while the pointer
        // is on the array or on its way to the round, and isn't offered for an array that is already all picked.
        const at = pointer.current;
        if (key && under && !arrayHint?.keys.includes(key)) {
          const found = arrayOf(under.pick);
          setArrayHint(found && !found.picks.every(isPicked) ? found : null);
        } else if (!key && arrayHint && at) {
          const reach = 16 * u * scale;
          const [x1, y1, x2, y2] = arrayHint.box;
          if (at.x < x1 - reach || at.x > x2 + reach || at.y < y1 - reach || at.y > y2 + reach) setArrayHint(null);
        }
        if ((tool === "panel" && key !== null) !== onPanel) setOnPanel(tool === "panel" && key !== null);
      } else if (arrayHint) setArrayHint(null);
      const on = pointer.current && tool === "select" ? kitAt(pointer.current) : null;
      if (on !== kit) setKit(on);
      // A guide line being drawn reaches to the pointer.
      if (tool === "rule" && ruling && pointer.current) setRuling({ a: ruling.a, b: pointer.current });
      // Placing panels: the outline of the one a click would put down follows the pointer.
      if (tool === "panel") {
        // Over a panel that is there (or the round beside its array) the arrow has taken over: no outline.
        const p = pointAt(e);
        const next = p && !key && !onArrayHint(p) ? ghostAt(p) : null;
        setGhosts(next ? [next] : []);
      }
      // Selecting, the next panel shows itself just past a panel's edge (not over a panel, the round, the kit or a handle).
      if (tool === "select") {
        const p = pointer.current;
        const handle =
          p &&
          ((grip && Math.hypot(p.x - grip.turn.x, p.y - grip.turn.y) < 8 * u * scale) ||
            (spinGroup && Math.hypot(p.x - spinGroup.turn.x, p.y - spinGroup.turn.y) < 10 * u * scale));
        // Over empty roof, or an empty place in a traced face's rows (8 Nov 2026: inside a face it never showed).
        const next = p && (!under || under.empty) && !on && !handle && !onArrayHint(p) ? edgeGhostAt(p) : null;
        if (next || ghosts.length) setGhosts(next ? [next] : []);
      }
      return;
    }
    if (held.mode === "array") {
      const p = pointAt(e);
      if (!p) return;
      // The row being drawn clicks into place against the panels or roof edge near it (`placeShift`); Alt places it freely.
      const drawn = arrayFrom(held.anchor, p);
      const shift = e.altKey ? null : placeShift(drawn, standingAll(faces, loose), faces, rules, size);
      setGhosts(shift ? drawn.map((g) => ({ ...g, x: cm(g.x + shift.x), y: cm(g.y + shift.y) })) : drawn);
      return;
    }
    if (held.mode === "msb") {
      const p = pointAt(e);
      if (!p) return;
      setMsb({ x: cm(p.x - held.dx), y: cm(p.y - held.dy) });
      return changed();
    }
    if (held.mode === "battery") {
      const p = pointAt(e);
      if (!p) return;
      setBattery((b) => (b ? { ...b, x: cm(p.x - held.dx), y: cm(p.y - held.dy) } : b));
      return changed();
    }
    if (held.mode === "charger") {
      const p = pointAt(e);
      if (!p) return;
      setCharger((c) => (c ? { ...c, x: cm(p.x - held.dx), y: cm(p.y - held.dy) } : c));
      return changed();
    }
    if (held.mode === "erase") {
      if (pointer.current) eraseAt(pointer.current);
      return;
    }
    if (held.mode === "inverter") {
      const p = pointAt(e);
      if (!p) return;
      setFitted((list) => list.map((spec, i) => (i === held.n ? { ...spec, x: cm(p.x - held.dx), y: cm(p.y - held.dy) } : spec)));
      return changed();
    }
    if (held.mode === "wire") {
      // Each panel the pointer comes onto joins the end of the string, leaving any other string it was on: the
      // path of the drag is the path of the wiring, round corners and from row to row.
      const p = pointAt(e);
      const under = p ? hitAt(p) : null;
      if (!under || under.empty || under.pick.kind === "label") return;
      const key = keyOf(under.pick);
      if (key !== held.first) held.dragged = true;
      // Worked out from the strings as they stand when this is applied, not as they were when the page last drew: the
      // pointer can cross two panels between one drawing and the next.
      setStrings((all) => {
        const mine = all.find((x) => x.id === held.id);
        if (!mine || mine.panels.includes(key)) return all;
        return all
          .map((x) => (x.id === held.id ? { ...x, panels: [...x.panels, key] } : { ...x, panels: x.panels.filter((k) => k !== key) }))
          .filter((x) => x.panels.length);
      });
      return changed();
    }
    if (held.mode === "spin") {
      const p = pointAt(e);
      if (!p) return;
      const now = bearing(p, held.centre);
      const by = now - held.from;
      const a = (by * Math.PI) / 180;
      setLoose((all) =>
        all.map((panel) => {
          const start = held.starts[panel.id];
          if (!start) return panel;
          const dx = start.x - held.centre.x;
          const dy = start.y - held.centre.y;
          return {
            ...panel,
            x: cm(held.centre.x + dx * Math.cos(a) - dy * Math.sin(a)),
            y: cm(held.centre.y + dx * Math.sin(a) + dy * Math.cos(a)),
            angle: full(Math.round(start.angle + by)),
          };
        }),
      );
      setSpinAt(now);
      return changed();
    }
    if (held.mode === "turn") {
      const p = pointAt(e);
      if (!p) return;
      // The handle sits beyond the panel's top edge, so the panel's long side points at the pointer.
      const angle = full(Math.round((Math.atan2(p.x - held.centre.x, -(p.y - held.centre.y)) * 180) / Math.PI));
      setLoose((all) => all.map((panel) => (panel.id === held.id ? { ...panel, angle } : panel)));
      return changed();
    }
    if (held.mode === "pan") {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return;
      const dx = ((e.clientX - held.x) / box.width) * held.from.w;
      const dy = ((e.clientY - held.y) / box.height) * held.from.h;
      return setView({
        ...held.from,
        x: within(held.from.x - dx, held.from.w, ROOF_IMAGE.width),
        y: within(held.from.y - dy, held.from.h, ROOF_IMAGE.height),
      });
    }
    const p = pointAt(e);
    if (!p) return;
    // A press only becomes a drag once it has gone a little way: a click shouldn't nudge anything.
    const far = Math.hypot(p.x - held.at.x, p.y - held.at.y) >= 4 * u * scale;
    if (held.mode === "band") {
      if (!held.moved && !far) return;
      held.moved = true;
      return setBand({ a: held.at, b: p });
    }
    if (!held.starts) {
      if (!far) return;
      // The drag begins: every picked panel becomes one placed by hand, and where each thing started is remembered.
      const next = byHand(held.picks);
      const labelIds = held.picks.filter((x) => x.kind === "label").map((x) => (x as { id: string }).id);
      held.starts = Object.fromEntries([
        ...next.loose.filter((x) => next.ids.includes(x.id)).map((x) => [`l:${x.id}`, { x: x.x, y: x.y }]),
        ...labels.filter((l) => labelIds.includes(l.id)).map((l) => [`n:${l.id}`, { x: l.x, y: l.y }]),
      ]);
      setFaces(next.faces);
      setLoose(next.loose);
      setStrings(next.strings);
      setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...labelIds.map((id): Pick => ({ kind: "label", id }))]);
      // What stays put, for the moved panels to click against.
      held.others = standingAll(
        next.faces,
        next.loose.filter((x) => !next.ids.includes(x.id)),
      );
    }
    const starts = held.starts ?? {};
    let dx = p.x - held.at.x;
    let dy = p.y - held.at.y;
    // Moved panels click into place against the panels or roof edge they come near (`placeShift`); Alt moves them freely.
    const going = loose
      .filter((panel) => starts[`l:${panel.id}`])
      .map((panel) => ({ ...panel, x: starts[`l:${panel.id}`].x + dx, y: starts[`l:${panel.id}`].y + dy }));
    const shift = e.altKey || !going.length ? null : placeShift(going, held.others ?? [], faces, rules, size);
    if (shift) {
      dx += shift.x;
      dy += shift.y;
    }
    const moved = <T extends { id: string; x: number; y: number }>(prefix: string, item: T): T => {
      const start = starts[`${prefix}:${item.id}`];
      return start ? { ...item, x: cm(start.x + dx), y: cm(start.y + dy) } : item;
    };
    setLoose((all) => all.map((panel) => moved("l", panel)));
    setLabels((all) => all.map((label) => moved("n", label)));
    changed();
  };

  // The edges panels settle against when let go (as Primero's, `settleToEdges`): every traced face's sides and every
  // guide line, each at the wind clearance (or the face's own setback when larger).
  const wind = clearanceFor(MOUNT_STANDOFF);
  const roofEdges: RoofEdge[] = [
    ...faces.flatMap((face) =>
      face.points.map((a, i) => ({
        a,
        b: face.points[(i + 1) % face.points.length],
        setback: Math.max(face.setback, wind),
        face: face.points,
      })),
    ),
    ...rules.map((g) => ({ a: g.a, b: g.b, setback: wind })),
  ];
  /** Whether any of these panels sits against a panel outside them: a group joined to others stays where it joined. */
  const joinedToOthers = (group: readonly LoosePanel[]) => {
    const ids = new Set(group.map((p) => p.id));
    const others = [
      ...loose.filter((o) => !ids.has(o.id)),
      ...faces.flatMap((fc) =>
        panelPlaces(fc, size)
          .filter((pl) => !fc.off.includes(pl.index))
          .map((pl) => freed(fc, pl, "x")),
      ),
    ];
    return group.some((p) => others.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < size.long + 0.1));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const held = press.current;
    press.current = null;
    svg.current?.releasePointerCapture(e.pointerId);
    // The drag is over: whatever it changed becomes one step to undo.
    setSettled((n) => n + 1);
    if (held?.mode === "spin") return setSpinAt(0);
    if (held?.mode === "wire") {
      if (held.dragged) tips.nudge("strung-by-hand");
      // A plain click on a panel that was already on the string takes it off.
      if (held.had && !held.dragged)
        setStrings(
          strings
            .map((x) => (x.id === held.id ? { ...x, panels: x.panels.filter((k) => k !== held.first) } : x))
            .filter((x) => x.panels.length),
        );
      return;
    }
    if (held?.mode === "array") {
      // Everything outlined is placed, and picked, so the whole array can be nudged or turned straight away.
      let placed = ghosts.map((g) => ({ ...bare(g), id: newId("p") }));
      if (placed.length) {
        // Laid in the open, it settles square against the roof's edges; one joined onto other panels stays where it joined.
        const settle = !e.altKey && !joinedToOthers(placed) ? settleToEdges(placed, roofEdges, size) : null;
        if (settle) placed = applySettle(placed, settle);
        setLoose([...loose, ...placed]);
        setPicks(placed.map((g): Pick => ({ kind: "loose", id: g.id })));
        changed();
        // Add a panel stays on, to go on adding (3 Nov 2026, Martin: "I still want to be able to add panels"); the
        // array just laid stays picked, with its tilt offered, and the arrow over a panel still picks and moves it.
        if (placed.length > 1) setTiltPop(placed.map((g) => g.id));
        else tips.nudge("one-panel-added");
      }
      return setGhosts([]);
    }
    if (held?.mode === "move" && held.starts && Object.keys(held.starts).length === 1) tips.nudge("one-panel-moved");
    if (held?.mode === "move" && held.starts && !e.altKey) {
      // Panels moved by hand settle square against the nearest roof edge or guide line, unless they joined other panels.
      const starts = held.starts;
      const group = loose.filter((p) => starts[`l:${p.id}`]);
      if (group.length && joinedToOthers(group)) {
        // Joined to other panels, each faces the way the panel it joined does (as Primero's: one array, one direction).
        const ids = new Set(group.map((p) => p.id));
        const others = [
          ...loose.filter((o) => !ids.has(o.id)),
          ...faces.flatMap((fc) =>
            panelPlaces(fc, size)
              .filter((pl) => !fc.off.includes(pl.index))
              .map((pl) => freed(fc, pl, "x")),
          ),
        ];
        const turnedTo = new Map(
          group.map((p) => {
            const near = others
              .map((o) => ({ o, d: Math.hypot(o.x - p.x, o.y - p.y) }))
              .filter((n) => n.d < size.long + 0.1)
              .sort((x, y) => x.d - y.d)[0]?.o;
            const like = near ? facingLike(p, panelFacing(near)) : null;
            return [p.id, like ? { ...p, angle: like.angle, across: like.across || undefined } : p];
          }),
        );
        setLoose(loose.map((p) => turnedTo.get(p.id) ?? p));
        return;
      }
      const settle = group.length ? settleToEdges(group, roofEdges, size) : null;
      if (settle) {
        const moved = new Map(applySettle(group, settle).map((p) => [p.id, p]));
        setLoose(loose.map((p) => moved.get(p.id) ?? p));
      }
      return;
    }
    if (held?.mode !== "band") return;
    if (!held.moved || !band) {
      // A plain click off everything: the face under it is the one to work on, and nothing is picked.
      setSelected(held.face);
      if (!held.add) setPicks([]);
      return setBand(null);
    }
    // Everything whose middle is inside the box is picked.
    const [x1, x2] = [Math.min(band.a.x, band.b.x), Math.max(band.a.x, band.b.x)];
    const [y1, y2] = [Math.min(band.a.y, band.b.y), Math.max(band.a.y, band.b.y)];
    const within = (c: Point) => c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2;
    const caught: Pick[] = [
      ...faces.flatMap((f) =>
        panelPlaces(f, size)
          .filter((place) => !f.off.includes(place.index) && within(middle(place.corners)))
          .map((place): Pick => ({ kind: "grid", face: f.id, index: place.index })),
      ),
      ...loose.filter(within).map((panel): Pick => ({ kind: "loose", id: panel.id })),
      ...labels.filter(within).map((label): Pick => ({ kind: "label", id: label.id })),
    ];
    setPicks(held.add ? [...picks, ...caught.filter((c) => !isPicked(c))] : caught);
    setBand(null);
  };

  const [publishing, setPublishing] = useState(false);
  /** Publish: the design is saved, then its proposal is made from it (`onPublish`), and any problem with either is said. */
  const publish = async (note = "") => {
    setPublishing(true);
    setSent(null);
    const kept = await save();
    if (kept && props.onPublish) {
      const problem = await props.onPublish();
      if (problem) {
        setSaved({ error: problem });
        setSent({ ok: false, message: problem });
      }
      // The note goes with the proposal only once the proposal is out; it is kept in the job's conversation and on the record.
      else if (note.trim() && props.onNote) {
        const told = await props.onNote(note.trim());
        setSent(told);
        if (told.ok) {
          setNote("");
          setSending(false);
        }
      } else setSending(false);
    }
    setPublishing(false);
  };
  /** Publish design, with a note: the box beneath the button for a roof opened from a deal. */
  const [sending, setSending] = useState(false);
  const [noDealOpen, setNoDealOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<{ ok: boolean; message: string } | null>(null);
  // Ctrl+S (or Cmd+S) saves, from anywhere in the designer, even while typing in the quote (8 Nov 2026, Martin).
  const saveNow = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      void saveNow.current();
    };
    const asked = () => void saveNow.current();
    window.addEventListener("keydown", key);
    window.addEventListener("renuabl:design-save", asked);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("renuabl:design-save", asked);
    };
  }, []);
  const save = async () => {
    setSaved("saving");
    // The price after STCs goes with it only when the primary design is the one open: that is the one a job is quoted on.
    const problem = await props.onSave(
      { designs: everyDesign(), primary, comments },
      { bill, quotes: everyQuote() },
      active === primary ? net : null,
    );
    setSaved(problem ? { error: problem } : "saved");
    // Saved: the draft is gone (the store throws it away), and the next is drawn over this save.
    if (!problem) {
      setResumed(null);
      draftSent.current = "";
    }
    return !problem;
  };

  // **Drafts** (5 Nov 2026, Martin, as Primero's: interrupted half way, it should open where it was left). Once the work
  // has stood still across one tick, it is kept as a draft apart from the saved roof (`onDraft`); whatever wasn't kept
  // yet goes as the page closes. Nobody else sees a draft: Publish is what saves.
  useEffect(() => {
    saveNow.current = save;
  });
  const draftSent = useRef("");
  const draftTick = useRef("");
  const workNow = () => ({
    set: { designs: everyDesign(), primary, comments } as DesignSet,
    extras: { bill, quotes: everyQuote() } as DesignExtras,
  });
  const latestWork = useRef(workNow);
  useEffect(() => {
    latestWork.current = workNow;
  });
  const { onDraft } = props;
  useEffect(() => {
    if (saved !== "changed" || !onDraft) return;
    const tick = window.setInterval(() => {
      const work = latestWork.current();
      const now = JSON.stringify(work);
      if (now === draftSent.current) return;
      setDrafted(false);
      if (now === draftTick.current)
        void onDraft(work.set, work.extras, false).then((problem) => {
          if (problem) return;
          draftSent.current = now;
          setDrafted(true);
        });
      draftTick.current = now;
    }, DRAFT_WAIT_MS);
    return () => window.clearInterval(tick);
  }, [saved, onDraft]);
  useEffect(() => {
    if (!onDraft) return;
    const flush = () => {
      if (saved !== "changed") return;
      const work = latestWork.current();
      if (JSON.stringify(work) !== draftSent.current) void onDraft(work.set, work.extras, true);
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [saved, onDraft]);
  // Leaving with work that isn't kept anywhere asks first; work kept as a draft opens again where it was left.
  useEffect(() => {
    if (!unkept) return;
    const asking = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", asking);
    return () => window.removeEventListener("beforeunload", asking);
  }, [unkept]);

  const button =
    "inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-forest disabled:bg-surface-2 disabled:text-muted disabled:hover:border-line";
  const label = "text-[10px] font-medium uppercase tracking-[0.18em] text-muted";
  const stringOf = (key: string) => strings.findIndex((s) => s.panels.includes(key));
  /** Every panel on the design as it stands on the roof: where, its tilt and the way it faces. For the shade analysis. */
  // Every panel standing, for the shade (worked out whether or not the shade view is open, so shaded panels show as laid).
  const standingPanels = anyPanels
    ? [
        ...loose.map((panel) => ({
          key: keyOf({ kind: "loose", id: panel.id }),
          x: panel.x,
          y: panel.y,
          tilt: panel.tilt ?? TILT.roof,
          facing: panelFacing(panel),
          corners: looseCorners(panel, size),
        })),
        ...faces.flatMap((face) =>
          panelPlaces(face, size)
            .filter((place) => !face.off.includes(place.index))
            .map((place) => ({
              key: keyOf({ kind: "grid", face: face.id, index: place.index }),
              ...middle(place.corners),
              tilt: face.tilt ?? TILT.roof,
              facing: faceFacing(face),
              corners: place.corners,
            })),
        ),
      ]
    : [];
  // The shade is worked out again a moment after the panels stop changing, not on every movement of a drag.
  const shadeKey =
    terrain && terrain !== "none" && standingPanels.length
      ? standingPanels.map((p) => `${p.key}:${p.x},${p.y},${p.tilt},${p.facing}`).join("|")
      : null;
  useEffect(() => {
    if (shadeKey === null || !terrain || terrain === "none") return;
    const timer = window.setTimeout(
      () => setShade({ report: shadeReport(terrain, standingPanels, spot.lat), keys: standingPanels.map((p) => p.key) }),
      150,
    );
    return () => window.clearTimeout(timer);
    // `shadeKey` stands for the panels: it changes exactly when any of them does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadeKey, terrain]);
  const shadeNow = shadeOn && shadeKey !== null ? shade : null;
  // With the shade view closed, the shaded panels only, tinted more the more shaded (`shadeHint`), no figures.
  const shadeHints = !shadeOn && shadeKey !== null ? shade : null;
  /**
   * The design's arrays, largest first, for the list that the arrays button opens: groups of panels that touch, or as
   * good as (`ARRAY_GAP`, the same rule the quote counts arrays by), each with the way most of its panels face, their
   * tilt, how many, their kilowatts, the strings that run through it, and where its size is written on the picture.
   */
  const arrayList = (() => {
    if (!arraysOpen) return [];
    const all = [
      ...loose.map((panel) => ({
        key: keyOf({ kind: "loose", id: panel.id }),
        corners: looseCorners(panel, size),
        facing: panelFacing(panel),
        tilt: panel.tilt ?? TILT.roof,
      })),
      ...faces.flatMap((face) =>
        panelPlaces(face, size)
          .filter((place) => !face.off.includes(place.index))
          .map((place) => ({
            key: keyOf({ kind: "grid", face: face.id, index: place.index }),
            corners: place.corners,
            facing: faceFacing(face),
            tilt: face.tilt ?? TILT.roof,
          })),
      ),
    ];
    const group = all.map((_, i) => i);
    const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) if (panelGap(all[i].corners, all[j].corners) <= ARRAY_GAP) group[find(i)] = find(j);
    const sets = new Map<number, typeof all>();
    all.forEach((panel, i) => sets.set(find(i), [...(sets.get(find(i)) ?? []), panel]));
    /** The value most of them share. */
    const most = (values: number[]) => {
      const counts = new Map<number, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    return [...sets.values()]
      .map((panels) => {
        const xs = panels.flatMap((p) => p.corners.map((c) => c.x));
        const ys = panels.flatMap((p) => p.corners.map((c) => c.y));
        return {
          panels: panels.length,
          kw: Math.round(panels.length * size.watts) / 1000,
          facing: most(panels.map((p) => Math.round(p.facing))),
          tilt: most(panels.map((p) => p.tilt)),
          strings: [...new Set(panels.map((p) => stringOf(p.key)).filter((n) => n >= 0))].sort((a, b) => a - b),
          at: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) },
        };
      })
      .sort((a, b) => b.panels - a.panels);
  })();
  // The picked panels' tilt and direction, when they all share one.
  const pickedPanels = panelPicks.map(standing).filter((p): p is LoosePanel => p !== null);
  const shared = (of: (p: LoosePanel) => number) =>
    pickedPanels.length && pickedPanels.every((p) => of(p) === of(pickedPanels[0])) ? of(pickedPanels[0]) : null;
  const pickedTilt = shared((p) => p.tilt ?? TILT.roof);
  const pickedFacing = shared(panelFacing);
  // What the design does to the customer's bill, once their bill is typed in.
  // With no panels yet the bill still counts (3 Nov 2026, Martin: the red box stayed after the bill was typed in): the
  // home's use and bill show, and the saving is nothing until panels go on.
  const finance = designFinance(
    {
      interval: bill.interval,
      amount: Number(bill.amount) || 0,
      supplyPerDay: Number(bill.supplyPerDay) || 0,
      rate: Number(bill.rate) || 0,
      feedIn: Number(bill.feedIn) || 0,
    },
    year,
    // A module held back for blackouts doesn't carry the evenings.
    shiftingKwhOf({ battery }),
    props.workspace.settings.bill.selfUseShare,
  );
  const dollars = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-AU");
  // The home's day (10 Nov 2026, Martin: the second dimension of a design is time): the design played through a
  // summer, autumn or winter day, the sun crossing the roof and the home's power under it (home-day.tsx).
  const homeDay = useHomeDay({
    latitude: spot.lat,
    panels: standingPanels.map((p) => ({ kw: size.watts / 1000, tilt: p.tilt, facing: p.facing, x: p.x, y: p.y })),
    monthKwh: year,
    homeDayKwh: finance?.dailyKwh ?? null,
    batteryKwh: shiftingKwhOf({ battery }),
    terrain: terrain && terrain !== "none" ? terrain : null,
  });
  // The system as the quote reads it. Worked out in the domain (systemSpecOf), so a published proposal reads the design the same way.
  const firstListed = props.catalogue[0];
  const spec: SystemSpec = useMemo(
    () => systemSpecOf({ ...design, inverters: fitted, battery }, firstListed),
    [design, fitted, battery, firstListed],
  );
  // Panels beyond 133% of the inverters: a warning over the picture, unless a battery is on the design.
  const oversize = arrayOversize(summary.kw, fittedKw, Boolean(battery));
  // Ready to install (1 Nov 2026, Martin): every check the design must clear before site, in one light in the bar.
  const ready = (() => {
    const costing = costSystem(spec, quoteNow.form, props.workspace);
    const strung = new Set(strings.flatMap((x) => x.panels));
    const keys = Object.keys(centres);
    const clearance = clearanceFor(MOUNT_STANDOFF);
    // Panels placed by hand on a traced face, checked against its edges at the wind clearance (or its own setback).
    const tooClose = faces.length
      ? loose.filter((panel) => {
          const on = faces.find((fc) => inside({ x: panel.x, y: panel.y }, fc.points));
          if (!on) return false;
          const margin = Math.max(on.setback, clearance) - 0.01;
          return looseCorners(panel, size).some((c) => !clearOf(c, on.points, margin));
        }).length
      : null;
    return readiness({
      panels: summary.panels,
      inverters: fitted.length,
      strings: checks.map((c) => c.verdict),
      unstrung: strings.length ? keys.filter((k) => !strung.has(k)).length : 0,
      ratio: oversize ? { percent: oversize.percent, limit: oversize.limit, over: oversize.over } : null,
      tooClose,
      pitchSet: Boolean(quoteNow.form.pitchSet),
      undecided: costsHidden ? [] : undecidedLines(costing.lines, quoteNow.edits).map((l) => l.label),
      missing: costsHidden ? 0 : editedLines(costing.lines, quoteNow.edits).filter((l) => l.missing).length,
      solarVic: { on: Boolean(quoteNow.form.solarVicRebate), bar: solarVicBar(quoteNow.form, summary.panels, props.rates) },
      phase: quoteNow.form.phase,
      inverterKw: fittedKw,
    });
  })();
  const light = readinessLight(ready);
  const [readyOpen, setReadyOpen] = useState(false);
  const goTo = (where: ReadinessItem["goTo"]) => {
    setReadyOpen(false);
    if (where === "strings") pickTool("string");
    else if (where === "trace") pickTool("trace");
    else if (where === "quote") showSide("quote");
    else if (where === "kit") openMenu("inverters");
    else if (where === "pitch") setPitchOpen(true);
  };
  /**
   * Live co-design (2 Nov 2026, Martin): a private link the customer opens on their phone during the call, showing the
   * designs as they are drawn, with the live figures, to switch between and choose (domain/design/live.ts). Only what
   * the customer may see goes: never a cost, margin or product code, and no price for a member who can't see costs.
   */
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveCopied, setLiveCopied] = useState(false);
  const [liveProblem, setLiveProblem] = useState<string | null>(null);
  const liveSnapshot = (): LiveSnapshot => {
    const billNow = {
      interval: bill.interval,
      amount: Number(bill.amount) || 0,
      supplyPerDay: Number(bill.supplyPerDay) || 0,
      rate: Number(bill.rate) || 0,
      feedIn: Number(bill.feedIn) || 0,
    };
    const postcode = /^\d{4}$/.test(quoteNow.form.postcode) ? quoteNow.form.postcode : null;
    return {
      active,
      designs: everyDesign().map((d, i) => {
        const sum = designSummary(d, props.yieldPerKwDay);
        const costing = costSystem(systemSpecOf(d, firstListed), quoteNow.form, props.workspace);
        const stc = stcValue(costing, postcode, todayInMarket(), props.rates, props.workspace.settings.stcPrice);
        // The open design's price is the quote's own (with its hand changes); the others as the quote would make them.
        const youPay =
          costsHidden || costing.missing > 0 || sum.panels === 0
            ? null
            : i === active && net !== null
              ? net
              : Math.max(0, Math.round(costing.priceIncGst - stc));
        const f =
          sum.panels > 0
            ? designFinance(
                billNow,
                monthlyProduction(d, props.yieldPerKwDay),
                shiftingKwhOf(d),
                props.workspace.settings.bill.selfUseShare,
              )
            : null;
        return {
          at: i,
          name: liveName(d, i),
          kw: sum.kw,
          panels: sum.panels,
          panelName: d.panel?.name ?? firstListed?.name ?? "",
          batteryKwh: d.battery ? Math.round(d.battery.kwh * d.battery.qty * 10) / 10 : 0,
          youPay,
          billNow: f?.billNow ?? null,
          billAfter: f?.billAfter ?? null,
          saving: f?.saving ?? null,
          payback: f && youPay !== null && f.saving > 0 ? Math.round((youPay / f.saving) * 10) / 10 : null,
          outlines: designPanels(d)
            .slice(0, LIVE_LIMITS.panels)
            .map((p) => p.corners.map((c) => [...px(c)].map((v) => Math.round(v * 10) / 10) as [number, number])),
        };
      }),
    };
  };
  // Worked out only while a link is open; sent once it has stood still for a moment.
  const liveKey = live ? JSON.stringify(liveSnapshot()) : "";
  const liveToken = live?.token ?? null;
  useEffect(() => {
    if (!liveToken || !liveKey) return;
    const timer = window.setTimeout(() => void pushLiveSnapshot(liveToken, JSON.parse(liveKey) as LiveSnapshot), 500);
    return () => window.clearTimeout(timer);
  }, [liveToken, liveKey]);
  // Whether the customer is watching, and what they chose.
  useEffect(() => {
    if (!liveToken) return;
    const timer = window.setInterval(() => {
      void liveStatusOf(liveToken).then((res) => {
        if (res.ok) setLive(res.status);
        // Only a link that has really ended stops it: a moment offline or a busy server keeps it going (3 Nov 2026).
        else if (res.gone) setLive(null);
      });
    }, LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [liveToken]);
  const shareLive = async () => {
    setLiveOpen(true);
    setLiveProblem(null);
    if (live) return;
    const res = await startLiveLink({ lat: spot.lat, lng: spot.lng, jobId: props.jobId ?? null });
    if (res.ok) setLive(res.status);
    else setLiveProblem(res.message);
  };
  const copyLive = async () => {
    if (!live) return;
    try {
      await navigator.clipboard.writeText(liveLink(live.token));
      setLiveCopied(true);
      window.setTimeout(() => setLiveCopied(false), 2000);
    } catch {
      setLiveProblem("Copy the link from the box.");
    }
  };
  const stopLive = async () => {
    if (live) await endLiveLink(live.token);
    setLive(null);
    setLiveOpen(false);
  };
  const liveChoice = live?.choice ?? null;
  const liveName = (d: RoofDesign | undefined, i: number) => d?.label || (d?.goal ? SELF_DESIGN_LABELS[d.goal] : `Option ${i + 1}`);
  const liveWords = live
    ? liveStatusWords(
        {
          seenAt: live.seenAt,
          choice: liveChoice,
          // Named as the customer sees it (the snapshot's own naming), the open design as it stands.
          choiceName: liveChoice === null ? null : liveName(everyDesign()[liveChoice], liveChoice),
        },
        new Date(),
      )
    : null;
  // A string that has been started and has no panel yet.
  const startedString = tool === "string" && wiring !== null && !strings.some((x) => x.id === wiring);
  /**
   * Google's roof model, put where it belongs on the picture: lined up with today's photo (`loadModelFit`), or, when
   * Google's own photo of the roof doesn't match today's (often a roof that has changed since), not used at all.
   */
  const googleModelInPlace = async (): Promise<{ model: RoofModel; offset?: { x: number; y: number } } | { note: string }> => {
    const [info, fit] = await Promise.all([loadRoofInfo(spot.lat, spot.lng), loadModelFit(spot.lat, spot.lng)]);
    if (!info.model) return { note: "There's no roof data for this address to work from. Trace the roof faces, then ask again." };
    if (fit.kind === "mismatch")
      return { note: mismatchNote(info.imageryDate, props.nearmapPicture ? (props.nearmapCaptured ?? null) : undefined) };
    // On Nearmap's picture, taken straight down like the photo Google measured its model on, no shift is needed: the
    // shift is for Google's satellite picture, which leans. VERIFY on a real Nearmap roof.
    if (props.nearmapPicture) return { model: info.model };
    return { model: info.model, ...(fit.kind === "aligned" ? { offset: modelOffset(fit.shift, spot.lat) } : {}) };
  };
  /**
   * Nearmap's roof outline in the capture on the picture, put down as a traced face (5 Nov 2026, Martin): for a roof
   * Google's data is older than. Its pitch is the roof's set one; its slope isn't read from Google's heights, which are
   * of the old roof. Answers the face, or why there is none.
   */
  const nearmapFace = async (): Promise<{ face: Face; captured: string | null } | { note: string }> => {
    const got = await loadNearmapOutline(spot.lat, spot.lng);
    if (!got.ok) return { note: got.message };
    if (!got.points) return { note: "Nearmap drew no roof at this address in that capture. Trace the roof faces, then ask again." };
    const made: Face = {
      id: newId("f"),
      points: got.points,
      angle: 0,
      landscape: false,
      setback: 0.3,
      facing: "N",
      tilt: homePitch,
      off: [],
      plan: true,
    };
    return { face: { ...made, angle: angleOfLongestEdge(made) }, captured: got.captured };
  };
  // A face saved from Nearmap's outline while faces kept only 16 corners closed straight across the roof (8 Nov 2026,
  // 2 Hanwell Court): mended from the outline kept with the capture (no new Nearmap call), on each design as it opens.
  const keptOutline = useRef<Promise<Point[] | null> | null>(null);
  useEffect(() => {
    if (!props.nearmapPicture || !faces.some((f) => f.points.length === OLD_FACE_CORNERS)) return;
    keptOutline.current ??= loadNearmapOutline(spot.lat, spot.lng).then((got) => (got.ok ? got.points : null));
    let gone = false;
    void keptOutline.current.then((outline) => {
      if (gone || !outline) return;
      let mended = false;
      setFaces((list) =>
        list.map((f) => {
          const points = mendCutOutline(f.points, outline);
          if (!points) return f;
          mended = true;
          // A face laid by hand (its grid switched off) stays so in its new shape, every place off, not a few at random.
          const byHand = f.off.length > panelPlaces(f, size).length / 2;
          const reshaped = { ...f, points };
          return byHand ? { ...reshaped, off: panelPlaces(reshaped, size).map((p) => p.index) } : reshaped;
        }),
      );
      if (mended) changed();
    });
    return () => {
      gone = true;
    };
    // Looked at once each design opens; the faces themselves are read when the outline arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, props.nearmapPicture]);
  /** The outline put on the picture for a person to check: picked, the pitch asked for when it isn't set. */
  const putOutlineDown = (face: Face) => {
    setFaces((list) => [...list, face]);
    changed();
    setSelected(face.id);
    setPicks([]);
    setTool("select");
    if (homePitch !== 0) setPitchDue((due) => [...due, face.id]);
  };
  /**
   * On a Nearmap picture, the home's roof faces read from Nearmap's own heights inside its outline (`roof-faces.ts`;
   * 9 Nov 2026, Martin: not Google's roof model, which can be years older than the roof), each with its slope and
   * direction, put down as traced faces to check and change. Null when the outline or the heights can't be had, or
   * they show no faces: then the designer goes on as before.
   */
  /**
   * Whether to read the roof's faces from Nearmap's heights before laying panels: nothing traced, or only the home's
   * outline put down whole (one face of many corners, 9 Nov 2026, Martin: at 29 Shearer Drive the outline left from an
   * earlier try was packed as one roof facing north, and nothing fitted). Faces someone traced are left as they are.
   */
  const readFacesFromHeights = () =>
    !faces.length || (Boolean(props.nearmapPicture) && faces.length === 1 && faces[0].points.length >= OUTLINE_FACE_CORNERS);
  const nearmapRoofFaces = async (): Promise<{ faces: Face[]; words: string } | null> => {
    if (!props.nearmapPicture) return null;
    const [outline, heights, check] = await Promise.all([nearmapFace(), loadTerrain(spot.lat, spot.lng, { nearmap: true }), checkRoof()]);
    if ("note" in outline || !heights || heights.from !== "nearmap") return null;
    // Faces over a pergola, a clear roof or the house next door aren't the home's roof (10 Nov 2026, Martin).
    const found = roofFacesOnly(
      facesFromHeights(
        outline.face.points,
        heights,
        undefined,
        undefined,
        check?.notRoof?.map((x) => x.box),
      ),
      check?.notRoof,
    );
    if (!found.length) return null;
    const made: Face[] = found.map((f) => ({
      id: newId("f"),
      points: f.points,
      landscape: false,
      setback: 0.3,
      off: [],
      plan: true,
      ...faceFromAspect({ points: f.points }, f.aspect),
    }));
    setFaces(made);
    changed();
    setSelected(null);
    setPicks([]);
    setTool("select");
    const day = heights.captured
      ? new Date(`${heights.captured}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
      : null;
    return { faces: made, words: facesFoundNote(made.length, day) };
  };
  /**
   * The roof's pitch read from Nearmap's heights (10 Nov 2026, Martin: measured, not guessed): the home's faces found
   * in the heights inside its outline, and the pitch most of the roof is at (`roof-pitch.ts`). Nothing is put on the
   * design by this: it only answers the pitch, or why there is none.
   */
  const readRoofPitch = async (): Promise<{ read: PitchReading; words: string } | { note: string }> => {
    if (!props.nearmapPicture) return { note: "Only a Nearmap picture has the heights to read the pitch from: switch to Nearmap first." };
    const [outline, heights] = await Promise.all([nearmapFace(), loadTerrain(spot.lat, spot.lng, { nearmap: true })]);
    if ("note" in outline) return { note: outline.note };
    if (!heights || heights.from !== "nearmap") return { note: "Nearmap has no height data at this address yet. Set the pitch by hand." };
    const read = pitchOfRoof(facesFromHeights(outline.face.points, heights).map((f) => ({ pitch: f.aspect.pitch, areaM2: f.areaM2 })));
    if (!read) return { note: PITCH_NOT_READ };
    const day = heights.captured
      ? new Date(`${heights.captured}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
      : null;
    return { read, words: pitchReadWords(read, "Nearmap's heights", day) };
  };
  /** The reading put on the home: its pitch, or flat. As it is now, whenever the answer comes back. */
  const applyPitch = useRef<(read: PitchReading, only: "unset" | "always") => boolean>(() => false);
  useEffect(() => {
    applyPitch.current = (read, only) => {
      if (only === "unset" && quoteNow.form.pitchSet) return false;
      const roof = read.flat ? "flat" : quoteNow.form.roof === "flat" ? "tile" : quoteNow.form.roof;
      setQuote({ ...quoteNow, form: { ...quoteNow.form, ...(read.flat ? {} : { pitch: read.pitch }), roof, pitchSet: true } });
      return true;
    };
  });
  /** Pressed on the pitch's pad: read it now, and set it whatever stood there. */
  const readPitchNow = async () => {
    if (pitchReading) return;
    setPitchReading(true);
    const got = await readRoofPitch();
    setPitchReading(false);
    if ("note" in got) return setPitchNote({ words: got.note, at: spotKey });
    applyPitch.current(got.read, "always");
    setPitchNote({ words: got.words, at: spotKey });
  };
  // A roof opened on a Nearmap picture with no pitch set yet has it read once (never over one a person set): set when
  // most of the roof agrees, else offered on the card that asks for it.
  const pitchTried = useRef("");
  const pitchUnset = !quoteNow.form.pitchSet;
  useEffect(() => {
    if (!props.nearmapPicture || !pitchUnset || pitchTried.current === spotKey) return;
    pitchTried.current = spotKey;
    let gone = false;
    setPitchReading(true);
    void readRoofPitch().then((got) => {
      if (gone) return;
      setPitchReading(false);
      if ("note" in got) return;
      if (got.read.sure) {
        if (applyPitch.current(got.read, "unset")) setPitchNote({ words: got.words, at: spotKey });
      } else setPitchGuess({ read: got.read, words: got.words, at: spotKey });
    });
    return () => {
      gone = true;
    };
    // Asked once a roof: what it reads is the roof's, whichever design is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nearmapPicture, pitchUnset, spotKey]);
  /** The right click's "Roof outline from Nearmap": the outline down, said in the command bar's reply. */
  const outlineFromNearmap = async () => {
    setToolMenu(null);
    const got = await nearmapFace();
    setCommandOpen(true);
    if ("note" in got) return setCommandReply(got.note);
    putOutlineDown(got.face);
    setCommandReply(outlineNote(homePitch === 0, got.captured));
  };
  /**
   * "Design it for me": the roof designs itself for three outcomes, the fastest payback, the best return and the most
   * independence (`self-design.ts`), from the traced faces (else Google's roof model), the customer's bill and the
   * business's prices. They replace the roof's designs (asked first), each with its goal, the best return the primary.
   */
  /**
   * What is already on the roof in the picture in use (existing panels, vents, skylights: `roof-check.ts`), asked once
   * a roof and picture before anything is laid by rule, so nothing goes over them (9 Nov 2026, Martin: Design it for me
   * laid panels over a home's existing ones). Null when it can't be had: then it designs as before.
   */
  const [roofCheckNow, setRoofCheckNow] = useState<RoofCheck | null>(null);
  const checkRoof = async (): Promise<RoofCheck | null> => {
    const picture = props.nearmapPicture ? `nearmap ${props.nearmapCaptured ?? ""}` : "google";
    const check = await Promise.race([
      loadRoofCheck(spot.lat, spot.lng, picture),
      new Promise<null>((done) => window.setTimeout(() => done(null), 45_000)),
    ]);
    setRoofCheckNow(check);
    return check;
  };
  /**
   * The panels already on the roof are being replaced (9 Nov 2026, Martin: nothing let him disregard them): then panels
   * laid by rule may go where they are. Asked by the button beside what Sol says, or in words ("ignore the existing
   * panels"); for this visit.
   */
  const replacingRef = useRef(false);
  const [replacing, setReplacing] = useState(false);
  /** What is kept clear of: everything found, less the existing panels while they are being replaced. */
  const inUse = (check: RoofCheck | null): RoofCheck | null =>
    check && replacingRef.current ? { ...check, things: withoutExisting(check.things) } : check;
  /** What was kept clear of, said with a design laid by rule. */
  const checkNotes = (found: RoofCheck | null) => {
    const check = inUse(found);
    return check
      ? [
          ...(found && hasSolar(found.things) ? [replacingRef.current ? REPLACING_NOTE : HAS_SOLAR_NOTE] : []),
          ...[keptClearWords(check.things), notRoofWords(check.notRoof)].filter((w): w is string => !!w),
        ]
      : [];
  };
  /** The last thing laid by rule, so changing the existing panels' answer lays it again. */
  const lastLay = useRef<{ kind: "fill"; kw: number; facing?: Way; also?: Way } | { kind: "mine"; goal: DesignGoal } | null>(null);
  /**
   * Shared across two faces (10 Nov 2026, Martin: "sol placed all panels on the west, he should ask me if I want to
   * split some panels over to the east"): when one face holds the whole system and another nearly as sunny looks
   * another way, Sol offers the split (`splitOffer`, the second face's way in words); on yes, Design it for me lays
   * about half on each, for this visit.
   */
  const splitRef = useRef(false);
  // Sol's answer in the command bar (declared here: Design it for me, below, asks with it).
  const [commandReply, setCommandReply] = useState<string | null>(null);
  /** Whether Sol has asked about the panels already on the roof this visit, and his question is waiting for an answer. */
  const existingAsked = useRef(false);
  const [existingQ, setExistingQ] = useState(false);
  const askExisting = () => {
    setExistingQ(true);
    setCommandReply(EXISTING_QUESTION);
  };
  const [splitOffer, setSplitOffer] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const designForMe = async (auto = false, goal: DesignGoal = "return") => {
    setMineIntro(false);
    setMine("busy");
    if (!auto) lastLay.current = { kind: "mine", goal };
    const found = await checkRoof();
    // Panels on the roof already: Sol asks first whether they are being replaced or added to (10 Nov 2026, Martin).
    if (found && hasSolar(found.things) && !existingAsked.current) {
      setMine("idle");
      return askExisting();
    }
    const check = inUse(found);
    const avoid = check && avoidFor(check).length ? avoidFor(check) : undefined;
    let model: RoofModel | null = null;
    let modelOffsetM: { x: number; y: number } | undefined;
    let fromFaces = faces;
    const notes: string[] = [];
    const fromHeights = readFacesFromHeights() ? await nearmapRoofFaces() : null;
    if (fromHeights) {
      fromFaces = fromHeights.faces;
      notes.push(fromHeights.words);
    } else if (!faces.length) {
      const found = await googleModelInPlace();
      // Opened by itself with nothing to design from (Google's roof data missing or older than the photo): it says
      // nothing (3 Nov 2026, Martin: "we don't need the Google pop up"); pressed by a person, it says why.
      if ("note" in found && auto) return setMine("idle");
      if ("note" in found) {
        // On a Nearmap picture, the roof's outline in that capture stands in (laid on only when the roof is flat).
        const outline = props.nearmapPicture ? await nearmapFace() : null;
        if (!outline || "note" in outline)
          return setMine({ options: [], notes: [found.note, ...(outline ? [outline.note] : [])], from: null });
        putOutlineDown(outline.face);
        if (homePitch !== 0) return setMine({ options: [], notes: [outlineNote(false, outline.captured)], from: null });
        fromFaces = [outline.face];
        notes.push(outlineNote(true, outline.captured));
      } else {
        model = found.model;
        modelOffsetM = found.offset;
      }
    }
    const amount = Number(bill.amount) || 0;
    const rate = Number(bill.rate) || 0;
    const result = selfDesign({
      centre: spot,
      faces: fromFaces,
      split: splitRef.current,
      model,
      ...(modelOffsetM ? { modelOffset: modelOffsetM } : {}),
      ...(avoid ? { avoid } : {}),
      panel:
        panel ??
        (chosenPanel
          ? { sku: chosenPanel.sku, name: chosenPanel.name, watts: chosenPanel.watts, long: chosenPanel.long, short: chosenPanel.short }
          : undefined),
      panelElectrical: chosenPanel?.electrical,
      firstListed,
      inverters: props.inverters,
      batteries: props.batteries,
      bill:
        amount > 0 && rate > 0
          ? { interval: bill.interval, amount, rate, supplyPerDay: Number(bill.supplyPerDay) || 0, feedIn: Number(bill.feedIn) || 0 }
          : null,
      selfUseShare: props.workspace.settings.bill.selfUseShare,
      yieldPerKwDay: props.yieldPerKwDay,
      form: quoteNow.form,
      workspace: props.workspace,
      rates: props.rates,
      date: todayInMarket(),
      newId,
    });
    if (auto && !result.options.length) return setMine("idle");
    // Made by itself as the roof opened: said so on the card, to be checked against the photo.
    setMine(
      auto
        ? { ...result, notes: [AUTO_DESIGNED, ...notes, ...checkNotes(found), ...result.notes] }
        : { ...result, notes: [...notes, ...checkNotes(found), ...result.notes] },
    );
    setMineOpen(true);
    if (!result.options.length) return;
    const list = result.options.map((o) => o.design);
    const lead = Math.max(
      0,
      result.options.findIndex((o) => o.key === goal),
    );
    setQuotes(list.map(() => withHomeOf(quoteNow, { form: quoteNow.form, edits: {} })));
    setPrimary(lead);
    show(list, lead);
    setSaved("changed");
    // Everything on one face, and another as sunny looking another way: Sol offers to split it.
    const way = fromFaces.length ? splitPartner(fromFaces, size, list[lead].loose?.length ?? 0, avoid) : null;
    setSplitOffer(
      splitRef.current || way === null
        ? null
        : (["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(way / 45) % 8] ?? null),
    );
    madeFor.current = { bill: billKey, designs: designsKey(list) };
    setBillMoved(false);
  };
  /**
   * The three designs follow the bill (3 Nov 2026, Martin: "as I increase the bill amount, the 3x recommended system
   * types need to adjust"): what they were made for, so a new bill makes them again a moment after typing stops, while
   * nobody has changed them by hand; once someone has, Redesign for this bill is offered instead of writing over them.
   */
  const madeFor = useRef<{ bill: string; designs: string } | null>(null);
  const [billMoved, setBillMoved] = useState(false);
  /** The designs changed by hand stay as they are for this bill. */
  const keepMyDesigns = () => {
    setBillMoved(false);
    if (madeFor.current) madeFor.current = { ...madeFor.current, bill: billKey };
  };
  const billKey = JSON.stringify([bill.interval, bill.amount, bill.rate, bill.supplyPerDay, bill.feedIn, bill.usage ?? ""]);
  const designsKey = (list: RoofDesign[]) =>
    JSON.stringify(
      list.map((d) => [
        (d.loose ?? []).map((p) => [p.x, p.y, p.angle, p.tilt ?? null]),
        d.faces.length,
        (d.inverters ?? []).map((i) => i.sku),
        d.battery ? [d.battery.sku, d.battery.qty] : null,
      ]),
    );
  useEffect(() => {
    const made = madeFor.current;
    if (!made || made.bill === billKey || costsHidden) return;
    const t = window.setTimeout(() => {
      if (designsKey(everyDesign()) === made.designs) void designForMe(false);
      else setBillMoved(true);
    }, 1200);
    return () => window.clearTimeout(t);
    // Only when the bill changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billKey]);
  /**
   * Sol speaks first as a blank roof opens (9 Nov 2026, Martin: "Sol should immediately be proactive and ask what you
   * want to achieve, or tell you he's read the customer's consumption from the notes and recommends solar + battery,
   * the size and why"; it replaced the roof designing itself unasked, 1 Nov 2026). With the home's use in the bill box,
   * or found in the deal's file, he recommends a system and says why (`openingAdvice`); without it he asks what it
   * should achieve. Nothing is laid until a press. Once, only when nothing is drawn on any of the roof's designs, and
   * only for someone who sees costs (the designs are priced).
   */
  const autoDesigned = useRef(false);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const firstName = props.customerName?.trim().split(/s+/)[0];
  const adviceFrom = (fields: typeof bill, found: string[]): Opening | null => {
    const daily = dailyFromBillFields(fields);
    const size = daily ? quickSize({ kwhPerDay: daily }) : null;
    return size ? { kind: "advice", advice: openingAdvice(size), found, ...(firstName ? { customer: firstName } : {}) } : null;
  };
  useEffect(() => {
    if (autoDesigned.current || costsHidden) return;
    if (!props.set.designs.every((d) => !d.faces.length && !(d.loose ?? []).length)) return;
    const t = window.setTimeout(() => {
      autoDesigned.current = true;
      const who = firstName ? { customer: firstName } : {};
      const known = adviceFrom(bill, []);
      if (known) return setOpening(known);
      if (!props.jobId) return setOpening({ kind: "ask", ...who });
      setOpening({ kind: "looking", ...who });
      void askSol().then((got) => {
        const advice = got ? adviceFrom(got.fields, got.notes) : null;
        setOpening((now) =>
          now?.kind !== "looking"
            ? now
            : (advice ?? {
                kind: "ask",
                ...who,
                note: "I couldn't find what the home uses in the notes: add the bill for a recommendation.",
              }),
        );
      });
    }, 400);
    return () => window.clearTimeout(t);
    // Once, as the roof opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** A press on Sol's opening: the three designs made, the one asked for in front. */
  const designForGoal = (goal: DesignGoal) => {
    setOpening(null);
    void designForMe(false, goal);
  };
  const suggestions = suggesting
    ? suggestInverters({
        arrayKw: summary.kw,
        inverters: props.inverters,
        panel: chosenPanel?.electrical,
        strings: strings.map((x) => x.panels.length),
      })
    : [];
  // How much storage the home needs, by rule (`battery-suggest.ts`): from what the panels make each month and, with the bill in, the home's evenings.
  const batteryIdea =
    menu === "batteries" && summary.panels > 0
      ? suggestBatteries({
          batteries: props.batteries,
          inverters: fitted.map((f, n) => ({
            name: f.name,
            ...(fittedItems[n]?.hybrid !== undefined ? { hybrid: fittedItems[n]?.hybrid } : {}),
          })),
          monthlyKwh: year,
          dailyKwh: finance?.dailyKwh ?? null,
          selfUseShare: props.workspace.settings.bill.selfUseShare,
          eveningShare: DAY.eveningShare,
        })
      : null;
  /** Strings the panels by rule (`auto-string.ts`) in place of the strings drawn, and says what it did. */
  const stringForMe = () => {
    const done = autoStringDesign(
      design,
      fittedItems.map((i) => ({ electrical: i?.electrical, name: i?.name })),
      chosenPanel?.electrical,
      chosenPanel?.name,
    );
    // What stopped it, when a product's figures aren't on file: the panel first, then the first inverter without them.
    const lacking = !done.ok
      ? chosenPanel && !chosenPanel.electrical
        ? { kind: "panel" as const, sku: chosenPanel.sku, name: chosenPanel.name }
        : fittedItems.find((i) => i && !i.electrical)
      : undefined;
    const missing =
      lacking && "kind" in lacking ? lacking : lacking ? { kind: "inverter" as const, sku: lacking.sku, name: lacking.name } : undefined;
    setAutoNote({ ok: done.ok, note: done.note, ...(missing ? { missing } : {}) });
    if (!done.strings.length) return;
    setStrings(done.strings);
    setWiring(null);
    changed();
  };
  // Sol drives the designer (1 Nov 2026, Martin): a request typed or spoken in the command bar, read at once when it is
  // a common one (`parseCommand`), else read by Sol against the design described in words (`/api/design/command`),
  // and carried out here as one change that undoes like any other.
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  // What was just asked, shown with Sol thinking until he answers (9 Nov 2026, Martin: pressing Enter gave no sign he had it).
  const [asked, setAsked] = useState<string | null>(null);
  // Sol's question with options, when a request could mean different things; the request of the one chosen is run.
  const [choices, setChoices] = useState<{ question: string; options: Choice[] } | null>(null);
  const [otherText, setOtherText] = useState("");
  /** The design (by index) Sol has been asked to delete, waiting for the person's Yes (9 Nov 2026, Martin). */
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  // Sol's answer belongs to the design it was about (10 Nov 2026, Martin: a new design showed the last design's
  // chat). The design a reply came on is noted as it arrives (a command that opens another design, such as Design it
  // for me or a delete, sets both together, so its reply belongs to the design it opened); turning to another design
  // by hand puts away that reply, his question with options and a delete waiting for Yes. Not while he is working.
  const replyOn = useRef(active);
  useEffect(() => {
    if (commandReply || choices || confirmDelete !== null) replyOn.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a reply arrives, not when the design changes
  }, [commandReply, choices, confirmDelete]);
  useEffect(() => {
    if (commandBusy || replyOn.current === active) return;
    replyOn.current = active;
    setCommandReply(null);
    setChoices(null);
    setConfirmDelete(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the open design changes
  }, [active]);
  const commandBox = useRef<HTMLInputElement>(null);
  // "Did you know?" (10 Nov 2026, Martin: pointers for new users, a lightbulb to switch them off): each tip answers
  // what was just done, and its "Show me" does it.
  const tips = useDesignTips({
    busy: () => press.current !== null,
    onAct: (act) => {
      if (act === "pick-all") {
        pickTool("select");
        pickEveryPanel();
      } else if (act === "design-for-me") void designForMe(false);
      else stringForMe();
    },
  });
  /**
   * In the pop-up, Sol's panel put away (10 Nov 2026, Martin: it blocked the map and couldn't be closed, and pressing
   * Sol again started from scratch). Closing it only hides it: his last answer, the question and anything he offered
   * stay, and pressing Ask Sol brings the same panel back. A new answer brings it back by itself.
   */
  const [awayFrom, setAwayFrom] = useState<readonly unknown[] | null>(null);
  const solAway = awayFrom !== null && awayFrom[0] === commandReply && awayFrom[1] === commandBusy && awayFrom[2] === opening;
  const solPanel = useRef<HTMLDivElement>(null);
  const solPill = useRef<HTMLButtonElement>(null);
  const putSolAway = () => {
    setAwayFrom([commandReply, commandBusy, opening]);
    setCommandOpen(false);
    setCalcOpen(false);
  };
  /** The answer: replacing or adding to them, then what was asked laid again. */
  const answerExistingQ = (replace: boolean) => {
    existingAsked.current = true;
    setExistingQ(false);
    void answerExisting(replace);
  };
  /**
   * Tap to fill (10 Nov 2026, Martin: the whole roof read into faces kept putting panels in the wrong places, so he
   * shows where): Sol has sized the system; each tap on the roof fills the face under it (a face already read there,
   * else one grown from the tap in the heights, `faceAt`) with the panels still to place, clear of what's on the roof
   * and of the panels placed already. Done when they're all placed, or when the person says.
   */
  const [tapFill, setTapFill] = useState<{ want: number } | null>(null);
  const [tapBusy, setTapBusy] = useState(false);
  const [tapNote, setTapNote] = useState<string | null>(null);
  const startTapFill = (want: number) => {
    if (want < 1) return;
    setOpening(null);
    setLoose([]);
    setStrings([]);
    setTool("select");
    setTapNote(null);
    setTapFill({ want });
    putSolAway();
  };
  const fillFaceAt = async (p: Point) => {
    if (!tapFill || tapBusy) return;
    setTapBusy(true);
    setTapNote(null);
    try {
      const seen = await checkRoof();
      const check = inUse(seen);
      // Clear of what is on the roof, and of the panels placed already.
      const avoid = [...(check ? avoidFor(check) : []), ...loose.map((pl) => [...looseCorners(pl, size)])];
      let face = faces.find((f) => inside(p, f.points));
      if (!face) {
        const heights = await loadTerrain(spot.lat, spot.lng, { nearmap: Boolean(props.nearmapPicture) });
        const found = heights ? faceAt(heights, p, check?.notRoof?.map((x) => x.box) ?? []) : null;
        if (!found) return setTapNote("I can't read a roof face there: tap the middle of a face, or trace it.");
        face = {
          id: newId("f"),
          points: found.points,
          landscape: false,
          setback: 0.3,
          off: [],
          plan: true,
          ...roofTag,
          ...faceFromAspect({ points: found.points }, found.aspect),
        };
      }
      const left = tapFill.want - loose.length;
      if (left <= 0) return setTapFill(null);
      const packed = packFaces([face], size, left, () => newId("p"), avoid.length ? avoid : undefined);
      if (!packed.loose.length) return setTapNote("No panels fit on that face clear of what's there. Tap another.");
      const done = packed.faces[0];
      setFaces((list) => (list.some((f) => f.id === done.id) ? list.map((f) => (f.id === done.id ? done : f)) : [...list, done]));
      setLoose((list) => [...list, ...packed.loose]);
      setStrings([]);
      changed();
      const placed = loose.length + packed.loose.length;
      if (placed >= tapFill.want) {
        setTapFill(null);
        setCommandReply(`All ${placed} panels placed. Move any you want, then string them.`);
      }
    } finally {
      setTapBusy(false);
    }
  };
  // A press anywhere outside the panel (on the map, say) puts it away, as its cross does.
  useEffect(() => {
    if (!props.tight || solAway) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (solPanel.current?.contains(t) || solPill.current?.contains(t)) return;
      putSolAway();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  });
  const letterOf = (i: number) => String.fromCharCode(65 + i);
  const designInWords = () =>
    [
      `Address: ${props.address}`,
      `Panels: ${summary.panels} × ${panel?.name ?? chosenPanel?.name ?? "panel"} (${summary.kw.toFixed(2)} kW), ${faces.length} traced roof faces${faces.length ? ` facing ${faces.map((fc) => compass(faceFacing(fc))).join(", ")}` : ""}.`,
      `Inverters: ${fitted.map((x) => `${x.name} (${x.kw} kW)`).join(", ") || "none"}. Battery: ${battery ? `${battery.qty} × ${battery.name} (${batteryKwh} kWh)` : "none"}.`,
      `Home: ${quoteNow.form.roof} roof, ${quoteNow.form.storeys} storey, ${quoteNow.form.phase} phase, pitch ${homePitch}°.`,
      strings.length
        ? `Strings: ${strings.map((x, i) => `${letterOf(i)} (${x.panels.length} panels): ${checks[i]?.words ?? ""}`).join(" | ")}`
        : "No strings yet.",
      `Ready to install: ${ready.map((r) => `${r.label} ${r.state}: ${r.words}`).join(" | ")}`,
      finance
        ? `Bill: about ${finance.dailyKwh} kWh a day; bill ${finance.billNow} → ${finance.billAfter} a year; saving ${finance.saving}.`
        : "No bill entered.",
      `Panels on the lists: ${props.catalogue
        .slice(0, 30)
        .map((p) => p.name)
        .join("; ")}`,
      `Inverters on the lists: ${props.inverters
        .slice(0, 40)
        .map((x) => x.name)
        .join("; ")}`,
      `Batteries on the lists: ${props.batteries
        .slice(0, 30)
        .map((x) => x.name)
        .join("; ")}`,
    ].join("\n");
  /** The design with its prices (only for someone who sees costs), for the designer's Ask Sol (9 Nov 2026, Martin). */
  const designForSol = () => {
    const costing = costSystem(spec, quoteNow.form, props.workspace);
    const priced = (list: readonly { name: string; sku: string }[]) =>
      list.map((x) => ({ name: x.name, cost: listed(props.workspace, x.sku)?.cost ?? null }));
    return [
      designInWords(),
      pricesInWords({
        costsHidden,
        lines: costing.lines,
        priceIncGst: costing.priceIncGst,
        afterStcs: net,
        saving: finance?.saving ?? null,
        panels: priced(props.catalogue),
        inverters: priced(props.inverters),
        batteries: priced(props.batteries),
      }),
    ].join("\n");
  };
  // What Sol's side panel sees of this page (page-context.ts): the open design in words, which of the roof's designs it
  // is, the customer, and its price only for someone who may see it.
  usePageAbout(
    "Design tool",
    [
      `Design open: ${designs[active]?.label || `Design ${active + 1}`} (${active + 1} of ${designs.length}${
        designs.length > 1
          ? `; the others: ${designs
              .map((d, i) => d.label || `Design ${i + 1}`)
              .filter((_, i) => i !== active)
              .join(", ")}`
          : ""
      })${props.customerName ? ` for ${props.customerName}` : ""}.`,
      designInWords(),
      ...(net != null && !costsHidden ? [`Price after STCs (the quote's own): $${Math.round(net).toLocaleString("en-AU")} inc GST.`] : []),
    ].join("\n"),
  );
  /** Fills the roof to about so many kW: on the traced faces (those looking the way asked), else Google's roof model. */
  const fillTo = async (kw: number, facing?: Way, also?: Way): Promise<{ words: string; laid: number }> => {
    const watts = panelOf(design).watts || 475;
    const n = Math.max(1, Math.ceil((kw * 1000) / watts));
    lastLay.current = { kind: "fill", kw, ...(facing ? { facing } : {}), ...(facing && also ? { also } : {}) };
    const seen = await checkRoof();
    if (seen && hasSolar(seen.things) && !existingAsked.current) {
      askExisting();
      return { words: EXISTING_QUESTION, laid: 0 };
    }
    const check = inUse(seen);
    const avoid = check && avoidFor(check).length ? avoidFor(check) : undefined;
    const clear = [
      seen && hasSolar(seen.things) && replacingRef.current ? REPLACING_NOTE : null,
      check ? keptClearWords(check.things) : null,
      check ? notRoofWords(check.notRoof) : null,
    ]
      .filter(Boolean)
      .join(" ");
    const fromHeights = readFacesFromHeights() ? await nearmapRoofFaces() : null;
    const roofFaces = fromHeights?.faces ?? faces;
    if (roofFaces.length && facing && also && also !== facing) {
      // Two ways asked for (10 Nov 2026, Martin: "a 10 kW east west system"): about half on the faces looking each
      // way, the first way taking any the second can't hold.
      const name = (w: Way) => ({ N: "north", E: "east", S: "south", W: "west" })[w];
      const wayA = roofFaces.filter((fc) => facesWay(facing, faceFacing(fc)));
      const wayB = roofFaces.filter((fc) => facesWay(also, faceFacing(fc)));
      const missing = [...(wayA.length ? [] : [facing]), ...(wayB.length ? [] : [also])];
      if (missing.length) return { words: `No roof face looks ${missing.map(name).join(" or ")}.`, laid: 0 };
      const lay = (list: Face[], k: number) => (k > 0 ? packFaces(list, size, k, () => newId("p"), avoid).loose : []);
      let first = lay(wayA, Math.ceil(n / 2));
      const second = lay(wayB, n - first.length);
      if (first.length + second.length < n) first = lay(wayA, n - second.length);
      const used = new Set([...wayA, ...wayB].map((fc) => fc.id));
      setFaces(roofFaces.map((fc) => (used.has(fc.id) ? { ...fc, off: panelPlaces(fc, size).map((pl) => pl.index) } : fc)));
      setLoose([...first, ...second]);
      setStrings([]);
      changed();
      const laid = first.length + second.length;
      return {
        words: `${laid} panels, ${((laid * watts) / 1000).toFixed(2)} kW${laid < n ? ": only that many fit" : ""}: ${first.length} on the ${name(facing)}, ${second.length} on the ${name(also)}. Strings cleared: string them again.${fromHeights ? ` ${fromHeights.words}` : ""}${clear ? ` ${clear}` : ""}`,
        laid,
      };
    }
    if (roofFaces.length) {
      const chosen = facing ? roofFaces.filter((fc) => facesWay(facing, faceFacing(fc))) : roofFaces;
      if (!chosen.length)
        return { words: `No traced roof face looks ${{ N: "north", E: "east", S: "south", W: "west" }[facing!]}.`, laid: 0 };
      const packed = packFaces(chosen, size, n, () => newId("p"), avoid);
      const ids = new Set(chosen.map((fc) => fc.id));
      setFaces(roofFaces.map((fc) => (ids.has(fc.id) ? (packed.faces.find((x) => x.id === fc.id) ?? fc) : fc)));
      setLoose(packed.loose);
      setStrings([]);
      changed();
      return {
        words: `${packed.loose.length} panels, ${((packed.loose.length * watts) / 1000).toFixed(2)} kW${packed.loose.length < n ? `: only that many fit` : ""}. Strings cleared: string them again.${fromHeights ? ` ${fromHeights.words}` : ""}${clear ? ` ${clear}` : ""}`,
        laid: packed.loose.length,
      };
    }
    const found = await googleModelInPlace();
    if ("note" in found) {
      // On a Nearmap picture, the roof's outline in that capture stands in: laid on when the roof is flat (a flat
      // roof looks no way, so a direction asked for doesn't narrow it), else put down for its slopes to be traced.
      const outline = props.nearmapPicture ? await nearmapFace() : null;
      if (!outline || "note" in outline) return { words: [found.note, outline?.note].filter(Boolean).join(" "), laid: 0 };
      putOutlineDown(outline.face);
      if (homePitch !== 0) return { words: outlineNote(false, outline.captured), laid: 0 };
      const packed = packFaces([outline.face], size, n, () => newId("p"), avoid);
      setFaces((list) => list.map((fc) => (fc.id === outline.face.id ? (packed.faces[0] ?? fc) : fc)));
      setLoose(packed.loose);
      setStrings([]);
      return {
        words: `${outlineNote(true, outline.captured, packed.loose.length)} That's ${((packed.loose.length * watts) / 1000).toFixed(2)} kW${packed.loose.length < n ? ": only that many fit" : ""}.`,
        laid: packed.loose.length,
      };
    }
    let laid = suggestPanels(found.model, spot, n, size, () => newId("p"), found.offset, avoid);
    if (facing) laid = laid.filter((p) => facesWay(facing, panelFacing(p)));
    if (!laid.length) return { words: "Nothing fits that way round on Google's roof data: trace the roof faces and ask again.", laid: 0 };
    setLoose(laid);
    setStrings([]);
    changed();
    return {
      words: `${laid.length} panels, ${((laid.length * watts) / 1000).toFixed(2)} kW from Google's roof data${laid.length < n ? ": only that many fit" : ""}. Check it against the photo.${clear ? ` ${clear}` : ""}`,
      laid: laid.length,
    };
  };
  // A whole system asked for at once ("load 8 kW of panels, an inverter and a battery", 3 Nov 2026, Martin): the panels go
  // down first, then on the next render, with the design's kW and output known, the inverter and the battery are chosen:
  // by name when named, else by the same rules as "Suggest one" and "Recommended for this home".
  // From the calculator, the battery's size wanted (kWh, stacked to it) and whether a module is held for blackouts.
  const systemAsk = useRef<{ inverter?: string; battery?: string; batteryKwh?: number; backup?: boolean } | null>(null);
  const [systemTick, setSystemTick] = useState(0);
  // What the inverter and battery step chose, said after the panels' line (it lands after the reply is set).
  const [systemWords, setSystemWords] = useState("");
  useEffect(() => {
    const ask = systemAsk.current;
    if (!ask || !summary.panels) return;
    systemAsk.current = null;
    const words: string[] = [];
    const wantsBattery = ask.battery !== undefined;
    let inverter: { item: CatalogueInverter; count: number } | null = null;
    if (ask.inverter !== undefined) {
      if (ask.inverter) {
        const named = pickByQuery(props.inverters, ask.inverter);
        inverter = named ? { item: named, count: 1 } : null;
        if (!named) words.push(`no inverter on your lists matches “${ask.inverter}”`);
      } else {
        const ideas = suggestInverters({ arrayKw: summary.kw, inverters: props.inverters, panel: chosenPanel?.electrical, strings: [] });
        const phase = quoteNow.form.phase === "three" ? "Three" : "Single";
        const idea =
          ideas.find((s) => s.kind.startsWith(phase) && /hybrid/i.test(s.kind) === wantsBattery) ??
          ideas.find((s) => s.kind.startsWith(phase)) ??
          ideas[0];
        inverter = idea ? { item: idea.inverter, count: idea.count } : null;
        if (!idea) words.push("no inverter on your lists suits these panels");
      }
      if (inverter) {
        const { item, count } = inverter;
        setFitted(
          Array.from({ length: count }, (_, n) => ({
            sku: item.sku,
            name: item.name,
            kw: item.kw,
            x: fitted[n]?.x ?? cm((view.x + view.w * (0.8 - n * 0.06) - ROOF_IMAGE.width / 2) * scale),
            y: fitted[n]?.y ?? cm((view.y + view.h * 0.36 - ROOF_IMAGE.height / 2) * scale),
          })),
        );
        words.push(`${count > 1 ? `${count} × ` : ""}${item.name}`);
      }
    }
    if (wantsBattery) {
      let pick: { battery: CatalogueBattery; qty: number } | null = null;
      // A maker or model named narrows the choice; either way it is stacked to what the home needs.
      const pool = ask.battery ? allByQuery(props.batteries, ask.battery) : props.batteries;
      if (!pool.length) words.push(`no battery on your lists matches “${ask.battery}”`);
      else {
        const onDesign = inverter
          ? [{ name: inverter.item.name, ...(inverter.item.hybrid !== undefined ? { hybrid: inverter.item.hybrid } : {}) }]
          : fitted.map((x, n) => ({
              name: x.name,
              ...(fittedItems[n]?.hybrid !== undefined ? { hybrid: fittedItems[n]?.hybrid } : {}),
            }));
        const idea = suggestBatteries({
          batteries: pool,
          inverters: onDesign,
          monthlyKwh: year,
          dailyKwh: finance?.dailyKwh ?? null,
          selfUseShare: props.workspace.settings.bill.selfUseShare,
          eveningShare: DAY.eveningShare,
        }).suggestions[0];
        pick = idea ? { battery: idea.battery, qty: idea.qty } : null;
        // A size asked for (the calculator): the same battery, stacked to it.
        if (pick && ask.batteryKwh && pick.battery.kwh > 0)
          pick = { ...pick, qty: Math.max(1, Math.round(ask.batteryKwh / pick.battery.kwh)) };
        if (!idea) words.push("no battery on your lists suits this home");
      }
      if (pick) {
        setBattery({
          sku: pick.battery.sku,
          name: pick.battery.name,
          kwh: pick.battery.kwh,
          qty: pick.qty,
          ...(ask.backup ? { backup: true } : {}),
          x: battery?.x ?? cm((view.x + view.w * 0.8 - ROOF_IMAGE.width / 2) * scale),
          y: battery?.y ?? cm((view.y + view.h * 0.62 - ROOF_IMAGE.height / 2) * scale),
        });
        words.push(
          `${pick.qty > 1 ? `${pick.qty} × ` : ""}${pick.battery.name} (${Math.round(pick.battery.kwh * pick.qty * 10) / 10} kWh)`,
        );
        if (ask.backup) words.push("one module held for blackouts");
      }
    }
    changed();
    setSystemWords(words.length ? `${words.join(" · ")}.` : "");
    // Only when a whole system has just had its panels laid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemTick]);
  // Every box over the designer closes on a press anywhere outside it (8 Nov 2026, Martin), as well as by its cross.
  // A box and the button that opens it carry `data-popup`; the strings box also stays while stringing on the roof.
  const anyBox =
    commandOpen ||
    choices !== null ||
    confirmDelete !== null ||
    sending ||
    noDealOpen ||
    readyOpen ||
    liveOpen ||
    keysOpen ||
    mineIntro ||
    arraysOpen ||
    // Sol's opening while he isn't still looking, and his calculator.
    (opening !== null && opening.kind !== "looking") ||
    calcOpen ||
    tool === "string";
  useEffect(() => {
    if (!anyBox) return;
    const away = (e: PointerEvent) => {
      const at = e.target as Element | null;
      if (!at || at.closest("[data-popup]")) return;
      const onRoof = Boolean(svg.current?.contains(at));
      setCommandOpen(false);
      setChoices(null);
      setConfirmDelete(null);
      setSending(false);
      setNoDealOpen(false);
      setReadyOpen(false);
      setLiveOpen(false);
      setKeysOpen(false);
      setMineIntro(false);
      setArraysOpen(false);
      if (opening?.kind !== "looking") setOpening(null);
      setCalcOpen(false);
      // Stringing goes on while the roof is pressed (a press off the panels there puts it down already).
      if (tool === "string" && !onRoof) pickTool("select");
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  });
  // Rows asked for with a size: once the panels for that size are down, they are put in the rows (and turned, if asked).
  const rowsNext = useRef<{ rows: number; landscape?: boolean } | null>(null);
  useEffect(() => {
    const want = rowsNext.current;
    if (!want || !loose.length) return;
    rowsNext.current = null;
    const group = loose.map((p) => (want.landscape === undefined ? p : laidAs(p, want.landscape)));
    setLoose(inRows(group, size, want.rows));
    if (want.landscape !== undefined) setAddLandscape(want.landscape);
  }, [loose, size]);
  /** The existing panels being replaced (or kept clear of again), and what was last laid by rule laid again for it. */
  const existingPanels = async (replace: boolean): Promise<string> => {
    replacingRef.current = replace;
    setReplacing(replace);
    const said = replace
      ? "The existing panels are being replaced: new panels may go where they are."
      : "Keeping clear of the existing panels again.";
    const last = lastLay.current;
    if (!last) return `${said} Lay the panels and I'll use it.`;
    if (last.kind === "mine") {
      await designForMe(false, last.goal);
      return said;
    }
    return `${said} ${(await fillTo(last.kw, last.facing, last.also)).words}`;
  };
  /**
   * The roof's faces read again from Nearmap's heights in place of those on the design (9 Nov 2026, Martin: faces kept
   * from an older reading at 29 Shearer Drive were wrong, and only an empty roof was ever read), then what was last
   * laid by rule laid again on them.
   */
  const readRoofAgain = async (): Promise<string> => {
    if (!props.nearmapPicture) return "Only a Nearmap picture has the heights to read the roof from: switch to Nearmap, then ask again.";
    const read = await nearmapRoofFaces();
    if (!read) return "Nearmap's heights didn't show this roof's faces: trace them by hand.";
    const last = lastLay.current;
    if (last?.kind === "fill") return `${read.words} ${(await fillTo(last.kw, last.facing, last.also)).words}`;
    if (last?.kind === "mine") {
      await designForMe(false, last.goal);
      return read.words;
    }
    setLoose([]);
    setStrings([]);
    return `${read.words} Ask for a size, or Design it for me, to lay panels on them.`;
  };
  /** The button's answer, shown as Sol's (busy, then what he did). */
  const answerReadRoof = async () => {
    if (commandBusy) return;
    setCommandBusy(true);
    setAsked("Read the roof again.");
    setCommandReply(null);
    setSystemWords("");
    try {
      setCommandReply(await readRoofAgain());
    } finally {
      setCommandBusy(false);
      setAsked(null);
    }
  };
  /** The split chip's answer: the panels shared across two faces, or back on one, laid again by Design it for me. */
  const answerSplit = async (on: boolean) => {
    if (commandBusy) return;
    const word = splitOffer;
    splitRef.current = on;
    setSplitting(on);
    setCommandBusy(true);
    setAsked(on ? `Split some to the ${word ?? "other"} face.` : "Keep them on one face.");
    setCommandReply(null);
    setSystemWords("");
    try {
      const last = lastLay.current;
      await designForMe(false, last?.kind === "mine" ? last.goal : "return");
      setCommandReply(
        on ? `Shared across two faces: about half on the ${word ?? "other"} face.` : "Back on one face, the sunniest that holds them all.",
      );
    } finally {
      setCommandBusy(false);
      setAsked(null);
    }
  };
  const answerExisting = async (replace: boolean) => {
    if (commandBusy) return;
    setCommandBusy(true);
    setAsked(replace ? "The existing panels are being replaced." : "Keep clear of the existing panels.");
    setCommandReply(null);
    setSystemWords("");
    try {
      setCommandReply(await existingPanels(replace));
    } finally {
      setCommandBusy(false);
      setAsked(null);
    }
  };
  const runCommand = async (command: DesignCommand): Promise<string> => {
    switch (command.do) {
      case "readRoof":
        return readRoofAgain();
      case "replaceExisting":
        return existingPanels(true);
      case "keepExisting":
        return existingPanels(false);
      case "targetKw":
        if (!command.facing && summary.panels > 0 && Math.abs(summary.kw - command.kw) <= Math.max(0.5, command.kw * 0.05))
          return `The panels already make ${summary.kw.toFixed(2)} kW: left as they are.`;
        return (await fillTo(command.kw, command.facing, command.also)).words;
      case "system": {
        // The panels already make about that size, and no direction was asked for: they stay as they are, and only the
        // inverter and battery follow (8 Nov 2026, Martin: adding a battery re-laid his panels).
        const keep = !command.facing && summary.panels > 0 && Math.abs(summary.kw - command.kw) <= Math.max(0.5, command.kw * 0.05);
        const done = keep
          ? { words: `Panels kept as they are (${summary.kw.toFixed(2)} kW).`, laid: summary.panels }
          : await fillTo(command.kw, command.facing, command.also);
        if (!done.laid) return done.words;
        systemAsk.current = {
          ...(command.inverter !== undefined ? { inverter: command.inverter } : {}),
          ...(command.battery !== undefined ? { battery: command.battery } : {}),
        };
        setSystemTick((n) => n + 1);
        return done.words.replace(" Strings cleared: string them again.", "");
      }
      case "battery": {
        // No product named: the inverter's own maker by rule; a maker or model named: that one. Either way stacked to
        // what the home needs (`suggestBatteries`), not one module (8 Nov 2026, Martin: a Sigenergy controller on the
        // design, "add the storage it needs").
        const pool = command.query ? allByQuery(props.batteries, command.query) : props.batteries;
        if (!pool.length)
          return command.query ? `No battery on your lists matches “${command.query}”.` : "There are no batteries on your price lists.";
        const idea =
          summary.panels > 0
            ? suggestBatteries({
                batteries: pool,
                inverters: fitted.map((f, n) => ({
                  name: f.name,
                  ...(fittedItems[n]?.hybrid !== undefined ? { hybrid: fittedItems[n]?.hybrid } : {}),
                })),
                monthlyKwh: year,
                dailyKwh: finance?.dailyKwh ?? null,
                selfUseShare: props.workspace.settings.bill.selfUseShare,
                eveningShare: DAY.eveningShare,
              })
            : null;
        const pick = idea?.suggestions[0];
        if (!pick) {
          const to = pickByQuery(pool, command.query) ?? pool[0];
          chooseBattery(to);
          return `Battery: ${to.name}.${summary.panels ? "" : " Lay the panels and I can size it to the home."}`;
        }
        setBattery({
          sku: pick.battery.sku,
          name: pick.battery.name,
          kwh: pick.battery.kwh,
          qty: pick.qty,
          ...(battery?.backup ? { backup: true } : {}),
          x: battery?.x ?? cm((view.x + view.w * 0.8 - ROOF_IMAGE.width / 2) * scale),
          y: battery?.y ?? cm((view.y + view.h * 0.62 - ROOF_IMAGE.height / 2) * scale),
        });
        changed();
        const total = Math.round(pick.battery.kwh * pick.qty * 10) / 10;
        return `Battery: ${pick.qty > 1 ? `${pick.qty} × ` : ""}${pick.battery.name}, ${total} kWh. ${idea?.note ?? ""}`.trim();
      }
      case "noBattery":
        setBattery(undefined);
        changed();
        return "Battery taken off.";
      case "inverter": {
        const to = pickByQuery(props.inverters, command.query);
        if (!to) return `No inverter on your lists matches “${command.query}”.`;
        setFitted([
          {
            sku: to.sku,
            name: to.name,
            kw: to.kw,
            x: fitted[0]?.x ?? cm((view.x + view.w * 0.8 - ROOF_IMAGE.width / 2) * scale),
            y: fitted[0]?.y ?? cm((view.y + view.h * 0.36 - ROOF_IMAGE.height / 2) * scale),
          },
        ]);
        setStrings(strings.map((x) => ({ id: x.id, panels: x.panels, mppt: 0 })));
        changed();
        return `Inverter: ${to.name}.`;
      }
      case "panel": {
        const to = pickByQuery(props.catalogue, command.query);
        if (!to) return `No panel on your lists matches “${command.query}”.`;
        choosePanel(to.sku);
        return `Panel: ${to.name}.`;
      }
      case "explainString": {
        const i = command.letter.charCodeAt(0) - 65;
        const x = strings[i];
        if (!x) return `There's no string ${command.letter}.`;
        pickTool("string");
        setChecking(x.id);
        return `String ${command.letter}: ${checks[i]?.words ?? "no check yet."}`;
      }
      case "stringAuto":
        stringForMe();
        return "Strung by rule: see the note on the picture.";
      case "designForMe":
        void designForMe();
        return "Making the three designs.";
      case "pitch":
        setQuote({ ...quoteNow, form: { ...quoteNow.form, pitch: command.degrees, pitchSet: true } });
        return `Roof pitch ${command.degrees}°.`;
      case "flat":
        setQuote({ ...quoteNow, form: { ...quoteNow.form, roof: "flat", pitchSet: true } });
        return "A flat roof: new panels lie flat.";
      case "phase":
        setQuote({ ...quoteNow, form: { ...quoteNow.form, phase: command.phase } });
        return `${command.phase === "three" ? "Three" : "Single"}-phase power.`;
      case "storeys":
        setQuote({ ...quoteNow, form: { ...quoteNow.form, storeys: command.storeys } });
        return `${command.storeys === "double" ? "Double" : "Single"} storey.`;
      case "tilt": {
        const on = panelPicks.length ? panelPicks : everyPanel();
        if (!on.length) return "There are no panels to tilt yet.";
        amend((p) => ({ ...p, tilt: Math.min(TILT.max, command.degrees) }), on);
        return `Tilted ${panelPicks.length ? "the picked" : "all"} ${on.length} panels to ${Math.min(TILT.max, command.degrees)}°.`;
      }
      case "orient": {
        const on = panelPicks.length ? panelPicks : everyPanel();
        setAddLandscape(command.landscape);
        if (!on.length) return `New panels go down ${command.landscape ? "landscape" : "portrait"}.`;
        turnLandscape(command.landscape, on);
        return `${panelPicks.length ? "The picked" : "All"} ${on.length} panels laid ${command.landscape ? "landscape" : "portrait"}, rows kept. Check the strings.`;
      }
      case "rotate": {
        const on = panelPicks.length ? panelPicks : everyPanel();
        if (!on.length) return "There are no panels to turn yet.";
        turn(command.degrees, on);
        return `${panelPicks.length ? "The picked" : "All"} panels turned ${command.degrees > 0 ? "+" : ""}${command.degrees}°.`;
      }
      case "rows": {
        // A size asked for too ("10 kW in two rows"): that size laid first by the rules, then, once they are down, put in
        // the rows (`rowsNext`, below).
        if (command.kw) {
          rowsNext.current = { rows: command.rows, landscape: command.landscape };
          const done = await fillTo(command.kw, command.facing);
          if (!done.laid) {
            rowsNext.current = null;
            return done.words;
          }
          return `${done.laid} panels, ${((done.laid * (panelOf(design).watts || 475)) / 1000).toFixed(2)} kW, in ${Math.min(command.rows, done.laid)} rows${command.landscape === undefined ? "" : command.landscape ? ", landscape" : ", portrait"}. Drag them into place if they need it, and string them.`;
        }
        const on = panelPicks.length ? panelPicks : everyPanel();
        if (!on.length) return "There are no panels to lay in rows yet: ask for a size too (“10 kW in two rows”).";
        const next = byHand(on);
        const group = next.loose
          .filter((p) => next.ids.includes(p.id))
          .map((p) => (command.landscape === undefined ? p : laidAs(p, command.landscape)));
        const laid = new Map(inRows(group, size, command.rows).map((p) => [p.id, p]));
        if (command.landscape !== undefined) setAddLandscape(command.landscape);
        setFaces(next.faces);
        setStrings(next.strings);
        setLoose(next.loose.map((p) => laid.get(p.id) ?? p));
        setPicks(next.ids.map((id): Pick => ({ kind: "loose", id })));
        changed();
        return `${on.length} panels in ${Math.min(command.rows, on.length)} ${command.rows === 1 ? "row" : "rows"}${command.landscape === undefined ? "" : command.landscape ? ", landscape" : ", portrait"}, where they stood. Drag them into place if they need it, and check the strings.`;
      }
      case "removePanels": {
        const on = panelPicks.length ? panelPicks : everyPanel();
        if (!on.length) return "There are no panels on this design.";
        removePicks(on);
        return `${panelPicks.length ? "The picked" : "All"} ${on.length} panels taken off. Ctrl+Z puts them back.`;
      }
      case "deleteDesign": {
        // Asked first, never done straight away: the card below waits for a Yes (9 Nov 2026, Martin).
        const count = everyDesign().length;
        const n = command.which ?? active + 1;
        if (n < 1 || n > count) return `There's no Design ${n}: this roof has ${count === 1 ? "one design" : `${count} designs`}.`;
        if (count <= 1) return "This is the only design on the roof, so it can't be deleted. I can take its panels off instead.";
        setConfirmDelete(n - 1);
        return "";
      }
      case "relay": {
        if (!summary.panels) return "There are no panels to lay again yet.";
        return (await fillTo(summary.kw)).words;
      }
      case "move": {
        const on = panelPicks.length ? panelPicks : everyPanel();
        if (!on.length) return "There are no panels to move yet.";
        nudge(command.east, command.south, on);
        const way = [
          command.south ? `${Math.abs(command.south)} m ${command.south > 0 ? "south" : "north"}` : "",
          command.east ? `${Math.abs(command.east)} m ${command.east > 0 ? "east" : "west"}` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        return `${panelPicks.length ? "The picked" : "All"} panels moved ${way}.`;
      }
      case "undo":
        undo();
        return "Undone.";
      case "redo":
        redo();
        return "Redone.";
      case "choose":
        setChoices({ question: command.question, options: command.options });
        setOtherText("");
        return "";
      case "answer":
        return command.words;
    }
  };
  /**
   * The calculator's Design this: that much solar laid on the roof, then the inverter and a battery of about the size
   * worked out (with the module held for blackouts), as Ask Sol's "load 8 kW PV + a battery" does.
   */
  const designFromCalc = async (size: KwSize, choice: BatteryChoice, phase: "single" | "three") => {
    setCalcOpen(false);
    setOpening(null);
    setCommandBusy(true);
    try {
      if (phase !== quoteNow.form.phase) await runCommand({ do: "phase", phase });
      if (choice === "none" && battery) await runCommand({ do: "noBattery" });
      const done = await fillTo(size.kw);
      if (done.laid) {
        systemAsk.current = {
          inverter: "",
          ...(choice !== "none"
            ? { battery: "", ...(size.batteryKwh ? { batteryKwh: size.batteryKwh } : {}), backup: choice === "backup" }
            : {}),
        };
        setSystemTick((n) => n + 1);
      }
      setCommandReply(done.words.replace(" Strings cleared: string them again.", ""));
    } finally {
      setCommandBusy(false);
    }
  };

  const deleteConfirmed = () => {
    const i = confirmDelete;
    setConfirmDelete(null);
    if (i === null || i >= everyDesign().length || everyDesign().length <= 1) return;
    removeDesign(i);
    setCommandReply(`Design ${i + 1} deleted. Save to keep it that way.`);
  };
  const cancelDelete = () => {
    setConfirmDelete(null);
    setCommandReply("Nothing deleted: the design is as it was.");
  };
  const sendCommand = async (raw: string) => {
    const text = raw.trim();
    if (!text || commandBusy) return;
    // A Yes or a No typed to the delete question answers it.
    const answer = confirmDelete !== null ? confirmWord(text) : null;
    if (answer) {
      if (answer === "yes") deleteConfirmed();
      else cancelDelete();
      setCommandText("");
      setCommandOpen(false);
      return;
    }
    setCommandBusy(true);
    setAsked(text);
    setCommandText("");
    setCommandReply(null);
    setChoices(null);
    setConfirmDelete(null);
    setSystemWords("");
    try {
      const quick = parseCommand(text);
      if (quick) setCommandReply((await runCommand(quick)) || null);
      else {
        const res = await fetch("/api/design/command", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, design: designForSol() }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; command?: DesignCommand; message?: string };
        setCommandReply((j.ok && j.command ? await runCommand(j.command) : (j.message ?? "Sol couldn't read that.")) || null);
      }
      setCommandText("");
      // The box goes once he has acted (8 Nov 2026, Martin): his words stay at the foot of the picture for a while.
      setCommandOpen(false);
    } finally {
      setCommandBusy(false);
      setAsked(null);
    }
  };
  useEffect(() => {
    if (!choices) return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.options.length) {
        e.preventDefault();
        void sendCommand(choices.options[n - 1].request);
      } else if (e.key === "Escape") setChoices(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // In the pop-up the box stays under Sol's reply: the cursor goes back into it, ready for the next thing.
  useEffect(() => {
    if (props.tight && commandReply) commandBox.current?.focus();
  }, [props.tight, commandReply]);
  useEffect(() => {
    if (!commandReply || commandOpen || props.tight) return;
    const t = window.setTimeout(() => setCommandReply(null), 9000);
    return () => window.clearTimeout(t);
  }, [commandReply, commandOpen, props.tight]);
  // "/" opens the command bar, as on the design home; Escape closes it.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setAwayFrom(null);
      setCommandOpen(true);
      requestAnimationFrame(() => commandBox.current?.focus());
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // Lining panels up with the roof: while panels are being added, or are picked, every traced face's outline is
  // lit in gold, and the face they stand on shows how far they are from each of its edges.
  const guide = tool === "panel" || tool === "rule" || pickedPanels.length > 0;
  /**
   * How far the panels are from what is around them: **four distances, square to the panels** (off each side of
   * the group, in the panels' own directions), each to the first traced roof edge or guide line that way. The
   * gutter, the ridge and the two ends, which is what a layout is measured from: not a line to every edge of the
   * face, which on a roof with many edges crossed and overlapped.
   */
  const measures = (() => {
    const group = pickedPanels.length ? pickedPanels : tool === "panel" ? ghosts : [];
    if (!group.length) return [];
    const edges = [...faces.flatMap((face) => face.points.map((a, i) => ({ a, b: face.points[(i + 1) % face.points.length] }))), ...rules];
    if (!edges.length) return [];
    const corners = group.flatMap((p) => [...looseCorners(p, size)]);
    // The panels' own frame: along their long edge, and across it.
    const turned = (group[0].angle * Math.PI) / 180;
    const along = { x: Math.sin(turned), y: -Math.cos(turned) };
    const across = { x: Math.cos(turned), y: Math.sin(turned) };
    const spread = (axis: Point) => {
      const at = corners.map((c) => c.x * axis.x + c.y * axis.y);
      return { least: Math.min(...at), most: Math.max(...at) };
    };
    const [l, w] = [spread(along), spread(across)];
    const midL = (l.least + l.most) / 2;
    const midW = (w.least + w.most) / 2;
    const place = (onAlong: number, onAcross: number): Point => ({
      x: onAlong * along.x + onAcross * across.x,
      y: onAlong * along.y + onAcross * across.y,
    });
    const rays = [
      { from: place(l.most, midW), way: along },
      { from: place(l.least, midW), way: { x: -along.x, y: -along.y } },
      { from: place(midL, w.most), way: across },
      { from: place(midL, w.least), way: { x: -across.x, y: -across.y } },
    ];
    return rays.flatMap(({ from, way }) => {
      let gap = Infinity;
      for (const { a, b } of edges) {
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const cross = way.x * ey - way.y * ex;
        if (Math.abs(cross) < 1e-9) continue;
        const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / cross;
        const on = ((a.x - from.x) * way.y - (a.y - from.y) * way.x) / cross;
        if (t >= 0 && t < gap && on >= 0 && on <= 1) gap = t;
      }
      return gap < 60 ? [{ gap, from, to: { x: from.x + way.x * gap, y: from.y + way.y * gap }, way }] : [];
    });
  })();
  /**
   * The mark in the middle of a panel: an arrow pointing the way it faces (down its slope), or a ring when it
   * lies flat and faces nowhere.
   */
  const aspect = (centre: Point, facing: number, tilt: number, colour: string, weight = 0.8) => {
    const [cx, cy] = px(centre);
    if (tilt === 0)
      return <circle cx={cx} cy={cy} r={0.16 / scale} fill="none" stroke={colour} strokeWidth={weight * u} pointerEvents="none" />;
    const a = (facing * Math.PI) / 180;
    const reach = 0.36 / scale;
    const [tx, ty] = [cx + Math.sin(a) * reach, cy - Math.cos(a) * reach];
    const barb = (off: number) => `${tx - (Math.sin(a + off) * 0.22) / scale},${ty + (Math.cos(a + off) * 0.22) / scale}`;
    return (
      <path
        d={`M${cx - Math.sin(a) * reach},${cy + Math.cos(a) * reach} L${tx},${ty} M${barb(0.55)} L${tx},${ty} L${barb(-0.55)}`}
        fill="none"
        stroke={colour}
        strokeWidth={weight * u}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    );
  };

  const designsMenu = (
    <div
      className={clsx(
        "absolute z-40 max-h-[70vh] w-[24rem] max-w-[85vw] space-y-3 overflow-y-auto rounded-lg border border-line bg-surface p-3 text-ink shadow-lift",
        props.tight ? "right-0 top-full mt-2" : "left-0 top-full mt-2",
      )}
    >
      {props.tight && !props.sitesOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
          {props.noDeal ? (
            <button
              type="button"
              onClick={() => {
                openMenu(false);
                if (saved === "changed") void save();
                setNoDealOpen(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-2 px-4 text-sm font-medium text-ink-2 ring-1 ring-line hover:text-ink"
            >
              <Send className="size-4" aria-hidden /> Publish · put it on a deal first
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={saved === "saving" || publishing}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
              >
                <Send className="size-4" aria-hidden /> {publishing ? "Publishing…" : "Publish design"}
              </button>
              {props.onNote && (
                <button
                  type="button"
                  onClick={() => {
                    openMenu(false);
                    setSending(true);
                  }}
                  className="text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                >
                  With a note to {props.customerName ?? "the customer"}
                </button>
              )}
            </>
          )}
          {sent && !sending && (
            <p className={clsx("w-full text-xs", sent.ok ? "text-positive" : "text-warning")} role="status">
              {sent.message}
            </p>
          )}
        </div>
      )}
      <ul className="space-y-1.5">
        {everyDesign().map((d, i) => {
          const sum = designSummary(d);
          return (
            <li key={i} className={clsx("rounded-md border", i === active ? "border-forest" : "border-line")}>
              <div className="flex items-center gap-1 p-1">
                <button
                  onClick={() => (i === active ? openMenu(false) : show(everyDesign(), i))}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-canvas"
                >
                  <span className="block truncate text-sm font-semibold">
                    Design {i + 1}
                    {d.label ? <span className="font-normal text-ink-2"> · {d.label}</span> : null}
                  </span>
                  <span className="block truncate text-xs tabular-nums text-muted">
                    {sum.panels} panels · {sum.kw.toFixed(2)} kW · {d.panel?.name ?? props.catalogue[0]?.name ?? "Panel"}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setPrimary(i);
                    changed();
                  }}
                  disabled={i === primary}
                  title={i === primary ? "The primary design" : "Make this the primary design"}
                  aria-label={i === primary ? `Design ${i + 1} is the primary` : `Make design ${i + 1} the primary`}
                  className="flex size-9 items-center justify-center rounded-lg hover:bg-canvas"
                >
                  <Star className={clsx("size-4", i === primary ? "fill-sun-line text-sun-line" : "text-muted")} aria-hidden />
                </button>
                {designs.length > 1 && i !== primary && (
                  <button
                    onClick={() => flagDesign(i, "offer")}
                    title={
                      d.offer
                        ? "Offered to the customer as an option: press to stop"
                        : "Offer it to the customer as an option, beside the primary"
                    }
                    aria-pressed={Boolean(d.offer)}
                    className={clsx(
                      "h-8 rounded-full px-2.5 text-[11px] font-semibold",
                      d.offer ? "bg-primary text-primary-ink" : "text-muted ring-1 ring-line hover:text-ink",
                    )}
                  >
                    {d.offer ? "Offered" : "Offer"}
                  </button>
                )}
                {designs.length > 1 && (d.offer || i === primary) && everyDesign().some((x, j) => x.offer && j !== primary) && (
                  <button
                    onClick={() => flagDesign(i, "recommended")}
                    title={d.recommended ? "Recommended to the customer: press to stop" : "Recommend this one to the customer"}
                    aria-label={d.recommended ? `Design ${i + 1} is recommended` : `Recommend design ${i + 1}`}
                    aria-pressed={Boolean(d.recommended)}
                    className="flex size-9 items-center justify-center rounded-lg hover:bg-canvas"
                  >
                    <ThumbsUp className={clsx("size-4", d.recommended ? "fill-sun-line text-sun-line" : "text-muted")} aria-hidden />
                  </button>
                )}
                {designs.length > 1 && (
                  <button
                    onClick={() => setDoomed(doomed === i ? null : i)}
                    title="Delete this design"
                    aria-label={`Delete design ${i + 1}`}
                    className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              {/* The open design names itself inside its own card (10 Nov 2026, Martin: the label box outside it read as apart). */}
              {i === active && (
                <label className="flex items-center gap-2 border-t border-line px-3 py-1.5">
                  <span className="shrink-0 text-xs text-muted">Label</span>
                  <input
                    value={designLabel}
                    onChange={(e) => {
                      setDesignLabel(e.target.value);
                      changed();
                    }}
                    maxLength={40}
                    placeholder="e.g. All on the north face"
                    aria-label={`A label for design ${i + 1}`}
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                </label>
              )}
              {doomed === i && (
                <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm">
                  <span>Delete design {i + 1}? It can&apos;t be undone.</span>
                  <button className="font-semibold text-danger" onClick={() => removeDesign(i)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-10 items-center rounded-md bg-sun-line px-4 text-sm font-semibold text-white hover:brightness-110 disabled:bg-surface-2 disabled:text-muted"
          disabled={designs.length >= MAX_DESIGNS}
          onClick={() => addDesign(false)}
        >
          <Plus className="mr-1.5 size-4" aria-hidden /> New design
        </button>
        <button className={button} disabled={designs.length >= MAX_DESIGNS} onClick={() => addDesign(true)}>
          <Copy className="mr-1.5 size-4" aria-hidden /> Copy this one
        </button>
        <span className="self-center text-xs tabular-nums text-muted">
          {designs.length} of {MAX_DESIGNS}
        </span>
      </div>
      <p className="text-xs text-muted">
        The starred design is the primary: the one this roof opens on. Offer up to {MAX_PROPOSAL_OPTIONS - 1} more to the customer as
        options on the next proposal published, and mark the one you recommend.
      </p>
    </div>
  );

  // Publish design (8 Nov 2026, Martin: in the pop-up, the picture's top right corner): the same control in either place.
  const publishControl =
    props.sitesOnly && !props.tight ? null : (
      <div className="relative" data-popup data-menu-host>
        {props.tight ? (
          // In the pop-up the corner is the roof's designs (10 Nov 2026, Martin: there was no plain way to start a second
          // design): the one open, the others either side, and the menu of them all with New design and Publish.
          <div className="flex h-10 items-center rounded-md bg-primary text-primary-ink shadow-lift">
            {designs.length > 1 && (
              <button
                type="button"
                onClick={() => show(everyDesign(), (active - 1 + designs.length) % designs.length)}
                aria-label="The design before"
                className="flex h-10 w-8 items-center justify-center rounded-l-md text-primary-ink/70 hover:bg-white/10 hover:text-primary-ink"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => openMenu(menu === "designs" ? false : "designs")}
              aria-expanded={menu === "designs"}
              aria-haspopup="true"
              title="Every design on this roof: a new one, a copy, and Publish"
              className={clsx(
                "flex h-10 items-center gap-2 text-sm font-medium tabular-nums hover:bg-white/10",
                designs.length > 1 ? "px-2" : "rounded-md px-4",
              )}
            >
              <Layers className="size-4" aria-hidden />
              <span>
                Design {active + 1}
                {designs.length > 1 ? ` of ${designs.length}` : ""}
              </span>
              {designs.length > 1 && active === primary && <Star className="size-3 fill-sun-line text-sun-line" aria-label="primary" />}
              <ChevronDown className="size-4 opacity-70" aria-hidden />
            </button>
            {designs.length > 1 && (
              <button
                type="button"
                onClick={() => show(everyDesign(), (active + 1) % designs.length)}
                aria-label="The next design"
                className="flex h-10 w-8 items-center justify-center rounded-r-md text-primary-ink/70 hover:bg-white/10 hover:text-primary-ink"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ) : props.noDeal ? (
          // No deal, no customer to send a proposal to: Publish says so, and opens the way to put the design on a deal.
          <button
            type="button"
            onClick={() => {
              if (!noDealOpen && saved === "changed") void save();
              setNoDealOpen(!noDealOpen);
            }}
            aria-expanded={noDealOpen}
            title="Publish: put it on a deal first"
            className={clsx(
              "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap bg-surface-2 text-sm font-medium text-ink-2 ring-1 ring-line hover:text-ink",
              "h-10 rounded-md px-4",
            )}
          >
            <Send className="size-4" aria-hidden /> <span>Publish · put it on a deal first</span>
          </button>
        ) : (
          <button
            onClick={() => (props.onNote ? setSending(!sending) : void publish())}
            aria-expanded={props.onNote ? sending : undefined}
            disabled={saved === "saving" || publishing}
            title="Publish design: saves it and brings the customer's proposal up to date"
            className={clsx(
              "inline-flex items-center justify-center gap-2 bg-primary text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted",
              "h-10 rounded-md px-5",
            )}
          >
            <Send className="size-4" aria-hidden /> <span>{publishing ? "Publishing…" : "Publish design"}</span>
          </button>
        )}
        {noDealOpen && props.noDeal && (
          <div
            className={clsx(
              "absolute z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line",
              "right-0 top-12",
            )}
          >
            <button
              type="button"
              onClick={() => setNoDealOpen(false)}
              aria-label="Close"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            {props.noDeal}
          </div>
        )}
        {props.tight && menu === "designs" && designsMenu}
        {sending && props.onNote && (
          <div
            className={clsx(
              "absolute z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line",
              "right-0 top-12",
            )}
          >
            <button
              type="button"
              onClick={() => setSending(false)}
              aria-label="Close"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            <p className="pr-8 text-sm font-medium text-ink">Send the proposal{props.customerName ? ` to ${props.customerName}` : ""}</p>
            <p className="mt-0.5 text-xs text-muted">
              Your note goes in their chat on the proposal, and by email when replies are emailed. It is kept on the deal.
            </p>
            <textarea
              autoFocus
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void publish(note);
              }}
              placeholder="Hi, here's your design with the battery we spoke about. Any questions, just reply on the proposal."
              className="mt-3 block min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-forest"
            />
            {sent && (
              <p
                className={clsx(
                  "mt-2 rounded-md px-2.5 py-2 text-xs",
                  sent.ok ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning",
                )}
                role="status"
              >
                {sent.message}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={button} onClick={() => void publish()} disabled={publishing}>
                Publish only
              </button>
              <button
                type="button"
                onClick={() => void publish(note)}
                disabled={publishing || !note.trim()}
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
              >
                <Send className="size-4" aria-hidden /> {publishing ? "Sending…" : "Publish and send"}
              </button>
            </div>
          </div>
        )}
      </div>
    );

  // Boxes from the knife's rows open in its card, in place of the rows (8 Nov 2026, Martin: they lay over the other column).
  const readyBox = (
    <div
      className={clsx(
        props.tight
          ? "w-[24rem] max-w-full"
          : "absolute z-50 w-[24rem] max-w-[85vw] rounded-lg bg-surface p-3 shadow-lift ring-1 ring-line",
        props.tight ? "rounded-none bg-transparent p-1 shadow-none ring-0" : "right-0 top-full mt-2",
      )}
    >
      {!props.tight && (
        <button
          type="button"
          onClick={() => setReadyOpen(false)}
          aria-label="Close"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Ready to install</p>
      <ul className="mt-2 space-y-1.5">
        {ready.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[13px]">
            <span
              className={clsx(
                "mt-1 size-2 shrink-0 rounded-full",
                item.state === "pass" ? "bg-positive" : item.state === "fix" ? "bg-danger" : "bg-sun-line",
              )}
              aria-label={item.state === "pass" ? "Passes" : item.state === "fix" ? "To fix" : "To check"}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink">{item.label}</span>{" "}
              <span className={item.state === "pass" ? "text-muted" : "text-ink-2"}>{item.words}</span>
            </span>
            {item.goTo && item.state !== "pass" && (
              <button
                type="button"
                onClick={() => goTo(item.goTo)}
                className="shrink-0 text-xs font-semibold text-ink underline underline-offset-2"
              >
                Fix
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] leading-snug text-muted">
        A guide, not a site inspection: the installer&apos;s own design check and the network&apos;s approval still apply.
      </p>
    </div>
  );
  const liveBox = (
    <div
      className={clsx(
        props.tight
          ? "w-[24rem] max-w-full"
          : "absolute z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line",
        props.tight ? "rounded-none bg-transparent p-1 shadow-none ring-0" : "right-0 top-12",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">Design it live with the customer</p>
        <button type="button" onClick={() => setLiveOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Send them this link during the call. They see every design on this roof as you draw it, with the price after STCs and the saving,
        can switch between them, and tell you which they&apos;d like. Nothing else of yours is shown. It closes after a few hours, or when
        you end it.
      </p>
      {live ? (
        <>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={liveLink(live.token)}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md bg-surface-2 px-2.5 py-2 text-xs text-ink ring-1 ring-line"
              aria-label="The customer's live link"
            />
            <button
              type="button"
              onClick={() => void copyLive()}
              className="rounded-md bg-primary px-3 text-xs font-medium text-primary-ink hover:bg-forest"
            >
              {liveCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
            <span className={clsx("size-2 rounded-full", live.seenAt ? "bg-positive" : "bg-line")} aria-hidden />
            {liveWords}
          </p>
          {costsHidden && <p className="mt-1 text-xs text-muted">Prices aren&apos;t shown: you don&apos;t see costs on this account.</p>}
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => void stopLive()} className="text-xs text-ink-2 underline-offset-2 hover:underline">
              End the live link
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-2">{liveProblem ?? "Opening a link…"}</p>
      )}
      {live && liveProblem && <p className="mt-2 text-xs text-danger">{liveProblem}</p>}
    </div>
  );

  return (
    <div className={clsx(props.tight && "relative p-2")}>
      {/* The bar that stays at the top of the page, in two rows so nothing is squashed: the wordmark, the address search
          and the address being designed; then which design this is and its quote on the left, and publishing it and
          its proposal on the right. A firmer line under it sets it off from the work below. */}
      <header
        className={clsx(
          "z-40 text-ink",
          // In the pop-up (8 Nov 2026, Martin: no menu bar, the map taller and wider; the buttons can run down one side):
          // a rail of rounds down the left, beside the picture, each saying what it is on hover.
          props.tight ? "absolute left-2 top-2 w-11" : "relative rounded-lg bg-surface px-4 shadow-[var(--shadow-soft)] ring-1 ring-line",
        )}
      >
        <BarRow
          quick={
            props.tight ? (
              <>
                <Leg label="String panels (S)" on={tool === "string"} onClick={() => pickTool(tool === "string" ? "select" : "string")}>
                  <Cable className="size-5" aria-hidden />
                </Leg>
                <Leg label="Shade analysis" on={shadeOn} onClick={toggleShade}>
                  <SunMedium className="size-5" aria-hidden />
                </Leg>
                <Leg label={illustrated ? "Show the photo" : "Draw the roof"} on={illustrated} onClick={toggleIllustrated}>
                  <Brush className="size-5" aria-hidden />
                </Leg>
                <Leg label="The home's day" on={homeDay.on} onClick={() => (homeDay.on ? homeDay.close() : homeDay.open())}>
                  <Sunrise className="size-5" aria-hidden />
                </Leg>
              </>
            ) : undefined
          }
          tools={
            props.tight ? (
              <>
                {!costsHidden && (
                  <Leg label="Design it for me" on={mineIntro || mine === "busy"} onClick={() => setMineIntro(!mineIntro)}>
                    <WandSparkles className={clsx("size-5", mine === "busy" && "animate-pulse")} aria-hidden />
                  </Leg>
                )}
                <Leg label="Trace a roof face (T)" on={tool === "trace"} onClick={() => pickTool(tool === "trace" ? "select" : "trace")}>
                  <PenTool className="size-5" aria-hidden />
                </Leg>
                <Leg label="Guide line (G)" on={tool === "rule"} onClick={() => pickTool(tool === "rule" ? "select" : "rule")}>
                  <Ruler className="size-5" aria-hidden />
                </Leg>
                <Leg label="Comment (C)" on={tool === "comment"} onClick={() => pickTool(tool === "comment" ? "select" : "comment")}>
                  <MessageCircle className="size-5" aria-hidden />
                </Leg>
                <Leg label="Add a label (L)" on={tool === "label"} onClick={() => pickTool(tool === "label" ? "select" : "label")}>
                  <Tag className="size-5" aria-hidden />
                </Leg>
                <Leg label="Undo (Ctrl+Z)" onClick={undo}>
                  <Undo2 className="size-5" aria-hidden />
                </Leg>
                <Leg label="Redo (Ctrl+Shift+Z)" onClick={redo}>
                  <Redo2 className="size-5" aria-hidden />
                </Leg>
                <Leg label="Whole picture" onClick={() => setView(WHOLE)}>
                  <Maximize className="size-5" aria-hidden />
                </Leg>
              </>
            ) : undefined
          }
          tight={props.tight}
          hold={readyOpen || (menu === "designs" && !props.tight) || liveOpen || ((sending || noDealOpen) && !props.tight)}
          panel={
            props.tight && readyOpen
              ? { title: "Ready to install", body: readyBox, back: () => setReadyOpen(false) }
              : props.tight && liveOpen
                ? { title: "Share live", body: liveBox, back: () => setLiveOpen(false) }
                : undefined
          }
          unsaved={saved !== "saved" && saved !== "saving"}
          waiting={props.waiting ?? 0}
        >
          {props.bar}
          {!props.tight && (
            <dl
              className={clsx(
                "min-w-0 flex-1 basis-56 items-center gap-x-6 overflow-hidden border-line lg:border-l lg:pl-5",
                props.tight ? "sr-only" : "flex",
              )}
            >
              <div className="min-w-0 flex-1">
                <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Address</dt>
                <dd className="truncate text-sm">
                  <h1>{props.address}</h1>
                </dd>
              </div>
            </dl>
          )}
          <span className={clsx("whitespace-nowrap text-xs text-muted", props.tight && "hidden")} role="status">
            {saved === "saved"
              ? (props.savedLabel ?? "Saved")
              : saved === "saving"
                ? "Saving…"
                : saved === "changed"
                  ? drafted && props.onDraft
                    ? "Kept as a draft, not published"
                    : "Not saved yet"
                  : saved.error}
          </span>
          {/* Save, without publishing (8 Nov 2026, Martin: there was no way but Publish); Ctrl+S does the same. */}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saved === "saved" || saved === "saving"}
            data-leg={saved === "saved" ? "Saved" : "Save (Ctrl+S)"}
            title="Save this roof's designs (Ctrl+S). Publishing is separate."
            className={clsx(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold ring-1",
              props.tight ? "size-10" : "h-9 px-3.5",
              saved === "saved" || saved === "saving"
                ? "bg-surface text-muted ring-line"
                : "bg-ink text-canvas ring-ink hover:brightness-110",
            )}
          >
            {saved === "saved" ? <Check className="size-3.5" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
            <span className={clsx(props.tight && "sr-only")}>{saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : "Save"}</span>
            {!props.tight && saved !== "saved" && saved !== "saving" && (
              <kbd className="rounded border border-current/30 px-1 text-[10px] font-normal opacity-70">Ctrl S</kbd>
            )}
          </button>
          {/* Opened on an earlier visit's unsaved work: said once, with the way back to what is saved. */}
          {resumed && saved !== "saved" && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink">
              {!props.tight && `Picked up where you left off${keptWhen(resumed) ? ` ${keptWhen(resumed)}` : ""}`}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Throw away the unsaved changes and go back to the design as it was last saved?")) return;
                  props.onDiscardDraft?.();
                }}
                title="Picked up where you left off. Discard the draft and go back to what is saved"
                className={clsx(
                  props.tight
                    ? "flex size-10 items-center justify-center rounded-full bg-sun text-sun-ink ring-1 ring-sun-line/40"
                    : "tap-area rounded px-1 text-muted underline underline-offset-2 hover:text-ink",
                )}
              >
                {props.tight ? <Undo2 className="size-4" aria-label="Discard the draft" /> : "Discard"}
              </button>
            </span>
          )}
          {/* Sol drives the designer: the command bar, opened here or with "/". In the pop-up, from the foot of the picture. */}
          {!props.tight && (
            <button
              type="button"
              onClick={() => {
                setCommandOpen(!commandOpen);
                requestAnimationFrame(() => commandBox.current?.focus());
              }}
              className={clsx(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-surface text-xs font-medium text-ink-2 ring-1 ring-line hover:text-ink",
                props.tight ? "size-10" : "h-9 px-3",
              )}
              title="Tell Sol what to change: “fit 8 kW on the north face”, “use the Sigenergy battery”, “why is string B failing?”"
            >
              <SolIcon className="size-4" />
              {props.tight ? <span className="sr-only">Ask Sol to change it</span> : "Ask Sol to change it"}
              {!props.tight && <kbd className="rounded border border-line px-1 text-[10px] text-muted">/</kbd>}
            </button>
          )}
          {/* Ready to install: green only when the design would pass; pressed, every check with what to fix. */}
          <div className="relative" data-menu-host data-popup>
            <button
              type="button"
              onClick={() => setReadyOpen(!readyOpen)}
              data-leg={light.ready ? "Ready to install" : `${light.fix} to fix${light.check ? `, ${light.check} to check` : ""}`}
              aria-expanded={readyOpen}
              className={clsx(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs font-semibold ring-1",
                props.tight ? "size-10" : "h-9 px-3",
                light.ready ? "bg-positive-soft text-positive ring-positive/30" : "bg-sun text-sun-ink ring-sun-line/40",
              )}
              title={
                light.ready
                  ? "Ready to install: every check the design must clear before it goes to site"
                  : `${light.fix} to fix${light.check ? `, ${light.check} to check` : ""}: every check the design must clear before it goes to site`
              }
            >
              {props.tight ? (
                light.ready ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <span className="tabular-nums">{light.fix}</span>
                )
              ) : (
                <>
                  <span className={clsx("size-2 rounded-full", light.ready ? "bg-positive" : "bg-sun-line")} aria-hidden />
                  {light.ready ? "Ready to install" : `${light.fix} to fix`}
                  {light.check > 0 && <span className="font-normal opacity-80">· {light.check} to check</span>}
                </>
              )}
            </button>
            {readyOpen && !props.tight && readyBox}
          </div>
          {/* The open design as the primary in one press (8 Nov 2026, Martin): the one priced on the deal and sent first. */}
          {designs.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setPrimary(active);
                changed();
              }}
              disabled={active === primary}
              data-leg={active === primary ? "The primary design" : "Make it the primary"}
              title={
                active === primary
                  ? "This is the primary design"
                  : "Make the open design the primary: the one priced on the deal and sent first"
              }
              className={clsx(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium ring-1",
                props.tight ? "size-10 rounded-full" : "h-10 rounded-md px-3",
                active === primary ? "bg-sun text-sun-ink ring-sun-line/30" : "bg-surface text-ink ring-line hover:ring-ink/40",
              )}
            >
              <Star className={clsx("size-4", active === primary ? "fill-sun-line text-sun-line" : "text-muted")} aria-hidden />
              <span className={clsx(props.tight && "sr-only")}>{active === primary ? "Primary" : "Make primary"}</span>
            </button>
          )}
          {/* Which of the roof's designs is open: here in the bar, off the picture. */}
          <div className="relative" data-menu-host>
            <button
              onClick={() => openMenu(menu === "designs" ? false : "designs")}
              aria-expanded={menu === "designs"}
              aria-haspopup="true"
              title={`Design ${active + 1} of ${designs.length}${active === primary ? " (primary)" : ""}${designLabel.trim() ? `: ${designLabel.trim()}` : ""}`}
              aria-label={`Designs: design ${active + 1} of ${designs.length}`}
              className={clsx(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-medium tabular-nums",
                props.tight ? "size-10 flex-col gap-0 rounded-full text-[10px] leading-none" : "h-10 rounded-md px-3 text-sm",
                menu === "designs" ? "border-primary bg-surface-2 text-ink" : "border-line bg-surface text-ink hover:border-forest",
              )}
            >
              <Layers className={clsx(props.tight ? "size-3.5" : "size-4")} aria-hidden />
              <span>{props.tight ? `${active + 1}/${designs.length}` : `Design ${active + 1} of ${designs.length}`}</span>
              {!props.tight && active === primary && <Star className="size-3 fill-sun-line text-sun-line" aria-hidden />}
            </button>
            {menu === "designs" && !props.tight && designsMenu}
          </div>
          {!props.tight && <span className="hidden flex-1 lg:block" aria-hidden />}
          {/* Share live: the customer watches the design on their phone during the call, and says which they'd like. */}
          <div className="relative" data-popup>
            <button
              type="button"
              onClick={() => (liveOpen ? setLiveOpen(false) : void shareLive())}
              aria-expanded={liveOpen}
              title={liveWords ?? "Share live: the customer watches the design on their phone"}
              aria-label={live ? `Live with the customer: ${liveWords}` : "Share the design live with the customer"}
              className={clsx(
                "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm ring-1 transition",
                live ? "px-3.5" : "w-10",
                live ? "bg-sun-line/10 text-ink ring-sun-line" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              <Radio className={clsx("size-4", live && "animate-pulse text-sun-line")} aria-hidden />
              {live ? (liveChoice !== null ? "Chosen" : "Live") : null}
            </button>
            {liveOpen && !props.tight && liveBox}
          </div>
          {/* The customer's chat (as Primero's): a round that lights orange with a count while they wait, opening the Proposal view. */}
          {props.jobId && (
            <button
              type="button"
              onClick={() => showSide("proposal")}
              title={(props.waiting ?? 0) > 0 ? "The customer is waiting for a reply" : "The chat with the customer"}
              aria-label={(props.waiting ?? 0) > 0 ? `Chat: ${props.waiting} waiting` : "Chat with the customer"}
              className={clsx(
                "relative flex size-10 items-center justify-center rounded-full ring-1 transition",
                (props.waiting ?? 0) > 0 ? "bg-sun-line text-white ring-sun-line" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              <MessageCircle className="size-[18px]" aria-hidden />
              {(props.waiting ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-5 text-white ring-2 ring-surface">
                  {props.waiting}
                </span>
              )}
            </button>
          )}
          {!props.tight && publishControl}
        </BarRow>
      </header>

      <div className={clsx("relative", props.tight ? "pl-[4.25rem] pr-11" : "mt-5")}>
        <div className="min-w-0">
          <div>
            {/* The figures, in a strip across the top of the picture, read left to right as one chain: what is on the roof, what it makes, what stores and runs it, and what
                  that does to this home's bill. Each has one large figure in the same place every time, with its detail under it. */}
            <section
              ref={stripBox}
              className={clsx(
                "relative z-30 mx-auto flex items-stretch rounded-lg bg-primary text-white",
                props.tight ? "mb-1.5 flex-nowrap" : "mb-2 flex-wrap",
              )}
              style={{ maxWidth: fit }}
              aria-label="This design in figures"
            >
              {/* Three boxes (1 Nov 2026, Martin, as Primero's): Solar (kW and panels, with the daily yield beside them), Battery
                  (kWh and modules), then what it does for this home on white, so the money reads apart from the system. */}
              {props.tight ? (
                <div className="flex shrink-0 items-center gap-4 border-r border-white/15 px-3.5 py-1.5 text-xs tabular-nums text-white/60">
                  <span className="whitespace-nowrap" title={`${summary.panels} panels of ${panelOf(design).watts} W`}>
                    <b className="text-[15px] font-semibold text-sun-bright">{summary.kw.toFixed(2)}</b> kW · {summary.panels} ×{" "}
                    {panelOf(design).watts} W
                  </span>
                  <span
                    className={clsx("whitespace-nowrap", oversize?.over && "text-sun-bright")}
                    title={
                      fitted.length ? `${fittedKw} kW of inverter${oversize ? `, panels ${oversize.percent}%` : ""}` : "No inverter chosen"
                    }
                  >
                    <b className="text-[15px] font-semibold text-white">{summary.kwhPerDay}</b> kWh/day
                  </span>
                  <span className="whitespace-nowrap" title={battery ? `${battery.qty} modules` : "No battery"}>
                    <b className="text-[15px] font-semibold text-white">{battery ? batteryKwh : "–"}</b>{" "}
                    {battery ? "kWh battery" : "no battery"}
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative flex flex-[1.2] items-center justify-around gap-6 border-r border-white/15 px-5 py-1">
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-sun-bright">Solar</p>
                      <p className="whitespace-nowrap leading-tight">
                        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-sun-bright">
                          {summary.kw.toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-white/60">kW</span>
                      </p>
                      <p className="whitespace-nowrap text-xs leading-tight tabular-nums text-white/60">
                        {summary.panels} {summary.panels === 1 ? "panel" : "panels"} of {panelOf(design).watts} W
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">Daily yield</p>
                      <p className="whitespace-nowrap leading-tight">
                        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{summary.kwhPerDay}</span>
                        <span className="ml-1 text-xs text-white/60">kWh</span>
                      </p>
                      <p
                        className={clsx(
                          "whitespace-nowrap text-xs tabular-nums",
                          oversize?.over ? "font-medium text-sun-bright" : "text-white/60",
                        )}
                      >
                        {fitted.length
                          ? `${fittedKw} kW of inverter${oversize ? ` · panels ${oversize.percent}%` : ""}`
                          : "no inverter chosen"}
                      </p>
                    </div>
                  </div>
                  <div className="relative flex flex-[0.6] flex-col justify-center border-r border-white/15 px-4 py-1">
                    <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-sun-bright">Battery</p>
                    <p className="whitespace-nowrap leading-tight">
                      <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{battery ? batteryKwh : "–"}</span>
                      <span className="ml-1 text-xs text-white/60">{battery ? "kWh" : "no battery"}</span>
                    </p>
                    {battery && (
                      <p className="whitespace-nowrap text-xs leading-tight tabular-nums text-white/60">
                        {battery.qty} {battery.qty === 1 ? "module" : "modules"}
                      </p>
                    )}
                  </div>
                </>
              )}
              {/* What it does for this home. Until the customer's bill is in, this part asks for it; once it is, the part
                  shows what the bill works out to, and a press on it opens the bill again. */}
              <div
                className={clsx("relative min-w-0 flex-[2.4] bg-surface text-ink", designs.length > 1 ? "" : "rounded-r-lg")}
                data-menu-host
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={menu === "bill"}
                  aria-label={finance ? "What it does for this home: open the customer's bill" : "Add the customer's electricity bill"}
                  title={finance ? "Open the customer's bill" : "Add the customer's electricity bill"}
                  onClick={() => {
                    openMenu(menu === "bill" ? false : "bill");
                    if (menu !== "bill" && props.jobId && !(Number(bill.amount) > 0) && !solLooked.current) void askSol();
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    openMenu(menu === "bill" ? false : "bill");
                  }}
                  className={clsx(
                    "h-full cursor-pointer rounded-r-lg",
                    props.tight ? "flex items-center px-3 py-1" : "px-3.5 py-1.5",
                    // Red until the bill is in (as Primero's: it was easy to skip past), since saving and payback wait on it.
                    finance ? "hover:bg-surface-2" : "bg-danger/10 ring-2 ring-inset ring-danger hover:bg-danger/15",
                  )}
                >
                  <p
                    className={clsx(
                      "flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.2em]",
                      finance ? "text-muted" : "text-danger",
                      props.tight && "hidden",
                    )}
                  >
                    {!finance && <span className="size-1.5 animate-ping rounded-full bg-danger" aria-hidden />}
                    For this home{!finance && " · Needed"}
                  </p>
                  {finance && props.tight ? (
                    <p
                      className="flex items-center gap-3 whitespace-nowrap text-xs tabular-nums text-muted"
                      title="What it does for this home: open the bill"
                    >
                      <span>
                        Bill{" "}
                        <b className="text-[14px] font-semibold text-ink">
                          {dollars(finance.billNow)} → {dollars(finance.billAfter)}
                        </b>
                      </span>
                      <span>
                        Saves <b className="text-[14px] font-semibold text-positive">{dollars(finance.saving)}</b>/yr
                      </span>
                      <span>
                        Payback{" "}
                        <b className="text-[14px] font-semibold text-ink">
                          {net !== null && finance.saving > 0 ? `${(net / finance.saving).toFixed(1)} yrs` : "–"}
                        </b>
                      </span>
                    </p>
                  ) : !finance && props.tight ? (
                    <p className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-danger">
                      <ReceiptText className="size-4 shrink-0" aria-hidden /> Add the customer&apos;s bill
                    </p>
                  ) : finance ? (
                    <dl className="mt-0.5 flex gap-x-4">
                      {(
                        [
                          ["Home uses", `${finance.dailyKwh} kWh a day`, false],
                          ["Bill", `${dollars(finance.billNow)} → ${dollars(finance.billAfter)}`, false],
                          ["Saves a year", dollars(finance.saving), true],
                          ["Payback", net !== null && finance.saving > 0 ? `${(net / finance.saving).toFixed(1)} yrs` : "–", false],
                        ] as const
                      ).map(([name, value, gold]) => (
                        <div key={name}>
                          <dt className="whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.14em] text-muted">{name}</dt>
                          <dd
                            className={clsx(
                              "whitespace-nowrap text-[15px] font-semibold tabular-nums leading-tight",
                              gold && "text-positive",
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ReceiptText className="size-6 shrink-0 text-danger" aria-hidden />
                      <span className="text-base font-semibold leading-tight text-ink">Add the customer&apos;s bill</span>
                      <span className="text-xs text-muted">
                        {Number(bill.amount) > 0
                          ? "That bill is no more than its supply charge: check the figures."
                          : net !== null
                            ? `${dollars(net)} after STCs. Saving and payback need the bill.`
                            : "For the saving and payback."}
                      </span>
                    </p>
                  )}
                </div>
                {menu === "bill" && (
                  <div className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-[22rem] max-w-[85vw] overflow-y-auto text-ink shadow-lift rounded-lg border border-line bg-surface p-3">
                    <p className={label}>The customer&apos;s electricity bill</p>
                    {props.jobId && (
                      <button
                        type="button"
                        onClick={() => void askSol()}
                        disabled={usageRead?.busy}
                        className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:border-forest disabled:bg-surface-2 disabled:text-muted"
                      >
                        <SolIcon className="size-4" />
                        {usageRead?.busy ? "Sol is looking through their file…" : "Find it in the customer's file"}
                      </button>
                    )}
                    {/* A photo of the bill (or its PDF): read into the box, then one press sizes the system from it. */}
                    <div className="mt-2">
                      <CaptureButtons
                        onFiles={(files) => files[0] && void readBillPhoto(files[0])}
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        busy={Boolean(usageRead?.busy && usageRead.photo)}
                        photoLabel="Photo of the bill"
                        fileLabel="Bill PDF"
                        desktopLabel="Read it from the bill (photo or PDF)"
                        size="sm"
                      />
                    </div>
                    {usageRead && !usageRead.busy && (
                      <div
                        className={clsx(
                          "mt-2 rounded-md px-2.5 py-2 text-xs",
                          usageRead.error ? "bg-warning-soft text-warning" : "bg-sun text-sun-ink",
                        )}
                        role="status"
                      >
                        {usageRead.error ? (
                          <p>{usageRead.error}</p>
                        ) : (
                          <>
                            <p className="font-medium">
                              {usageRead.photo
                                ? "Read from the bill: check the figures below against it."
                                : "Sol found this in the customer's file: check it before saving."}
                            </p>
                            <ul className="mt-1 grid gap-1">
                              {usageRead.notes.map((n) => (
                                <li key={n}>{n}</li>
                              ))}
                            </ul>
                            {usageRead.photo && !costsHidden && (
                              <button
                                type="button"
                                onClick={() => void designForMe()}
                                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-ink"
                              >
                                Size the system to this bill: make the three designs
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium">
                      <label>
                        Billed
                        <select
                          value={bill.interval}
                          onChange={(e) => setBill(billWith(bill, { interval: e.target.value as BillInterval }))}
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest appearance-auto"
                        >
                          <option value="annual">Yearly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="bimonthly">Every two months</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      <label>
                        A typical bill ($)
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="10"
                          value={bill.amount}
                          onChange={(e) => setBill(billWith(bill, { amount: e.target.value }))}
                          onBlur={() => Number(bill.amount) > 0 && tips.nudge("bill-typed")}
                          placeholder="e.g. 350"
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest"
                        />
                      </label>
                      {/* kWh as well as dollars (as Primero's): typing kWh works the dollars out from it at the rate plus the supply
                          charge, and typing dollars shows the kWh it comes to here, greyed. */}
                      <label>
                        Or usage (kWh)
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={bill.usage ?? ""}
                          onChange={(e) => setBill(billWith(bill, { usage: e.target.value }))}
                          placeholder={usageFromAmount(bill) !== null ? `about ${usageFromAmount(bill)}` : "e.g. 1500"}
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest"
                        />
                      </label>
                      <label>
                        Daily supply charge ($)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bill.supplyPerDay}
                          onChange={(e) => setBill(billWith(bill, { supplyPerDay: e.target.value }))}
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest"
                        />
                      </label>
                      <label>
                        Rate ($ a kWh)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bill.rate}
                          onChange={(e) => setBill(billWith(bill, { rate: e.target.value }))}
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest"
                        />
                      </label>
                      <label className="col-span-2">
                        Feed-in tariff ($ a kWh)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bill.feedIn}
                          onChange={(e) => setBill({ ...bill, feedIn: e.target.value })}
                          className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest"
                        />
                      </label>
                    </div>
                    {finance && (
                      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-2.5 text-xs">
                        {(
                          [
                            ["Home uses", `${finance.dailyKwh} kWh a day`],
                            ["Runs on its own", `${Math.round(finance.selfReliance * 100)}%`],
                            ["Bill a year", `${dollars(finance.billNow)} → ${dollars(finance.billAfter)}`],
                          ] as const
                        ).map(([name, value]) => (
                          <div key={name}>
                            <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{name}</dt>
                            <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {Number(bill.amount) > 0 && !finance && summary.panels > 0
                        ? "That bill is no more than its supply charge at these prices: check the figures."
                        : finance
                          ? `About ${finance.dailyKwh} kWh a day. The bill, the saving and the payback over the picture are worked out from this.`
                          : "Typed in from their bill: the bill, the saving and the payback over the picture are worked out from it. One price at all times of day. Saved with the design."}
                    </p>
                  </div>
                )}
              </div>
            </section>
            {/* The picture's height as a variable, so the kit lists that open on it scroll inside it, clear of the tools at its foot.
                Everything floating on it is dark glass (glass-dark, 10 Nov 2026, Martin). */}
            <div
              className="glass-dark relative mx-auto"
              style={
                {
                  maxWidth: fit,
                  ...(fitPx ? { "--pic-h": `${Math.round((fitPx * ROOF_IMAGE.height) / ROOF_IMAGE.width)}px` } : {}),
                } as React.CSSProperties
              }
            >
              {/* Too many panels for the inverters: a pill on the picture, not a line above it, so the picture keeps its size
                  (8 Nov 2026, Martin); the whole of it when pointed at or focused. A battery on the design lifts the limit. */}
              {oversize?.over && (
                <div
                  tabIndex={0}
                  role="alert"
                  className={clsx(
                    "group absolute z-20 flex max-w-[min(26rem,calc(100%-1.5rem))] items-start gap-2 rounded-2xl border border-sun-line bg-sun/95 px-3 py-2 text-[13px] text-sun-ink shadow-lift backdrop-blur-md outline-none",
                    props.tight ? "right-3 top-16" : "right-3 top-[7.25rem]",
                  )}
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <strong className="font-semibold">Panels {oversize.percent}% of the inverter</strong>
                    <span className="hidden group-hover:inline group-focus:inline">
                      : {summary.kw.toFixed(2)} kW of panels on {fittedKw} kW of inverter. Without a battery the limit is {oversize.limit}%.
                      Choose a larger inverter, add one, take panels off, or add a battery.
                    </span>
                  </span>
                </div>
              )}
              {keysOpen && (
                <div
                  className={clsx(GLASS, "absolute right-3 top-[4.5rem] z-50 w-80 p-3 text-[13px]")}
                  role="dialog"
                  aria-label="Keyboard shortcuts"
                  data-popup
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Keyboard shortcuts</p>
                    <button type="button" onClick={() => setKeysOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <dl className="mt-2 space-y-1">
                    {SHORTCUTS.map(([keys, does]) => (
                      <div key={keys} className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 font-mono text-[11px] text-ink">{keys}</dt>
                        <dd className="text-right text-ink-2">{does}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {/* In the pop-up the box and Sol's answer are one black panel growing out of the Ask Sol pill (9 Nov 2026,
                  Martin: it should physically connect to Sol below, and stay black): its foot runs behind the pill. */}
              {props.tight && !solAway && (commandOpen || commandReply || commandBusy || opening || calcOpen) && (
                <div
                  ref={solPanel}
                  className="absolute bottom-[3.5rem] left-1/2 z-50 flex w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 rounded-[28px] bg-primary px-2.5 pb-[2.6rem] pt-2.5 text-white shadow-[0_18px_50px_rgba(11,11,12,0.4)] ring-1 ring-white/10 transition duration-200 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none"
                  data-popup
                >
                  {calcOpen ? (
                    <SolCalculator
                      kwhPerDay={dailyFromBillFields(bill)}
                      phase={quoteNow.form.phase === "three" ? "three" : "single"}
                      {...(summary.kw > 0 ? { startKw: Math.round(summary.kw * 10) / 10 } : {})}
                      onDesign={(size, choice, phase) => void designFromCalc(size, choice, phase)}
                      onClose={() => setCalcOpen(false)}
                    />
                  ) : (
                    opening && (
                      <SolOpening
                        opening={opening}
                        onLead={(lead) => designForGoal(lead === "battery" ? "return" : "payback")}
                        onGoal={designForGoal}
                        onCalc={() => setCalcOpen(true)}
                        onPlace={() => {
                          const daily = dailyFromBillFields(bill);
                          const sized = daily ? quickSize({ kwhPerDay: daily }) : null;
                          const lead = opening.kind === "advice" ? opening.advice.lead : "battery";
                          const kw = sized ? (lead === "battery" ? sized.withBattery.kw : sized.solar.kw) : 6.6;
                          startTapFill(Math.ceil((kw * 1000) / (panelOf(design).watts || 475)));
                        }}
                        onClose={() => setOpening(null)}
                      />
                    )
                  )}
                  {commandBusy && asked && (
                    <div className="flex flex-col gap-2 px-2.5 pt-1.5">
                      <p className="max-w-[85%] self-end rounded-2xl bg-white/10 px-3 py-1.5 text-[13.5px] text-white/85">{asked}</p>
                      <div className="[&_.text-muted]:text-white/65">
                        <SolThinking />
                      </div>
                    </div>
                  )}
                  {commandReply && (
                    <div className="flex items-start gap-2.5 px-2.5 pt-1.5" role="status">
                      <SolIcon className="mt-0.5 size-4 shrink-0 text-sun-line" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-relaxed text-white/90">
                          {commandReply}
                          {systemWords && ` ${systemWords}`}
                        </p>
                        {existingQ && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={commandBusy}
                              onClick={() => answerExistingQ(true)}
                              className="rounded-full bg-sun-line px-3 py-1 text-[12.5px] font-medium text-white hover:brightness-110"
                            >
                              Replacing them
                            </button>
                            <button
                              type="button"
                              disabled={commandBusy}
                              onClick={() => answerExistingQ(false)}
                              className="rounded-full px-3 py-1 text-[12.5px] font-medium text-white/85 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                            >
                              Adding to them
                            </button>
                          </span>
                        )}
                        {!existingQ && summary.panels > 0 && !tapFill && (
                          <button
                            type="button"
                            disabled={commandBusy}
                            onClick={() => startTapFill(summary.panels)}
                            className="mr-1.5 mt-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-white/85 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                          >
                            Show me where: tap the roof
                          </button>
                        )}
                        {!existingQ && roofCheckNow && hasSolar(roofCheckNow.things) && (
                          <button
                            type="button"
                            disabled={commandBusy}
                            onClick={() => void answerExisting(!replacing)}
                            className="mt-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-white/85 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                          >
                            {replacing ? "Keep clear of the existing panels" : "The existing panels are being replaced: use their roof"}
                          </button>
                        )}
                        {(splitting || splitOffer) && (
                          <button
                            type="button"
                            disabled={commandBusy}
                            onClick={() => void answerSplit(!splitting)}
                            className="mr-1.5 mt-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-white/85 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                          >
                            {splitting ? "Keep them on one face" : `Split some to the ${splitOffer}?`}
                          </button>
                        )}
                        {props.nearmapPicture && faces.length > 0 && (
                          <button
                            type="button"
                            disabled={commandBusy}
                            onClick={() => void answerReadRoof()}
                            className="ml-1.5 mt-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-white/85 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                          >
                            Faces look wrong? Read the roof again
                          </button>
                        )}
                      </div>
                      {!commandOpen && (
                        <button
                          type="button"
                          onClick={putSolAway}
                          aria-label="Close"
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                  {/* The box stays under his reply, so the next thing can be typed straight away (9 Nov 2026, Martin). */}
                  {(commandOpen || commandReply) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void sendCommand(commandText);
                      }}
                      className="flex items-center gap-2 rounded-full bg-primary p-1.5 pl-3 ring-1 ring-white/15 focus-within:ring-sun-line/70"
                    >
                      <input
                        ref={commandBox}
                        value={commandText}
                        onFocus={() => setCommandOpen(true)}
                        onChange={(e) => setCommandText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") putSolAway();
                        }}
                        placeholder="Fit 8 kW on the north face · add the storage it needs · how could I bring the payback down?"
                        aria-label="Tell Sol what to change in the design, or ask him about it"
                        className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/45"
                      />
                      <button
                        type="button"
                        onClick={() => setCalcOpen((o) => !o)}
                        aria-label="Size a system: the calculator"
                        title="Size a system: PV kW, a battery or backup"
                        aria-pressed={calcOpen}
                        className={clsx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10 hover:text-white",
                          calcOpen ? "text-sun-line" : "text-white/70",
                        )}
                      >
                        <Calculator className="size-4" aria-hidden />
                      </button>
                      <span className="inline-flex [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/70">
                        <DictateButton
                          onWords={(words) => void sendCommand(words)}
                          onHearing={(words) => setCommandText(words)}
                          label="Say it"
                        />
                      </span>
                      <button
                        type="submit"
                        disabled={commandBusy || !commandText.trim()}
                        className="h-9 rounded-full bg-sun-line px-4 text-sm font-medium text-white disabled:bg-transparent disabled:text-white/40"
                      >
                        {commandBusy ? "…" : "Go"}
                      </button>
                      <button
                        type="button"
                        onClick={putSolAway}
                        aria-label="Close"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </form>
                  )}
                </div>
              )}
              {!props.tight && (opening || calcOpen) && (
                <div
                  className="absolute left-1/2 top-[4.5rem] z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-[28px] bg-primary px-2.5 pb-3 pt-2.5 text-white shadow-[0_18px_50px_rgba(11,11,12,0.4)] ring-1 ring-white/10"
                  data-popup
                >
                  {calcOpen ? (
                    <SolCalculator
                      kwhPerDay={dailyFromBillFields(bill)}
                      phase={quoteNow.form.phase === "three" ? "three" : "single"}
                      {...(summary.kw > 0 ? { startKw: Math.round(summary.kw * 10) / 10 } : {})}
                      onDesign={(size, choice, phase) => void designFromCalc(size, choice, phase)}
                      onClose={() => setCalcOpen(false)}
                    />
                  ) : (
                    opening && (
                      <SolOpening
                        opening={opening}
                        onLead={(lead) => designForGoal(lead === "battery" ? "return" : "payback")}
                        onGoal={designForGoal}
                        onCalc={() => setCalcOpen(true)}
                        onPlace={() => {
                          const daily = dailyFromBillFields(bill);
                          const sized = daily ? quickSize({ kwhPerDay: daily }) : null;
                          const lead = opening.kind === "advice" ? opening.advice.lead : "battery";
                          const kw = sized ? (lead === "battery" ? sized.withBattery.kw : sized.solar.kw) : 6.6;
                          startTapFill(Math.ceil((kw * 1000) / (panelOf(design).watts || 475)));
                        }}
                        onClose={() => setOpening(null)}
                      />
                    )
                  )}
                </div>
              )}
              {commandOpen && !props.tight && (
                <div
                  className={clsx(
                    "absolute left-1/2 z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2",
                    // In the pop-up it rises from Ask Sol at the foot (8 Nov 2026, Martin), his answer above the box.
                    props.tight
                      ? "bottom-[5.75rem] flex flex-col-reverse gap-2 transition duration-200 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none [&>p]:mt-0"
                      : "top-[4.5rem]",
                  )}
                  data-popup
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendCommand(commandText);
                    }}
                    className={clsx(GLASS, "flex items-center gap-2 p-1.5 pl-3")}
                  >
                    <SolIcon className="size-5 shrink-0" />
                    <input
                      ref={commandBox}
                      value={commandText}
                      onChange={(e) => setCommandText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setCommandOpen(false);
                          setCommandReply(null);
                        }
                      }}
                      placeholder="Fit 8 kW on the north face · use the Sigenergy battery · why is string B failing?"
                      aria-label="Tell Sol what to change in the design"
                      className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                    />
                    <DictateButton
                      onWords={(words) => void sendCommand(words)}
                      onHearing={(words) => setCommandText(words)}
                      label="Say it"
                    />
                    <button
                      type="submit"
                      disabled={commandBusy || !commandText.trim()}
                      className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
                    >
                      {commandBusy ? "…" : "Go"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCommandOpen(false);
                        setCommandReply(null);
                      }}
                      aria-label="Close"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </form>
                  {commandBusy && asked && (
                    <div className={clsx(GLASS, "mt-2 flex flex-col gap-1.5 px-4 py-2.5")}>
                      <p className="text-sm text-ink-2">{asked}</p>
                      <SolThinking />
                    </div>
                  )}
                  {commandReply && (
                    <div className={clsx(GLASS, "mt-2 px-4 py-2.5 text-sm text-ink")} role="status">
                      <p>
                        {commandReply}
                        {systemWords && ` ${systemWords}`}
                      </p>
                      {roofCheckNow && hasSolar(roofCheckNow.things) && (
                        <button
                          type="button"
                          disabled={commandBusy}
                          onClick={() => void answerExisting(!replacing)}
                          className="mt-2 rounded-full px-3 py-1 text-[12.5px] font-medium ring-1 ring-line hover:bg-surface-2"
                        >
                          {replacing ? "Keep clear of the existing panels" : "The existing panels are being replaced: use their roof"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {choices && !commandOpen && (
                <div
                  className={clsx(
                    "absolute left-1/2 z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-[0_18px_50px_rgba(11,11,12,0.25)] ring-1 ring-line",
                    props.tight ? "bottom-[5.75rem]" : "top-[4.5rem]",
                  )}
                  role="dialog"
                  aria-label={choices.question}
                  data-popup
                >
                  <div className="flex items-start gap-3 px-5 pb-3 pt-4">
                    <SolIcon className="mt-0.5 size-5 shrink-0" />
                    <p className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{choices.question}</p>
                    <button
                      type="button"
                      onClick={() => setChoices(null)}
                      aria-label="Close"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <ul className="border-t border-line">
                    {choices.options.map((o, i) => (
                      <li key={i} className="border-b border-line">
                        <button
                          type="button"
                          onClick={() => void sendCommand(o.request)}
                          disabled={commandBusy}
                          className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-surface-2 disabled:opacity-60"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold tabular-nums text-ink-2">
                            {i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold text-ink">{o.label}</span>
                            {o.detail && <span className="block text-sm text-muted">{o.detail}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (otherText.trim()) void sendCommand(otherText);
                    }}
                    className="flex items-center gap-3 bg-surface-2 px-5 py-2.5"
                  >
                    <PenTool className="size-4 shrink-0 text-sun-line" aria-hidden />
                    <input
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder="Something else"
                      aria-label="Something else"
                      className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                    />
                    {otherText.trim() ? (
                      <button type="submit" className="text-sm font-semibold text-ink hover:text-sun-ink">
                        Go
                      </button>
                    ) : (
                      <button type="button" onClick={() => setChoices(null)} className="text-sm font-medium text-ink-2 hover:text-ink">
                        Skip
                      </button>
                    )}
                  </form>
                </div>
              )}
              {confirmDelete !== null && !commandOpen && (
                <div
                  className={clsx(
                    "absolute left-1/2 z-50 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-primary px-5 pb-4 pt-4 text-white shadow-[0_18px_50px_rgba(11,11,12,0.4)] ring-1 ring-white/10",
                    props.tight ? "bottom-[5.75rem]" : "top-[4.5rem]",
                  )}
                  role="alertdialog"
                  aria-label="Delete this design?"
                  data-popup
                >
                  <div className="flex items-start gap-3">
                    <SolIcon className="mt-0.5 size-5 shrink-0 text-sun-line" />
                    <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
                      {deleteQuestion(confirmDelete + 1, everyDesign()[confirmDelete]?.label)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelDelete}
                      autoFocus
                      className="h-9 rounded-full px-4 text-sm font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                    >
                      No, keep it
                    </button>
                    <button
                      type="button"
                      onClick={deleteConfirmed}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger px-4 text-sm font-semibold text-white hover:brightness-110"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Yes, delete Design {confirmDelete + 1}
                    </button>
                  </div>
                </div>
              )}
              {commandReply && !commandOpen && !props.tight && (
                <div
                  className={clsx(
                    GLASS,
                    "absolute bottom-24 left-1/2 z-40 flex w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 items-start gap-2.5 px-4 py-2.5",
                  )}
                  role="status"
                >
                  <SolIcon className="mt-0.5 size-4 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm text-ink">
                    {commandReply}
                    {systemWords && ` ${systemWords}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCommandReply(null)}
                    aria-label="Close"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              )}
              {wheelHint && (
                <p
                  role="status"
                  className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 px-4 py-2 text-sm font-medium text-white shadow-lg"
                >
                  Hold Ctrl (⌘ on a Mac) and scroll to zoom
                </p>
              )}
              <div className="overflow-hidden rounded-lg bg-surface-2">
                <svg
                  ref={svg}
                  viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                  className={clsx(
                    "block w-full touch-none select-none",
                    tool === "pan" ? "cursor-grab" : tool === "select" || onPanel ? "cursor-default" : "cursor-crosshair",
                  )}
                  onContextMenu={(e) => {
                    // A right click opens the tools here, where the pointer is. On a panel not already picked it picks
                    // it, so the menu's first items turn it round.
                    e.preventDefault();
                    const at = pointAt(e);
                    const hit = at ? hitAt(at) : null;
                    if (hit && hit.pick.kind !== "label" && !hit.empty && !isPicked(hit.pick)) setPicks([hit.pick]);
                    const box = e.currentTarget.getBoundingClientRect();
                    setToolMenu({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onPointerLeave={() => {
                    pointer.current = null;
                    setHover(null);
                    setKit(null);
                    if (!press.current) setGhosts([]);
                  }}
                  role="img"
                  aria-label={`The roof at ${props.address} from above, with ${summary.panels} panels placed`}
                >
                  {props.image && !drawn && !art && <image href={props.image} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
                  {/* The Drawn view: the roof as an illustration, its surroundings a dim ghost of the photo. */}
                  {art && !drawn && (
                    <RoofArt
                      faces={artFaces}
                      ghost={ghost}
                      width={ROOF_IMAGE.width}
                      height={ROOF_IMAGE.height}
                      u={u}
                      perMetre={1 / scale}
                    />
                  )}
                  {/* Drawing mode: plain ground, and the roof's faces drawn on it, each a grey of its own by the way it
                      faces. Google's faces (where there is roof data) go underneath; the faces traced here, which are
                      exact, go over them. */}
                  {drawn && (
                    <g pointerEvents="none">
                      <rect width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} fill="#4c6b45" />
                      {/* The ground as read from the photo: lawn, the darker green of trees, and paving (drives, paths, the
                          road), softened so it reads as plain shapes. */}
                      {measured === "there" ? (
                        <image href={measuredUrl} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />
                      ) : (
                        ground && (
                          <image href={ground} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} style={{ filter: "blur(1.2px)" }} />
                        )
                      )}
                      {/* The roof being designed, always lighter than everything around it and edged in white, so it stands
                          out: the faces traced here (exact); or, until some are traced, Google's faces for the home. */}
                      {faces.length === 0 &&
                        Array.isArray(modelFaces) &&
                        modelFaces.map((face, i) => (
                          <polygon
                            key={i}
                            points={path(face.points)}
                            fill={faceShade(face.azimuth, face.pitch, OWN_ROOF_LIFT)}
                            stroke="#ffffff"
                            strokeWidth={1.2 * u}
                            strokeLinejoin="round"
                          />
                        ))}
                      {faces.map((face) => (
                        <polygon
                          key={face.id}
                          points={path(face.points)}
                          fill={faceShade(faceFacing(face), face.tilt ?? TILT.roof, OWN_ROOF_LIFT)}
                          stroke="#ffffff"
                          strokeWidth={1.4 * u}
                          strokeLinejoin="round"
                        />
                      ))}
                    </g>
                  )}
                  {faces.map((f) => {
                    const on = f.id === selected;
                    const off = new Set(f.off);
                    return (
                      <g key={f.id}>
                        <polygon
                          points={path(f.points)}
                          fill="#ffffff"
                          fillOpacity={on ? 0.08 : 0.03}
                          stroke={on ? GOLD : severalRoofs ? roofEdge(f) : "#ffffff"}
                          strokeOpacity={on ? 1 : severalRoofs ? 0.9 : 0.55}
                          strokeWidth={(on ? 1.4 : severalRoofs ? 1.3 : 1) * u}
                        />
                        {panelPlaces(f, size).map((panel) => {
                          // A place whose panel was taken out or moved away is simply empty roof: nothing is drawn there.
                          if (off.has(panel.index)) return null;
                          const pick: Pick = { kind: "grid", face: f.id, index: panel.index };
                          const lit = isPicked(pick);
                          const wired = stringOf(keyOf(pick));
                          if (art)
                            return (
                              <PanelArt
                                key={panel.index}
                                corners={panel.corners.map(px)}
                                u={u}
                                cells={summary.panels <= CELLS_UP_TO}
                                {...(wired >= 0 ? { fill: STRING_COLOURS[wired % STRING_COLOURS.length] } : {})}
                                {...(lit
                                  ? { edge: GOLD, edgeWidth: 1 }
                                  : severalRoofs && wired < 0
                                    ? { edge: roofEdge(f), edgeWidth: 0.8 }
                                    : {})}
                              />
                            );
                          return (
                            <g key={panel.index}>
                              <polygon
                                points={path(panel.corners)}
                                fill={wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#0d1219"}
                                fillOpacity={wired >= 0 ? 0.72 : 0.9}
                                stroke={
                                  lit
                                    ? GOLD
                                    : wired >= 0
                                      ? STRING_COLOURS[wired % STRING_COLOURS.length]
                                      : severalRoofs
                                        ? roofEdge(f)
                                        : "#93a0b1"
                                }
                                strokeWidth={(lit ? 0.9 : severalRoofs && wired < 0 ? 0.8 : 0.5) * u}
                              />
                              {aspect(
                                middle(panel.corners),
                                faceFacing(f),
                                f.tilt ?? TILT.roof,
                                wired >= 0 ? "#0b0c0e" : lit ? GOLD : "#93a0b1",
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                  {/* Panels placed by hand, on top. */}
                  {loose.map((panel) => {
                    const pick: Pick = { kind: "loose", id: panel.id };
                    const lit = isPicked(pick);
                    const wired = stringOf(keyOf(pick));
                    if (art)
                      return (
                        <PanelArt
                          key={panel.id}
                          corners={looseCorners(panel, size).map(px)}
                          u={u}
                          cells={summary.panels <= CELLS_UP_TO}
                          {...(wired >= 0 ? { fill: STRING_COLOURS[wired % STRING_COLOURS.length] } : {})}
                          {...(lit
                            ? { edge: GOLD, edgeWidth: 1 }
                            : severalRoofs && wired < 0
                              ? { edge: roofEdge(panel), edgeWidth: 0.8 }
                              : {})}
                        />
                      );
                    return (
                      <g key={panel.id}>
                        <polygon
                          points={path(looseCorners(panel, size))}
                          fill={wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#0d1219"}
                          fillOpacity={wired >= 0 ? 0.72 : 0.9}
                          stroke={
                            lit
                              ? GOLD
                              : wired >= 0
                                ? STRING_COLOURS[wired % STRING_COLOURS.length]
                                : severalRoofs
                                  ? roofEdge(panel)
                                  : "#93a0b1"
                          }
                          strokeWidth={(lit ? 0.9 : severalRoofs && wired < 0 ? 0.8 : 0.5) * u}
                        />
                        {aspect(panel, panelFacing(panel), panel.tilt ?? TILT.roof, wired >= 0 ? "#0b0c0e" : lit ? GOLD : "#93a0b1")}
                      </g>
                    );
                  })}
                  {/* The home's day: night, each panel lit as the sun reaches it, and the sun on its arc. */}
                  {homeDay.day && homeDay.step && (
                    <DayOverlay
                      day={homeDay.day}
                      step={homeDay.step}
                      panels={standingPanels.map((p) => p.corners.map(px))}
                      view={view}
                      u={u}
                    />
                  )}
                  {/* Guide lines, at rest: thin gold lines along the roof edges they were drawn on. */}
                  {!guide &&
                    rules.map((g) => (
                      <line
                        key={g.id}
                        x1={px(g.a)[0]}
                        y1={px(g.a)[1]}
                        x2={px(g.b)[0]}
                        y2={px(g.b)[1]}
                        stroke={GOLD}
                        strokeWidth={1.1 * u}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    ))}
                  {ruling && (
                    <g pointerEvents="none">
                      <line
                        x1={px(ruling.a)[0]}
                        y1={px(ruling.a)[1]}
                        x2={px(ruling.b)[0]}
                        y2={px(ruling.b)[1]}
                        stroke="#ffffff"
                        strokeWidth={1.4 * u}
                        strokeDasharray={`${4 * u} ${3 * u}`}
                      />
                      <circle cx={px(ruling.a)[0]} cy={px(ruling.a)[1]} r={3 * u} fill={GOLD} stroke="#0b0c0e" strokeWidth={u} />
                      <text
                        x={px(ruling.b)[0] + 8 * u}
                        y={px(ruling.b)[1] - 6 * u}
                        fontSize={7.5 * u}
                        fontWeight="700"
                        fill="#ffffff"
                        stroke="#0b0c0e"
                        strokeWidth={2.2 * u}
                        paintOrder="stroke"
                      >
                        {Math.hypot(ruling.b.x - ruling.a.x, ruling.b.y - ruling.a.y).toFixed(2)} m
                      </text>
                    </g>
                  )}
                  {/* The roof's outline, lit while panels are being placed or lined up, with the distance to each edge of the face they are on. */}
                  {guide && (
                    <g pointerEvents="none">
                      {rules.map((g) => (
                        <line
                          key={g.id}
                          x1={px(g.a)[0]}
                          y1={px(g.a)[1]}
                          x2={px(g.b)[0]}
                          y2={px(g.b)[1]}
                          stroke={GOLD}
                          strokeWidth={2.4 * u}
                          strokeLinecap="round"
                          style={{ filter: `drop-shadow(0 0 ${3 * u}px rgba(230, 184, 74, 0.95))` }}
                        />
                      ))}
                      {faces.map((f) => (
                        <polygon
                          key={f.id}
                          points={path(f.points)}
                          fill="none"
                          stroke={GOLD}
                          strokeWidth={2.4 * u}
                          strokeLinejoin="round"
                          style={{ filter: `drop-shadow(0 0 ${3 * u}px rgba(230, 184, 74, 0.95))` }}
                        />
                      ))}
                      {measures.map((m, i) => {
                        const [x1, y1] = px(m.from);
                        const [x2, y2] = px(m.to);
                        return (
                          <g key={i}>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#ffffff"
                              strokeWidth={0.7 * u}
                              strokeDasharray={`${2 * u} ${1.5 * u}`}
                            />
                            <text
                              x={Math.hypot(x2 - x1, y2 - y1) > 34 * u ? (x1 + x2) / 2 : x2 + m.way.x * 17 * u}
                              y={(Math.hypot(x2 - x1, y2 - y1) > 34 * u ? (y1 + y2) / 2 : y2 + m.way.y * 9 * u) + 2.5 * u}
                              textAnchor="middle"
                              fontSize={7.5 * u}
                              fontWeight="700"
                              fill="#ffffff"
                              stroke="#0b0c0e"
                              strokeWidth={2.2 * u}
                              paintOrder="stroke"
                            >
                              {m.gap.toFixed(2)} m
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                  {/* The strings: a line from panel to panel in wiring order, numbered at its first panel. */}
                  {strings.map((s, i) => {
                    const points = s.panels.map((k) => centres[k]).filter(Boolean);
                    if (!points.length) return null;
                    const colour = STRING_COLOURS[i % STRING_COLOURS.length];
                    const [sx, sy] = px(points[0]);
                    return (
                      <g key={s.id} pointerEvents="none">
                        <polyline
                          points={path(points)}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={(s.id === hover ? 2.2 : 1.3) * u}
                          strokeLinejoin="round"
                          opacity={s.id === wiring || s.id === hover || tool !== "string" ? 1 : 0.6}
                        />
                        {/* The Drawn view: power moving along the string, towards its first panel and the inverter. */}
                        {art && points.length > 1 && <FlowLine points={path([...points].reverse())} u={u} />}
                        {points.map((p, n) => (
                          <circle key={n} cx={px(p)[0]} cy={px(p)[1]} r={1.6 * u} fill="#ffffff" />
                        ))}
                        <circle cx={sx} cy={sy} r={5.5 * u} fill={colour} stroke="#0b0c0e" strokeWidth={0.8 * u} />
                        <text x={sx} y={sy + 2.4 * u} textAnchor="middle" fontSize={6.5 * u} fontWeight="700" fill="#0b0c0e">
                          {letter(i)}
                        </text>
                      </g>
                    );
                  })}
                  {/* Panels on a string: their arrows again, over the wiring line, so the way each faces still shows. */}
                  {strings.length > 0 && (
                    <g>
                      {faces.flatMap((f) =>
                        panelPlaces(f, size)
                          .filter((place) => !f.off.includes(place.index) && stringOf(`g:${f.id}:${place.index}`) >= 0)
                          .map((place) => (
                            <g key={`${f.id}:${place.index}`}>
                              {aspect(middle(place.corners), faceFacing(f), f.tilt ?? TILT.roof, "#0b0c0e", 1.5)}
                            </g>
                          )),
                      )}
                      {loose
                        .filter((panel) => stringOf(`l:${panel.id}`) >= 0)
                        .map((panel) => (
                          <g key={panel.id}>{aspect(panel, panelFacing(panel), panel.tilt ?? TILT.roof, "#0b0c0e", 1.5)}</g>
                        ))}
                    </g>
                  )}
                  {/* The discussion: a speech bubble at each spot, with how many things have been said. */}
                  {[
                    ...comments,
                    ...(thread && "at" in thread ? [{ id: "new", x: thread.at.x, y: thread.at.y, resolved: false, notes: [] }] : []),
                  ].map((c) => {
                    const [bx, by] = px(c);
                    const open = thread && "id" in thread ? thread.id === c.id : c.id === "new";
                    return (
                      <g key={c.id} opacity={c.resolved && !open ? 0.45 : 1}>
                        <path
                          d={`M${bx},${by} l${3 * u},${-5 * u} h${7 * u} a${3 * u},${3 * u} 0 0 0 ${3 * u},${-3 * u} v${-8 * u} a${3 * u},${3 * u} 0 0 0 ${-3 * u},${-3 * u} h${-16 * u} a${3 * u},${3 * u} 0 0 0 ${-3 * u},${3 * u} v${8 * u} a${3 * u},${3 * u} 0 0 0 ${3 * u},${3 * u} h${3 * u} z`}
                          fill={open ? "#ffffff" : GOLD}
                          stroke="#0b0c0e"
                          strokeWidth={0.9 * u}
                        />
                        <text x={bx + 2 * u} y={by - 9.5 * u} textAnchor="middle" fontSize={8 * u} fontWeight="700" fill="#0b0c0e">
                          {c.id === "new" ? "+" : c.resolved ? "✓" : c.notes.length}
                        </text>
                      </g>
                    );
                  })}
                  {/* The main switchboard: a board of breakers in the same line style as the inverter and battery, marked MSB. */}
                  {msb &&
                    (() => {
                      const [mx, my] = px(msb);
                      const w = 22 * ku;
                      const h = 26 * ku;
                      return (
                        <g pointerEvents="none">
                          <rect
                            x={mx - w / 2}
                            y={my - h / 2}
                            width={w}
                            height={h}
                            rx={3 * ku}
                            fill="#0b0c0e"
                            fillOpacity="0.92"
                            stroke={GOLD}
                            strokeWidth={1.1 * ku}
                          />
                          {[0, 1].map((row) =>
                            Array.from({ length: 4 }, (_, k) => (
                              <rect
                                key={`${row}-${k}`}
                                x={mx - w / 2 + 3.2 * ku + k * 4.2 * ku}
                                y={my - h / 2 + 4 * ku + row * 9 * ku}
                                width={2.6 * ku}
                                height={6 * ku}
                                rx={0.6 * ku}
                                fill="none"
                                stroke="#ffffff"
                                strokeOpacity="0.7"
                                strokeWidth={0.6 * ku}
                              />
                            )),
                          )}
                          <line
                            x1={mx - w / 2 + 3 * ku}
                            x2={mx + w / 2 - 3 * ku}
                            y1={my + h / 2 - 4 * ku}
                            y2={my + h / 2 - 4 * ku}
                            stroke={GOLD}
                            strokeWidth={1 * ku}
                          />
                          <text
                            x={mx}
                            y={my + h / 2 + 11 * ku}
                            textAnchor="middle"
                            fontSize={8 * ku}
                            fontWeight="700"
                            fill="#ffffff"
                            stroke="#0b0c0e"
                            strokeWidth={2.4 * ku}
                            paintOrder="stroke"
                          >
                            MSB
                          </text>
                        </g>
                      );
                    })()}
                  {/* The battery: a stack of its modules lit from the bottom up as far as the panels fill it on an average day
                      (10 Nov 2026, Martin: no line from the panels; too few panels for the home and it isn't filled). */}
                  {battery &&
                    (() => {
                      const [bx, by] = px(battery);
                      const layers = batteryLayers;
                      const w = 24 * ku;
                      const lh = 8 * ku;
                      const top = by - (layers * lh) / 2;
                      const fill = batteryFill({
                        solarDayKwh: Number(summary.kwhPerDay) || 0,
                        homeDayKwh: finance?.dailyKwh ?? null,
                        batteryKwh: battery.kwh * battery.qty,
                        backupKwh: battery.backup ? battery.kwh : 0,
                      });
                      const share = fill?.share ?? 0;
                      // The bars lit, counted from the bottom: seven a module.
                      const lit = Math.round(share * layers * 7);
                      return (
                        <g pointerEvents="none">
                          <circle cx={bx} cy={by} r={20 * ku} fill={GOLD}>
                            <animate attributeName="r" values={`${17 * ku};${27 * ku};${17 * ku}`} dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.26;0.04;0.26" dur="3s" repeatCount="indefinite" />
                          </circle>
                          <rect x={bx - 4.5 * ku} y={top - 7 * ku} width={9 * ku} height={3 * ku} rx={ku} fill={GOLD} />
                          <rect
                            x={bx - w / 2 - 3 * ku}
                            y={top - 4 * ku}
                            width={w + 6 * ku}
                            height={layers * lh + 8 * ku}
                            rx={3.5 * ku}
                            fill="#0b0c0e"
                            fillOpacity="0.92"
                            stroke={GOLD}
                            strokeWidth={1.1 * ku}
                          />
                          {Array.from({ length: layers }, (_, i) => {
                            // Counted from the bottom, so the charge climbs.
                            const y = top + (layers - 1 - i) * lh;
                            return (
                              <g key={i}>
                                <rect
                                  x={bx - w / 2}
                                  y={y + 0.7 * ku}
                                  width={w}
                                  height={lh - 1.4 * ku}
                                  rx={1.2 * ku}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeOpacity="0.45"
                                  strokeWidth={0.5 * ku}
                                />
                                {Array.from({ length: 7 }, (_, k) => (
                                  <line
                                    key={k}
                                    x1={bx - w / 2 + 2.7 * ku + k * 3.1 * ku}
                                    x2={bx - w / 2 + 2.7 * ku + k * 3.1 * ku}
                                    y1={y + 1.7 * ku}
                                    y2={y + lh - 1.7 * ku}
                                    stroke={GOLD}
                                    strokeWidth={0.9 * ku}
                                    opacity={i * 7 + k < lit ? 1 : 0.15}
                                    style={{ transition: "opacity 300ms ease-out" }}
                                  />
                                ))}
                              </g>
                            );
                          })}
                          <text
                            x={bx}
                            y={top + layers * lh + 13 * ku}
                            textAnchor="middle"
                            fontSize={8 * ku}
                            fontWeight="700"
                            fill="#ffffff"
                            stroke="#0b0c0e"
                            strokeWidth={2.4 * ku}
                            paintOrder="stroke"
                          >
                            {batteryKwh} kWh{fill && fill.share < 1 ? ` · ${Math.round(fill.share * 100)}%` : ""}
                          </text>
                        </g>
                      );
                    })()}
                  {/* The inverters: a box each, in the same line style as the battery, to be dragged to the wall it will go on. */}
                  {fitted.map((spec, n) => {
                    const [ix, iy] = px(inverterSpot(spec, n, spot.lat));
                    const w = 20 * ku;
                    const h = 28 * ku;
                    const lit = kit === n;
                    return (
                      <g key={n} pointerEvents="none">
                        <rect
                          x={ix - w / 2}
                          y={iy - h / 2}
                          width={w}
                          height={h}
                          rx={3 * ku}
                          fill="#0b0c0e"
                          fillOpacity="0.92"
                          stroke={GOLD}
                          strokeWidth={(lit ? 1.8 : 1.1) * ku}
                        />
                        <rect
                          x={ix - w / 2 + 3 * ku}
                          y={iy - h / 2 + 3.5 * ku}
                          width={w - 6 * ku}
                          height={6 * ku}
                          rx={1.2 * ku}
                          fill="none"
                          stroke="#ffffff"
                          strokeOpacity="0.6"
                          strokeWidth={0.5 * ku}
                        />
                        <path
                          d={`M${ix - w / 2 + 4.5 * ku},${iy - h / 2 + 8 * ku} q${2.7 * ku},${-0.3 * ku} ${4 * ku},${-2 * ku} t${3.6 * ku},${-1 * ku} t${3.4 * ku},${2.4 * ku}`}
                          fill="none"
                          stroke={GOLD}
                          strokeWidth={0.6 * ku}
                        />
                        {Array.from({ length: 6 }, (_, k) => (
                          <line
                            key={k}
                            x1={ix - w / 2 + 3.75 * ku + k * 2.5 * ku}
                            x2={ix - w / 2 + 3.75 * ku + k * 2.5 * ku}
                            y1={iy - h / 2 + 12.5 * ku}
                            y2={iy + h / 2 - 6 * ku}
                            stroke="#ffffff"
                            strokeOpacity="0.32"
                            strokeWidth={0.5 * ku}
                          />
                        ))}
                        <circle cx={ix} cy={iy + h / 2 - 3.2 * ku} r={1.1 * ku} fill={GOLD}>
                          <animate attributeName="opacity" values="1;0.3;1" dur="2.6s" repeatCount="indefinite" />
                        </circle>
                        <text
                          x={ix}
                          y={iy + h / 2 + 9 * ku}
                          textAnchor="middle"
                          fontSize={8 * ku}
                          fontWeight="700"
                          fill="#ffffff"
                          stroke="#0b0c0e"
                          strokeWidth={2.4 * ku}
                          paintOrder="stroke"
                        >
                          {fitted.length > 1 ? `${n + 1} · ` : ""}
                          {spec.kw} kW
                        </text>
                      </g>
                    );
                  })}
                  {/* The EV charger: a small wall box with a bolt, in the same line style as the inverter, dragged to its wall. */}
                  {charger &&
                    (() => {
                      const [cx, cy] = px(charger);
                      const w = 16 * ku;
                      const h = 20 * ku;
                      return (
                        <g pointerEvents="none">
                          <rect
                            x={cx - w / 2}
                            y={cy - h / 2}
                            width={w}
                            height={h}
                            rx={4 * ku}
                            fill="#0b0c0e"
                            fillOpacity="0.92"
                            stroke={GOLD}
                            strokeWidth={1.1 * ku}
                          />
                          <path
                            d={`M${cx + 1.4 * ku},${cy - 6 * ku} L${cx - 3.4 * ku},${cy + 0.8 * ku} H${cx} L${cx - 1.4 * ku},${cy + 6 * ku} L${cx + 3.4 * ku},${cy - 0.8 * ku} H${cx} Z`}
                            fill={GOLD}
                          />
                          <text
                            x={cx}
                            y={cy + h / 2 + 9 * ku}
                            textAnchor="middle"
                            fontSize={8 * ku}
                            fontWeight="700"
                            fill="#ffffff"
                            stroke="#0b0c0e"
                            strokeWidth={2.4 * ku}
                            paintOrder="stroke"
                          >
                            EV {charger.kw} kW
                          </text>
                        </g>
                      );
                    })()}
                  {/* What was found on the roof and kept clear of: a dashed box each, named, never picked or moved. */}
                  {roofCheckNow?.things.map((t, i) => {
                    const pts = t.box.map(px);
                    const [lx, ly] = pts[0];
                    const going = replacing && t.type === "existing panels";
                    return (
                      <g key={`found-${i}`} className={clsx("pointer-events-none", going && "opacity-45")}>
                        <polygon
                          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                          className="fill-warning/10 stroke-warning"
                          strokeWidth={1.2 * u}
                          strokeDasharray={`${4 * u} ${3 * u}`}
                        />
                        <text x={lx + 2 * u} y={ly - 2.5 * u} className="fill-warning" fontSize={7 * u} fontWeight={600}>
                          {going ? "Being replaced" : thingLabel(t)}
                        </text>
                      </g>
                    );
                  })}
                  {/* Labels: a pin and its name. */}
                  {labels.map((l) => {
                    const [lx, ly] = px(l);
                    const lit = isPicked({ kind: "label", id: l.id });
                    const words = l.kind === "Note" ? l.text || "Note" : l.kind;
                    const width = (words.length * 4.4 + 10) * u;
                    return (
                      <g key={l.id}>
                        <circle cx={lx} cy={ly} r={3 * u} fill={GOLD} stroke="#0b0c0e" strokeWidth={0.8 * u} />
                        <rect
                          x={lx + 5 * u}
                          y={ly - 7 * u}
                          width={width}
                          height={14 * u}
                          rx={3 * u}
                          fill="#0b0c0e"
                          stroke={lit ? "#ffffff" : GOLD}
                          strokeWidth={(lit ? 1.4 : 0.8) * u}
                        />
                        <text x={lx + 10 * u} y={ly + 2.8 * u} fontSize={8 * u} fontWeight="600" fill="#ffffff">
                          {words}
                        </text>
                      </g>
                    );
                  })}
                  {tool === "trace" && tracing.length > 0 && (
                    <g>
                      <polyline
                        points={path(tracing)}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={1.4 * u}
                        strokeDasharray={`${4 * u} ${3 * u}`}
                      />
                      {tracing.map((p, i) => (
                        <circle
                          key={i}
                          cx={px(p)[0]}
                          cy={px(p)[1]}
                          r={(i === 0 ? 5 : 3) * u}
                          fill={i === 0 ? GOLD : "#ffffff"}
                          stroke="#0b0c0e"
                          strokeWidth={u}
                        />
                      ))}
                    </g>
                  )}
                  {/* The panel a click would place, as an outline. */}
                  {(tool === "panel" || tool === "select") &&
                    ghosts.map((ghost, i) => (
                      <g key={i} pointerEvents="none">
                        <polygon
                          points={path(looseCorners(ghost, size))}
                          fill="#ffffff"
                          fillOpacity="0.18"
                          stroke="#ffffff"
                          strokeWidth={u}
                          strokeDasharray={`${3 * u} ${2 * u}`}
                        />
                        {aspect(ghost, panelFacing(ghost), ghost.tilt ?? TILT.roof, "#ffffff")}
                        {/* The edge it shares with the panel it clicks against, lit. */}
                        {ghost.join && ghosts.length === 1 && (
                          <line
                            x1={px(ghost.join[0])[0]}
                            y1={px(ghost.join[0])[1]}
                            x2={px(ghost.join[1])[0]}
                            y2={px(ghost.join[1])[1]}
                            stroke="var(--sun-line)"
                            strokeWidth={2.5 * u}
                            strokeLinecap="round"
                          />
                        )}
                      </g>
                    ))}
                  {/* Shaded panels as they are laid, with the shade view closed: a tint, stronger the more shaded. */}
                  {shadeHints &&
                    standingPanels.map((p) => {
                      const at = shadeHints.keys.indexOf(p.key);
                      const access = at < 0 ? null : shadeHints.report.panels[at]?.access;
                      const tint = shadeHint(access);
                      if (tint === null || access === null || access === undefined) return null;
                      return (
                        <polygon
                          key={`hint-${p.key}`}
                          points={path(p.corners)}
                          fill={accessColour(access)}
                          fillOpacity={tint}
                          pointerEvents="none"
                        >
                          <title>{`About ${Math.round(access * 100)}% of the year's sun reaches it`}</title>
                        </polygon>
                      );
                    })}
                  {/* Shade analysis: each panel tinted by how open it is to the sun over a year, with the figure on it. */}
                  {shadeNow &&
                    standingPanels.map((p) => {
                      const at = shadeNow.keys.indexOf(p.key);
                      const access = at < 0 ? null : shadeNow.report.panels[at]?.access;
                      if (access === null || access === undefined) return null;
                      const [cx, cy] = px(p);
                      return (
                        <g key={p.key} pointerEvents="none">
                          <polygon
                            points={path(p.corners)}
                            fill={accessColour(access)}
                            fillOpacity="0.62"
                            stroke={accessColour(access)}
                            strokeWidth={0.8 * u}
                          />
                          <text x={cx} y={cy + 2.4 * u} fontSize={6.5 * u} fontWeight="700" fill="#0b0c0e" textAnchor="middle">
                            {Math.round(access * 100)}
                          </text>
                        </g>
                      );
                    })}
                  {/* The arrays list is open: each array carries its number and its size. */}
                  {arrayList.map((a, i) => {
                    const [x, y] = px(a.at);
                    const words = `${i + 1} · ${a.kw.toFixed(2)} kW`;
                    const w = (words.length * 4.6 + 10) * u;
                    return (
                      <g key={i} pointerEvents="none">
                        <rect
                          x={x - w / 2}
                          y={y - 17 * u}
                          width={w}
                          height={13 * u}
                          rx={6.5 * u}
                          fill="#0b0c0e"
                          stroke={GOLD}
                          strokeWidth={u}
                        />
                        <text x={x} y={y - 7.8 * u} fontSize={7.5 * u} fontWeight="600" fill="#ffffff" textAnchor="middle">
                          {words}
                        </text>
                      </g>
                    );
                  })}
                  {/* The pointer is on an array: a small round beside it picks every panel in it. */}
                  {arrayHint && (tool === "select" || tool === "panel") && !arrayHint.picks.every(isPicked) && (
                    <g className="cursor-pointer">
                      <title>{`Select all ${arrayHint.picks.length} panels in this array`}</title>
                      <circle
                        cx={px(arrayHint.at)[0]}
                        cy={px(arrayHint.at)[1]}
                        r={6.5 * u}
                        fill={GOLD}
                        stroke="#ffffff"
                        strokeWidth={1.4 * u}
                      />
                      {[
                        [-1, -1],
                        [1, -1],
                        [-1, 1],
                        [1, 1],
                      ].map(([i, j]) => (
                        <rect
                          key={`${i}${j}`}
                          x={px(arrayHint.at)[0] + i * 1.7 * u - 1.3 * u}
                          y={px(arrayHint.at)[1] + j * 1.7 * u - 1.3 * u}
                          width={2.6 * u}
                          height={2.6 * u}
                          rx={0.5 * u}
                          fill="#ffffff"
                        />
                      ))}
                    </g>
                  )}
                  {/* Several panels picked: one handle to spin them all about the middle of the group. */}
                  {spinGroup && (
                    <g pointerEvents="none">
                      <line
                        x1={px(spinGroup.centre)[0]}
                        y1={px(spinGroup.centre)[1]}
                        x2={px(spinGroup.turn)[0]}
                        y2={px(spinGroup.turn)[1]}
                        stroke="#ffffff"
                        strokeWidth={0.8 * u}
                        strokeDasharray={`${3 * u} ${2 * u}`}
                      />
                      <circle
                        cx={px(spinGroup.centre)[0]}
                        cy={px(spinGroup.centre)[1]}
                        r={2.4 * u}
                        fill="#ffffff"
                        stroke="#0b0c0e"
                        strokeWidth={u}
                      />
                      <circle
                        cx={px(spinGroup.turn)[0]}
                        cy={px(spinGroup.turn)[1]}
                        r={8.5 * u}
                        fill="#ffffff"
                        stroke={GOLD}
                        strokeWidth={1.6 * u}
                      />
                      <path
                        d={`M${px(spinGroup.turn)[0] - 4.2 * u},${px(spinGroup.turn)[1]} a${4.2 * u},${4.2 * u} 0 1 1 ${4.2 * u},${4.2 * u}`}
                        fill="none"
                        stroke="#0b0c0e"
                        strokeWidth={1.5 * u}
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                  {/* One panel picked: a grip in its middle to drag it by, and a handle above it to turn it with. */}
                  {grip && (
                    <g pointerEvents="none">
                      <line
                        x1={px(grip.panel)[0]}
                        y1={px(grip.panel)[1]}
                        x2={px(grip.turn)[0]}
                        y2={px(grip.turn)[1]}
                        stroke="#ffffff"
                        strokeWidth={0.8 * u}
                      />
                      <circle cx={px(grip.turn)[0]} cy={px(grip.turn)[1]} r={6.5 * u} fill="#ffffff" stroke={GOLD} strokeWidth={1.4 * u} />
                      <path
                        d={`M${px(grip.turn)[0] - 3.2 * u},${px(grip.turn)[1]} a${3.2 * u},${3.2 * u} 0 1 1 ${3.2 * u},${3.2 * u}`}
                        fill="none"
                        stroke="#0b0c0e"
                        strokeWidth={1.3 * u}
                        strokeLinecap="round"
                      />
                      <circle cx={px(grip.panel)[0]} cy={px(grip.panel)[1]} r={3.2 * u} fill={GOLD} stroke="#0b0c0e" strokeWidth={u} />
                      {[0, 90, 180, 270].map((d) => (
                        <line
                          key={d}
                          x1={px(grip.panel)[0]}
                          y1={px(grip.panel)[1] - 4.5 * u}
                          x2={px(grip.panel)[0]}
                          y2={px(grip.panel)[1] - 7.5 * u}
                          stroke="#ffffff"
                          strokeWidth={1.2 * u}
                          strokeLinecap="round"
                          transform={`rotate(${d} ${px(grip.panel)[0]} ${px(grip.panel)[1]})`}
                        />
                      ))}
                    </g>
                  )}
                  {band && (
                    <rect
                      x={Math.min(px(band.a)[0], px(band.b)[0])}
                      y={Math.min(px(band.a)[1], px(band.b)[1])}
                      width={Math.abs(px(band.a)[0] - px(band.b)[0])}
                      height={Math.abs(px(band.a)[1] - px(band.b)[1])}
                      fill="#ffffff"
                      fillOpacity="0.12"
                      stroke="#ffffff"
                      strokeWidth={u}
                      strokeDasharray={`${4 * u} ${3 * u}`}
                    />
                  )}
                  {/* A scale bar: five metres on the ground, however far in the view is. */}
                  <g transform={`translate(${view.x + 100 * u} ${view.y + view.h - 30 * u})`}>
                    <line x1="0" x2={5 / scale} y1="0" y2="0" stroke="#ffffff" strokeWidth={2 * u} />
                    <text x={5 / scale + 5 * u} y={3.5 * u} fill="#ffffff" fontSize={10 * u}>
                      5 m
                    </text>
                  </g>
                </svg>
              </div>

              {/* Which picture of the roof is under the design: Google's or a Nearmap capture (3 Nov 2026, as Primero's). */}
              {/* In the pop-up, Publish in the top right corner, and the picture's switch level with Ask Sol. */}
              {props.tight && publishControl && <div className="pointer-events-auto absolute right-4 top-4 z-30">{publishControl}</div>}
              <div
                className={clsx(
                  "pointer-events-auto absolute right-4 z-20 flex flex-col items-end gap-2",
                  props.tight ? "bottom-10" : "bottom-3",
                  // The day's bar takes the foot of the picture while it plays.
                  homeDay.on && "hidden",
                )}
              >
                <div className="flex items-center gap-2">
                  {/* The home's day: the design played through a day. */}
                  <button
                    onClick={() => (homeDay.on ? homeDay.close() : homeDay.open())}
                    aria-pressed={homeDay.on}
                    title="The home's day: the sun across the roof, and the home's power hour by hour"
                    className={clsx(
                      "flex h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold shadow-lift",
                      homeDay.on ? "bg-sun-line text-white" : "bg-surface text-ink hover:bg-canvas",
                    )}
                  >
                    <Sunrise className="size-4" aria-hidden />
                    Day
                  </button>
                  {/* Roof and Sides (10 Nov 2026, Martin: make Sides stand out; Drawn left this pair and lives in the
                      tools): the roof from above, and the house from its four sides in Nearmap's angled photos. */}
                  <div
                    role="group"
                    aria-label="The roof from above, or the house from its sides"
                    className="flex items-center rounded-full border border-line bg-surface p-1 text-[13px] font-semibold shadow-lift"
                  >
                    <button
                      onClick={() => illustrated && toggleIllustrated()}
                      aria-pressed={!illustrated}
                      title="The roof from above"
                      className={clsx(
                        "flex h-9 items-center gap-1.5 rounded-full px-3.5",
                        !illustrated ? "bg-sun-line text-white" : "text-ink hover:bg-canvas",
                      )}
                    >
                      <House className="size-4" aria-hidden />
                      Roof
                    </button>
                    {props.sidesReady && <SideViewsButton lat={spot.lat} lng={spot.lng} tab />}
                  </div>
                </div>
                {props.pictureMenu}
              </div>
              {/* The day's bar, along the foot of the picture like a player's: low, so the roof and the sun stay in view,
                  and clear of the round that moves the picture (bottom left). The other controls at the foot step aside. */}
              {homeDay.on && (
                <div className={clsx("pointer-events-none absolute left-[5.25rem] right-3 z-30", props.tight ? "bottom-7" : "bottom-3")}>
                  <HomeDayCard state={homeDay} hasBattery={battery !== undefined} hasHome={(finance?.dailyKwh ?? 0) > 0} />
                </div>
              )}
              {/* Drawn, with no face traced and none from Google: there is nothing to draw the roof from yet. */}
              {illustrated && !art && modelFaces === "none" && (
                <p className="pointer-events-none absolute bottom-20 right-3 z-10 w-64 rounded-lg border border-line bg-surface/90 px-3 py-2 text-[12px] text-ink-2 shadow-lift">
                  Trace the roof&apos;s faces, or use Design it for me, and the roof is drawn from them.
                </p>
              )}
              {/* The Drawn view's wall: the inverter, battery, switchboard and EV charger standing where they go. */}
              {art && (
                <div className="absolute bottom-[5.75rem] left-[4.5rem] z-10">
                  <WallStrip kit={wallKit} panels={summary.panels} />
                </div>
              )}

              {/* The roof's pitch (1 Nov 2026, Martin, as Primero's): until a person has set it for this home, a card asks for it
                  (so a flat roof isn't left at the 22 degree start); then it is a small roof-angle mark on the left edge that opens to change it. */}
              {quoteNow.form.pitchSet && (
                <RoofPitches
                  roofs={roofPitches}
                  flat={quoteNow.form.roof === "flat"}
                  active={roofInUse}
                  open={pitchOpen}
                  onOpen={setPitchOpen}
                  onActive={(i) => {
                    setActiveRoof(i);
                    setPitchOpen(false);
                    // Panels picked go to that roof's pitch.
                    if (panelPicks.length)
                      amend((panel) => {
                        const { roof: _was, ...rest } = panel;
                        return { ...rest, tilt: roofPitches[i], ...(i ? { roof: i } : {}) };
                      });
                  }}
                  onPitch={(i, pitch) =>
                    setQuote({
                      ...quoteNow,
                      form:
                        i === 0
                          ? { ...quoteNow.form, pitch, pitchSet: true }
                          : { ...quoteNow.form, pitches: roofPitches.slice(1).map((x, j) => (j === i - 1 ? pitch : x)) },
                    })
                  }
                  onAdd={() => {
                    setQuote({ ...quoteNow, form: { ...quoteNow.form, pitches: [...roofPitches.slice(1), homePitch] } });
                    setActiveRoof(roofPitches.length);
                    setPitchOpen(true);
                  }}
                  onRemove={(i) => {
                    setQuote({ ...quoteNow, form: { ...quoteNow.form, pitches: roofPitches.slice(1).filter((_, j) => j !== i - 1) } });
                    // What was on it goes back to roof 1; the roofs after it move down one.
                    setLoose((list) => list.map((panel) => roofAfterRemoving(panel, i)));
                    setFaces((list) => list.map((fc) => roofAfterRemoving(fc, i)));
                    setActiveRoof(0);
                    setPitchOpen(false);
                  }}
                  onNotFlat={() => setQuote({ ...quoteNow, form: { ...quoteNow.form, roof: "tile", pitchSet: true } })}
                  note={pitchNote?.at === spotKey ? pitchNote.words : null}
                  onNoteClose={() => setPitchNote(null)}
                  onRead={props.nearmapPicture ? () => void readPitchNow() : undefined}
                  reading={pitchReading}
                />
              )}
              {!quoteNow.form.pitchSet && (
                <PitchFirst
                  key={`${active}-${pitchGuess?.at === spotKey ? pitchGuess.read.pitch : ""}`}
                  pitch={pitchGuess?.at === spotKey && !pitchGuess.read.flat ? pitchGuess.read.pitch : (quoteNow.form.pitch ?? TILT.roof)}
                  hint={pitchGuess?.at === spotKey ? pitchGuess.words : null}
                  reading={pitchReading}
                  flat={quoteNow.form.roof === "flat"}
                  onSet={(pitch, roof) =>
                    setQuote({ ...quoteNow, form: { ...quoteNow.form, pitch, roof: roof ?? quoteNow.form.roof, pitchSet: true } })
                  }
                />
              )}

              {/* The tools, where the right click was. */}
              {toolMenu && (
                <>
                  <div
                    className="absolute inset-0 z-40"
                    onPointerDown={() => setToolMenu(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setToolMenu(null);
                    }}
                  />
                  <div
                    className="absolute z-50 w-56 overflow-hidden rounded-xl bg-surface p-1 text-sm text-ink shadow-[var(--shadow-lift)] ring-1 ring-line"
                    style={{ left: `min(${toolMenu.x}%, calc(100% - 14.5rem))`, top: `min(${toolMenu.y}%, calc(100% - 27rem))` }}
                    role="menu"
                    onKeyDown={(e) => e.key === "Escape" && setToolMenu(null)}
                  >
                    {/* First, with panels picked: turn them portrait or landscape. */}
                    {pickedPanels.length > 0 && (
                      <>
                        {([false, true] as const)
                          .filter((land) => !pickedPanels.every((p) => Boolean(p.across) === land))
                          .map((land) => (
                            <button
                              key={land ? "to-landscape" : "to-portrait"}
                              role="menuitem"
                              onClick={() => {
                                turnLandscape(land);
                                setToolMenu(null);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left font-semibold hover:bg-canvas"
                            >
                              <PanelGlyph across={land} />
                              {land ? "Make landscape" : "Make portrait"}
                              {pickedPanels.length > 1 && (
                                <span className="ml-auto text-xs font-normal text-muted">{pickedPanels.length}</span>
                              )}
                            </button>
                          ))}
                        <div className="mx-2 my-1 h-px bg-line" aria-hidden />
                      </>
                    )}
                    {TOOLS.filter((t) => t.tool === "select")
                      .concat(TOOLS.filter((t) => t.tool === "panel"))
                      .concat(TOOLS.filter((t) => t.tool !== "panel" && t.tool !== "select"))
                      .flatMap((def) => {
                        const Icon = def.icon;
                        const rows =
                          def.tool === "panel"
                            ? [
                                { label: "Add panels: portrait", land: false as boolean | undefined },
                                { label: "Add panels: landscape", land: true as boolean | undefined },
                              ]
                            : [{ label: def.name, land: undefined as boolean | undefined }];
                        return rows.map((row) => (
                          <button
                            key={row.label}
                            role="menuitem"
                            onClick={() => {
                              pickTool(def.tool);
                              if (row.land !== undefined) setAddLandscape(row.land);
                            }}
                            className={clsx(
                              "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left hover:bg-canvas",
                              tool === def.tool && (row.land === undefined || row.land === addLandscape) && "bg-surface-2 font-semibold",
                            )}
                          >
                            <Icon className="size-4 shrink-0" aria-hidden />
                            {row.label}
                          </button>
                        ));
                      })}
                    {/* On a Nearmap picture: the roof's outline in that capture, put down as a face to check. */}
                    {props.nearmapPicture && (
                      <>
                        <div className="mx-2 my-1 h-px bg-line" aria-hidden />
                        <button
                          role="menuitem"
                          onClick={() => void outlineFromNearmap()}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left hover:bg-canvas"
                        >
                          <PenTool className="size-4 shrink-0" aria-hidden />
                          Roof outline from Nearmap
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* The kit picked: a small bar over it saying what it is, with Remove (Delete does the same). */}
              {tool === "select" &&
                kitPick !== null &&
                (() => {
                  const inverter = typeof kitPick === "number" ? fitted[kitPick] : undefined;
                  const at =
                    kitPick === "battery"
                      ? battery
                      : kitPick === "msb"
                        ? msb
                        : kitPick === "charger"
                          ? charger
                          : inverter
                            ? inverterSpot(inverter, kitPick as number, spot.lat)
                            : null;
                  if (!at) return null;
                  const left = ((ROOF_IMAGE.width / 2 + at.x / scale - view.x) / view.w) * 100;
                  const top = ((ROOF_IMAGE.height / 2 + at.y / scale - view.y) / view.h) * 100;
                  const name =
                    kitPick === "battery"
                      ? `Battery · ${batteryKwh} kWh`
                      : kitPick === "msb"
                        ? "Main switchboard"
                        : kitPick === "charger"
                          ? `EV charger${charger ? ` · ${charger.kw} kW` : ""}`
                          : `${fitted.length > 1 ? `Inverter ${(kitPick as number) + 1}` : "Inverter"} · ${inverter?.kw} kW`;
                  return (
                    <div
                      className={clsx(GLASS, "absolute z-30 flex -translate-x-1/2 items-center gap-1 py-0.5 pl-3 pr-0.5")}
                      style={{
                        left: `clamp(7rem, ${left}%, calc(100% - 7rem))`,
                        top: top < 22 ? `calc(${top}% + 2.75rem)` : `calc(${top}% - 4.25rem)`,
                      }}
                      role="toolbar"
                      aria-label={`${name}, picked`}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className="whitespace-nowrap text-[12.5px] font-medium text-ink">{name}</span>
                      <button
                        type="button"
                        onClick={() => removeKit(kitPick)}
                        className="ml-1 flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-danger hover:bg-danger/10"
                        title="Take it off the design (Delete)"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Remove
                      </button>
                    </div>
                  );
                })()}

              {/* The battery or the inverter under the pointer: what it is, beside it. Not over the bar of the one picked. */}
              {kit !== null &&
                kit !== kitPick &&
                (() => {
                  const at = kit === "battery" ? battery : fitted[kit] ? inverterSpot(fitted[kit], kit, spot.lat) : null;
                  if (!at) return null;
                  const left = ((ROOF_IMAGE.width / 2 + at.x / scale - view.x) / view.w) * 100;
                  const top = ((ROOF_IMAGE.height / 2 + at.y / scale - view.y) / view.h) * 100;
                  const item = kit === "battery" ? null : fittedItems[kit];
                  const e = item?.electrical;
                  const wired = kit === "battery" ? [] : strings.filter((x) => (x.inverter ?? 0) === kit);
                  const lines: [string, string][] =
                    kit === "battery" && battery
                      ? [
                          ["Modules", `${battery.qty} × ${battery.kwh} kWh`],
                          ["Storage", `${batteryKwh} kWh`],
                          ["Product code", battery.sku],
                        ]
                      : kit !== "battery"
                        ? [
                            ["Rated", `${fitted[kit].kw} kW`],
                            ["Product code", fitted[kit].sku],
                            [
                              "Strings on it",
                              wired.length ? `${wired.length} (${wired.reduce((n, x) => n + x.panels.length, 0)} panels)` : "none yet",
                            ],
                            ...(e
                              ? ([
                                  ["Highest DC voltage", `${e.maxVoltage} V`],
                                  ["Tracking range", `${e.mppMin} to ${e.mppMax} V`],
                                  ["Starts at", `${e.startVoltage} V`],
                                  [
                                    "Inputs (MPPT)",
                                    e.mppts.map((m) => `${m.strings} string${m.strings === 1 ? "" : "s"}, ${m.maxCurrent} A`).join(" · "),
                                  ],
                                ] as [string, string][])
                              : []),
                          ]
                        : [];
                  return (
                    <div
                      className="pointer-events-none absolute z-20 w-[19rem] max-w-[calc(100%-1rem)] rounded-lg bg-forest p-3 text-white shadow-lift ring-1 ring-white/15"
                      style={{
                        left: `clamp(0.5rem, calc(${left}% + 2.5rem), calc(100% - 19.5rem))`,
                        top: `clamp(0.5rem, calc(${top}% - 3rem), calc(100% - 14rem))`,
                      }}
                      role="status"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-sun-bright">
                        {kit === "battery" ? "Battery" : fitted.length > 1 ? `Inverter ${kit + 1}` : "Inverter"}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">{kit === "battery" ? battery?.name : fitted[kit]?.name}</p>
                      <dl className="mt-2 divide-y divide-white/10 border-t border-white/10 text-xs">
                        {lines.map(([name, value]) => (
                          <div key={name} className="flex justify-between gap-3 py-1.5">
                            <dt className="text-white/55">{name}</dt>
                            <dd className="text-right">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {kit !== "battery" && !e && (
                        <p className="mt-2 text-xs text-white/55">
                          This inverter&apos;s voltage and current limits aren&apos;t on file yet.
                        </p>
                      )}
                      {e && <p className="mt-2 text-[11px] text-white/45">{e.basis}</p>}
                      <p className="mt-2 text-[11px] text-white/45">Drag it to where it will go.</p>
                    </div>
                  );
                })()}

              {/* The turn buttons, small, right by the panels picked (Martin: close to the panel just laid, not at the edge). Under
                  them, or over them when they are low on the picture. */}
              {tool === "select" &&
                pickedPanels.length > 0 &&
                (() => {
                  const corners = pickedPanels.flatMap((p) => looseCorners(p, size));
                  const xs = corners.map((c) => ((ROOF_IMAGE.width / 2 + c.x / scale - view.x) / view.w) * 100);
                  const ys = corners.map((c) => ((ROOF_IMAGE.height / 2 + c.y / scale - view.y) / view.h) * 100);
                  const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
                  // Set back from the panels (8 Nov 2026, Martin: too close to where he was working), under them, or over them when low.
                  const low = Math.max(...ys) > 70;
                  // The array just laid, and only it, is picked: its tilt sits at the start of the bar.
                  const pickedIds = panelPicks.flatMap((p) => (p.kind === "loose" ? [p.id] : []));
                  const tiltOn =
                    tiltPop.length > 0 &&
                    pickedIds.length === tiltPop.length &&
                    tiltPop.every((id) => pickedIds.includes(id)) &&
                    pickedTilt !== null;
                  const half = tiltOn ? 13.5 : 7.5;
                  return (
                    <div
                      className={clsx(GLASS, "absolute z-20 flex items-center gap-0.5 p-0.5")}
                      style={{
                        left: `clamp(0.5rem, calc(${middle}% - ${half}rem), calc(100% - ${half * 2 + 0.5}rem))`,
                        top: low
                          ? `max(0.5rem, calc(${Math.min(...ys)}% - 6.5rem))`
                          : `min(calc(100% - 3rem), calc(${Math.max(...ys)}% + 4.5rem))`,
                      }}
                      role="toolbar"
                      aria-label="Turn what is picked"
                    >
                      {tiltOn && (
                        <>
                          <span className="pl-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sun-line">Tilt</span>
                          <button
                            onClick={() => amend((p) => ({ ...p, tilt: Math.max(0, (p.tilt ?? TILT.roof) - 1) }))}
                            className="flex size-7 items-center justify-center rounded-full text-sm font-semibold hover:bg-surface"
                            aria-label="Tilt down a degree"
                          >
                            −
                          </button>
                          <span className="min-w-[2.4rem] text-center text-xs font-semibold tabular-nums">{pickedTilt}°</span>
                          <button
                            onClick={() => amend((p) => ({ ...p, tilt: Math.min(TILT.max, (p.tilt ?? TILT.roof) + 1) }))}
                            className="flex size-7 items-center justify-center rounded-full text-sm font-semibold hover:bg-surface"
                            aria-label="Tilt up a degree"
                          >
                            +
                          </button>
                          <button
                            onClick={() => setTiltPop([])}
                            className="flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-ink"
                          >
                            <Check className="size-3.5" aria-hidden /> Keep
                          </button>
                          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
                        </>
                      )}
                      {([-5, -1, 90, 1, 5] as const).map((step) => (
                        <button
                          key={step}
                          onClick={() => turn(step)}
                          title={`Turn ${Math.abs(step)}° ${step < 0 ? "anticlockwise" : "clockwise"}`}
                          aria-label={`Turn ${Math.abs(step)} degree${Math.abs(step) === 1 ? "" : "s"} ${step < 0 ? "anticlockwise" : "clockwise"}`}
                          className={clsx(
                            "flex h-7 items-center justify-center rounded-full px-2 text-[11px] font-medium tabular-nums hover:bg-surface",
                            step === 90 ? "bg-surface text-ink" : "text-ink-2",
                          )}
                        >
                          {step === 90 ? "90°" : `${step > 0 ? "+" : "−"}${Math.abs(step)}°`}
                        </button>
                      ))}
                    </div>
                  );
                })()}

              {/* The string asked about, checked against the inverter input it is on. */}
              {tool === "string" &&
                (() => {
                  const index = strings.findIndex((x) => x.id === checking);
                  const at = index >= 0 ? centres[strings[index].panels[0]] : null;
                  if (index < 0 || !at) return null;
                  const check = checks[index];
                  const string = strings[index];
                  const left = ((ROOF_IMAGE.width / 2 + at.x / scale - view.x) / view.w) * 100;
                  const top = ((ROOF_IMAGE.height / 2 + at.y / scale - view.y) / view.h) * 100;
                  return (
                    <div
                      className="absolute z-20 w-[22rem] max-w-[calc(100%-1rem)] rounded-lg bg-forest p-3 text-white shadow-lift ring-1 ring-white/15"
                      style={{
                        // Kept clear of the strings box on the right where the picture is wide enough.
                        left: `clamp(0.5rem, calc(${left}% + 2rem), calc(100% - 41.5rem))`,
                        top: `clamp(0.5rem, calc(${top}% + 1.5rem), calc(100% - 15rem))`,
                      }}
                      role="status"
                    >
                      <button
                        onClick={() => setChecking(null)}
                        title="Close the check (Esc)"
                        aria-label="Close the check"
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                      <p className="flex items-center gap-2 pr-8 text-sm font-semibold">
                        <span
                          className="size-3 rounded-full"
                          style={{ background: STRING_COLOURS[index % STRING_COLOURS.length] }}
                          aria-hidden
                        />
                        String {letter(index)} · {string.panels.length} panels ·
                        {fitted.length > 1 ? ` inverter ${(string.inverter ?? 0) + 1},` : ""} input {(string.mppt ?? 0) + 1}
                      </p>
                      {fitted[string.inverter ?? 0] ? (
                        <p className="mt-0.5 truncate text-xs text-white/60">{fitted[string.inverter ?? 0].name}</p>
                      ) : null}
                      {check.lines.length > 0 && (
                        <table className="mt-2 w-full text-xs">
                          <tbody>
                            {check.lines.map((line) => (
                              <tr key={line.what} className="align-top">
                                <td className="py-0.5 pr-2 text-white/70">{line.what}</td>
                                <td className="whitespace-nowrap py-0.5 text-right tabular-nums">{line.value}</td>
                                <td className="whitespace-nowrap py-0.5 pl-2 tabular-nums text-white/60">{line.limit}</td>
                                <td
                                  className={clsx(
                                    "w-4 py-0.5 pl-2 font-bold",
                                    line.ok === false && "text-[#ff8a80]",
                                    line.ok === null && "text-sun-bright",
                                  )}
                                >
                                  {line.ok === true ? "✓" : line.ok === false ? "✕" : line.ok === null ? "!" : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className={clsx("mt-2 rounded-lg px-2 py-1.5 text-xs font-medium", VERDICT[check.verdict].pad)}>
                        {VERDICT[check.verdict].mark} {check.words}
                      </p>
                      {check.basis.length > 0 && (
                        <p className="mt-1.5 text-[10px] leading-snug text-white/50">
                          Tested at {DESIGN_TEMPERATURES.cold} °C and {HOT_CELL} °C in the panel. Figures from: {check.basis.join("; ")}.
                          Check them against the datasheets before relying on this.
                        </p>
                      )}
                    </div>
                  );
                })()}

              {/* The open comment, beside its bubble: this is where it is read and written. */}
              {thread && threadSpot && (
                <div
                  className="absolute z-20 w-72 max-w-[calc(100%-1rem)] space-y-3 rounded-lg border-2 border-sun-line bg-surface p-4 shadow-lift"
                  style={{
                    left: `clamp(0.5rem, calc(${threadSpot.left}% + 1rem), calc(100% - 18.5rem))`,
                    top: `clamp(0.5rem, ${threadSpot.top}%, calc(100% - 6rem))`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={label}>{"at" in thread ? "New comment" : "Comment"}</p>
                    <button
                      className="text-sm text-muted hover:text-ink"
                      onClick={() => {
                        setThread(null);
                        setWords("");
                      }}
                    >
                      Close
                    </button>
                  </div>
                  {"id" in thread &&
                    (comments.find((c) => c.id === thread.id)?.notes ?? []).map((n, i) => (
                      <div key={i} className={clsx("rounded-md px-3 py-2 text-sm", "bg-canvas")}>
                        <p className="text-[11px] text-muted">{n.at.replace("T", " ")}</p>
                        <p className="mt-0.5 whitespace-pre-wrap">{n.text}</p>
                      </div>
                    ))}
                  <textarea
                    autoFocus
                    value={words}
                    onChange={(e) => setWords(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={"at" in thread ? "What do you want to say about this spot?" : "Reply"}
                    className="block w-full rounded-md border border-line bg-surface p-3 text-sm outline-none focus:border-forest"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={clsx(button, "!border-primary !bg-primary !text-primary-ink")}
                      disabled={!words.trim() || talking === "sending"}
                      onClick={() =>
                        void say(
                          "at" in thread
                            ? { do: "add", x: thread.at.x, y: thread.at.y, text: words }
                            : { do: "reply", id: thread.id, text: words },
                        )
                      }
                    >
                      {talking === "sending" ? "Saving…" : "at" in thread ? "Post" : "Reply"}
                    </button>
                    {"id" in thread && (
                      <>
                        <button
                          className={button}
                          disabled={talking === "sending"}
                          onClick={() =>
                            void say({ do: "resolve", id: thread.id, resolved: !comments.find((c) => c.id === thread.id)?.resolved })
                          }
                        >
                          {comments.find((c) => c.id === thread.id)?.resolved ? "Reopen" : "Resolve"}
                        </button>
                        <button
                          className={clsx(button, "text-danger")}
                          disabled={talking === "sending"}
                          onClick={() => void say({ do: "remove", id: thread.id })}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted" role="status">
                    {typeof talking === "object"
                      ? talking.error
                      : "Kept with the designs when you save. With the box empty, the Delete key removes the whole comment."}
                  </p>
                </div>
              )}

              {/* On the picture, half way down its right edge: the controls for whatever is picked, in a half-round. With nothing picked, the turn buttons for the rows of the face being worked on. */}
              {tool === "string" ? (
                <div
                  className="absolute right-3 top-[6.75rem] z-10 max-h-[calc(100%-13rem)] w-72 space-y-2 overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-lift"
                  role="group"
                  aria-label="Strings"
                  data-popup
                >
                  <div className="flex items-start gap-2">
                    <p className={clsx(label, "flex-1")}>
                      Strings
                      {fitted.length
                        ? ` · ${fitted.length > 1 ? `${fitted.length} inverters, ` : ""}${fittedKw} kW of inverter for ${summary.kw.toFixed(2)} kW of panels`
                        : " · no inverter chosen"}
                    </p>
                    <button
                      onClick={() => pickTool("select")}
                      title="Done stringing (Esc)"
                      aria-label="Close strings"
                      className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  {strings.length === 0 && <p className="text-sm text-muted">Click panels on the roof in the order they&apos;re wired.</p>}
                  <ul className="space-y-1">
                    {strings.map((x, i) => (
                      <li
                        key={x.id}
                        className={clsx("flex items-center gap-1 rounded-md border p-1", x.id === wiring ? "border-forest" : "border-line")}
                        onMouseEnter={() => setHover(x.id)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <button
                          onClick={() => setWiring(x.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left"
                        >
                          <span
                            className="size-3.5 shrink-0 rounded-full border border-line-strong"
                            style={{ background: STRING_COLOURS[i % STRING_COLOURS.length] }}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">String {letter(i)}</span>
                            <span className="block truncate text-xs tabular-nums text-muted">
                              {x.panels.length} panels · {((x.panels.length * size.watts) / 1000).toFixed(2)} kW
                              {checks[i].coldVoc ? ` · Voc ${Math.round(checks[i].coldVoc ?? 0)} V` : ""}
                            </span>
                          </span>
                        </button>
                        <select
                          value={`${x.inverter ?? 0}:${x.mppt ?? 0}`}
                          onChange={(e) => {
                            const [n, input] = e.target.value.split(":").map(Number);
                            setStrings(
                              strings.map((y) =>
                                y.id === x.id ? { id: y.id, panels: y.panels, ...(n > 0 ? { inverter: n } : {}), mppt: input } : y,
                              ),
                            );
                            changed();
                          }}
                          aria-label={`The inverter input string ${letter(i)} is on`}
                          title="The inverter and the input (MPPT) this string is on"
                          className="h-8 max-w-[6.5rem] rounded-lg border border-line bg-surface px-1 text-xs font-medium"
                        >
                          {Array.from({ length: Math.max(1, fitted.length, (x.inverter ?? 0) + 1) }, (_, n) =>
                            Array.from({ length: Math.max(inputsOf(n), n === (x.inverter ?? 0) ? (x.mppt ?? 0) + 1 : 0) }, (_, input) => (
                              <option key={`${n}:${input}`} value={`${n}:${input}`}>
                                {fitted.length > 1 ? `Inv ${n + 1} · in ${input + 1}` : `Input ${input + 1}`}
                              </option>
                            )),
                          )}
                        </select>
                        <button
                          onClick={() => setChecking(checking === x.id ? null : x.id)}
                          className={clsx(
                            "flex size-7 items-center justify-center rounded-full text-sm font-bold hover:bg-canvas",
                            checking === x.id && "bg-canvas ring-1 ring-line",
                            VERDICT[checks[i].verdict].tone,
                          )}
                          title={`${checks[i].words} (show the check)`}
                          aria-label={`${checks[i].words}. Show the check for string ${letter(i)}`}
                          aria-pressed={checking === x.id}
                        >
                          {VERDICT[checks[i].verdict].mark}
                        </button>
                        <button
                          className="px-1 text-lg leading-none text-muted hover:text-danger"
                          aria-label={`Delete string ${letter(i)}`}
                          onClick={() => {
                            setStrings(strings.filter((y) => y.id !== x.id));
                            setHover(null);
                            changed();
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  {startedString && (
                    <p
                      className="flex items-center gap-2 rounded-md border border-sun-line bg-sun px-2.5 py-2 text-sm text-sun-ink"
                      role="status"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: STRING_COLOURS[strings.length % STRING_COLOURS.length] }}
                        aria-hidden
                      />
                      <span>
                        <strong className="font-semibold">String {letter(strings.length)} started.</strong> Click its panels in wiring
                        order, or drag across them.
                      </span>
                    </p>
                  )}
                  <button
                    className={clsx(button, "!min-h-9 w-full justify-center !border-sun-line")}
                    onClick={stringForMe}
                    disabled={summary.panels === 0}
                    title="String the panels by rule, checked against the inverter's inputs"
                  >
                    <Sparkles className="mr-1.5 size-4 text-sun-ink" aria-hidden /> String automatically
                  </button>
                  {autoNote && (
                    <p
                      className={clsx(
                        "rounded-md px-2.5 py-2 text-xs",
                        autoNote.ok ? "bg-positive-soft text-positive" : "bg-sun text-sun-ink",
                      )}
                      role="status"
                    >
                      {autoNote.note}
                      {/* Found online by itself (3 Nov 2026): the sheet read and its figures kept, marked to check. */}
                      {autoNote.missing && props.onFindSheet && (
                        <button
                          type="button"
                          disabled={findingSheet}
                          onClick={async () => {
                            const missing = autoNote.missing!;
                            setFindingSheet(true);
                            const res = await props.onFindSheet!(missing);
                            setFindingSheet(false);
                            setAutoNote({
                              ok: res.ok,
                              note: res.ok ? `${res.message} Press String automatically again.` : res.message,
                              ...(res.ok ? {} : { missing }),
                            });
                          }}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 font-medium text-ink ring-1 ring-line hover:bg-surface-2 disabled:text-muted"
                        >
                          <Sparkles className="size-3.5 text-sun-ink" aria-hidden />
                          {findingSheet ? "Looking for its datasheet… (up to a minute or two)" : "Find its datasheet online"}
                        </button>
                      )}
                    </p>
                  )}
                  {/* The sheets behind the strings (8 Nov 2026, Martin: a sheet found online should be there to look at, to be sure
                      it is the right one, Australia's, while designing on its figures). */}
                  {(() => {
                    const sheets = [
                      ...(chosenPanel?.electrical
                        ? [{ kind: "panel" as const, sku: chosenPanel.sku, name: chosenPanel.name, e: chosenPanel.electrical }]
                        : []),
                      ...fittedItems.flatMap((i) =>
                        i?.electrical ? [{ kind: "inverter" as const, sku: i.sku, name: i.name, e: i.electrical }] : [],
                      ),
                    ].filter((s, n, all) => all.findIndex((x) => x.kind === s.kind && x.sku === s.sku) === n);
                    if (!sheets.length) return null;
                    return (
                      <div className="rounded-md bg-surface-2 px-2.5 py-2 text-xs">
                        <p className="font-semibold text-ink">The figures behind these strings</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {sheets.map((s) => (
                            <li key={`${s.kind}:${s.sku}`}>
                              <span className="block truncate font-medium text-ink" title={s.name}>
                                {s.kind === "panel" ? "Panel" : "Inverter"} · {s.name}
                              </span>
                              {s.e.unchecked ? (
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="text-sun-ink">Found online, not checked yet</span>
                                  <a
                                    href={`/api/design/datasheets/file?kind=${s.kind}&sku=${encodeURIComponent(s.sku)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-ink underline underline-offset-2"
                                  >
                                    Open the sheet
                                  </a>
                                  <a
                                    href={s.e.unchecked}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-ink-2 underline underline-offset-2"
                                    title={s.e.unchecked}
                                  >
                                    Where it came from
                                  </a>
                                  <Link href="/design/settings/datasheets" className="text-ink-2 underline underline-offset-2">
                                    Check and confirm
                                  </Link>
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-muted">{s.e.basis}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  <button
                    className={clsx(button, "!min-h-9 w-full justify-center")}
                    onClick={() => setWiring(newId("s"))}
                    disabled={startedString}
                  >
                    <Plus className="mr-1.5 size-4" aria-hidden /> New string
                  </button>
                  <p className="text-xs text-muted">
                    {summary.panels - strings.reduce((n, x) => n + x.panels.length, 0)} of {summary.panels} panels aren&apos;t on a string.
                    Tap the tick or cross beside a string for its check. String last: re-laying a face&apos;s rows renumbers its panels.
                  </p>
                </div>
              ) : picks.length > 0 ? (
                <Dial
                  label="What is picked"
                  dark
                  onTurn={null}
                  onClose={() => setPicks([])}
                  closeTitle="Pick none (Esc)"
                  onRemove={removePicked}
                >
                  <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-white/60">
                    {picks.length === 1 ? (picks[0].kind === "label" ? "Label" : "1 panel") : `${picks.length} picked`}
                  </p>
                  {pickedPanels.length > 0 && (
                    <>
                      {/* Portrait or landscape for the picked panels, as two small drawn panels (as Primero's). */}
                      <div className="mt-2 flex justify-end gap-1" role="radiogroup" aria-label="The picked panels' way round">
                        {([false, true] as const).map((land) => {
                          const on = pickedPanels.every((p) => Boolean(p.across) === land);
                          return (
                            <button
                              key={String(land)}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              title={land ? "Lay them landscape" : "Lay them portrait"}
                              onClick={() => turnLandscape(land)}
                              className={clsx(
                                "flex size-9 items-center justify-center rounded-lg transition",
                                on ? "bg-sun-line text-white" : "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white",
                              )}
                            >
                              <PanelDrawing landscape={land} size={20} />
                            </button>
                          );
                        })}
                      </div>
                      <label className="mt-2 block">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-white/60">Tilt</span>
                        <span className="block text-[1.75rem] font-semibold leading-none tabular-nums text-white">
                          {pickedTilt === null ? "mixed" : `${pickedTilt}°`}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={TILT.max}
                          value={pickedTilt ?? TILT.roof}
                          onChange={(e) => amend((p) => ({ ...p, tilt: Number(e.target.value) }))}
                          {...slides}
                          className="mt-2 block w-full"
                        />
                      </label>
                      <p className="mt-2.5 text-xs leading-snug text-white/75">
                        {pickedFacing === null ? "Facing different ways" : `Facing ${compass(pickedFacing)} (${pickedFacing}°)`}
                      </p>
                      {pickedFacing !== null && pickedTilt !== null && (
                        <>
                          <p className="text-xs font-semibold leading-snug text-white">{besideFlat(pickedTilt, pickedFacing)}</p>
                          <p className="text-xs leading-snug text-white/60">
                            {bestTilt(pickedFacing) === 0 ? "Flat is best" : `${bestTilt(pickedFacing)}° is best`}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </Dial>
              ) : (
                face && (
                  <Dial
                    label="Turn the rows"
                    // The rows run the same turned half way round, so their angle stays between a quarter turn either way.
                    onTurn={(step) => {
                      const angle = ((((face.angle + step + 90) % 180) + 180) % 180) - 90;
                      // A face whose own grid is switched off (its panels laid on it as panels by hand, or by the rules)
                      // stays empty when its rows turn: switching its grid back on put a second set of panels down
                      // with every press (10 Nov 2026, Martin: +1 kept adding panels).
                      const places = panelPlaces(face, size);
                      const empty = places.length > 0 && face.off.length > places.length / 2;
                      update(face.id, { angle, off: empty ? panelPlaces({ ...face, angle }, size).map((x) => x.index) : [] });
                    }}
                    onClose={() => setSelected(null)}
                    closeTitle="Leave this roof face"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Rows</p>
                    <p className="mt-1 text-[1.75rem] font-semibold leading-none tabular-nums text-ink">{face.angle}°</p>
                    <p className="mt-2 text-xs leading-snug text-ink-2">Turn the rows on this roof face</p>
                    <button
                      type="button"
                      onClick={() => removeFace(face.id)}
                      title="Take this traced roof face away (Delete), with the panels in its rows"
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden /> Delete this face
                    </button>
                  </Dial>
                )
              )}

              {/* The system, centred along the top of the picture, as three rounds: the panel, the largest, in the middle, with
                  the inverter and the battery as half-rounds growing out of it either side. Each opens its choices
                  beneath, centred under the three. (Which design is open is in the bar at the top of the page, and
                  the customer's bill in the figures above the picture.) */}
              <div
                className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-col items-center"
                role="group"
                aria-label="System"
                data-menu-host
              >
                <div className="flex items-center">
                  <div className="order-3">
                    <button
                      onClick={() => openMenu(menu === "panels" ? false : "panels")}
                      aria-expanded={menu === "panels"}
                      aria-haspopup="true"
                      title={`Panels: ${summary.panels} × ${panel?.name ?? chosenPanel?.name ?? "panel"}`}
                      aria-label="The panel this design is drawn with"
                      className={clsx(
                        "relative z-10 flex size-[3.75rem] flex-col items-center justify-center rounded-full border shadow-lift tabular-nums",
                        menu === "panels"
                          ? "border-primary bg-primary text-primary-ink"
                          : summary.panels > 0
                            ? KIT_LIT
                            : "border-line bg-surface text-ink hover:bg-canvas",
                      )}
                    >
                      {/* A solar panel, leaning as it does on a roof: frame, cells, and a stand. */}
                      <svg
                        viewBox="0 0 24 24"
                        className="size-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5.2 4h13.6l2.7 12H2.5z" />
                        <path d="M3.9 10h16.2M9.4 4 8 16M14.6 4 16 16" strokeWidth="1.2" />
                        <path d="M12 16v4M8.5 20h7" strokeLinecap="round" />
                      </svg>
                      <span className="mt-0.5 text-[11px] font-medium leading-none">{summary.panels}</span>
                    </button>
                    {menu === "panels" && (
                      <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[calc(var(--pic-h,60vh)-8.5rem)] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                        <p className={clsx(label, "px-2 py-1")}>Panels to choose from</p>
                        {[
                          ...(panel && !chosenPanel ? [{ ...panel, sizeKnown: true, gone: true }] : []),
                          ...favourites.sorted("panels", props.catalogue).map((p) => ({ ...p, gone: false })),
                        ].map((p) => (
                          <div key={p.sku} className="group flex items-start gap-1">
                            <button
                              onClick={() => {
                                if (!p.gone) choosePanel(p.sku);
                                openMenu(false);
                              }}
                              className={clsx(
                                "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas",
                                p.sku === chosen && "bg-canvas",
                              )}
                            >
                              <Check className={clsx("mt-0.5 size-4 shrink-0", p.sku === chosen ? "text-ink" : "invisible")} aria-hidden />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{p.name}</span>
                                <ModelNo sku={p.sku} />
                                <span className="block text-xs tabular-nums text-muted">
                                  {p.watts} W · {p.sizeKnown ? `${p.long} × ${p.short} m` : "size not on file"}
                                  {p.gone ? " · no longer in our range" : ""}
                                </span>
                              </span>
                            </button>
                            {!p.gone && (
                              <FavouriteStar
                                on={favourites.is("panels", p.sku)}
                                onToggle={() => favourites.toggle("panels", p.sku)}
                                name={p.name}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* The EV charger (5 Nov 2026), beside the inverter as the switchboard is beside the battery: its list is the
                    chargers on the business's own price lists; chosen, its mark goes on the picture to be dragged to its wall. */}
                  <div className="order-1 mr-1.5">
                    <button
                      onClick={() => openMenu(menu === "chargers" ? false : "chargers")}
                      aria-expanded={menu === "chargers"}
                      aria-haspopup="true"
                      title={charger ? `EV charger: ${charger.name}` : "EV charger: add one"}
                      aria-label="The EV charger on this design"
                      className={clsx(
                        "flex size-[2.625rem] items-center justify-center rounded-full border shadow-lift backdrop-blur-md",
                        menu === "chargers"
                          ? "border-line bg-primary text-primary-ink"
                          : charger
                            ? KIT_LIT
                            : "border-line bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                      )}
                    >
                      <PlugZap className="size-5" aria-hidden />
                    </button>
                    {menu === "chargers" && (
                      <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[calc(var(--pic-h,60vh)-8.5rem)] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lift">
                        <p className={clsx(label, "px-2 py-1")}>On this design</p>
                        {charger ? (
                          <div className="rounded-md bg-canvas px-2 py-2">
                            <div className="flex items-start gap-2">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{charger.name}</span>
                                <ModelNo sku={charger.sku} />
                                <span className="block text-xs tabular-nums text-muted">{charger.kw} kW</span>
                              </span>
                              <button
                                className="text-sm font-medium text-danger hover:underline"
                                onClick={() => {
                                  setCharger(undefined);
                                  changed();
                                }}
                              >
                                Take it off
                              </button>
                            </div>
                            <p className="mt-1.5 text-xs text-muted">
                              It is on the picture: drag it to the wall it will be mounted on. The quote adds it and its installation.
                            </p>
                          </div>
                        ) : (
                          <p className="px-2 pb-1 text-sm text-muted">None on this design.</p>
                        )}
                        {(props.chargers ?? []).length === 0 ? (
                          <p className="mt-2 px-2 text-sm text-ink-2">
                            No EV chargers on your price lists yet. Upload a list with them in Settings, under price lists, and they show
                            here.
                          </p>
                        ) : (
                          <>
                            <p className={clsx(label, "mt-2 px-2 py-1")}>
                              {charger ? "Change it" : "Chargers to choose from"} · {(props.chargers ?? []).length} on your lists
                            </p>
                            <input
                              value={seek}
                              onChange={(e) => setSeek(e.target.value)}
                              placeholder="Search EV chargers"
                              className="block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-forest"
                            />
                            <div className="mt-1 max-h-[40vh] space-y-0.5 overflow-y-auto">
                              {favourites
                                .sorted("chargers", props.chargers ?? [])
                                .filter((c) =>
                                  seek
                                    .toLowerCase()
                                    .split(/\s+/)
                                    .every((word) => `${c.name} ${c.sku}`.toLowerCase().includes(word)),
                                )
                                .map((c) => (
                                  <div key={c.sku} className="group flex items-start gap-1">
                                    <button
                                      onClick={() => chooseCharger(c)}
                                      className={clsx(
                                        "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas",
                                        c.sku === charger?.sku && "bg-canvas",
                                      )}
                                    >
                                      <Check
                                        className={clsx("mt-0.5 size-4 shrink-0", c.sku === charger?.sku ? "text-ink" : "invisible")}
                                        aria-hidden
                                      />
                                      <span className="min-w-0">
                                        <span className="block text-sm font-semibold">{c.name}</span>
                                        <ModelNo sku={c.sku} />
                                        <span className="block text-xs tabular-nums text-muted">{c.kw} kW</span>
                                      </span>
                                    </button>
                                    <FavouriteStar
                                      on={favourites.is("chargers", c.sku)}
                                      onToggle={() => favourites.toggle("chargers", c.sku)}
                                      name={c.name}
                                    />
                                  </div>
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="order-2 -mr-7">
                    <button
                      onClick={() => openMenu(menu === "inverters" ? false : "inverters")}
                      aria-expanded={menu === "inverters"}
                      aria-haspopup="true"
                      title={fitted.length ? `Inverter: ${fitted.map((i) => i.name).join(" + ")}` : "Inverter: choose one"}
                      aria-label="The inverters this design is drawn for"
                      className={clsx(
                        "flex h-[2.625rem] w-[4.75rem] flex-col items-start justify-center rounded-l-full border pl-3 shadow-lift backdrop-blur-md",
                        menu === "inverters"
                          ? "border-line bg-primary text-primary-ink"
                          : fitted.length
                            ? KIT_LIT
                            : "border-line bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                      )}
                    >
                      <Zap className={fitted.length ? "size-4" : "size-5"} aria-hidden />
                      {fitted.length > 0 && (
                        <span className="mt-px text-[10px] font-semibold leading-none tabular-nums">{fittedKw} kW</span>
                      )}
                    </button>
                    {menu === "inverters" && (
                      <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[calc(var(--pic-h,60vh)-8.5rem)] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift rounded-lg border border-line bg-surface p-2">
                        <p className={clsx(label, "px-2 py-1")}>On this design</p>
                        {fitted.length === 0 && (
                          <p className="px-2 pb-1 text-sm text-muted">None yet. Add one, or more for a larger system.</p>
                        )}
                        <ul className="space-y-0.5">
                          {fitted.map((spec, n) => (
                            <li key={n} className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-ink">
                                {n + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{spec.name}</span>
                                <ModelNo sku={spec.sku} />
                                <span className="block text-xs tabular-nums text-muted">
                                  {spec.kw} kW ·{" "}
                                  {fittedItems[n]
                                    ? fittedItems[n]?.electrical
                                      ? `${inputsOf(n)} inputs · strings can be checked`
                                      : "limits not on file"
                                    : "no longer in our range"}
                                </span>
                              </span>
                              <button
                                onClick={() => removeInverter(n)}
                                className="px-1 text-lg leading-none text-muted hover:text-danger"
                                aria-label={`Take inverter ${n + 1} off the design`}
                                title="Take it off the design"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => setSuggesting(!suggesting)}
                          aria-expanded={suggesting}
                          // Lit, so it stands apart from the list (10 Nov 2026, Martin).
                          className={clsx(
                            "mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-sun-line/70 px-4 text-sm font-semibold text-ink hover:bg-sun-line/35",
                            suggesting ? "bg-sun-line/35" : "bg-sun-line/20",
                          )}
                        >
                          <Sparkles className="mr-1.5 size-4 text-sun-line" aria-hidden /> Suggest one for these panels
                        </button>
                        {suggesting && (
                          <div className="mt-1 space-y-1 rounded-md border border-sun-line bg-sun p-2">
                            {summary.panels === 0 && (
                              <p className="px-1 text-sm text-ink-2">Put panels on the roof first: the suggestion is sized to them.</p>
                            )}
                            {summary.panels > 0 && suggestions.length === 0 && (
                              <p className="px-1 text-sm text-ink-2">
                                Nothing in our range suits {summary.kw.toFixed(2)} kW of panels by the usual sizing. Pick one from the list
                                below.
                              </p>
                            )}
                            {suggestions.map((sug) => (
                              <div key={sug.inverter.sku + sug.kind} className="rounded-lg bg-surface p-2">
                                <p className={label}>{sug.kind}</p>
                                <p className="mt-0.5 text-sm font-semibold">
                                  {sug.count > 1 ? `${sug.count} × ` : ""}
                                  {sug.inverter.name}
                                </p>
                                <ModelNo sku={sug.inverter.sku} />
                                <p className="mt-0.5 text-xs text-ink-2">{sug.why}</p>
                                <button
                                  className="mt-1.5 text-sm font-semibold underline underline-offset-4"
                                  onClick={() => takeSuggestion(sug)}
                                >
                                  Use {sug.count > 1 ? "these" : "this one"}
                                </button>
                              </div>
                            ))}
                            {suggestions.length > 0 && (
                              <p className="px-1 text-[11px] text-muted">
                                One for each kind in our range: choose by the home&apos;s supply and whether a battery is wanted. Sized by
                                rule from the panels, not a design check.
                              </p>
                            )}
                          </div>
                        )}
                        <p className={clsx(label, "mt-2 px-2 py-1")}>
                          {fitted.length >= MAX_INVERTERS
                            ? `That is the most a design takes (${MAX_INVERTERS})`
                            : fitted.length
                              ? "Add another"
                              : "Add one"}
                        </p>
                        {fitted.length < MAX_INVERTERS && (
                          <>
                            <input
                              autoFocus
                              value={seek}
                              onChange={(e) => setSeek(e.target.value)}
                              placeholder="Search inverters"
                              className="block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-forest"
                            />
                            <div className="mt-1 max-h-[40vh] space-y-0.5 overflow-y-auto">
                              {favourites
                                .sorted("inverters", props.inverters)
                                .filter((i) =>
                                  seek
                                    .toLowerCase()
                                    .split(/\s+/)
                                    .every((word) => `${i.name} ${i.sku}`.toLowerCase().includes(word)),
                                )
                                .map((i) => (
                                  <div key={i.sku} className="group flex items-start gap-1">
                                    <button
                                      onClick={() => addInverter(i)}
                                      className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas"
                                    >
                                      <Plus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                                      <span className="min-w-0">
                                        <span className="block text-sm font-semibold">{i.name}</span>
                                        <ModelNo sku={i.sku} />
                                        <span className="block text-xs tabular-nums text-muted">
                                          {i.kw} kW ·{" "}
                                          {i.electrical
                                            ? `${i.electrical.mppts.length} inputs, up to ${i.electrical.maxVoltage} V · strings can be checked`
                                            : "limits not on file: strings can't be checked"}
                                        </span>
                                      </span>
                                    </button>
                                    <FavouriteStar
                                      on={favourites.is("inverters", i.sku)}
                                      onToggle={() => favourites.toggle("inverters", i.sku)}
                                      name={i.name}
                                    />
                                  </div>
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* The main switchboard (MSB), beside the battery (Martin): pressed, its mark goes on the picture to be dragged
                    to where the board is; pressed again (or erased), it comes off. */}
                  <div className="order-5 ml-1.5">
                    <button
                      onClick={toggleMsb}
                      title={
                        msb
                          ? "Main switchboard: drag its mark on the picture. Press again to take it off."
                          : "Main switchboard: mark where it is"
                      }
                      aria-label={msb ? "Take the main switchboard off" : "Mark the main switchboard"}
                      aria-pressed={msb !== null}
                      className={clsx(
                        "flex size-[2.625rem] items-center justify-center rounded-full border shadow-lift backdrop-blur-md",
                        msb ? KIT_LIT : "border-line bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                      )}
                    >
                      <SwitchboardGlyph />
                    </button>
                  </div>
                  <div className="order-4 -ml-7">
                    <button
                      onClick={() => openMenu(menu === "batteries" ? false : "batteries")}
                      aria-expanded={menu === "batteries"}
                      aria-haspopup="true"
                      title={battery ? `Battery: ${battery.qty} × ${battery.name}` : "Battery: add one"}
                      aria-label="The battery on this design"
                      className={clsx(
                        "flex h-[2.625rem] w-[4.75rem] flex-col items-end justify-center rounded-r-full border pr-3 shadow-lift backdrop-blur-md",
                        menu === "batteries"
                          ? "border-line bg-primary text-primary-ink"
                          : battery
                            ? KIT_LIT
                            : "border-line bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                      )}
                    >
                      <BatteryCharging className={battery ? "size-5" : "size-6"} aria-hidden />
                      {battery && <span className="mt-px text-[10px] font-semibold leading-none tabular-nums">{batteryKwh} kWh</span>}
                    </button>
                    {menu === "batteries" && (
                      <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[calc(var(--pic-h,60vh)-8.5rem)] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift rounded-lg border border-line bg-surface p-2">
                        <p className={clsx(label, "px-2 py-1")}>On this design</p>
                        {battery ? (
                          <div className="rounded-md bg-canvas px-2 py-2">
                            <p className="truncate text-sm font-semibold">{battery.name}</p>
                            <ModelNo sku={battery.sku} />
                            <div className="mt-1.5 flex items-center gap-2 text-sm">
                              <button
                                className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface font-semibold disabled:bg-surface-2 disabled:text-muted"
                                disabled={battery.qty <= 1}
                                onClick={() => {
                                  setBattery({ ...battery, qty: battery.qty - 1 });
                                  changed();
                                }}
                                aria-label="One fewer"
                              >
                                −
                              </button>
                              <span className="min-w-28 text-center tabular-nums">
                                {battery.qty} × {battery.kwh} kWh = <strong>{batteryKwh} kWh</strong>
                              </span>
                              <button
                                className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface font-semibold disabled:bg-surface-2 disabled:text-muted"
                                disabled={battery.qty >= MAX_BATTERY_QTY}
                                onClick={() => {
                                  setBattery({ ...battery, qty: battery.qty + 1 });
                                  changed();
                                }}
                                aria-label="One more"
                              >
                                +
                              </button>
                              <button
                                className="ml-auto text-sm font-medium text-danger hover:underline"
                                onClick={() => {
                                  setBattery(undefined);
                                  changed();
                                }}
                              >
                                Take it off
                              </button>
                            </div>
                            <label className="mt-2 flex items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5 size-4"
                                checked={Boolean(battery.backup)}
                                onChange={(e) => {
                                  setBattery({ ...battery, backup: e.target.checked || undefined });
                                  changed();
                                }}
                              />
                              <span>
                                Blackout backup: wire chosen circuits to it, one module held back for outages. Adds the backup circuits to
                                the quote; the held module isn&apos;t counted in the savings.
                              </span>
                            </label>
                            <p className="mt-1.5 text-xs text-muted">It is on the picture: drag it to the wall it will stand against.</p>
                          </div>
                        ) : (
                          <p className="px-2 pb-1 text-sm text-muted">None: this design is solar only. Choose one below.</p>
                        )}
                        {batteryIdea && batteryIdea.size > 0 && (
                          <div className="mt-2 space-y-1 rounded-md border border-sun-line bg-sun p-2">
                            <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-sun-ink">
                              <Sparkles className="size-4" aria-hidden /> Recommended for this home: about {batteryIdea.size} kWh
                            </p>
                            <p className="px-1 text-xs text-ink-2">{batteryIdea.note}</p>
                            {batteryIdea.suggestions.slice(0, 3).map((sug) => (
                              <div key={sug.battery.sku} className="rounded-lg bg-surface p-2">
                                <p className="text-sm font-semibold">
                                  {sug.qty > 1 ? `${sug.qty} × ` : ""}
                                  {sug.battery.name}
                                </p>
                                <ModelNo sku={sug.battery.sku} />
                                <p className="mt-0.5 text-xs text-ink-2">{sug.why}</p>
                                <button
                                  className="mt-1 text-sm font-semibold underline underline-offset-4"
                                  onClick={() => {
                                    chooseBattery(sug.battery);
                                    setBattery((b) => (b ? { ...b, qty: sug.qty } : b));
                                  }}
                                >
                                  Use this
                                </button>
                              </div>
                            ))}
                            {!finance && <p className="px-1 text-[11px] text-muted">Add the customer&apos;s bill for a closer size.</p>}
                          </div>
                        )}
                        <p className={clsx(label, "mt-2 px-2 py-1")}>
                          {battery ? "Change it" : "Batteries to choose from"} · {props.batteries.length} to choose from
                        </p>
                        <input
                          value={seek}
                          onChange={(e) => setSeek(e.target.value)}
                          placeholder="Search batteries"
                          className="block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-forest"
                        />
                        <div className="mt-1 max-h-[40vh] space-y-0.5 overflow-y-auto">
                          {favourites
                            .sorted("batteries", props.batteries)
                            .filter((b) =>
                              seek
                                .toLowerCase()
                                .split(/\s+/)
                                .every((word) => `${b.name} ${b.sku}`.toLowerCase().includes(word)),
                            )
                            .map((b) => (
                              <div key={b.sku} className="group flex items-start gap-1">
                                <button
                                  onClick={() => chooseBattery(b)}
                                  className={clsx(
                                    "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas",
                                    b.sku === battery?.sku && "bg-canvas",
                                  )}
                                >
                                  <Check
                                    className={clsx("mt-0.5 size-4 shrink-0", b.sku === battery?.sku ? "text-ink" : "invisible")}
                                    aria-hidden
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{b.name}</span>
                                    <ModelNo sku={b.sku} />
                                    <span className="block text-xs tabular-nums text-muted">{b.kwh} kWh each</span>
                                  </span>
                                </button>
                                <FavouriteStar
                                  on={favourites.is("batteries", b.sku)}
                                  onToggle={() => favourites.toggle("batteries", b.sku)}
                                  name={b.name}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* The pad, in the top left corner: the select arrow in a circle of its own, since it is the tool every other
                  is left for, with two smaller half-rounds growing out of it for the two things done most with it:
                  add a panel (to its right) and erase (beneath it). */}
              <div className="absolute left-4 top-4 z-20 size-[6.25rem]" role="toolbar" aria-label="Select, add a panel, landscape, erase">
                <button
                  onClick={() => {
                    const wasOpen = fanOpen;
                    // With panels picked, the fan is for turning them: Select stays on so they stay picked (Martin).
                    if (!(tool === "select" && pickedPanels.length)) pickTool("panel");
                    setFanOpen(!wasOpen);
                  }}
                  title={tool === "select" && pickedPanels.length ? "Portrait or landscape for the picked panels" : "Add a panel"}
                  aria-label="Add a panel"
                  aria-pressed={tool === "panel"}
                  className={clsx(
                    "absolute left-[2.375rem] top-[0.5625rem] flex h-[2.625rem] w-[3.75rem] items-center justify-end rounded-r-full border border-line pr-2.5 shadow-lift backdrop-blur-md",
                    tool === "panel" ? "bg-primary text-primary-ink" : "bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <SquarePlus className="size-5" aria-hidden />
                </button>
                {/* The way chosen, as a small mark on Add a panel while the card is shut. */}
                {addLandscape !== null && !fanOpen && (
                  <span
                    aria-hidden
                    className={clsx(
                      "pointer-events-none absolute left-[5.4rem] top-[2.4rem] block rounded-[2px] border border-ink bg-surface",
                      addLandscape ? "h-2 w-3" : "h-3 w-2",
                    )}
                  />
                )}
                {/* Portrait or landscape (1 Nov 2026, Martin, as Primero's: the bubbles were underwhelming): pressing Add a panel
                    opens a card of two drawn panels with their names, and following the roof face. Choosing one sets the way
                    new panels go down (and, with panels picked, lays them that way, `turnLandscape`), and the card closes. */}
                {fanOpen && (
                  <div
                    className="absolute left-[2.375rem] top-[3.75rem] z-30 w-60 rounded-2xl bg-surface p-2 text-left text-ink shadow-lift ring-1 ring-line"
                    role="radiogroup"
                    aria-label={pickedPanels.length && tool === "select" ? "The picked panels" : "New panels"}
                  >
                    <span className="block px-1 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                      {pickedPanels.length && tool === "select" ? "Lay the picked panels" : "New panels go down"}
                    </span>
                    <span className="grid grid-cols-2 gap-1.5">
                      {([false, true] as const).map((land) => {
                        const turning = tool === "select" && pickedPanels.length > 0;
                        const on = turning ? pickedPanels.every((p) => Boolean(p.across) === land) : addLandscape === land;
                        return (
                          <button
                            key={String(land)}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            title={land ? "Landscape: on their side" : "Portrait: upright"}
                            onClick={() => {
                              setAddLandscape(land);
                              if (pickedPanels.length) turnLandscape(land);
                              setFanOpen(false);
                            }}
                            className={clsx(
                              "flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition",
                              on ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-2 hover:text-ink hover:ring-1 hover:ring-ink",
                            )}
                          >
                            <PanelDrawing landscape={land} size={34} />
                            {land ? "Landscape" : "Portrait"}
                          </button>
                        );
                      })}
                    </span>
                    {!(tool === "select" && pickedPanels.length) && (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={addLandscape === null}
                        onClick={() => {
                          setAddLandscape(null);
                          setFanOpen(false);
                        }}
                        className={clsx(
                          "mt-1.5 w-full rounded-xl px-2 py-1.5 text-[11px] font-medium transition",
                          addLandscape === null ? "bg-sun text-sun-ink" : "text-muted hover:text-ink",
                        )}
                      >
                        Follow the roof face (or the panel beside it)
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={() => pickTool("erase")}
                  title="Erase"
                  aria-label="Erase"
                  aria-pressed={tool === "erase"}
                  className={clsx(
                    "absolute left-[0.5625rem] top-[2.375rem] flex h-[3.75rem] w-[2.625rem] items-end justify-center rounded-b-full border border-line pb-2.5 shadow-lift backdrop-blur-md",
                    tool === "erase" ? "bg-primary text-primary-ink" : "bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <Eraser className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() => pickTool("select")}
                  title="Select"
                  aria-label="Select"
                  aria-pressed={tool === "select"}
                  className={clsx(
                    // Orange, always: it is the tool to come back to. Taken up, it is ringed.
                    "absolute left-0 top-0 flex size-[3.75rem] items-center justify-center rounded-full bg-sun-line text-white shadow-lift hover:brightness-105",
                    tool === "select" ? "ring-[3px] ring-white" : "ring-1 ring-white/40",
                  )}
                >
                  <MousePointer2 className="size-6" aria-hidden />
                </button>
                {/* The arrays: a round under the eraser that lists them, and writes each one's size on the picture. */}
                <button
                  data-popup
                  onClick={() => {
                    setArraysOpen(!arraysOpen);
                    setShadeOn(false);
                  }}
                  title="Arrays: what each one is"
                  aria-label="Arrays"
                  aria-expanded={arraysOpen}
                  className={clsx(
                    "absolute left-[0.5625rem] top-[6.5rem] flex size-[2.625rem] items-center justify-center rounded-full border shadow-lift backdrop-blur-md",
                    arraysOpen ? "border-sun-line bg-sun-line text-white" : "border-line bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <LayoutGrid className="size-5" aria-hidden />
                </button>
              </div>
              {shadeOn && (
                <div
                  className="absolute right-3 top-[7.5rem] z-20 max-h-[calc(100%-14rem)] w-[19rem] max-w-[calc(100%-1.5rem)] overflow-auto rounded-2xl border border-line bg-surface p-4 shadow-lift"
                  role="region"
                  aria-label="Shade analysis"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Shade analysis · estimate</p>
                    <button
                      className="text-muted hover:text-ink"
                      onClick={() => setShadeOn(false)}
                      aria-label="Put the shade analysis away"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  {terrain === null ? (
                    <p className="mt-3 text-sm text-ink-2">Measuring what stands around the roof…</p>
                  ) : terrain === "none" ? (
                    <p className="mt-3 text-sm text-ink-2">
                      There&apos;s no height data for this address, so shade can&apos;t be worked out here. Check it on site.
                    </p>
                  ) : summary.panels === 0 ? (
                    <p className="mt-3 text-sm text-ink-2">Put panels on the roof and each is checked for shade through the year.</p>
                  ) : !shadeNow ? (
                    <p className="mt-3 text-sm text-ink-2">Working it out…</p>
                  ) : (
                    <>
                      <p className="mt-2 flex items-baseline gap-2">
                        <span className="text-[2rem] font-semibold leading-none tabular-nums text-ink">
                          {Math.round(shadeNow.report.access * 100)}%
                        </span>
                        <span className="text-sm text-ink-2">of the year&apos;s direct sun reaches the panels</span>
                      </p>
                      <p className="mt-2 text-[13px] leading-snug text-ink-2">
                        {shadeNow.report.shaded === 0
                          ? "No panel loses more than a tenth of its direct sun to shade."
                          : `${shadeNow.report.shaded} of ${shadeNow.report.panels.length} panels lose more than a tenth. The least open gets ${Math.round(shadeNow.report.worst * 100)}%.`}
                      </p>
                      <div className="mt-3 flex h-14 items-end gap-1" role="img" aria-label="Sun reaching the panels, month by month">
                        {shadeNow.report.byMonth.map((share, m) => (
                          <div key={m} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${Math.round(share * 100)}%`}>
                            <div className="flex h-10 w-full items-end rounded-sm bg-surface-2">
                              <div
                                className="w-full rounded-sm"
                                style={{ height: `${Math.round(share * 100)}%`, background: accessColour(share) }}
                              />
                            </div>
                            <span className="text-[9px] uppercase text-muted">{"JFMAMJJASOND"[m]}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-2">
                        {(
                          [
                            [1, "Open"],
                            [0.8, "Some shade"],
                            [0.5, "Mostly shaded"],
                          ] as const
                        ).map(([level, name]) => (
                          <span key={name} className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm" style={{ background: accessColour(level) }} /> {name}
                          </span>
                        ))}
                      </p>
                    </>
                  )}
                  <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
                    Worked out from {nearmapHeights ? `Nearmap's height data (${nearmapHeights})` : "Google's height data"} for this
                    address: where the sun is each half hour through the year, and what stands in its way. That data can be older than the
                    roof and the trees. It is a guide for design, not a shade assessment on site, and the quote&apos;s output figures
                    don&apos;t take it off.
                  </p>
                </div>
              )}
              {arraysOpen && (
                <div
                  className="absolute left-[4.25rem] top-[7rem] z-20 max-h-[calc(100%-13rem)] w-[28rem] max-w-[calc(100%-6.5rem)] overflow-auto rounded-2xl border border-line bg-surface p-4 shadow-lift"
                  role="region"
                  aria-label="Arrays"
                  data-popup
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                      Arrays · <span className="tabular-nums">{arrayList.length}</span> ·{" "}
                      <span className="tabular-nums">{summary.kw.toFixed(2)} kW</span>
                    </p>
                    <button className="text-muted hover:text-ink" onClick={() => setArraysOpen(false)} aria-label="Close the arrays list">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  {arrayList.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-2">No panels on this design yet.</p>
                  ) : (
                    <table className="mt-2 w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-line text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                          <th className="py-2 pr-2 font-medium">Array</th>
                          <th className="px-2 py-2 font-medium">Faces</th>
                          <th className="px-2 py-2 font-medium">Tilt</th>
                          <th className="px-2 py-2 text-right font-medium">Panels</th>
                          <th className="px-2 py-2 text-right font-medium">kW</th>
                          <th className="py-2 pl-2 font-medium">Strings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arrayList.map((a, i) => (
                          <tr key={i} className="border-b border-line last:border-0">
                            <td className="py-2.5 pr-2 font-semibold tabular-nums text-ink">{i + 1}</td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-ink">
                              {compass(a.facing)} <span className="tabular-nums">({a.facing}°)</span>
                            </td>
                            <td className="px-2 py-2.5 tabular-nums text-ink">{a.tilt}°</td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-ink">{a.panels}</td>
                            <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-ink">{a.kw.toFixed(2)}</td>
                            <td className="py-2.5 pl-2">
                              {a.strings.length ? (
                                <span className="flex flex-wrap gap-1">
                                  {a.strings.map((n) => (
                                    <span
                                      key={n}
                                      className="inline-flex size-6 items-center justify-center rounded text-[11px] font-semibold text-[#0b0c0e]"
                                      style={{ background: STRING_COLOURS[n % STRING_COLOURS.length] }}
                                    >
                                      {letter(n)}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">Not strung</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="mt-2 text-xs text-muted">Numbered largest first. Direction and tilt are as set on the design.</p>
                </div>
              )}
              {/* The second pad, in the top right corner, the mirror of the first: stringing the panels in its circle, with
                  tracing a roof face (to its left) and the guide line (beneath it) as its half-rounds. */}
              {/* Top right (8 Nov 2026, Martin: one round, its tools folded under it): stringing, with tracing a roof face and
                  the guide line coming out beneath on hover. The round shows whichever of the three is in use. */}
              {!props.tight && (
                <div className="absolute right-4 top-4 z-20">
                  <ToolFan
                    label="String panels (trace a roof face and the guide line beneath)"
                    direction="down"
                    onMain={() => pickTool("string")}
                    main={() => (
                      <span
                        className={clsx(
                          "flex size-[3.75rem] items-center justify-center rounded-full border shadow-lift",
                          tool === "string" || tool === "trace" || tool === "rule"
                            ? "border-primary bg-primary text-primary-ink"
                            : "border-line bg-surface text-ink hover:bg-canvas",
                        )}
                      >
                        {tool === "trace" ? (
                          <PenTool className="size-6" aria-hidden />
                        ) : tool === "rule" ? (
                          <Ruler className="size-6" aria-hidden />
                        ) : (
                          <Cable className="size-6" aria-hidden />
                        )}
                      </span>
                    )}
                  >
                    <Leg label="String panels" on={tool === "string"} onClick={() => pickTool("string")}>
                      <Cable className="size-5" aria-hidden />
                    </Leg>
                    <Leg label="Trace a roof face" on={tool === "trace"} onClick={() => pickTool("trace")}>
                      <PenTool className="size-5" aria-hidden />
                    </Leg>
                    <Leg label="Guide line" on={tool === "rule"} onClick={() => pickTool("rule")}>
                      <Ruler className="size-5" aria-hidden />
                    </Leg>
                  </ToolFan>
                </div>
              )}
              {tips.corner}
              {tapFill && (
                <div className="absolute left-1/2 top-[4.75rem] z-30 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-1">
                  <div className="flex items-center gap-3 rounded-full bg-primary/90 py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-lift ring-1 ring-white/10 backdrop-blur-md">
                    <span>
                      {tapBusy ? "Reading that face…" : "Tap a roof face to fill it"} ·{" "}
                      <span className="tabular-nums text-sun-line">
                        {loose.length} of {tapFill.want}
                      </span>{" "}
                      panels
                    </span>
                    <button
                      type="button"
                      onClick={() => setTapFill(null)}
                      className="rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-medium hover:bg-white/25"
                    >
                      Done
                    </button>
                  </div>
                  {tapNote && <p className="rounded-full bg-primary/85 px-3 py-1 text-[12px] text-white/85">{tapNote}</p>}
                </div>
              )}
              {/* The third pad, in the bottom left corner (above the map's own mark): the hand that moves the picture in its
                  circle, with zoom in (to its right) and zoom out (above it) as its half-rounds. */}
              <div className="absolute bottom-8 left-4 z-10">
                <ToolFan
                  label="Getting about: zoom in, zoom out, move the picture"
                  direction="right"
                  main={({ open }) => (
                    <span
                      className={clsx(
                        "flex size-[3.25rem] items-center justify-center rounded-full border shadow-lift",
                        tool === "pan" || open
                          ? "border-primary bg-primary text-primary-ink"
                          : "border-line bg-surface text-ink hover:bg-canvas",
                      )}
                    >
                      {tool === "pan" ? <Hand className="size-6" aria-hidden /> : <Move className="size-6" aria-hidden />}
                    </span>
                  )}
                >
                  <Leg label="Zoom in" onClick={() => zoom(1 / 1.4)}>
                    <ZoomIn className="size-5" aria-hidden />
                  </Leg>
                  <Leg label="Zoom out" onClick={() => zoom(1.4)}>
                    <ZoomOut className="size-5" aria-hidden />
                  </Leg>
                  <Leg label="Move the picture" on={tool === "pan"} onClick={() => pickTool(tool === "pan" ? "select" : "pan")}>
                    <Hand className="size-5" aria-hidden />
                  </Leg>
                </ToolFan>
              </div>
              {drawn && faces.length === 0 && modelFaces !== null && !Array.isArray(modelFaces) && (
                <p className="absolute left-1/2 top-[6.25rem] z-10 w-[22rem] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-line bg-surface/95 px-3 py-2 text-center text-[13px] text-ink-2 shadow-lift">
                  There&apos;s no roof data for this address to draw from. Trace the roof faces (top right) and they are drawn here.
                </p>
              )}
              {/* The dock, centred on the foot of the picture, clear of the map's own mark and credit at the very bottom. The
                  comment bubble is its centre: a round larger than the rest, standing proud of the plate, with undo and
                  redo, the whole picture and the label to its left, and the two ways of looking to its right (the roof
                  as a drawing, and the shade analysis). */}
              <div
                className={clsx(
                  "pointer-events-none absolute inset-x-2 bottom-7 flex items-end gap-2",
                  homeDay.on && "hidden",
                  // Over Sol's black panel while it is out, so the pill stands at its foot as one piece.
                  props.tight && !solAway && (commandOpen || commandReply || commandBusy || opening || calcOpen) ? "z-[55]" : "z-10",
                )}
              >
                {/* In the pop-up the foot of the picture is Sol alone (8 Nov 2026, Martin): ask him to change the design. */}
                {props.tight ? (
                  <button
                    ref={solPill}
                    type="button"
                    onClick={() => {
                      // Open: put away. Away (or never opened): the same panel back, his last answer in it, the box ready.
                      const shown = !solAway && (commandOpen || commandReply || commandBusy || opening || calcOpen);
                      if (shown) return putSolAway();
                      tips.nudge("sol-pressed");
                      setAwayFrom(null);
                      setCommandOpen(true);
                      requestAnimationFrame(() => commandBox.current?.focus());
                    }}
                    aria-expanded={!solAway && commandOpen}
                    data-popup
                    title="Tell Sol what to change: “fit 8 kW on the north face”, “use the Sigenergy battery”, “why is string B failing?”"
                    className="pointer-events-auto absolute bottom-0 left-1/2 flex h-14 -translate-x-1/2 items-center gap-3 rounded-full bg-primary pl-2 pr-5 text-white shadow-[0_12px_32px_rgba(11,11,12,0.35)] ring-1 ring-white/10 transition hover:brightness-110"
                  >
                    {/* Sol as he is in the menu (8 Nov 2026, Martin: keep Sol consistent): his lit sun in the graphite round, the stars above. */}
                    <span className="sol-orb relative flex size-11 items-center justify-center rounded-full">
                      <span className="sol-heartbeat inline-flex">
                        <SolMark className="size-[35px]" />
                      </span>
                      <SolStars className="pointer-events-none absolute -right-3 -top-3.5 size-[22px]" />
                    </span>
                    <span className="text-[15px] font-medium">Ask Sol</span>
                    <kbd className="rounded border border-white/25 px-1.5 text-[11px] text-white/60">/</kbd>
                  </button>
                ) : (
                  <div
                    className={clsx(GLASS, "pointer-events-auto absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1 p-1.5")}
                    role="toolbar"
                    aria-label="Design tools"
                  >
                    {/* Either side of the comment round the same width, so it sits dead centre whatever stands beside it. */}
                    {/* Undo, redo, the whole picture and the label, folded into one round (8 Nov 2026, Martin). */}
                    <div className={clsx("flex items-center justify-end gap-1", props.tight ? "w-[4.5rem]" : "w-[5.5rem]")}>
                      {!props.tight && (
                        <ToolFan
                          label="Undo, redo, the whole picture and a label"
                          direction="up"
                          main={({ open }) => (
                            <span
                              className={clsx(
                                "flex size-9 items-center justify-center rounded-xl",
                                open || tool === "label" ? "bg-primary text-primary-ink" : "text-ink hover:bg-canvas",
                              )}
                            >
                              <Ellipsis className="size-5" aria-hidden />
                            </span>
                          )}
                        >
                          <Leg label="Undo (Ctrl+Z)" onClick={undo}>
                            <Undo2 className="size-5" aria-hidden />
                          </Leg>
                          <Leg label="Redo (Ctrl+Shift+Z)" onClick={redo}>
                            <Redo2 className="size-5" aria-hidden />
                          </Leg>
                          <Leg label="Show the whole picture" onClick={() => setView(WHOLE)}>
                            <Maximize className="size-5" aria-hidden />
                          </Leg>
                          {(() => {
                            const { icon: Icon, name } = TOOLS.find((x) => x.tool === "label")!;
                            return (
                              <Leg label={name} on={tool === "label"} onClick={() => pickTool(tool === "label" ? "select" : "label")}>
                                <Icon className="size-5" aria-hidden />
                              </Leg>
                            );
                          })()}
                        </ToolFan>
                      )}
                    </div>
                    <button
                      onClick={() => pickTool(tool === "comment" ? "select" : "comment")}
                      title="Comment"
                      aria-label="Comment"
                      aria-pressed={tool === "comment"}
                      className={clsx(
                        "-my-3 mx-1 flex size-[3.25rem] shrink-0 items-center justify-center rounded-full border shadow-lift",
                        tool === "comment"
                          ? "border-primary bg-primary text-primary-ink"
                          : "border-line bg-surface text-ink hover:bg-canvas",
                      )}
                    >
                      <MessageCircle className="size-7" aria-hidden />
                    </button>
                    <div className={clsx("flex items-center justify-start gap-1", props.tight ? "w-[4.5rem]" : "w-[5.5rem]")}>
                      <button
                        onClick={toggleShade}
                        title={shadeOn ? "Put the shade analysis away" : "Shade analysis: how open each panel is to the sun"}
                        aria-label="Shade analysis"
                        aria-pressed={shadeOn}
                        className={clsx(
                          "flex size-9 items-center justify-center rounded-xl",
                          shadeOn ? "bg-primary text-primary-ink" : "text-ink hover:bg-canvas",
                        )}
                      >
                        <SunMedium className="size-5" aria-hidden />
                      </button>
                      {/* Design it for me (Martin: part of the dock): three designs for three outcomes, said first, made on "Make the three designs". */}
                      <button
                        onClick={() => setMineIntro(!mineIntro)}
                        data-popup
                        aria-expanded={mineIntro}
                        disabled={mine === "busy" || costsHidden}
                        title={
                          costsHidden
                            ? "Design it for me designs against prices, which your account can't see. Ask the owner."
                            : mine === "busy"
                              ? "Designing…"
                              : "Design it for me: three designs for this home, the fastest payback, the best return and the most independence"
                        }
                        aria-label="Design it for me"
                        className={clsx(
                          "flex size-9 items-center justify-center rounded-xl disabled:text-muted",
                          mineIntro || mine === "busy" ? "bg-primary text-primary-ink" : "text-sun-ink hover:bg-canvas",
                        )}
                      >
                        <WandSparkles className={clsx("size-5", mine === "busy" && "animate-pulse")} aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
                <span className="flex-1" aria-hidden />
                {/* What Design it for me (in the dock) says before it starts, and the three designs it made. */}
                <div className="pointer-events-auto flex max-w-80 shrink-0 flex-col items-end gap-1.5">
                  {typeof mine === "object" && !mineOpen && (
                    <div className={clsx(GLASS, "flex items-center gap-1 py-1 pl-3 pr-1 text-[13px]")}>
                      <button className="font-medium text-ink" onClick={() => setMineOpen(true)} aria-expanded={false}>
                        {mine.options.length} designs for this home
                      </button>
                      <button
                        className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                        onClick={() => setMine("idle")}
                        aria-label="Close the designs"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                  {billMoved && (
                    <div className={clsx(GLASS, "w-80 p-3 text-[13px]")} role="status">
                      <p className="text-ink">
                        The bill has changed since the three designs were made, and they&apos;ve been changed by hand.
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => void designForMe(false)}
                          className="flex-1 rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-ink hover:bg-forest"
                        >
                          Redesign for this bill
                        </button>
                        <button
                          onClick={keepMyDesigns}
                          className="flex-1 rounded-full bg-surface py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-surface-2"
                        >
                          Keep mine
                        </button>
                      </div>
                    </div>
                  )}
                  {typeof mine === "object" && mineOpen && (
                    <div className={clsx(GLASS, "max-h-[22rem] w-80 space-y-2 overflow-y-auto p-3 text-[13px]")} role="status">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-ink">Designed for this home</p>
                        <span className="flex">
                          {mine.options.length > 0 && (
                            <button
                              className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                              onClick={() => setMineOpen(false)}
                              aria-label="Fold the designs away"
                            >
                              <ChevronDown className="size-4" aria-hidden />
                            </button>
                          )}
                          <button
                            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                            onClick={() => setMine("idle")}
                            aria-label="Close the designs"
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </span>
                      </div>
                      {mine.options.map((o, i) => (
                        <button
                          key={o.key}
                          onClick={() => {
                            show(everyDesign(), i);
                            // Picked: fold the card away so the roof has the room.
                            setMineOpen(false);
                          }}
                          className={clsx(
                            "block w-full rounded-lg border p-2.5 text-left hover:border-ink",
                            active === i ? "border-sun-line bg-surface" : "border-line bg-surface/70",
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-ink">{o.label}</span>
                            <span className="tabular-nums text-ink-2">
                              {o.figures.kw} kW{o.figures.batteryKwh ? ` · ${o.figures.batteryKwh} kWh` : ""}
                            </span>
                          </span>
                          {!costsHidden && (
                            <span className="mt-1 block tabular-nums text-ink-2">
                              {dollars(o.figures.youPay)} after STCs
                              {o.figures.saving !== null && ` · saves ${dollars(o.figures.saving)} a year`}
                              {o.figures.payback !== null && ` · pays back in ${o.figures.payback} yrs`}
                            </span>
                          )}
                          <span className="mt-1 block text-muted">{o.why}</span>
                        </button>
                      ))}
                      {mine.notes.map((n) => (
                        <p key={n} className="text-ink-2">
                          {n}
                        </p>
                      ))}
                      {roofCheckNow && hasSolar(roofCheckNow.things) && (
                        <button
                          type="button"
                          onClick={() => void answerExisting(!replacing)}
                          className="rounded-full px-3 py-1 text-[12.5px] font-medium text-ink ring-1 ring-line hover:bg-surface-2"
                        >
                          {replacing ? "Keep clear of the existing panels" : "The existing panels are being replaced: use their roof"}
                        </button>
                      )}
                      <p className="text-muted">
                        Estimates from the bill and the price lists: one price at all times, no price rises. Check every design against the
                        picture before it goes to the customer.{" "}
                        <button className="font-medium text-ink underline underline-offset-2" onClick={() => setMine("idle")}>
                          Close
                        </button>
                      </p>
                    </div>
                  )}
                  {mineIntro && (
                    <div
                      className={clsx(GLASS, "relative w-80 space-y-2 p-3 text-[13px] text-ink-2")}
                      role="dialog"
                      aria-label="Design it for me"
                      data-popup
                    >
                      <button
                        type="button"
                        onClick={() => setMineIntro(false)}
                        aria-label="Close"
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                      <p className="font-semibold text-ink">Design it for me</p>
                      <p>Three designs for this home, each priced from your price lists and set against the customer&apos;s bill:</p>
                      <ul className="space-y-1.5">
                        {DESIGN_GOALS.map((goal) => (
                          <li key={goal}>
                            <span className="font-semibold text-ink">{SELF_DESIGN_LABELS[goal]}.</span> {SELF_DESIGN_AIMS[goal]}
                          </li>
                        ))}
                      </ul>
                      <p>
                        Each is laid by the installer&apos;s rules (rows from the gutter up, portrait and landscape mixed to fit the most,
                        clear of every edge) {faces.length ? "on the roof faces you traced" : "from Google's roof data"}, with an inverter
                        and strings.
                      </p>
                      {!finance && Number(bill.amount) <= 0 && (
                        <p className="text-sun-ink">
                          No bill yet: they&apos;re sized to about {NO_BILL_KW} kW.{" "}
                          <button
                            className="font-medium underline underline-offset-2"
                            onClick={() => {
                              setMineIntro(false);
                              openMenu("bill");
                            }}
                          >
                            Add the bill
                          </button>{" "}
                          to size them to this home.
                        </p>
                      )}
                      {everyDesign().some((d) => d.faces.length || d.loose?.length) && (
                        <p>They replace this roof&apos;s designs (the traced faces are kept). Best return is the primary.</p>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          className="rounded-full px-3 py-1.5 font-medium text-ink-2 hover:text-ink"
                          onClick={() => setMineIntro(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-ink hover:bg-forest"
                          onClick={() => void designForMe()}
                        >
                          Make the three designs
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={clsx("flex flex-wrap items-center gap-2", props.tight ? "mt-1" : "mt-3")}>
              {/* In the pop-up the tool's hint goes (its name and keys are on the tool itself), so the picture fits the window. */}
              {!props.tight && (
                <>
                  <span className="rounded bg-primary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-ink">
                    {TOOLS.find((t) => t.tool === tool)?.name}
                  </span>
                  <span className="text-sm text-muted">{TOOLS.find((t) => t.tool === tool)?.hint}</span>
                </>
              )}
              {chosenPanel && !chosenPanel.sizeKnown && (
                <span className="w-full text-sm text-sun-ink">
                  This panel&apos;s size isn&apos;t on file, so it is drawn at {size.long} × {size.short} m. Check it against the datasheet
                  before relying on how many fit.
                </span>
              )}
              {tool === "trace" && tracing.length > 0 && (
                <>
                  <button className={button} onClick={() => finish(tracing)} disabled={tracing.length < 3}>
                    Finish this face
                  </button>
                  <button className={button} onClick={() => setTracing(tracing.slice(0, -1))}>
                    Undo last corner
                  </button>
                </>
              )}
            </div>
          </div>

          <aside className="mt-5 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tool === "label" && (
              <div className="space-y-3 rounded-lg border-2 border-forest bg-surface p-4">
                <p className={label}>The label to place</p>
                <div className="flex flex-wrap gap-2">
                  {LABEL_KINDS.map((kind) => (
                    <button
                      key={kind}
                      className={clsx(button, labelKind === kind && "!border-primary !bg-primary !text-primary-ink")}
                      onClick={() => setLabelKind(kind)}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                {labelKind === "Note" && (
                  <input
                    value={labelText}
                    onChange={(e) => setLabelText(e.target.value)}
                    maxLength={80}
                    placeholder="What the note says"
                    className="block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-forest"
                  />
                )}
                <p className="text-xs text-muted">Then click the spot on the picture.</p>
              </div>
            )}

            {face && tool !== "string" && tool !== "label" && (
              <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
                <p className={label}>
                  This face · {summary.faces.find((f) => f.id === face.id)?.panels ?? 0} panels · {faceArea(face).toFixed(0)} m² from above
                </p>
                <SlopeNote slope={slopes[face.id]} nearmap={nearmapHeights} onRead={() => void readSlope(face.id, face.points, true)} />
                <label className="block text-sm">
                  <span className="flex justify-between">
                    Rows run at <span className="tabular-nums">{face.angle}°</span>
                  </span>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={face.angle}
                    onChange={(e) => update(face.id, { angle: Number(e.target.value), off: [] })}
                    className="mt-1 w-full"
                  />
                </label>
                <div className="flex gap-2">
                  {[-5, -1, 1, 5].map((step) => (
                    <button
                      key={step}
                      className={button}
                      onClick={() => update(face.id, { angle: Math.max(-90, Math.min(90, face.angle + step)), off: [] })}
                      aria-label={`Turn the rows ${Math.abs(step)} degrees ${step < 0 ? "anticlockwise" : "clockwise"}`}
                    >
                      {step > 0 ? "+" : "−"}
                      {Math.abs(step)}°
                    </button>
                  ))}
                </div>
                <button className={button} onClick={() => update(face.id, { angle: angleOfLongestEdge(face), off: [] })}>
                  Line up with the longest edge
                </button>
                <div className="flex gap-2">
                  {[false, true].map((landscape) => (
                    <button
                      key={String(landscape)}
                      className={clsx(button, face.landscape === landscape && "!border-primary !bg-primary !text-primary-ink")}
                      onClick={() => update(face.id, { landscape, off: [] })}
                    >
                      {landscape ? "Landscape" : "Portrait"}
                    </button>
                  ))}
                </div>
                <label className="block text-sm">
                  <span className="flex justify-between">
                    Kept in from the edges <span className="tabular-nums">{face.setback.toFixed(1)} m</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.1}
                    value={face.setback}
                    onChange={(e) => update(face.id, { setback: Number(e.target.value), off: [] })}
                    className="mt-1 w-full"
                  />
                </label>
                <div className={clsx("rounded-md text-sm", pitchDue.includes(face.id) && "animate-pulse bg-sun p-2 ring-2 ring-sun-line")}>
                  <label className="block">
                    <span className="flex justify-between">
                      {pitchDue.includes(face.id) ? "Check the roof pitch" : "Roof pitch"}{" "}
                      <span className="tabular-nums">{face.tilt ?? TILT.roof}°</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={TILT.max}
                      value={face.tilt ?? TILT.roof}
                      onChange={(e) => {
                        update(face.id, { tilt: Number(e.target.value) });
                        setPitchDue((due) => due.filter((x) => x !== face.id));
                      }}
                      {...slides}
                      className="mt-1 w-full"
                    />
                  </label>
                  {pitchDue.includes(face.id) && (
                    <button
                      type="button"
                      onClick={() => setPitchDue((due) => due.filter((x) => x !== face.id))}
                      className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-ink"
                    >
                      <Check className="size-3.5" aria-hidden /> Keep {face.tilt ?? TILT.roof}°
                    </button>
                  )}
                </div>
                <p className="text-sm text-ink-2">
                  Its panels face {compass(faceFacing(face))} ({faceFacing(face)}°), square to the rows: the arrows.{" "}
                  <strong className="font-semibold text-ink">{besideFlat(face.tilt ?? TILT.roof, faceFacing(face))}</strong> over a year.
                </p>
                <label className="block text-sm">
                  Slopes down towards
                  <select
                    value={face.facing}
                    onChange={(e) => update(face.id, { facing: e.target.value as Facing })}
                    className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3"
                  >
                    {FACINGS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-muted">
                  Changing the rows, the layout or the edge distance lays this face&apos;s rows out afresh. Panels placed by hand stay where
                  they are.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className={button} onClick={() => update(face.id, { off: [] })} disabled={!face.off.length}>
                    Put every row panel back
                  </button>
                  <button className={clsx(button, "text-danger")} onClick={() => removeFace(face.id)}>
                    Delete this face
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
        {/* Beside the picture, one view at a time. Every view stays on the page, only hidden, so the quote keeps working
            out the figures above while another view (or none) is open. In Proposal view the column lies over the picture's
            right half, so the proposal, its chat and timeline have room (3 Nov 2026, Martin, as Primero's); the picture
            keeps its size underneath. */}
        {/* The handle on the right edge: hovering a view (or pressing it) brings the column out over the picture. */}
        {/* Not in the pop-up: the rounds beside the window switch the views there (8 Nov 2026, Martin), a site's too. */}
        {!peek && shown && !props.tight && (
          <div
            className="absolute right-0 top-24 z-40 flex flex-col gap-1 rounded-l-2xl bg-surface/95 p-1 shadow-[-6px_6px_24px_rgba(20,22,26,0.16)] ring-1 ring-line backdrop-blur"
            aria-label="Beside the picture"
          >
            {SIDE_VIEWS.filter((v) => (v.id !== "quote" || !costsHidden) && (v.id !== "proposal" || !props.sitesOnly)).map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseEnter={() => showSide(v.id)}
                onClick={() => showSide(v.id)}
                title={v.hint}
                className="relative flex w-9 flex-col items-center gap-1.5 rounded-xl py-2.5 text-[11px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                {v.id === "designer" ? (
                  <PenTool className="size-4" aria-hidden />
                ) : v.id === "quote" ? (
                  <ReceiptText className="size-4" aria-hidden />
                ) : (
                  <FileText className="size-4" aria-hidden />
                )}
                <span className="[writing-mode:vertical-rl]">{v.label}</span>
                {v.id === "proposal" && (props.waiting ?? 0) > 0 && (
                  <span className="absolute -left-1.5 -top-1 min-w-5 rounded-full bg-sun-line px-1 text-center text-[10px] font-semibold leading-5 text-white">
                    {props.waiting}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <div
          onMouseEnter={holdPeek}
          onMouseLeave={(e) => {
            // Leaving it folds it away, unless something in it is being typed in.
            const box = e.currentTarget;
            holdPeek();
            // The quote stays out until another view is chosen or it is closed (8 Nov 2026, Martin): it is worked in.
            if (sideNow.current.side === "quote") return;
            peekTimer.current = window.setTimeout(() => {
              const typing =
                box.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
              if (!typing) setPeek(false);
            }, 450);
          }}
          className={clsx(
            "absolute right-0 top-0 z-40 transition duration-200 ease-out motion-reduce:transition-none",
            shown === "proposal"
              ? "w-[min(calc(50%+10rem),100%)]"
              : shown === "quote" && quoteShort
                ? "w-[min(15rem,100%)]"
                : shown === "quote"
                  ? // The quote's lines down one side, what needs deciding on the other (8 Nov 2026, Martin).
                    "w-[min(calc(100%-5rem),56rem)]"
                  : "w-[min(26rem,100%)]",
            peek ? "translate-x-0 opacity-100" : "pointer-events-none invisible translate-x-6 opacity-0",
            !shown && "hidden",
          )}
        >
          <div
            className="max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto overscroll-contain rounded-3xl bg-canvas/95 p-3 shadow-[0_12px_40px_rgba(20,22,26,0.22)] ring-1 ring-line backdrop-blur"
            // No taller than the first fold, so it scrolls inside itself and never the page under it.
            style={foldPx ? { maxHeight: foldPx } : undefined}
          >
            {/* One view at a time, chosen at the top of the column (as Primero's); the cross folds it away. */}
            <div className="flex items-center justify-end gap-1.5">
              <div
                role="tablist"
                aria-label="Beside the picture"
                className={clsx("flex-1 rounded-lg border border-line bg-surface-2 p-1", props.tight ? "hidden" : "flex")}
              >
                {SIDE_VIEWS.filter((v) => (v.id !== "quote" || !costsHidden) && (v.id !== "proposal" || !props.sitesOnly)).map((v) => (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={shown === v.id}
                    onClick={() => showSide(v.id)}
                    title={v.hint}
                    className={clsx(
                      "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium tabular-nums",
                      shown === v.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {v.label}
                    {v.id === "quote" && net !== null ? <span className="text-ink-2">· {dollars(net)}</span> : null}
                    {v.id === "proposal" && (props.waiting ?? 0) > 0 && (
                      <span
                        className="rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white"
                        aria-label={`${props.waiting} waiting`}
                      >
                        {props.waiting}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPeek(false)}
                aria-label="Fold it away"
                title="Fold it away"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className={clsx("space-y-3", shown !== "designer" && "hidden")}>
              <section className="rounded-lg border border-line bg-surface p-3" aria-label="This home">
                <HomeToggles
                  form={quoteNow.form}
                  onPick={(name, value) => setQuote({ ...quoteNow, form: { ...quoteNow.form, [name]: value } as QuoteFields["form"] })}
                />
                {!props.sitesOnly && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
                    className="mt-3 flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm font-medium text-ink hover:border-forest"
                  >
                    <SolIcon className="size-5" />
                    Ask Sol about this design
                  </button>
                )}
              </section>
              {/* The switchboard from a photo: Sol reads it, a rule suggests the upgrade and RCBO, one press puts them on the quote. */}
              <section className="rounded-lg border border-line bg-surface p-3" aria-label="The switchboard">
                <p className="text-sm font-medium text-ink">The switchboard</p>
                <p className="mt-0.5 text-xs text-muted">
                  A photo of the board, cover open: Sol reads its phases, spare spaces and safety switches.
                </p>
                <div className="mt-2">
                  <CaptureButtons
                    onFiles={(files) => files[0] && void readBoard(files[0])}
                    accept="image/jpeg,image/png,image/webp"
                    busy={Boolean(board?.busy)}
                    photoLabel="Photo of the board"
                    fileLabel="Choose a photo"
                    desktopLabel="Read a switchboard photo"
                    size="sm"
                  />
                </div>
                {board?.error && <p className="mt-2 rounded-md bg-warning-soft px-2.5 py-2 text-xs text-warning">{board.error}</p>}
                {board?.advice && (
                  <div className="mt-2 rounded-md bg-surface-2 p-2.5 text-xs text-ink">
                    {/* The two answers first (3 Nov 2026, Martin): which phase, and whether the solar's circuits fit. */}
                    <p className="text-sm font-semibold">{board.advice.phaseLine}</p>
                    <p
                      className={clsx(
                        "mt-1 text-sm font-semibold",
                        board.advice.room === "yes" ? "text-positive" : board.advice.room === "no" ? "text-danger" : "text-sun-ink",
                      )}
                    >
                      {board.advice.roomLine}
                    </p>
                    <ul className="mt-2 space-y-1 border-t border-line pt-2 text-ink-2">
                      {board.advice.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-ink-2">
                      Suggests: switchboard upgrade{" "}
                      <strong>{board.advice.upgrade === null ? "to check" : board.advice.upgrade ? "included" : "left out"}</strong>, RCBO{" "}
                      <strong>{board.advice.rcbo === null ? "to check" : board.advice.rcbo ? "included" : "left out"}</strong>
                      {board.advice.phase ? `, ${board.advice.phase}-phase` : ""}.
                    </p>
                    {!costsHidden &&
                      (board.applied ? (
                        <p className="mt-2 font-medium text-positive">On the quote: change it there like any decision.</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => applyBoard(board.advice!)}
                          className="mt-2 inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-ink"
                        >
                          Put this on the quote
                        </button>
                      ))}
                    <p className="mt-2 text-[11px] text-muted">A guide from a photo, not the electrician&apos;s assessment of the board.</p>
                  </div>
                )}
              </section>
              {props.notes}
            </div>
            <div className={clsx(shown !== "quote" && "hidden")}>
              <DesignQuote
                design={`Design ${active + 1} of ${designs.length}${active === primary ? " (primary)" : ""}`}
                onDesign={designs.length > 1 ? (step) => show(everyDesign(), (active + step + designs.length) % designs.length) : undefined}
                spec={spec}
                workspace={props.workspace}
                rates={props.rates}
                value={quoteNow}
                onChange={setQuote}
                onNet={onNet}
                compact={quoteShort}
                wide={shown === "quote" && !quoteShort}
                onCompact={shortQuote}
                homeless
              />
            </div>
            <div className={clsx("space-y-3", shown !== "proposal" && "hidden")}>
              <section className="rounded-lg border border-line bg-surface p-3" aria-label="Proposal">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Proposal</p>
                <p className="mt-1 text-sm text-ink-2">
                  {props.proposalHref
                    ? "Publish design brings the proposal up to date. Its link stays the same."
                    : "Publish design makes the proposal from the starred design."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.proposalHref ? (
                    <Link href={props.proposalHref} className={button}>
                      <FileText className="mr-1.5 size-4" aria-hidden /> View proposal
                    </Link>
                  ) : (
                    <button disabled title="Publish the design first: that makes its proposal" className={button}>
                      <FileText className="mr-1.5 size-4" aria-hidden /> View proposal
                    </button>
                  )}
                </div>
              </section>
              {props.proposal}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
