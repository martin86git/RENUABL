/**
 * The block tray (10 Nov 2026, Martin: Sol sizes the system, then hands over the panels as blocks the designer puts on
 * the roof's faces). Pure, tested.
 *
 * A block is so many panels to lay as one array on one face. Sol's split puts the system on two faces looking
 * different ways when the roof suits it, else one block; each block can be made bigger or smaller, split in two or
 * joined to the next, and the total is what the tray says is left to place.
 */

export interface PanelBlock {
  id: string;
  count: number;
}

/** A block is never smaller than this many panels (an array of its own), nor bigger than this. */
export const BLOCK_MIN = 2;
export const BLOCK_MAX = 60;

/** The blocks a system of `panels` starts as: two about half each when Sol suggests a split, else one. */
export function startingBlocks(panels: number, split: boolean, newId: () => string): PanelBlock[] {
  const n = Math.max(0, Math.min(BLOCK_MAX * 2, Math.round(panels)));
  if (!n) return [];
  if (split && n >= BLOCK_MIN * 2) {
    const first = Math.ceil(n / 2);
    return [
      { id: newId(), count: first },
      { id: newId(), count: n - first },
    ];
  }
  return [{ id: newId(), count: Math.min(BLOCK_MAX, n) }];
}

/** A block made bigger or smaller by `by`, kept within the limits. */
export function resizeBlock(blocks: readonly PanelBlock[], id: string, by: number): PanelBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, count: Math.max(BLOCK_MIN, Math.min(BLOCK_MAX, b.count + by)) } : b));
}

/** A block split in two about halves (when each would still be an array), in place. */
export function splitBlock(blocks: readonly PanelBlock[], id: string, newId: () => string): PanelBlock[] {
  return blocks.flatMap((b) => {
    if (b.id !== id || b.count < BLOCK_MIN * 2) return [b];
    const first = Math.ceil(b.count / 2);
    return [
      { ...b, count: first },
      { id: newId(), count: b.count - first },
    ];
  });
}

/** A block joined to the one after it (the last joins the one before), up to the largest a block may be. */
export function joinBlock(blocks: readonly PanelBlock[], id: string): PanelBlock[] {
  const at = blocks.findIndex((b) => b.id === id);
  if (at < 0 || blocks.length < 2) return [...blocks];
  const other = at + 1 < blocks.length ? at + 1 : at - 1;
  const [keep, gone] = [Math.min(at, other), Math.max(at, other)];
  return blocks
    .map((b, i) => (i === keep ? { ...b, count: Math.min(BLOCK_MAX, b.count + blocks[gone].count) } : b))
    .filter((_, i) => i !== gone);
}

/** What the tray says it holds. */
export function trayWords(blocks: readonly PanelBlock[], watts: number): string {
  const n = blocks.reduce((t, b) => t + b.count, 0);
  const kw = Math.round((n * watts) / 10) / 100;
  return `${n} panel${n === 1 ? "" : "s"} to place (${kw} kW)`;
}
