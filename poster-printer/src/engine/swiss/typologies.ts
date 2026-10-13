// Phase 16 — Swiss layout typologies on the modular lattice. Each one states a design intent as a slicing template
// (solved by solver.ts) or as an explicit placement (scale steps, module blocks). The cost model decides which
// variant suits the actual pictures; the random stream decides among the good ones.
//   hero    one dominant picture (bleeding off its outer edges), satellites in a row / column, type in fields
//   flow    a flowline: the headline sits on it, pictures and the info column hang from it (ragged feet)
//   steps   a scale progression: 1 → 2 → 3 field squares on a diagonal, type in the empty triangles
//   strip   one or two justified rows of pictures at a common height, bleeding left and right
//   blocks  equal modules (a specimen sheet): the hero takes 2×2 modules, the rest one each
import type { Rng } from '../rng';
import { spanRect, type Lattice, type Span } from './lattice';
import { H, V, leaf, bleedOf, type Leaf, type LeafCost, type Node, type Placed } from './solver';

export type Typology = 'hero' | 'flow' | 'steps' | 'strip' | 'blocks';
export const TYPOLOGIES: Typology[] = ['hero', 'flow', 'steps', 'strip', 'blocks'];
/** typologies of the bleed grid (the `bleedgrid` composition) */
export type BleedTypology = 'mosaic' | 'rows';

export interface TplIn {
  L: Lattice; n: number; rng: Rng;
  hasInfo: boolean;
  /** minimum head / info widths in fields */
  headMinC: number; infoMinC: number;
  heroShare: number; satShare: number;
  /** picture proportions (w / h) */
  ars: number[];
}
export interface Cand { name: string; tree?: Node; region?: Span; explicit?: (cost: LeafCost) => Placed[] | null }

const clamp01 = (v: number) => Math.max(0.02, Math.min(0.5, v));
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);

/** does a typology suit this many pictures on this lattice? */
/** a justified row is as tall as its width divided by the sum of the proportions: it must reach ~17 % of the sheet */
function stripOK(n: number, L: Lattice, ars?: number[]) {
  if (!ars?.length) return true;
  const tw = L.W - L.m.l - L.m.r, rows = n >= 4 ? 2 : 1;
  const per = Math.ceil(n / rows);
  const sum = ars.slice(0, per).reduce((s, a) => s + a, 0) * (n / rows / per);
  return tw / Math.max(0.1, sum) >= L.H * 0.17;
}
export function feasible(ty: Typology, n: number, L: Lattice, ars?: number[]): boolean {
  switch (ty) {
    case 'hero': return n >= 1 && n <= 7;
    case 'flow': return n >= 1 && n <= Math.max(2, Math.floor(L.nc / 2)); // each hanging picture needs ≥ 2 columns to read
    case 'steps': return n >= 2 && n <= 3 && Math.min(L.nc, L.nr) >= (n === 2 ? 3 : 6);
    case 'strip': return n >= 2 && n <= 8 && stripOK(n, L, ars);
    case 'blocks': return n >= 2 && n <= 8;
  }
}

/** typology weights for a draw (count and format) */
export function typologyWeights(n: number, wide: boolean): Record<Typology, number> {
  if (n <= 1) return { hero: 3, flow: 2, steps: 0, strip: 0, blocks: 0 };
  if (n === 2) return { hero: 2.5, flow: 2, steps: wide ? 0.6 : 2, strip: 1.5, blocks: 1 };
  if (n <= 4) return { hero: 2.5, flow: 2, steps: wide ? 0.4 : 1.4, strip: 2, blocks: 2 };
  return { hero: 2, flow: 1.2, steps: 0, strip: 2.2, blocks: 3 };
}

