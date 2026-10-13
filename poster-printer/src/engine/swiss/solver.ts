// Phase 16 — template slicing solver. A layout typology is written as a slicing tree (`h` = children side by side,
// `v` = children stacked) whose leaves are pictures, the headline, the info block, empty fields or colour fields.
// The solver chooses every cut on the lattice's field lines by dynamic programming, so that each picture's span
// matches the picture's own proportion (little crop, subject kept), the headline region lets the title be large,
// the info region holds its copy, and sizes follow importance. The tree states the design intent; the solver makes
// it fit the actual pictures and copy.
import type { Rect } from '../gen/grid';
import { spanRect, touches, type Bleed, type Lattice, type Span } from './lattice';

export type Kind = 'img' | 'head' | 'info' | 'void' | 'color';
export interface Leaf {
  t: 'leaf'; kind: Kind;
  /** picture index (kind img) */
  i?: number;
  /** min / max extent in fields [cols, rows]; empty fields and colour fields default to 0 (they may vanish) */
  min?: [number, number]; max?: [number, number];
  /** outer edges this leaf may bleed across ('outer' = every outer edge it touches) */
  bleed?: Bleed | 'outer';
  /** where the copy sits inside a text region */
  anchor?: 'top' | 'bottom';
  /** target share of the canvas area (pictures): the solver keeps the size near it */
  share?: number;
  /** role tag for rendering ('hero', 'sat', …) */
  tag?: string;
  /** the picture's proportion (w / h): the solver only tries spans near it along a split */
  ar?: number;
}
export interface Split { t: 'h' | 'v'; kids: Node[] }
export type Node = Leaf | Split;
export interface Placed { leaf: Leaf; span: Span; rect: Rect; bleed: Bleed; cost: number }
export type LeafCost = (leaf: Leaf, span: Span, rect: Rect) => number;

export const leaf = (kind: Kind, o: Partial<Omit<Leaf, 't' | 'kind'>> = {}): Leaf => ({ t: 'leaf', kind, ...o });
const kids = (k: (Node | null | undefined | false)[]) => k.filter(Boolean) as Node[];
/** children side by side (vertical cuts) */
export const H = (...k: (Node | null | undefined | false)[]): Node => { const c = kids(k); return c.length === 1 ? c[0] : { t: 'h', kids: c }; };
/** children stacked (horizontal cuts) */
export const V = (...k: (Node | null | undefined | false)[]): Node => { const c = kids(k); return c.length === 1 ? c[0] : { t: 'v', kids: c }; };

const vanish = (n: Leaf) => n.kind === 'void' || n.kind === 'color';
function minExt(n: Node, ax: 0 | 1): number {
  if (n.t === 'leaf') return n.min?.[ax] ?? (vanish(n) ? 0 : 1);
  const same = (n.t === 'h') === (ax === 0);
  return same ? n.kids.reduce((s, k) => s + minExt(k, ax), 0) : Math.max(...n.kids.map((k) => minExt(k, ax)));
}
function maxExt(n: Node, ax: 0 | 1): number {
  if (n.t === 'leaf') return n.max?.[ax] ?? Infinity;
  const same = (n.t === 'h') === (ax === 0);
  return same ? n.kids.reduce((s, k) => s + maxExt(k, ax), 0) : Math.min(...n.kids.map((k) => maxExt(k, ax)));
}
export function bleedOf(L: Lattice, n: Leaf, s: Span): Bleed {
  if (!n.bleed) return {};
  const t = touches(L, s);
  if (n.bleed === 'outer') return t;
  return { l: !!(n.bleed.l && t.l), r: !!(n.bleed.r && t.r), t: !!(n.bleed.t && t.t), b: !!(n.bleed.b && t.b) };
}

interface Memo { cost: number; cuts?: number[] }

