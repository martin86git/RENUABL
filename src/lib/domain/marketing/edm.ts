/**
 * A business's marketing emails (EDMs) in RENUABL Business, built from blocks as the proposal builder's are, but for email:
 * tables and inline styles, so Gmail and Outlook draw them alike. Pure: blocks, cleaning, the fixed footer
 * (sender identity and unsubscribe, which can't be removed: Spam Act 2003, ss 17 and 18) and the HTML and
 * text of one email for one contact.
 */

import { VIDEO_LINE, videoStillKey } from "./edm-video";
import { COUNTDOWN_HEIGHT, COUNTDOWN_UNITS, COUNTDOWN_WIDTH, cleanEndsAt, endsAtMs, endsWords } from "./countdown";

/**
 * How wide an email is drawn, and the room inside its margins (24 Nov 2026, Martin: the email "is too narrow"; it was
 * 600 and 536 inside, the old newsletter width).
 */
export const EDM_WIDTH = 680;
export const EDM_INNER = EDM_WIDTH - 64;

/** How tall the logo stands at the top of an email. */
export const LOGO_HEIGHT = 44;

/** What a new countdown says over the timer. */
export const COUNTDOWN_LINE = "Offer ends in";

export const EDM_BLOCK_KINDS = [
  "heading",
  "text",
  "image",
  "tiles",
  "button",
  "divider",
  "spacer",
  "social",
  "products",
  "countdown",
  "video",
  "bar",
  "steps",
] as const;
export type EdmBlockKind = (typeof EDM_BLOCK_KINDS)[number];

export const EDM_BLOCK_WORDS: Record<EdmBlockKind, string> = {
  heading: "Heading",
  text: "Words",
  image: "Picture",
  tiles: "Picture tiles",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social links",
  products: "Products",
  countdown: "Countdown",
  video: "Video",
  bar: "Top bar",
  steps: "Numbered steps",
};

export type EdmAlign = "left" | "center";

/** One picture in a tiles block: the picture, a line under it and where it goes when pressed. */
export interface EdmTile {
  imageId: string | null;
  /** The line under the picture, also what it shows for a screen reader. */
  text: string;
  url: string | null;
}

/**
 * A spacer's height (22 Nov 2026, Martin: "add spacer and social blocks to the email builder"): room between blocks
 * with nothing in it.
 */
export const SPACER_SIZES = { small: 16, medium: 32, large: 56 } as const;
export type SpacerSize = keyof typeof SPACER_SIZES;
export const SPACER_WORDS: Record<SpacerSize, string> = { small: "Small", medium: "Medium", large: "Large" };

/**
 * A product in a products block (22 Nov 2026, Martin: "add product blocks to the email builder"): its picture, name, a
 * price line as the business writes it ("$9,990 installed", "From $49 a month"), a few words, and a button to its page.
 * Nothing is read from the price lists: what the business types is what goes, as with every other block.
 */
export interface EdmProduct {
  imageId: string | null;
  name: string;
  price: string;
  text: string;
  /** The button's words; blank is "Find out more". */
  label: string;
  url: string | null;
}

export const PRODUCT_BUTTON = "Find out more";

/**
 * One row of a numbered steps block (27 Nov 2026, Martin, from Xero's invoicing email: a cover, then "1 Customise your
 * invoice, 2 Accept instant online payments…", each a picture beside its number, title, words and a link). Numbered in
 * order; a step is sent once it has a title.
 */
export interface EdmStep {
  imageId: string | null;
  title: string;
  text: string;
  /** The link's words; blank is "Find out more". */
  label: string;
  url: string | null;
}

/** The places a social links block can point to, in the order they are offered. */
export const SOCIAL_NETWORKS = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "x", "website"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export const SOCIAL_WORDS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  website: "Website",
};

/**
 * How a social links block draws its links (22 Nov 2026, Martin: "add icons for the social networks"): each
 * network's icon, its icon and name in a pill, or its name alone. An icon is a picture, so where an inbox blocks
 * pictures it shows the network's name in its place (alt text); the email's text version always lists them in words.
 */
export const SOCIAL_LOOKS = ["icons", "both", "words"] as const;
export type SocialLook = (typeof SOCIAL_LOOKS)[number];
export const SOCIAL_LOOK_WORDS: Record<SocialLook, string> = { icons: "Icons", both: "Icons and names", words: "Names" };
export const cleanSocialLook = (raw: unknown): SocialLook =>
  (SOCIAL_LOOKS as readonly string[]).includes(raw as string) ? (raw as SocialLook) : "icons";

/** One link in a social links block. */
export interface EdmSocial {
  network: SocialNetwork;
  /** https only; null while it isn't a link yet. */
  url: string | null;
}

/** How many tiles sit across a row. */
export const TILE_COLUMNS = [1, 2, 3] as const;
export type TileColumns = (typeof TILE_COLUMNS)[number];

/**
 * A button's own look (26 Nov 2026, Martin: "i need the ability to: edit button shapes and sizes, button colors, button
 * text"), on a Button block and on a Top bar's button. Each is left out of the block while it is the usual one, so an
 * email made before reads as it did: a Button is a pill, a bar's button rounded, both medium, in the brand colour.
 */
/**
 * How wide a block is drawn across the email (27 Nov 2026, Martin: "i want the ability to resize the horizontal sections",
 * a top bar wider than the picture under it): to the card's edge, the column the words and pictures sit in, or narrower.
 * Kept on the bar, a picture, picture tiles and a video; left out while it is the usual one for its kind.
 */
export const BLOCK_WIDTHS = ["full", "column", "narrow"] as const;
export type BlockWidth = (typeof BLOCK_WIDTHS)[number];
export const BLOCK_WIDTH_WORDS: Record<BlockWidth, string> = { full: "Full", column: "Column", narrow: "Narrow" };
/** The space each side, in pixels of the 680 px email, for each width. */
export const BLOCK_WIDTH_SIDE: Record<BlockWidth, number> = { full: 16, column: 32, narrow: 96 };
export const WIDTH_KINDS = ["bar", "image", "tiles", "video"] as const;
export const hasWidth = (kind: EdmBlockKind): boolean => (WIDTH_KINDS as readonly string[]).includes(kind);
/** A block's width: its own, else the usual one (a top bar to the card's edge, the rest the column). */
export const blockWidthOf = (b: Pick<EdmBlock, "kind" | "width">): BlockWidth => b.width ?? (b.kind === "bar" ? "full" : "column");
/** The space each side of a block, in the email's pixels. */
export const blockSide = (b: Pick<EdmBlock, "kind" | "width">): number => BLOCK_WIDTH_SIDE[blockWidthOf(b)];
/** How wide a picture in the block may be, in the email's pixels. */
export const blockInner = (b: Pick<EdmBlock, "kind" | "width">): number => EDM_WIDTH - 2 * blockSide(b);

export const BUTTON_SHAPES = ["pill", "rounded", "square"] as const;
export type ButtonShape = (typeof BUTTON_SHAPES)[number];
export const BUTTON_SHAPE_WORDS: Record<ButtonShape, string> = { pill: "Pill", rounded: "Rounded", square: "Square" };
export const BUTTON_RADIUS: Record<ButtonShape, number> = { pill: 999, rounded: 10, square: 0 };
export const BUTTON_SIZES = ["small", "medium", "large"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];
export const BUTTON_SIZE_WORDS: Record<ButtonSize, string> = { small: "Small", medium: "Medium", large: "Large" };
/** Type size and padding (px) for each size: a Button block's, and the smaller ones of a bar's button. */
const BUTTON_METRICS: Record<"button" | "bar", Record<ButtonSize, [font: number, padY: number, padX: number]>> = {
  button: { small: [13, 9, 18], medium: [15, 12, 24], large: [17, 15, 32] },
  bar: { small: [13, 8, 14], medium: [14, 10, 18], large: [15, 12, 22] },
};