export function templates(ty: Typology, t: TplIn): Cand[] {
  const { n, L } = t;
  const sats = range(1, n);
  const pic = (i: number, o: Partial<Leaf> = {}) => leaf('img', { i, ar: t.ars[i], tag: i === 0 ? 'hero' : 'sat', share: i === 0 ? t.heroShare : t.satShare, ...o });
  const hero = (o: Partial<Leaf> = {}) => pic(0, { bleed: 'outer', ...o });
  // text regions are bounded (a region far larger than its copy is a hole, not white space)
  const maxR = Math.max(2, Math.ceil(L.nr * 0.55));
  const head = (anchor: 'top' | 'bottom' = 'top', o: Partial<Leaf> = {}) => leaf('head', { anchor, min: [t.headMinC, 1], max: [L.nc, maxR], ...o });
  const info = (o: Partial<Leaf> = {}) => (t.hasInfo ? leaf('info', { min: [t.infoMinC, 1], max: [L.nc, maxR], ...o }) : leaf('void'));
  const wide = L.W / L.H > 1.5;
  // satellites as a small grid (two rows) beside the hero on long formats
  const satGrid = (): Node | null => { if (!sats.length) return null; if (sats.length < 3) return V(...sats.map((i) => pic(i))); const k = Math.ceil(sats.length / 2); return V(H(...sats.slice(0, k).map((i) => pic(i))), H(...sats.slice(k).map((i) => pic(i)))); };
  const gap = () => leaf('void');
  // satellites: one row, or two when they outnumber the columns
  const satRow = (): Node | null => {
    if (!sats.length) return null;
    if (sats.length <= Math.max(2, L.nc - 1)) return H(...sats.map((i) => pic(i)));
    const k = Math.ceil(sats.length / 2);
    return V(H(...sats.slice(0, k).map((i) => pic(i))), H(...sats.slice(k).map((i) => pic(i))));
  };
  const satCol = (): Node | null => (sats.length ? V(...sats.map((i) => pic(i))) : null);
  switch (ty) {
    case 'hero': return [
      { name: 'hero-top', tree: V(hero(), satRow(), H(head('top'), info())) },
      { name: 'hero-top-col', tree: V(hero(), H(V(head('top'), info()), satCol() ?? gap())) },
      { name: 'hero-bottom', tree: V(H(head('top'), info()), satRow(), hero()) },
      { name: 'hero-mid', tree: V(head('bottom', { min: [t.headMinC, 1] }), hero(), H(satRow() ?? gap(), info())) },
      { name: 'hero-side', tree: H(hero(), V(head('top'), satCol() ?? gap(), info())) },
      { name: 'hero-corner', tree: V(H(hero(), V(head('top'), info())), satRow() ?? gap()) },
      { name: 'hero-under-head', tree: V(head('top'), H(hero(), V(...sats.map((i) => pic(i)), info()))) },
      ...(wide ? [
        { name: 'wide-hero-grid', tree: H(hero(), satGrid() ?? gap(), V(head('top'), info())) },
        { name: 'wide-text-first', tree: H(V(head('top'), info()), hero(), satGrid() ?? gap()) },
        { name: 'wide-hero-band', tree: H(hero(), V(head('top'), satRow() ?? gap(), info())) },
      ] : []),
    ];
    case 'flow': {
      // more pictures than columns: satellites hang in pairs
      const cols: number[][] = [];
      const room = L.nc - (t.hasInfo ? t.infoMinC : 0);
      if (n <= room) for (let i = 0; i < n; i++) cols.push([i]);
      else { cols.push([0]); for (let i = 1; i < n; i += 2) cols.push(i + 1 < n ? [i, i + 1] : [i]); }
      const hang = (c: number[]) => V(...c.map((i) => pic(i)), gap());
      const stand = (c: number[]) => V(gap(), ...c.map((i) => pic(i)));
      const flowHead = head('bottom', { min: [t.headMinC, 2] });
      const r = t.rng.chance(0.5);
      const order = r ? cols : [...cols.slice(1, 2), cols[0], ...cols.slice(2)];
      return [
        { name: 'flow-hang', tree: V(flowHead, H(...order.map(hang), t.hasInfo ? V(info(), gap()) : null)) },
        { name: 'flow-hang-info-first', tree: V(head('bottom', { min: [t.headMinC, 2] }), H(t.hasInfo ? V(info(), gap()) : null, ...cols.map(hang))) },
        { name: 'flow-stand', tree: V(H(head('top'), info()), H(...cols.map(stand))) },
      ];
    }
    case 'strip': {
      const lr = { l: true, r: true };
      const per = clamp01(0.42 / Math.max(1, n));
      const row = (idx: number[], bleed: Leaf['bleed']) => H(...idx.map((i) => pic(i, { share: per, tag: 'strip', bleed })));
      const idx = range(0, n);
      const out: Cand[] = [
        { name: 'strip-mid', tree: V(head('bottom'), row(idx, lr), info()) },
        { name: 'strip-top', tree: V(row(idx, { ...lr, t: true }), H(head('top'), info())) },
        { name: 'strip-bottom', tree: V(H(head('top'), info()), row(idx, { ...lr, b: true })) },
      ];
      if (n >= 4) {
        const k = Math.ceil(n / 2);
        out.push({ name: 'strip-two', tree: V(head('top'), row(idx.slice(0, k), lr), row(idx.slice(k), lr), info()) });
        out.push({ name: 'strip-frame', tree: V(row(idx.slice(0, k), { ...lr, t: true }), H(head('top'), info()), row(idx.slice(k), { ...lr, b: true })) });
      }
      return out;
    }
    case 'steps': return stepsCands(t);
    case 'blocks': return blocksCands(t);
  }
}

