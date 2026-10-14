// Phase 18: page archetypes. A page is built the course's way — background, subject, main text group, auxiliary info —
// on a grid. The archetypes come from the reference study (Wang Zhi-Hong's covers, magazine covers, pure constructions):
// each fixes where the subject sits and which rooms the type gets; the type layer then fills the rooms with constructions.
//   streams: ctx.rng = placement (the archetype, the subject's frame) · ctx.rg = grid (margins, columns, horizon)
//            ctx.rt = type (construction, alignment, scale mode, aux kinds) · ctx.rd = decor (hairlines, points)
// Global rules: the title is quiet (≤ 0.13 W) or giant (≥ 0.19 W), never in between; one spot colour; every group shares an
// edge with something (a rule, a photo edge, a column, a baseline); the empty field is one block.
import type { Ctx, ImageAsset } from '../gen/ctx';
import type { Rect } from '../gen/grid';
import type { Copy } from './copy';
import { usable, paintFor } from './compose';
import { instantiate } from './library';
import { fitGroup, emit, realize, usedTexts, type Paint, type Layout, type Fitted } from './realize';
import { auxBand, auxEdge, type AuxKind, type AuxEnv } from './aux';
import type { BoxNode, Construction, GNode, TextLeaf } from './types';
import { imageDrawRect } from '../render/svg';
import type { PageGrid } from './grid';

/** how calm (detail map) and how bright a region of a placed picture is: busy 0 calm … 1 busy */
export function zone(ctx: Ctx, a: ImageAsset, frame: Rect, region: Rect): { busy: number; lum: number; inside: number } {
  const { fx, fy } = ctx.align(a, frame, ctx.num('imageZoom') / 100);
  const dr = imageDrawRect({ ...frame, iw: a.w, ih: a.h, fx, fy, zoom: ctx.num('imageZoom') / 100 });
  const lum = ctx.imageLum(a, frame, region);
  const x0 = Math.max(region.x, frame.x), x1 = Math.min(region.x + region.w, frame.x + frame.w);
  const y0 = Math.max(region.y, frame.y), y1 = Math.min(region.y + region.h, frame.y + frame.h);
  const inside = x1 > x0 && y1 > y0 ? ((x1 - x0) * (y1 - y0)) / Math.max(1, region.w * region.h) : 0;
  if (!a.detail || inside <= 0) return { busy: 0.5, lum, inside };
  let s = 0, n = 0, mx = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const px = x0 + ((i + 0.5) / 6) * (x1 - x0), py = y0 + ((j + 0.5) / 6) * (y1 - y0);
    const gi = Math.min(15, Math.max(0, Math.floor(((px - dr.x) / dr.w) * 16))), gj = Math.min(15, Math.max(0, Math.floor(((py - dr.y) / dr.h) * 16)));
    const v = a.detail[gj * 16 + gi]; s += v; n++; mx = Math.max(mx, v);
  }
  return { busy: 0.6 * (s / n) + 0.4 * mx, lum, inside };
}
/** can type sit on this box of a placed picture without a scrim? Judged by the worst of six sub-regions (an average
 *  hides a bright head or a busy corner): every part calm enough, every part in contrast with one ink */
export function calmBox(ctx: Ctx, a: ImageAsset, frame: Rect, box: Rect, o: { busy?: number; need?: number } = {}): { ok: boolean; lum: number } {
  const whole = zone(ctx, a, frame, box);
  const dark = whole.lum < 0.5;
  if (whole.busy > (o.busy ?? 0.45)) return { ok: false, lum: whole.lum };
  const nx = box.w > box.h ? 4 : 3, ny = box.w > box.h ? 3 : 4;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const r = { x: box.x + (i * box.w) / nx, y: box.y + (j * box.h) / ny, w: box.w / nx, h: box.h / ny };
    const z = zone(ctx, a, frame, r);
    if (z.busy > (o.busy ?? 0.45) + 0.15) return { ok: false, lum: whole.lum };
    // the same ink must read on every part: a dark ink needs every part light, a light ink every part dark
    if (dark ? z.lum > 0.42 : z.lum < 0.55) return { ok: false, lum: whole.lum };
    if (ctx.legible(a, frame, r, 40, dark).opacity > (o.need ?? 0.22) + 0.08) return { ok: false, lum: whole.lum };
  }
  return { ok: true, lum: whole.lum };
}

