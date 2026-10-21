// Phase 18: more page archetypes (findings/covers.md, wangzhihong.md, titles.md, micro.md).
import type { Rect } from '../gen/grid';
import { realize, emit, type Layout } from './realize';
import { placeMain, zone, calmBox, photoBand, picture, type PageEnv } from './page';
import { auxBand, type AuxKind } from './aux';
import type { BoxNode, GNode, TextLeaf } from './types';
import { pickBreak } from './lines';
import { wcag } from '../color/contrast';
import { tonal } from '../color/strategy';

const lit = (t: string, k: number, o: Partial<TextLeaf> = {}): TextLeaf => ({ t: 'text', slot: 'lit', lit: t, k, ...o });
const col = (kids: (GNode | null | false)[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'col', al: 'start', gap: 0.4, kids: kids.filter(Boolean) as GNode[], ...o });
const row = (kids: (GNode | null | false)[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'row', al: 'start', gap: 0.6, kids: kids.filter(Boolean) as GNode[], ...o });
const han = (s: string) => /[㐀-鿿]/.test(s);
const lay = (env: PageEnv, root: BoxNode, A: number): Layout | null => realize({ ctx: env.ctx, copy: env.copy }, { id: 'x', zh: '', en: '', needs: [], shape: 'square', root }, A);
const put = (env: PageEnv, L: Layout, x: number, y: number, role = 'big.main') => emit(env.ctx, L, x, y, env.paint, role).box;
function aux(env: PageEnv, r: Rect, kinds: AuxKind[]) {
  if (r.h < env.tiny * 2 || r.w < env.tiny * 8) return [];
  const rng = env.ctx.rt.fork('aux2' + env.n.aux++);
  return auxBand({ ctx: env.ctx, copy: env.copy, paint: env.paint, tiny: env.tiny, used: env.used, xs: env.g.xs }, r, rng.pick(kinds), rng);
}
function hair(env: PageEnv, x1: number, y1: number, x2: number, y2: number) {
  env.ctx.add({ kind: 'line', id: env.ctx.id('hl'), layer: 'lines', x1, y1, x2, y2, stroke: env.paint.ink, sw: Math.max(1, env.S * 0.0016) });
}
/** cover-line entries: tag (0.5×) / name (1×, heavy) / note (0.65×), flush left, gap 0.6× the name */
function coverLines(env: PageEnv, r: Rect, pic?: { a: PageEnv['pics'][number]; fr: Rect }): Rect | null {
  const its = env.copy.items.filter((i) => !env.used.has(i.main.t)).slice(0, 5);
  if (its.length < 2) return null;
  const k = 2;
  const entries = its.map((it) => col([lit(it.main.t, k, { w: 'black', max: 16, of: 'item' }), it.note ? lit(it.note.t, k * 0.65, { max: 22 }) : null], { gap: 0.15 }));
  const L = lay(env, col(entries, { gap: k * 0.6 }), env.tiny);
  if (!L || L.h > r.h || L.w > r.w) return null;
  // on a picture: only where every part of the block can carry the ink
  if (pic && !calmBox(env.ctx, pic.a, pic.fr, { x: r.x - env.tiny, y: r.y - env.tiny, w: L.w + 2 * env.tiny, h: L.h + 2 * env.tiny }, { busy: 0.45, need: 0.25 }).ok) return null;
  its.forEach((i) => env.used.add(i.main.t));
  return put(env, L, r.x, r.y, 'small.main');
}

// ---------------------------------------------------------------- with a picture

/** the subject on one side, the type in a column on the open side (SGN face_open_side / WX land_cutout_side) */
export function openSide(env: PageEnv) {
  const { ctx, W, H, g } = env;
  const a = env.pics[0];
  const fr = { x: 0, y: 0, w: W, h: H };
  const sx = a.subject ? a.subject.x + a.subject.w / 2 : 0.5;
  const right = sx < 0.48 ? true : sx > 0.52 ? false : ctx.rng.chance(0.5);
  // the type column: whole columns on the open side, hanging from a row line
  const n = Math.max(2, g.colsOf(env.land ? 0.42 : ctx.rg.pick([0.4, 0.45, 0.5])));
  const cw = g.span(n);
  const cy = g.y(g.rowAt(env.land ? 0.18 : ctx.rg.pick([0.43, 0.5, 0.56])));
  const room = { x: right ? g.x(g.cols - n) : g.x(0), y: cy, w: cw, h: H - g.mb - cy };
  const z = zone(ctx, a, fr, room);
  if (z.busy > 0.72) return photoBand(env);
  // the box the group will really cover must be calm and readable without a scrim
  const d = placeMain(env, room, { al: 'start', va: 'top', tags: ['cover', 'plain'], dry: true });
  if (d) {
    const box = { x: d.box.x - env.tiny, y: d.box.y - env.tiny, w: d.box.w + 2 * env.tiny, h: d.box.h + 2 * env.tiny };
    if (!calmBox(ctx, a, fr, box, { busy: 0.45, need: 0.25 }).ok) return photoBand(env);
  }
  env.ctx.image(a, fr, {}); ctx.occupied.push(fr);
  const lg = ctx.legible(a, fr, d ? { x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h } : room, 40, z.lum < 0.5);
  const paint = { ...env.paint, ink: lg.fill, soft: lg.fill, on: lg.color };
  placeMain(env, room, { al: 'start', va: 'top', paint, tags: ['cover', 'plain'] });
  // cover lines hang from the top line on the same side
  const top = { x: room.x, y: g.mt, w: cw, h: cy - g.gut * 2 - g.mt };
  if (top.h > env.tiny * 6 && zone(ctx, a, fr, top).busy < 0.75) { const e2 = { ...env, paint }; coverLines(e2, top, { a, fr }); }
}

