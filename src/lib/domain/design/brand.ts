/**
 * A business's own branding for the proposals it sends: who it is, how to
 * reach it, its licences, its words about itself, the template and colours
 * its proposals use, and the pictures it has put up. Pure: the choices on
 * offer, the checks on what a browser sends, and how a theme becomes colours.
 *
 * A proposal goes to the business's customer under the business's name, not
 * RENUABL's. Nothing here is RENUABL's brand.
 */
import { cleanBlocks, defaultBlocks, type BlockSetting } from "./blocks";
import type { Cleaned } from "./crm";

// ---------------------------------------------------------------------------
// Templates and colours
// ---------------------------------------------------------------------------

/** How a proposal is laid out. The same sections in each; what differs is how it opens and how it is set. */
export const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "A photo across the top, then each part in turn." },
  { id: "compact", name: "Compact", blurb: "The system, the saving and the price first, on one screen." },
  { id: "bold", name: "Bold", blurb: "Opens on a full page in your colour." },
  { id: "minimal", name: "Minimal", blurb: "Plenty of white space, fine lines and big type. No boxes." },
  { id: "split", name: "Split", blurb: "Your photo beside the title, and the headings down the left." },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];

/**
 * How each template is set, beyond how it opens: the parts in boxes or between
 * fine lines, the headings above each part or down the left, and the parts
 * numbered or not. The page and the PDF both read it, so they agree.
 */
export interface TemplateLook {
  /** How it opens: under a photo, the three figures first, on a block of the main colour, the title alone, or photo and title side by side. */
  cover: "photo" | "figures" | "colour" | "plain" | "split";
  /** Each part in a box, or between fine lines with no box. */
  parts: "boxed" | "lined";
  /** Each part's heading above it, or in a column on its left (on a wide screen). */
  headings: "above" | "side";
  /** "01", "02" … before each heading. */
  numbered: boolean;
}

export const TEMPLATE_LOOK: Record<TemplateId, TemplateLook> = {
  classic: { cover: "photo", parts: "boxed", headings: "above", numbered: false },
  compact: { cover: "figures", parts: "boxed", headings: "above", numbered: false },
  bold: { cover: "colour", parts: "boxed", headings: "above", numbered: false },
  minimal: { cover: "plain", parts: "lined", headings: "above", numbered: true },
  split: { cover: "split", parts: "boxed", headings: "side", numbered: false },
};

/** A template's look, for any id (an unknown one reads as Classic). */
export const lookOf = (template: string): TemplateLook => TEMPLATE_LOOK[template as TemplateId] ?? TEMPLATE_LOOK.classic;

/** The box a part sits in, as values the page's styles read: a card, or no box with a fine line above. */
export function lookVars(template: string): Record<string, string> {
  return lookOf(template).parts === "lined"
    ? { "--part-bg": "transparent", "--part-border": "0px", "--part-radius": "0px", "--part-pad-x": "0px", "--part-pad-x-sm": "0px" }
    : {
        "--part-bg": "var(--surface)",
        "--part-border": "1px",
        "--part-radius": "0.75rem",
        "--part-pad-x": "1.25rem",
        "--part-pad-x-sm": "1.75rem",
      };
}

/** How the year's output is drawn on a proposal: the same figures each way. */
export const CHART_STYLES = [
  { id: "bars", name: "Bars", blurb: "A bar for each month." },
  { id: "line", name: "Line", blurb: "One line through the year." },
  { id: "area", name: "Shaded area", blurb: "A line with the area under it filled." },
  { id: "table", name: "Table of figures", blurb: "Each month's kWh written out, no chart." },
] as const;
export type ChartStyle = (typeof CHART_STYLES)[number]["id"];

/** What a proposal's terms and conditions are: ours (the default), the business's own as a PDF it has uploaded, or none. */
export const TERMS_CHOICES = [
  { id: "standard", name: "Our standard terms", blurb: "Written for solar sales in Australia, with your name filled in. Recommended." },
  { id: "own", name: "Your own terms", blurb: "Upload your terms and conditions as a PDF. It goes with every proposal." },
  { id: "none", name: "No terms", blurb: "Only your special conditions, if you have any." },
] as const;
export type TermsChoice = (typeof TERMS_CHOICES)[number]["id"];