/** does a room overlap the subject box of a placed picture (in canvas px)? */
function subjectRect(ctx: Ctx, a: ImageAsset, frame: Rect): Rect | null {
  if (!a.subject) return null;
  const { fx, fy } = ctx.align(a, frame, ctx.num('imageZoom') / 100);
  const dr = imageDrawRect({ ...frame, iw: a.w, ih: a.h, fx, fy, zoom: ctx.num('imageZoom') / 100 });
  return { x: dr.x + a.subject.x * dr.w, y: dr.y + a.subject.y * dr.h, w: a.subject.w * dr.w, h: a.subject.h * dr.h };
}
const overlapA = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export interface PageEnv {
  ctx: Ctx; copy: Copy; W: number; H: number; S: number; tiny: number;
  paint: Paint; on: string; m: number; land: boolean; wide: boolean; used: Set<string>; pics: ImageAsset[];
  /** the grid layer's modular grid */
  g: PageGrid;
  /** call counters: each main group / aux band draws from its own fork of the type stream, so a grid re-roll (which
   *  reshapes the rooms) keeps the type layer's choices */
  n: { main: number; aux: number };
  /** the constructions the main groups used (recorded in the scene's semantics) */
  mains: string[];
}

export type Scale = 'quiet' | 'giant' | 'any';
export interface MainOpts { al?: 'start' | 'center' | 'end'; va?: 'top' | 'center' | 'bottom'; scale?: Scale; tags?: string[]; only?: string[]; paint?: Paint; minFill?: number;
  /** a dry run: fit and position the group, emit nothing (the next real call in the same room draws the same group) */
  dry?: boolean }

const shapeOf = (ar: number): Construction['shape'] => (ar > 3.2 ? 'band' : ar > 1.4 ? 'wide' : ar > 0.7 ? 'square' : 'tall');
const NEAR: Record<Construction['shape'], Construction['shape'][]> = { band: ['band', 'wide'], wide: ['wide', 'band', 'square'], square: ['square', 'wide', 'tall'], tall: ['tall', 'square'] };
const kmax = (n: GNode): number => (n.t === 'text' ? n.k : n.t === 'mark' ? 0 : Math.max(...n.kids.map(kmax)));

/** mirror a construction's horizontal alignment (a flush-right room gets flush-right groups) */
function mirror(n: GNode): GNode {
  if (n.t !== 'box') return n;
  const al = n.dir === 'col' ? (n.al === 'start' || !n.al ? 'end' : n.al === 'end' ? 'start' : n.al) : n.al;
  return { ...n, al, kids: n.dir === 'row' ? n.kids.slice().reverse().map(mirror) : n.kids.map(mirror) };
}
function centre(n: GNode): GNode { return n.t !== 'box' ? n : { ...n, al: n.dir === 'col' ? 'center' : n.al, kids: n.kids.map(centre) }; }

/** the copy as the main group sees it: what is already on the page (a masthead, a giant title) is not repeated, the
 *  next level steps up (the subtitle becomes the title) */
export function viewOf(copy: Copy, used: Set<string>): Copy | null {
  const v: Copy = { ...copy, items: copy.items.filter((i) => !used.has(i.main.t)), meta: copy.meta.filter((m) => !used.has(m.t)) };
  if (used.has(copy.title.t)) {
    const next = copy.sub && !used.has(copy.sub.t) ? copy.sub : copy.en && copy.en !== copy.title.t && !used.has(copy.en) ? { t: copy.en, lang: 'en' as const } : copy.cn && copy.cn !== copy.title.t && !used.has(copy.cn) ? { t: copy.cn, lang: 'zh' as const } : null;
    if (!next) return null;
    v.title = next; v.sub = null;
  }
  v.cn = v.title.lang === 'zh' ? v.title.t : copy.cn && !used.has(copy.cn) && copy.cn !== v.title.t ? copy.cn : null;
  v.en = v.title.lang === 'en' ? v.title.t : copy.en && !used.has(copy.en) && copy.en !== v.title.t ? copy.en : null;
  if (v.sub && (used.has(v.sub.t) || v.sub.t === v.title.t)) v.sub = null;
  return v;
}

/** place the main text group in a room: the type layer draws a few constructions and keeps the one that suits the room
 *  best (it fills the room and stays legible); the title is always placed — the scale limits relax step by step */