/** a full-width wordmark at the top, the cut-out subject occluding its middle letters (SGN masthead) */
export function masthead(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const a = env.pics[0];
  const word = (ctx.texts.facts?.masthead ?? (copy.en && copy.en.split(/\s+/).length === 1 && copy.en.length <= 9 ? copy.en : copy.title.lang === 'zh' && Array.from(copy.title.t).length <= 4 ? copy.title.t : null));
  if (!word) return openSide(env);
  const fr = { x: 0, y: 0, w: W, h: H };
  ctx.image(a, fr, {}); ctx.occupied.push(fr);
  const k = 1;
  const mastLeaf = lit(han(word) ? word : word.toUpperCase(), k, { w: 'black', track: -30, face: 'display', of: word === copy.title.t ? 'title' : 'title.en' });
  const L1 = lay(env, col([mastLeaf]), 100);
  if (!L1) return openSide(env);
  // phase 22: a v3 type re-roll sets the masthead another way: full width and centred (v2), flush left or right on a
  // shorter measure, or a narrower centred word; a v2 poster keeps the centred one
  const mv = ctx.typeV3 ? ctx.rt.fork('mast').pick(['centre', 'left', 'right', 'narrow'] as const) : 'centre';
  const meas = mv === 'centre' ? W - 2 * m * 0.6 : (W - 2 * m) * (mv === 'narrow' ? 0.66 : 0.82);
  const A = Math.min((meas / L1.w) * 100, (H * 0.2 / L1.h) * 100);
  const L = lay(env, col([mastLeaf]), A)!;
  const mx = mv === 'left' ? m : mv === 'right' ? W - m - L.w : (W - L.w) / 2, my = mv === 'narrow' ? m * 1.4 : m * 0.8;
  const band = { x: mx, y: my, w: L.w, h: L.h };
  const lg = ctx.legible(a, fr, band, 60, zone(ctx, a, fr, band).lum < 0.5);
  emit(ctx, L, mx, my, { ...env.paint, ink: lg.fill, accent: env.paint.accent }, 'big.main');
  env.used.add(word);
  // depth: the cut-out in front when it covers only the middle letters (≤ 35 %, never the first or last)
  if (a.cutout && a.subject) {
    const { fx, fy } = ctx.align(a, fr, ctx.num('imageZoom') / 100); void fx; void fy;
    const sx0 = a.subject.x * W, sx1 = (a.subject.x + a.subject.w) * W;
    const cov = Math.max(0, Math.min(sx1, mx + L.w) - Math.max(sx0, mx)) / L.w;
    if (sx0 > mx + L.w * 0.14 && sx1 < mx + L.w * 0.86 && cov <= 0.35 && a.subject.y * H < my + L.h) ctx.image(a, fr, { cutout: true });
  }
  // the issue number under the masthead, flush right; the main group in the calmer lower corner
  if (copy.index) { const iL = lay(env, col([lit(copy.index, 1.6, { w: 'bold' })]), env.tiny); if (iL) emit(ctx, iL, mv === 'right' ? m : W - m - iL.w, my + L.h + env.tiny * 0.8, { ...env.paint, ink: lg.fill }, 'small.main'); }
  const g = env.g, nl = Math.max(2, g.colsOf(0.6)), jl = g.rowAt(0.62);
  const lowL = g.cell(0, nl, jl, g.rows), lowR = g.cell(g.cols - nl, g.cols, jl, g.rows);
  const zl = zone(ctx, a, fr, lowL), zr = zone(ctx, a, fr, lowR);
  let order = zl.busy <= zr.busy ? [lowL, lowR] : [lowR, lowL];
  if (ctx.typeV3 && ctx.rt.fork('corner').chance(0.5)) order = [order[1], order[0]];   // phase 22: the other calm corner
  for (const room of order) {
    const al = room === lowL ? 'start' : 'end';
    const d = placeMain(env, room, { al, va: 'bottom', tags: ['cover'], dry: true });
    if (!d) continue;
    const box = { x: d.box.x - env.tiny, y: d.box.y - env.tiny, w: d.box.w + 2 * env.tiny, h: d.box.h + 2 * env.tiny };
    const cb = calmBox(ctx, a, fr, box);
    if (!cb.ok) continue;
    const lg2 = ctx.legible(a, fr, d.box, 40, cb.lum < 0.5);
    placeMain(env, room, { al, va: 'bottom', paint: { ...env.paint, ink: lg2.fill, soft: lg2.fill, accent: lg2.fill, on: lg2.color }, tags: ['cover'] });
    return;
  }
  // no corner of the picture carries type: a solid band at the foot holds the group (the covers' alternative to a scrim)
  // phase 22: a v3 type re-roll varies the band's depth and how the group sits in it
  const bv = ctx.typeV3 ? ctx.rt.fork('band') : null;
  const bandH = Math.round(H * (env.land ? 0.3 : 0.24) * (bv ? bv.pick([0.8, 1, 1.25]) : 1));
  ctx.add({ kind: 'rect', id: ctx.id('band'), layer: 'zones', x: 0, y: H - bandH, w: W, h: bandH, fill: env.paint.on });
  const bal = bv ? bv.pick(['start', 'center', 'end'] as const) : 'start';
  placeMain(env, { x: g.x(0), y: H - bandH + g.gut, w: g.xr(g.cols) - g.x(0), h: bandH - g.gut - g.mb }, { al: bal, va: bv && bv.chance(0.4) ? 'center' : 'top', tags: ['cover', 'plain'] });
}

