// Phase 18: the `build` composition — a page built the course's way: background + subject + main text group (a
// construction from the library) + auxiliary info. (First cut: the text-group engine on a quiet page.)
import type { Ctx } from '../gen/ctx';
import { emptySem, type SceneSemantics } from '../p8/semantic';
import { strong, accentOn } from '../gen/comps3';
import { wcag } from '../color/contrast';
import { copyOf } from './copy';
import { LIBRARY } from './library';
import { slotText } from './copy';
import { realize, emit, type Paint } from './realize';
import type { Construction, GNode } from './types';
import type { ImageNode, SceneNode, TextNode } from '../types';
import { photoBand, fullBleed, centreFrame, plate, giantBlock, quietEmblem, totem, zone, type PageEnv } from './page';
import { openSide, masthead, windowInset, split, typeFill, latinArch, gate, scattered, infoForm, colourMass, strip, mosaic } from './pages2';
import { makeGrid } from './grid';
import { textContrast } from '../gen/quality';
import type { ImageAsset } from '../gen/ctx';

/** the page archetypes, drawn by the placement stream; `pic` = needs a picture (false = for type-only pages) */
export const ARCHETYPES = {
  photoBand: { run: photoBand, pic: true, wt: 1 },
  fullBleed: { run: fullBleed, pic: true, wt: 1.1 },
  openSide: { run: openSide, pic: true, wt: 1.3 },
  masthead: { run: masthead, pic: true, wt: 0.9 },
  centreFrame: { run: centreFrame, pic: true, wt: 1 },
  windowInset: { run: windowInset, pic: true, wt: 0.8 },
  split: { run: split, pic: true, wt: 0.9 },
  plate: { run: plate, pic: true, wt: 0.8 },
  giantBlock: { run: giantBlock, pic: false, wt: 1 },
  typeFill: { run: typeFill, pic: false, wt: 1.2 },
  latinArch: { run: latinArch, pic: false, wt: 0.8 },
  gate: { run: gate, pic: false, wt: 0.8 },
  scattered: { run: scattered, pic: false, wt: 0.8 },
  quietEmblem: { run: quietEmblem, pic: false, wt: 1 },
  totem: { run: totem, pic: false, wt: 0.9 },
  infoForm: { run: infoForm, pic: false, wt: 0.7 },
  colourMass: { run: colourMass, pic: false, wt: 0.8 },
  // several pictures on the grid
  strip: { run: strip, pic: true, wt: 1, multi: true },
  mosaic: { run: mosaic, pic: true, wt: 1, multi: true },
} satisfies Record<string, { run: (e: PageEnv) => void; pic: boolean; wt: number; multi?: boolean }>;
export type Archetype = keyof typeof ARCHETYPES;

export function paintFor(ctx: Ctx, on: string): Paint {
  const pal = ctx.pal;
  const ink = strong(ctx, on);
  const acc = accentOn(ctx, on, 2.6) ?? ink;
  const fillCol = wcag(pal.accent, on) > 1.5 ? pal.accent : ink;
  return { ink, accent: acc, soft: ctx.textColor(on, 40), on, onFill: strong(ctx, fillCol), fillCol };
}

/** constructions whose required slots the copy can fill */
export function usable(copy: ReturnType<typeof copyOf>): Construction[] {
  return LIBRARY.filter((c) => c.needs.every((s) => !!slotText(copy, s)));
}