export function placeMain(env: PageEnv, room: Rect, o: MainOpts = {}): { box: Rect; c: Construction } | null {
  const { ctx } = env;
  const copy = viewOf(env.copy, env.used);
  if (!copy) return null;
  const ar = room.w / Math.max(1, room.h);
  const shapes = NEAR[shapeOf(ar)];
  const all = usable(copy);
  let pool = all.filter((c) => shapes.includes(c.shape));
  if (o.only) { const p = pool.filter((c) => o.only!.includes(c.id)); pool = p.length ? p : all.filter((c) => o.only!.includes(c.id)); }
  // a pinned construction (the `construction` param) is tried first, in any room; when the copy cannot fill it, the
  // usual choice follows
  const forcedC = String(ctx.p.construction ?? 'auto');
  const pinned = forcedC !== 'auto' ? all.find((c) => c.id === forcedC) ?? null : null;
  if (o.tags) { const t = pool.filter((c) => c.tags?.some((x) => o.tags!.includes(x))); if (t.length) pool = t; }
  if (!pool.length) pool = all;
  // the type layer's order of candidates: a weighted shuffle of the whole library from this call's own stream (not of the
  // room's pool), so a grid re-roll that reshapes the room keeps the same construction whenever it still suits the room
  const rr = ctx.rt.fork('main' + (o.dry ? env.n.main : env.n.main++));
  const order: Construction[] = [];
  const left = all.slice();
  while (left.length) { const id = rr.weighted(left.map((c) => [c.id, c.wt ?? 1] as [string, number])); order.push(left.splice(left.findIndex((c) => c.id === id), 1)[0]); }
  // a type re-roll moves away from the constructions the base poster used (they go to the end of the order)
  const avoid = new Set(ctx.avoid?.constructions ?? []);
  const ranked = [...(pinned ? [pinned] : []), ...order.filter((c) => c !== pinned && pool.includes(c) && !avoid.has(c.id)), ...order.filter((c) => c !== pinned && pool.includes(c) && avoid.has(c.id))];
  const scales: Scale[] = o.scale && o.scale !== 'any' ? [o.scale, 'any'] : ['any'];
  for (const sc of scales) {
    const tries = ranked.slice();
    let best: { f: Fitted; c: Construction; score: number } | null = null;
    for (let i = 0; i < 7 && tries.length; i++) {
      const c0 = tries.shift()!;
      // each construction's own choices (breaks, closures, accents) come from its own fork: stable across re-rolls
      const cr = rr.fork(c0.id);
      const inst = instantiate(c0, { copy, r: cr, shape: shapes[0] });
      if (!inst?.root) continue;
      const root = (o.al === 'end' ? mirror(inst.root) : o.al === 'center' ? centre(inst.root) : inst.root) as BoxNode;
      const c = { ...inst, root };
      const tk = kmax(root);
      const maxA = sc === 'quiet' ? (env.S * 0.13) / tk : Infinity;
      const minA = sc === 'giant' ? (env.S * 0.19) / tk : 0;
      const f = fitGroup({ ctx, copy }, c, room, env.tiny * 0.95, maxA);
      if (!f || f.A < minA) continue;
      // keep the candidate that fills the room best (quiet groups are allowed to stay small), with a little chance
      // the first candidate that fills its room well is kept; otherwise the best of the first three
      const score = c0 === pinned ? Infinity : (sc === 'quiet' ? 1 : Math.sqrt(f.fill)) * (1 - i * 0.08);
      if (!best || score > best.score) best = { f, c, score };
      if (c0 === pinned) break;
      if (f.fill > 0.3 || sc === 'quiet' || i >= 2) break;
    }
    if (!best) continue;
    const { f, c } = best;
    const x = room.x + (o.al === 'center' ? (room.w - f.L.w) / 2 : o.al === 'end' ? room.w - f.L.w : 0);
    const y = room.y + (o.va === 'center' ? (room.h - f.L.h) / 2 : o.va === 'bottom' ? room.h - f.L.h : 0);
    if (o.dry) return { box: { x, y, w: f.L.w, h: f.L.h }, c };
    const r = emit(ctx, f.L, x, y, o.paint ?? env.paint);
    usedTexts(copy, f.L).forEach((t) => env.used.add(t));
    env.mains.push(c.id);
    return { box: r.box, c };
  }
  // last resort: the title alone on one or two lines
  const lone: Construction = { id: 'title', zh: '标题', en: 'Title', needs: ['title'], shape: 'square', root: { t: 'box', dir: 'col', kids: [{ t: 'text', slot: 'title', k: 1, w: 'bold', lines: 2 }] } };
  const f = fitGroup({ ctx, copy }, lone, room, env.tiny * 0.8);
  if (!f) return null;
  if (o.dry) return { box: { x: room.x, y: room.y + (o.va === 'bottom' ? room.h - f.L.h : 0), w: f.L.w, h: f.L.h }, c: lone };
  const r = emit(ctx, f.L, room.x, room.y + (o.va === 'bottom' ? room.h - f.L.h : 0), o.paint ?? env.paint);
  env.used.add(copy.title.t);
  return { box: r.box, c: lone };
}

