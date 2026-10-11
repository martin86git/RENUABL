/**
 * The blocks a proposal is made of, and how a business arranges them: which
 * are shown, in what order, and for each its own heading, a few words and
 * one picture. Pure. The proposal's page and its PDF both follow this list,
 * so they can't come apart.
 *
 * Some blocks can't be switched off, because a customer must never be sent a
 * proposal without them: the cover (who it is from and for), the price (with
 * the words that go beside the federal rebate and Solar Victoria), going
 * ahead, and the conditions the customer accepts when there are some. The
 * notes that mark a figure as an estimate belong to their blocks and can't
 * be edited: a block shown is shown with its notes.
 */

export const BLOCKS = [
  {
    id: "cover",
    name: "Cover",
    heading: "",
    about: "Who the proposal is from and for, the three figures that sum it up, and your note.",
    locked: true,
  },
  { id: "system", name: "The system", heading: "Your system", about: "The panels, inverter and battery, and what is known of the home." },
  { id: "roof", name: "Roof layout", heading: "Your roof", about: "The panels as designed, seen from above." },
  { id: "production", name: "Output", heading: "What it makes", about: "The estimated output, month by month." },
  {
    id: "bill",
    name: "Savings",
    heading: "Your power bill",
    about: "The bill now and with the system, when a bill was entered. Always shown as estimates.",
  },
  {
    id: "price",
    name: "Price",
    heading: "Your price",
    about: "The price, the federal rebate, and Solar Victoria when it is on the quote.",
    locked: true,
  },
  {
    id: "payment",
    name: "Payment terms",
    heading: "Payment",
    about: "Your deposit, payment milestones and bank details, from Payment terms.",
  },
  {
    id: "timing",
    name: "Installation time",
    heading: "Installation",
    about: "How long installation usually takes from going ahead, from Installation time.",
  },
  { id: "warranty", name: "Workmanship warranty", heading: "Warranty", about: "Your own workmanship warranty, from Workmanship warranty." },
  { id: "about", name: "About you", heading: "", about: "Your words about your business, your reasons to choose you, and your photos." },
  { id: "custom-1", name: "Your own block 1", heading: "", about: "A heading, words and a picture of your own.", custom: true },
  { id: "custom-2", name: "Your own block 2", heading: "", about: "A heading, words and a picture of your own.", custom: true },
  { id: "custom-3", name: "Your own block 3", heading: "", about: "A heading, words and a picture of your own.", custom: true },
  { id: "accept", name: "Going ahead", heading: "", about: "Where the customer goes ahead or asks a question.", locked: true },
  {
    id: "conditions",
    name: "Special conditions",
    heading: "Special conditions",
    about: "Your special conditions, which the customer accepts when going ahead.",
    locked: true,
  },
  {
    id: "terms",
    name: "Standard terms and conditions",
    heading: "Terms and conditions",
    about:
      "The contract details, the New Energy Tech consumer information and the standard terms. Switched on or off under Standard terms and conditions, and never reworded here.",
    locked: true,
    fixed: true,
  },
] as const satisfies readonly {
  id: string;
  name: string;
  heading: string;
  about: string;
  locked?: boolean;
  custom?: boolean;
  fixed?: boolean;
}[];

export type BlockId = (typeof BLOCKS)[number]["id"];

const known = (id: unknown): id is BlockId => BLOCKS.some((b) => b.id === id);
const kind = (id: BlockId) =>
  BLOCKS.find((b) => b.id === id) as { id: BlockId; locked?: boolean; custom?: boolean; fixed?: boolean; heading: string };

/** Whether a block always shows. */
export const isLocked = (id: BlockId) => Boolean(kind(id).locked);
/** Whether a block is fixed: always last, and never given a heading, words or a picture of the business's own (the standard terms). */
export const isFixed = (id: BlockId) => Boolean(kind(id).fixed);
/** Whether a block is one of the business's own (shown only when it has something in it). */
export const isCustom = (id: BlockId) => Boolean(kind(id).custom);