export interface EdmBlock {
  id: string;
  kind: EdmBlockKind;
  /** Heading, words, the button's label, or a picture's description (alt text). */
  text: string;
  /** The button's or picture's link: https only. */
  url: string | null;
  /** An uploaded picture's id (marketing_images). */
  imageId: string | null;
  align: EdmAlign;
  /** A tiles block's pictures (20 Nov 2026, Martin: as many picture blocks in a section as the email needs). */
  tiles?: EdmTile[];
  /** How many of its tiles sit across a row. */
  columns?: TileColumns;
  /** A spacer's height. */
  space?: SpacerSize;
  /** A social links block's links, one a network. */
  socials?: EdmSocial[];
  /** How a social links block draws them. */
  socialLook?: SocialLook;
  /** A products block's products, laid out `columns` across. */
  products?: EdmProduct[];
  /** A numbered steps block's steps, one a row. */
  steps?: EdmStep[];
  /** A countdown's end, a wall-clock time in the market ("YYYY-MM-DDTHH:mm", countdown.ts); null until set. */
  endsAt?: string | null;
  /**
   * The panel colour behind the block (six hex digits), or left out for none (26 Nov 2026, Martin, from Xero's
   * email: sections on coloured panels). Blocks in a row with the same colour make one panel; the words on it are
   * drawn dark or light, whichever reads.
   */
  fill?: string;
  /** A button's shape (a Button block or a bar's button); left out while it is the usual one for its kind. */
  shape?: ButtonShape;
  /** A button's size; left out while medium. */
  size?: ButtonSize;
  /** A button's own colour (six hex digits); left out for the brand colour. Its words are white or near-black, whichever reads. */
  colour?: string;
  /** A Button block as wide as the email's column. */
  wide?: boolean;
  /** A top bar's button words (its `text` is the line beside the button, its `url` where the button goes). */
  label?: string;
  /** How wide it is drawn (`BLOCK_WIDTHS`); left out while the usual one for its kind. */
  width?: BlockWidth;
  /** A heading's or the words' typeface (EDM_FONTS); left out while Modern. */
  font?: EdmFont;
  /** A heading's or the words' size; left out while medium. */
  textSize?: EdmTextSize;
}

/**
 * Typefaces for a heading or the words (27 Nov 2026, Martin: "i need font options and font size options"). Only faces
 * that inboxes have to hand, each with its fallbacks: an email can't count on a web font, and Gmail and Outlook drop them.
 * More of them since the same day (Martin: "i need more font type options"), in three groups (`FONT_GROUPS`): a face a
 * reader's device hasn't got is drawn in the next of its list, each list ending in one every device has.
 */
export const EDM_FONTS = [
  "modern",
  "clean",
  "friendly",
  "wide",
  "geometric",
  "soft",
  "narrow",
  "classic",
  "elegant",
  "bookish",
  "newspaper",
  "editorial",
  "slab",
  "heavy",
  "poster",
  "handwritten",
  "typewriter",
] as const;
export type EdmFont = (typeof EDM_FONTS)[number];
export const FONT_WORDS: Record<EdmFont, string> = {
  modern: "Modern",
  clean: "Clean",
  friendly: "Friendly",
  wide: "Wide",
  geometric: "Geometric",
  soft: "Soft",
  narrow: "Narrow",
  classic: "Classic",
  elegant: "Elegant",
  bookish: "Bookish",
  newspaper: "Newspaper",
  editorial: "Editorial",
  slab: "Slab",
  heavy: "Heavy",
  poster: "Poster",
  handwritten: "Handwritten",
  typewriter: "Typewriter",
};
/** The faces by kind, as the builder lists them. Every face is in exactly one. */
export const FONT_GROUPS: readonly { name: string; fonts: readonly EdmFont[] }[] = [
  { name: "Plain", fonts: ["modern", "clean", "friendly", "wide", "geometric", "soft", "narrow"] },
  { name: "Serif", fonts: ["classic", "elegant", "bookish", "newspaper", "editorial", "slab"] },
  { name: "Display", fonts: ["heavy", "poster", "handwritten", "typewriter"] },
];
export const FONT_STACKS: Record<EdmFont, string> = {
  modern: "Inter,Segoe UI,Helvetica,Arial,sans-serif",
  clean: "'Helvetica Neue',Helvetica,Arial,sans-serif",
  friendly: "'Trebuchet MS',Verdana,Tahoma,sans-serif",
  wide: "Verdana,Geneva,Tahoma,sans-serif",
  geometric: "Futura,'Century Gothic','Avenir Next',Avenir,'Trebuchet MS',Arial,sans-serif",
  soft: "Optima,Candara,'Gill Sans','Gill Sans MT',Calibri,Arial,sans-serif",
  narrow: "'Arial Narrow','Helvetica Neue Condensed','Roboto Condensed',Arial,sans-serif",
  classic: "Georgia,'Times New Roman',Times,serif",
  elegant: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
  bookish: "Garamond,Baskerville,'Baskerville Old Face','Hoefler Text','Times New Roman',serif",
  newspaper: "'Times New Roman',Times,serif",
  editorial: "Didot,'Bodoni MT','Bodoni 72','Playfair Display',Georgia,serif",
  slab: "Rockwell,'Rockwell Nova','Roboto Slab','Courier New',Georgia,serif",
  heavy: "'Arial Black','Helvetica Neue','Segoe UI Black',Arial,sans-serif",
  poster: "Impact,Haettenschweiler,'Franklin Gothic Bold','Arial Narrow',Arial,sans-serif",
  handwritten: "'Segoe Script','Bradley Hand','Brush Script MT','Comic Sans MS',cursive",
  typewriter: "'Courier New',Courier,monospace",
};
export const EDM_TEXT_SIZES = ["small", "medium", "large", "xl"] as const;
export type EdmTextSize = (typeof EDM_TEXT_SIZES)[number];
export const TEXT_SIZE_WORDS: Record<EdmTextSize, string> = { small: "S", medium: "M", large: "L", xl: "XL" };
/** Pixels for a heading and for the words at each size; medium is what they always were. */
export const TEXT_SIZE_PX: Record<"heading" | "text", Record<EdmTextSize, number>> = {
  heading: { small: 19, medium: 24, large: 30, xl: 36 },
  text: { small: 13, medium: 15, large: 17, xl: 19 },
};

type TypeBlock = Pick<EdmBlock, "kind" | "font" | "textSize">;
/** A heading's or the words' typeface, as drawn. */
export const fontStackOf = (b: Pick<EdmBlock, "font">): string => FONT_STACKS[b.font ?? "modern"];
/** A heading's or the words' size in pixels, as drawn. */
export const textPxOf = (b: TypeBlock): number => TEXT_SIZE_PX[b.kind === "heading" ? "heading" : "text"][b.textSize ?? "medium"];

/** The typeface and size as kept: only real choices, and neither while it is the usual. */
function typeFields(r: Record<string, unknown>): Partial<EdmBlock> {
  const font = (EDM_FONTS as readonly unknown[]).includes(r.font) ? (r.font as EdmFont) : null;
  const size = (EDM_TEXT_SIZES as readonly unknown[]).includes(r.textSize) ? (r.textSize as EdmTextSize) : null;
  return { ...(font && font !== "modern" ? { font } : {}), ...(size && size !== "medium" ? { textSize: size } : {}) };
}

/** What a new top bar says, and its button (26 Nov 2026, Martin: Xero's "Ready to choose a plan? Buy now"). */
export const BAR_LINE = "Ready to get started?";
export const BAR_BUTTON = "Start now";

export interface EdmContent {
  subject: string;
  /** The line inboxes show after the subject. */
  preview: string;
  blocks: EdmBlock[];
  /** The email's own colours; left out while they are ours. */
  style?: EdmStyle;
  /** How it is drawn: designed (the card, logo and buttons) unless "letter"; left out while designed. */
  look?: EdmLook;
  /** Who this email is from, e.g. "Martin Smith", in place of the From name in Settings; left out when not given. */
  fromName?: string;
}

/**
 * How an email is drawn (24 Nov 2026, Martin: "build the personal letter style", so marketing emails stop landing in
 * Gmail's Promotions tab). Designed is the card with the logo, colours and buttons. A personal letter is drawn as a
 * person's email is: plain words on white, links as links, pictures as they are, no card, logo, coloured buttons or
 * countdown picture, and the footer in small grey type under it. Gmail files mail by how it looks and how people
 * treat it, so nothing promises the Primary tab; a letter only gives it the best odds.
 */
export const EDM_LOOKS = ["designed", "letter"] as const;
export type EdmLook = (typeof EDM_LOOKS)[number];
export const EDM_LOOK_WORDS: Record<EdmLook, string> = { designed: "Designed", letter: "Personal letter" };

/** The look an email is drawn in. */
export const lookOf = (c: Pick<EdmContent, "look">): EdmLook => (c.look === "letter" ? "letter" : "designed");