/** solve a template over a region of the lattice; null when no assignment is feasible */
export function solve(L: Lattice, root: Node, region: Span, cost: LeafCost): { cost: number; placed: Placed[] } | null {
  const ids = new Map<Node, number>();
  const ext = new Map<Node, [number, number, number, number]>(); // min c, min r, max c, max r
  const walk = (n: Node) => { ids.set(n, ids.size); ext.set(n, [minExt(n, 0), minExt(n, 1), maxExt(n, 0), maxExt(n, 1)]); if (n.t !== 'leaf') n.kids.forEach(walk); };
  walk(root);
  const memo = new Map<number, Memo>();
  const K1 = Math.max(L.nc, L.nr) + 1;
  const keyOf = (id: number, c0: number, c1: number, r0: number, r1: number) => (((id * K1 + c0) * K1 + c1) * K1 + r0) * K1 + r1;
  const fits = (n: Node, w: number, h: number) => { const e = ext.get(n)!; return w >= e[0] && h >= e[1] && w <= e[2] && h <= e[3]; };

  const best = (n: Node, c0: number, c1: number, r0: number, r1: number): number => {
    const key = keyOf(ids.get(n)!, c0, c1, r0, r1);
    const hit = memo.get(key);
    if (hit) return hit.cost;
    let res: Memo;
    const w = c1 - c0, h = r1 - r0;
    if (!fits(n, w, h) && !(n.t === 'leaf' && vanish(n) && (w === 0 || h === 0))) res = { cost: Infinity };
    else if (n.t === 'leaf') {
      if (w === 0 || h === 0) res = { cost: vanish(n) ? 0 : Infinity };
      else { const s = { c0, c1, r0, r1 }; res = { cost: cost(n, s, spanRect(L, s, bleedOf(L, n, s))) }; }
    } else {
      const horiz = n.t === 'h';
      const lo = horiz ? c0 : r0, hi = horiz ? c1 : r1, ax: 0 | 1 = horiz ? 0 : 1;
      const K = n.kids.length;
      // suffix bounds of the remaining kids along the split axis
      const sMin = new Array(K + 1).fill(0), sMax = new Array(K + 1).fill(0);
      for (let j = K - 1; j >= 0; j--) { sMin[j] = sMin[j + 1] + ext.get(n.kids[j])![ax]; sMax[j] = sMax[j + 1] + ext.get(n.kids[j])![ax + 2]; }
      const span = hi - lo;
      // F[j][s - lo]: best cost of kids j.. laid from s to hi; C[j][s - lo]: the end chosen for kid j
      const F: Float64Array[] = [], C: Int32Array[] = [];
      for (let j = 0; j <= K; j++) { F.push(new Float64Array(span + 1).fill(Infinity)); C.push(new Int32Array(span + 1).fill(-1)); }
      F[K][span] = 0;
      // a picture leaf only tries extents near the one its proportion asks for at this rect's other extent
      const other = horiz ? spanRect(L, { c0, c1: c0 + 1, r0, r1 }).h : spanRect(L, { c0, c1, r0, r1: r0 + 1 }).w;
      const unit = horiz ? L.cw + L.g : L.fh + L.g;
      const ideal = n.kids.map((k) => (k.t === 'leaf' && k.ar ? Math.round(((horiz ? k.ar * other : other / k.ar) + L.g) / unit) : -1));
      for (let j = K - 1; j >= 0; j--) {
        const kid = n.kids[j], e0 = ext.get(kid)!;
        for (let s = lo; s <= hi; s++) {
          if (hi - s < sMin[j] || hi - s > sMax[j]) continue;
          let eLo = s + e0[ax], eHi = Math.min(hi - sMin[j + 1], s + (Number.isFinite(e0[ax + 2]) ? e0[ax + 2] : span));
          if (ideal[j] > 0 && j < K - 1) { const a = Math.max(eLo, s + ideal[j] - 2), b = Math.min(eHi, s + ideal[j] + 2); if (a <= b) { eLo = a; eHi = b; } }
          let bc = Infinity, be = -1;
          for (let e = eLo; e <= eHi; e++) {
            const rest = F[j + 1][e - lo];
            if (!Number.isFinite(rest)) continue;
            const c = (horiz ? best(kid, s, e, r0, r1) : best(kid, c0, c1, s, e)) + rest;
            if (c < bc) { bc = c; be = e; }
          }
          F[j][s - lo] = bc; C[j][s - lo] = be;
        }
      }
      const cuts: number[] = [];
      if (Number.isFinite(F[0][0])) { let s = lo; for (let j = 0; j < K; j++) { const e = C[j][s - lo]; cuts.push(e); s = e; } }
      res = { cost: F[0][0], cuts };
    }
    memo.set(key, res);
    return res.cost;
  };

  const total = best(root, region.c0, region.c1, region.r0, region.r1);
  if (!Number.isFinite(total)) return null;
  const placed: Placed[] = [];
  const emit = (n: Node, c0: number, c1: number, r0: number, r1: number) => {
    const m = memo.get(keyOf(ids.get(n)!, c0, c1, r0, r1))!;
    if (n.t === 'leaf') {
      if (c1 === c0 || r1 === r0) return;
      const s = { c0, c1, r0, r1 }, bl = bleedOf(L, n, s);
      placed.push({ leaf: n, span: s, rect: spanRect(L, s, bl), bleed: bl, cost: m.cost });
      return;
    }
    let s = n.t === 'h' ? c0 : r0;
    n.kids.forEach((k, j) => { const e = m.cuts![j]; if (n.t === 'h') emit(k, s, e, r0, r1); else emit(k, c0, c1, s, e); s = e; });
  };
  emit(root, region.c0, region.c1, region.r0, region.r1);
  return { cost: total, placed };
}

/** mirror a solved layout left ↔ right (margins are symmetric left / right) */
export function mirrorX(L: Lattice, ps: Placed[]): Placed[] {
  return ps.map((p) => {
    const span = { ...p.span, c0: L.nc - p.span.c1, c1: L.nc - p.span.c0 };
    const bleed = { ...p.bleed, l: p.bleed.r, r: p.bleed.l };
    return { ...p, span, bleed, rect: spanRect(L, span, bleed) };
  });
}
