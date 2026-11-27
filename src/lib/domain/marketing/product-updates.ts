/**
 * RENUABL's weekly product updates email, "Launch Day" (27 Nov 2026, Martin: "we need a product updates email…
 * everyweek i will seek to push new updates to the platform… i want to create excitement around it", with MailerLite's
 * monthly "The Spot" as the model: a masthead, a short hello, a button, then what's new).
 *
 * Its only source is the Updates list (domain/design/updates.ts), which is written by hand with every change a user
 * would notice: a week's entries become the draft. Sol picks the few worth leading with and writes them up with some
 * energy (`updatesAsk`, under edm-sol.ts's rules: nothing that isn't in the list, no claim that needs proof); every
 * other change of the week is listed under "Also new this week" exactly as the Updates page words it. With no Sol the
 * same email is made by rule (`byRule`), plainer. Added as a draft campaign once a week by name
 * (/api/design/marketing/updates); never sent or scheduled by adding it. Pure, tested.
 */
import type { Update } from "@/lib/domain/design/updates";
import { UPDATES } from "@/lib/domain/design/updates";
import type { ISODate } from "@/lib/domain/types";
import { EDM_LIMITS, MERGE_FIELDS, type EdmBlock, type EdmContent } from "./edm";
import { GTM_PICTURES, type GtmPicture } from "./gtm-drafts";

const SITE = "https://www.renuabl.com.au/";
export const UPDATES_URL = `${SITE}design/updates`;
const MARKETPLACE = `${SITE}design/marketplace`;

/** The email's own name, on its masthead too (a test keeps the picture tool in step). */
export const UPDATES_EMAIL_NAME = "Launch Day";
export const UPDATES_EMAIL_LINE = "This week's new features in RENUABL";

/** A week is the seven days ending today. */
export const UPDATES_WEEK_DAYS = 7;
/** How many changes Sol leads with, and how many more are listed under them. */
export const UPDATES_HIGHLIGHTS = 4;
export const UPDATES_ALSO = 8;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayWords = (d: ISODate) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/** The day `days` before one, both as ISO dates. */
export function daysBefore(day: ISODate, days: number): ISODate {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) - days);
  return new Date(t).toISOString().slice(0, 10) as ISODate;
}

export interface UpdatesWeek {
  from: ISODate;
  to: ISODate;
  /** The week's changes, newest first, as the Updates page has them. */
  updates: Update[];
}

/** The week ending on a day: its changes from the Updates list. */
export function updatesWeek(today: ISODate, list: readonly Update[] = UPDATES): UpdatesWeek {
  const from = daysBefore(today, UPDATES_WEEK_DAYS - 1);
  return { from, to: today, updates: list.filter((u) => u.day >= from && u.day <= today) };
}

/** The draft campaign's name: one a week, so pressing twice adds nothing. */
export const updatesCampaignName = (week: UpdatesWeek) => `${UPDATES_EMAIL_NAME} · week to ${dayWords(week.to)} ${week.to.slice(0, 4)}`;

export const UPDATES_PICTURES: Record<string, GtmPicture> = {
  launchday: {
    file: "updates-header.jpg",
    alt: `${UPDATES_EMAIL_NAME}. ${UPDATES_EMAIL_LINE}.`,
  },
};

/** The pictures the email needs made: its masthead, and the two bands every RENUABL email ends on. */
export const UPDATES_NEEDS: Record<string, GtmPicture> = {
  ...UPDATES_PICTURES,
  footv: GTM_PICTURES.footv,
  footer: GTM_PICTURES.footer,
};

// ---- What Sol is asked for -------------------------------------------------------------------------------------

/** The week's changes as Sol's brief: numbered, so he can say which ones he led with. */
export function updatesBrief(week: UpdatesWeek): string {
  return [
    `What changed in RENUABL in the week to ${dayWords(week.to)} (${week.updates.length} changes). RENUABL is the all-in-one platform for solar businesses: a design tool, CRM, Sol (its built-in AI) and voice agents. The readers are solar retailers and installers who use it or are thinking about it.`,
    ...week.updates.map((u, i) => `${i + 1}. [${u.area}] ${u.words}`),
  ].join("\n");
}