/** a picture window on a solid colour field, the vertical title in the margin (SGN framed_inset) */
export function windowInset(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const a = env.pics[0];
  const pal = ctx.pal;
  const field = wcag(pal.accent, pal.bg) > 1.4 ? pal.accent : tonal(pal.bg, -0.08);
  ctx.add({ kind: 'rect', id: ctx.id('field'), layer: 'zones', x: 0, y: 0, w: W, h: H, fill: field });
  const left = ctx.rng.chance(0.6);
  // the window: whole columns against one margin, its top and bottom on row lines
  const g = env.g;
  const nw = Math.max(2, Math.min(g.cols - 1, g.colsOf(env.land ? 0.5 : ctx.rg.pick([0.58, 0.62, 0.67]))));
  const ww = g.span(nw);
  const jw = g.rowAt(env.land ? 0.11 : 0.24);
  const wx = left ? g.x(g.cols - nw) : g.x(0), wy = g.y(jw);
  const wh = g.ybNear(wy + H * (env.land ? 0.78 : ctx.rg.pick([0.62, 0.68])), jw) - wy;
  const b = Math.max(2, W * 0.008);
  ctx.add({ kind: 'rect', id: ctx.id('win'), layer: 'zones', x: wx - b, y: wy - b, w: ww + 2 * b, h: wh + 2 * b, fill: pal.bg });
  ctx.image(a, { x: wx, y: wy, w: ww, h: wh }, {}); ctx.occupied.push({ x: wx, y: wy, w: ww, h: wh });
  const env2 = { ...env, paint: { ...env.paint, ink: ctx.textColor(field, 300), soft: ctx.textColor(field, 40), on: field, accent: ctx.textColor(field, 300) } };
  const mw = left ? g.xr(g.cols - nw) - g.x(0) : g.xr(g.cols) - g.x(nw);
  const mx = left ? g.x(0) : g.x(nw);
  // a short Han line goes vertical in the margin; when it is not the title, the title takes the room above the window
  const titleZh = copy.title.lang === 'zh';
  const cn = titleZh ? copy.title.t : copy.cn;
  if (cn && Array.from(cn).length <= 10 && !env.land) {
    const k = Math.min(mw * 0.9, (wh * 0.95) / Array.from(cn).length);
    const L = lay(env2, col([lit(cn, 1, { face: 'display', dir: 'v', w: titleZh ? 'black' : 'medium', lead: 1.02, of: titleZh ? 'title' : 'title.cn' })]), titleZh ? k : k * 0.6);
    if (L) { emit(ctx, L, mx + (mw - L.w) / 2, wy, env2.paint, titleZh ? 'big.main' : 'small.main'); env.used.add(cn); }
  }
  if (!env.used.has(copy.title.t) && !env.land) placeMain(env2, { x: m, y: g.mt, w: W - 2 * m, h: wy - g.gut - g.mt }, { al: left ? 'start' : 'end', va: 'bottom' });
  if (env.land) placeMain(env2, { x: mx, y: g.mt, w: mw, h: H * 0.62 }, { al: 'start', va: 'top' });
  aux(env2, { x: env.land ? mx : m, y: env.land ? H - g.mb - env.tiny * 6 : wy + wh + g.gut, w: env.land ? mw : W - 2 * m, h: env.land ? env.tiny * 6 : H - g.mb - (wy + wh + g.gut) }, ['pairs', 'corners', 'columns', 'leaders']);

}

