"use client";

import Link from "next/link";
import { accessColour, shadeReport, type ShadeReport, type Terrain } from "@/lib/domain/design/shade";
import { loadTerrain } from "@/lib/services/terrain";
import { loadModelFit, loadRoofInfo, loadRoofModel } from "@/lib/services/roof-model";
import { MOUNT_STANDOFF, clearanceFor, laidAs, packFaces, reorient } from "@/lib/domain/design/pack";
import { edgeShift, snapShift } from "@/lib/domain/design/snap";
import { faceFromAspect, readAspect, type AspectReading } from "@/lib/domain/design/face-aspect";
import { NO_BILL_KW, SELF_DESIGN_AIMS, SELF_DESIGN_LABELS, selfDesign, type SelfDesignResult } from "@/lib/domain/design/self-design";
import { todayInMarket } from "@/lib/domain/market";
import { GROUND_COLOURS, faceShade, facesFromModel, groundOf, tidyGround, type DrawnFace, type Ground } from "@/lib/domain/design/drawing";
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
  Redo2,
  Ruler,
  SquarePlus,
  Star,
  Tag,
  TriangleAlert,
  WandSparkles,
  Sparkles,
  FileText,
  Layers,
  SunMedium,
  LayoutGrid,
  Send,
  Trash2,
  X,
  ChevronDown,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { DESIGN_TEMPERATURES, HOT_CELL, checkString, type StringCheck } from "@/lib/domain/design/electrical";
import type { CatalogueBattery, CatalogueInverter, CataloguePanel } from "@/lib/domain/design/catalogue";
import type { Workspace } from "@/lib/domain/design/pricing";
import {
  defaultQuote,
  DAY,
  designFinance,
  type BillInterval,
  type DesignExtras,
  type QuoteFields,
  type SystemSpec,
} from "@/lib/domain/design/quote";
import type { RebateRates } from "@/lib/domain/rebates";
import { DesignQuote } from "./design-quote";
import type { RoofModel } from "@/lib/domain/roof-layout";
import { MAX_SUGGESTED, mismatchNote, modelOffset, suggestPanels } from "@/lib/domain/design/suggest";
import { shiftingKwhOf, systemSpecOf } from "@/lib/domain/design/system";
import { arrayOversize, suggestInverters, type InverterSuggestion } from "@/lib/domain/design/inverter-suggest";
import { autoStringDesign } from "@/lib/domain/design/auto-string";
import { suggestBatteries } from "@/lib/domain/design/battery-suggest";
import { TILT, bestTilt, compass, gainOverFlat } from "@/lib/domain/design/tilt";
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
  facePanels,
  faceArea,
  faceFacing,
  freed,
  inverterSpot,
  inside,
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
  type RoofDesign,
} from "@/lib/domain/design/roof-design";

const GOLD = "var(--sun-line)";

/** How much lighter the roof being designed is drawn than the buildings around it, in drawing mode. */
const OWN_ROOF_LIFT = 62;
/** One colour a string, so they can be told apart on the roof. */
const STRING_COLOURS = ["#86efac", "#f9a8d4", "#fdba74", "#fde047", "#7dd3fc", "#c4b5fd", "#fca5a5", "#5eead4"];
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
    hint: "Zoom in with the mouse wheel or the + button, then press and drag the picture to move around it.",
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
const GLASS = "rounded-2xl border border-line bg-surface/90 shadow-lift backdrop-blur-md";

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
  [-5, -34],
  [-1, -17],
  [90, 0],
  [1, 17],
  [5, 34],
];

/** What was read of a face's slope from Google's data, with the way to read it again. */
function SlopeNote(props: { slope: AspectReading | "busy" | "none" | undefined; onRead: () => void }) {
  const { slope } = props;
  if (slope === "busy") return <p className="text-sm text-muted">Reading this face&apos;s slope from Google&apos;s height data…</p>;
  const again = (
    <button className="tap-area font-medium text-ink underline underline-offset-2" onClick={props.onRead}>
      {slope ? "Read it again" : "Read the slope from Google's data"}
    </button>
  );
  if (!slope) return <p className="text-sm text-ink-2">{again}</p>;
  if (slope === "none")
    return (
      <p className="text-sm text-ink-2">
        Google&apos;s data couldn&apos;t tell which way this face slopes. Set the direction and pitch below. {again}
      </p>
    );
  const { aspect, disagrees } = slope;
  return (
    <p className="text-sm text-ink-2">
      {aspect.flat
        ? `Read as flat (about ${Math.round(aspect.pitch)}°) from Google's ${aspect.from === "heights" ? "height data" : "roof model"}.`
        : `Slope read from Google's ${aspect.from === "heights" ? "height data" : "roof model"}: down towards ${compass(aspect.azimuth)} at about ${Math.round(aspect.pitch)}°.`}{" "}
      {disagrees && <strong className="font-semibold text-ink">Google&apos;s roof model points another way. </strong>}
      Google&apos;s data can be older than the roof: check it against the photo. {again}
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
      className="absolute right-0 top-[56%] z-10 -translate-y-1/2 rounded-l-full border border-r-0 border-line bg-surface/90 shadow-lift backdrop-blur-md"
      style={{ width: `${R}rem`, height: `${R * 2}rem` }}
      role="group"
      aria-label={props.label}
    >
      <button
        className={clsx(round, "size-11 text-ink-2 hover:text-ink")}
        style={at(-50, R - 3)}
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
            className={clsx(round, "size-11 text-sm font-semibold tabular-nums text-ink")}
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
          className={clsx(round, "size-11 text-danger")}
          style={at(50, R - 3)}
          onClick={props.onRemove}
          title="Take out what is picked (Delete)"
          aria-label="Take out what is picked"
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
      )}
      <div className="absolute right-3 top-1/2 w-[6rem] -translate-y-1/2 text-right">{props.children}</div>
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

/** A panel as the Landscape button draws it: a rectangle with a small triangle at one end, so its way round reads. */
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
/**
 * The widest the picture may be and still fit the window with the bar and the figures above it: the picture is
 * given all the room there is, since it is where the work is done.
 */