// ---------------------------------------------------------------- explicit placements
/** prefix-sum occupancy of the lattice; free rectangles for the type */
function occupancy(L: Lattice, taken: Span[]) {
  const occ = new Uint8Array(L.nc * L.nr);
  for (const s of taken) for (let r = s.r0; r < s.r1; r++) for (let c = s.c0; c < s.c1; c++) occ[r * L.nc + c] = 1;
  const P = new Int32Array((L.nc + 1) * (L.nr + 1));
  for (let r = 0; r < L.nr; r++) for (let c = 0; c < L.nc; c++) P[(r + 1) * (L.nc + 1) + c + 1] = occ[r * L.nc + c] + P[r * (L.nc + 1) + c + 1] + P[(r + 1) * (L.nc + 1) + c] - P[r * (L.nc + 1) + c];
  const sum = (s: Span) => P[s.r1 * (L.nc + 1) + s.c1] - P[s.r0 * (L.nc + 1) + s.c1] - P[s.r1 * (L.nc + 1) + s.c0] + P[s.r0 * (L.nc + 1) + s.c0];
  return { free: (s: Span) => sum(s) === 0 };
}
/** all free rectangles (maximal in neither direction: the cost decides) */
function freeRects(L: Lattice, taken: Span[], min: [number, number]): Span[] {
  const o = occupancy(L, taken);
  const out: Span[] = [];
  for (let r0 = 0; r0 < L.nr; r0++) for (let c0 = 0; c0 < L.nc; c0++)
    for (let r1 = r0 + min[1]; r1 <= L.nr; r1++) for (let c1 = c0 + min[0]; c1 <= L.nc; c1++) {
      const s = { c0, c1, r0, r1 };
      if (!o.free(s)) break; // wider is not free either
      out.push(s);
    }
  return out;
}
const overlaps = (a: Span, b: Span) => a.c0 < b.c1 && b.c0 < a.c1 && a.r0 < b.r1 && b.r0 < a.r1;
/** place the head and the info block into the best free rectangles left by the pictures. `side` prefers the head on
 *  the left (default) or right; `infoFar` lets the info block sit away from the head (another corner of the sheet). */