function auxIn(env: PageEnv, r: Rect, kinds: AuxKind[], paint?: Paint) {
  const a: AuxEnv = { ctx: env.ctx, copy: env.copy, paint: paint ?? env.paint, tiny: env.tiny, used: env.used, xs: env.g.xs };
  const rng = env.ctx.rt.fork('aux' + env.n.aux++);
  return auxBand(a, r, rng.pick(kinds), rng);
}
function hair(env: PageEnv, x1: number, y1: number, x2: number, y2: number, col = env.paint.ink, w = Math.max(1, env.S * 0.0016)) {
  env.ctx.add({ kind: 'line', id: env.ctx.id('hl'), layer: 'lines', x1, y1, x2, y2, stroke: col, sw: w });
}
export function picture(env: PageEnv, a: ImageAsset, r: Rect, o: { gray?: boolean } = {}) {
  const n = env.ctx.image(a, r, o.gray ? { filter: { grayscale: true, contrast: 1.05 } } : {});
  env.ctx.occupied.push(r);
  return n;
}

// ---------------------------------------------------------------- archetypes with a picture

/** a full-bleed photo band at the top (or the left on wide formats); the type takes the paper band */
export function photoBand(env: PageEnv) {
  const { ctx, W, H, g } = env;
  const a = env.pics[0];
  if (env.wide) {
    // the photo takes whole columns and bleeds off three edges; the type hangs from the top margin in the other columns
    const n = Math.min(g.cols - 2, g.colsOf(ctx.rg.pick([0.48, 0.54, 0.6])));
    const left = ctx.rng.chance(0.5);
    const fr = left ? { x: 0, y: 0, w: g.xr(n), h: H } : { x: g.x(g.cols - n), y: 0, w: W - g.x(g.cols - n), h: H };
    picture(env, a, fr, { gray: ctx.rd.chance(0.25) });
    const tx = left ? g.x(n) : g.x(0), tw = left ? g.xr(g.cols) - g.x(n) : g.xr(g.cols - n) - g.x(0);
    const main = placeMain(env, { x: tx, y: g.mt, w: tw, h: g.yb(g.rowAt(0.62)) - g.mt }, { al: 'start', va: 'top' });
    const top = main ? main.box.y + main.box.h + g.gut : H * 0.6;
    auxIn(env, { x: tx, y: Math.max(top, H - g.mb - H * 0.2), w: tw, h: Math.min(H * 0.2, H - g.mb - top) }, ['pairs', 'leaders', 'corners', 'columns']);
    return;
  }
  // the photo bleeds off the top and sides and stops on a row's bottom line; the type hangs from the next row line
  const j = g.rowAt(ctx.rg.pick(env.land ? [0.5, 0.56, 0.62] : [0.5, 0.56, 0.6, 0.64, 0.68]));
  const fr = { x: 0, y: 0, w: W, h: g.yb(j) };
  picture(env, a, fr, { gray: ctx.rd.chance(0.3) });
  const band = { x: g.x(0), y: g.y(j), w: g.xr(g.cols) - g.x(0), h: H - g.mb - g.y(j) };
  const al = ctx.rt.weighted({ center: 1.2, start: 1.6 }) as 'center' | 'start';
  const auxH = Math.min(band.h * 0.3, env.tiny * 7);
  // the group's measure: whole columns (a centred group drops the same number of columns on both sides)
  const c0 = al === 'center' ? Math.min(Math.floor((g.cols - 2) / 2), Math.round(g.cols * ctx.rg.pick([0, 0.08, 0.125]))) : 0;
  const c1 = al === 'center' ? g.cols - c0 : g.colsOf(ctx.rg.pick([1, 0.84, 0.75, 0.67]));
  const main = placeMain(env, { x: g.x(c0), y: band.y, w: g.xr(c1) - g.x(c0), h: band.h - auxH - g.gut }, { al, va: 'top' });
  if (main) {
    const ay = Math.max(main.box.y + main.box.h + g.gut, band.y + band.h - auxH);
    auxIn(env, { x: band.x, y: ay, w: band.w, h: band.y + band.h - ay }, al === 'center' ? ['centred', 'corners', 'pairs'] : ['columns', 'pairs', 'leaders', 'handle']);
  }
  // a hairline that starts inside the photo and continues into the band (zones connected, not boxed)
  if (ctx.rd.chance(0.35)) { const x = al === 'center' ? W / 2 : g.m * 0.5; hair(env, x, fr.h * 0.82, x, band.y + band.h * 0.15); }
}

/** a full-bleed photo; the type lives in the calmest region away from the subject. No scrims (the covers never use
 *  them): a flat photo zone, or a solid band when no zone is calm enough */