/** A sender's name as an inbox shows it: one line, no address marks. */
export const cleanFromName = (raw: unknown): string => line(raw, 60).replace(/[<>"@]/g, "");

/** Who the email says it is from: its own name, else the From name in Settings, else the business. */
export const fromNameOf = (c: Pick<EdmContent, "fromName">, brand: Pick<EdmBrand, "fromName">, sender: Pick<EdmSender, "name">): string =>
  c.fromName || brand.fromName || sender.name;

/** What in a letter makes it read as a newsletter, so Gmail is likelier to file it under Promotions; empty when nothing. */
export function letterWarnings(c: EdmContent): string[] {
  const pictures = c.blocks.reduce(
    (n, b) =>
      n +
      (b.kind === "image" && b.imageId ? 1 : 0) +
      (b.kind === "video" && b.url ? 1 : 0) +
      filledTiles(b).length +
      filledProducts(b).filter((p) => p.imageId).length +
      filledSteps(b).filter((p) => p.imageId).length,
    0,
  );
  const links = edmLinks(c.blocks).length;
  const out: string[] = [];
  if (pictures > 1) out.push(`${pictures} pictures: a letter reads most like a person's email with one at most.`);
  if (c.blocks.some((b) => b.kind === "products" && filledProducts(b).length)) out.push("Product cards read as an advert.");
  if (links > 3) out.push(`${links} links: one or two read more like a person's email.`);
  if (!c.fromName) out.push('Give it a person\'s name as the sender, e.g. "Martin Smith".');
  return out;
}

/**
 * The email's colours (21 Nov 2026, Martin: "add style settings for background and text colour"): the ground the email
 * sits on and its words. `text` null keeps our two greys (near-black headings, softer words); a colour picked is used
 * for headings, words and captions alike.
 */
export interface EdmStyle {
  background: string;
  text: string | null;
}

export const DEFAULT_STYLE: EdmStyle = { background: "#ffffff", text: null };
/** Our colours for headings and for words, while the email has none of its own. */
export const HEADING_INK = "#0b0b0c";
export const WORDS_INK = "#3c3d41";

/** The look and sender, set once for every email. */
export interface EdmBrand {
  /** Shown as who the email is from, e.g. "Martin at Sunrise Solar"; blank uses the business's own name. */
  fromName: string;
  /** Where replies go; blank uses the site's own reply address. */
  replyTo: string | null;
  /** The button and heading colour, six hex digits. */
  colour: string;
  /** Why they're getting it, said in the footer. */
  reason: string;
  /** A postal address for the footer, in place of the business's own; blank uses its own. */
  address: string | null;
  /** The business's logo at the top of every email (a marketing picture's id); without it, its name in words. */
  logoId: string | null;
  /**
   * The logos the business keeps to switch between (27 Nov 2026, Martin: "upload these into the marketing area… so i
   * can switch between logos"), newest first, up to `LOGOS_MAX`; the one in use is `logoId`.
   */
  logos: EdmLogo[];
}

/** A logo kept for emails: its picture, whether it is drawn larger (one with a line under it needs the room), and which of the site's own it came from. */
export interface EdmLogo {
  id: string;
  large: boolean;
  site?: SiteLogo;
}

export const LOGOS_MAX = 6;
/** How a larger logo is drawn: tall enough for a line under a wordmark to be read. */
export const LOGO_LARGE = { height: 67, maxWidth: 320 };

/** RENUABL's own logos, files of the site, which its own business can add to its kept logos in one press. */
export const SITE_LOGOS = {
  plain: { label: "RENUABL", path: "/brand/renuabl-logo.png", large: false },
  tagline: { label: "RENUABL with its line", path: "/brand/renuabl-logo-tagline-email.png", large: true },
} as const;
export type SiteLogo = keyof typeof SITE_LOGOS;
export const SITE_LOGO_KEYS = Object.keys(SITE_LOGOS) as SiteLogo[];

/** The kept logos, each once, the one in use always among them. */
export function cleanLogos(raw: unknown, inUse: string | null = null): EdmLogo[] {
  const out: EdmLogo[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const id = imageIdOf(r.id);
    if (!id || out.some((l) => l.id === id)) continue;
    const site = SITE_LOGO_KEYS.find((k) => k === r.site);
    out.push({ id, large: r.large === true, ...(site ? { site } : {}) });
  }
  if (inUse && !out.some((l) => l.id === inUse)) out.unshift({ id: inUse, large: false });
  // Never the one in use dropped for room.
  return out.length > LOGOS_MAX ? [...out.filter((l) => l.id === inUse), ...out.filter((l) => l.id !== inUse)].slice(0, LOGOS_MAX) : out;
}

/** The brand with this logo in use: kept at the front if new, left where it is if already kept. */
export function withLogo(brand: EdmBrand, id: string, as: { large?: boolean; site?: SiteLogo } = {}): EdmBrand {
  const kept = brand.logos.some((l) => l.id === id);
  const logos = kept ? brand.logos : [{ id, large: as.large === true, ...(as.site ? { site: as.site } : {}) }, ...brand.logos];
  return { ...brand, logoId: id, logos: cleanLogos(logos, id) };
}

/** The brand without this kept logo; if it was the one in use, the business's name shows in words until another is picked. */
export function withoutLogo(brand: EdmBrand, id: string): EdmBrand {
  const logoId = brand.logoId === id ? null : brand.logoId;
  return { ...brand, logoId, logos: brand.logos.filter((l) => l.id !== id) };
}

/** The logo in use drawn regular or larger. */
export function withLogoSize(brand: EdmBrand, large: boolean): EdmBrand {
  return { ...brand, logos: brand.logos.map((l) => (l.id === brand.logoId ? { ...l, large } : l)) };
}

/** How tall and how wide at most the logo in use is drawn. */
export function logoBox(brand: EdmBrand): { height: number; maxWidth: number } {
  return brand.logos.find((l) => l.id === brand.logoId)?.large ? LOGO_LARGE : { height: LOGO_HEIGHT, maxWidth: 240 };
}

export const DEFAULT_BRAND: EdmBrand = {
  fromName: "",
  replyTo: null,
  colour: "#ff5a1f",
  reason: "You're receiving this because you're one of our customers or contacts.",
  address: null,
  logoId: null,
  logos: [],
};

export const EDM_LIMITS = {
  blocks: 30,
  subject: 150,
  preview: 160,
  heading: 200,
  text: 3000,
  label: 60,
  alt: 160,
  tiles: 6,
  caption: 80,
  products: 6,
  productName: 80,
  price: 40,
  productText: 240,
  steps: 5,
  stepTitle: 80,
  stepText: 300,
} as const;

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

const words = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
    : "";

/** An https link (or mailto:), else null. Never javascript: or a bare word. */
export function cleanLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 600) return null;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t)) return t;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const cleanColour = (raw: unknown, fallback = DEFAULT_BRAND.colour) =>
  typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : fallback;

const blockId = (v: unknown, i: number) => (typeof v === "string" && /^[a-z0-9]{4,16}$/.test(v) ? v : `b${i}x${(i * 7919).toString(36)}`);

const imageIdOf = (v: unknown) => (typeof v === "string" && /^mimg_[0-9a-f]{24}$/.test(v) ? v : null);

export function cleanTiles(raw: unknown): EdmTile[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, EDM_LIMITS.tiles).map((t) => {
    const r = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    return { imageId: imageIdOf(r.imageId), text: line(r.text, EDM_LIMITS.caption), url: cleanLink(r.url) };
  });
}

/** The network a link belongs to, from its address; anything else is a website. */
export function networkOf(url: string): SocialNetwork {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "website";
  }
  const on = (d: string) => host === d || host.endsWith(`.${d}`);
  if (on("facebook.com") || on("fb.com")) return "facebook";
  if (on("instagram.com")) return "instagram";
  if (on("linkedin.com")) return "linkedin";
  if (on("youtube.com") || on("youtu.be")) return "youtube";
  if (on("tiktok.com")) return "tiktok";
  if (on("x.com") || on("twitter.com")) return "x";
  return "website";
}

export const cleanSpace = (raw: unknown): SpacerSize => (raw === "small" || raw === "large" ? raw : "medium");

/** A social block's links: known networks only, one each, in the order given. */
export function cleanSocials(raw: unknown): EdmSocial[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<SocialNetwork>();
  const out: EdmSocial[] = [];
  for (const s of raw) {
    const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const network = (SOCIAL_NETWORKS as readonly string[]).includes(r.network as string) ? (r.network as SocialNetwork) : null;
    if (!network || seen.has(network)) continue;
    seen.add(network);
    const url = cleanLink(r.url);
    out.push({ network, url: url && !url.startsWith("mailto:") ? url : null });
  }
  return out;
}

