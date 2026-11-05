/**
 * The installation job card (1 Nov 2026, Martin: Primero's copied across, wave 7, in place of ServiceM8). Each sold job
 * has one: the customer and the address, the install day, the system as the deal and its design say, the panel layout
 * and the string design drawn over the roof, and one thread of notes and photos the team and the installer both add
 * to. The business keeps its installers on file (Settings → After the sale → Installers); the card is emailed to one
 * of them with both drawings and a private link (`/job/<48 hex>`, one for each installer on each job), which opens
 * that card on their phone with no sign-in, only while they are still on file. Pure, tested.
 */
import { designPanels, metresPerPixel, ROOF_IMAGE, type Point, type RoofDesign } from "./roof-design";

// ---------------------------------------------------------------------------
// Installers on file
// ---------------------------------------------------------------------------

export interface Installer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const MAX_INSTALLERS = 20;
const EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;
const ID = /^ins_[a-f0-9]{8,32}$/;

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/**
 * The installers as sent: each with a name and a valid email (the card goes there), up to the limit. One without an id
 * is given one by `newId` (the server's), so a card's link keeps pointing at the same installer when their details change.
 */
export function cleanInstallers(raw: unknown, newId: () => string = () => ""): Installer[] {
  const out: Installer[] = [];
  const seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const v = r as Record<string, unknown>;
    const name = line(v.name, 80);
    const email = line(v.email, 254).toLowerCase();
    if (!name || !EMAIL.test(email)) continue;
    let id = typeof v.id === "string" && ID.test(v.id) ? v.id : newId();
    if (!ID.test(id) || seen.has(id)) id = newId();
    if (!ID.test(id)) continue;
    seen.add(id);
    out.push({ id, name, email, phone: line(v.phone, 30) });
    if (out.length >= MAX_INSTALLERS) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The thread of notes and photos
// ---------------------------------------------------------------------------

export const JOB_NOTE_MAX = 4000;
/** One request's photos, together: a large photo is made smaller in the browser first. */
export const JOB_FILES_MAX = 6;
export const JOB_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const JOB_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
export const isJobPicture = (type: string) => type.startsWith("image/") && !type.includes("heic") && !type.includes("heif");

export interface JobFile {
  id: string;
  name: string;
  type: string;
}

export interface JobNote {
  id: string;
  at: string;
  /** "team" is the business's own people; "installer" came from an installer's link. */
  side: "team" | "installer";
  /** Who wrote it, in words: a member's handle, or the installer on file (and the person's own name, when they gave it). */
  by: string;
  text: string;
  files: JobFile[];
}

/** The words of a note, tidied: a few lines at most, within bounds. */
export const cleanNoteText = (raw: unknown) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, JOB_NOTE_MAX)
    : "";

/** Why these files can't go on the card, or null. */
export function jobFilesProblem(files: readonly { size: number; type: string; name: string }[]): string | null {
  if (files.length > JOB_FILES_MAX) return `Up to ${JOB_FILES_MAX} at a time.`;
  for (const f of files) {
    if (!JOB_FILE_TYPES.includes(f.type.toLowerCase())) return `${f.name || "That file"} isn't a photo or a PDF.`;
    if (f.size === 0) return `${f.name || "That file"} is empty.`;
    if (f.size > JOB_FILE_MAX_BYTES) return `${f.name || "That file"} is over 4 MB.`;
  }
  return null;
}

/** Who an installer's note is from: the installer on file, with the person's own name when they gave one. */
export function installerBy(installer: string, person: unknown): string {
  const own = line(person, 60);
  return own && own.toLowerCase() !== installer.toLowerCase() ? `${own} (${installer})` : installer;
}

/** A card's private link token: 48 lower-case hex. */
export const isJobToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{48}$/.test(t);
export const isJobFileId = (t: unknown): t is string => typeof t === "string" && /^jf_[a-f0-9]{16,40}$/.test(t);

