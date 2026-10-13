// Phase 16 — the Swiss modular grid (Müller-Brockmann, "Grid systems in graphic design"): the type area is divided
// into fields separated by spatial intervals (gutters). A field plus one gutter is a whole number of baseline lines,
// so text set in any field shares one baseline grid. Pictures span whole fields; a picture on an outer field may
// bleed past the margin to the trim. The legacy `Grid` view keeps snapping, decoration and scene.info working.
import type { Rng } from '../rng';
import type { Grid, Rect } from '../gen/grid';

export interface Lattice {
  W: number; H: number;
  nc: number; nr: number;
  /** gutter (spatial interval) in px; 0 = butt-joined fields */
  g: number;
  /** baseline unit in px: field height + gutter = `lines` baselines */
  b: number;
  lines: number;
  /** top-left of the field area, field width and height */
  x0: number; y0: number; cw: number; fh: number;
  m: { t: number; r: number; b: number; l: number };
}
/** a span of fields: columns c0..c1 and rows r0..r1 (end exclusive) */
export interface Span { c0: number; c1: number; r0: number; r1: number }
export interface Bleed { l?: boolean; r?: boolean; t?: boolean; b?: boolean }

export function lattice(W: number, H: number, nc: number, nr: number, g: number, b0: number, m: Lattice['m']): Lattice {
  const cw = (W - m.l - m.r - (nc - 1) * g) / nc;
  const fh = (H - m.t - m.b - (nr - 1) * g) / nr;
  // the baseline unit divides field + gutter exactly (a whole number of lines per field)
  const lines = Math.max(1, Math.round((fh + g) / Math.max(1, b0)));
  return { W, H, nc, nr, g, b: (fh + g) / lines, lines, x0: m.l, y0: m.t, cw, fh, m };
}

/** pixel rect of a span; outer edges named in `bl` extend to the trim (bleed) */
export function spanRect(L: Lattice, s: Span, bl?: Bleed): Rect {
  let x = L.x0 + s.c0 * (L.cw + L.g), y = L.y0 + s.r0 * (L.fh + L.g);
  let x1 = L.x0 + s.c1 * (L.cw + L.g) - L.g, y1 = L.y0 + s.r1 * (L.fh + L.g) - L.g;
  if (bl?.l && s.c0 === 0) x = 0;
  if (bl?.r && s.c1 === L.nc) x1 = L.W;
  if (bl?.t && s.r0 === 0) y = 0;
  if (bl?.b && s.r1 === L.nr) y1 = L.H;
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}
/** which outer edges of the lattice a span touches */
export const touches = (L: Lattice, s: Span): Bleed => ({ l: s.c0 === 0, r: s.c1 === L.nc, t: s.r0 === 0, b: s.r1 === L.nr });
export const spanArea = (s: Span) => (s.c1 - s.c0) * (s.r1 - s.r0);

/** columns per format (major grid): compound counts (6 = 2·3, 12 = 2·3·4) so halves and thirds both exist */
function colChoices(W: number, H: number): Record<string, number> {
  const r = W / H;
  if (r < 0.9) return { 4: 1, 6: 2.2 };
  if (r < 1.15) return { 4: 1, 6: 2.2 };
  if (r < 1.5) return { 6: 1, 8: 2 };
  if (r < 2) return { 8: 1, 10: 0.8, 12: 1.2 };
  return { 10: 1, 12: 2 };
}

export interface LatticeOpts {
  /** forced columns / rows (0 = by format) */
  cols?: number; rows?: number;
  /** margin in px (all sides) and the foot (bottom) margin factor */
  margin?: number; foot?: number;
  /** gutter in px (undefined = one baseline line) */
  gutter?: number;
  /** double the major grid (compound fine grid: finer picture spans, same structure) */
  fine?: boolean;
  /** field proportion (height / width) */
  fieldAspect?: number;
}

/** a modular lattice for a canvas: columns by format, near-square fields, gutter = one baseline line */
export function modularLattice(W: number, H: number, rng: Rng, o: LatticeOpts = {}): Lattice {
  const u = Math.min(W, H) / 100;
  const b0 = Math.round(u * 1.5);
  const g = o.gutter ?? b0;
  const mm = o.margin ?? Math.round(b0 * rng.pick([2, 2.5, 3]));
  const foot = o.foot ?? (rng.chance(0.3) ? 1.6 : 1);
  const m = { t: mm, r: mm, b: Math.round(mm * foot), l: mm };
  let nc = o.cols || Number(rng.weighted(colChoices(W, H)));
  const fa = o.fieldAspect ?? Number(rng.weighted({ '1': 3, '1.2': 1, '0.85': 1 }));
  const cw = (W - m.l - m.r - (nc - 1) * g) / nc;
  const ht = H - m.t - m.b;
  let nr = o.rows || Math.max(3, Math.min(16, Math.round((ht + g) / (cw * fa + g))));
  if (o.fine) { nc = Math.min(24, nc * 2); nr = Math.min(32, nr * 2); }
  return lattice(W, H, nc, nr, g, b0, m);
}

/** the compound fine grid of a lattice: every field halved both ways, same margins and gutter */
export const refine = (L: Lattice, b0: number): Lattice => lattice(L.W, L.H, Math.min(16, L.nc * 2), Math.min(16, L.nr * 2), L.g, b0, L.m);

/** a full-canvas lattice with no margins (the bleed grid): seams instead of gutters */
export function bleedLattice(W: number, H: number, nc: number, nr: number, seam: number, frame = 0): Lattice {
  const u = Math.min(W, H) / 100;
  return lattice(W, H, nc, nr, seam, Math.round(u * 1.5), { t: frame, r: frame, b: frame, l: frame });
}

/** the legacy Grid view of a lattice (column / row edges at mid-gutter), written into `g` in place */
export function writeGrid(L: Lattice, g: Grid) {
  const xs: number[] = [L.x0], ys: number[] = [L.y0];
  for (let c = 1; c < L.nc; c++) xs.push(L.x0 + c * (L.cw + L.g) - L.g / 2);
  xs.push(L.W - L.m.r);
  for (let r = 1; r < L.nr; r++) ys.push(L.y0 + r * (L.fh + L.g) - L.g / 2);
  ys.push(L.H - L.m.b);
  g.x = xs; g.y = ys; g.nc = L.nc; g.nr = L.nr; g.gutter = L.g; g.baseline = L.b;
  g.m = { ...L.m };
  g.content = { x: L.x0, y: L.y0, w: L.W - L.m.l - L.m.r, h: L.H - L.m.t - L.m.b };
  g.type = 'ortho'; g.skew = 0;
}

/** snap a y offset (from a field top) to the baseline grid */
export const toBaseline = (L: Lattice, y: number) => L.y0 + Math.round((y - L.y0) / L.b) * L.b;
