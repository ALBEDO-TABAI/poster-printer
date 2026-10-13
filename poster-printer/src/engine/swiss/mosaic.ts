// Phase 16 — the bleed grid: pictures of different proportions fill the whole sheet edge to edge. A slicing tree
// (`h` = side by side at a common height, `v` = stacked at a common width) has a composite proportion: Σ a for `h`,
// 1 / Σ (1 / a) for `v`. When the tree's proportion equals the sheet's, every picture is shown uncropped. The type
// cell is flexible (its proportion may vary within a range), so solving the tree for the sheet's proportion moves all
// the slack into the type cell. Cuts are then snapped to the baseline unit; small residual crops are subject-aware.
import type { Rng } from '../rng';
import type { Rect } from '../gen/grid';
import type { Kind } from './solver';

export interface MLeaf { t: 'leaf'; kind: Kind; i?: number; ar: number; flex?: [number, number]; tag?: string }
export interface MSplit { t: 'h' | 'v'; kids: MNode[] }
export type MNode = MLeaf | MSplit;
export interface MPlaced { leaf: MLeaf; rect: Rect; edges: { l: boolean; r: boolean; t: boolean; b: boolean } }

const flexAr = (l: MLeaf, t: number) => (l.flex ? l.flex[0] * Math.pow(l.flex[1] / l.flex[0], t) : l.ar);
export function aspectOf(n: MNode, t: number): number {
  if (n.t === 'leaf') return flexAr(n, t);
  if (n.t === 'h') return n.kids.reduce((s, k) => s + aspectOf(k, t), 0);
  return 1 / n.kids.reduce((s, k) => s + 1 / aspectOf(k, t), 0);
}
const hasFlex = (n: MNode): boolean => (n.t === 'leaf' ? !!n.flex : n.kids.some(hasFlex));

/** the flex parameter t ∈ [0,1] that makes the tree's proportion equal `target` (clamped when out of reach) */
export function solveFlex(root: MNode, target: number): number {
  if (!hasFlex(root)) return 0.5;
  let lo = 0, hi = 1;
  const a0 = aspectOf(root, 0), a1 = aspectOf(root, 1);
  if (target <= a0) return 0;
  if (target >= a1) return 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (aspectOf(root, m) < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/** lay the tree into `rect`; interior cuts snap to multiples of `unit` (absolute), keeping every cell ≥ 2 units */
export function layoutTree(root: MNode, rect: Rect, t: number, unit: number, W: number, H: number): MPlaced[] {
  const out: MPlaced[] = [];
  const snap = (v: number, lo: number, hi: number) => { if (unit <= 1) return v; const s = Math.round(v / unit) * unit; return Math.max(lo, Math.min(hi, s)); };
  const go = (n: MNode, r: Rect) => {
    if (n.t === 'leaf') { out.push({ leaf: n, rect: r, edges: { l: r.x <= 0.5, t: r.y <= 0.5, r: r.x + r.w >= W - 0.5, b: r.y + r.h >= H - 0.5 } }); return; }
    const as = n.kids.map((k) => aspectOf(k, t));
    if (n.t === 'h') {
      const tot = as.reduce((s, a) => s + a, 0);
      let x = r.x;
      n.kids.forEach((k, j) => {
        const last = j === n.kids.length - 1;
        const remainMin = (n.kids.length - 1 - j) * unit * 2;
        const x1 = last ? r.x + r.w : snap(x + (as[j] / tot) * r.w, x + unit * 2, r.x + r.w - remainMin);
        go(k, { x, y: r.y, w: x1 - x, h: r.h }); x = x1;
      });
    } else {
      const inv = as.map((a) => 1 / a), tot = inv.reduce((s, a) => s + a, 0);
      let y = r.y;
      n.kids.forEach((k, j) => {
        const last = j === n.kids.length - 1;
        const remainMin = (n.kids.length - 1 - j) * unit * 2;
        const y1 = last ? r.y + r.h : snap(y + (inv[j] / tot) * r.h, y + unit * 2, r.y + r.h - remainMin);
        go(k, { x: r.x, y, w: r.w, h: y1 - y }); y = y1;
      });
    }
  };
  go(root, rect);
  return out;
}

/** a random binary slicing tree over the leaves in the given order (axes are drawn; the solver judges) */
export function randomTree(items: MLeaf[], rng: Rng): MNode {
  if (items.length === 1) return items[0];
  const k = 1 + Math.floor(rng.next() * (items.length - 1));
  const a = randomTree(items.slice(0, k), rng), b = randomTree(items.slice(k), rng);
  const t = rng.chance(0.5) ? 'h' : 'v';
  // flatten same-axis children (a row of three reads as one row, not a row inside a row)
  const flat = (n: MNode): MNode[] => (n.t === t ? (n as MSplit).kids : [n]);
  return { t, kids: [...flat(a), ...flat(b)] };
}

/** justified rows (or columns): the gallery form of the bleed grid */
export function rowsTree(items: MLeaf[], rows: number[], axis: 'v' | 'h' = 'v'): MNode {
  const inner = axis === 'v' ? 'h' : 'v';
  const out: MNode[] = [];
  let i = 0;
  for (const n of rows) { const part = items.slice(i, i + n); i += n; if (part.length) out.push(part.length === 1 ? part[0] : { t: inner, kids: part }); }
  return out.length === 1 ? out[0] : { t: axis, kids: out };
}
