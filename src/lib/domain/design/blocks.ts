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
  { id: "custom-4", name: "Your own block 4", heading: "", about: "A heading, words and a picture of your own.", custom: true },
  { id: "custom-5", name: "Your own block 5", heading: "", about: "A heading, words and a picture of your own.", custom: true },
  { id: "custom-6", name: "Your own block 6", heading: "", about: "A heading, words and a picture of your own.", custom: true },
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

/**
 * Where a block's own picture sits: across the block above its words, or beside them on the left or the right (on a
 * phone it always sits above).
 */
export const BLOCK_LAYOUTS = [
  { id: "stack", name: "Picture across" },
  { id: "left", name: "Picture left" },
  { id: "right", name: "Picture right" },
] as const;
export type BlockLayout = (typeof BLOCK_LAYOUTS)[number]["id"];

/**
 * A block's ground. Dark only for the blocks made of the business's own words (its own blocks and About you): the
 * blocks that carry figures keep the page's ground, so prices and estimates always read the same way.
 */
export const BLOCK_TONES = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;
export type BlockTone = (typeof BLOCK_TONES)[number]["id"];

/**
 * A block's picture can be made smaller and moved (15 Nov 2026, Martin: "i need to be able to position it and resize
 * it"): its width as a share of the room it has, and where it sits in that room, across and down, each 0 to 100 (50 is
 * the middle). Down only tells where the room is taller than the picture (beside the words). Kept as whole numbers.
 */
export const PICTURE_SIZE = { min: 20, max: 100, usual: 100 } as const;
export const PICTURE_PLACE_USUAL = 50;

/** A picture's width share, as whole numbers within its bounds (anything else is the usual full width). */
export function cleanPictureSize(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : PICTURE_SIZE.usual;
  return Math.min(PICTURE_SIZE.max, Math.max(PICTURE_SIZE.min, n));
}

/** Where a picture sits, across or down, 0 to 100 (anything else is the middle). */
export function cleanPicturePlace(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : PICTURE_PLACE_USUAL;
  return Math.min(100, Math.max(0, n));
}

/** Whether a picture is as it always was: full width, in the middle. */
export const pictureAsUsual = (p: { size?: number; x?: number; y?: number }) =>
  (p.size ?? PICTURE_SIZE.usual) === PICTURE_SIZE.usual &&
  (p.x ?? PICTURE_PLACE_USUAL) === PICTURE_PLACE_USUAL &&
  (p.y ?? PICTURE_PLACE_USUAL) === PICTURE_PLACE_USUAL;

/** Whether a block may take the dark ground: only the blocks of the business's own words. */
export const mayGoDark = (id: BlockId) => isCustom(id) || id === "about";

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
  /** Where its picture sits. */
  layout: BlockLayout;
  /** Its ground (`mayGoDark`). */
  tone: BlockTone;
  /** The picture's width as a share of its room (`PICTURE_SIZE`), and where it sits there across and down (0 to 100). */
  size: number;
  x: number;
  y: number;
}

/** The blocks as every business starts: all the usual ones on, in the usual order, its own three off. */
export function defaultBlocks(): BlockSetting[] {
  const all: BlockSetting[] = BLOCKS.map((b) => ({
    id: b.id,
    on: !("custom" in b),
    heading: "",
    words: "",
    image: null,
    layout: "stack",
    tone: "light",
    size: PICTURE_SIZE.usual,
    x: PICTURE_PLACE_USUAL,
    y: PICTURE_PLACE_USUAL,
  }));
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
      layout: BLOCK_LAYOUTS.some((l) => l.id === e.layout) && !isFixed(e.id) ? (e.layout as BlockLayout) : "stack",
      tone: e.tone === "dark" && mayGoDark(e.id) ? "dark" : "light",
      size: isFixed(e.id) ? PICTURE_SIZE.usual : cleanPictureSize(e.size),
      x: isFixed(e.id) ? PICTURE_PLACE_USUAL : cleanPicturePlace(e.x),
      y: isFixed(e.id) ? PICTURE_PLACE_USUAL : cleanPicturePlace(e.y),
    });
  }
  for (const block of defaultBlocks()) if (!seen.has(block.id)) out.push(block);
  // The cover opens the proposal and the standard terms close it, whatever order was sent.
  const middle = out.filter((b) => b.id !== "cover" && !isFixed(b.id));
  return [...out.filter((b) => b.id === "cover"), ...middle, ...out.filter((b) => isFixed(b.id))];
}

