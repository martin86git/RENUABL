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
  | { do: "undo" }
  | { do: "redo" }
  | { do: "answer"; words: string };

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
  if (kw && /\b(fit|make|size|design|put|lay|give|go|target|want|load|add)\b/.test(t)) {
    const facing = FACINGS.find(([re]) => re.test(t))?.[1];
    return { do: "targetKw", kw: Number(kw[1]), ...(facing ? { facing } : {}) };
  }
  if (/\b(no|remove|take (off|out)|drop|without)\b.*\bbattery\b/.test(t)) return { do: "noBattery" };
  if (/\bbattery\b/.test(t) && /\b(swap|switch|change|use|put|add|choose|pick)\b/.test(t))
    return { do: "battery", query: queryOf(text, /\bbatter(y|ies)\b/gi) };
  if (/\binverter\b/.test(t) && /\b(swap|switch|change|use|put|choose|pick)\b/.test(t))
    return { do: "inverter", query: queryOf(text, /\binverters?\b/gi) };
  if (/\bpanels?\b/.test(t) && /\b(swap|switch|change|use|choose|pick)\b/.test(t) && !kw)
    return { do: "panel", query: queryOf(text, /\bpanels?\b/gi) };
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
        "answer",
      ],
    },
    kw: { type: ["number", "null"] as ("number" | "null")[] },
    facing: { type: ["string", "null"] as ("string" | "null")[], enum: ["N", "E", "S", "W", null] },
    query: {
      type: ["string", "null"] as ("string" | "null")[],
      description: "The product's maker and model words, for battery, inverter or panel.",
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
    phase: { type: ["string", "null"] as ("string" | "null")[], enum: ["single", "three", null] },
    storeys: { type: ["string", "null"] as ("string" | "null")[], enum: ["single", "double", null] },
    words: { type: "string", description: "What to say to the person: the answer to a question, or the change in a sentence. Short." },
  },
  required: ["do", "kw", "facing", "query", "inverter", "battery", "letter", "degrees", "phase", "storeys", "words"],
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
- system: a whole system at once ("load 8 kW of panels, an inverter and a battery"): kw, then inverter and battery, each the product's words from the lists, "" to choose one by rule, or null when it wasn't asked for.
- battery / inverter / panel: choose that product; query holds its maker and model words as named in the lists above.
- noBattery, stringAuto (string the panels by rule), designForMe (make the three designs), flat (the roof is flat), pitch (the roof pitch in degrees), tilt (the picked panels' tilt), phase, storeys.
- explainString: show the check for a string, by its letter; put the reason in words too, from the string checks above.
- Always put one short sentence in words. Never invent a figure, product or price that isn't above. Nothing is sent to anyone.`;
