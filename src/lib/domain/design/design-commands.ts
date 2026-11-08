/**
 * Sol drives the designer (1 Nov 2026, Martin): plain words, typed or spoken, turned into one change to the design or
 * an answer about it. Common phrasings are read here at once, with no round trip (`parseCommand`); anything else goes
 * to Sol, who answers in the same shape (`DESIGN_COMMAND_SCHEMA`). Pure, tested in `design-commands.test.ts`.
 */

export type Facing = "N" | "E" | "S" | "W";

export type DesignCommand =
  | { do: "targetKw"; kw: number; facing?: Facing }
  /**
   * A whole system in one request (3 Nov 2026, Martin: "load 8 kW PV + an inverter and a battery"): fill to the kW, then
   * the inverter and the battery. Each is left out when not asked for; "" chooses it by rule, other words by name.
   */
  | { do: "system"; kw: number; facing?: Facing; inverter?: string; battery?: string }
  | { do: "battery"; query: string }
  | { do: "noBattery" }
  | { do: "inverter"; query: string }
  | { do: "panel"; query: string }
  | { do: "explainString"; letter: string }
  | { do: "stringAuto" }
  | { do: "designForMe" }
  | { do: "pitch"; degrees: number }
  | { do: "flat" }
  | { do: "phase"; phase: "single" | "three" }
  | { do: "storeys"; storeys: "single" | "double" }
  | { do: "tilt"; degrees: number }
  /** Panels laid portrait or landscape (the picked ones, else all), rows kept (8 Nov 2026, Martin). */
  | { do: "orient"; landscape: boolean }
  /** Panels turned by so many degrees round their middle (the picked ones, else all). */
  | { do: "rotate"; degrees: number }
  /** Panels moved so many metres east and south (negative: west and north). */
  | { do: "move"; east: number; south: number }
  /** The panels (the picked ones, else all) laid again in so many rows, the same panels, where they stood. */
  | { do: "rows"; rows: number; landscape?: boolean }
  /** The same number of panels laid again on the roof by the rules, to fit it (8 Nov 2026, Martin). */
  | { do: "relay" }
  | { do: "undo" }
  | { do: "redo" }
  /**
   * A question with options (8 Nov 2026, Martin: Sol should present options): when a request could mean different
   * things, up to `MAX_CHOICES`, each a label, a line saying what it means, and the request carried out when chosen.
   */
  | { do: "choose"; question: string; options: Choice[] }
  | { do: "answer"; words: string };

export interface Choice {
  label: string;
  detail: string;
  /** What to do when chosen, in the person's own words ("fit 10 kW on the north face"). */
  request: string;
}
export const MAX_CHOICES = 3;

const FACINGS: [RegExp, Facing][] = [
  [/\bnorth/i, "N"],
  [/\beast/i, "E"],
  [/\bsouth/i, "S"],
  [/\bwest/i, "W"],
];