// ---------------------------------------------------------------------------
// The drawings: the layout, and the strings
// ---------------------------------------------------------------------------

/** The designer's own string colours, in its order, so the card reads as the design does. */
export const STRING_COLOURS = ["#86efac", "#f9a8d4", "#fdba74", "#fde047", "#7dd3fc", "#c4b5fd", "#fca5a5", "#5eead4"];
export const stringLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `S${i + 1}`);

export interface JobDrawing {
  /** The part of the 640 × 400 roof picture the panels are in, with room round them: "x y w h". */
  viewBox: string;
  /** What is drawn over the picture, as SVG markup made here from numbers and fixed words only. */
  marks: string;
}

const PAD = 28;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One drawing of a design over its roof picture: "layout" draws the panels and where the inverter, battery and main
 * switchboard go; "strings" fills each string's panels in its colour, letters it A, B, C at its first panel and traces
 * its wiring panel to panel. Null when nothing is drawn.
 */
export function jobDrawing(design: RoofDesign, mode: "layout" | "strings"): JobDrawing | null {
  const panels = designPanels(design);
  if (!panels.length) return null;
  const scale = metresPerPixel(design.lat);
  const px = (p: Point) => ({ x: ROOF_IMAGE.width / 2 + p.x / scale, y: ROOF_IMAGE.height / 2 + p.y / scale });
  const shapes = panels.map((p) => ({ key: p.key, pts: p.corners.map(px) }));
  const centre = (pts: { x: number; y: number }[]) => ({
    x: pts.reduce((n, p) => n + p.x, 0) / pts.length,
    y: pts.reduce((n, p) => n + p.y, 0) / pts.length,
  });
  const all = shapes.flatMap((s) => s.pts);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.max(0, Math.min(...xs) - PAD);
  const y0 = Math.max(0, Math.min(...ys) - PAD);
  const x1 = Math.min(ROOF_IMAGE.width, Math.max(...xs) + PAD);
  const y1 = Math.min(ROOF_IMAGE.height, Math.max(...ys) + PAD);
  const poly = (pts: { x: number; y: number }[], fill: string, stroke: string) =>
    `<polygon points="${pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`;
  const label = (x: number, y: number, text: string, size = 7) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#111" stroke="#fff" stroke-width="2" paint-order="stroke">${text}</text>`;
  const out: string[] = [];
  if (mode === "layout") {
    for (const s of shapes) out.push(poly(s.pts, "rgba(17,24,39,0.82)", "rgba(255,255,255,0.9)"));
    const mark = (p: Point | undefined, text: string) => {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const at = px(p);
      out.push(
        `<rect x="${r1(at.x - 9)}" y="${r1(at.y - 6)}" width="18" height="12" rx="2" fill="#fff" stroke="#FF5A1F" stroke-width="1.2"/>`,
      );
      out.push(label(at.x, at.y, text, 6));
    };
    (design.inverters ?? []).forEach((inv, i) =>
      mark(
        inv.x !== undefined && inv.y !== undefined ? { x: inv.x, y: inv.y } : undefined,
        design.inverters!.length > 1 ? `INV${i + 1}` : "INV",
      ),
    );
    if (design.battery) mark({ x: design.battery.x, y: design.battery.y }, "BAT");
    if (design.charger) mark({ x: design.charger.x, y: design.charger.y }, "EV");
    mark(design.switchboard, "MSB");
  } else {
    const strung = new Map<string, number>();
    const strings = (design.strings ?? []).filter((s) => s.panels.length);
    strings.forEach((s, i) => s.panels.forEach((k) => strung.set(k, i)));
    for (const s of shapes) {
      const i = strung.get(s.key);
      out.push(poly(s.pts, i === undefined ? "rgba(17,24,39,0.82)" : STRING_COLOURS[i % STRING_COLOURS.length], "rgba(255,255,255,0.9)"));
    }
    const byKey = new Map(shapes.map((s) => [s.key, centre(s.pts)]));
    strings.forEach((s, i) => {
      const run = s.panels.map((k) => byKey.get(k)).filter((p): p is { x: number; y: number } => Boolean(p));
      if (!run.length) return;
      if (run.length > 1)
        out.push(
          `<polyline points="${run.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")}" fill="none" stroke="#111" stroke-width="0.9" stroke-dasharray="2 1.5"/>`,
        );
      out.push(label(run[0].x, run[0].y, stringLetter(i), 8));
    });
  }
  return { viewBox: `${r1(x0)} ${r1(y0)} ${r1(x1 - x0)} ${r1(y1 - y0)}`, marks: out.join("") };
}