/** A social block's links that go somewhere: the ones an email shows. */
export const filledSocials = (b: EdmBlock): EdmSocial[] => (b.kind === "social" ? (b.socials ?? []).filter((s) => s.url) : []);

export const cleanColumns = (raw: unknown): TileColumns => (raw === 1 || raw === 3 ? raw : 2);

/** A products block's products: up to the limit, each cleaned as its own fields are. */
export function cleanProducts(raw: unknown): EdmProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, EDM_LIMITS.products).map((p) => {
    const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const url = cleanLink(r.url);
    return {
      imageId: imageIdOf(r.imageId),
      name: line(r.name, EDM_LIMITS.productName),
      price: line(r.price, EDM_LIMITS.price),
      text: line(r.text, EDM_LIMITS.productText),
      label: line(r.label, EDM_LIMITS.label),
      url: url && !url.startsWith("mailto:") ? url : null,
    };
  });
}

/** A numbered steps block's steps: up to the limit, each cleaned as its own fields are. */
export function cleanSteps(raw: unknown): EdmStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, EDM_LIMITS.steps).map((p) => {
    const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const url = cleanLink(r.url);
    return {
      imageId: imageIdOf(r.imageId),
      title: line(r.title, EDM_LIMITS.stepTitle),
      text: line(r.text, EDM_LIMITS.stepText),
      label: line(r.label, EDM_LIMITS.label),
      url: url && !url.startsWith("mailto:") ? url : null,
    };
  });
}

/** A numbered steps block's steps that have a title: the ones an email shows, numbered in this order. */
export const filledSteps = (b: EdmBlock): EdmStep[] => (b.kind === "steps" ? (b.steps ?? []).filter((p) => p.title) : []);

/** A products block's products that have a name: the ones an email shows. */
export const filledProducts = (b: EdmBlock): EdmProduct[] => (b.kind === "products" ? (b.products ?? []).filter((p) => p.name) : []);

/** A tiles block's tiles that have a picture: the ones an email shows. */
export const filledTiles = (b: EdmBlock): EdmTile[] => (b.kind === "tiles" ? (b.tiles ?? []).filter((t) => t.imageId) : []);

/** A link to a web page (https), never a mailto: what a video block points to. */
const webLink = (raw: unknown) => {
  const l = cleanLink(raw);
  return l && l.startsWith("https://") ? l : null;
};

export function cleanBlock(raw: unknown, i = 0): EdmBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = (EDM_BLOCK_KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as EdmBlockKind) : null;
  if (!kind) return null;
  const max =
    kind === "heading"
      ? EDM_LIMITS.heading
      : kind === "button"
        ? EDM_LIMITS.label
        : kind === "image"
          ? EDM_LIMITS.alt
          : kind === "countdown" || kind === "video"
            ? EDM_LIMITS.caption
            : kind === "bar"
              ? EDM_LIMITS.heading
              : EDM_LIMITS.text;
  return {
    id: blockId(r.id, i),
    kind,
    text:
      kind === "text"
        ? words(r.text, max)
        : kind === "divider" || kind === "tiles" || kind === "spacer" || kind === "social" || kind === "products" || kind === "steps"
          ? ""
          : line(r.text, max),
    url: kind === "button" || kind === "image" || kind === "bar" ? cleanLink(r.url) : kind === "video" ? webLink(r.url) : null,
    imageId: kind === "image" || kind === "video" ? imageIdOf(r.imageId) : null,
    align: r.align === "center" ? "center" : "left",
    ...(kind === "tiles" ? { tiles: cleanTiles(r.tiles), columns: cleanColumns(r.columns) } : {}),
    ...(kind === "spacer" ? { space: cleanSpace(r.space) } : {}),
    ...(kind === "social" ? { socials: cleanSocials(r.socials), socialLook: cleanSocialLook(r.socialLook) } : {}),
    ...(kind === "products" ? { products: cleanProducts(r.products), columns: cleanColumns(r.columns) } : {}),
    ...(kind === "steps" ? { steps: cleanSteps(r.steps) } : {}),
    ...(kind === "countdown" ? { endsAt: cleanEndsAt(r.endsAt) } : {}),
    ...(kind === "bar" ? { label: line(r.label, EDM_LIMITS.label) } : {}),
    ...(kind === "button" || kind === "bar" ? buttonFields(r, kind) : {}),
    ...(kind === "heading" || kind === "text" ? typeFields(r) : {}),
    ...(cleanColour(r.fill, "") ? { fill: cleanColour(r.fill, "") } : {}),
    ...widthField(r.width, kind),
  };
}

/** A block's width as kept: only a real one, on a kind that has one, and not the usual one for its kind. */
function widthField(raw: unknown, kind: EdmBlockKind): Partial<EdmBlock> {
  if (!hasWidth(kind) || !(BLOCK_WIDTHS as readonly unknown[]).includes(raw)) return {};
  const width = raw as BlockWidth;
  return width === blockWidthOf({ kind }) ? {} : { width };
}

type ButtonBlock = Pick<EdmBlock, "kind" | "shape" | "size" | "colour" | "wide">;

/** The shape a button has: its own, else a pill for a Button block and rounded for a bar's button. */
export const buttonShapeOf = (b: ButtonBlock): ButtonShape => b.shape ?? (b.kind === "bar" ? "rounded" : "pill");
export const buttonSizeOf = (b: ButtonBlock): ButtonSize => b.size ?? "medium";

/** A button's look fields as kept: only real choices, and none that is the usual one for its kind. */
function buttonFields(r: Record<string, unknown>, kind: "button" | "bar"): Partial<EdmBlock> {
  const shape = (BUTTON_SHAPES as readonly unknown[]).includes(r.shape) ? (r.shape as ButtonShape) : null;
  const size = r.size === "small" || r.size === "large" ? r.size : null;
  const colour = cleanColour(r.colour, "");
  return {
    ...(shape && shape !== buttonShapeOf({ kind }) ? { shape } : {}),
    ...(size ? { size } : {}),
    ...(colour ? { colour } : {}),
    ...(kind === "button" && r.wide === true ? { wide: true } : {}),
  };
}

export interface ButtonLook {
  radius: number;
  fontSize: number;
  padY: number;
  padX: number;
  background: string;
  /** The words on it: white, or near-black on a colour too light for white to read. */
  ink: string;
  wide: boolean;
}

/** How a button is drawn, in the email and in the builder alike. */
export function buttonLook(b: ButtonBlock, brandColour: string): ButtonLook {
  const [fontSize, padY, padX] = BUTTON_METRICS[b.kind === "bar" ? "bar" : "button"][buttonSizeOf(b)];
  const background = b.colour ?? brandColour;
  return {
    radius: BUTTON_RADIUS[buttonShapeOf(b)],
    fontSize,
    padY,
    padX,
    background,
    ink: contrastRatio("#ffffff", background) < 2 ? HEADING_INK : "#ffffff",
    wide: b.kind === "button" && b.wide === true,
  };
}

/** A button's inline style in the email. */
function buttonCss(b: ButtonBlock, brandColour: string): string {
  const l = buttonLook(b, brandColour);
  return `display:${l.wide ? "block;text-align:center" : "inline-block"};background:${l.background};color:${l.ink};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:${l.fontSize}px;font-weight:600;text-decoration:none;padding:${l.padY}px ${l.padX}px;border-radius:${l.radius}px`;
}

/** The words' colours on a panel: the email's own text colour when it reads there, else near-black or white. */
export function inksOn(fill: string, style: EdmStyle): { heading: string; words: string } {
  if (style.text && contrastRatio(style.text, fill) >= 4.5) return { heading: style.text, words: style.text };
  const dark = contrastRatio(HEADING_INK, fill) >= contrastRatio("#ffffff", fill);
  return dark ? { heading: HEADING_INK, words: WORDS_INK } : { heading: "#ffffff", words: "#f4f4f5" };
}

export function cleanBlocks(raw: unknown): EdmBlock[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EdmBlock[] = [];
  raw.slice(0, EDM_LIMITS.blocks).forEach((b, i) => {
    const c = cleanBlock(b, i);
    if (!c) return;
    if (seen.has(c.id)) c.id = `${c.id.slice(0, 10)}${i}`;
    seen.add(c.id);
    out.push(c);
  });
  return out;
}