/** the picture takes one half (bleeding), the type the other half on the grid */
export function split(env: PageEnv) {
  const { ctx, W, H, g } = env;
  const a = env.pics[0];
  const k = ctx.rg.pick([0.5, 0.56, 0.62]);
  const first = ctx.rng.chance(0.5);
  // the picture bleeds off three edges and stops on a column (landscape) or row (portrait) line
  let fr: Rect, T: Rect;
  if (env.land) {
    const n = Math.max(2, Math.min(g.cols - 2, g.colsOf(k)));
    fr = first ? { x: 0, y: 0, w: g.xr(n), h: H } : { x: g.x(g.cols - n), y: 0, w: W - g.x(g.cols - n), h: H };
    T = first ? { x: g.x(n), y: g.mt, w: g.xr(g.cols) - g.x(n), h: H - g.mt - g.mb } : { x: g.x(0), y: g.mt, w: g.xr(g.cols - n) - g.x(0), h: H - g.mt - g.mb };
  } else {
    const j = first ? g.rowAt(k) : g.rowAt(1 - k);
    fr = first ? { x: 0, y: 0, w: W, h: g.yb(j) } : { x: 0, y: g.y(j), w: W, h: H - g.y(j) };
    T = first ? { x: g.x(0), y: g.y(j), w: g.xr(g.cols) - g.x(0), h: H - g.mb - g.y(j) } : { x: g.x(0), y: g.mt, w: g.xr(g.cols) - g.x(0), h: g.yb(j) - g.mt };
  }
  ctx.image(a, fr, ctx.rd.chance(0.3) ? { filter: { grayscale: true, contrast: 1.05 } } : {}); ctx.occupied.push(fr);
  const auxH = Math.min(T.h * 0.28, env.tiny * 7);
  const main = placeMain(env, { ...T, h: T.h - auxH - g.gut }, { al: ctx.rt.chance(0.7) ? 'start' : 'end', va: ctx.rt.pick(['top', 'center', 'bottom'] as const) });
  if (main) aux(env, { x: T.x, y: T.y + T.h - auxH, w: T.w, h: auxH }, ['columns', 'pairs', 'leaders', 'handle', 'corners']);
}

// ---------------------------------------------------------------- without a picture

/** the title fills 55–80 % of the page as a justified / closed block; a signature footer (WX type cards) */
export function typeFill(env: PageEnv) {
  const { W, H, m, g } = env;
  const r = placeMain(env, { x: m, y: g.mt, w: W - 2 * m, h: g.ybNear(H * (env.land ? 0.74 : 0.7)) - g.mt }, { al: env.ctx.rt.pick(['start', 'center'] as const), va: 'top', scale: 'giant', only: ['justified-brick', 'badge-close', 'cn-en-justify', 'display-en', 'staircase', 'flush-stack', 'centred-stack'] });
  const y = r ? r.box.y + r.box.h + g.gut : H * 0.75;
  aux(env, { x: m, y: Math.max(y, H - g.mb - env.tiny * 7), w: W - 2 * m, h: Math.min(env.tiny * 7, H - g.mb - y) }, ['corners', 'centred', 'pairs', 'columns']);
}