export function placeType(t: TplIn, pics: { leaf: Leaf; span: Span }[], cost: LeafCost, headAnchor: 'top' | 'bottom' = 'top', pref: { side?: 'left' | 'right'; infoFar?: boolean } = {}): Placed[] | null {
  const L = t.L;
  const mk = (lf: Leaf, s: Span): Placed => { const bl = bleedOf(L, lf, s); const rect = spanRect(L, s, bl); return { leaf: lf, span: s, rect, bleed: bl, cost: cost(lf, s, rect) }; };
  const placed = pics.map((p) => mk(p.leaf, p.span));
  if (placed.some((p) => !Number.isFinite(p.cost))) return null;
  const taken = pics.map((p) => p.span);
  const cells = L.nc * L.nr;
  // tie-breaks after the cost: the head hangs high (or sits low) and keeps to the left; a smaller region leaves the
  // rest of the free fields as white space
  const hl = leaf('head', { anchor: headAnchor, min: [t.headMinC, 1] });
  const hScore = (p: Placed) => p.cost + 0.15 * (((p.span.c1 - p.span.c0) * (p.span.r1 - p.span.r0)) / cells) + 0.04 * (pref.side === 'right' ? 1 - p.span.c1 / L.nc : p.span.c0 / L.nc) + 0.06 * (headAnchor === 'top' ? p.span.r0 / L.nr : 1 - p.span.r1 / L.nr);
  let bestH: Placed | null = null;
  for (const s of freeRects(L, taken, [t.headMinC, 1])) { const p = mk(hl, s); if (Number.isFinite(p.cost) && (!bestH || hScore(p) < hScore(bestH))) bestH = p; }
  if (!bestH) return null;
  placed.push(bestH);
  if (t.hasInfo) {
    const il = leaf('info', { min: [t.infoMinC, 1] });
    const h = bestH.span;
    // the info block shares an edge with the head (same column start, or directly beside / below it)
    const near0 = (s: Span) => (s.c0 === h.c0 ? 0 : s.c0 === h.c1 || s.c1 === h.c0 ? 0.04 : 0.12) + (s.r0 === h.r1 || s.r1 === h.r0 || s.r0 === h.r0 ? 0 : 0.06);
    const near = (s: Span) => (pref.infoFar ? 0.18 - near0(s) : near0(s));
    const iScore = (p: Placed) => p.cost + 0.12 * (((p.span.c1 - p.span.c0) * (p.span.r1 - p.span.r0)) / cells) + near(p.span);
    let bestI: Placed | null = null;
    for (const s of freeRects(L, [...taken, h], [t.infoMinC, 1])) { const p = mk(il, s); if (Number.isFinite(p.cost) && (!bestI || iScore(p) < iScore(bestI))) bestI = p; }
    if (!bestI) return null;
    placed.push(bestI);
  }
  return placed;
}

/** scale steps: 1 → 2 → 3 (field units) on a diagonal; the largest bleeds off its corner */
function stepsCands(t: TplIn): Cand[] {
  const { L, n } = t;
  const sizes = n === 2 ? [1, 2] : [1, 2, 3];
  const tot = sizes.reduce((s, v) => s + v, 0);
  const uc = Math.max(1, Math.floor(L.nc / tot)), ur = Math.max(1, Math.floor(L.nr / tot));
  const out: Cand[] = [];
  for (const dir of ['down', 'up'] as const) for (const fit of [true, false]) {
    out.push({
      name: `steps-${dir}${fit ? '-fit' : ''}`,
      explicit: (cost) => {
        // pictures by importance: the hero is the largest step
        const order = n === 2 ? [1, 0] : [2, 1, 0];
        let c = 0, r = dir === 'down' ? 0 : L.nr;
        const pics: { leaf: Leaf; span: Span }[] = [];
        for (let k = 0; k < sizes.length; k++) {
          const i = order[k];
          const w = Math.min(L.nc - c, sizes[k] * uc);
          let h = sizes[k] * ur;
          if (fit) { const px = w * (L.cw + L.g) - L.g; h = Math.max(1, Math.round((px / t.ars[i] + L.g) / (L.fh + L.g))); }
          const last = k === sizes.length - 1;
          const s = dir === 'down' ? { c0: c, c1: last ? L.nc : c + w, r0: r, r1: Math.min(L.nr, r + h) } : { c0: c, c1: last ? L.nc : c + w, r0: Math.max(0, r - h), r1: r };
          if (s.c1 <= s.c0 || s.r1 <= s.r0) return null;
          pics.push({ leaf: leaf('img', { i, tag: i === 0 ? 'hero' : 'sat', bleed: last ? 'outer' : undefined }), span: s });
          c = s.c1; r = dir === 'down' ? s.r1 : s.r0;
        }
        return placeType(t, pics, cost, dir === 'down' ? 'top' : 'bottom');
      },
    });
  }
  return out;
}