export function fullBleed(env: PageEnv) {
  const { ctx, W, H, m, g } = env;
  const a = env.pics[0];
  const fr = { x: 0, y: 0, w: W, h: H };
  const sr = subjectRect(ctx, a, fr);
  // candidate rooms on the grid: top / bottom bands (portrait), left / right column groups (landscape), a corner block
  const cl = Math.max(2, g.colsOf(0.42)), rk = Math.max(2, Math.round(g.rows * 0.3)), rc = Math.max(2, Math.round(g.rows * 0.5)), cc = Math.max(2, g.colsOf(0.55));
  const cands: { r: Rect; al: 'start' | 'end' | 'center'; va: 'top' | 'bottom' }[] = env.land
    ? [{ r: g.cell(0, cl, 0, g.rows), al: 'start', va: 'top' }, { r: g.cell(g.cols - cl, g.cols, 0, g.rows), al: 'end', va: 'top' }, { r: g.cell(0, cl, 0, g.rows), al: 'start', va: 'bottom' }, { r: g.cell(g.cols - cl, g.cols, 0, g.rows), al: 'end', va: 'bottom' }]
    : [{ r: g.cell(0, g.cols, 0, rk), al: 'start', va: 'top' }, { r: g.cell(0, g.cols, g.rows - rk, g.rows), al: 'start', va: 'bottom' }, { r: g.cell(0, g.cols, g.rows - rk, g.rows), al: 'center', va: 'bottom' }, { r: g.cell(g.cols - cc, g.cols, g.rows - rc, g.rows), al: 'end', va: 'bottom' }];
  // a room must be calm (detail map) and readable without a scrim (the covers never use one); the rooms are ranked, then
  // the group is fitted dry and the box it would really cover is judged (a room's average hides a busy corner)
  const scale: Scale = ctx.rt.chance(0.5) ? 'quiet' : 'any';
  const scored = cands.map((c) => { const z = zone(ctx, a, fr, c.r); const hit = sr ? overlapA(sr, c.r) / Math.max(1, sr.w * sr.h) : 0; const need = ctx.legible(a, fr, c.r, 40, z.lum < 0.5).opacity; return { ...c, z, need, cost: z.busy + hit * 1.5 + need * 1.6 + ctx.rng.next() * 0.12 }; }).sort((p, q) => p.cost - q.cost);
  let best: ((typeof scored)[number] & { box: Rect }) | null = null;
  for (const c of scored.slice(0, 3)) {
    if (c.z.busy > 0.66 || c.need > 0.3) continue;
    const d = placeMain(env, c.r, { al: c.al, va: c.va, scale, dry: true });
    if (!d) continue;
    const pad = env.tiny;
    const box = { x: d.box.x - pad, y: d.box.y - pad, w: d.box.w + 2 * pad, h: d.box.h + 2 * pad };
    const hit = sr ? overlapA(sr, box) / Math.max(1, box.w * box.h) : 0;
    const cb = calmBox(ctx, a, fr, box);
    // the type never touches the subject (the covers: titles never cross the face)
    const hitS = sr ? overlapA(sr, box) / Math.max(1, sr.w * sr.h) : 0;
    if (hit > 0.08 || hitS > 0.06) continue;
    if (!cb.ok) continue;
    best = { ...c, z: { ...c.z, lum: cb.lum }, box };
    break;
  }
  if (!best) {
    // nothing calm enough: the band fallback (photo above, a solid band holds the type)
    return photoBand(env);
  }
  picture(env, a, fr);
  const lg = ctx.legible(a, fr, best.box, 40, best.z.lum < 0.5);
  const paint = paintFor(ctx, lg.color);
  const p2: Paint = { ...paint, ink: lg.fill, soft: lg.fill, accent: paint.accent === paint.ink ? lg.fill : paint.accent, on: lg.color };
  placeMain(env, best.r, { al: best.al, va: best.va, paint: p2, scale });
  // an edge transition on the side away from the type, where that edge of the picture carries type
  const edge = { x: best.al === 'end' ? m * 0.4 : W - m * 1.4, y: H * 0.3, w: m, h: H * 0.4 };
  if (ctx.rt.chance(0.4) && calmBox(ctx, a, fr, edge).ok) auxEdge({ ctx, copy: env.copy, paint: { ...p2, ink: ctx.legible(a, fr, edge, 40, ctx.imageLum(a, fr, edge) < 0.5).fill }, tiny: env.tiny, used: env.used }, edge, best.al === 'end' ? 'left' : 'right');
}