/** a Latin title as architecture: two lines, short then long, the long one justified; the Han title small and vertical */
export function latinArch(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const en = copy.title.lang === 'en' ? copy.title.t : copy.en;
  if (!en || en.split(/\s+/).length < 2) return typeFill(env);
  const pb = pickBreak(ctx.rt, en, ['short-long']);
  if (pb.lines.length !== 2) return typeFill(env);
  const lower = ctx.rt.chance(0.6);
  const f = (s: string) => (lower ? s.toLowerCase() : s);
  const L = lay(env, col([lit(f(pb.lines[0]), 1, { face: 'display', w: ctx.rt.chance(0.5) ? 'regular' : 'bold', track: -25, of: copy.title.lang === 'en' ? 'title' : 'title.en' }), lit(f(pb.lines[1]), 1, { fit: 'width', w: 'bold', track: -25, of: copy.title.lang === 'en' ? 'title' : 'title.en' })], { gap: 0.05 }), 100);
  if (!L) return typeFill(env);
  const target = W - 2 * m;
  // the block spans the measure, hangs from a row line, and leaves the foot room for the aux band
  const g = env.g;
  let y = g.y(g.rowAt(ctx.rng.pick([0.5, 0.55, 0.42])));
  const foot = env.tiny * 6 + g.gut;
  const maxH = H - g.mb - foot - g.mt - env.tiny * 4;
  const A = Math.min((100 * target) / L.w, (100 * maxH) / L.h);
  const L2 = lay(env, col([lit(f(pb.lines[0]), 1, { face: 'display', w: 'bold', track: -25, of: copy.title.lang === 'en' ? 'title' : 'title.en' }), lit(f(pb.lines[1]), 1, { face: 'display', fit: 'width', w: 'bold', track: -25, of: copy.title.lang === 'en' ? 'title' : 'title.en' })], { gap: 0.05 }), A)!;
  if (y + L2.h > H - g.mb - foot) y = Math.max(g.mt + env.tiny * 4, H - g.mb - foot - L2.h);
  const box = put(env, L2, m, y);
  env.used.add(en);
  // the Han name small, vertical, top-right; a hairline from the short line to the margin
  const cn = copy.title.lang === 'zh' ? copy.title.t : copy.cn;
  if (cn) { const cL = lay(env, col([lit(cn, 1, { dir: 'v', w: 'medium', of: copy.title.lang === 'zh' ? 'title' : 'title.cn' })]), Math.min(W * 0.07, (y - m * 2) / Math.max(1, Array.from(cn).length))); if (cL) { put(env, cL, W - m - cL.w, m); env.used.add(cn); } }
  if (ctx.rd.chance(0.6)) hair(env, m, box.y - env.g.gut, W - m, box.y - env.g.gut);
  aux(env, { x: m, y: box.y + box.h + env.g.gut, w: W - 2 * m, h: H - env.g.mb - (box.y + box.h + env.g.gut) }, ['columns', 'leaders', 'handle']);
  aux(env, { x: m, y: env.g.mt, w: env.g.span(env.g.colsOf(0.6)), h: Math.min(y - env.g.gut * 2 - env.g.mt, env.tiny * 8) }, ['corners', 'handle']);
}

/** the gate: the title justified across the top, a hairline, two vertical columns (Wang Zhi-Hong vertical_frame) */
export function gate(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const t = copy.title.t;
  const L1 = lay(env, col([lit(t, 1, { w: 'medium', of: 'title' })]), 100);
  if (!L1) return typeFill(env);
  const target = W - 2 * m;
  const k = Math.min(W * 0.12, ((100 * target) / L1.w) * 0.8);
  const L = lay(env, col([lit(t, 1, { w: 'medium', of: 'title' }), { t: 'mark', m: 'rule', k: 0.02, len: 'fill' } as GNode], { gap: 0.4 }), k);
  if (!L) return typeFill(env);
  // letterspace the title to the full width
  const tracked = lay(env, col([{ t: 'box', dir: 'col', kids: [{ t: 'mark', m: 'rule', k: 0.001, len: target / k }, lit(t, 1, { face: 'display', fit: 'track', w: 'medium', of: 'title' })], gap: 0 } as BoxNode]), k) ?? L;
  const box = put(env, tracked, m, m * 1.3);
  env.used.add(t);
  const ry = box.y + box.h + m * 0.5;
  hair(env, m, ry, W - m, ry);
  // the two verticals on column lines (the outer columns hold the side texts)
  const g = env.g, ce = Math.max(1, g.colsOf(0.2));
  const x1 = g.x(ce) - g.gut / 2, x2 = g.xr(g.cols - ce) + g.gut / 2;
  hair(env, x1, ry, x1, H * 0.64); hair(env, x2, ry, x2, H * 0.64);
  // side columns: the subtitle (or the first two items) vertical at a smaller size
  const sides = [copy.sub?.t, copy.items[0]?.main.t].filter((s): s is string => !!s && han(s)).slice(0, 2);
  sides.forEach((s, i) => {
    const sk = Math.min(W * 0.06, (H * 0.6 - ry) / Math.max(1, Array.from(s).length) * 0.9);
    const sL = lay(env, col([lit(s, 1, { dir: 'v', w: 'regular', max: 14, of: i ? 'item' : 'sub' })]), sk);
    if (sL) { put(env, sL, i ? x2 + (W - m - x2 - sL.w) / 2 : m + (x1 - m - sL.w) / 2, ry + m * 0.6, 'small.main'); env.used.add(s); }
  });
  aux(env, { x: x1 + m * 0.6, y: ry + m * 0.6, w: x2 - x1 - m * 1.2, h: H * 0.64 - ry - m }, ['leaders', 'handle', 'centred']);
  aux(env, { x: m, y: H * 0.64 + m, w: W - 2 * m, h: H - H * 0.64 - m * 2 }, ['corners', 'pairs', 'columns']);
}