const FIT = `calc((100dvh - 14rem) * ${ROOF_IMAGE.width / ROOF_IMAGE.height})`;
const WHOLE: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: ROOF_IMAGE.width, h: ROOF_IMAGE.height };

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
  /** What to say once saved: where the work is kept ("Saved to your account", "Saved on this device"). */
  savedLabel?: string;
  /** Makes the proposal from the design just saved. Answers with what went wrong, or null. */
  onPublish?: () => Promise<string | null>;
  /** For a roof opened from a deal: sends a note to the customer in the job's conversation, with the proposal just published. Answers what happened. */
  onNote?: (text: string) => Promise<{ ok: boolean; message: string }>;
  /** Who the note goes to, for the box's wording. */
  customerName?: string;
  /** Where this roof's proposal is, once there is one. */
  proposalHref?: string | null;
  /** The conversation with the customer, for a roof opened from a deal: drawn by the page, shown beside View proposal. */
  chat?: React.ReactNode;
  /**
   * The person may not see costs (the owner's setting, enforced on the server, which sends them no costs at all):
   * no quote and no price are shown, and no price is handed on when saving.
   */
  costsHidden?: boolean;
  /** Told whenever the design gains or loses unsaved changes, so the page can ask before leaving it. */
  onUnsaved?: (unsaved: boolean) => void;
  /** The start of the bar at the top of the page (the wordmark and the address), and the way out, drawn by the page. */
  bar?: React.ReactNode;
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
  const [menu, setMenu] = useState<"designs" | "panels" | "inverters" | "batteries" | "bill" | false>(false);
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
  // The customer's electricity bill, as typed in from it: what the summary's bill, saving and payback are worked out from.
  const [bill, setBillFields] = useState(props.extras.bill);
  // Each design's quote settings and hand changes, in the designs' order.
  const [quotes, setQuotes] = useState<QuoteFields[]>(props.extras.quotes);
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
  const [autoNote, setAutoNote] = useState<{ ok: boolean; note: string } | null>(null);
  const [labels, setLabels] = useState<DesignLabel[]>(first.labels ?? []);
  const [panel, setPanel] = useState<PanelSpec | undefined>(first.panel);
  const [designLabel, setDesignLabel] = useState(first.label ?? "");
  // Guide lines along roof edges, and the one being drawn: its first end, and where the pointer has it reaching.
  const [rules, setRules] = useState<GuideLine[]>(first.guides ?? []);
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
  const [addLandscape, setAddLandscape] = useState(false);
  // The two bubbles fanned out of Add a panel, like a hand of cards: open from a press on the tool, gone once one is chosen.
  const [fanOpen, setFanOpen] = useState(false);
  // The battery or the inverter under the pointer: its details show beside it.
  const [kit, setKit] = useState<"battery" | number | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  // "Suggest a layout": how many panels to lay, and what came of asking.
  const [want, setWant] = useState(14);
  const [idea, setIdea] = useState<"idle" | "busy" | { note: string; bad?: boolean }>("idle");
  // Whether the quote is open beside the picture. Closed, the picture has the whole width; the choice is kept on this device.
  const [quoteOpen, setQuoteOpen] = useState(false);
  useEffect(() => {
    try {
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem("renuabl.design.quote-open") === "1") setQuoteOpen(true);
    } catch {
      // Storage is off: the quote starts closed.
    }
  }, []);
  const toggleQuote = () => {
    const next = !quoteOpen;
    setQuoteOpen(next);
    try {
      window.localStorage.setItem("renuabl.design.quote-open", next ? "1" : "0");
    } catch {
      // Nothing to do: it still opens and closes for this visit.
    }
  };
  // Whether "Suggest a layout" is asking how many panels.
  const [asking, setAsking] = useState(false);
  // "Design it for me": working, or the three designs it made and what to know about them.
  const [mine, setMine] = useState<"idle" | "busy" | SelfDesignResult>("idle");
  // Whether "Design it for me" is saying what it will do, before it does it.
  const [mineIntro, setMineIntro] = useState(false);
  // Whether that card is open: it folds to a chip once a design is picked, so the roof has the room.
  const [mineOpen, setMineOpen] = useState(true);
  /** Takes up a tool, leaving behind anything half-drawn with the last one. */
  const pickTool = (t: Tool) => {
    setTool(t);
    setFanOpen(false);
    setTracing([]);
    setRuling(null);
    setArrayHint(null);
    setOnPanel(false);
  };
  const [view, setView] = useState(WHOLE);
  const [selected, setSelected] = useState<string | null>(first.faces[0]?.id ?? null);
  const [picks, setPicks] = useState<Pick[]>([]);
  // Drawing mode: the photo put away and the roof drawn plainly in its place. Kept on the device.
  const [drawn, setDrawn] = useState(false);
  // The roof's faces from Google's roof model, for the drawing: null until asked for, "none" when there is no data.
  const [modelFaces, setModelFaces] = useState<DrawnFace[] | "none" | null>(null);
  useEffect(() => {
    try {
      // What was chosen last time is only known once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem("renuabl.design.drawn") === "1") setDrawn(true);
    } catch {
      // The photo, then.
    }
  }, []);
  useEffect(() => {
    // The first time the drawing is asked for on a roof, Google's roof model is fetched once (the server keeps it).
    if (!drawn || modelFaces !== null) return;
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
  }, [drawn, modelFaces]);
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
  const toggleDrawn = () => {
    const next = !drawn;
    setDrawn(next);
    try {
      window.localStorage.setItem("renuabl.design.drawn", next ? "1" : "0");
    } catch {
      // It still holds for this visit.
    }
  };
  // The heights of everything around the roof (Google's): asked for the first time the shade analysis is wanted.
  const [terrain, setTerrain] = useState<Terrain | "none" | null>(null);
  const [shadeOn, setShadeOn] = useState(false);
  // The shade on the design as it stands: each panel's access to the sun by its key, and the design's as a whole.
  const [shade, setShade] = useState<{ report: ShadeReport; keys: string[] } | null>(null);
  useEffect(() => {
    if (!shadeOn || terrain !== null) return;
    let gone = false;
    void loadTerrain(spot.lat, spot.lng).then((found) => !gone && setTerrain(found ?? "none"));
    return () => {
      gone = true;
    };
    // The roof's place never changes for the life of this designer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadeOn, terrain]);
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
  const [ghosts, setGhosts] = useState<LoosePanel[]>([]);
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
  const [saved, setSaved] = useState<"saved" | "saving" | "changed" | { error: string }>("saved");
  const { onUnsaved } = props;
  useEffect(() => onUnsaved?.(saved !== "saved"), [onUnsaved, saved]);
  const svg = useRef<SVGSVGElement>(null);
  // A press that may turn into a drag: of what is picked, of a box to pick with, or of the picture itself.
  const press = useRef<
    | { mode: "move"; at: Point; picks: Pick[]; starts: Record<string, Point> | null; others?: LoosePanel[] }
    | { mode: "band"; at: Point; face: string | null; add: boolean; moved: boolean }
    | { mode: "pan"; x: number; y: number; from: typeof WHOLE }
    | { mode: "turn"; id: string; centre: Point }
    | { mode: "array"; anchor: LoosePanel }
    | { mode: "wire"; id: string; first: string; had: boolean; dragged: boolean }
    | { mode: "battery"; dx: number; dy: number }
    | { mode: "inverter"; n: number; dx: number; dy: number }
    | { mode: "erase" }
    | { mode: "spin"; centre: Point; from: number; starts: Record<string, LoosePanel> }
    | null
  >(null);

  // Undo and redo. The drawing (faces, panels, strings, labels) is remembered each time it changes: once for
  // a click, and once for a whole drag however far it went. Comments aren't part of it: they are saved as posted.
  const drawing = useMemo(
    () => ({ faces, loose, strings, labels, panel, fitted, rules, battery }),
    [faces, loose, strings, labels, panel, fitted, rules, battery],
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
  const px = (p: Point) => [ROOF_IMAGE.width / 2 + p.x / scale, ROOF_IMAGE.height / 2 + p.y / scale] as const;
  const path = (points: readonly Point[]) => points.map((p) => px(p).join(",")).join(" ");
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
    ...(battery ? { battery } : {}),
    ...(designLabel.trim() ? { label: designLabel.trim().slice(0, 40) } : {}),
  });
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
    setBattery(next.battery);
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
    setBillFields(next);
    setSaved("changed");
  };
  // The quote's postcode is the roof's own: the one in the address searched for. One typed before that rule stays only where the address has none.
  const stored = quotes[active] ?? defaultQuote(props.postcode);
  const quoteNow = props.postcode ? { ...stored, form: { ...stored.form, postcode: props.postcode } } : stored;
  const everyQuote = () => designs.map((_, i) => quotes[i] ?? defaultQuote(props.postcode));
  const setQuote = (next: QuoteFields) => {
    setQuotes(designs.map((_, i) => (i === active ? next : (quotes[i] ?? defaultQuote(props.postcode)))));
    setSaved("changed");
  };
  const addDesign = (copy: boolean) => {
    const list = everyDesign();
    if (list.length >= MAX_DESIGNS) return;
    const made: RoofDesign = copy
      ? { ...working(), label: undefined }
      : { ...spot, faces: [], loose: [], ...(panel ? { panel } : {}), ...(fitted.length ? { inverters: fitted } : {}) };
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
      return Math.abs(p.x - at.x) < 13 * u * scale && Math.abs(p.y - at.y) < 17 * u * scale;
    });
    if (n >= 0) return n;
    if (battery && Math.abs(p.x - battery.x) < 16 * u * scale && Math.abs(p.y - battery.y) < ((batteryLayers * 8) / 2 + 12) * u * scale)
      return "battery";
    return null;
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

  // The mouse wheel zooms in and out about the pointer, so the spot under it stays put.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const fx = (e.clientX - box.left) / box.width;
      const fy = (e.clientY - box.top) / box.height;
      setView((v) => {
        const w = Math.min(ROOF_IMAGE.width, Math.max(40, v.w * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
        const h = (w * ROOF_IMAGE.height) / ROOF_IMAGE.width;
        return {
          x: Math.min(Math.max(0, v.x + fx * v.w - fx * w), ROOF_IMAGE.width - w),
          y: Math.min(Math.max(0, v.y + fy * v.h - fy * h), ROOF_IMAGE.height - h),
          w,
          h,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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
  const ghostAt = (p: Point): LoosePanel | null => {
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
        if (Boolean(from.across) !== addLandscape) continue;
        const { stepX, stepY } = stepsOf(from);
        const away = Math.hypot(p.x - from.x, p.y - from.y);
        if (away > stepY * 1.6 || (beside && away >= beside.away)) continue;
        const t = (from.angle * Math.PI) / 180;
        const i = Math.round(((p.x - from.x) * Math.cos(t) + (p.y - from.y) * Math.sin(t)) / stepX);
        const j = Math.round((-(p.x - from.x) * Math.sin(t) + (p.y - from.y) * Math.cos(t)) / stepY);
        if ((i || j) && Math.abs(i) <= 1 && Math.abs(j) <= 1) beside = { from, i, j, away };
      }
      if (beside) {
        const { stepX, stepY } = stepsOf(beside.from);
        const t = (beside.from.angle * Math.PI) / 180;
        const x = cm(beside.from.x + beside.i * stepX * Math.cos(t) - beside.j * stepY * Math.sin(t));
        const y = cm(beside.from.y + beside.i * stepX * Math.sin(t) + beside.j * stepY * Math.cos(t));
        if (!standingNow.some((other) => Math.hypot(other.x - x, other.y - y) < 0.4)) return { ...beside.from, id: "ghost", x, y };
      }
      const on = [...faces].reverse().find((f) => inside(p, f.points));
      return laidAs(
        on
          ? { ...freed(on, { index: 0, corners: [p, p, p, p] }, "ghost"), x: p.x, y: p.y }
          : { id: "ghost", x: p.x, y: p.y, angle: 0, tilt: TILT.roof },
        addLandscape,
      );
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
      x: Math.min(Math.max(0, cx - w / 2), ROOF_IMAGE.width - w),
      y: Math.min(Math.max(0, cy - h / 2), ROOF_IMAGE.height - h),
      w,
      h,
    });
  };

  const finish = (points: Point[]) => {
    setTracing([]);
    if (points.length < 3) return;
    const id = newId("f");
    const made: Face = { id, points, angle: 0, landscape: false, setback: 0.3, facing: "N", tilt: TILT.roof, off: [], plan: true };
    setFaces([...faces, { ...made, angle: angleOfLongestEdge(made) }]);
    changed();
    setSelected(id);
    setPicks([]);
    setTool("select");
    void readSlope(id, points, false);
  };

  /**
   * Which way a face slopes and how steeply, read from Google's heights (else its roof model), and the face's rows
   * laid to it: along the gutter, looking down the slope, at the roof's pitch (`face-aspect.ts`). A face just
   * traced takes it only while nobody has turned its rows, picked a direction or set a pitch in the meantime;
   * asked for again (`again`), it always does.
   */
  const readSlope = async (id: string, points: Point[], again: boolean) => {
    setSlopes((s) => ({ ...s, [id]: "busy" }));
    const [heights, model] = await Promise.all([loadTerrain(spot.lat, spot.lng), loadRoofModel(spot.lat, spot.lng)]);
    if (heights) setTerrain((t) => (t && t !== "none" ? t : heights));
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
  const turn = (degrees: number) => {
    if (!panelPicks.length) return;
    const next = byHand(panelPicks);
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
  const turnLandscape = (landscape: boolean) => {
    if (!panelPicks.length) return;
    const next = byHand(panelPicks);
    const group = next.loose.filter((p) => next.ids.includes(p.id));
    const turned = new Map(reorient(group, size, landscape).map((p) => [p.id, p]));
    setFaces(next.faces);
    setStrings(next.strings);
    setLoose(next.loose.map((p) => turned.get(p.id) ?? p));
    setPicks([...next.ids.map((id): Pick => ({ kind: "loose", id })), ...picks.filter((p) => p.kind === "label")]);
    changed();
  };

  /** Changes each picked panel where it stands (its tilt). One in a row comes out of the row. */
  const amend = (change: (panel: LoosePanel) => LoosePanel) => {
    if (!panelPicks.length) return;
    const next = byHand(panelPicks);
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
  const eraseAt = (p: Point) => {
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
      changed();
    }
  };

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
      } else if ((e.key === "Delete" || e.key === "Backspace") && picks.length) {
        e.preventDefault();
        removePicked();
      } else if (e.key === "Escape") {
        setPicks([]);
        setTracing([]);
        setThread(null);
        openMenu(false);
        setRuling(null);
        setChecking(null);
        setFanOpen(false);
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
      at: { x: box[2] + 7 * u * scale, y: box[1] - 7 * u * scale },
      box,
    };
  };
  /** Whether a press here is on the small round that picks the whole array. */
  const onArrayHint = (p: Point) => arrayHint !== null && Math.hypot(p.x - arrayHint.at.x, p.y - arrayHint.at.y) < 8 * u * scale;

  const onPointerDown = (e: React.PointerEvent) => {
    // A press puts the string check away: it would sit over what is being dragged.
    setHover(null);
    // Working on the picture takes the keyboard with it: a slider or button used a moment ago lets go of it.
    const focused = document.activeElement as HTMLElement | null;
    if (focused && focused !== document.body && focused.tagName !== "TEXTAREA") focused.blur();
    const p = pointAt(e);
    if (!p) return;
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
    const grabbed = tool === "select" ? kitAt(p) : null;
    if (grabbed !== null) {
      // The battery or an inverter: press it and drag it to the wall it will go on.
      svg.current?.setPointerCapture(e.pointerId);
      setPicks([]);
      setKit(null);
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
    if (held.mode === "battery") {
      const p = pointAt(e);
      if (!p) return;
      setBattery((b) => (b ? { ...b, x: cm(p.x - held.dx), y: cm(p.y - held.dy) } : b));
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
        x: Math.min(Math.max(0, held.from.x - dx), ROOF_IMAGE.width - held.from.w),
        y: Math.min(Math.max(0, held.from.y - dy), ROOF_IMAGE.height - held.from.h),
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

  const onPointerUp = (e: React.PointerEvent) => {
    const held = press.current;
    press.current = null;
    svg.current?.releasePointerCapture(e.pointerId);
    // The drag is over: whatever it changed becomes one step to undo.
    setSettled((n) => n + 1);
    if (held?.mode === "spin") return setSpinAt(0);
    if (held?.mode === "wire") {
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
      const placed = ghosts.map((g) => ({ ...g, id: newId("p") }));
      if (placed.length) {
        setLoose([...loose, ...placed]);
        setPicks(placed.map((g): Pick => ({ kind: "loose", id: g.id })));
        changed();
        // An array dragged out is done: the arrow takes over, with the whole array picked. A single panel placed
        // leaves the tool on, to go on adding.
        if (placed.length > 1) {
          setTool("select");
          setOnPanel(false);
        }
      }
      return setGhosts([]);
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
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<{ ok: boolean; message: string } | null>(null);
  const save = async () => {
    setSaved("saving");
    // The price after STCs goes with it only when the primary design is the one open: that is the one a job is quoted on.
    const problem = await props.onSave(
      { designs: everyDesign(), primary, comments },
      { bill, quotes: everyQuote() },
      active === primary ? net : null,
    );
    setSaved(problem ? { error: problem } : "saved");
    return !problem;
  };

  const button =
    "inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-forest disabled:bg-surface-2 disabled:text-muted disabled:hover:border-line";
  const label = "text-[10px] font-medium uppercase tracking-[0.18em] text-muted";
  const stringOf = (key: string) => strings.findIndex((s) => s.panels.includes(key));
  /** Every panel on the design as it stands on the roof: where, its tilt and the way it faces. For the shade analysis. */
  const standingPanels = shadeOn
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
    shadeOn && terrain && terrain !== "none" ? standingPanels.map((p) => `${p.key}:${p.x},${p.y},${p.tilt},${p.facing}`).join("|") : null;
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
  const finance =
    summary.panels > 0
      ? designFinance(
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
        )
      : null;
  const dollars = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-AU");
  // The system as the quote reads it. Worked out in the domain (systemSpecOf), so a published proposal reads the design the same way.
  const firstListed = props.catalogue[0];
  const spec: SystemSpec = useMemo(
    () => systemSpecOf({ ...design, inverters: fitted, battery }, firstListed),
    [design, fitted, battery, firstListed],
  );
  // Panels beyond 133% of the inverters: a warning over the picture, unless a battery is on the design.
  const oversize = arrayOversize(summary.kw, fittedKw, Boolean(battery));
  // A string that has been started and has no panel yet.
  const startedString = tool === "string" && wiring !== null && !strings.some((x) => x.id === wiring);
  /**
   * Google's roof model, put where it belongs on the picture: lined up with today's photo (`loadModelFit`), or, when
   * Google's own photo of the roof doesn't match today's (often a roof that has changed since), not used at all.
   */
  const googleModelInPlace = async (): Promise<{ model: RoofModel; offset?: { x: number; y: number } } | { note: string }> => {
    const [info, fit] = await Promise.all([loadRoofInfo(spot.lat, spot.lng), loadModelFit(spot.lat, spot.lng)]);
    if (!info.model) return { note: "There's no roof data for this address to work from. Trace the roof faces, then ask again." };
    if (fit.kind === "mismatch") return { note: mismatchNote(info.imageryDate) };
    return { model: info.model, ...(fit.kind === "aligned" ? { offset: modelOffset(fit.shift, spot.lat) } : {}) };
  };
  /**
   * A first layout, in the fewest long straight rows: on the roof faces traced (`packFaces`), or
   * else from Google's roof model lined up with today's photo (`suggestPanels`), set down as panels placed by hand.
   * It replaces the panels on the design (asked first); traced faces are kept.
   */
  const suggestLayout = async () => {
    if (
      (faces.some((f) => facePanels(f, size).length) || loose.length) &&
      !window.confirm("Replace the panels on this design with a suggested layout?")
    )
      return;
    setIdea("busy");
    if (faces.length) {
      // Laid afresh on the traced faces by the installer's rules, as panels placed by hand (`packFaces`).
      const packed = packFaces(faces, size, want, () => newId("p"));
      if (!packed.loose.length)
        return setIdea({
          bad: true,
          note: "No panels fit on the traced faces with the distance kept from the edges. Check their outlines.",
        });
      setFaces(packed.faces);
      setLoose(packed.loose);
      setStrings([]);
      setPicks(packed.loose.map((p): Pick => ({ kind: "loose", id: p.id })));
      changed();
      setTool("select");
      return setIdea({
        note:
          (packed.loose.length < want
            ? `Only ${packed.loose.length} fit in tidy rows on the traced faces, clear of the edges. `
            : `${packed.loose.length} panels in rows on the traced faces. `) +
          "Check them against the picture: take off any that sit on a vent or skylight.",
      });
    }
    try {
      const found = await googleModelInPlace();
      if ("note" in found) return setIdea({ bad: true, note: found.note });
      const made = suggestPanels(found.model, spot, want, size, () => newId("p"), found.offset);
      if (!made.length)
        return setIdea({ bad: true, note: "No panels could be laid from Google's roof data. Trace the roof faces instead." });
      setFaces([]);
      setLoose(made);
      setStrings([]);
      setSelected(null);
      setPicks(made.map((p): Pick => ({ kind: "loose", id: p.id })));
      changed();
      setTool("select");
      setIdea({
        note:
          (made.length < want
            ? `Only ${made.length} fit in rows on the roof Google measured. `
            : `${made.length} panels in rows from Google's roof data. `) + "Check them against the picture, then move, turn or remove any.",
      });
    } catch {
      setIdea({ bad: true, note: "We couldn't reach the roof data just now. Try again in a moment, or trace the roof faces." });
    }
  };
  /**
   * "Design it for me": the roof designs itself for three outcomes, the fastest payback, the best return and the most
   * independence (`self-design.ts`), from the traced faces (else Google's roof model), the customer's bill and the
   * business's prices. They replace the roof's designs (asked first), each with its goal, the best return the primary.
   */
  const designForMe = async () => {
    setMineIntro(false);
    setMine("busy");
    let model: RoofModel | null = null;
    let modelOffsetM: { x: number; y: number } | undefined;
    if (!faces.length) {
      const found = await googleModelInPlace();
      if ("note" in found) return setMine({ options: [], notes: [found.note], from: null });
      model = found.model;
      modelOffsetM = found.offset;
    }
    const amount = Number(bill.amount) || 0;
    const rate = Number(bill.rate) || 0;
    const result = selfDesign({
      centre: spot,
      faces,
      model,
      ...(modelOffsetM ? { modelOffset: modelOffsetM } : {}),
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
    setMine(result);
    setMineOpen(true);
    if (!result.options.length) return;
    const list = result.options.map((o) => o.design);
    const lead = Math.max(
      0,
      result.options.findIndex((o) => o.key === "return"),
    );
    setQuotes(list.map(() => ({ form: quoteNow.form, edits: {} })));
    setPrimary(lead);
    show(list, lead);
    setSaved("changed");
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
    setAutoNote({ ok: done.ok, note: done.note });
    if (!done.strings.length) return;
    setStrings(done.strings);
    setWiring(null);
    changed();
  };
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
  const top = Math.max(1, ...year);

  return (
    <div>
      {/* The bar that stays at the top of the page, in two rows so nothing is squashed: the wordmark, the address search
          and the address being designed; then which design this is and its quote on the left, and publishing it and
          its proposal on the right. A firmer line under it sets it off from the work below. */}
      <header className="sticky top-0 z-40 -mx-4 border-b border-line-strong bg-canvas/95 px-4 text-ink backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5 lg:flex-nowrap">
          {props.bar}
          <dl className="flex min-w-0 flex-1 basis-56 items-center gap-x-6 overflow-hidden border-line lg:border-l lg:pl-5">
            <div className="min-w-0 flex-1">
              <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Address</dt>
              <dd className="truncate text-sm">
                <h1>{props.address}</h1>
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line py-2">
          <span className="order-last ml-auto text-xs text-muted lg:order-none lg:ml-0" role="status">
            {saved === "saved"
              ? (props.savedLabel ?? "Saved")
              : saved === "saving"
                ? "Saving…"
                : saved === "changed"
                  ? "Not saved yet"
                  : saved.error}
          </span>
          {/* Which of the roof's designs is open: here in the bar, off the picture. */}
          <div className="relative" data-menu-host>
            <button
              onClick={() => openMenu(menu === "designs" ? false : "designs")}
              aria-expanded={menu === "designs"}
              aria-haspopup="true"
              title={`Design ${active + 1} of ${designs.length}${active === primary ? " (primary)" : ""}${designLabel.trim() ? `: ${designLabel.trim()}` : ""}`}
              aria-label={`Designs: design ${active + 1} of ${designs.length}`}
              className={clsx(
                "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-medium tabular-nums",
                menu === "designs" ? "border-primary bg-surface-2 text-ink" : "border-line bg-surface text-ink hover:border-forest",
              )}
            >
              <Layers className="size-4" aria-hidden />
              <span>
                Design {active + 1} of {designs.length}
              </span>
              {active === primary && <Star className="size-3 fill-sun-line text-sun-line" aria-hidden />}
            </button>
            {menu === "designs" && (
              <div className="absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-[24rem] max-w-[85vw] overflow-y-auto shadow-lift space-y-3 rounded-lg border border-line bg-surface p-3">
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
                <label className="block text-sm">
                  A label for design {active + 1}
                  <input
                    value={designLabel}
                    onChange={(e) => {
                      setDesignLabel(e.target.value);
                      changed();
                    }}
                    maxLength={40}
                    placeholder="e.g. All on the north face"
                    className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-forest"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className={button} disabled={designs.length >= MAX_DESIGNS} onClick={() => addDesign(false)}>
                    <Plus className="mr-1.5 size-4" aria-hidden /> New design
                  </button>
                  <button className={button} disabled={designs.length >= MAX_DESIGNS} onClick={() => addDesign(true)}>
                    <Copy className="mr-1.5 size-4" aria-hidden /> Copy this one
                  </button>
                  <span className="self-center text-xs tabular-nums text-muted">
                    {designs.length} of {MAX_DESIGNS}
                  </span>
                </div>
                <p className="text-xs text-muted">The starred design is the primary: the one this roof opens on.</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleQuote}
            hidden={costsHidden}
            aria-expanded={quoteOpen}
            title={quoteOpen ? "Close the quote: the picture takes the whole width" : "Open the quote beside the picture"}
            className={clsx(
              "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium tabular-nums",
              quoteOpen ? "border-primary bg-surface-2 text-ink" : "border-line bg-surface text-ink hover:border-forest",
            )}
          >
            <ReceiptText className="size-4" aria-hidden />
            Quote{net !== null ? ` · ${dollars(net)}` : ""}
          </button>
          <span className="hidden flex-1 lg:block" aria-hidden />
          {props.chat}
          {/* The design's proposal, once it has been published. */}
          {props.proposalHref ? (
            <Link
              href={props.proposalHref}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-forest"
            >
              <FileText className="size-4" aria-hidden /> View proposal
            </Link>
          ) : (
            <button
              disabled
              title="Publish the design first: that makes its proposal"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface-2 px-4 text-sm font-medium text-muted"
            >
              <FileText className="size-4" aria-hidden /> View proposal
            </button>
          )}
          {/* Publishing saves the design and makes (or brings up to date) its proposal. From a deal it opens a box for a note to the customer, sent with it. */}
          <div className="relative">
            <button
              onClick={() => (props.onNote ? setSending(!sending) : void publish())}
              aria-expanded={props.onNote ? sending : undefined}
              disabled={saved === "saving" || publishing}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
            >
              <Send className="size-4" aria-hidden /> {publishing ? "Publishing…" : "Publish design"}
            </button>
            {sending && props.onNote && (
              <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
                <p className="text-sm font-medium text-ink">Send the proposal{props.customerName ? ` to ${props.customerName}` : ""}</p>
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
        </div>
      </header>

      <div
        className={clsx(
          "mt-5 grid items-start gap-5",
          quoteOpen && !costsHidden && "xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]",
        )}
      >
        <div className="min-w-0">
          <div>
            {/* The figures, in a strip across the top of the picture, read left to right as one chain: what is on the roof, what it makes, what stores and runs it, and what
                  that does to this home's bill. Each has one large figure in the same place every time, with its detail under it. */}
            <section
              className="relative z-30 mx-auto mb-2 flex flex-wrap items-stretch rounded-lg bg-primary text-white"
              style={{ maxWidth: FIT }}
              aria-label="This design in figures"
            >
              {(
                [
                  {
                    step: "1 · Solar",
                    value: summary.kw.toFixed(2),
                    unit: "kW",
                    under: `${summary.panels} ${summary.panels === 1 ? "panel" : "panels"} of ${panelOf(design).watts} W`,
                    gold: true,
                  },
                  {
                    step: "2 · Makes",
                    value: String(summary.kwhPerDay),
                    unit: "kWh a day",
                    under: `${year.reduce((n, kwh) => n + kwh, 0).toLocaleString("en-AU")} kWh a year`,
                    chart: true,
                  },
                  {
                    step: "3 · Stores",
                    value: battery ? String(batteryKwh) : "–",
                    unit: battery ? "kWh battery" : "no battery",
                    under: fitted.length
                      ? `${fittedKw} kW of inverter${oversize ? ` · panels ${oversize.percent}%` : ""}`
                      : "no inverter chosen",
                    warn: Boolean(oversize?.over),
                  },
                ] as { step: string; value: string; unit: string; under: string; gold?: boolean; chart?: boolean; warn?: boolean }[]
              ).map((g) => (
                <div key={g.step} className="relative flex items-center gap-3 border-r border-white/15 px-3.5 py-1.5">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">{g.step}</p>
                    <p className="whitespace-nowrap leading-tight">
                      <span className={clsx("text-xl font-medium tabular-nums tracking-[-0.02em]", g.gold && "text-sun-bright")}>
                        {g.value}
                      </span>
                      <span className="ml-1.5 text-xs text-white/60">{g.unit}</span>
                    </p>
                    <p className={clsx("whitespace-nowrap text-xs tabular-nums", g.warn ? "font-medium text-sun-bright" : "text-white/60")}>
                      {g.under}
                    </p>
                  </div>
                  {g.chart && (
                    <div
                      className="flex w-32 shrink-0 items-end gap-0.5"
                      role="img"
                      aria-label={`Monthly output, from ${year[0]} kWh in January to ${year[5]} in June`}
                    >
                      {year.map((kwh, m) => (
                        <div key={m} className="flex min-w-0 flex-1 flex-col items-center" title={`${kwh.toLocaleString("en-AU")} kWh`}>
                          <div className="flex h-6 w-full items-end justify-center gap-[2px] border-b border-white/40">
                            {[0.6, 1].map((strength, n) => (
                              <span
                                key={n}
                                className="w-px bg-sun-bright"
                                style={{ height: `${Math.max(6, (kwh / top) * 100)}%`, opacity: strength }}
                              />
                            ))}
                          </div>
                          <span className="mt-0.5 text-[8px] leading-none text-white/60">{"JFMAMJJASOND"[m]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* What it does for this home. Until the customer's bill is in, this part asks for it; once it is, the part
                  shows what the bill works out to, and a press on it opens the bill again. */}
              <div className="relative min-w-0 flex-1" data-menu-host>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={menu === "bill"}
                  aria-label={finance ? "What it does for this home: open the customer's bill" : "Add the customer's electricity bill"}
                  title={finance ? "Open the customer's bill" : "Add the customer's electricity bill"}
                  onClick={() => openMenu(menu === "bill" ? false : "bill")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    openMenu(menu === "bill" ? false : "bill");
                  }}
                  className="h-full cursor-pointer rounded-r-lg px-3.5 py-1.5 hover:bg-white/5"
                >
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">4 · For this home</p>
                  {finance ? (
                    <dl className="mt-0.5 flex gap-x-4">
                      {(
                        [
                          // What sells it, in one row. The home's use, how much it runs on its own and the bill before and after are in the bill panel.
                          ["Saves a year", dollars(finance.saving), true],
                          ["After STCs", net !== null ? dollars(net) : "–", false],
                          ["Payback", net !== null && finance.saving > 0 ? `${(net / finance.saving).toFixed(1)} yrs` : "–", false],
                        ] as const
                      ).map(([name, value, gold]) => (
                        <div key={name}>
                          <dt className="whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.14em] text-white/60">{name}</dt>
                          <dd
                            className={clsx(
                              "whitespace-nowrap text-lg font-semibold tabular-nums leading-tight",
                              gold && "text-sun-bright",
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sun-line px-3 text-[13px] font-medium text-white">
                        <ReceiptText className="size-4" aria-hidden /> Add bill
                      </span>
                      <span className="text-xs text-white/60">
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
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium">
                      <label>
                        Billed
                        <select
                          value={bill.interval}
                          onChange={(e) => setBill({ ...bill, interval: e.target.value as BillInterval })}
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
                          onChange={(e) => setBill({ ...bill, amount: e.target.value })}
                          placeholder="e.g. 350"
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
                          onChange={(e) => setBill({ ...bill, supplyPerDay: e.target.value })}
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
                          onChange={(e) => setBill({ ...bill, rate: e.target.value })}
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
            {/* Too many panels for the inverters: said plainly over the picture. A battery on the design lifts the limit. */}
            {oversize?.over && (
              <p
                className="mx-auto mb-2 flex items-start gap-2.5 rounded-lg border border-sun-line bg-sun px-4 py-2.5 text-sm text-sun-ink"
                style={{ maxWidth: FIT }}
                role="alert"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <strong className="font-semibold">
                    The panels are {oversize.percent}% of the inverter&apos;s rating: {summary.kw.toFixed(2)} kW of panels on {fittedKw} kW
                    of inverter.
                  </strong>{" "}
                  Without a battery the limit is {oversize.limit}%. Choose a larger inverter, add one, take panels off, or add a battery.
                </span>
              </p>
            )}
            <div className="relative mx-auto" style={{ maxWidth: FIT }}>
              <div className="overflow-hidden rounded-lg bg-surface-2">
                <svg
                  ref={svg}
                  viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                  className={clsx(
                    "block w-full touch-none select-none",
                    tool === "pan" ? "cursor-grab" : tool === "select" || onPanel ? "cursor-default" : "cursor-crosshair",
                  )}
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
                  {props.image && !drawn && <image href={props.image} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
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
                          stroke={on ? GOLD : "#ffffff"}
                          strokeOpacity={on ? 1 : 0.55}
                          strokeWidth={(on ? 1.4 : 1) * u}
                        />
                        {panelPlaces(f, size).map((panel) => {
                          // A place whose panel was taken out or moved away is simply empty roof: nothing is drawn there.
                          if (off.has(panel.index)) return null;
                          const pick: Pick = { kind: "grid", face: f.id, index: panel.index };
                          const lit = isPicked(pick);
                          const wired = stringOf(keyOf(pick));
                          return (
                            <g key={panel.index}>
                              <polygon
                                points={path(panel.corners)}
                                fill={wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#0d1219"}
                                fillOpacity={wired >= 0 ? 0.72 : 0.9}
                                stroke={lit ? GOLD : wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#93a0b1"}
                                strokeWidth={(lit ? 0.9 : 0.5) * u}
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
                    return (
                      <g key={panel.id}>
                        <polygon
                          points={path(looseCorners(panel, size))}
                          fill={wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#0d1219"}
                          fillOpacity={wired >= 0 ? 0.72 : 0.9}
                          stroke={lit ? GOLD : wired >= 0 ? STRING_COLOURS[wired % STRING_COLOURS.length] : "#93a0b1"}
                          strokeWidth={(lit ? 0.9 : 0.5) * u}
                        />
                        {aspect(panel, panelFacing(panel), panel.tilt ?? TILT.roof, wired >= 0 ? "#0b0c0e" : lit ? GOLD : "#93a0b1")}
                      </g>
                    );
                  })}
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
                  {/* The battery: a stack of its modules charging from the bottom up, in a breathing glow, with the roof's power running down a line to it. */}
                  {battery &&
                    (() => {
                      const [bx, by] = px(battery);
                      const layers = batteryLayers;
                      const w = 24 * u;
                      const lh = 8 * u;
                      const top = by - (layers * lh) / 2;
                      const roof = Object.values(centres);
                      const from = roof.length ? px(middle(roof)) : null;
                      const run = from ? `M${from[0]},${from[1]} L${bx},${by}` : "";
                      return (
                        <g pointerEvents="none">
                          {from && (
                            <>
                              <path
                                d={run}
                                fill="none"
                                stroke={GOLD}
                                strokeWidth={1.1 * u}
                                strokeDasharray={`${4 * u} ${4 * u}`}
                                opacity="0.9"
                              >
                                <animate attributeName="stroke-dashoffset" from={8 * u} to="0" dur="0.8s" repeatCount="indefinite" />
                              </path>
                              {[0, 0.8, 1.6].map((begin) => (
                                <circle key={begin} r={1.8 * u} fill="#ffffff">
                                  <animateMotion dur="2.4s" begin={`${begin}s`} repeatCount="indefinite" path={run} />
                                </circle>
                              ))}
                            </>
                          )}
                          <circle cx={bx} cy={by} r={20 * u} fill={GOLD}>
                            <animate attributeName="r" values={`${17 * u};${27 * u};${17 * u}`} dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.26;0.04;0.26" dur="3s" repeatCount="indefinite" />
                          </circle>
                          <rect x={bx - 4.5 * u} y={top - 7 * u} width={9 * u} height={3 * u} rx={u} fill={GOLD} />
                          <rect
                            x={bx - w / 2 - 3 * u}
                            y={top - 4 * u}
                            width={w + 6 * u}
                            height={layers * lh + 8 * u}
                            rx={3.5 * u}
                            fill="#0b0c0e"
                            fillOpacity="0.92"
                            stroke={GOLD}
                            strokeWidth={1.1 * u}
                          />
                          {Array.from({ length: layers }, (_, i) => {
                            // Counted from the bottom, so the charge climbs.
                            const y = top + (layers - 1 - i) * lh;
                            return (
                              <g key={i}>
                                <rect
                                  x={bx - w / 2}
                                  y={y + 0.7 * u}
                                  width={w}
                                  height={lh - 1.4 * u}
                                  rx={1.2 * u}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeOpacity="0.45"
                                  strokeWidth={0.5 * u}
                                />
                                {Array.from({ length: 7 }, (_, k) => (
                                  <line
                                    key={k}
                                    x1={bx - w / 2 + 2.7 * u + k * 3.1 * u}
                                    x2={bx - w / 2 + 2.7 * u + k * 3.1 * u}
                                    y1={y + 1.7 * u}
                                    y2={y + lh - 1.7 * u}
                                    stroke={GOLD}
                                    strokeWidth={0.9 * u}
                                    opacity="0.15"
                                  >
                                    <animate
                                      attributeName="opacity"
                                      values="0.15;1;1;0.15"
                                      keyTimes="0;0.25;0.8;1"
                                      dur={`${Math.max(3, layers * 0.6)}s`}
                                      begin={`${i * 0.4 + k * 0.05}s`}
                                      repeatCount="indefinite"
                                    />
                                  </line>
                                ))}
                              </g>
                            );
                          })}
                          <text
                            x={bx}
                            y={top + layers * lh + 13 * u}
                            textAnchor="middle"
                            fontSize={8 * u}
                            fontWeight="700"
                            fill="#ffffff"
                            stroke="#0b0c0e"
                            strokeWidth={2.4 * u}
                            paintOrder="stroke"
                          >
                            {batteryKwh} kWh
                          </text>
                        </g>
                      );
                    })()}
                  {/* The inverters: a box each, in the same line style as the battery, to be dragged to the wall it will go on. */}
                  {fitted.map((spec, n) => {
                    const [ix, iy] = px(inverterSpot(spec, n, spot.lat));
                    const w = 20 * u;
                    const h = 28 * u;
                    const lit = kit === n;
                    return (
                      <g key={n} pointerEvents="none">
                        <rect
                          x={ix - w / 2}
                          y={iy - h / 2}
                          width={w}
                          height={h}
                          rx={3 * u}
                          fill="#0b0c0e"
                          fillOpacity="0.92"
                          stroke={GOLD}
                          strokeWidth={(lit ? 1.8 : 1.1) * u}
                        />
                        <rect
                          x={ix - w / 2 + 3 * u}
                          y={iy - h / 2 + 3.5 * u}
                          width={w - 6 * u}
                          height={6 * u}
                          rx={1.2 * u}
                          fill="none"
                          stroke="#ffffff"
                          strokeOpacity="0.6"
                          strokeWidth={0.5 * u}
                        />
                        <path
                          d={`M${ix - w / 2 + 4.5 * u},${iy - h / 2 + 8 * u} q${2.7 * u},${-0.3 * u} ${4 * u},${-2 * u} t${3.6 * u},${-1 * u} t${3.4 * u},${2.4 * u}`}
                          fill="none"
                          stroke={GOLD}
                          strokeWidth={0.6 * u}
                        />
                        {Array.from({ length: 6 }, (_, k) => (
                          <line
                            key={k}
                            x1={ix - w / 2 + 3.75 * u + k * 2.5 * u}
                            x2={ix - w / 2 + 3.75 * u + k * 2.5 * u}
                            y1={iy - h / 2 + 12.5 * u}
                            y2={iy + h / 2 - 6 * u}
                            stroke="#ffffff"
                            strokeOpacity="0.32"
                            strokeWidth={0.5 * u}
                          />
                        ))}
                        <circle cx={ix} cy={iy + h / 2 - 3.2 * u} r={1.1 * u} fill={GOLD}>
                          <animate attributeName="opacity" values="1;0.3;1" dur="2.6s" repeatCount="indefinite" />
                        </circle>
                        <text
                          x={ix}
                          y={iy + h / 2 + 9 * u}
                          textAnchor="middle"
                          fontSize={8 * u}
                          fontWeight="700"
                          fill="#ffffff"
                          stroke="#0b0c0e"
                          strokeWidth={2.4 * u}
                          paintOrder="stroke"
                        >
                          {fitted.length > 1 ? `${n + 1} · ` : ""}
                          {spec.kw} kW
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
                  {tool === "panel" &&
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
                      </g>
                    ))}
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

              {/* The battery or the inverter under the pointer: what it is, beside it. */}
              {kit !== null &&
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
                    </p>
                  )}
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
                  onTurn={panelPicks.length > 0 ? turn : null}
                  onClose={() => setPicks([])}
                  closeTitle="Pick none (Esc)"
                  onRemove={removePicked}
                >
                  <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                    {picks.length === 1 ? (picks[0].kind === "label" ? "Label" : "1 panel") : `${picks.length} picked`}
                  </p>
                  {pickedPanels.length > 0 && (
                    <>
                      <label className="mt-2 block">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Tilt</span>
                        <span className="block text-[1.75rem] font-semibold leading-none tabular-nums text-ink">
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
                      <p className="mt-2.5 text-xs leading-snug text-ink-2">
                        {pickedFacing === null ? "Facing different ways" : `Facing ${compass(pickedFacing)} (${pickedFacing}°)`}
                      </p>
                      {pickedFacing !== null && pickedTilt !== null && (
                        <>
                          <p className="text-xs font-semibold leading-snug text-ink">{besideFlat(pickedTilt, pickedFacing)}</p>
                          <p className="text-xs leading-snug text-muted">
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
                    onTurn={(step) => update(face.id, { angle: ((((face.angle + step + 90) % 180) + 180) % 180) - 90, off: [] })}
                    onClose={() => setSelected(null)}
                    closeTitle="Leave this roof face"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Rows</p>
                    <p className="mt-1 text-[1.75rem] font-semibold leading-none tabular-nums text-ink">{face.angle}°</p>
                    <p className="mt-2 text-xs leading-snug text-ink-2">Turn the rows on this roof face</p>
                  </Dial>
                )
              )}

              {/* The system, centred along the top of the picture, as three rounds: the panel, the largest, in the middle, with
                  the inverter and the battery as half-rounds growing out of it either side. Each opens its choices
                  beneath, centred under the three. (Which design is open is in the bar at the top of the page, and
                  the customer's bill in the figures above the picture.) */}
              <div
                className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center"
                role="group"
                aria-label="System"
                data-menu-host
              >
                <div className="order-3">
                  <button
                    onClick={() => openMenu(menu === "panels" ? false : "panels")}
                    aria-expanded={menu === "panels"}
                    aria-haspopup="true"
                    title={`Panels: ${summary.panels} × ${panel?.name ?? chosenPanel?.name ?? "panel"}`}
                    aria-label="The panel this design is drawn with"
                    className={clsx(
                      "relative z-10 flex size-[3.75rem] flex-col items-center justify-center rounded-full border shadow-lift tabular-nums",
                      menu === "panels" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:bg-canvas",
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
                    <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[60vh] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                      <p className={clsx(label, "px-2 py-1")}>Panels to choose from</p>
                      {[
                        ...(panel && !chosenPanel ? [{ ...panel, sizeKnown: true, gone: true }] : []),
                        ...props.catalogue.map((p) => ({ ...p, gone: false })),
                      ].map((p) => (
                        <button
                          key={p.sku}
                          onClick={() => {
                            if (!p.gone) choosePanel(p.sku);
                            openMenu(false);
                          }}
                          className={clsx(
                            "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas",
                            p.sku === chosen && "bg-canvas",
                          )}
                        >
                          <Check className={clsx("mt-0.5 size-4 shrink-0", p.sku === chosen ? "text-ink" : "invisible")} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{p.name}</span>
                            <span className="block text-xs tabular-nums text-muted">
                              {p.watts} W · {p.sizeKnown ? `${p.long} × ${p.short} m` : "size not on file"}
                              {p.gone ? " · no longer in our range" : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="order-2 -mr-6">
                  <button
                    onClick={() => openMenu(menu === "inverters" ? false : "inverters")}
                    aria-expanded={menu === "inverters"}
                    aria-haspopup="true"
                    title={fitted.length ? `Inverter: ${fitted.map((i) => i.name).join(" + ")}` : "Inverter: choose one"}
                    aria-label="The inverters this design is drawn for"
                    className={clsx(
                      "flex h-[2.625rem] w-[4rem] items-center justify-start rounded-l-full border border-line pl-2.5 shadow-lift backdrop-blur-md",
                      menu === "inverters"
                        ? "bg-primary text-primary-ink"
                        : fitted.length
                          ? "bg-surface/90 text-ink hover:bg-surface"
                          : "bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    <Zap className="size-5" aria-hidden />
                  </button>
                  {menu === "inverters" && (
                    <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[60vh] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift rounded-lg border border-line bg-surface p-2">
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
                        className={clsx(button, "mt-2 w-full justify-center", suggesting && "!border-forest")}
                      >
                        <Sparkles className="mr-1.5 size-4 text-sun-ink" aria-hidden /> Suggest one for these panels
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
                            {props.inverters
                              .filter((i) =>
                                seek
                                  .toLowerCase()
                                  .split(/\s+/)
                                  .every((word) => `${i.name} ${i.sku}`.toLowerCase().includes(word)),
                              )
                              .map((i) => (
                                <button
                                  key={i.sku}
                                  onClick={() => addInverter(i)}
                                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas"
                                >
                                  <Plus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{i.name}</span>
                                    <span className="block text-xs tabular-nums text-muted">
                                      {i.kw} kW ·{" "}
                                      {i.electrical
                                        ? `${i.electrical.mppts.length} inputs, up to ${i.electrical.maxVoltage} V · strings can be checked`
                                        : "limits not on file: strings can't be checked"}
                                    </span>
                                  </span>
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="order-4 -ml-6">
                  <button
                    onClick={() => openMenu(menu === "batteries" ? false : "batteries")}
                    aria-expanded={menu === "batteries"}
                    aria-haspopup="true"
                    title={battery ? `Battery: ${battery.qty} × ${battery.name}` : "Battery: add one"}
                    aria-label="The battery on this design"
                    className={clsx(
                      "flex h-[2.625rem] w-[4rem] items-center justify-end rounded-r-full border border-line pr-2.5 shadow-lift backdrop-blur-md",
                      menu === "batteries"
                        ? "bg-primary text-primary-ink"
                        : battery
                          ? "bg-surface/90 text-ink hover:bg-surface"
                          : "bg-surface/90 text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    <BatteryCharging className="size-6" aria-hidden />
                  </button>
                  {menu === "batteries" && (
                    <div className="absolute left-1/2 top-full z-30 mt-2 max-h-[60vh] w-[24rem] max-w-[85vw] -translate-x-1/2 overflow-y-auto shadow-lift rounded-lg border border-line bg-surface p-2">
                      <p className={clsx(label, "px-2 py-1")}>On this design</p>
                      {battery ? (
                        <div className="rounded-md bg-canvas px-2 py-2">
                          <p className="truncate text-sm font-semibold">{battery.name}</p>
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
                              Blackout backup: wire chosen circuits to it, one module held back for outages. Adds the backup circuits to the
                              quote; the held module isn&apos;t counted in the savings.
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
                        {props.batteries
                          .filter((b) =>
                            seek
                              .toLowerCase()
                              .split(/\s+/)
                              .every((word) => `${b.name} ${b.sku}`.toLowerCase().includes(word)),
                          )
                          .map((b) => (
                            <button
                              key={b.sku}
                              onClick={() => chooseBattery(b)}
                              className={clsx(
                                "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-canvas",
                                b.sku === battery?.sku && "bg-canvas",
                              )}
                            >
                              <Check
                                className={clsx("mt-0.5 size-4 shrink-0", b.sku === battery?.sku ? "text-ink" : "invisible")}
                                aria-hidden
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{b.name}</span>
                                <span className="block text-xs tabular-nums text-muted">{b.kwh} kWh each</span>
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* The pad, in the top left corner: the select arrow in a circle of its own, since it is the tool every other
                  is left for, with two smaller half-rounds growing out of it for the two things done most with it:
                  add a panel (to its right) and erase (beneath it). */}
              <div className="absolute left-3 top-3 z-20 size-[6.25rem]" role="toolbar" aria-label="Select, add a panel, landscape, erase">
                <button
                  onClick={() => {
                    const wasOpen = fanOpen;
                    pickTool("panel");
                    setFanOpen(!wasOpen);
                  }}
                  title="Add a panel"
                  aria-label="Add a panel"
                  aria-pressed={tool === "panel"}
                  className={clsx(
                    "absolute left-[2.375rem] top-[0.5625rem] flex h-[2.625rem] w-[3.75rem] items-center justify-end rounded-r-full border border-line pr-2.5 shadow-lift backdrop-blur-md",
                    tool === "panel" ? "bg-primary text-primary-ink" : "bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <SquarePlus className="size-5" aria-hidden />
                </button>
                {/* Portrait or landscape (Martin): pressing Add a panel fans two bubbles out of it in an arc, like a hand of cards
                    spread out; choosing one sets the way new panels are laid (and lays any picked panels that way, `turnLandscape`),
                    and the fan folds away. Each starts at the tool's icon and swings out to its place. */}
                {([false, true] as const).map((landscape, n) => {
                  const name = landscape ? "Landscape" : "Portrait";
                  const on = addLandscape === landscape;
                  // The icon of Add a panel, and each bubble's place on an arc around it (degrees clockwise from east).
                  const icon = { x: 4.8, y: 1.875 };
                  const angle = (n === 0 ? -8 : 48) * (Math.PI / 180);
                  const reach = 3.5;
                  const dx = Math.cos(angle) * reach;
                  const dy = Math.sin(angle) * reach;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        setAddLandscape(landscape);
                        if (pickedPanels.length) turnLandscape(landscape);
                        setFanOpen(false);
                      }}
                      tabIndex={fanOpen ? 0 : -1}
                      aria-hidden={!fanOpen}
                      title={`${name}: add panels this way${pickedPanels.length ? ", and lay the picked panels this way" : ""}`}
                      aria-label={`Add panels ${name.toLowerCase()}`}
                      aria-pressed={on}
                      style={{
                        left: `${icon.x - 1.3125}rem`,
                        top: `${icon.y - 1.3125}rem`,
                        transform: fanOpen
                          ? `translate(${dx}rem, ${dy}rem) rotate(0deg) scale(1)`
                          : `translate(0, 0) rotate(${n === 0 ? -40 : -80}deg) scale(0.4)`,
                        opacity: fanOpen ? 1 : 0,
                        transitionDelay: fanOpen ? `${n * 60}ms` : "0ms",
                      }}
                      className={clsx(
                        "absolute flex size-[2.625rem] items-center justify-center rounded-full border shadow-lift backdrop-blur-md transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                        fanOpen ? "pointer-events-auto" : "pointer-events-none",
                        on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface/95 text-ink hover:bg-surface",
                      )}
                    >
                      <PanelGlyph across={landscape} />
                    </button>
                  );
                })}
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
                    Worked out from Google&apos;s height data for this address: where the sun is each half hour through the year, and what
                    stands in its way. That data can be older than the roof and the trees. It is a guide for design, not a shade assessment
                    on site, and the quote&apos;s output figures don&apos;t take it off.
                  </p>
                </div>
              )}
              {arraysOpen && (
                <div
                  className="absolute left-[4.25rem] top-[7rem] z-20 max-h-[calc(100%-13rem)] w-[28rem] max-w-[calc(100%-6.5rem)] overflow-auto rounded-2xl border border-line bg-surface p-4 shadow-lift"
                  role="region"
                  aria-label="Arrays"
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
              <div
                className="absolute right-3 top-3 z-20 size-[6.25rem]"
                role="toolbar"
                aria-label="String panels, trace a roof face, guide line"
              >
                <button
                  onClick={() => pickTool("trace")}
                  title="Trace a roof face"
                  aria-label="Trace a roof face"
                  aria-pressed={tool === "trace"}
                  className={clsx(
                    "absolute right-[2.375rem] top-[0.5625rem] flex h-[2.625rem] w-[3.75rem] items-center justify-start rounded-l-full border border-line pl-2.5 shadow-lift backdrop-blur-md",
                    tool === "trace" ? "bg-primary text-primary-ink" : "bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <PenTool className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() => pickTool("rule")}
                  title="Guide line"
                  aria-label="Guide line"
                  aria-pressed={tool === "rule"}
                  className={clsx(
                    "absolute right-[0.5625rem] top-[2.375rem] flex h-[3.75rem] w-[2.625rem] items-end justify-center rounded-b-full border border-line pb-2.5 shadow-lift backdrop-blur-md",
                    tool === "rule" ? "bg-primary text-primary-ink" : "bg-surface/90 text-ink hover:bg-surface",
                  )}
                >
                  <Ruler className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() => pickTool("string")}
                  title="String panels"
                  aria-label="String panels"
                  aria-pressed={tool === "string"}
                  className={clsx(
                    "absolute right-0 top-0 flex size-[3.75rem] items-center justify-center rounded-full border shadow-lift",
                    tool === "string" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:bg-canvas",
                  )}
                >
                  <Cable className="size-6" aria-hidden />
                </button>
              </div>
              {/* The third pad, in the bottom left corner (above the map's own mark): the hand that moves the picture in its
                  circle, with zoom in (to its right) and zoom out (above it) as its half-rounds. */}
              <div className="absolute bottom-8 left-3 z-10 size-[6.25rem]" role="toolbar" aria-label="Move the picture, zoom in, zoom out">
                <button
                  onClick={() => zoom(1 / 1.4)}
                  title="Zoom in"
                  aria-label="Zoom in"
                  className="absolute bottom-[0.5625rem] left-[2.375rem] flex h-[2.625rem] w-[3.75rem] items-center justify-end rounded-r-full border border-line bg-surface/90 pr-2.5 text-ink shadow-lift backdrop-blur-md hover:bg-surface"
                >
                  <ZoomIn className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() => zoom(1.4)}
                  title="Zoom out"
                  aria-label="Zoom out"
                  className="absolute bottom-[2.375rem] left-[0.5625rem] flex h-[3.75rem] w-[2.625rem] items-start justify-center rounded-t-full border border-line bg-surface/90 pt-2.5 text-ink shadow-lift backdrop-blur-md hover:bg-surface"
                >
                  <ZoomOut className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() => pickTool("pan")}
                  title="Move the picture"
                  aria-label="Move the picture"
                  aria-pressed={tool === "pan"}
                  className={clsx(
                    "absolute bottom-0 left-0 flex size-[3.75rem] items-center justify-center rounded-full border shadow-lift",
                    tool === "pan" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:bg-canvas",
                  )}
                >
                  <Hand className="size-6" aria-hidden />
                </button>
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
              <div className="pointer-events-none absolute inset-x-2 bottom-7 z-10 flex items-end gap-2">
                <div
                  className={clsx(GLASS, "pointer-events-auto absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1 p-1.5")}
                  role="toolbar"
                  aria-label="Design tools"
                >
                  {/* Either side of the comment round the same width, so it sits dead centre whatever stands beside it. */}
                  <div className="flex w-[10.75rem] items-center justify-end gap-1">
                    <button
                      onClick={undo}
                      title="Undo (Ctrl+Z)"
                      aria-label="Undo (Ctrl+Z)"
                      className="flex size-9 items-center justify-center rounded-xl text-ink hover:bg-canvas"
                    >
                      <Undo2 className="size-5" aria-hidden />
                    </button>
                    <button
                      onClick={redo}
                      title="Redo (Ctrl+Shift+Z)"
                      aria-label="Redo (Ctrl+Shift+Z)"
                      className="flex size-9 items-center justify-center rounded-xl text-ink hover:bg-canvas"
                    >
                      <Redo2 className="size-5" aria-hidden />
                    </button>
                    <button
                      onClick={() => setView(WHOLE)}
                      title="Show the whole picture"
                      aria-label="Show the whole picture"
                      className="flex size-9 items-center justify-center rounded-xl text-ink hover:bg-canvas"
                    >
                      <Maximize className="size-5" aria-hidden />
                    </button>
                    {(() => {
                      const { icon: Icon, name } = TOOLS.find((x) => x.tool === "label")!;
                      return (
                        <button
                          onClick={() => pickTool("label")}
                          title={name}
                          aria-label={name}
                          aria-pressed={tool === "label"}
                          className={clsx(
                            "flex size-9 items-center justify-center rounded-xl",
                            tool === "label" ? "bg-primary text-primary-ink" : "text-ink hover:bg-canvas",
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                        </button>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => pickTool("comment")}
                    title="Comment"
                    aria-label="Comment"
                    aria-pressed={tool === "comment"}
                    className={clsx(
                      "-my-3 mx-1 flex size-[3.25rem] shrink-0 items-center justify-center rounded-full border shadow-lift",
                      tool === "comment" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:bg-canvas",
                    )}
                  >
                    <MessageCircle className="size-7" aria-hidden />
                  </button>
                  <div className="flex w-[10.75rem] items-center justify-start gap-1">
                    <button
                      onClick={toggleDrawn}
                      title={drawn ? "Show the photo of the roof" : "Show the roof as a drawing"}
                      aria-label="Show the roof as a drawing"
                      aria-pressed={drawn}
                      className={clsx(
                        "flex size-9 items-center justify-center rounded-xl",
                        drawn ? "bg-primary text-primary-ink" : "text-ink hover:bg-canvas",
                      )}
                    >
                      <Layers className="size-5" aria-hidden />
                    </button>
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
                  </div>
                </div>
                <span className="flex-1" aria-hidden />
                {/* Design it for me, and Suggest a layout, in the corner: the roof designs itself three ways, or just lays panels. */}
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
                    <div className={clsx(GLASS, "w-80 space-y-2 p-3 text-[13px] text-ink-2")} role="dialog" aria-label="Design it for me">
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
                        Each is laid by the installer&apos;s rules (rows from the gutter up, portrait unless only landscape fits, clear of
                        every edge) {faces.length ? "on the roof faces you traced" : "from Google's roof data"}, with an inverter and
                        strings.
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
                  <button
                    onClick={() => setMineIntro(!mineIntro)}
                    aria-expanded={mineIntro}
                    disabled={mine === "busy" || costsHidden}
                    title={
                      costsHidden
                        ? "It designs against prices, which your account can't see. Ask the owner."
                        : "Three designs for this home: the fastest payback, the best return and the most independence"
                    }
                    className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink shadow-sm hover:bg-forest disabled:bg-line disabled:text-muted"
                  >
                    <WandSparkles className="size-4" aria-hidden /> {mine === "busy" ? "Designing…" : "Design it for me"}
                  </button>
                  {typeof idea === "object" && (
                    <p className={clsx(GLASS, "px-3 py-2 text-[13px]", idea.bad ? "text-warning" : "text-ink-2")} role="status">
                      {idea.note}{" "}
                      <button className="font-medium text-ink underline underline-offset-2" onClick={() => setIdea("idle")}>
                        Close
                      </button>
                    </p>
                  )}
                  {asking && (
                    <div className={clsx(GLASS, "flex items-end gap-2 p-2.5")}>
                      <label className="text-xs font-medium text-ink-2">
                        Panels
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          max={MAX_SUGGESTED}
                          value={want}
                          onChange={(e) => setWant(Math.max(1, Math.min(MAX_SUGGESTED, Math.round(Number(e.target.value) || 1))))}
                          className="mt-1 block h-9 w-16 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-forest"
                        />
                      </label>
                      <button
                        onClick={() => {
                          setAsking(false);
                          void suggestLayout();
                        }}
                        className="flex h-9 items-center rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-ink hover:bg-forest"
                      >
                        Lay them out
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setAsking(!asking)}
                    disabled={idea === "busy"}
                    aria-expanded={asking}
                    title="A first layout from the roof's shape, to check and adjust"
                    className={clsx(
                      GLASS,
                      "flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium text-sun-ink hover:bg-sun disabled:text-muted",
                    )}
                  >
                    <WandSparkles className="size-4" aria-hidden /> {idea === "busy" ? "Looking at the roof…" : "Suggest a layout"}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-ink">
                {TOOLS.find((t) => t.tool === tool)?.name}
              </span>
              <span className="text-sm text-muted">{TOOLS.find((t) => t.tool === tool)?.hint}</span>
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
                <SlopeNote slope={slopes[face.id]} onRead={() => void readSlope(face.id, face.points, true)} />
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
                <label className="block text-sm">
                  <span className="flex justify-between">
                    Roof pitch <span className="tabular-nums">{face.tilt ?? TILT.roof}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={TILT.max}
                    value={face.tilt ?? TILT.roof}
                    onChange={(e) => update(face.id, { tilt: Number(e.target.value) })}
                    {...slides}
                    className="mt-1 w-full"
                  />
                </label>
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
                  <button
                    className={clsx(button, "text-danger")}
                    onClick={() => {
                      setFaces(faces.filter((f) => f.id !== face.id));
                      setStrings(
                        strings
                          .map((s) => ({ ...s, panels: s.panels.filter((k) => !k.startsWith(`g:${face.id}:`)) }))
                          .filter((s) => s.panels.length),
                      );
                      changed();
                      setSelected(null);
                      setPicks([]);
                    }}
                  >
                    Delete this face
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
        {/* The quote stays worked out while it is closed (the figures above read its price); it is only out of sight. */}
        <div
          className={clsx(
            "xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto",
            (!quoteOpen || costsHidden) && "hidden",
          )}
        >
          <DesignQuote
            design={`Design ${active + 1}${active === primary ? " (primary)" : ""}`}
            spec={spec}
            workspace={props.workspace}
            rates={props.rates}
            value={quoteNow}
            onChange={setQuote}
            onNet={onNet}
          />
        </div>
      </div>
    </div>
  );
}