export function build(ctx: Ctx): void {
  const { W, H, pal } = ctx;
  const sem: SceneSemantics = emptySem(); sem.strategy = 'build';
  (ctx as Ctx & { sem?: SceneSemantics }).sem = sem;
  const copy = copyOf(ctx);
  const on = pal.bg;
  const S = Math.min(W, H);
  const pics = ctx.on('images') && !ctx.plan.typeOnly ? ctx.images.slice() : [];
  // the grid layer: margins, columns, rows and gutter; every archetype reads its geometry from it
  const g = makeGrid(ctx.rg, W, H);
  const m = g.m;
  const env: PageEnv = { ctx, copy, W, H, S, tiny: Math.max(13, S * 0.015), paint: paintFor(ctx, on), on, m, land: W > H * 1.15, wide: W / H > 1.6, used: new Set(), pics, g, n: { main: 0, aux: 0 }, mains: [] };
  // an archetype set by hand (the param) wins over the replayed one; otherwise a replay keeps its archetype
  const pa = String(ctx.p.archetype ?? 'auto');
  const forced = pa !== 'auto' && pa in ARCHETYPES ? pa : ctx.forceKind?.startsWith('build:') ? ctx.forceKind.slice(6) : '';
  // a page with several pictures leans to the archetypes that show them all (multi); one picture never draws them
  const multi = (k: Archetype) => !!(ARCHETYPES[k] as { multi?: boolean }).multi;
  const names = (Object.keys(ARCHETYPES) as Archetype[]).filter((k) => (forced ? k === forced : ARCHETYPES[k].pic === pics.length > 0 && (!multi(k) || pics.length >= 2)));
  // session variety: an archetype used in the last draws is less likely (the last one much less)
  const rec = ctx.recent.slice(-4).reverse();
  const recW = (k: string) => (ctx.avoid?.kind === 'build:' + k ? 0.02 : 1) * ((i) => (i < 0 ? 1 : i === 0 ? 0.12 : i === 1 ? 0.4 : 0.7))(rec.indexOf('build:' + k));
  const pick = names.length ? (ctx.rng.weighted(names.map((k) => [k, ARCHETYPES[k].wt * recW(k) * (pics.length >= 2 && multi(k) ? 4 : 1)] as [string, number])) as Archetype) : 'totem';
  ARCHETYPES[pick].run(env);
  ensureFacts(env);
  sem.vars.archetype = { kind: 'free', value: pick };
  sem.vars.grid = { kind: 'free', value: `${g.cols}×${g.rows}` };
  if (env.mains.length) sem.vars.construction = { kind: 'free', value: env.mains.join('+') };
  // a real signature (brand / author line from the copy) is always set: a small label in a free corner
  const sig = ctx.texts.facts?.signature;
  if (sig && !env.used.has(sig)) {
    const L = realize({ ctx, copy }, { id: 'sig', zh: '', en: '', needs: [], shape: 'band', root: { t: 'box', dir: 'col', kids: [{ t: 'text', slot: 'lit', lit: sig, k: 1.3, w: 'medium', max: 28 }] } }, env.tiny);
    if (L) {
      const spots = [[W - m - L.w, H - g.mb * 0.6 - L.h], [W - m - L.w, g.mt * 0.6], [m, H - g.mb * 0.6 - L.h], [m, g.mt * 0.6]];
      const free = spots.find(([x, y]) => !ctx.occupied.some((o) => x < o.x + o.w && x + L.w > o.x && y < o.y + o.h && y + L.h > o.y)) ?? spots[0];
      emit(ctx, L, free[0], free[1], env.paint, 'small.main', 'sig');
      env.used.add(sig);
    }
  }
  backSmallText(env);
}

/** the last check of a built page: text set on a picture must read at WCAG contrast (4.5:1 small, 3:1 large) even where
 *  the picture is darkest or lightest under it. A unit gets the one ink that does; when none does, a
 *  solid tag goes under it. (Display type — a headline, large or quiet — is the outline pass's: a tag behind it would be a new design element.) */
function backSmallText(env: PageEnv) {
  const { ctx } = env;
  const nodes = ctx.nodes;
  const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
  const bg = ctx.pal.bg;
  const over = (b: { x: number; y: number; w: number; h: number }, n: { x: number; y: number; w: number; h: number }) => b.x < n.x + n.w && b.x + b.w > n.x && b.y < n.y + n.h && b.y + b.h > n.y;
  const units = new Map<string, number[]>();
  nodes.forEach((n, i) => { if (n.kind === 'text' && !n.rotate && !n.vertical && n.layer === 'text') { const k = n.unit ?? n.id; const l = units.get(k) ?? []; l.push(i); units.set(k, l); } });
  const inks = [env.paint.ink, ctx.pal.light, ctx.pal.dark, '#111111', '#f7f5f0'];
  const tags: { at: number; rect: SceneNode }[] = [];
  for (const idx of units.values()) {
    const ts = idx.map((i) => nodes[i] as TextNode);
    const size = Math.max(...ts.map((t) => t.size));
    // WCAG 3:1 large / 4.5:1 small, with a margin: the picture is read from its low-resolution colour map, which smooths
    // the fine dark and light detail that real pixels have
    const need = size >= ctx.u * 4 ? 3.75 : 5.4;
    // only text that sits on a picture drawn before it
    const under = nodes.slice(0, idx[0]).filter((n): n is ImageNode => n.kind === 'image' && !n.cutout && ts.some((t) => over(t.box, n)));
    if (!under.length) continue;
    const ux0 = Math.min(...ts.map((t) => t.box.x)), uy0 = Math.min(...ts.map((t) => t.box.y));
    const ubox = { x: ux0, y: uy0, w: Math.max(...ts.map((t) => t.box.x + t.box.w)) - ux0, h: Math.max(...ts.map((t) => t.box.y + t.box.h)) - uy0 };
    // the brightness map is coarse: on a busy part of a picture (fine dark and light detail) no ink is safe for this size
    const im = under[under.length - 1], a = assets.get(im.imageId);
    const busy = a ? zone(ctx, a, { x: im.x, y: im.y, w: im.w, h: im.h }, ubox).busy : 1;
    const worst = (fill: string) => Math.min(...ts.map((t, j) => textContrast(ctx, nodes, idx[j], t, fill, bg, assets, 0, 8)));
    if (busy <= 0.4) {
      if (worst(ts[0].fill) >= need) continue;
      const ok = inks.find((c) => worst(c) >= need);
      if (ok) { for (const t of ts) t.fill = ok; continue; }
    }
    if (size >= ctx.u * 9 || ts.some((t) => t.role === 'big.main')) continue;
    // a tag per cluster of adjacent nodes (a unit's parts can sit apart: a title shown in two places), never over other text
    const pad = env.tiny * 0.45;
    const order = idx.slice().sort((p, q) => nodes[p].kind === 'text' && nodes[q].kind === 'text' ? (nodes[p] as TextNode).box.y - (nodes[q] as TextNode).box.y || (nodes[p] as TextNode).box.x - (nodes[q] as TextNode).box.x : 0);
    const clusters: number[][] = [];
    for (const i of order) {
      const b = (nodes[i] as TextNode).box, near = (nodes[i] as TextNode).size * 0.7;
      const c = clusters.find((cl) => cl.some((j) => { const o = (nodes[j] as TextNode).box; return b.x < o.x + o.w + near && b.x + b.w + near > o.x && b.y < o.y + o.h + near && b.y + b.h + near > o.y; }));
      if (c) c.push(i); else clusters.push([i]);
    }
    const others = nodes.filter((n, i): n is TextNode => n.kind === 'text' && !idx.includes(i));
    for (const cl of clusters) {
      const cs = cl.map((i) => nodes[i] as TextNode);
      const x0 = Math.min(...cs.map((t) => t.box.x)) - pad, y0 = Math.min(...cs.map((t) => t.box.y)) - pad;
      const x1 = Math.max(...cs.map((t) => t.box.x + t.box.w)) + pad, y1 = Math.max(...cs.map((t) => t.box.y + t.box.h)) + pad * 1.4;
      const r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      if (others.some((o) => over(o.box, r))) continue;
      tags.push({ at: Math.min(...cl), rect: { kind: 'rect', id: ctx.id('btag'), layer: 'zones', ...r, fill: env.paint.on } });
      for (const t of cs) t.fill = env.paint.ink;
    }
  }
  // the tags go under their text (inserted from the back, so earlier indices stay valid)
  for (const t of tags.sort((a, b) => b.at - a.at)) nodes.splice(t.at, 0, t.rect);
}

