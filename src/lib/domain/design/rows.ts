/**
 * Laying panels the way an installer would: in long, straight rows, the
 * fewest rows that hold them, every row starting and ending in line. Pure,
 * tested.
 *
 * It works on a grid of places (rows and columns on one roof face, each
 * either a place a panel fits or not) and picks the block: for 24 panels on a
 * face with room for two rows of 14, two rows of 12 side by side, not a square
 * of five rows or a scatter. A last row that is short of the others is
 * centred under them.
 */
import { faceFacing, faceGrid, panelPlaces, type Face, type PanelSize } from "./roof-design";
import { TILT, yearOnPlane } from "./tilt";

export interface GridCell {
  row: number;
  col: number;
}

export interface Block {
  cells: GridCell[];
  /** How many rows it uses. */
  rows: number;
}

/**
 * The block of places that holds `n` panels in the fewest rows: `perRow` = ⌈n ÷ rows⌉ side by side in each,
 * the same columns in every row, every place one that `fits`. Of blocks with as few rows, the one whose places
 * `score` best (more sun), then the one nearest the middle of its run. When no single block holds them all, the
 * biggest block there is (fewer than `n` places: the rest go elsewhere).
 */
export function bestBlock(
  fits: (row: number, col: number) => boolean,
  rows: number,
  cols: number,
  n: number,
  score: (row: number, col: number) => number = () => 0,
): Block {
  const want = Math.max(0, Math.floor(n));
  if (!want || rows < 1 || cols < 1) return { cells: [], rows: 0 };
  const lay = (r0: number, c0: number, k: number, per: number, count: number): GridCell[] => {
    const cells: GridCell[] = [];
    for (let i = 0; i < k; i++) {
      const inRow = Math.min(per, count - i * per);
      // A short last row sits centred under the full ones.
      const from = c0 + Math.floor((per - inRow) / 2);
      for (let j = 0; j < inRow; j++) cells.push({ row: r0 + i, col: from + j });
    }
    return cells;
  };
  /** The runs of columns where `k` rows from `r0` all fit. */
  const runs = (r0: number, k: number) => {
    const out: { from: number; length: number }[] = [];
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      let ok = c < cols;
      for (let i = 0; ok && i < k; i++) ok = fits(r0 + i, c);
      if (ok && start < 0) start = c;
      if (!ok && start >= 0) {
        out.push({ from: start, length: c - start });
        start = -1;
      }
    }
    return out;
  };
  const total = (cells: GridCell[]) => cells.reduce((t, c) => t + score(c.row, c.col), 0);

  for (let k = 1; k <= rows; k++) {
    const per = Math.ceil(want / k);
    if (per > cols) continue;
    let best: { cells: GridCell[]; value: number } | null = null;
    for (let r0 = 0; r0 + k <= rows; r0++)
      for (const run of runs(r0, k)) {
        if (run.length < per) continue;
        // Try every place along the run, the middle first, so a tie goes to the middle.
        const middle = run.from + Math.floor((run.length - per) / 2);
        const starts = Array.from({ length: run.length - per + 1 }, (_, i) => run.from + i).sort(
          (a, b) => Math.abs(a - middle) - Math.abs(b - middle),
        );
        for (const c0 of starts) {
          const cells = lay(r0, c0, k, per, want);
          const value = total(cells);
          if (!best || value > best.value + 1e-9) best = { cells, value };
        }
      }
    if (best) return { cells: best.cells, rows: k };
  }

  // Nothing holds them all: the biggest block there is.
  let biggest: { cells: GridCell[]; rows: number; value: number } | null = null;
  for (let k = 1; k <= rows; k++)
    for (let r0 = 0; r0 + k <= rows; r0++)
      for (const run of runs(r0, k)) {
        const cells = lay(r0, run.from, k, run.length, run.length * k);
        const value = total(cells);
        if (!biggest || cells.length > biggest.cells.length || (cells.length === biggest.cells.length && value > biggest.value))
          biggest = { cells, rows: k, value };
      }
  return biggest ? { cells: biggest.cells, rows: biggest.rows } : { cells: [], rows: 0 };
}

/**
 * A traced face holding up to `n` panels in the fewest straight rows: the face with every other place switched
 * off (places someone switched off stay off), and how many it holds.
 */
export function fillFace(face: Face, size: PanelSize, n: number): { face: Face; placed: number } {
  const off = new Set(face.off);
  const places = panelPlaces(face, size);
  const open = new Set(places.map((p) => p.index).filter((i) => !off.has(i)));
  const { rows, columns } = faceGrid(face, size);
  const block = bestBlock((r, c) => open.has(r * columns + c), rows, columns, n);
  const keep = new Set(block.cells.map((c) => c.row * columns + c.col));
  return {
    face: { ...face, off: places.map((p) => p.index).filter((i) => !keep.has(i)) },
    placed: keep.size,
  };
}

/**
 * Traced faces holding up to `n` panels between them: the sunniest face first (its direction and pitch, `tilt.ts`),
 * each in the fewest straight rows. Faces with nothing on them have every place switched off.
 */
export function fillFaces(faces: Face[], size: PanelSize, n: number): { faces: Face[]; placed: number } {
  const sun = (f: Face) => yearOnPlane(f.tilt ?? TILT.roof, faceFacing(f));
  let left = Math.max(0, Math.floor(n));
  const filled = new Map<string, Face>();
  for (const face of [...faces].sort((a, b) => sun(b) - sun(a))) {
    const done = fillFace(face, size, left);
    left -= done.placed;
    filled.set(face.id, done.face);
  }
  return { faces: faces.map((f) => filled.get(f.id) ?? f), placed: Math.max(0, Math.floor(n)) - left };
}