export function cleanContent(raw: unknown): EdmContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const style = cleanStyle(r.style);
  return {
    subject: line(r.subject, EDM_LIMITS.subject),
    preview: line(r.preview, EDM_LIMITS.preview),
    blocks: cleanBlocks(r.blocks),
    ...(isDefaultStyle(style) ? {} : { style }),
    ...(r.look === "letter" ? { look: "letter" as const } : {}),
    ...(cleanFromName(r.fromName) ? { fromName: cleanFromName(r.fromName) } : {}),
  };
}

export function cleanStyle(raw: unknown): EdmStyle {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    background: cleanColour(r.background, DEFAULT_STYLE.background),
    text: r.text === null || r.text === undefined ? null : cleanColour(r.text, "") || null,
  };
}

export const isDefaultStyle = (s: EdmStyle): boolean => s.background === DEFAULT_STYLE.background && s.text === null;

/** The email's colours, ours where it has none. */
export const styleOf = (c: Pick<EdmContent, "style">): EdmStyle => (c.style ? cleanStyle(c.style) : DEFAULT_STYLE);

/** The colour a heading and the words are drawn in. */
export const inksOf = (s: EdmStyle) => ({ heading: s.text ?? HEADING_INK, words: s.text ?? WORDS_INK });

/** How far apart two colours are to read (WCAG's contrast ratio, 1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Words to show when the words would be hard to read on the ground; null when they read well. 4.5 is WCAG's floor for body text. */
export function styleProblem(s: EdmStyle): string | null {
  const { words } = inksOf(s);
  return contrastRatio(words, s.background) < 4.5
    ? "The words will be hard to read on this background. Pick a lighter or darker one."
    : null;
}

export function cleanBrand(raw: unknown): EdmBrand {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const replyTo = line(r.replyTo, 200).toLowerCase();
  return {
    fromName: cleanFromName(r.fromName),
    replyTo: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo) ? replyTo : null,
    colour: cleanColour(r.colour),
    reason: line(r.reason, 240) || DEFAULT_BRAND.reason,
    address: line(r.address, 200) || null,
    logoId: imageIdOf(r.logoId),
    logos: cleanLogos(r.logos, imageIdOf(r.logoId)),
  };
}

/** Why an email can't be sent yet, or null when it's ready. */
export function contentProblem(c: EdmContent): string | null {
  if (!c.subject) return "Give it a subject.";
  if (!c.blocks.some((b) => (b.kind === "heading" || b.kind === "text") && b.text)) return "Add a heading or some words.";
  const button = c.blocks.find((b) => b.kind === "button" && (!b.text || !b.url));
  if (button) return "Every button needs a label and a link (https).";
  if (c.blocks.some((b) => b.kind === "bar" && (!b.text || !b.label || !b.url)))
    return "A top bar needs its line, its button's words and a link (https).";
  const picture = c.blocks.find((b) => b.kind === "image" && !b.imageId);
  if (picture) return "A picture block has no picture. Add one or take the block out.";
  const video = c.blocks.find((b) => b.kind === "video" && (!b.url || !videoStillKey(b.imageId, b.url)));
  if (video)
    return video.url
      ? "A video block needs a picture to show, unless it's a YouTube link."
      : "A video block needs a link to the video (https).";
  if (c.blocks.some((b) => b.kind === "countdown" && !b.endsAt)) return "A countdown has no end. Give it a day and time, or take it out.";
  return null;
}

/** Each link in the email, in order: the index is what a click is recorded against (no open redirects). */
export function edmLinks(blocks: EdmBlock[]): string[] {
  return blocks.flatMap((b) =>
    b.kind === "tiles"
      ? filledTiles(b).flatMap((t) => (t.url ? [t.url] : []))
      : b.kind === "social"
        ? filledSocials(b).map((s) => s.url!)
        : b.kind === "products"
          ? filledProducts(b).flatMap((p) => (p.url ? [p.url] : []))
          : b.kind === "steps"
            ? filledSteps(b).flatMap((p) => (p.url ? [p.url] : []))
            : (b.kind === "button" || b.kind === "image" || b.kind === "video" || b.kind === "bar") && b.url
              ? [b.url]
              : [],
  );
}

/** A fresh block id. */
export function newBlockId(rand: () => number = Math.random): string {
  return Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");
}

export const EMPTY_TILE: EdmTile = { imageId: null, text: "", url: null };
export const EMPTY_PRODUCT: EdmProduct = { imageId: null, name: "", price: "", text: "", label: "", url: null };
export const EMPTY_STEP: EdmStep = { imageId: null, title: "", text: "", label: "", url: null };

export function newBlock(kind: EdmBlockKind, rand?: () => number): EdmBlock {
  const text =
    kind === "heading"
      ? "A heading"
      : kind === "text"
        ? "Hi {firstName},"
        : kind === "button"
          ? "Find out more"
          : kind === "countdown"
            ? COUNTDOWN_LINE
            : kind === "bar"
              ? BAR_LINE
              : "";
  return {
    id: newBlockId(rand),
    kind,
    text,
    url: null,
    imageId: null,
    align: kind === "button" || kind === "countdown" || kind === "video" ? "center" : "left",
    ...(kind === "tiles" ? { tiles: [EMPTY_TILE], columns: 2 as const } : {}),
    ...(kind === "spacer" ? { space: "medium" as const } : {}),
    ...(kind === "social" ? { socials: [], socialLook: "icons" as const } : {}),
    ...(kind === "products" ? { products: [EMPTY_PRODUCT, EMPTY_PRODUCT], columns: 2 as const } : {}),
    ...(kind === "steps" ? { steps: [EMPTY_STEP, EMPTY_STEP, EMPTY_STEP] } : {}),
    ...(kind === "countdown" ? { endsAt: null } : {}),
    ...(kind === "bar" ? { label: BAR_BUTTON } : {}),
  };
}

export function moveBlock(blocks: EdmBlock[], id: string, by: -1 | 1): EdmBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = blocks.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** A starting email: a heading, words with the merge field, a button. */
export function starterContent(rand?: () => number): EdmContent {
  return {
    subject: "",
    preview: "",
    blocks: [
      { ...newBlock("heading", rand), text: "A heading" },
      {
        ...newBlock("text", rand),
        text: "Hi {firstName},\n\nWhat you'd like to tell them.",
      },
      { ...newBlock("button", rand), text: "Find out more" },
    ],
  };
}

export interface MergeFields {
  firstName: string | null;
  company: string | null;
}

export const MERGE_FIELDS = ["{firstName}", "{company}"] as const;

