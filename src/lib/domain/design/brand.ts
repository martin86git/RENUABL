/**
 * A business's own branding for the proposals it sends: who it is, how to
 * reach it, its licences, its words about itself, the template and colours
 * its proposals use, and the pictures it has put up. Pure: the choices on
 * offer, the checks on what a browser sends, and how a theme becomes colours.
 *
 * A proposal goes to the business's customer under the business's name, not
 * RENUABL's. Nothing here is RENUABL's brand.
 */
import type { Cleaned } from "./crm";

// ---------------------------------------------------------------------------
// Templates and colours
// ---------------------------------------------------------------------------

/** How a proposal is laid out. The same sections in each; what differs is how it opens and how it is set. */
export const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "A photo across the top, then each part in turn." },
  { id: "compact", name: "Compact", blurb: "The system, the saving and the price first, on one screen." },
  { id: "bold", name: "Bold", blurb: "Opens on a full page in your colour." },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];

/** The page a proposal is set on: its background, its cards, its text. The business's own two colours go on top. */
export const PALETTES = [
  { id: "paper", name: "Paper", canvas: "#f6f6f4", surface: "#ffffff", ink: "#16181d", muted: "#676b75", line: "#e3e4e8" },
  { id: "warm", name: "Warm", canvas: "#f8f3ea", surface: "#fffdf8", ink: "#231f1a", muted: "#75695b", line: "#e9dfd0" },
  { id: "night", name: "Night", canvas: "#101216", surface: "#191c22", ink: "#f3f4f6", muted: "#a3a8b3", line: "#2b2f38" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];

/** How long a proposal's price stands, in days: the choices, and the one a business starts with. */
export const VALID_DAYS = [7, 14, 30] as const;
export const DEFAULT_VALID_DAYS = 14;

const HEX = /^#[0-9a-f]{6}$/;

/** A colour as "#rrggbb", lower case. Null for anything else: nothing but six hex digits ever reaches a style. */
export function cleanColour(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  return HEX.test(c) ? c : null;
}

/** How light a colour is, 0 (black) to 1 (white), the way contrast is measured (WCAG relative luminance). */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** How far apart two colours are for reading, 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = "#ffffff";
const NEAR_BLACK = "#0b0b0c";

/** The text colour to put on a colour: white or near-black, whichever reads better. So a pale brand colour never gets white text. */
export function inkOn(hex: string): string {
  return contrast(hex, WHITE) >= contrast(hex, NEAR_BLACK) ? WHITE : NEAR_BLACK;
}

/**
 * A proposal's colours as CSS variables, the same names the rest of the site
 * uses (`--canvas`, `--surface`, `--ink`, `--primary`, …), so the proposal's
 * components use tokens like everything else. The business's accent is used
 * for small text and marks, so where it would be hard to read on the page it
 * gives way to the page's own text colour.
 */
export function themeVars(theme: Pick<BrandKit, "palette" | "primary" | "accent">): Record<string, string> {
  const page = PALETTES.find((p) => p.id === theme.palette) ?? PALETTES[0];
  const accent = contrast(theme.accent, page.surface) >= 3 ? theme.accent : page.ink;
  return {
    "--canvas": page.canvas,
    "--surface": page.surface,
    "--surface-2": page.canvas,
    "--ink": page.ink,
    "--ink-2": page.ink,
    "--muted": page.muted,
    "--line": page.line,
    "--line-strong": page.muted,
    "--primary": theme.primary,
    "--primary-ink": inkOn(theme.primary),
    "--forest": theme.primary,
    "--accent": accent,
    "--positive": accent,
  };
}

// ---------------------------------------------------------------------------
// The brand kit
// ---------------------------------------------------------------------------

export interface BrandKit {
  /** The name the business trades under, as its customers know it. */
  name: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  /** Eleven digits, or empty. */
  abn: string;
  /** Licence and accreditation lines as the business writes them ("REC 12345"), up to four. We don't check them. */
  licences: string[];
  /** A few sentences about the business, in its own words. */
  about: string;
  /** Up to five short reasons to choose it, in its own words. */
  points: string[];
  /** Anything it wants every proposal to say about warranties, payment or what happens next. */
  extra: string;
  /** Its conditions of sale, shown at the foot of every proposal and accepted with it. */
  conditions: string;
  template: TemplateId;
  palette: PaletteId;
  primary: string;
  accent: string;
  validDays: (typeof VALID_DAYS)[number];
}

/** What a business starts with: its account's name, and plain colours until it picks its own. */
export function defaultBrand(businessName: string): BrandKit {
  return {
    name: businessName.slice(0, 80),
    tagline: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    abn: "",
    licences: [],
    about: "",
    points: [],
    extra: "",
    conditions: "",
    template: "classic",
    palette: "paper",
    primary: "#16181d",
    accent: "#c2410c",
    validDays: DEFAULT_VALID_DAYS,
  };
}

type Bag = Record<string, unknown>;

/** One tidy line: control characters and angle brackets out, runs of spaces closed up, cut to a length. */
function line(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Longer text over several lines: control characters out (line breaks stay), cut to a length. */
function paragraphs(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const lines = (raw: unknown, most: number, max: number): string[] =>
  (Array.isArray(raw) ? raw : [])
    .map((entry) => line(entry, max))
    .filter(Boolean)
    .slice(0, most);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ABN checksum (ATO): subtract 1 from the first digit, weight, and the sum divides by 89. */
export function isAbn(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  return [...digits].reduce((sum, d, i) => sum + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0) % 89 === 0;
}

/** "51 824 753 556" */
export function shownAbn(abn: string): string {
  return abn.length === 11 ? `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8)}` : abn;
}

/**
 * A web address as typed ("example.com.au" will do): kept as a full https or
 * http address, and nothing else (never a `javascript:` link). Null when it
 * isn't one.
 */
export function cleanWebsite(raw: unknown): string | null {
  const typed = line(raw, 200);
  if (!typed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** A web address as it is shown: without the "https://". */
export function shownWebsite(website: string): string {
  return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

export const BRAND_NAME_MISSING = "Enter the name your business trades under (2 to 80 characters).";
export const BRAND_EMAIL_WRONG = "That email address doesn't look right. Check it, or leave it empty.";
export const BRAND_WEBSITE_WRONG = "That web address doesn't look right. Something like example.com.au, or leave it empty.";
export const BRAND_ABN_WRONG = "That ABN doesn't check out. It is 11 digits: check it, or leave it empty.";
export const BRAND_COLOUR_WRONG = "Pick each colour from the colour box.";

/** A brand kit as sent by a browser, laid over the one the business has: anything not sent stays as it is. */
export function cleanBrandKit(raw: unknown, current: BrandKit): Cleaned<BrandKit> {
  const r: Bag = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Bag) : {};
  const sent = (key: keyof BrandKit) => key in r;

  const name = sent("name") ? line(r.name, 80) : current.name;
  if (name.length < 2) return { ok: false, message: BRAND_NAME_MISSING };
  const email = sent("email") ? line(r.email, 200).toLowerCase() : current.email;
  if (email && !EMAIL.test(email)) return { ok: false, message: BRAND_EMAIL_WRONG };
  const website = sent("website") ? cleanWebsite(r.website) : current.website;
  if (website === null) return { ok: false, message: BRAND_WEBSITE_WRONG };
  const abn = sent("abn") ? line(r.abn, 20).replace(/\s/g, "") : current.abn;
  if (abn && !isAbn(abn)) return { ok: false, message: BRAND_ABN_WRONG };
  const primary = sent("primary") ? cleanColour(r.primary) : current.primary;
  const accent = sent("accent") ? cleanColour(r.accent) : current.accent;
  if (!primary || !accent) return { ok: false, message: BRAND_COLOUR_WRONG };

  return {
    ok: true,
    value: {
      name,
      tagline: sent("tagline") ? line(r.tagline, 120) : current.tagline,
      phone: sent("phone") ? line(r.phone, 30) : current.phone,
      email,
      website,
      address: sent("address") ? line(r.address, 200) : current.address,
      abn,
      licences: sent("licences") ? lines(r.licences, 4, 80) : current.licences,
      about: sent("about") ? paragraphs(r.about, 1500) : current.about,
      points: sent("points") ? lines(r.points, 5, 140) : current.points,
      extra: sent("extra") ? paragraphs(r.extra, 3000) : current.extra,
      conditions: sent("conditions") ? paragraphs(r.conditions, 60_000) : current.conditions,
      template: TEMPLATES.some((t) => t.id === r.template) ? (r.template as TemplateId) : current.template,
      palette: PALETTES.some((p) => p.id === r.palette) ? (r.palette as PaletteId) : current.palette,
      primary,
      accent,
      validDays: VALID_DAYS.includes(r.validDays as (typeof VALID_DAYS)[number])
        ? (r.validDays as (typeof VALID_DAYS)[number])
        : current.validDays,
    },
  };
}

/** A kit read back from the database: the same checks, on top of the starting kit, so an old or damaged row still reads. */
export function readBrandKit(saved: unknown, businessName: string): BrandKit {
  const start = defaultBrand(businessName);
  const cleaned = cleanBrandKit(saved, start);
  return cleaned.ok ? cleaned.value : start;
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/** What a picture is for. One logo and one cover at a time; a new one takes the old one's place. */
export const IMAGE_KINDS = ["logo", "cover", "photo"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_LIMITS = {
  /** The largest file taken, before it is made smaller on the server. */
  uploadBytes: 5 * 1024 * 1024,
  /** The longest side kept, in pixels. */
  side: { logo: 800, cover: 1800, photo: 1600 } as Record<ImageKind, number>,
  /** The most photos a business keeps (besides its logo and cover). */
  photos: 6,
} as const;

export const IMAGE_TOO_BIG = "That picture is too large. Use one under 5 MB.";
export const IMAGE_WRONG = "That file isn't a picture we can use. Upload a JPEG, PNG or WebP.";
export const PHOTOS_FULL = `You can keep up to ${IMAGE_LIMITS.photos} photos. Remove one to add another.`;

/** A picture a business has put up, as its screens and its proposals know it: never the picture's bytes. */
export interface BrandImage {
  id: string;
  kind: ImageKind;
  width: number;
  height: number;
}

/**
 * What a file really is, read from its first bytes: the file's name and what
 * the browser says it is are never trusted. Only the three kinds we take;
 * an SVG (which can carry script) is never one of them.
 */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return "png";
  const ascii = (from: number, text: string) => [...text].every((c, i) => at(from + i) === c.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  return null;
}
