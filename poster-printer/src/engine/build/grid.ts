// Phase 18: the grid layer of a built page (网格). The grid stream draws a modular grid — side / top / bottom margins,
// columns, rows and one gutter — and every archetype reads its geometry from it: a photo stops on a row line and the
// type starts on the next one, frames and rooms span whole columns, groups start on a column edge, aux columns sit on
// the column starts. A grid re-roll keeps the archetype and the construction and moves them onto another grid.
import type { Rng } from '../rng';
import type { Rect } from '../gen/grid';

export interface PageGrid {
  /** side, top and bottom margins */
  m: number; mt: number; mb: number;
  cols: number; rows: number; gut: number; colW: number; rowH: number;
  /** column starts (cols of them) */
  xs: number[];
  /** left edge of column i; x(cols) is the right margin */
  x(i: number): number;
  /** right edge of column i − 1 (the end of a span that stops before column i); xr(cols) is the right margin */
  xr(i: number): number;
  /** the width of n columns with their gutters */
  span(n: number): number;
  /** top of row j; y(rows) is the bottom margin */
  y(j: number): number;
  /** bottom edge of row j − 1 */
  yb(j: number): number;
  /** the row index whose top line is nearest a fraction of the page height (1 … rows − 1) */
  rowAt(f: number): number;
  /** the column count nearest a fraction of the columns (1 … cols) */
  colsOf(f: number): number;
  /** the rect over columns [c0, c1) and rows [r0, r1) */
  cell(c0: number, c1: number, r0: number, r1: number): Rect;
  /** the row end (a row's bottom line) nearest v, below row j0 */
  ybNear(v: number, j0?: number): number;
  /** the lowest row end at or above `limit`, below row j0 (else the limit itself) */
  ybUnder(limit: number, j0?: number): number;
}

export function makeGrid(rg: Rng, W: number, H: number): PageGrid {
  const S = Math.min(W, H);
  const land = W > H * 1.15;
  const m = Math.round(S * rg.pick([0.045, 0.055, 0.065, 0.08]));
  // the foot margin is often deeper than the head (a classical page), sometimes the head is (a hanging title)
  const foot = rg.weighted({ even: 2, deepFoot: 1.2, deepHead: 0.6 }) as string;
  const mt = foot === 'deepHead' ? Math.round(m * 1.5) : m;
  const mb = foot === 'deepFoot' ? Math.round(m * 1.5) : m;
  const cols = Number(land ? rg.weighted({ 6: 1, 8: 1.1, 10: 0.5, 12: 1 }) : rg.weighted({ 4: 1, 5: 0.8, 6: 1.3, 8: 0.9, 12: 0.7 }));
  // the gutter: a share of the margin, never more than a third of a column
  const gut0 = Math.max(4, Math.round(m * rg.pick([0.5, 0.7, 1])));
  const gut = Math.max(4, Math.min(gut0, Math.round(((W - 2 * m) / cols) * 0.3)));
  const colW = (W - 2 * m - (cols - 1) * gut) / cols;
  // rows: near-square modules, or half-square (a finer vertical rhythm); a row is never shorter than 1.5 gutters
  const fine = rg.chance(0.35);
  const LH = H - mt - mb;
  let rows = Math.max(3, Math.round((LH + gut) / (colW * (fine ? 0.5 : 1) + gut)));
  while (rows > 3 && (LH - (rows - 1) * gut) / rows < gut * 1.5) rows--;
  const rowH = (LH - (rows - 1) * gut) / rows;
  const x = (i: number) => (i >= cols ? W - m : m + Math.max(0, i) * (colW + gut));
  const xr = (i: number) => (i >= cols ? W - m : i <= 0 ? m : m + i * (colW + gut) - gut);
  const y = (j: number) => (j >= rows ? H - mb : mt + Math.max(0, j) * (rowH + gut));
  const yb = (j: number) => (j >= rows ? H - mb : j <= 0 ? mt : mt + j * (rowH + gut) - gut);
  return {
    m, mt, mb, cols, rows, gut, colW, rowH,
    xs: Array.from({ length: cols }, (_, i) => x(i)),
    x, xr, y, yb,
    span: (n: number) => Math.max(0, Math.min(cols, n)) * colW + Math.max(0, Math.min(cols, n) - 1) * gut,
    rowAt: (f: number) => { let best = 1, d = Infinity; for (let j = 1; j < rows; j++) { const e = Math.abs(y(j) - f * H); if (e < d) { d = e; best = j; } } return best; },
    colsOf: (f: number) => Math.max(1, Math.min(cols, Math.round(cols * f))),
    cell: (c0: number, c1: number, r0: number, r1: number) => ({ x: x(c0), y: y(r0), w: xr(c1) - x(c0), h: yb(r1) - y(r0) }),
    ybUnder: (limit: number, j0 = 0) => { let best = -1; for (let j = j0 + 1; j <= rows; j++) if (yb(j) <= limit + 0.5) best = yb(j); return best > 0 ? best : limit; },
    ybNear: (v: number, j0 = 0) => { let best = yb(rows), d = Infinity; for (let j = j0 + 1; j <= rows; j++) { const e = Math.abs(yb(j) - v); if (e < d) { d = e; best = yb(j); } } return best; },
  };
}