/** title characters on a sparse module grid; empty cells hold a label or a circle (Wang Zhi-Hong scattered_grid) */
export function scattered(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const chars = Array.from(copy.title.t.replace(/\s/g, ''));
  if (!han(copy.title.t) || chars.length < 3 || chars.length > 8 || env.land) return typeFill(env);
  const cols = 3, pitch = (W - 2 * m) / cols;
  const bold = ctx.rt.chance(0.6);
  const k = bold ? pitch * 0.66 : pitch * 0.34;
  const rows = Math.ceil((chars.length + 2) / cols);
  const empties = new Set<number>();
  while (empties.size < rows * cols - chars.length) empties.add(ctx.rng.int(1, rows * cols - 1));
  let ci = 0;
  const y0 = m * 2.2;
  for (let cell = 0; cell < rows * cols && ci < chars.length; cell++) {
    const x = m + (cell % cols) * pitch, y = y0 + Math.floor(cell / cols) * pitch;
    if (empties.has(cell)) {
      if (ctx.rd.chance(0.35)) ctx.add({ kind: 'circle', id: ctx.id('sc'), layer: 'shapes', cx: x + k / 2, cy: y + k / 2, r: k * 0.42, fill: env.paint.accent });
      continue;
    }
    const L = lay(env, col([lit(chars[ci++], 1, { face: 'display', w: bold ? 'black' : 'regular', of: 'title' })]), k);
    if (L) put(env, L, x, y);
  }
  env.used.add(copy.title.t);
  const by = y0 + rows * pitch + m * 0.2;
  placeMain(env, { x: m, y: by, w: W - 2 * m, h: H - by - m * 4 }, { al: 'start', va: 'top', scale: 'quiet', only: ['two-level', 'single-axis', 'flush-stack', 'cn-en-justify'] });
  aux(env, { x: m, y: H - m - env.tiny * 5, w: W - 2 * m, h: env.tiny * 5 }, ['leaders', 'corners', 'pairs']);
}

/** a hairline form: label / value cells, one giant numeral (Wang Zhi-Hong info_form, for ≥ 4 info groups) */
export function infoForm(env: PageEnv) {
  const { ctx, W, H, m, copy } = env;
  const items = copy.items.slice(0, 6);
  if (items.length < 4) return typeFill(env);
  const top = placeMain(env, { x: m, y: m * 1.4, w: W - 2 * m, h: H * 0.42 }, { al: 'start', va: 'top', only: ['flush-stack', 'two-level', 'number-lock', 'date-group', 'kicker-title', 'justified-brick'] });
  const y0 = (top ? top.box.y + top.box.h : H * 0.45) + m;
  const rowsN = Math.ceil(items.length / 2);
  const rh = (H - m - y0) / rowsN;
  // the form's middle line on a column edge (5 columns: 3 + 2, an asymmetric form)
  const mid = env.g.x(Math.ceil(env.g.cols / 2)) - env.g.gut / 2;
  const cw = mid - m;
  for (let i = 0; i < items.length; i++) {
    const r = Math.floor(i / 2), c = i % 2;
    const x = c ? mid + env.g.gut / 2 : m, y = y0 + r * rh;
    if (c === 0) hair(env, m, y, W - m, y);
    const it = items[i];
    const L = lay(env, col([it.note ? lit(it.note.t, 1, { case: 'upper', w: 'medium', track: 60, max: 22 }) : null, lit(it.main.t, 2.4, { w: 'bold', max: 16, of: 'item' })], { gap: 0.5 }), env.tiny);
    if (L && L.h < rh * 0.92) { put(env, L, x + env.tiny * 0.4, y + env.tiny * 0.8, 'small.main'); env.used.add(it.main.t); }
  }
  hair(env, mid, y0, mid, H - env.g.mb);
}

