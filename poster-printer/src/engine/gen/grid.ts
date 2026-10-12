import { Rng } from '../rng';
import type { Params } from '../params';
import { num, str } from '../params';

export type GridType = 'ortho' | 'skew' | 'curve' | 'image';
export type Density = 'simple' | 'stable' | 'full' | 'aggressive' | 'curve' | 'curve2';
export interface Rect { x: number; y: number; w: number; h: number }

export interface Grid {
  W: number; H: number; type: GridType; density: Density;
  m: { t: number; r: number; b: number; l: number };
  x: number[]; // column edges (content area), length nc+1
  y: number[]; // row edges, length nr+1
  nc: number; nr: number;
  gutter: number; baseline: number; skew: number;
  content: Rect;
  noBleed?: { l?: boolean; r?: boolean };
}

const DENS: Record<Density, { c: [number, number]; r: [number, number]; irr: number }> = {
  simple: { c: [2, 3], r: [3, 4], irr: 0.15 },
  stable: { c: [3, 4], r: [4, 6], irr: 0.25 },
  full: { c: [4, 6], r: [6, 8], irr: 0.35 },
  aggressive: { c: [6, 8], r: [8, 12], irr: 0.6 },
  curve: { c: [2, 4], r: [3, 5], irr: 0.2 },
  curve2: { c: [3, 6], r: [4, 7], irr: 0.45 },
};

function splitEdges(rng: Rng, start: number, len: number, n: number, irr: number, modular: boolean): number[] {
  let ws: number[];
  if (modular || irr <= 0.05) ws = Array(n).fill(1);
  else {
    const choices = [1, 1, 1, 1, 0.5, 1.5, 2, 0.618, 1.618];
    ws = Array.from({ length: n }, () => (rng.chance(irr) ? rng.pick(choices) : 1));
  }
  const tot = ws.reduce((a, b) => a + b, 0);
  const e = [start];
  let acc = start;
  for (const w of ws) { acc += (w / tot) * len; e.push(acc); }
  e[e.length - 1] = start + len;
  return e;
}

export function makeGrid(rng: Rng, W: number, H: number, p: Params, forced?: { type?: GridType; density?: Density }): Grid {
  let type = (forced?.type ?? str(p, 'gridType')) as GridType | 'auto';
  let density = (forced?.density ?? str(p, 'density')) as Density | 'auto';
  if (density === 'auto') density = rng.weighted<Density>({ simple: 2, stable: 4, full: 3, aggressive: 1, curve: 0.6, curve2: 0.4 });
  if (type === 'auto') type = density === 'curve' || density === 'curve2' ? 'curve' : rng.weighted<GridType>({ ortho: 7, skew: 0.8, image: 2, curve: 0.6 });
  const d = DENS[density];
  const S = Math.min(W, H);
  const mPct = num(p, 'margin') / 100;
  const mBase = Math.round(S * mPct);
  const m = { t: mBase, r: mBase, b: mBase, l: mBase };
  const landscape = W > H * 1.1;
  const wide = W / H;
  let nc = num(p, 'cols') || rng.int(d.c[0], d.c[1]);
  let nr = num(p, 'rows') || rng.int(d.r[0], d.r[1]);
  if (!num(p, 'cols') && landscape) nc = Math.round(nc * Math.min(2.2, wide * 0.9));
  if (!num(p, 'rows') && landscape) nr = Math.max(2, Math.round(nr / Math.min(2, wide * 0.8)));
  if (!num(p, 'rows') && H / W > 1.6) nr = Math.round(nr * 1.3);
  if (type === 'image') { nc = Math.max(2, Math.min(nc, 4)); nr = Math.max(2, Math.min(nr, 5)); }
  const irr = d.irr * num(p, 'gridStrength');
  const gutter = num(p, 'gutter');
  const content = { x: m.l, y: m.t, w: W - m.l - m.r, h: H - m.t - m.b };
  const x = splitEdges(rng, content.x, content.w, nc, irr * 0.5, rng.chance(0.75));
  const y = splitEdges(rng, content.y, content.h, nr, irr, rng.chance(0.45));
  const skew = type === 'skew' ? rng.range(0.08, 0.22) * (rng.chance(0.5) ? 1 : -1) : 0;
  return { W, H, type, density, m, x, y, nc, nr, gutter, baseline: num(p, 'baseline'), skew, content };
}

/** rectangle for a span of cells (inclusive start, exclusive end) */
export function cellRect(g: Grid, c0: number, c1: number, r0: number, r1: number, bleed = false): Rect {
  c0 = Math.max(0, Math.min(g.nc, c0)); c1 = Math.max(c0, Math.min(g.nc, c1));
  r0 = Math.max(0, Math.min(g.nr, r0)); r1 = Math.max(r0, Math.min(g.nr, r1));
  let x0 = g.x[c0], x1 = g.x[c1], y0 = g.y[r0], y1 = g.y[r1];
  const hg = g.gutter / 2;
  if (c0 > 0) x0 += hg; if (c1 < g.nc) x1 -= hg;
  if (r0 > 0) y0 += hg; if (r1 < g.nr) y1 -= hg;
  if (bleed) {
    if (c0 === 0 && !g.noBleed?.l) x0 = 0; if (c1 === g.nc && !g.noBleed?.r) x1 = g.W;
    if (r0 === 0) y0 = 0; if (r1 === g.nr) y1 = g.H;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** nearest row edge index to a y coordinate */
export const nearestRow = (g: Grid, y: number) => g.y.reduce((bi, v, i) => (Math.abs(v - y) < Math.abs(g.y[bi] - y) ? i : bi), 0);
export const nearestCol = (g: Grid, x: number) => g.x.reduce((bi, v, i) => (Math.abs(v - x) < Math.abs(g.x[bi] - x) ? i : bi), 0);
export const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: Math.max(1, r.w - 2 * d), h: Math.max(1, r.h - 2 * d) });
export const snap = (v: number, b: number) => Math.round(v / b) * b;

/** phase 15: compositions whose character is restraint keep the pre-phase-15 margin (4.5 %) and block budget (8) */
export const RESTRAINT = new Set(['ma', 'inset', 'exhibit', 'centered', 'quote']);
export const RESTRAINT_MARGIN = 0.045, RESTRAINT_BLOCKS = 8;
/** widen every margin to at least `m` px, remapping the column and row edges proportionally (no new random draws) */
export function padGrid(g: Grid, m: number) {
  const { x: cx, y: cy, w: cw, h: ch } = g.content;
  const l = Math.max(g.m.l, m), r = Math.max(g.m.r, m), t = Math.max(g.m.t, m), b = Math.max(g.m.b, m);
  if (l === g.m.l && r === g.m.r && t === g.m.t && b === g.m.b) return;
  const nw = g.W - l - r, nh = g.H - t - b;
  g.x = g.x.map((v) => l + ((v - cx) / cw) * nw);
  g.y = g.y.map((v) => t + ((v - cy) / ch) * nh);
  g.m = { t, r, b, l };
  g.content = { x: l, y: t, w: nw, h: nh };
}

/** shrink the grid horizontally (e.g. to make room for a sidebar) */
export function shrinkGrid(g: Grid, x0: number, x1: number) {
  const a = g.content.x, b = g.content.x + g.content.w;
  g.x = g.x.map((v) => x0 + ((v - a) / (b - a)) * (x1 - x0));
  g.content = { ...g.content, x: x0, w: x1 - x0 };
}
