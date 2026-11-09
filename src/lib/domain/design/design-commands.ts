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
  /** With `kw`, that size of panels laid first, then put in the rows ("10 kW in two rows", 8 Nov 2026). */
  | { do: "rows"; rows: number; landscape?: boolean; kw?: number; facing?: Facing }
  /** The same number of panels laid again on the roof by the rules, to fit it (8 Nov 2026, Martin). */
  | { do: "relay" }
  /** The panels taken off the design (the picked ones, else all). */
  | { do: "removePanels" }
  /**
   * A whole design deleted from the roof (9 Nov 2026, Martin), by its number (1 is the first), or the one open when none
   * is named. Never done straight away: the designer asks first (`deleteQuestion`) and only a Yes deletes it.
   */
  | { do: "deleteDesign"; which?: number }
  /**
   * The panels already on the roof are being replaced, so their roof is used (9 Nov 2026, Martin), or kept clear of
   * again. Panels laid by rule keep clear of them until told otherwise.
   */
  | { do: "replaceExisting" }
  | { do: "keepExisting" }
  /** The roof's faces read again from Nearmap's heights, in place of those on the design. */
  | { do: "readRoof" }
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

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

/** The design a request names by number ("design 2", "the second design"); null for the one open. */
export function designNumberIn(text: string): number | null {
  const t = text.toLowerCase();
  const n = t.match(/\bdesigns?\s*(?:no\.?|number|#)?\s*(\d{1,2})\b/) ?? t.match(/#(\d{1,2})\b/);
  if (n) return Number(n[1]) || null;
  const word = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/);
  return word ? ORDINALS[word[1]] : null;
}

/** What the designer asks before a design is deleted: which one, and that it can't be undone. */
export function deleteQuestion(number: number, label?: string): string {
  return `Delete Design ${number}${label ? ` (${label})` : ""}? Its panels, kit and quote go with it, and it can't be undone.`;
}

/** A Yes or a No typed or said to a question waiting for one; null for anything else. */
export function confirmWord(raw: string): "yes" | "no" | null {
  const t = raw.trim().toLowerCase();
  if (/^(y|yes|yep|yeah|yup|sure|ok|okay|confirm(ed)?|do it|go ahead|delete it|yes,? delete it|please do)\b[.!]*$/.test(t)) return "yes";
  if (/^(n|no|nope|nah|cancel|stop|keep it|don'?t|do not|leave it)\b/.test(t)) return "no";
  return null;
}

/** A command read from common phrasings, or null for Sol to read. */
export function parseCommand(raw: string): DesignCommand | null {
  const text = raw.trim();
  if (!text) return null;
  const t = text.toLowerCase();
  if (/^undo\b/.test(t)) return { do: "undo" };
  if (/^redo\b/.test(t)) return { do: "redo" };
  // The panels already there: being replaced, so laid over, or kept clear of (9 Nov 2026, Martin).
  if (/\b(existing|old|current) (panels?|solar|system|arrays?|pv)\b/.test(t)) {
    if (/\b(keep|avoid|leave|stay|staying|around|clear of)\b/.test(t) && !/\b(replac\w*|remov\w*|ignore|disregard)\b/.test(t))
      return { do: "keepExisting" };
    if (
      /\b(replac\w*|remov\w*|ignore|disregard|coming off|come off|taken off|take off|swap\w*|gone|lay over|use (?:the|that|their) (?:roof|space))\b/.test(
        t,
      )
    )
      return { do: "replaceExisting" };
  }
  // The roof's faces read again from the heights (9 Nov 2026, Martin: faces kept from an older reading were wrong).
  if (
    /\b(re-?read|re-?trace|redo|read|trace|find|work out|detect)\b.*\b(roof|faces?)\b.*\bagain\b|\bre-?(read|trace|detect)\b.*\b(roof|faces?)\b/.test(
      t,
    )
  )
    return { do: "readRoof" };
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
    const size = t.match(/(\d+(?:\.\d+)?)\s*kw\b/);
    const facing = FACINGS.find(([re]) => re.test(t))?.[1];
    if (rows >= 1 && rows <= 20)
      return {
        do: "rows",
        rows,
        ...(way !== undefined ? { landscape: way } : {}),
        ...(size ? { kw: Number(size[1]), ...(facing ? { facing } : {}) } : {}),
      };
  }
  if (
    /\bre-?lay\b|\btidy\b|\blay (?:them|the panels|it)\b.*\b(?:again|properly|neatly|better|out)\b|\bso (?:that )?they fit\b|\bfit (?:them|the panels|it) (?:on|to|onto) the roof\b/.test(
      t,
    )
  )
    return { do: "relay" };
  // A whole design deleted ("delete design 2", "get rid of this design"): asked about before it is done.
  if (/\b(delete|remove|bin|discard|get rid of|scrap|throw away)\b/.test(t) && /\bdesigns?\b/.test(t) && !/\bpanels?\b/.test(t)) {
    const which = designNumberIn(t);
    return { do: "deleteDesign", ...(which ? { which } : {}) };
  }
  // Taking panels away (8 Nov 2026, Martin: he asked, and Sol only said he had).
  if (
    /\b(delete|remove|clear|erase|take (?:off|away|out)|get rid of)\b/.test(t) &&
    /\b(panels?|pv|solar|them|everything|all of it|the roof)\b/.test(t) &&
    !/\b(battery|batteries|storage|inverter|string|label|comment|face)\b/.test(t)
  )
    return { do: "removePanels" };
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
        "removePanels",
        "deleteDesign",
        "replaceExisting",
        "keepExisting",
        "readRoof",
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
    design: {
      type: ["number", "null"] as ("number" | "null")[],
      description: "For deleteDesign: the design's number (1 is the first); null for the one open.",
    },
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
    "design",
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
    case "replaceExisting":
    case "keepExisting":
    case "readRoof":
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
        ? {
            do: "rows",
            rows: Math.round(rows),
            ...(typeof read.landscape === "boolean" ? { landscape: read.landscape } : {}),
            ...((n(read.kw) ?? 0) > 0 && (n(read.kw) ?? 0) <= 100 ? { kw: n(read.kw)! } : {}),
            ...(["N", "E", "S", "W"].includes(read.facing as string) ? { facing: read.facing as Facing } : {}),
          }
        : { do: "answer", words };
    }
    case "relay":
    case "removePanels":
      return { do: read.do };
    case "deleteDesign": {
      const which = n(read.design);
      return which !== null && which >= 1 && which <= 20 ? { do: "deleteDesign", which: Math.round(which) } : { do: "deleteDesign" };
    }
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
- rows: lay the panels (the picked ones, else all) in that many rows, the same panels where they stood; with landscape true or false when portrait or landscape is asked for too, and kw (and facing) when a size is asked for too ("10 kW in two rows"): that size is laid first, then put in the rows. relay: lay the same number of panels again on the roof by the rules, to fit it ("lay them so they fit the roof", "tidy them up").
- To place panels somewhere, targetKw with a facing lays them on the faces looking that way. To string them, stringAuto.
- explainString: show the check for a string, by its letter; put the reason in words too, from the string checks above.
- choose: when the request could fairly mean different things (which face, how many kW, portrait or landscape, which battery), don't guess: ask a short question with two or three options, each a label, a line on what it means and the request to carry out if chosen, written as the person would say it ("fit 10 kW on the north face"). Only when it is truly unclear.
- removePanels: take the panels off (the picked ones, else all), when asked to delete, remove or clear them.
- replaceExisting: the panels already on the roof are being replaced, so new panels may go where they are ("ignore the existing panels", "they're coming off"); keepExisting: keep clear of them again. readRoof: read the roof's faces again from the picture's heights, when the faces drawn look wrong or the person asks.
- deleteDesign: delete a whole design from the roof when asked to, design being its number (1 is the first) or null for the one open. The designer asks the person to confirm before anything is deleted, so put the question in words ("Delete Design 2?"), never that it is done.
- Never say you have changed something in words alone: only a change done above changes the design. If none of these does what is asked, say plainly that you can't do that yet, with "answer".
- Always put one short sentence in words. Never invent a figure, product or price that isn't above. Nothing is sent to anyone.
- For a question, answer from THE DESIGN: its PRICES part holds the price, what the system costs line by line, the saving and the payback, and what each product on the lists costs. Never say you can't see prices when that part is there: work the answer out from it (a cheaper inverter or battery, fewer panels, what a change does to the payback), naming the products and figures you used, two or three sentences at most. When it says prices are hidden for this person, say they can't be shown to them.`;

/** A product on the price lists with what it costs, for Sol's answer. */
export interface PricedProduct {
  name: string;
  /** Ex GST; null with no cost on file. */
  cost: number | null;
}

/** The most products of a kind put in front of Sol: enough to suggest a cheaper one, short enough to read. */
export const PRICED_PER_KIND = 25;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/**
 * The design's prices in words for the designer's Ask Sol (9 Nov 2026, Martin: he said he couldn't see pricing, so he
 * couldn't say how to bring the payback down): the price before and after STCs, the system's costs line by line, the
 * saving and payback, and what each panel, inverter and battery on the lists costs. Only for someone who sees costs;
 * otherwise one line saying they are hidden. Pure, tested.
 */
export function pricesInWords(p: {
  costsHidden: boolean;
  lines: readonly { label: string; amount: number; qty?: number; missing?: boolean }[];
  /** The quote's price inc GST before STCs, its own figure (hand changes in). */
  priceIncGst: number | null;
  /** After STCs, the quote's own. */
  afterStcs: number | null;
  /** A year's saving from the bill, null without a bill. */
  saving: number | null;
  panels: readonly PricedProduct[];
  inverters: readonly PricedProduct[];
  batteries: readonly PricedProduct[];
}): string {
  if (p.costsHidden) return "PRICES: hidden for this person (they may not see costs or prices).";
  const out = ["PRICES (ex GST unless said):"];
  if (p.priceIncGst !== null) out.push(`Price ${money(p.priceIncGst)} inc GST before STCs.`);
  if (p.afterStcs !== null) out.push(`Price after STCs ${money(p.afterStcs)} inc GST: what the customer pays.`);
  if (p.saving !== null && p.saving > 0) {
    out.push(`Saving about ${money(p.saving)} a year.`);
    if (p.afterStcs !== null)
      out.push(`Payback about ${Math.round((p.afterStcs / p.saving) * 10) / 10} years (price after STCs ÷ yearly saving).`);
  } else out.push("No bill, so no saving or payback yet.");
  const lines = p.lines.filter((l) => l.amount > 0 || l.missing);
  if (lines.length)
    out.push(
      `Costs: ${lines
        .map((l) => `${l.qty && l.qty > 1 ? `${l.qty} × ` : ""}${l.label} ${l.missing ? "no cost on file" : money(l.amount)}`)
        .join("; ")}.`,
    );
  const kind = (title: string, list: readonly PricedProduct[]) => {
    const priced = list.filter((x) => x.cost !== null).slice(0, PRICED_PER_KIND);
    if (priced.length) out.push(`${title} on the lists, each: ${priced.map((x) => `${x.name} ${money(x.cost as number)}`).join("; ")}.`);
  };
  kind("Panels", p.panels);
  kind("Inverters", p.inverters);
  kind("Batteries", p.batteries);
  return out.join("\n");
}