/** a centred framed photo with type on the flanks (Wang Zhi-Hong's center_flank) */
export function centreFrame(env: PageEnv) {
  const { ctx, W, H, m, copy, g } = env;
  const a = env.pics[0];
  // a centred frame over whole columns (as many dropped on each side), its top and bottom on row lines
  let n = g.colsOf(ctx.rg.pick(env.land ? [0.34, 0.38, 0.42] : [0.46, 0.5, 0.54]));
  if ((g.cols - n) % 2) n = n + 1 <= g.cols - 2 ? n + 1 : n - 1;
  n = Math.max(1, Math.min(g.cols - 2, n));
  const c0 = (g.cols - n) / 2;
  const fw = g.xr(c0 + n) - g.x(c0);
  const ar = Math.max(0.6, Math.min(1.5, a.w / a.h));
  const j0 = g.rowAt(env.land ? 0.18 : ctx.rg.pick([0.24, 0.27, 0.3]));
  const fy = g.y(j0);
  const fh = g.ybNear(fy + Math.min(H * (env.land ? 0.64 : 0.5), fw / ar), j0) - fy;
  const fr = { x: g.x(c0), y: fy, w: fw, h: fh };
  picture(env, a, fr, { gray: ctx.rd.chance(0.4) });
  // right flank: a vertical Han title top-aligned to the photo (or the main group above the photo)
  const flankW = (W - fw) / 2 - m * 1.4;
  const cn = copy.cn && Array.from(copy.cn).length <= 9 ? copy.cn : null;
  let placed = false;
  if (cn && ctx.rt.chance(0.7)) {
    const k = Math.min(flankW * 0.8, (fh * 0.95) / Array.from(cn).length, W * 0.11);
    const Lo = realize({ ctx, copy }, { id: 'flank', zh: '', en: '', needs: [], shape: 'tall', root: { t: 'box', dir: 'col', kids: [{ t: 'text', slot: 'title.cn', k: 1, dir: 'v', w: 'bold', lead: 1.05, face: 'display' }] } }, k);
    if (Lo) { emit(ctx, Lo, fr.x + fw + (W - fr.x - fw - Lo.w) / 2, fr.y, env.paint); env.used.add(cn); placed = true; }
  }
  // above the photo: the main group (or the Latin line) centred
  const above = { x: g.x(0), y: g.mt, w: g.xr(g.cols) - g.x(0), h: fr.y - g.gut - g.mt };
  if (!placed) placeMain(env, above, { al: 'center', va: 'bottom' });
  else if (above.h > env.tiny * 3) placeMain(env, above, { al: 'center', va: 'bottom', only: ['two-level', 'small-big-mid', 'short-long-mid', 'cn-en-justify'], scale: 'quiet' });
  // left flank: a hairline from the photo's top, then secondary text ending at the photo's bottom
  if (ctx.rd.chance(0.7)) hair(env, fr.x - m * 0.7, fr.y, fr.x - m * 0.7, fr.y + fh * 0.55);
  // below the photo: aux aligned to the photo's left edge
  const below = { x: fr.x, y: fr.y + fh + g.gut, w: env.land ? W - fr.x - m : fw, h: H - g.mb - (fr.y + fh + g.gut) };
  auxIn(env, below, ['leaders', 'pairs', 'handle', 'columns']);
}