/** real copy: every fact the user gave (each meta entry: a date, a venue, a price; the date) is on the page, whole. What
 *  the page did not show is set as a small block in a free corner — on a picture only where the picture carries type,
 *  otherwise on a solid tag */
function ensureFacts(env: PageEnv) {
  const { ctx, copy, W, H, g, m } = env;
  if (!copy.custom) return;
  const norm = (x: string) => x.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const texts = ctx.nodes.filter((n): n is TextNode => n.kind === 'text');
  // the shown text, joined per unit (a construction sets each line and script run as its own node)
  const units = new Map<string, string>();
  for (const t of texts) { const k = t.unit ?? t.id; units.set(k, (units.get(k) ?? '') + t.lines.map((l) => l.text).join('')); }
  const shown = [...units.values()].map(norm);
  const has = (x: string) => shown.some((u) => u.includes(norm(x)));
  const want: string[] = [];
  for (const f of copy.meta) if (!has(f.t) && !want.includes(f.t)) want.push(f.t);
  if (copy.date && !copy.meta.some((f) => f.t.includes(copy.date!)) && !has(copy.date)) want.push(copy.date);
  if (!want.length) return;
  const kids: GNode[] = want.map((t, i) => ({ t: 'text', slot: 'lit', lit: t, k: i === 0 ? 1.3 : 1, w: i === 0 ? 'bold' : 'medium', wrap: 26, lead: 1.2 }));
  const L = realize({ ctx, copy }, { id: 'facts', zh: '', en: '', needs: [], shape: 'band', root: { t: 'box', dir: 'col', gap: 0.35, kids } }, env.tiny);
  if (!L) return;
  want.forEach((t) => env.used.add(t));
  const pad = env.tiny * 0.6;
  const boxes = texts.map((t) => (t.rotate ? { x: t.box.x - t.size, y: t.box.y - 2000, w: t.size * 2, h: 2000 } : t.box));
  const hit = (r: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => r.x < b.x + b.w + pad && r.x + r.w + pad > b.x && r.y < b.y + b.h + pad && r.y + r.h + pad > b.y;
  const imgs = ctx.nodes.filter((n): n is ImageNode => n.kind === 'image' && !n.cutout);
  const spots: [number, number][] = [[m, H - g.mb - L.h], [W - m - L.w, H - g.mb - L.h], [m, g.mt], [W - m - L.w, g.mt]];
  // a free corner: on the paper when one is free; on a picture the facts sit on a solid tag (small text needs more contrast
  // than any part of a photo can promise)
  let best: { x: number; y: number; on: 'paper' | 'tag' } | null = null;
  for (const [x, y] of spots) {
    const r = { x, y, w: L.w, h: L.h };
    if (boxes.some((b) => hit(r, b))) continue;
    if (!imgs.some((im) => hit(r, im))) { best = { x, y, on: 'paper' }; break; }
    if (!best) best = { x, y, on: 'tag' };
  }
  if (!best) best = { x: spots[0][0], y: spots[0][1], on: 'tag' };
  if (best.on === 'tag') ctx.add({ kind: 'rect', id: ctx.id('ftag'), layer: 'zones', x: best.x - pad, y: best.y - pad, w: L.w + 2 * pad, h: L.h + 2 * pad, fill: env.paint.on });
  emit(ctx, L, best.x, best.y, env.paint, 'small.main', 'fx');
}