/** colour masses behind a closed text block (色块底部): organic blobs or rotated squares */
export function colourMass(env: PageEnv) {
  const { ctx, W, H, m } = env;
  const pal = ctx.pal;
  const cols = [pal.accent, pal.alt, ...pal.fills].filter((c, i, a) => c && c !== pal.bg && a.indexOf(c) === i && wcag(c, pal.bg) > 1.2).slice(0, 4);
  const kind = ctx.rd.weighted({ blobs: 2, squares: 1.4 });
  const cx = W * 0.5, cy = H * (env.land ? 0.5 : 0.46);
  const R = Math.min(W, H) * 0.3;
  cols.forEach((c, i) => {
    const a = (i / cols.length) * Math.PI * 2 + ctx.rd.range(0, 1);
    const x = cx + Math.cos(a) * R * 0.55, y = cy + Math.sin(a) * R * 0.45;
    if (kind === 'blobs') ctx.add({ kind: 'circle', id: ctx.id('blob'), layer: 'shapes', cx: x, cy: y, r: R * ctx.rd.range(0.45, 0.7), fill: c, opacity: 0.92 });
    else {
      // a square rotated 10–35°, its corners computed (path nodes carry no transform)
      const s = R * ctx.rd.range(0.7, 1.0), q = (ctx.rd.range(10, 35) * Math.PI) / 180;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + (u * s * Math.cos(q) - v * s * Math.sin(q)) / 2, y + (u * s * Math.sin(q) + v * s * Math.cos(q)) / 2]);
      ctx.add({ kind: 'path', id: ctx.id('sq'), layer: 'shapes', d: `M${pts.map((p) => p.join(' ')).join('L')}Z`, fill: c, opacity: 0.92 });
    }
  });
  placeMain(env, { x: m * 1.5, y: H * 0.18, w: W - 3 * m, h: H * 0.56 }, { al: 'start', va: 'center', only: ['badge-close', 'staircase', 'justified-brick', 'cn-en-justify'] });
  aux(env, { x: m, y: H - m - env.tiny * 6, w: W - 2 * m, h: env.tiny * 6 }, ['corners', 'columns']);
  aux(env, { x: m, y: m, w: W - 2 * m, h: env.tiny * 6 }, ['corners', 'handle']);
}

// ---------------------------------------------------------------- with several pictures

/** 2–4 pictures in one row band on the grid (a contact strip / a triptych), equal widths, one gutter apart; the main
 *  group above or below the strip shares its left edge; captions hang from each frame when the copy has a programme */
export function strip(env: PageEnv) {
  const { ctx, W, H, m, g, copy } = env;
  const pics = env.pics.slice(0, 4);
  if (pics.length < 2) return photoBand(env);
  // frames per row: what divides the columns best
  const fits = [4, 3, 2].filter((n) => n <= pics.length && g.cols / n >= 1);
  const n = fits.find((k) => g.cols % k === 0) ?? fits[fits.length - 1];
  const per = Math.floor(g.cols / n);
  const c0 = Math.floor((g.cols - per * n) / 2);
  const fw = g.span(per);
  const ar = pics.slice(0, n).reduce((a, p) => a + Math.max(0.6, Math.min(1.6, p.w / p.h)), 0) / n;
  const typeTop = ctx.rng.chance(0.55);
  // the strip hangs from a row line (below the type) or from the top margin (above it); its foot on a row's bottom line
  const minRoom = H * 0.22, auxH0 = env.tiny * 6;
  let j0 = typeTop ? g.rowAt(ctx.rg.pick(env.land ? [0.42, 0.48] : [0.4, 0.46, 0.52])) : 0;
  while (typeTop && j0 < g.rows - 1 && g.y(j0) - g.gut - g.mt < minRoom) j0++;
  const y0 = g.y(j0);
  // the foot on a row end that leaves the type (below) or the aux band (above) its room
  const limit = H - g.mb - auxH0 - g.gut - (typeTop ? 0 : minRoom);
  let fh = g.ybNear(Math.min(y0 + Math.min(fw / ar, H * (env.land ? 0.48 : 0.36)), limit), j0) - y0;
  if (y0 + fh > limit) fh = g.ybUnder(limit, j0) - y0;
  const frames = pics.slice(0, n).map((p, i) => ({ p, r: { x: g.x(c0 + i * per), y: y0, w: fw, h: Math.max(fh, g.rowH) } }));
  const gray = ctx.rd.chance(0.3);
  for (const f of frames) picture(env, f.p, f.r, { gray });
  const fb = frames[0].r.y + frames[0].r.h;
  // captions: the programme's items, one under each frame, flush with its left edge
  const its = copy.items.filter((i) => !env.used.has(i.main.t));
  let capH = 0;
  if (its.length >= n && ctx.rt.chance(0.7)) {
    frames.forEach((f, i) => {
      const L = lay(env, col([lit(its[i].main.t, 1.2, { w: 'bold', max: 18, of: 'item' }), its[i].note ? lit(its[i].note!.t, 1, { max: 26 }) : null], { gap: 0.25 }), env.tiny);
      if (L && L.w < fw) { put(env, L, f.r.x, fb + env.tiny * 0.8, 'small.main'); env.used.add(its[i].main.t); capH = Math.max(capH, L.h + env.tiny * 0.8); }
    });
  }
  const below = fb + capH + g.gut;
  if (typeTop) {
    placeMain(env, { x: g.x(0), y: g.mt, w: g.xr(g.cols) - g.x(0), h: y0 - g.gut - g.mt }, { al: 'start', va: 'bottom' });
    aux(env, { x: m, y: below, w: W - 2 * m, h: H - g.mb - below }, ['pairs', 'columns', 'corners', 'leaders']);
  } else {
    const auxH = env.tiny * 6;
    placeMain(env, { x: g.x(0), y: below, w: g.xr(g.cols) - g.x(0), h: H - g.mb - auxH - g.gut - below }, { al: 'start', va: 'top' });
    aux(env, { x: m, y: H - g.mb - auxH, w: W - 2 * m, h: auxH }, ['corners', 'columns', 'pairs']);
  }
}

