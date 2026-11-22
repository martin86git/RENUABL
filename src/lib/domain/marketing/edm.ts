/**
 * A business's marketing emails (EDMs) in RENUABL Business, built from blocks as the proposal builder's are, but for email:
 * tables and inline styles, so Gmail and Outlook draw them alike. Pure: blocks, cleaning, the fixed footer
 * (sender identity and unsubscribe, which can't be removed: Spam Act 2003, ss 17 and 18) and the HTML and
 * text of one email for one contact.
 */

export const EDM_BLOCK_KINDS = ["heading", "text", "image", "tiles", "button", "divider", "spacer", "social"] as const;
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

/** One link in a social links block. */
export interface EdmSocial {
  network: SocialNetwork;
  /** https only; null while it isn't a link yet. */
  url: string | null;
}

/** How many tiles sit across a row. */
export const TILE_COLUMNS = [1, 2, 3] as const;
export type TileColumns = (typeof TILE_COLUMNS)[number];

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
}

export interface EdmContent {
  subject: string;
  /** The line inboxes show after the subject. */
  preview: string;
  blocks: EdmBlock[];
  /** The email's own colours; left out while they are ours. */
  style?: EdmStyle;
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
}

export const DEFAULT_BRAND: EdmBrand = {
  fromName: "",
  replyTo: null,
  colour: "#ff5a1f",
  reason: "You're receiving this because you're one of our customers or contacts.",
  address: null,
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

/** A tiles block's tiles that have a picture: the ones an email shows. */
export const filledTiles = (b: EdmBlock): EdmTile[] => (b.kind === "tiles" ? (b.tiles ?? []).filter((t) => t.imageId) : []);

export function cleanBlock(raw: unknown, i = 0): EdmBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = (EDM_BLOCK_KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as EdmBlockKind) : null;
  if (!kind) return null;
  const max =
    kind === "heading" ? EDM_LIMITS.heading : kind === "button" ? EDM_LIMITS.label : kind === "image" ? EDM_LIMITS.alt : EDM_LIMITS.text;
  return {
    id: blockId(r.id, i),
    kind,
    text:
      kind === "text"
        ? words(r.text, max)
        : kind === "divider" || kind === "tiles" || kind === "spacer" || kind === "social"
          ? ""
          : line(r.text, max),
    url: kind === "button" || kind === "image" ? cleanLink(r.url) : null,
    imageId: kind === "image" ? imageIdOf(r.imageId) : null,
    align: r.align === "center" ? "center" : "left",
    ...(kind === "tiles" ? { tiles: cleanTiles(r.tiles), columns: cleanColumns(r.columns) } : {}),
    ...(kind === "spacer" ? { space: cleanSpace(r.space) } : {}),
    ...(kind === "social" ? { socials: cleanSocials(r.socials) } : {}),
  };
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
    fromName: line(r.fromName, 60).replace(/[<>"@]/g, ""),
    replyTo: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo) ? replyTo : null,
    colour: cleanColour(r.colour),
    reason: line(r.reason, 240) || DEFAULT_BRAND.reason,
    address: line(r.address, 200) || null,
  };
}

/** Why an email can't be sent yet, or null when it's ready. */
export function contentProblem(c: EdmContent): string | null {
  if (!c.subject) return "Give it a subject.";
  if (!c.blocks.some((b) => (b.kind === "heading" || b.kind === "text") && b.text)) return "Add a heading or some words.";
  const button = c.blocks.find((b) => b.kind === "button" && (!b.text || !b.url));
  if (button) return "Every button needs a label and a link (https).";
  const picture = c.blocks.find((b) => b.kind === "image" && !b.imageId);
  if (picture) return "A picture block has no picture. Add one or take the block out.";
  return null;
}

/** Each link in the email, in order: the index is what a click is recorded against (no open redirects). */
export function edmLinks(blocks: EdmBlock[]): string[] {
  return blocks.flatMap((b) =>
    b.kind === "tiles"
      ? filledTiles(b).flatMap((t) => (t.url ? [t.url] : []))
      : b.kind === "social"
        ? filledSocials(b).map((s) => s.url!)
        : (b.kind === "button" || b.kind === "image") && b.url
          ? [b.url]
          : [],
  );
}

/** A fresh block id. */
export function newBlockId(rand: () => number = Math.random): string {
  return Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");
}

export const EMPTY_TILE: EdmTile = { imageId: null, text: "", url: null };