/** module blocks: equal modules of fields; the hero takes 2×2 modules (or a long one), the rest one each */
function blocksCands(t: TplIn): Cand[] {
  const { L, n } = t;
  const divs = (k: number, lo: number, hi: number) => range(lo, hi + 1).filter((d) => k % d === 0);
  const mcs = divs(L.nc, 2, 5), mrs = divs(L.nr, 2, 8);
  const out: Cand[] = [];
  for (const Mc of mcs.length ? mcs : [L.nc]) for (const Mr of mrs.length ? mrs : [L.nr]) {
    const fc = L.nc / Mc, fr = L.nr / Mr;
    // module proportion close to square, each module large enough to hold a readable picture
    const ma = (fc * (L.cw + L.g)) / (fr * (L.fh + L.g));
    if (ma < 0.5 || ma > 2) continue;
    if ((fc * (L.cw + L.g)) / (L.W - L.m.l - L.m.r) < 0.18 || (fr * (L.fh + L.g)) / (L.H - L.m.t - L.m.b) < 0.12) continue;
    for (const heroBig of [true, false]) for (const headTop of [true, false]) {
      // modules: the pictures (a big hero takes four), the head row and one for the info, plus a little air
      const need = n + (heroBig ? 3 : 0) + Mc + (t.hasInfo ? 1 : 0);
      if (Mc * Mr < need || Mc * Mr > need + 2 + Mc) continue;
      out.push({
        name: `blocks-${Mc}x${Mr}${heroBig ? '-big' : ''}${headTop ? '' : '-foot'}`,
        explicit: (cost) => {
          const used = new Uint8Array(Mc * Mr);
          const take = (c0: number, r0: number, w: number, h: number) => { if (c0 + w > Mc || r0 + h > Mr) return false; for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (used[r * Mc + c]) return false; for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) used[r * Mc + c] = 1; return true; };
          // the head row stays free: reserve it
          const headRow = headTop ? 0 : Mr - 1;
          for (let c = 0; c < Mc; c++) used[headRow * Mc + c] = 1;
          const pics: { leaf: Leaf; span: Span }[] = [];
          const sp = (c0: number, r0: number, w: number, h: number): Span => ({ c0: c0 * fc, c1: (c0 + w) * fc, r0: r0 * fr, r1: (r0 + h) * fr });
          const cells: [number, number][] = [];
          for (let r = 0; r < Mr; r++) for (let c = 0; c < Mc; c++) cells.push([c, r]);
          for (let i = 0; i < n; i++) {
            const a = t.ars[i];
            const shapes: [number, number][] = i === 0 && heroBig ? [[2, 2], a > 1.4 ? [2, 1] : [1, 2], [1, 1]] : a > 1.7 ? [[2, 1], [1, 1]] : a < 0.55 ? [[1, 2], [1, 1]] : [[1, 1]];
            let ok = false;
            for (const [w, h] of shapes) {
              for (const [c, r] of cells) if (take(c, r, w, h)) { pics.push({ leaf: leaf('img', { i, tag: i === 0 ? 'hero' : 'sat' }), span: sp(c, r, w, h) }); ok = true; break; }
              if (ok) break;
            }
            if (!ok) return null;
          }
          // release the head row for the type placement
          return placeType(t, pics, cost, headTop ? 'top' : 'bottom');
        },
      });
    }
  }
  return out;
}