/** One block as a business has set it. */
export interface BlockSetting {
  id: BlockId;
  /** Shown or not. Always true for a block that can't be switched off. */
  on: boolean;
  /** Its own heading: empty for the usual one. */
  heading: string;
  /** A few words of the business's own, shown at the top of the block. */
  words: string;
  /** One picture (a `design_files` id), or none. */
  image: string | null;
}

/** The blocks as every business starts: all the usual ones on, in the usual order, its own three off. */
export function defaultBlocks(): BlockSetting[] {
  const all: BlockSetting[] = BLOCKS.map((b) => ({ id: b.id, on: !("custom" in b), heading: "", words: "", image: null }));
  // The standard terms close the proposal.
  return [...all.filter((b) => !isFixed(b.id)), ...all.filter((b) => isFixed(b.id))];
}

const text = (raw: unknown, max: number, lines: boolean) =>
  typeof raw === "string"
    ? (lines
        ? raw
            .replace(/\r\n?/g, "\n")
            .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
            .replace(/\n{3,}/g, "\n\n")
        : raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ")
      )
        .trim()
        .slice(0, max)
    : "";

/**
 * The blocks as sent by a browser, made whole: each known block once, in the
 * order sent (any left out go after, in their usual order), the cover always
 * first, the ones that can't be switched off always on, and nothing kept
 * that isn't a block. The standard terms are always last and carry no words
 * of the business's own. Whatever is sent, the answer is a full, valid list.
 */
export function cleanBlocks(raw: unknown): BlockSetting[] {
  const seen = new Set<BlockId>();
  const out: BlockSetting[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, 60) : []) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    if (!known(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      on: isLocked(e.id) || (e.on === undefined ? !isCustom(e.id) : e.on === true),
      heading: isFixed(e.id) ? "" : text(e.heading, 80, false),
      words: isFixed(e.id) ? "" : text(e.words, 1500, true),
      image: !isFixed(e.id) && typeof e.image === "string" && /^img_[a-f0-9]{8,64}$/.test(e.image) ? e.image : null,
    });
  }
  for (const block of defaultBlocks()) if (!seen.has(block.id)) out.push(block);
  // The cover opens the proposal and the standard terms close it, whatever order was sent.
  const middle = out.filter((b) => b.id !== "cover" && !isFixed(b.id));
  return [...out.filter((b) => b.id === "cover"), ...middle, ...out.filter((b) => isFixed(b.id))];
}

/** The list with one block moved a place up or down. The cover stays first and the standard terms last: nothing moves past either. */
export function moveBlock(blocks: readonly BlockSetting[], id: BlockId, by: -1 | 1): BlockSetting[] {
  const from = blocks.findIndex((b) => b.id === id);
  const to = from + by;
  if (from < 1 || to < 1 || to >= blocks.length || isFixed(blocks[from].id) || isFixed(blocks[to].id)) return [...blocks];
  const next = [...blocks];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** A block as a published proposal carries it: only the ones that are shown, in order. */
export interface ViewBlock {
  id: BlockId;
  heading: string;
  words: string;
  image: { id: string; kind: string; width: number; height: number } | null;
}

/** The usual blocks, for a proposal published before blocks could be arranged. */
export const USUAL_BLOCKS: ViewBlock[] = defaultBlocks()
  .filter((b) => b.on)
  .map((b) => ({ id: b.id, heading: "", words: "", image: null }));

/** The blocks a proposal shows, in order: its own, or the usual ones for one published before they could be arranged. */
export function viewBlocks(view: { blocks?: ViewBlock[] }): ViewBlock[] {
  return view.blocks?.length ? view.blocks : USUAL_BLOCKS;
}

/** A block's heading as it is shown: the business's own, else the usual one (`fallback` for a block whose usual heading depends on the proposal). */
export function blockHeading(block: Pick<ViewBlock, "id" | "heading">, fallback = ""): string {
  return block.heading || kind(block.id).heading || fallback;
}