/** After Sol's rules (edm-sol.ts): the shape of this email and how it should feel. */
export function updatesAsk(week: UpdatesWeek): string {
  const lead = Math.min(UPDATES_HIGHLIGHTS, week.updates.length);
  return [
    `Write this week's product updates email, "${UPDATES_EMAIL_NAME}": the weekly email in which RENUABL tells solar businesses what it shipped. Write as RENUABL ("we").`,
    `Pick the ${lead} changes from the brief that matter most to someone running a solar business (what saves them time, wins them work or gets them paid; never a colour, size or layout tweak unless nothing else is there) and give each a headline and its words. Say which numbered change each is ("update").`,
    "Each headline: under 8 words, about what the reader can now do, not what we built. Each one's words: under 45 words, what it is, then what it means for their day. Two or three short sentences.",
    'Also write: a subject line (under 60 characters) that makes them want to open it, naming the biggest change, not the word "updates"; a preview line (40 to 90 characters) adding the next biggest; a hook, the one headline at the top of the email (under 9 words); and an intro of under 60 words that opens with "Hi {firstName}," on its own line, then says in a breath what landed this week and that there is more below.',
    "Make it exciting the honest way: momentum, pace, the feeling that something new lands every week. Short punchy sentences. Excitement comes from what the reader can now do, never from exclamation marks (none at all), capitals, emoji or hype words like revolutionary, game-changing or supercharge.",
    "Every fact must be in the brief. Don't say how something works beyond what its line says, and never promise what's coming next.",
  ].join("\n");
}

export function updatesSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["subject", "preview", "hook", "intro", "highlights"],
    properties: {
      subject: { type: "string" },
      preview: { type: "string" },
      hook: { type: "string" },
      intro: { type: "string" },
      highlights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["update", "heading", "text"],
          properties: { update: { type: "integer" }, heading: { type: "string" }, text: { type: "string" } },
        },
      },
    },
  } as const;
}

export interface UpdatesHighlight {
  /** Which of the week's changes it is (its place in `week.updates`). */
  index: number;
  heading: string;
  text: string;
}

export interface UpdatesWritten {
  subject: string;
  preview: string;
  hook: string;
  intro: string;
  highlights: UpdatesHighlight[];
}

const oneLine = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim()
        .slice(0, max)
    : "";
const paragraphs = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
    : "";
const knownFieldsOnly = (s: string) => s.replace(/\{[A-Za-z_]+\}/g, (m) => ((MERGE_FIELDS as readonly string[]).includes(m) ? m : ""));
/** Excitement is in the words: no exclamation marks reach the email. */
const calm = (s: string) => s.replace(/!+/g, ".").replace(/\.{2,}/g, ".");

/** Sol's answer, tidied: only highlights that are really one of the week's changes, each once. Null with nothing to use. */
export function cleanUpdatesAnswer(raw: unknown, week: UpdatesWeek): UpdatesWritten | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<number>();
  const highlights: UpdatesHighlight[] = [];
  for (const h of Array.isArray(r.highlights) ? r.highlights : []) {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
    const index = typeof o.update === "number" && Number.isInteger(o.update) ? o.update - 1 : -1;
    const heading = calm(knownFieldsOnly(oneLine(o.heading, EDM_LIMITS.heading)));
    const text = calm(knownFieldsOnly(paragraphs(o.text, 600)));
    if (index < 0 || index >= week.updates.length || seen.has(index) || !heading || !text) continue;
    seen.add(index);
    highlights.push({ index, heading, text });
    if (highlights.length === UPDATES_HIGHLIGHTS) break;
  }
  if (!highlights.length) return null;
  const fallback = byRule(week);
  return {
    subject: calm(knownFieldsOnly(oneLine(r.subject, EDM_LIMITS.subject))) || fallback.subject,
    preview: calm(knownFieldsOnly(oneLine(r.preview, EDM_LIMITS.preview))) || fallback.preview,
    hook: calm(knownFieldsOnly(oneLine(r.hook, EDM_LIMITS.heading))) || fallback.hook,
    intro: calm(knownFieldsOnly(paragraphs(r.intro, 700))) || fallback.intro,
    highlights,
  };
}