/** The strings in words: "A: 10 panels on inverter 1, input 1". */
export function stringsInWords(design: RoofDesign): string[] {
  const many = (design.inverters?.length ?? 0) > 1;
  return (design.strings ?? [])
    .filter((s) => s.panels.length)
    .map(
      (s, i) =>
        `${stringLetter(i)}: ${s.panels.length} ${s.panels.length === 1 ? "panel" : "panels"} on ${many ? `inverter ${(s.inverter ?? 0) + 1}, ` : ""}input ${(s.mppt ?? 0) + 1}`,
    );
}

/** A whole SVG of a drawing over its picture (a data address, or nothing for a plain ground), to be made a PNG for an email. */
export function drawingSvg(d: JobDrawing, picture: string | null): string {
  const [x, y, w, h] = d.viewBox.split(" ").map(Number);
  const width = Math.round(w * 2);
  const height = Math.round(h * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${d.viewBox}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1f2937"/>${
    picture
      ? `<image href="${picture}" xlink:href="${picture}" x="0" y="0" width="${ROOF_IMAGE.width}" height="${ROOF_IMAGE.height}"/>`
      : ""
  }${d.marks}</svg>`;
}

// ---------------------------------------------------------------------------
// The email to the installer
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The card as an email to an installer on file: from RENUABL's sender in the business's name, the day, the address,
 * the customer's name and phone (never their email), the system, the strings in words, and the link to the card. The
 * two drawings go with it as pictures.
 */
export function jobCardEmail(input: {
  business: string;
  installer: string;
  date: string | null;
  address: string;
  customer: { name: string; phone: string };
  details: { label: string; value: string }[];
  strings: string[];
  link: string;
  drawings: number;
}): { subject: string; text: string; html: string } {
  const day = input.date
    ? new Date(`${input.date}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : "Date to be confirmed";
  const subject = `Job card: ${input.address.split(",")[0] || "installation"} · ${day} · ${input.business}`;
  const rows = [
    ["Installation", day],
    ["Address", input.address],
    ["Customer", [input.customer.name, input.customer.phone].filter(Boolean).join(" · ")],
    ...input.details.map((d) => [d.label, d.value]),
  ];
  const pictures = input.drawings ? "The panel layout and the string design are attached." : "No design is drawn for this job yet.";
  const text = [
    `Hi ${input.installer},`,
    "",
    `${input.business} has sent you the job card for this installation.`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(input.strings.length ? ["", "Strings:", ...input.strings] : []),
    "",
    pictures,
    "",
    `Open the job card to add notes and photos: ${input.link}`,
    "",
    "The link is for you: please don't pass it on.",
  ].join("\n");
  const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#111;max-width:560px">
<p>Hi ${esc(input.installer)},</p>
<p>${esc(input.business)} has sent you the job card for this installation.</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`,
    )
    .join("")}</table>
${input.strings.length ? `<p style="margin-top:16px"><strong>Strings</strong><br>${input.strings.map(esc).join("<br>")}</p>` : ""}
<p style="color:#666">${esc(pictures)}</p>
<p style="margin:24px 0"><a href="${esc(input.link)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Open the job card</a></p>
<p style="font-size:12px;color:#777">Add notes and photos there. The link is for you: please don't pass it on.</p>
</div>`;
  return { subject, text, html };
}