/** The words left once the verbs and the kind of product are taken out: what to look the product up by. */
const queryOf = (text: string, kind: RegExp) =>
  text
    .replace(kind, " ")
    .replace(/\b(swap|switch|change|use|put|add|choose|pick|make|it|to|the|a|an|on|for|with|in|instead|please|one)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The words naming a battery in a request, with what only says how much or which kind taken out ("" for one by rule). */
export function batteryWords(text: string): string {
  return queryOf(text, /\b(batter(y|ies)|storage)\b/gi)
    .replace(
      /\b(required|needed|needs?|amount|of|some|enough|right|good|suitable|matching|recommended|correct|proper|sized?|its|home|this|that|me|us|by|option|from|kwh|how|much|an?|the|it)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Every product the words name as well as any other does: all of a maker's batteries for "Sigenergy". */
export function allByQuery<T extends { name: string; sku: string }>(list: readonly T[], query: string): T[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((w) => w.length > 1);
  if (!words.length) return [];
  const scored = list.map((item) => ({
    item,
    score: words.filter((w) => `${item.name} ${item.sku}`.toLowerCase().includes(w)).length,
  }));
  const best = Math.max(0, ...scored.map((s) => s.score));
  return best ? scored.filter((s) => s.score === best).map((s) => s.item) : [];
}

/** The parts of a request joined by "+", commas, "and", "with" or "plus". */
const partsOf = (text: string) => text.split(/\+|,|\band\b|\bwith\b|\bplus\b|&/i).map((s) => s.trim());

/** What a whole-system request names for one product: undefined when it isn't asked for, "" for one by rule. */
function productAsked(text: string, kind: RegExp, refused?: RegExp): string | undefined {
  if (refused?.test(text)) return undefined;
  const part = partsOf(text).find((p) => kind.test(p));
  if (part === undefined) return undefined;
  const words = queryOf(part, kind)
    .replace(/\b(load|fit|give|me|us|some|matching|suitable|right|good|hybrid|new|also|plus|of)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return words;
}

/** A command read from common phrasings, or null for Sol to read. */
export function parseCommand(raw: string): DesignCommand | null {
  const text = raw.trim();
  if (!text) return null;
  const t = text.toLowerCase();
  if (/^undo\b/.test(t)) return { do: "undo" };
  if (/^redo\b/.test(t)) return { do: "redo" };
  const why = t.match(/\bstring\s+([a-z])\b/);
  if (why && /\b(why|fail|failing|wrong|check|problem|explain)\b/.test(t)) return { do: "explainString", letter: why[1].toUpperCase() };
  // A question (other than about a string) is Sol's to answer, never read as an order.
  if (/\?\s*$/.test(t) || /^(what|how|why|would|could|should|is|does|can|will|which)\b/.test(t)) return null;
  if (/\bdesign it for me\b|\bthree designs\b/.test(t)) return { do: "designForMe" };
  if (/\bstring (it|them|the panels|everything|automatically)\b|\bauto[- ]?string\b/.test(t)) return { do: "stringAuto" };
  const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const rowsAsked = t.match(/\b(\d{1,2}|one|two|three|four|five|six)\s+(?:[a-z-]+\s+)?rows?\b/);
  if (rowsAsked && /\b(lay|put|arrange|set|make|in|into|as)\b/.test(t)) {
    const rows = WORD_NUMBERS[rowsAsked[1]] ?? Number(rowsAsked[1]);
    // Portrait or landscape said with it goes with it ("2 symmetric rows in portrait", 8 Nov 2026).
    const way = /\blandscape\b/.test(t) ? true : /\bportrait\b/.test(t) ? false : undefined;
    if (rows >= 1 && rows <= 20) return { do: "rows", rows, ...(way !== undefined ? { landscape: way } : {}) };
  }
  if (
    /\bre-?lay\b|\btidy\b|\blay (?:them|the panels|it)\b.*\b(?:again|properly|neatly|better|out)\b|\bso (?:that )?they fit\b|\bfit (?:them|the panels|it) (?:on|to|onto) the roof\b/.test(
      t,
    )
  )
    return { do: "relay" };
  const kw = t.match(/(\d+(?:\.\d+)?)\s*kw\b/);
  // A whole system: the kW asked for in a part of its own, not inside a product's name ("the Sungrow 8 kW inverter").
  const kwOnItsOwn = partsOf(t).some((p) => /\d\s*kw\b/.test(p) && !/\b(inverters?|batter(y|ies))\b/.test(p));
  if (kw && kwOnItsOwn) {
    const inverter = productAsked(text, /\binverters?\b/i);
    const battery = productAsked(text, /\bbatter(y|ies)\b/i, /\b(no|without|remove|drop)\b[^+,]*\bbatter(y|ies)\b/i);
    if (inverter !== undefined || battery !== undefined) {
      const facing = FACINGS.find(([re]) => re.test(t))?.[1];
      return {
        do: "system",
        kw: Number(kw[1]),
        ...(facing ? { facing } : {}),
        ...(inverter !== undefined ? { inverter } : {}),
        ...(battery !== undefined ? { battery } : {}),
      };
    }
  }
  // A size of solar asked for on its own: a kW said beside a battery ("add a battery to this 8.55 kW system") is about
  // the battery, never a call to lay the panels again (8 Nov 2026, Martin: adding a battery re-laid his panels).
  if (
    kw &&
    kwOnItsOwn &&
    !/\b(battery|batteries|storage)\b/.test(t) &&
    /\b(fit|make|size|design|put|lay|give|go|target|want|load|add)\b/.test(t)
  ) {
    const facing = FACINGS.find(([re]) => re.test(t))?.[1];
    return { do: "targetKw", kw: Number(kw[1]), ...(facing ? { facing } : {}) };
  }
  if (/\b(no|remove|take (off|out)|drop|without)\b.*\b(battery|storage)\b/.test(t)) return { do: "noBattery" };
  // "Add a battery", "add the storage it needs": no product named is one chosen by rule (the inverter's maker, sized to the home).
  if (/\b(battery|storage)\b/.test(t) && /\b(swap|switch|change|use|put|add|choose|pick|give|fit)\b/.test(t))
    return { do: "battery", query: batteryWords(text) };
  if (/\binverter\b/.test(t) && /\b(swap|switch|change|use|put|choose|pick)\b/.test(t))
    return { do: "inverter", query: queryOf(text, /\binverters?\b/gi) };
  if (/\bpanels?\b/.test(t) && /\b(swap|switch|change|use|choose|pick)\b/.test(t) && !kw)
    return { do: "panel", query: queryOf(text, /\bpanels?\b/gi) };
  if (/\blandscape\b/.test(t) && !/\bportrait\b/.test(t)) return { do: "orient", landscape: true };
  if (/\bportrait\b/.test(t) && !/\blandscape\b/.test(t)) return { do: "orient", landscape: false };
  const turned = t.match(/\b(?:turn|rotate)\b\D*?(-?\d{1,3})\s*(?:°|deg(?:rees?)?\b)/);
  if (turned && !/\bpitch\b|\btilt\b/.test(t)) {
    const degrees = Number(turned[1]) * (/\b(anti|counter)[- ]?clockwise\b|\bleft\b/.test(t) ? -1 : 1);
    if (degrees && Math.abs(degrees) <= 180) return { do: "rotate", degrees };
  }
  const moved = t.match(/\bmove\b.*?(\d+(?:\.\d+)?)\s*(cm|m)\b.*?\b(north|south|east|west|up|down|left|right)\b/);
  if (moved) {
    const m = Number(moved[1]) / (moved[2] === "cm" ? 100 : 1);
    if (m > 0 && m <= 50) {
      const way = moved[3];
      const east = way === "east" || way === "right" ? m : way === "west" || way === "left" ? -m : 0;
      const south = way === "south" || way === "down" ? m : way === "north" || way === "up" ? -m : 0;
      return { do: "move", east, south };
    }
  }
  if (/\bflat roof\b|\bit'?s flat\b/.test(t)) return { do: "flat" };
  const pitch = t.match(/\bpitch\b\D*(\d{1,2})/);
  if (pitch) return { do: "pitch", degrees: Number(pitch[1]) };
  const tilt = t.match(/\btilt\b\D*(\d{1,2})/);
  if (tilt) return { do: "tilt", degrees: Number(tilt[1]) };
  if (/\bthree[- ]?phase\b|\b3[- ]?phase\b/.test(t)) return { do: "phase", phase: "three" };
  if (/\bsingle[- ]?phase\b|\b1[- ]?phase\b/.test(t)) return { do: "phase", phase: "single" };
  if (/\b(double|two)[- ]?stor(e)?y\b/.test(t)) return { do: "storeys", storeys: "double" };
  if (/\bsingle[- ]?stor(e)?y\b/.test(t)) return { do: "storeys", storeys: "single" };
  return null;
}

/** The product a query names, from a list: the one whose name and code hold most of the query's words; null when none does. */
export function pickByQuery<T extends { name: string; sku: string }>(list: readonly T[], query: string): T | null {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((w) => w.length > 1);
  if (!words.length) return null;
  let best: { item: T; score: number } | null = null;
  for (const item of list) {
    const hay = `${item.name} ${item.sku}`.toLowerCase();
    const score = words.filter((w) => hay.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

/** A facing in degrees within 45° of a compass point. */
export function faces(facing: Facing, degrees: number): boolean {
  const at = { N: 0, E: 90, S: 180, W: 270 }[facing];
  const d = Math.abs(((degrees - at + 540) % 360) - 180);
  return d <= 45;
}

/** What Sol answers with when he reads a command: one change, or words when it is a question. */
export const DESIGN_COMMAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    do: {
      type: "string",
      enum: [
        "targetKw",
        "system",
        "battery",
        "noBattery",
        "inverter",
        "panel",
        "explainString",
        "stringAuto",
        "designForMe",
        "pitch",
        "flat",
        "phase",
        "storeys",
        "tilt",
        "orient",
        "rotate",
        "move",
        "rows",
        "relay",
        "choose",
        "undo",
        "redo",
        "answer",
      ],
    },
    kw: { type: ["number", "null"] as ("number" | "null")[] },
    facing: { type: ["string", "null"] as ("string" | "null")[], enum: ["N", "E", "S", "W", null] },
    query: {
      type: ["string", "null"] as ("string" | "null")[],
      description:
        "The product's maker and model words, for battery, inverter or panel; for battery, \"\" to choose one by rule (the inverter's maker, sized to the home).",
    },
    inverter: {
      type: ["string", "null"] as ("string" | "null")[],
      description: 'For system: the inverter\'s maker and model words, "" to choose one by rule, null when none was asked for.',
    },
    battery: {
      type: ["string", "null"] as ("string" | "null")[],
      description: 'For system: the battery\'s maker and model words, "" to choose one by rule, null when none was asked for.',
    },
    letter: { type: ["string", "null"] as ("string" | "null")[] },
    degrees: { type: ["number", "null"] as ("number" | "null")[] },
    landscape: { type: ["boolean", "null"] as ("boolean" | "null")[], description: "For orient: true for landscape, false for portrait." },
    east: { type: ["number", "null"] as ("number" | "null")[], description: "For move: metres east (negative west)." },
    south: { type: ["number", "null"] as ("number" | "null")[], description: "For move: metres south (negative north)." },
    rows: { type: ["number", "null"] as ("number" | "null")[], description: "For rows: how many rows." },
    question: { type: ["string", "null"] as ("string" | "null")[], description: "For choose: the question, short." },
    options: {
      type: ["array", "null"] as ("array" | "null")[],
      description: "For choose: two or three options.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", description: "A few words." },
          detail: { type: "string", description: "One line on what it means." },
          request: { type: "string", description: "The request to carry out if chosen, as the person would say it." },
        },
        required: ["label", "detail", "request"],
      },
    },
    phase: { type: ["string", "null"] as ("string" | "null")[], enum: ["single", "three", null] },
    storeys: { type: ["string", "null"] as ("string" | "null")[], enum: ["single", "double", null] },
    words: { type: "string", description: "What to say to the person: the answer to a question, or the change in a sentence. Short." },
  },
  required: [
    "do",
    "kw",
    "facing",
    "query",
    "inverter",
    "battery",
    "letter",
    "degrees",
    "landscape",
    "east",
    "south",
    "rows",
    "question",
    "options",
    "phase",
    "storeys",
    "words",
  ],
} as const;

/** Sol's reading, checked: a command the designer can carry out, else his words as an answer. */
export function commandFrom(read: Record<string, unknown>): DesignCommand {
  const words = typeof read.words === "string" ? read.words.slice(0, 1200) : "";
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : "");
  switch (read.do) {
    case "targetKw": {
      const kw = n(read.kw);
      const facing = ["N", "E", "S", "W"].includes(read.facing as string) ? (read.facing as Facing) : undefined;
      return kw && kw > 0 && kw <= 100 ? { do: "targetKw", kw, ...(facing ? { facing } : {}) } : { do: "answer", words };
    }
    case "system": {
      const kw = n(read.kw);
      const facing = ["N", "E", "S", "W"].includes(read.facing as string) ? (read.facing as Facing) : undefined;
      const part = (v: unknown) => (typeof v === "string" ? { value: v.slice(0, 80) } : null);
      const inverter = part(read.inverter);
      const battery = part(read.battery);
      if (!kw || kw <= 0 || kw > 100) return { do: "answer", words };
      return {
        do: "system",
        kw,
        ...(facing ? { facing } : {}),
        ...(inverter ? { inverter: inverter.value } : {}),
        ...(battery ? { battery: battery.value } : {}),
      };
    }
    case "battery":
    case "inverter":
    case "panel":
      return s(read.query) ? { do: read.do, query: s(read.query) } : { do: "answer", words };
    case "noBattery":
    case "stringAuto":
    case "designForMe":
    case "flat":
      return { do: read.do };
    case "explainString":
      return /^[A-Z]$/i.test(s(read.letter)) ? { do: "explainString", letter: s(read.letter).toUpperCase() } : { do: "answer", words };
    case "pitch":
    case "tilt": {
      const degrees = n(read.degrees);
      return degrees !== null && degrees >= 0 && degrees <= 60 ? { do: read.do, degrees: Math.round(degrees) } : { do: "answer", words };
    }
    case "orient":
      return typeof read.landscape === "boolean" ? { do: "orient", landscape: read.landscape } : { do: "answer", words };
    case "rotate": {
      const degrees = n(read.degrees);
      return degrees !== null && degrees !== 0 && Math.abs(degrees) <= 180
        ? { do: "rotate", degrees: Math.round(degrees) }
        : { do: "answer", words };
    }
    case "move": {
      const east = n(read.east) ?? 0;
      const south = n(read.south) ?? 0;
      return (east || south) && Math.abs(east) <= 50 && Math.abs(south) <= 50
        ? { do: "move", east: Math.round(east * 100) / 100, south: Math.round(south * 100) / 100 }
        : { do: "answer", words };
    }
    case "rows": {
      const rows = n(read.rows);
      return rows !== null && rows >= 1 && rows <= 20
        ? { do: "rows", rows: Math.round(rows), ...(typeof read.landscape === "boolean" ? { landscape: read.landscape } : {}) }
        : { do: "answer", words };
    }
    case "relay":
      return { do: "relay" };
    case "undo":
    case "redo":
      return { do: read.do };
    case "choose": {
      const question = s(read.question) || words.slice(0, 160);
      const options = (Array.isArray(read.options) ? read.options : [])
        .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>) : {}))
        .map((o) => ({
          label: typeof o.label === "string" ? o.label.slice(0, 60).trim() : "",
          detail: typeof o.detail === "string" ? o.detail.slice(0, 140).trim() : "",
          request: typeof o.request === "string" ? o.request.slice(0, 200).trim() : "",
        }))
        .filter((o) => o.label && o.request)
        .slice(0, MAX_CHOICES);
      return question && options.length >= 2 ? { do: "choose", question, options } : { do: "answer", words };
    }
    case "phase":
      return read.phase === "single" || read.phase === "three" ? { do: "phase", phase: read.phase } : { do: "answer", words };
    case "storeys":
      return read.storeys === "single" || read.storeys === "double" ? { do: "storeys", storeys: read.storeys } : { do: "answer", words };
    default:
      return { do: "answer", words: words || "I couldn't work out what to change. Try “fit 8 kW on the north face”." };
  }
}

