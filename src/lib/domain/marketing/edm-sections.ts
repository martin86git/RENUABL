/**
 * An email laid out in sections (20 Nov 2026, Martin, from instant.one's generated campaigns: "tile sections (perhaps
 * options between 3 sections or 4 sections or 5) and then within each section they can drop in images… and then the
 * text perhaps we could use AI to make the text and put it all together", so two businesses' emails don't look alike).
 * A section is a heading, its words and a picture-tiles block to drop pictures into; a divider parts one from the next
 * and one button closes the email. Sol writes the words for every section from the brief (edm-sol.ts's rules hold);
 * pictures are the business's own, never made up.
 */
import { EDM_LIMITS, MERGE_FIELDS, newBlock, starterContent, type EdmBlock, type EdmContent, type TileColumns } from "./edm";

/** How an email starts: the simple one (a heading, words, a button), or sections. */
export const EDM_LAYOUTS = [1, 3, 4, 5] as const;
export type EdmLayout = (typeof EDM_LAYOUTS)[number];
export const isEdmLayout = (v: unknown): v is EdmLayout => (EDM_LAYOUTS as readonly unknown[]).includes(v);

export const LAYOUT_WORDS: Record<EdmLayout, { label: string; what: string }> = {
  1: { label: "Simple", what: "A heading, your words and a button." },
  3: { label: "3 sections", what: "Three parts, each with its own pictures." },
  4: { label: "4 sections", what: "Four parts, each with its own pictures." },
  5: { label: "5 sections", what: "Five parts, for a newsletter or a range." },
};

export interface SectionWords {
  heading: string;
  text: string;
}

/** What Sol writes for a sectioned email. */
export interface EdmSectionsAnswer {
  subject: string;
  preview: string;
  sections: SectionWords[];
  /** The closing button's words. */
  button: string;
}

const SECTION_WORDS = 70;

/** What Sol is asked for, after his rules (edm-sol.ts `edmSolRules`). */
export function sectionsAsk(count: number): string {
  return [
    `Write a marketing email in exactly ${count} sections, plus its subject line (ideally under 60 characters), its preview line (40 to 90 characters, adding to the subject) and the words on its one closing button (two to four words).`,
    `Each section has a heading (one short line, under 8 words) and its words (under ${SECTION_WORDS} words, short paragraphs a blank line apart).`,
    `The first section's words open with "Hi {firstName}," on its own line. The sections follow on from one another: the first says what this is and why it matters to the reader, the middle ones each take one point, product or reason from the brief, the last leads to the one next step. No sign-off name: the footer says who it's from.`,
    "The business will put its own pictures under each section, so never describe or refer to a picture.",
    `If the brief has too little for ${count} different sections, keep them shorter rather than adding anything that isn't in it.`,
  ].join("\n");
}

export function sectionsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["subject", "preview", "sections", "button"],
    properties: {
      subject: { type: "string" },
      preview: { type: "string" },
      button: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["heading", "text"],
          properties: { heading: { type: "string" }, text: { type: "string" } },
        },
      },
    },
  } as const;
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

/** Sol's sections, tidied to the editor's limits and to the count asked for. Null when there is nothing to use. */
export function cleanSections(raw: unknown, count: number): EdmSectionsAnswer | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = (Array.isArray(r.sections) ? r.sections : [])
    .map((s) => {
      const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      return {
        heading: knownFieldsOnly(oneLine(o.heading, EDM_LIMITS.heading)),
        text: knownFieldsOnly(paragraphs(o.text, EDM_LIMITS.text)),
      };
    })
    .filter((s) => s.heading || s.text)
    .slice(0, count);
  if (!sections.length) return null;
  return {
    subject: knownFieldsOnly(oneLine(r.subject, EDM_LIMITS.subject)),
    preview: knownFieldsOnly(oneLine(r.preview, EDM_LIMITS.preview)),
    sections,
    button: knownFieldsOnly(oneLine(r.button, EDM_LIMITS.label)),
  };
}

/** How many pictures sit across in each section to start with: one large under the opening, then pairs. */
const columnsFor = (index: number): TileColumns => (index === 0 ? 1 : 2);

/**
 * The email a layout starts as, with Sol's words in it when he wrote them. Each section's tiles block starts with one
 * empty spot (two from the second section on): an empty spot is never sent, so nothing needs filling to send.
 */
export function layoutContent(layout: EdmLayout, written: Partial<EdmSectionsAnswer> | null = null, rand?: () => number): EdmContent {
  if (layout === 1) {
    const base = starterContent(rand);
    const first = written?.sections?.[0];
    return {
      subject: written?.subject || base.subject,
      preview: written?.preview || base.preview,
      blocks: base.blocks.map((b) =>
        b.kind === "heading" && first?.heading
          ? { ...b, text: first.heading }
          : b.kind === "text" && first?.text
            ? { ...b, text: first.text }
            : b.kind === "button" && written?.button
              ? { ...b, text: written.button }
              : b,
      ),
    };
  }
  const blocks: EdmBlock[] = [];
  for (let i = 0; i < layout; i++) {
    const s = written?.sections?.[i];
    const columns = columnsFor(i);
    blocks.push({ ...newBlock("heading", rand), text: s?.heading || `Section ${i + 1}` });
    blocks.push({
      ...newBlock("text", rand),
      text: s?.text || (i === 0 ? "Hi {firstName},\n\nWhat you'd like to tell them." : "What this part is about."),
    });
    const tiles = newBlock("tiles", rand);
    blocks.push({ ...tiles, columns, tiles: Array.from({ length: columns }, () => ({ imageId: null, text: "", url: null })) });
    blocks.push(newBlock("divider", rand));
  }
  blocks.pop();
  blocks.push({ ...newBlock("button", rand), text: written?.button || "Find out more" });
  return { subject: written?.subject ?? "", preview: written?.preview ?? "", blocks };
}