/** The business's own terms and conditions, as uploaded: the file's id and the name it is shown under. Never its bytes. */
export interface TermsFile {
  id: string;
  name: string;
}

export const TERMS_LIMITS = { uploadBytes: 10 * 1024 * 1024 } as const;
export const TERMS_TOO_BIG = "That file is too large. Use a PDF under 10 MB.";
export const TERMS_WRONG = "That file isn't a PDF. Save your terms and conditions as a PDF and upload that.";
export const TERMS_NEEDS_FILE = "Upload your terms and conditions as a PDF first.";

/** Whether a file is a whole PDF, by its own first and last bytes (never its name or what the browser says it is). */
export function isPdf(bytes: Uint8Array): boolean {
  const text = (part: Uint8Array) => String.fromCharCode(...part);
  if (text(bytes.slice(0, 5)) !== "%PDF-") return false;
  // A whole PDF ends with %%EOF, sometimes followed by a line break or a little padding.
  return text(bytes.slice(Math.max(0, bytes.length - 1024))).includes("%%EOF");
}

/** The name a terms file is shown under: the uploaded file's name without its folder or ".pdf", tidied; else a plain name. */
export function termsFileName(raw: unknown): string {
  const base = typeof raw === "string" ? (raw.split(/[\\/]/).pop() ?? "") : "";
  const name = base
    .replace(/\.pdf$/i, "")
    .replace(/[\u0000-\u001f\u007f<>"]/g, " ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return name || "Terms and conditions";
}

/** A terms file as kept on the kit, or null when what is there isn't one. */
function readTermsFile(raw: unknown): TermsFile | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return typeof r.id === "string" && /^doc_[a-f0-9]{8,64}$/.test(r.id) ? { id: r.id, name: termsFileName(r.name) } : null;
}

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

/**
 * The type a proposal is set in. Only faces the site already loads, each with
 * a face the PDF has built in (a PDF made here embeds no font files): the
 * page and the file are close, not identical, and the settings page says so.
 */
export const FONTS = [
  { id: "modern", name: "Modern", blurb: "A clean sans-serif throughout.", pdf: "Helvetica in the PDF." },
  { id: "editorial", name: "Editorial", blurb: "Serif headings over a clean sans-serif.", pdf: "Times headings in the PDF." },
] as const;
export type FontId = (typeof FONTS)[number]["id"];

/** How the price is written. The price itself always has GST in it: this is only whether it is shown as one figure or broken out. */
export const GST_MODES = [
  { id: "included", name: "GST included", blurb: "One price, with GST in it." },
  { id: "excluded", name: "GST shown separately", blurb: "The price before GST, the GST, and the total." },
] as const;
export type GstMode = (typeof GST_MODES)[number]["id"];

/** What is asked for up front: nothing, a share of what the customer pays, or a set amount. */
export interface Deposit {
  kind: "none" | "percent" | "fixed";
  /** A percentage (1 to 100) or dollars, by `kind`. 0 with none. */
  amount: number;
}

/** A share of the price due at a named point: "20% Deposit", "80% Installation completion". */
export interface Milestone {
  percent: number;
  name: string;
}
export const MAX_MILESTONES = 8;

/** The account a customer pays into. All of it or none of it. */
export interface BankDetails {
  name: string;
  /** Six digits. */
  bsb: string;
  /** Digits only. */
  number: string;
  /** What to put as the payment's reference: "Your surname and street". */
  reference: string;
}
export const NO_BANK: BankDetails = { name: "", bsb: "", number: "", reference: "" };

/** How long installation usually takes from the customer going ahead. Shown as an estimate, never a promise. */
export const INSTALL_TIMES = [
  { id: "", label: "Don't say" },
  { id: "1-2", label: "1 to 2 weeks" },
  { id: "3-4", label: "3 to 4 weeks" },
  { id: "5-8", label: "5 to 8 weeks" },
  { id: "9-12", label: "9 to 12 weeks" },
  { id: "tbc", label: "To be confirmed" },
] as const;
export type InstallTime = (typeof INSTALL_TIMES)[number]["id"];

/** The most extra addresses told when a customer accepts. */
export const MAX_NOTIFY = 5;

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
export function themeVars(theme: Pick<BrandKit, "palette" | "primary" | "accent"> & { font?: FontId }): Record<string, string> {
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
    // The headings' face: the site's own serif for Editorial, else the same face as everything else.
    "--proposal-heading": theme.font === "editorial" ? "var(--font-serif), Georgia, serif" : "inherit",
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
  /** Its special conditions, shown on every proposal and in the PDF, and accepted by a customer going ahead. */
  conditions: string;
  font: FontId;
  gst: GstMode;
  deposit: Deposit;
  /** Empty, or shares that add up to 100. */
  milestones: Milestone[];
  bank: BankDetails;
  /**
   * The business's own page for paying by card (a payment link from its own provider), as a full https address. Empty
   * when it has none. We only ever open it: no card is taken, and no money is held, by RENUABL.
   */
  payLink: string;
  /** The business's own workmanship warranty, in years. Null when it doesn't state one. */
  warrantyYears: number | null;
  /** Its own words about that warranty. */
  warrantyWords: string;
  installTime: InstallTime;
  /** Extra addresses of the business's own, told when a customer accepts a proposal. */
  notify: string[];
  /** Whether the customer is emailed when someone at the business replies in a job's conversation. On until the business says otherwise. */
  emailReplies: boolean;
  /** Whether every proposal carries RENUABL's standard terms and conditions (`standard-terms.ts`). On until the business says otherwise. */
  standardTerms: boolean;
  /** Which terms go with a proposal: ours (the default), the business's own uploaded PDF, or none. `standardTerms` follows it. */
  terms: TermsChoice;
  /** The business's own terms and conditions, once uploaded. Set only by the upload (`withOwnTerms`), never by a save from the browser. */
  ownTerms: TermsFile | null;
  /** How the year's output is drawn on its proposals. */
  chart: ChartStyle;
  /** The business says it is a New Energy Tech Approved Seller. We don't check it: it only chooses which line the consumer information carries. */
  netccApproved: boolean;
  /** The proposal's blocks: which show, in what order, with what heading, words and picture. */
  blocks: BlockSetting[];
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
    font: "modern",
    gst: "included",
    deposit: { kind: "none", amount: 0 },
    milestones: [],
    bank: { ...NO_BANK },
    payLink: "",
    warrantyYears: null,
    warrantyWords: "",
    installTime: "",
    notify: [],
    emailReplies: true,
    standardTerms: true,
    terms: "standard",
    ownTerms: null,
    chart: "bars",
    netccApproved: false,
    blocks: defaultBlocks(),
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

/**
 * A business's card payment link as typed: kept only as a full https
 * address on a real host, with nobody's name or password in it. Empty when
 * left empty. Null for anything else: http, another kind of link
 * (`javascript:`, `data:`), a bare word, an address on this computer.
 */
export function cleanPayLink(raw: unknown): string | null {
  if (raw !== undefined && raw !== null && typeof raw !== "string") return null;
  const typed = (raw ?? "").trim();
  if (!typed) return "";
  if (typed.length > 300 || /\s/.test(typed) || typed.startsWith("/")) return null;
  // Typed without "https://" it is given one; typed with anything else in front (http://, javascript:) it is refused.
  if (/^[a-z][a-z0-9+.-]*:/i.test(typed) && !/^https:\/\//i.test(typed)) return null;
  try {
    const url = new URL(/^https:\/\//i.test(typed) ? typed : `https://${typed}`);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[\d.]+$/.test(host) || host.endsWith(".localhost") || host.endsWith(".local"))
      return null;
    return url.href;
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
export const DEPOSIT_WRONG = "The deposit is a percentage from 1 to 100, or a dollar amount up to 1,000,000.";
export const MILESTONE_NAME_MISSING = "Give each payment milestone a name and a percentage above 0.";
export const milestonesWrong = (total: number) =>
  `The payment milestones add up to ${total}%. They need to add up to 100%: change them, or take them all out.`;
export const BANK_INCOMPLETE =
  "For bank details, give the account name, a BSB of 6 digits and an account number of 4 to 10 digits. Or leave all three empty.";
export const PAY_LINK_WRONG =
  "That card payment link doesn't look right. It is the full https address of your own payment page, or left empty.";
export const WARRANTY_WRONG = "The workmanship warranty is a whole number of years from 1 to 30, or left empty.";
export const notifyWrong = (address: string) => `"${address}" doesn't look like an email address.`;

const num = (raw: unknown) =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;

/** A deposit as sent. Null when it isn't one we can ask for. */
export function cleanDeposit(raw: unknown): Deposit | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Bag;
  if (r.kind === "none" || r.kind === undefined) return { kind: "none", amount: 0 };
  const amount = num(r.amount);
  if (r.kind === "percent") return amount >= 1 && amount <= 100 ? { kind: "percent", amount: Math.round(amount * 10) / 10 } : null;
  if (r.kind === "fixed") return amount > 0 && amount <= 1_000_000 ? { kind: "fixed", amount: Math.round(amount) } : null;
  return null;
}

/** Payment milestones as sent: none at all, or named shares that add up to 100. */
export function cleanMilestones(raw: unknown): Cleaned<Milestone[]> {
  const out: Milestone[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, MAX_MILESTONES) : []) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Bag;
    const name = line(e.name, 60);
    const percent = num(e.percent);
    // A row left wholly empty is a row not filled in yet, not a mistake.
    if (!name && !(percent > 0)) continue;
    if (!name || !(percent > 0) || percent > 100) return { ok: false, message: MILESTONE_NAME_MISSING };
    out.push({ percent: Math.round(percent * 10) / 10, name });
  }
  const total = Math.round(out.reduce((sum, m) => sum + m.percent, 0) * 10) / 10;
  if (out.length && total !== 100) return { ok: false, message: milestonesWrong(total) };
  return { ok: true, value: out };
}

/** Bank details as sent: all three of name, BSB and number, or none of them. Spaces and dashes in the numbers are forgiven. */
export function cleanBank(raw: unknown): BankDetails | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Bag;
  const name = line(r.name, 80);
  const bsb = line(r.bsb, 12).replace(/[\s-]/g, "");
  const number = line(r.number, 20).replace(/[\s-]/g, "");
  const reference = line(r.reference, 120);
  if (!name && !bsb && !number) return { ...NO_BANK };
  if (name.length < 2 || !/^\d{6}$/.test(bsb) || !/^\d{4,10}$/.test(number)) return null;
  return { name, bsb, number, reference };
}

/** A BSB as it is written: "063-000". */
export const shownBsb = (bsb: string) => (bsb.length === 6 ? `${bsb.slice(0, 3)}-${bsb.slice(3)}` : bsb);

/** Extra addresses to tell, as sent: each a real-looking address, lower case, once. */
export function cleanNotify(raw: unknown): Cleaned<string[]> {
  const out: string[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, 40) : []) {
    const address = line(entry, 200).toLowerCase();
    if (!address) continue;
    if (!EMAIL.test(address)) return { ok: false, message: notifyWrong(address) };
    if (!out.includes(address)) out.push(address);
  }
  return { ok: true, value: out.slice(0, MAX_NOTIFY) };
}

/** A brand kit as sent by a browser, laid over the one the business has: anything not sent stays as it is. */
/**
 * Which terms a save leaves the kit with. `terms` when it is sent; else the
 * older on/off switch (`standardTerms`: off means no terms, unless the
 * business's own were chosen); else as it was. A kit saved before the choice
 * existed reads from that switch. The business's own terms only once a file
 * is there to send.
 */
function chooseTerms(r: Bag, current: BrandKit): Cleaned<TermsChoice> {
  let choice: TermsChoice = current.terms ?? (current.standardTerms === false ? "none" : "standard");
  if (TERMS_CHOICES.some((t) => t.id === r.terms)) choice = r.terms as TermsChoice;
  else if (typeof r.standardTerms === "boolean") choice = r.standardTerms ? "standard" : choice === "own" ? "own" : "none";
  if (choice === "own" && !current.ownTerms)
    return "terms" in r ? { ok: false, message: TERMS_NEEDS_FILE } : { ok: true, value: "standard" };
  return { ok: true, value: choice };
}

/**
 * The kit with the business's own terms file put in (and chosen), or taken
 * out. Taking it out while it was the terms in use goes back to ours, the
 * default, rather than leaving proposals with none.
 */
/** The terms a kit's proposals carry: its own when chosen and uploaded, else ours while they are on, else none. */
export function termsInUse(kit: Pick<BrandKit, "terms" | "ownTerms" | "standardTerms">): TermsChoice {
  if (kit.terms === "own" && kit.ownTerms) return "own";
  return kit.standardTerms === false || kit.terms === "none" ? "none" : "standard";
}

export function withOwnTerms(kit: BrandKit, file: TermsFile | null): BrandKit {
  if (file) return { ...kit, ownTerms: { id: file.id, name: termsFileName(file.name) }, terms: "own", standardTerms: false };
  const terms = kit.terms === "own" ? "standard" : kit.terms;
  return { ...kit, ownTerms: null, terms, standardTerms: terms === "standard" };
}

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
  const deposit = sent("deposit") ? cleanDeposit(r.deposit) : current.deposit;
  if (!deposit) return { ok: false, message: DEPOSIT_WRONG };
  const milestones = sent("milestones") ? cleanMilestones(r.milestones) : { ok: true as const, value: current.milestones };
  if (!milestones.ok) return milestones;
  const bank = sent("bank") ? cleanBank(r.bank) : current.bank;
  if (!bank) return { ok: false, message: BANK_INCOMPLETE };
  const payLink = sent("payLink") ? cleanPayLink(r.payLink) : current.payLink;
  if (payLink === null) return { ok: false, message: PAY_LINK_WRONG };
  let warrantyYears = current.warrantyYears;
  if (sent("warrantyYears")) {
    const years = r.warrantyYears === null || r.warrantyYears === "" ? null : num(r.warrantyYears);
    if (years !== null && !(Number.isInteger(years) && years >= 1 && years <= 30)) return { ok: false, message: WARRANTY_WRONG };
    warrantyYears = years;
  }
  const notify = sent("notify") ? cleanNotify(r.notify) : { ok: true as const, value: current.notify };
  if (!notify.ok) return notify;
  const terms = chooseTerms(r, current);
  if (!terms.ok) return terms;

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
      font: FONTS.some((f) => f.id === r.font) ? (r.font as FontId) : current.font,
      gst: GST_MODES.some((g) => g.id === r.gst) ? (r.gst as GstMode) : current.gst,
      deposit,
      milestones: milestones.value,
      bank,
      payLink,
      warrantyYears,
      warrantyWords: sent("warrantyWords") ? paragraphs(r.warrantyWords, 3000) : current.warrantyWords,
      installTime: INSTALL_TIMES.some((t) => t.id === r.installTime) ? (r.installTime as InstallTime) : current.installTime,
      notify: notify.value,
      // A switch is only ever moved by an explicit true or false.
      emailReplies: typeof r.emailReplies === "boolean" ? r.emailReplies : current.emailReplies,
      standardTerms: terms.value === "standard",
      terms: terms.value,
      ownTerms: current.ownTerms,
      chart: CHART_STYLES.some((c) => c.id === r.chart) ? (r.chart as ChartStyle) : current.chart,
      netccApproved: typeof r.netccApproved === "boolean" ? r.netccApproved : current.netccApproved,
      blocks: sent("blocks") ? cleanBlocks(r.blocks) : current.blocks,
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
  // The kit's own terms file is carried over first: a save from the browser can never set it, but a kit read back keeps it.
  const ownTerms = readTermsFile(saved && typeof saved === "object" ? (saved as Bag).ownTerms : null);
  const start = { ...defaultBrand(businessName), ownTerms };
  // Its own terms chosen but the file gone (or damaged): our terms, rather than the whole kit set aside.
  const bag = saved && typeof saved === "object" ? (saved as Bag) : {};
  const cleaned = cleanBrandKit(!ownTerms && bag.terms === "own" ? { ...bag, terms: "standard" } : saved, start);
  if (!cleaned.ok) return start;
  // A kit saved before blocks could be arranged has none: it gets the usual ones (`cleanBlocks` fills in any that are missing).
  return { ...cleaned.value, blocks: cleanBlocks(cleaned.value.blocks) };
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/** What a picture is for. One logo and one cover at a time (a new one takes the old one's place); photos for "About"; one for any block of the proposal. */
export const IMAGE_KINDS = ["logo", "cover", "photo", "block"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_LIMITS = {
  /** The largest file taken, before it is made smaller on the server. */
  uploadBytes: 5 * 1024 * 1024,
  /** The longest side kept, in pixels. */
  side: { logo: 800, cover: 1800, photo: 1600, block: 1600 } as Record<ImageKind, number>,
  /** The most pictures kept for the proposal's blocks. */
  blocks: 12,
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