/** What Sol is told about the design and how to answer. */
export const DESIGN_COMMAND_PROMPT = `You are Sol, inside a solar business's roof designer. Above is the design as it stands. Read the person's request and answer with one change the designer can make, or, for a question, do "answer" with the answer in words.

- targetKw: fill the roof (or the faces facing a direction) to about that many kW.
- Never change the panels (targetKw or system) unless the person asks for panels or a size of solar. Adding a battery or changing the inverter is battery or inverter alone: the panels stay as they are.
- system: a whole system at once ("load 8 kW of panels, an inverter and a battery"): kw, then inverter and battery, each the product's words from the lists, "" to choose one by rule, or null when it wasn't asked for.
- battery / inverter / panel: choose that product; query holds its maker and model words as named in the lists above. For a battery with no product named ("add a battery", "the storage it needs"), query is "": the designer picks the inverter maker's battery and stacks it to the home.
- noBattery, stringAuto (string the panels by rule), designForMe (make the three designs), flat (the roof is flat), pitch (the roof's pitch in degrees), phase, storeys, undo, redo.
- The panels themselves, the picked ones or else all of them: tilt (their tilt in degrees, on frames or the roof), orient (landscape true or false: portrait), rotate (turn them by degrees round their middle, + clockwise), move (east and south in metres, negative for west and north).
- rows: lay the panels (the picked ones, else all) in that many rows, the same panels where they stood; with landscape true or false when portrait or landscape is asked for too. relay: lay the same number of panels again on the roof by the rules, to fit it ("lay them so they fit the roof", "tidy them up").
- To place panels somewhere, targetKw with a facing lays them on the faces looking that way. To string them, stringAuto.
- explainString: show the check for a string, by its letter; put the reason in words too, from the string checks above.
- choose: when the request could fairly mean different things (which face, how many kW, portrait or landscape, which battery), don't guess: ask a short question with two or three options, each a label, a line on what it means and the request to carry out if chosen, written as the person would say it ("fit 10 kW on the north face"). Only when it is truly unclear.
- Always put one short sentence in words. Never invent a figure, product or price that isn't above. Nothing is sent to anyone.`;