/**
 * The list with one block put at another place (the builder's drag), before the block now at `to`. The cover stays
 * first and the standard terms last: a drop past either lands next to it.
 */
export function placeBlock(blocks: readonly BlockSetting[], id: BlockId, to: number): BlockSetting[] {
  const moving = blocks.find((b) => b.id === id);
  if (!moving || moving.id === "cover" || isFixed(moving.id)) return [...blocks];
  const rest = blocks.filter((b) => b.id !== id);
  const first = rest.findIndex((b) => b.id !== "cover");
  const last = rest.findIndex((b) => isFixed(b.id));
  const at = Math.min(Math.max(to - (blocks.indexOf(moving) < to ? 1 : 0), first < 0 ? 0 : first), last < 0 ? rest.length : last);
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

/** The business's next own block not yet shown, or null when all six are in. */
export function nextOwnBlock(blocks: readonly BlockSetting[]): BlockId | null {
  return blocks.find((b) => isCustom(b.id) && !b.on)?.id ?? null;
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
  /** Where its picture sits and its ground (left out on a proposal published before they could be chosen). */
  layout?: BlockLayout;
  tone?: BlockTone;
  /** The picture's width share and place (left out when as usual, and on a proposal published before they could be set). */
  size?: number;
  x?: number;
  y?: number;
}

/**
 * The blocks a proposal is published with: the business's own arrangement when it has chosen a custom design, else the
 * usual ones (the standard design). Only the ones shown, with their pictures as kept.
 */
export function blocksForView(
  design: "standard" | "custom",
  blocks: readonly BlockSetting[],
  images: readonly { id: string; kind: string; width: number; height: number }[],
): ViewBlock[] {
  return (design === "custom" ? blocks : defaultBlocks())
    .filter((block) => block.on)
    .map((block) => ({
      id: block.id,
      heading: block.heading,
      words: block.words,
      image: (block.image && images.find((i) => i.id === block.image && i.kind === "block")) || null,
      ...(block.layout !== "stack" ? { layout: block.layout } : {}),
      ...(block.tone === "dark" ? { tone: block.tone } : {}),
      ...(block.image && !pictureAsUsual(block) ? { size: block.size, x: block.x, y: block.y } : {}),
    }));
}

/** Whether a kit's blocks are the usual ones, as the standard design shows them (a kit saved before the builder). */
export function blocksAreUsual(blocks: readonly BlockSetting[]): boolean {
  const usual = defaultBlocks();
  return (
    blocks.length === usual.length &&
    blocks.every(
      (b, i) =>
        b.id === usual[i].id &&
        b.on === usual[i].on &&
        !b.heading &&
        !b.words &&
        !b.image &&
        b.layout === "stack" &&
        b.tone === "light" &&
        pictureAsUsual(b),
    )
  );
}

/** The usual blocks, for a proposal published before blocks could be arranged. */
export const USUAL_BLOCKS: ViewBlock[] = defaultBlocks()
  .filter((b) => b.on)
  .map((b) => ({ id: b.id, heading: "", words: "", image: null }));

/**
 * What an indicative proposal leaves out: how to pay, and the conditions and terms that going ahead accepts. They
 * come with the final proposal, after the site visit, which is the one a customer accepts.
 */
export const NOT_ON_INDICATIVE: readonly BlockId[] = ["payment", "conditions", "terms"];

/**
 * The blocks a proposal shows, in order: its own, or the usual ones for one published before they could be arranged.
 * An indicative proposal leaves out `NOT_ON_INDICATIVE`.
 */
export function viewBlocks(view: { blocks?: ViewBlock[]; indicative?: boolean }): ViewBlock[] {
  const blocks = view.blocks?.length ? view.blocks : USUAL_BLOCKS;
  return view.indicative ? blocks.filter((b) => !NOT_ON_INDICATIVE.includes(b.id)) : blocks;
}

/** A block's heading as it is shown: the business's own, else the usual one (`fallback` for a block whose usual heading depends on the proposal). */
export function blockHeading(block: Pick<ViewBlock, "id" | "heading">, fallback = ""): string {
  return block.heading || kind(block.id).heading || fallback;
}