/** The same email with no Sol: the newest change of each area leads, in the Updates page's own words. */
export function byRule(week: UpdatesWeek): UpdatesWritten {
  const areas = new Set<string>();
  const highlights: UpdatesHighlight[] = [];
  week.updates.forEach((u, index) => {
    if (areas.has(u.area) || highlights.length === UPDATES_HIGHLIGHTS) return;
    areas.add(u.area);
    highlights.push({ index, heading: `New in ${u.area}`, text: u.words });
  });
  const n = week.updates.length;
  return {
    subject: `${UPDATES_EMAIL_NAME}: ${n} new thing${n === 1 ? "" : "s"} in RENUABL this week`,
    preview: highlights
      .map((h) => week.updates[h.index].area)
      .join(", ")
      .slice(0, EDM_LIMITS.preview),
    hook: `${n} new thing${n === 1 ? "" : "s"} landed this week.`,
    intro: `Hi {firstName},\n\nEvery week we ship. Here's what landed in RENUABL in the week to ${dayWords(week.to)}.`,
    highlights,
  };
}

// ---- The email -------------------------------------------------------------------------------------------------

/** The week's other changes as lines, in the Updates page's words; past `UPDATES_ALSO`, how many more there are. */
export function alsoNew(week: UpdatesWeek, led: readonly number[]): string {
  const rest = week.updates.filter((_, i) => !led.includes(i));
  if (!rest.length) return "";
  const lines = rest.slice(0, UPDATES_ALSO).map((u) => `${u.area}: ${u.words}`);
  const more = rest.length - lines.length;
  if (more > 0) lines.push(`And ${more} more on the Updates page.`);
  return lines.join("\n\n").slice(0, EDM_LIMITS.text);
}

/**
 * The draft: the masthead, the hook, the hello, a button to everything (as the model has it), each highlight, the rest
 * of the week, the button again, and the two bands. Null for a week with nothing on the Updates list.
 */
export function updatesEmail(week: UpdatesWeek, written: UpdatesWritten | null = null): EdmContent | null {
  if (!week.updates.length) return null;
  const w = written ?? byRule(week);
  const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `upd${id}`, imageId: null, ...b });
  const picture = (key: string, url: string) => block(`pic${key}`, { kind: "image", text: UPDATES_NEEDS[key].alt, url, align: "center" });
  const button = (id: string) => block(id, { kind: "button", text: "See everything that's new", url: UPDATES_URL, align: "left" });
  const letters = "abcdefgh";
  const also = alsoNew(
    week,
    w.highlights.map((h) => h.index),
  );
  return {
    subject: w.subject,
    preview: w.preview,
    blocks: [
      picture("launchday", UPDATES_URL),
      block("hook", { kind: "heading", text: w.hook, url: null, align: "left" }),
      block("intro", { kind: "text", text: w.intro, url: null, align: "left" }),
      button("btop"),
      ...w.highlights.flatMap((h, i) => [
        block(`rule${letters[i]}`, { kind: "divider", text: "", url: null, align: "left" }),
        block(`head${letters[i]}`, { kind: "heading", text: h.heading, url: null, align: "left" }),
        block(`text${letters[i]}`, { kind: "text", text: h.text, url: null, align: "left" }),
      ]),
      ...(also
        ? [
            block("rulez", { kind: "divider", text: "", url: null, align: "left" }),
            block("alsoh", { kind: "heading", text: "Also new this week", url: null, align: "left" }),
            block("alsot", { kind: "text", text: also, url: null, align: "left" }),
            button("bend"),
          ]
        : []),
      picture("footv", SITE),
      picture("footer", MARKETPLACE),
    ],
  };
}

/** A picture that couldn't be made is left out, so the draft can still be sent. */
export const withoutEmptyPictures = (c: EdmContent): EdmContent => ({
  ...c,
  blocks: c.blocks.filter((b) => b.kind !== "image" || b.imageId),
});