/** one large picture and one or two small ones stacked beside it on the same row lines; the type takes the rest */
export function mosaic(env: PageEnv) {
  const { ctx, W, H, m, g } = env;
  const pics = env.pics.slice(0, 3);
  if (pics.length < 2 || g.cols < 3) return strip(env);
  const k = pics.length - 1;
  const bigLeft = ctx.rng.chance(0.6);
  const cb = Math.max(2, Math.min(g.cols - 1, g.colsOf(ctx.rg.pick([0.6, 0.67, 0.75]))));
  const gray = ctx.rd.chance(0.25);
  if (env.land) {
    // the big picture bleeds off one side over the full height; the other columns: the type on top, the small pictures below
    const big = bigLeft ? { x: 0, y: 0, w: g.xr(cb), h: H } : { x: g.x(g.cols - cb), y: 0, w: W - g.x(g.cols - cb), h: H };
    picture(env, pics[0], big, { gray });
    const tx = bigLeft ? g.x(cb) : g.x(0), tw = bigLeft ? g.xr(g.cols) - g.x(cb) : g.xr(g.cols - cb) - g.x(0);
    const js = g.rowAt(0.55);
    const sw = (tw - (k - 1) * g.gut) / k;
    pics.slice(1).forEach((p, i) => picture(env, p, { x: tx + i * (sw + g.gut), y: g.y(js), w: sw, h: H - g.mb - g.y(js) }, { gray }));
    placeMain(env, { x: tx, y: g.mt, w: tw, h: g.y(js) - g.gut - g.mt }, { al: 'start', va: 'top' });
    return;
  }
  // portrait: the mosaic hangs from a row line; the small frames split the big one's height
  const typeTop = ctx.rng.chance(0.5);
  const minRoom = H * 0.22, auxH0 = env.tiny * 6;
  let j0 = typeTop ? g.rowAt(ctx.rg.pick([0.36, 0.42])) : 0;
  while (typeTop && j0 < g.rows - 1 && g.y(j0) - g.gut - g.mt < minRoom) j0++;
  const y0 = g.y(j0);
  const limit = H - g.mb - auxH0 - g.gut - (typeTop ? 0 : minRoom);
  let bigH = g.ybNear(Math.min(y0 + H * ctx.rg.pick([0.42, 0.48]), limit), j0) - y0;
  if (y0 + bigH > limit) bigH = g.ybUnder(limit, j0) - y0;
  const big = { x: bigLeft ? g.x(0) : g.x(g.cols - cb), y: y0, w: g.span(cb), h: bigH };
  picture(env, pics[0], big, { gray });
  const sx = bigLeft ? g.x(cb) : g.x(0), sw = g.span(g.cols - cb);
  const sh = (bigH - (k - 1) * g.gut) / k;
  pics.slice(1).forEach((p, i) => picture(env, p, { x: sx, y: y0 + i * (sh + g.gut), w: sw, h: sh }, { gray }));
  const fb = y0 + bigH + g.gut;
  if (typeTop) {
    placeMain(env, { x: g.x(0), y: g.mt, w: g.xr(g.cols) - g.x(0), h: y0 - g.gut - g.mt }, { al: 'start', va: 'bottom' });
    aux(env, { x: m, y: fb, w: W - 2 * m, h: H - g.mb - fb }, ['pairs', 'columns', 'leaders']);
  } else {
    const auxH = env.tiny * 6;
    placeMain(env, { x: g.x(0), y: fb, w: g.xr(g.cols) - g.x(0), h: H - g.mb - auxH - g.gut - fb }, { al: ctx.rt.chance(0.7) ? 'start' : 'end', va: 'top' });
    aux(env, { x: m, y: H - g.mb - auxH, w: W - 2 * m, h: auxH }, ['corners', 'columns']);
  }
}