/** a small picture in a big field, at an optical point; the type is quiet */
export function plate(env: PageEnv) {
  const { ctx, W, H, m, g } = env;
  const a = env.pics[0];
  // a small frame of whole columns at an optical point; its edges on column and row lines
  const n = Math.max(1, Math.min(g.cols - 1, g.colsOf(ctx.rg.pick([0.3, 0.36, 0.42]))));
  const cx = ctx.rng.pick([0.5, 0.38, 0.62]), cy = ctx.rng.pick([0.38, 0.42, 0.33]);
  const c0 = Math.max(0, Math.min(g.cols - n, Math.round(cx * g.cols - n / 2)));
  const fw = g.xr(c0 + n) - g.x(c0);
  const ar = Math.max(0.6, Math.min(1.6, a.w / a.h));
  const fh0 = Math.min(H * 0.42, fw / ar);
  const j0 = g.rowAt(Math.max(0.12, cy - fh0 / H / 2));
  const fy = g.y(j0);
  const fr = { x: g.x(c0), y: fy, w: fw, h: g.ybNear(fy + fh0, j0) - fy };
  const fh = fr.h;
  picture(env, a, fr, { gray: ctx.rd.chance(0.35) });
  const lowY = fr.y + fh + g.gut;
  const corner = ctx.rt.pick(['bl', 'br', 'tl']);
  const nr = g.colsOf(0.62);
  if (env.land) {
    // landscape: the type stands beside the plate, on the wider side, top-aligned to the picture (its edge shared)
    const leftRoom = fr.x - g.gut - g.x(0), rightRoom = g.xr(g.cols) - (fr.x + fw + g.gut);
    const right = rightRoom >= leftRoom;
    const room = right ? { x: fr.x + fw + g.gut, y: fr.y, w: rightRoom, h: H - g.mb - env.tiny * 6 - fr.y } : { x: g.x(0), y: fr.y, w: leftRoom, h: H - g.mb - env.tiny * 6 - fr.y };
    placeMain(env, room, { al: right ? 'start' : 'end', va: 'top', scale: 'quiet' });
    auxIn(env, { x: m, y: corner === 'tl' ? H - g.mb - env.tiny * 6 : g.mt, w: W - 2 * m, h: Math.min(env.tiny * 6, Math.max(0, fr.y - g.gut - g.mt)) || env.tiny * 6 }, ['corners', 'columns', 'pairs']);
    return;
  }
  const room = corner === 'tl' ? { x: g.x(0), y: g.mt, w: g.span(nr), h: fr.y - g.gut - g.mt } : { x: corner === 'br' ? g.x(g.cols - nr) : g.x(0), y: lowY, w: g.span(nr), h: H - lowY - g.mb - env.tiny * 6 };
  placeMain(env, room, { al: corner === 'br' ? 'end' : 'start', va: corner === 'tl' ? 'top' : 'bottom', scale: 'quiet' });
  auxIn(env, { x: m, y: corner === 'tl' ? H - g.mb - env.tiny * 6 : g.mt, w: W - 2 * m, h: env.tiny * 6 }, ['corners', 'columns', 'pairs']);
}

// ---------------------------------------------------------------- archetypes without a picture

/** giant title: a 2×2 block for four Han characters, a vertical pair for two, the bleed-cut word otherwise */
export function giantBlock(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const raw = (copy.cn ?? copy.title.t).replace(/\s/g, '');
  const chars = Array.from(raw);
  const zh = /[㐀-鿿]/.test(raw);
  let titleBox: Rect;
  if (zh && (chars.length === 4 || chars.length === 2) && !env.land) {
    const k = chars.length === 4 ? Math.min((W - 2 * m) / 2.06, H * 0.27) : Math.min(W * 0.27, (H * 0.62) / 2.1);
    const gap = chars.length === 4 ? 0.06 : 1.1;
    const kids: GNode[] = chars.length === 4
      ? [{ t: 'box', dir: 'row', gap, kids: [L(chars[0]), L(chars[1])] }, { t: 'box', dir: 'row', gap, kids: [L(chars[2]), L(chars[3])] }]
      : [{ t: 'text', slot: 'lit', lit: raw, k: 1, dir: 'v', lead: 2.1, w: 'black', face: 'display', of: 'title' }];
    const Lo = realize({ ctx, copy }, { id: 'giant', zh: '', en: '', needs: [], shape: 'square', root: { t: 'box', dir: 'col', gap: chars.length === 4 ? 0.06 : 0, kids } }, k);
    if (!Lo) return;
    const x = chars.length === 4 ? (W - Lo.w) / 2 : W * ctx.rng.pick([0.55, 0.6]) - Lo.w / 2;
    const y = env.g.y(env.g.rowAt(chars.length === 4 ? 0.22 : 0.16));
    titleBox = emit(ctx, Lo, x, y, env.paint, 'big.main').box;
    env.used.add(copy.title.t); if (copy.cn) env.used.add(copy.cn);
  } else {
    const j = env.g.rowAt(0.18);
    const r = placeMain(env, { x: m, y: env.g.y(j), w: W - 2 * m, h: env.g.ybNear(H * 0.74, j) - env.g.y(j) }, { al: 'start', va: 'center', scale: 'giant' });
    if (!r) return;
    titleBox = r.box;
  }
  // the other copy: a top band of small text and a bottom band, 12–15× smaller than the giant
  auxIn(env, { x: m, y: env.g.mt, w: W - 2 * m, h: Math.max(env.tiny * 4, titleBox.y - env.g.gut - env.g.mt) }, ['columns', 'corners', 'handle']);
  const by = titleBox.y + titleBox.h + env.g.gut;
  auxIn(env, { x: m, y: by, w: W - 2 * m, h: H - env.g.mb - by }, ['pairs', 'leaders', 'centred']);
}
const L = (t: string): TextLeaf => ({ t: 'text', slot: 'lit', lit: t, k: 1, w: 'black', track: 0, lead: 1, face: 'display', of: 'title' });