/** Fills {firstName} and {company}; a missing name reads "there", a missing company "your business". */
export function merge(text: string, f: MergeFields): string {
  return text.replace(/\{firstName\}/g, f.firstName?.trim() || "there").replace(/\{company\}/g, f.company?.trim() || "your business");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface RenderLinks {
  /** The address a link is sent through to be counted, by its index in `edmLinks`; or the link itself. */
  click: (index: number, url: string) => string;
  /** The one-pixel picture that counts an open; null leaves it out (tests and previews). */
  pixel: string | null;
  unsubscribe: string;
  /** Where an uploaded picture is served. */
  image: (id: string) => string;
  /** Where a social network's icon in a colour (six hex digits, no #) is served; without it, names only. */
  social?: (network: SocialNetwork, colour: string) => string;
  /** Where a video's still with its play button is drawn, by its key (edm-video.ts) and colour; without it, the picture alone. */
  video?: (key: string, colour: string) => string;
  /** Where a countdown to an end (seconds since 1970) in a colour (six hex digits) is drawn; without it, the end in words only. */
  countdown?: (endSeconds: number, colour: string) => string;
}

export interface RenderedEdm {
  subject: string;
  html: string;
  text: string;
}

/** Who sends the email (the business, from its brand kit): named in the header and footer, with how to reach it. */
export interface EdmSender {
  name: string;
  /** Eleven digits, or null. */
  abn: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /**
   * The business's logo for the top of its emails: a public https address, drawn in place of its name in bold (22 Nov
   * 2026, Martin: RENUABL's own emails carry the website's logo). None, or not https, and the name is written as before.
   */
  logo?: string | null;
  /** The same logo drawn light, for an email on a dark ground (27 Nov 2026: RENUABL's black wordmark vanished on a dark email). */
  logoOnDark?: string | null;
}

/** The email's top line: the sender's logo when there is a safe one (its light one on a dark ground), else its name. */
export function headerCell(sender: EdmSender, dark = false): string {
  const wanted = dark && sender.logoOnDark ? sender.logoOnDark : sender.logo;
  const logo = wanted && /^https:\/\/[^\s"'<>]+$/.test(wanted) ? wanted : null;
  return logo
    ? `<img src="${esc(logo)}" alt="${esc(sender.name || "Logo")}" width="132" style="display:block;width:132px;max-width:132px;height:auto;border:0">`
    : esc(sender.name);
}

/** Why an email can't name its sender properly yet (Spam Act s 17: who sent it and how to contact them), or null. */
export function senderProblem(s: EdmSender): string | null {
  if (!s.name.trim()) return "Give your business its name in Settings, Branding.";
  if (!s.email && !s.phone) return "Add your business's email or phone in Settings, Branding, so every email says how to reach you.";
  return null;
}

const abnWords = (abn: string) => abn.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");

/** The footer's lines, the same in the HTML and the text: who sent it, how to reach them, why, then unsubscribe. */
export function footerLines(brand: EdmBrand, sender: EdmSender): string[] {
  const reach = [sender.email, sender.phone].filter(Boolean).join(" · ");
  return [
    sender.abn ? `${sender.name} (ABN ${abnWords(sender.abn)})` : sender.name,
    brand.address || sender.address,
    reach ? `Contact us: ${reach}` : null,
    brand.reason,
  ].filter((l): l is string => Boolean(l));
}

/** One email for one contact. Merge fields are filled before escaping, so a name can't add markup. */
export function renderEdm(content: EdmContent, brand: EdmBrand, sender: EdmSender, fields: MergeFields, links: RenderLinks): RenderedEdm {
  const designed = renderDesigned(content, brand, sender, fields, links);
  return lookOf(content) === "letter" ? { ...designed, html: renderLetter(content, brand, sender, fields, links) } : designed;
}

/** A personal letter's HTML: a person's email, plain words on white, the footer small under it. Its text is the designed one's. */
function renderLetter(content: EdmContent, brand: EdmBrand, sender: EdmSender, fields: MergeFields, links: RenderLinks): string {
  const linkList = edmLinks(content.blocks);
  let linkAt = 0;
  const next = () => esc(links.click(linkAt, linkList[linkAt++]));
  const a = (href: string, words: string) => `<a href="${href}" target="_blank" style="color:#1155cc">${words}</a>`;
  const img = (src: string, alt: string) =>
    `<img src="${esc(src)}" alt="${esc(alt)}" width="${EDM_INNER}" style="display:block;width:100%;max-width:${EDM_INNER}px;height:auto;border:0">`;
  const p = (inner: string) => `<p style="margin:0 0 14px">${inner}</p>`;
  const parts: string[] = [];
  for (const b of content.blocks) {
    if (b.kind === "heading" && b.text) parts.push(p(`<strong>${esc(merge(b.text, fields))}</strong>`));
    else if (b.kind === "text" && b.text)
      parts.push(
        merge(b.text, fields)
          .split(/\n{2,}/)
          .map((t) => p(esc(t).replace(/\n/g, "<br>")))
          .join(""),
      );
    else if (b.kind === "button" && b.text && b.url) parts.push(p(a(next(), esc(merge(b.text, fields)))));
    else if (b.kind === "bar" && b.url)
      parts.push(p(`${esc(merge(b.text, fields))} ${a(next(), esc(merge(b.label ?? "", fields) || BAR_BUTTON))}`));
    else if (b.kind === "image" && b.imageId) {
      const pic = img(links.image(b.imageId), merge(b.text, fields));
      parts.push(`<div style="margin:0 0 14px">${b.url ? a(next(), pic) : pic}</div>`);
    } else if (b.kind === "tiles")
      for (const t of filledTiles(b)) {
        const caption = merge(t.text, fields);
        const pic = img(links.image(t.imageId!), caption);
        parts.push(
          `<div style="margin:0 0 14px">${t.url ? a(next(), pic) : pic}${caption ? `<div style="padding-top:4px;font-size:13px;color:#5f6368">${esc(caption)}</div>` : ""}</div>`,
        );
      }
    else if (b.kind === "products")
      for (const pr of filledProducts(b)) {
        const name = merge(pr.name, fields);
        const href = pr.url ? next() : null;
        const pic = pr.imageId ? img(links.image(pr.imageId), name) : "";
        const lines = [
          `<strong>${esc(name)}</strong>${pr.price ? ` · ${esc(merge(pr.price, fields))}` : ""}`,
          pr.text ? esc(merge(pr.text, fields)) : "",
          href ? a(href, esc(merge(pr.label, fields) || PRODUCT_BUTTON)) : "",
        ].filter(Boolean);
        parts.push(`${pic ? `<div style="margin:0 0 8px">${href ? a(href, pic) : pic}</div>` : ""}${p(lines.join("<br>"))}`);
      }
    else if (b.kind === "steps")
      filledSteps(b).forEach((st, n) => {
        const title = `${n + 1}. ${merge(st.title, fields)}`;
        const href = st.url ? next() : null;
        const pic = st.imageId ? img(links.image(st.imageId), title) : "";
        const lines = [
          `<strong>${esc(title)}</strong>`,
          st.text ? esc(merge(st.text, fields)) : "",
          href ? a(href, esc(merge(st.label, fields) || PRODUCT_BUTTON)) : "",
        ].filter(Boolean);
        parts.push(`${pic ? `<div style="margin:0 0 8px">${href ? a(href, pic) : pic}</div>` : ""}${p(lines.join("<br>"))}`);
      });
    else if (b.kind === "divider") parts.push(`<hr style="border:0;border-top:1px solid #dadce0;margin:18px 0">`);
    else if (b.kind === "spacer") parts.push(`<div style="height:${SPACER_SIZES[cleanSpace(b.space)]}px"></div>`);
    else if (b.kind === "video" && b.url) {
      const line = merge(b.text, fields) || VIDEO_LINE;
      const href = next();
      const key = videoStillKey(b.imageId, b.url);
      const src =
        key && links.video ? links.video(key, cleanColour(brand.colour).replace("#", "")) : b.imageId ? links.image(b.imageId) : null;
      parts.push(`${src ? `<div style="margin:0 0 6px">${a(href, img(src, `Play: ${line}`))}</div>` : ""}${p(a(href, esc(line)))}`);
    } else if (b.kind === "countdown" && b.endsAt) {
      const label = merge(b.text, fields);
      parts.push(p(`${label ? `<strong>${esc(label)}</strong><br>` : ""}${esc(endsWords(b.endsAt))}`));
    } else if (b.kind === "social") {
      const socials = filledSocials(b);
      if (socials.length) parts.push(p(socials.map((so) => a(next(), esc(SOCIAL_WORDS[so.network]))).join(" &middot; ")));
    }
  }
  const foot = footerLines(brand, sender);
  const preview = content.preview ? merge(content.preview, fields) : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(merge(content.subject, fields))}</title></head><body style="margin:0;padding:0;background:#ffffff">${
    preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>` : ""
  }<div style="max-width:${EDM_WIDTH}px;padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#202124">${parts.join(
    "",
  )}<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e8eaed;font-size:12px;line-height:1.5;color:#80868b">${foot
    .map((l) => esc(l))
    .join("<br>")}<br><a href="${esc(links.unsubscribe)}" style="color:#80868b">Unsubscribe</a> from these emails.</div>${
    links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ""
  }</div></body></html>`;
}

/** A designed email: the card on grey, the logo, headings, buttons in the brand colour. */
function renderDesigned(content: EdmContent, brand: EdmBrand, sender: EdmSender, fields: MergeFields, links: RenderLinks): RenderedEdm {
  const colour = cleanColour(brand.colour);
  const style = styleOf(content);
  const baseInk = inksOf(style);
  let ink = baseInk;
  const linkList = edmLinks(content.blocks);
  let linkAt = 0;
  const rows: string[] = [];
  const textParts: string[] = [];
  // Where each block's rows start and its panel colour, so blocks in a row of one colour become one panel.
  const marks: { at: number; fill: string | null; bar: boolean }[] = [];
  for (const b of content.blocks) {
    marks.push({ at: rows.length, fill: b.kind === "bar" ? null : (b.fill ?? null), bar: b.kind === "bar" });
    ink = b.fill && b.kind !== "bar" ? inksOn(b.fill, style) : baseInk;
    const align = b.align === "center" ? "center" : "left";
    if (b.kind === "bar") {
      // A strip with its line beside a button, at the top of the email above the logo when it comes first.
      if (!b.text || !b.url) continue;
      const href = links.click(linkAt, linkList[linkAt]);
      linkAt++;
      const ground = b.fill ?? (contrastRatio("#000000", style.background) > 10 ? "#f4f4f5" : "#26282c");
      const on = inksOn(ground, style);
      const words = merge(b.text, fields);
      const label = merge(b.label ?? "", fields) || BAR_BUTTON;
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif";
      rows.push(
        `<tr><td style="padding:8px ${blockSide(b)}px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ground};border-radius:12px"><tr><td style="padding:14px 18px;${font};font-size:15px;line-height:1.35;color:${on.heading}">${esc(words)}</td><td align="right" style="padding:10px 14px 10px 0;white-space:nowrap"><a href="${esc(href)}" target="_blank" style="${buttonCss(b, colour)}">${esc(label)}</a></td></tr></table></td></tr>`,
      );
      textParts.push(`${words} ${label}: ${href}`);
      continue;
    }
    if (b.kind === "heading" && b.text) {
      const t = merge(b.text, fields);
      rows.push(
        `<tr><td style="padding:8px 32px 4px;text-align:${align};font-family:${fontStackOf(b)};font-size:${textPxOf(b)}px;line-height:1.25;font-weight:600;color:${ink.heading}">${esc(t)}</td></tr>`,
      );
      textParts.push(t.toUpperCase());
    } else if (b.kind === "text" && b.text) {
      const t = merge(b.text, fields);
      const paras = t
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      rows.push(
        `<tr><td style="padding:8px 32px;text-align:${align};font-family:${fontStackOf(b)};font-size:${textPxOf(b)}px;line-height:1.6;color:${ink.words}">${paras}</td></tr>`,
      );
      textParts.push(t);
    } else if (b.kind === "image" && b.imageId) {
      const inner = blockInner(b);
      const img = `<img src="${esc(links.image(b.imageId))}" alt="${esc(merge(b.text, fields))}" width="${inner}" style="display:block;width:100%;max-width:${inner}px;height:auto;border:0;border-radius:8px">`;
      let cell = img;
      if (b.url) {
        cell = `<a href="${esc(links.click(linkAt, linkList[linkAt]))}" target="_blank">${img}</a>`;
        linkAt++;
      }
      rows.push(`<tr><td style="padding:12px ${blockSide(b)}px">${cell}</td></tr>`);
      if (b.text) textParts.push(`[${merge(b.text, fields)}]`);
    } else if (b.kind === "tiles") {
      // Only tiles with a picture are sent; an empty spot in the builder is left out.
      const tiles = filledTiles(b);
      if (!tiles.length) continue;
      const cols = Math.min(cleanColumns(b.columns), tiles.length) as TileColumns;
      const gap = 12;
      const width = Math.floor((blockInner(b) - gap * (cols - 1)) / cols);
      const cells = tiles.map((t) => {
        const caption = merge(t.text, fields);
        const img = `<img src="${esc(links.image(t.imageId!))}" alt="${esc(caption)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:8px">`;
        let inner = img;
        if (t.url) {
          inner = `<a href="${esc(links.click(linkAt, linkList[linkAt]))}" target="_blank" style="text-decoration:none">${img}</a>`;
          linkAt++;
        }
        if (caption) {
          inner += `<div style="padding:8px 2px 0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.4;color:${ink.words};text-align:${align}">${esc(caption)}</div>`;
          textParts.push(`[${caption}]`);
        }
        return inner;
      });
      const trs: string[] = [];
      for (let at = 0; at < cells.length; at += cols) {
        const row = cells.slice(at, at + cols);
        while (row.length < cols) row.push("");
        trs.push(
          `<tr>${row
            .map(
              (c, i) =>
                `<td width="${Math.round(100 / cols)}%" valign="top" style="padding:0 ${i < cols - 1 ? gap / 2 : 0}px ${gap}px ${i > 0 ? gap / 2 : 0}px">${c}</td>`,
            )
            .join("")}</tr>`,
        );
      }
      rows.push(
        `<tr><td style="padding:12px ${blockSide(b)}px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs.join("")}</table></td></tr>`,
      );
    } else if (b.kind === "steps") {
      // Each step a row: its picture on the left, then its number, title, words and link; numbered in order.
      const steps = filledSteps(b);
      if (!steps.length) continue;
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif";
      const picW = Math.floor(EDM_INNER * 0.46);
      const trs = steps.map((st, n) => {
        const title = merge(st.title, fields);
        const href = st.url ? links.click(linkAt, linkList[linkAt]) : null;
        if (st.url) linkAt++;
        const label = merge(st.label, fields) || PRODUCT_BUTTON;
        const pic = st.imageId
          ? `<td width="46%" valign="middle" style="padding:0 20px ${n < steps.length - 1 ? 22 : 0}px 0"><img src="${esc(links.image(st.imageId))}" alt="${esc(title)}" width="${picW}" style="display:block;width:100%;max-width:${picW}px;height:auto;border:0;border-radius:14px"></td>`
          : "";
        const words = [
          `<div style="width:34px;height:34px;line-height:34px;border-radius:50%;background:${colour};color:#ffffff;${font};font-size:16px;font-weight:700;text-align:center">${n + 1}</div>`,
          `<div style="padding-top:12px;${font};font-size:19px;line-height:1.3;font-weight:700;color:${ink.heading}">${esc(title)}</div>`,
          st.text
            ? `<div style="padding-top:6px;${font};font-size:14px;line-height:1.5;color:${ink.words}">${esc(merge(st.text, fields))}</div>`
            : "",
          href
            ? `<div style="padding-top:12px;${font};font-size:14px;font-weight:600"><a href="${esc(href)}" target="_blank" style="color:${colour};text-decoration:underline">${esc(label)}</a> <span style="color:${colour}">&rarr;</span></div>`
            : "",
        ].join("");
        textParts.push(
          [`${n + 1}. ${title}`, st.text ? merge(st.text, fields) : "", href ? `${label}: ${href}` : ""].filter(Boolean).join("\n"),
        );
        return `<tr>${pic}<td valign="middle" style="padding:0 0 ${n < steps.length - 1 ? 22 : 0}px">${words}</td></tr>`;
      });
      rows.push(
        `<tr><td style="padding:16px ${blockSide(b)}px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs.join("")}</table></td></tr>`,
      );
    } else if (b.kind === "products") {
      // A product is sent once it has a name; its picture and button only when given.
      const products = filledProducts(b);
      if (!products.length) continue;
      const cols = Math.min(cleanColumns(b.columns), products.length) as TileColumns;
      const gap = 16;
      const width = Math.floor((EDM_INNER - gap * (cols - 1)) / cols);
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif";
      const cells = products.map((p) => {
        const name = merge(p.name, fields);
        const href = p.url ? links.click(linkAt, linkList[linkAt]) : null;
        if (p.url) linkAt++;
        let inner = "";
        if (p.imageId) {
          const img = `<img src="${esc(links.image(p.imageId))}" alt="${esc(name)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:8px">`;
          inner += href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none">${img}</a>` : img;
        }
        inner += `<div style="padding:${p.imageId ? 10 : 0}px 2px 0;${font};font-size:16px;line-height:1.35;font-weight:600;color:${ink.heading};text-align:${align}">${esc(name)}</div>`;
        if (p.price)
          inner += `<div style="padding:2px 2px 0;${font};font-size:15px;line-height:1.4;font-weight:600;color:${colour};text-align:${align}">${esc(merge(p.price, fields))}</div>`;
        if (p.text)
          inner += `<div style="padding:6px 2px 0;${font};font-size:13px;line-height:1.5;color:${ink.words};text-align:${align}">${esc(merge(p.text, fields))}</div>`;
        const label = merge(p.label, fields) || PRODUCT_BUTTON;
        if (href)
          inner += `<div style="padding:12px 2px 0;text-align:${align}"><a href="${esc(href)}" target="_blank" style="display:inline-block;background:${colour};color:#ffffff;${font};font-size:13px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:999px">${esc(label)}</a></div>`;
        textParts.push(
          [p.price ? `${name}: ${merge(p.price, fields)}` : name, p.text ? merge(p.text, fields) : "", href ? `${label}: ${href}` : ""]
            .filter(Boolean)
            .join("\n"),
        );
        return inner;
      });
      const trs: string[] = [];
      for (let at = 0; at < cells.length; at += cols) {
        const row = cells.slice(at, at + cols);
        while (row.length < cols) row.push("");
        trs.push(
          `<tr>${row
            .map(
              (c, i) =>
                `<td width="${Math.round(100 / cols)}%" valign="top" style="padding:0 ${i < cols - 1 ? gap / 2 : 0}px ${gap + 4}px ${i > 0 ? gap / 2 : 0}px">${c}</td>`,
            )
            .join("")}</tr>`,
        );
      }
      rows.push(
        `<tr><td style="padding:12px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs.join("")}</table></td></tr>`,
      );
    } else if (b.kind === "button" && b.text && b.url) {
      const href = links.click(linkAt, linkList[linkAt]);
      linkAt++;
      const label = merge(b.text, fields);
      rows.push(
        `<tr><td style="padding:16px 32px;text-align:${align}"><a href="${esc(href)}" target="_blank" style="${buttonCss(b, colour)}">${esc(label)}</a></td></tr>`,
      );
      textParts.push(`${label}: ${href}`);
    } else if (b.kind === "divider") {
      rows.push(
        `<tr><td style="padding:12px 32px"><div style="height:1px;background:#e4e4e7;line-height:1px;font-size:1px">&nbsp;</div></td></tr>`,
      );
      textParts.push("—");
    } else if (b.kind === "video") {
      // A mail app doesn't play video: a still with a play button, linked to where it plays, and a line under it.
      if (!b.url) continue;
      const key = videoStillKey(b.imageId, b.url);
      const href = links.click(linkAt, linkList[linkAt]);
      linkAt++;
      const line = merge(b.text, fields) || VIDEO_LINE;
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif";
      const src = key && links.video ? links.video(key, colour.replace("#", "")) : b.imageId ? links.image(b.imageId) : null;
      let inner = src
        ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none"><img src="${esc(src)}" alt="${esc(`Play: ${line}`)}" width="${blockInner(b)}" style="display:block;width:100%;max-width:${blockInner(b)}px;height:auto;border:0;border-radius:8px"></a>`
        : "";
      inner += `<div style="padding:${src ? 10 : 0}px 0 0;text-align:${align}"><a href="${esc(href)}" target="_blank" style="${font};font-size:14px;font-weight:600;color:${colour};text-decoration:none">&#9654;&nbsp;${esc(line)}</a></div>`;
      rows.push(`<tr><td style="padding:12px ${blockSide(b)}px">${inner}</td></tr>`);
      textParts.push(`${line}: ${href}`);
    } else if (b.kind === "countdown") {
      // The timer is a picture drawn at each open; the line over it, the units and the end in words are text.
      if (!b.endsAt) continue;
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif";
      const label = merge(b.text, fields);
      const when = endsWords(b.endsAt);
      let inner = "";
      if (label)
        inner += `<div style="padding:0 0 10px;${font};font-size:17px;line-height:1.35;font-weight:600;color:${ink.heading};text-align:${align}">${esc(label)}</div>`;
      if (links.countdown) {
        const src = links.countdown(Math.round(endsAtMs(b.endsAt) / 1000), colour.replace("#", ""));
        inner += `<img src="${esc(src)}" alt="${esc(when)}" width="${EDM_INNER}" height="${Math.round((COUNTDOWN_HEIGHT * EDM_INNER) / COUNTDOWN_WIDTH)}" style="display:block;width:100%;max-width:${EDM_INNER}px;height:auto;border:0">`;
        inner += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${COUNTDOWN_UNITS.map(
          (u) =>
            `<td width="25%" style="padding:6px 0 0;${font};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${ink.words};text-align:center">${u}</td>`,
        ).join("")}</tr></table>`;
      }
      inner += `<div style="padding:${links.countdown ? 10 : 0}px 0 0;${font};font-size:${links.countdown ? 13 : 16}px;line-height:1.4;${links.countdown ? "" : "font-weight:600;"}color:${links.countdown ? ink.words : ink.heading};text-align:${align}">${esc(when)}</div>`;
      rows.push(`<tr><td style="padding:12px 32px">${inner}</td></tr>`);
      textParts.push([label, when].filter(Boolean).join("\n"));
    } else if (b.kind === "spacer") {
      const h = SPACER_SIZES[cleanSpace(b.space)];
      rows.push(`<tr><td style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</td></tr>`);
    } else if (b.kind === "social") {
      const socials = filledSocials(b);
      if (!socials.length) continue;
      const look = links.social ? cleanSocialLook(b.socialLook) : "words";
      const hex = colour.replace("#", "");
      const font = "font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600";
      const pills = socials.map((s) => {
        const href = links.click(linkAt, linkList[linkAt]);
        linkAt++;
        const name = SOCIAL_WORDS[s.network];
        textParts.push(`${name}: ${s.url}`);
        if (look === "words")
          return `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 4px 8px;padding:7px 14px;border:1px solid ${colour};border-radius:999px;color:${colour};${font};text-decoration:none">${esc(name)}</a>`;
        const icon = esc(links.social!(s.network, hex));
        if (look === "icons")
          return `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 5px 8px;text-decoration:none;color:${colour};${font}"><img src="${icon}" width="32" height="32" alt="${esc(name)}" style="display:block;width:32px;height:32px;border:0"></a>`;
        return `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 4px 8px;padding:5px 14px 5px 6px;border:1px solid ${colour};border-radius:999px;color:${colour};${font};text-decoration:none"><img src="${icon}" width="20" height="20" alt="" style="display:inline-block;width:20px;height:20px;border:0;vertical-align:middle;margin-right:6px">${esc(name)}</a>`;
      });
      rows.push(`<tr><td style="padding:12px 28px 4px;text-align:${align}">${pills.join("")}</td></tr>`);
    }
  }
  // Blocks in a row with one panel colour are drawn on one rounded panel; top bars that lead the email go above the logo.
  const blockRows = marks.map((m, i) => ({ ...m, rows: rows.slice(m.at, marks[i + 1]?.at ?? rows.length) }));
  let lead = 0;
  while (lead < blockRows.length && blockRows[lead].bar) lead++;
  const above = blockRows.slice(0, lead).flatMap((m) => m.rows);
  const body: string[] = [];
  for (let i = lead; i < blockRows.length;) {
    const fill = blockRows[i].fill;
    let j = i;
    while (j < blockRows.length && blockRows[j].fill === fill) j++;
    const inner = blockRows.slice(i, j).flatMap((m) => m.rows);
    if (fill && inner.length)
      body.push(
        `<tr><td style="padding:10px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fill};border-radius:16px"><tr><td style="height:16px;line-height:16px;font-size:1px">&nbsp;</td></tr>${inner.join("")}<tr><td style="height:16px;line-height:16px;font-size:1px">&nbsp;</td></tr></table></td></tr>`,
      );
    else body.push(...inner);
    i = j;
  }
  const ink0 = baseInk;
  const foot = footerLines(brand, sender);
  const footHtml = `${foot.map((l) => esc(l)).join("<br>")}<br><a href="${esc(links.unsubscribe)}" style="color:#7b7d84;text-decoration:underline">Unsubscribe</a> from these emails.`;
  const preview = content.preview ? merge(content.preview, fields) : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(merge(content.subject, fields))}</title></head><body style="margin:0;padding:0;background:#f4f4f5">${
    preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>` : ""
  }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="${EDM_WIDTH}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${EDM_WIDTH}px;background:${style.background};border-radius:16px">${above.length ? `<tr><td style="height:8px;line-height:8px;font-size:1px">&nbsp;</td></tr>${above.join("")}` : ""}<tr><td style="padding:28px 32px 8px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${ink0.heading}">${
    brand.logoId
      ? `<img src="${esc(links.image(brand.logoId))}" alt="${esc(sender.name)}" height="${logoBox(brand).height}" style="display:block;height:${logoBox(brand).height}px;width:auto;max-width:${logoBox(brand).maxWidth}px;border:0">`
      : headerCell(sender, contrastRatio("#ffffff", style.background) > contrastRatio("#000000", style.background))
  }</td></tr>${body.join(
    "",
  )}<tr><td style="padding:24px 32px 28px"></td></tr></table><table role="presentation" width="${EDM_WIDTH}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${EDM_WIDTH}px"><tr><td style="padding:16px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#7b7d84;text-align:center">${footHtml}</td></tr></table>${
    links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ""
  }</td></tr></table></body></html>`;
  const text = [...textParts, "", "—", ...foot, `Unsubscribe: ${links.unsubscribe}`].join("\n\n").replace(/\n{3,}/g, "\n\n");
  return { subject: merge(content.subject, fields), html, text };
}
