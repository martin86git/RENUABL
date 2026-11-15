/**
 * RENUABL's own marketing emails (EDMs), built from blocks as the proposal builder's are, but for email:
 * tables and inline styles, so Gmail and Outlook draw them alike. Pure: blocks, cleaning, the fixed footer
 * (sender identity and unsubscribe, which can't be removed: Spam Act 2003, ss 17 and 18) and the HTML and
 * text of one email for one contact.
 */
import { LEGAL } from "../legal";

export const EDM_BLOCK_KINDS = ["heading", "text", "image", "button", "divider"] as const;
export type EdmBlockKind = (typeof EDM_BLOCK_KINDS)[number];

export const EDM_BLOCK_WORDS: Record<EdmBlockKind, string> = {
  heading: "Heading",
  text: "Words",
  image: "Picture",
  button: "Button",
  divider: "Divider",
};

export type EdmAlign = "left" | "center";

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
}

export interface EdmContent {
  subject: string;
  /** The line inboxes show after the subject. */
  preview: string;
  blocks: EdmBlock[];
}

/** The look and sender, set once for every email. */
export interface EdmBrand {
  /** Shown as who the email is from, e.g. "Martin at RENUABL". */
  fromName: string;
  /** Where replies go; blank uses the site's own reply address. */
  replyTo: string | null;
  /** The button and heading colour, six hex digits. */
  colour: string;
  /** Why they're getting it, said in the footer. */
  reason: string;
  /** A postal address for the footer, if wanted. */
  address: string | null;
}

export const DEFAULT_BRAND: EdmBrand = {
  fromName: "RENUABL",
  replyTo: null,
  colour: "#ff5a1f",
  reason: "You're receiving this because your business works in solar, batteries or EV charging.",
  address: null,
};

export const EDM_LIMITS = { blocks: 30, subject: 150, preview: 160, heading: 200, text: 3000, label: 60, alt: 160 } as const;

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
    text: kind === "text" ? words(r.text, max) : kind === "divider" ? "" : line(r.text, max),
    url: kind === "button" || kind === "image" ? cleanLink(r.url) : null,
    imageId: kind === "image" && typeof r.imageId === "string" && /^mimg_[0-9a-f]{24}$/.test(r.imageId) ? r.imageId : null,
    align: r.align === "center" ? "center" : "left",
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
  return { subject: line(r.subject, EDM_LIMITS.subject), preview: line(r.preview, EDM_LIMITS.preview), blocks: cleanBlocks(r.blocks) };
}

export function cleanBrand(raw: unknown): EdmBrand {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const replyTo = line(r.replyTo, 200).toLowerCase();
  return {
    fromName: line(r.fromName, 60).replace(/[<>"@]/g, "") || DEFAULT_BRAND.fromName,
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
  return blocks.filter((b) => (b.kind === "button" || b.kind === "image") && b.url).map((b) => b.url!);
}

/** A fresh block id. */
export function newBlockId(rand: () => number = Math.random): string {
  return Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");
}

export function newBlock(kind: EdmBlockKind, rand?: () => number): EdmBlock {
  const text = kind === "heading" ? "A heading" : kind === "text" ? "Hi {firstName}," : kind === "button" ? "Find out more" : "";
  return { id: newBlockId(rand), kind, text, url: null, imageId: null, align: kind === "button" ? "center" : "left" };
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
      { ...newBlock("heading", rand), text: "Run your solar business from one place" },
      {
        ...newBlock("text", rand),
        text: "Hi {firstName},\n\nRENUABL Business designs the roof, prices it, sends the proposal and runs the job once it's signed.",
      },
      { ...newBlock("button", rand), text: "See RENUABL Business" },
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

/** The footer's lines, the same in the HTML and the text: sender, how to reach us, why, unsubscribe. */
export function footerLines(brand: EdmBrand): string[] {
  return [
    `${LEGAL.tradingAs} (${LEGAL.company}, ABN ${LEGAL.abn})`,
    brand.address ? brand.address : null,
    `Contact us: ${LEGAL.email}`,
    brand.reason,
  ].filter((l): l is string => Boolean(l));
}

/** One email for one contact. Merge fields are filled before escaping, so a name can't add markup. */
export function renderEdm(content: EdmContent, brand: EdmBrand, fields: MergeFields, links: RenderLinks): RenderedEdm {
  const colour = cleanColour(brand.colour);
  const linkList = edmLinks(content.blocks);
  let linkAt = 0;
  const rows: string[] = [];
  const textParts: string[] = [];
  for (const b of content.blocks) {
    const align = b.align === "center" ? "center" : "left";
    if (b.kind === "heading" && b.text) {
      const t = merge(b.text, fields);
      rows.push(
        `<tr><td style="padding:8px 32px 4px;text-align:${align};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:600;color:#0b0b0c">${esc(t)}</td></tr>`,
      );
      textParts.push(t.toUpperCase());
    } else if (b.kind === "text" && b.text) {
      const t = merge(b.text, fields);
      const paras = t
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      rows.push(
        `<tr><td style="padding:8px 32px;text-align:${align};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3c3d41">${paras}</td></tr>`,
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
    }
  }
  const foot = footerLines(brand);
  const footHtml = `${foot.map((l) => esc(l)).join("<br>")}<br><a href="${esc(links.unsubscribe)}" style="color:#7b7d84;text-decoration:underline">Unsubscribe</a> from these emails.`;
  const preview = content.preview ? merge(content.preview, fields) : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(merge(content.subject, fields))}</title></head><body style="margin:0;padding:0;background:#f4f4f5">${
    preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>` : ""
  }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px 32px 8px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.18em;font-weight:700;color:#0b0b0c">RENUABL</td></tr>${rows.join(
    "",
  )}<tr><td style="padding:24px 32px 28px"></td></tr></table><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px"><tr><td style="padding:16px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#7b7d84;text-align:center">${footHtml}</td></tr></table>${
    links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ""
  }</td></tr></table></body></html>`;
  const text = [...textParts, "", "—", ...foot, `Unsubscribe: ${links.unsubscribe}`].join("\n\n").replace(/\n{3,}/g, "\n\n");
  return { subject: merge(content.subject, fields), html, text };
}