/** a quiet title with a circle-family emblem as the subject */
export function quietEmblem(env: PageEnv) {
  const { ctx, W, H, m, g } = env;
  // the emblem spans whole columns; its centre on a column edge or a column's middle, its top on a row line
  let nd = Math.max(1, g.colsOf(ctx.rng.pick([0.36, 0.46, 0.56])));
  // never taller than half the page (landscape): fewer columns
  while (nd > 1 && g.span(nd) > H * (env.land ? 0.62 : 0.5)) nd--;
  const d = g.span(nd);
  const fx = ctx.rng.pick([0.5, 0.42, 0.58]);
  const c0 = env.land ? (fx <= 0.5 ? Math.max(0, Math.round(g.cols * 0.12)) : g.cols - nd - Math.max(0, Math.round(g.cols * 0.12))) : Math.max(0, Math.min(g.cols - nd, Math.round(fx * g.cols - nd / 2)));
  const cx = g.x(c0) + d / 2, cy = env.land ? H / 2 : g.y(g.rowAt(Math.max(0.08, ctx.rng.pick([0.36, 0.4, 0.33]) - d / H / 2))) + d / 2;
  const kind = ctx.rd.weighted({ solid: 3, rings: 1.5, pair: 1 });
  const col = env.paint.accent;
  if (kind === 'solid') ctx.add({ kind: 'circle', id: ctx.id('emb'), layer: 'shapes', cx, cy, r: d / 2, fill: col });
  else if (kind === 'rings') for (const f of [1, 0.75, 0.5]) ctx.add({ kind: 'circle', id: ctx.id('emb'), layer: 'shapes', cx: cx - (d / 2) * (1 - f), cy, r: (d / 2) * f, fill: 'none', stroke: col, sw: Math.max(1.2, W * 0.002) });
  else { ctx.add({ kind: 'circle', id: ctx.id('emb'), layer: 'shapes', cx, cy: cy - d * 0.27, r: d * 0.27, fill: col }); ctx.add({ kind: 'circle', id: ctx.id('emb'), layer: 'shapes', cx, cy: cy + d * 0.27, r: d * 0.27, fill: 'none', stroke: col, sw: Math.max(1.2, W * 0.002) }); }
  ctx.occupied.push({ x: cx - d / 2, y: cy - d / 2, w: d, h: d });
  const lowY = cy + d / 2 + g.gut;
  const al = ctx.rt.weighted({ start: 2, end: 1.2, center: 1 }) as 'start' | 'end' | 'center';
  if (env.land) {
    // landscape: the type on the other side of the emblem, its baseline on the emblem's bottom line
    const leftSide = cx > W / 2;
    const room = leftSide ? { x: m, y: g.mt, w: cx - d / 2 - g.gut - m, h: cy + d / 2 - g.mt } : { x: cx + d / 2 + g.gut, y: g.mt, w: W - m - (cx + d / 2 + g.gut), h: cy + d / 2 - g.mt };
    placeMain(env, room, { al: 'start', va: 'bottom', scale: 'quiet' });
    auxIn(env, { x: m, y: H - g.mb - env.tiny * 5, w: W - 2 * m, h: env.tiny * 5 }, ['corners', 'columns']);
    return;
  }
  placeMain(env, { x: m, y: lowY, w: W - 2 * m, h: H - lowY - g.mb - env.tiny * 5 }, { al, va: 'bottom', scale: 'quiet' });
  auxIn(env, { x: m, y: g.mt, w: W - 2 * m, h: Math.min(cy - d / 2 - g.gut - g.mt, env.tiny * 6) }, ['corners', 'columns']);
}

/** the centred totem: one full-width band (the title) and narrower centred bars around it */
export function totem(env: PageEnv) {
  const { W, H, m, g } = env;
  const j = g.rowAt(0.3);
  const r = placeMain(env, { x: m, y: g.y(j), w: W - 2 * m, h: g.ybNear(H * 0.68, j) - g.y(j) }, { al: 'center', va: 'center', only: ['cn-en-justify', 'small-big-mid', 'two-level', 'sandwich', 'emblem', 'rule-sandwich', 'centred-stack', 'numeral-hero'] });
  if (!r) return;
  const inset = g.x(1) - g.x(0);
  auxIn(env, { x: m + inset, y: g.mt, w: W - 2 * (m + inset), h: r.box.y - g.gut - g.mt }, ['centred', 'corners']);
  const by = r.box.y + r.box.h + g.gut;
  auxIn(env, { x: m + inset, y: by, w: W - 2 * (m + inset), h: H - g.mb - by }, ['centred', 'pairs', 'leaders']);
}

export type { Layout };