export function newBlock(kind: EdmBlockKind, rand?: () => number): EdmBlock {
  const text = kind === "heading" ? "A heading" : kind === "text" ? "Hi {firstName}," : kind === "button" ? "Find out more" : "";
  return {
    id: newBlockId(rand),
    kind,
    text,
    url: null,
    imageId: null,
    align: kind === "button" ? "center" : "left",
    ...(kind === "tiles" ? { tiles: [EMPTY_TILE], columns: 2 as const } : {}),
    ...(kind === "spacer" ? { space: "medium" as const } : {}),
    ...(kind === "social" ? { socials: [] } : {}),
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
  const colour = cleanColour(brand.colour);
  const style = styleOf(content);
  const ink = inksOf(style);
  const linkList = edmLinks(content.blocks);
  let linkAt = 0;
  const rows: string[] = [];
  const textParts: string[] = [];
  for (const b of content.blocks) {
    const align = b.align === "center" ? "center" : "left";
    if (b.kind === "heading" && b.text) {
      const t = merge(b.text, fields);
      rows.push(
        `<tr><td style="padding:8px 32px 4px;text-align:${align};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:600;color:${ink.heading}">${esc(t)}</td></tr>`,
      );
      textParts.push(t.toUpperCase());
    } else if (b.kind === "text" && b.text) {
      const t = merge(b.text, fields);
      const paras = t
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      rows.push(
        `<tr><td style="padding:8px 32px;text-align:${align};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${ink.words}">${paras}</td></tr>`,
      );
      textParts.push(t);
    } else if (b.kind === "image" && b.imageId) {
      const img = `<img src="${esc(links.image(b.imageId))}" alt="${esc(merge(b.text, fields))}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px">`;
      let cell = img;
      if (b.url) {
        cell = `<a href="${esc(links.click(linkAt, linkList[linkAt]))}" target="_blank">${img}</a>`;
        linkAt++;
      }
      rows.push(`<tr><td style="padding:12px 32px">${cell}</td></tr>`);
      if (b.text) textParts.push(`[${merge(b.text, fields)}]`);
    } else if (b.kind === "tiles") {
      // Only tiles with a picture are sent; an empty spot in the builder is left out.
      const tiles = filledTiles(b);
      if (!tiles.length) continue;
      const cols = Math.min(cleanColumns(b.columns), tiles.length) as TileColumns;
      const gap = 12;
      const width = Math.floor((536 - gap * (cols - 1)) / cols);
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
        `<tr><td style="padding:12px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs.join("")}</table></td></tr>`,
      );
    } else if (b.kind === "button" && b.text && b.url) {
      const href = links.click(linkAt, linkList[linkAt]);
      linkAt++;
      const label = merge(b.text, fields);
      rows.push(
        `<tr><td style="padding:16px 32px;text-align:${align}"><a href="${esc(href)}" target="_blank" style="display:inline-block;background:${colour};color:#ffffff;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px">${esc(label)}</a></td></tr>`,
      );
      textParts.push(`${label}: ${href}`);
    } else if (b.kind === "divider") {
      rows.push(
        `<tr><td style="padding:12px 32px"><div style="height:1px;background:#e4e4e7;line-height:1px;font-size:1px">&nbsp;</div></td></tr>`,
      );
      textParts.push("—");
    } else if (b.kind === "spacer") {
      const h = SPACER_SIZES[cleanSpace(b.space)];
      rows.push(`<tr><td style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</td></tr>`);
    } else if (b.kind === "social") {
      // Words, not icons: pictures are often blocked until a reader allows them, and words always show.
      const socials = filledSocials(b);
      if (!socials.length) continue;
      const pills = socials.map((s) => {
        const href = links.click(linkAt, linkList[linkAt]);
        linkAt++;
        textParts.push(`${SOCIAL_WORDS[s.network]}: ${s.url}`);
        return `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 4px 8px;padding:7px 14px;border:1px solid ${colour};border-radius:999px;color:${colour};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;text-decoration:none">${esc(SOCIAL_WORDS[s.network])}</a>`;
      });
      rows.push(`<tr><td style="padding:12px 28px 4px;text-align:${align}">${pills.join("")}</td></tr>`);
    }
  }
  const foot = footerLines(brand, sender);
  const footHtml = `${foot.map((l) => esc(l)).join("<br>")}<br><a href="${esc(links.unsubscribe)}" style="color:#7b7d84;text-decoration:underline">Unsubscribe</a> from these emails.`;
  const preview = content.preview ? merge(content.preview, fields) : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(merge(content.subject, fields))}</title></head><body style="margin:0;padding:0;background:#f4f4f5">${
    preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>` : ""
  }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${style.background};border-radius:16px"><tr><td style="padding:28px 32px 8px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${ink.heading}">${esc(sender.name)}</td></tr>${rows.join(
    "",
  )}<tr><td style="padding:24px 32px 28px"></td></tr></table><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px"><tr><td style="padding:16px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#7b7d84;text-align:center">${footHtml}</td></tr></table>${
    links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ""
  }</td></tr></table></body></html>`;
  const text = [...textParts, "", "—", ...foot, `Unsubscribe: ${links.unsubscribe}`].join("\n\n").replace(/\n{3,}/g, "\n\n");
  return { subject: merge(content.subject, fields), html, text };
}
