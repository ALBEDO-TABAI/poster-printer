// Phase 8: conditional design grammars. Each strategy is a chain of coupled decisions where one choice propagates to
// the next (content → line breaks → silhouette → image position / crop → secondary density → ornament). When the
// content exceeds a strategy's capacity the grammar SWITCHES structure instead of shrinking type. Every element gets a
// role, info groups keep their order and move as units, relations / crops / variables / deliberate breaks are declared
// in `ctx.sem` (stored as scene.info.sem). Original rule systems; no poster is copied.
import type { Ctx, ImageAsset } from '../gen/ctx';
import type { Rect } from '../gen/grid';
import type { PT } from '../gen/pick';
import type { TextNode } from '../types';
import { rawText, hair } from '../gen/comps2';
import { strong, accentOn, condFam, zhHeavy } from '../gen/comps3';
import { canon, eyes } from '../gen/frame';
import { imageDrawRect } from '../render/svg';
import { wcag } from '../color/contrast';
import { semanticBreak, silhouette, silhouetteFor, opticalLeft, type Silhouette } from './typeset';
import { emptySem, unionBox, type SceneSemantics, type Role8 } from './semantic';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export type Strategy = 'typeled' | 'interleave' | 'programme' | 'exhibit' | 'zoned';
export const STRATEGIES: Strategy[] = ['typeled', 'interleave', 'programme', 'exhibit', 'zoned'];

// ---------------------------------------------------------------- content analysis
export interface Item { main: PT; note: PT }
export interface Content { hl: PT; sub: PT; items: Item[]; prose: PT | null; meta: PT[]; zh: boolean; hlChars: number; hlWords: number; times: boolean }
const isTime = (s: string) => /^\s*\d{1,2}[:.：]\d{2}/.test(s);
export function contentOf(ctx: Ctx): Content {
  const T = ctx.texts;
  const real = !!T.custom || !!T.facts;
  let items = T.groups.map((g, i) => ({ main: g.main, note: T.custom && T.customNotes && !T.customNotes[i] ? { t: '', lang: g.note.lang } : g.note })).filter((g) => g.main.t);
  if (T.custom && T.customItems !== undefined) items = items.slice(0, T.customItems);
  // synthetic copy: commit to a plausible amount of information (2–4 items) instead of all six filler groups
  if (!real) items = items.slice(0, ctx.rng.int(2, 4));
  const hl = T.headline;
  const zh = hl.lang === 'zh';
  const chars = Array.from(hl.t.replace(/\s/g, '')).length;
  const words = hl.t.split(/\s+/).filter(Boolean).length;
  const meta = T.meta.filter((m) => m.t).slice(0, T.custom ? T.customMeta ?? 0 : real ? 4 : 2);
  const prose = T.prose[0]?.t ? T.prose[0] : null; // custom prose replaces prose[0]
  return { hl, sub: T.sub, items, prose: real ? prose : null, meta, zh, hlChars: chars, hlWords: words, times: items.length >= 3 && items.filter((i) => isTime(i.note.t)).length >= items.length - 1 };
}

// ---------------------------------------------------------------- shared helpers
interface Out { sem: SceneSemantics; role(id: string, r: Role8): void }
function out(ctx: Ctx, strategy: Strategy): Out {
  const sem = emptySem(); sem.strategy = strategy;
  (ctx as Ctx & { sem?: SceneSemantics }).sem = sem;
  return { sem, role: (id, r) => { sem.roles[id] = r; } };
}
const display = (ctx: Ctx, zh: boolean, heavy: boolean) => {
  if (zh) return heavy ? zhHeavy(ctx, true) : { family: ctx.role('big.main', 'zh').family, weight: ctx.role('big.main', 'zh').weight };
  const r = ctx.role('big.main', 'en');
  if (!heavy || r.weight >= 600) return { family: r.family, weight: r.weight };
  return condFam(ctx);
};
/** set a headline as one text node per line (each line may carry its own size); returns ids + bbox */
function setHeadline(ctx: Ctx, o: Out, lines: string[], sil: Silhouette, box: Rect, fam: { family: string; weight: number }, zh: boolean, fill: string, size: number, align: 'start' | 'end' = 'start', layer: TextNode['layer'] = 'text') {
  const tr = zh ? 0.02 : lines.join('').length > 8 ? -0.015 : -0.025;
  const spec = (s: number) => ({ family: fam.family, weight: fam.weight, size: s, tracking: tr });
  const cap = zh ? 0.86 : ctx.measure.metrics(spec(100)).cap;
  const set = silhouette(lines, sil, box, spec, ctx.measure, { size, leading: zh ? 1.08 : 0.98, cap, zh, align });
  const ids: string[] = [];
  for (const l of set.lines) {
    const dx = l.size > ctx.u * 6 ? -opticalLeft(ctx.measure, l.text, spec(l.size)) : 0; // big type aligns on ink
    const n = rawText(ctx, { id: ctx.id('h8'), layer, role: 'big.main', text: l.text, lang: zh ? 'zh' : 'en', x: l.x + dx, y: l.y, size: l.size, family: fam.family, weight: fam.weight, fill, tracking: tr });
    o.role(n.id, 'headline'); ids.push(n.id);
  }
  const bb = unionBox(ids.map((id) => (ctx.nodes.find((n) => n.id === id) as TextNode).box));
  o.sem.groups.push({ id: 'headline', role: 'headline', members: ids, order: 'stack', box: bb });
  return { ids, box: bb, lines: set.lines };
}
/** an ordered info group: items as rows (time | name), a stack, or columns; returns null when it does not fit (capacity) */
function infoGroup(ctx: Ctx, o: Out, items: Item[], area: Rect, on: string, kind: 'stack' | 'columns' | 'list', size: number, gid = 'info'): Rect | null {
  if (!items.length) return { x: area.x, y: area.y, w: 0, h: 0 };
  // mutation I (info fragmented / cramped): the group changes its internal order (columns ↔ one list)
  if ((ctx.p as { p8flip?: number }).p8flip) kind = kind === 'columns' ? (items.length > 3 ? 'list' : 'stack') : items.length >= 3 ? 'columns' : kind;
  const { u } = ctx;
  const ink = ctx.textColor(on, size), soft = ctx.textColor(on, size * 0.8);
  const fam = ctx.role('small.main', items[0].main.lang);
  const nf = ctx.fonts.en['small.note'];
  const lead = size * 1.32;
  const ids: string[] = [];
  const zhOf = (t: string) => /[\u4e00-\u9fff]/.test(t);
  const put = (t: string, x: number, y: number, s: number, fill: string, f = fam, anchor: 'start' | 'end' = 'start') => {
    const n = rawText(ctx, { id: ctx.id('i8'), role: 'small.main', text: t, lang: zhOf(t) ? 'zh' : 'en', x, y, size: s, family: f.family, weight: f.weight, fill, anchor });
    (n as TextNode & { grp?: string }).grp = gid; o.role(n.id, 'info'); ids.push(n.id); return n;
  };
  if (kind === 'list') {
    const rowH = lead * 1.55;
    if (items.length * rowH > area.h + 1) return null;
    const tw = items.some((i) => isTime(i.note.t)) ? Math.max(...items.map((i) => ctx.measure.width(i.note.t, { family: nf.family, weight: nf.weight, size, tracking: 0 }))) + u * 3 : 0;
    let y = area.y;
    items.forEach((it, i) => {
      if (tw) put(it.note.t, area.x, y + size * 0.9, size, soft, { ...nf, weight: Math.max(500, nf.weight) } as never);
      const n = put(it.main.t, area.x + tw, y + size * 0.9, size * 1.12, ink);
      if (n.box.x + n.box.w > area.x + area.w) { n.size *= (area.x + area.w - n.box.x) / n.box.w; n.box.w = area.x + area.w - n.box.x; }
      if (i < items.length - 1) hair(ctx, area.x, y + rowH - lead * 0.25, area.x + area.w, y + rowH - lead * 0.25, 0.5);
      y += rowH;
    });
  } else if (kind === 'columns') {
    const nc = Math.min(items.length, area.w > u * 60 ? 4 : 3);
    const cw = area.w / nc;
    const rows = Math.ceil(items.length / nc);
    if (rows * lead * 3 > area.h + 1) return null;
    items.forEach((it, i) => {
      const x = area.x + (i % nc) * cw, y = area.y + Math.floor(i / nc) * lead * 3;
      const m = put(it.main.t, x, y + size * 0.9, size, ink);
      if (m.box.w > cw - u * 1.5) { const k = (cw - u * 1.5) / m.box.w; m.size *= k; m.box.w *= k; }
      if (it.note.t && !isTime(it.note.t)) put(it.note.t.split('\n')[0], x, y + size * 0.9 + lead, size * 0.8, soft);
      else if (it.note.t) put(it.note.t, x, y + size * 0.9 + lead, size * 0.8, soft);
    });
  } else {
    if (items.length * lead * 2.1 > area.h + 1) return null;
    let y = area.y;
    for (const it of items) {
      const m = put(it.main.t, area.x, y + size * 0.9, size, ink);
      if (m.box.w > area.w) { const k = area.w / m.box.w; m.size *= k; m.box.w *= k; }
      y += lead;
      if (it.note.t) { put(it.note.t.split('\n')[0], area.x, y + size * 0.72, size * 0.8, soft); y += lead * 0.95; }
      y += lead * 0.35;
    }
  }
  const box = unionBox(ids.map((id) => (ctx.nodes.find((n) => n.id === id) as TextNode).box));
  o.sem.groups.push({ id: gid, role: 'info', members: ids, order: kind === 'columns' ? 'grid' : kind === 'list' ? 'list' : 'stack', box });
  return box;
}
function line(ctx: Ctx, o: Out, pt: PT | null | undefined, x: number, y: number, size: number, on: string, role: Role8, anchor: 'start' | 'end' | 'middle' = 'start', rk = 'big.sub', maxW?: number) {
  if (!pt?.t) return null;
  const f = ctx.role(rk as never, pt.lang);
  let s = size;
  const w = ctx.measure.width(pt.t, { family: f.family, weight: f.weight, size: s, tracking: 0 });
  if (maxW && w > maxW) s *= maxW / w;
  const n = rawText(ctx, { id: ctx.id('e8'), role: rk, text: pt.t, lang: pt.lang, x, y, size: s, family: f.family, weight: f.weight, fill: ctx.textColor(on, s), anchor });
  o.role(n.id, role);
  return n;
}
/** subject shape class from the analysed bbox */
const shapeOf = (a: ImageAsset | null) => { if (!a?.subject) return 'scene'; const r = (a.subject.h * a.h) / (a.subject.w * a.w); return a.subject.w * a.subject.h > 0.7 ? 'scene' : r > 1.3 ? 'tall' : r < 0.77 ? 'wide' : 'round'; };
/** mean detail (busyness) of an image region given in image fractions */
function busy(a: ImageAsset, r: { x: number; y: number; w: number; h: number }) {
  if (!a.detail?.length) return 0.5;
  let s = 0, c = 0;
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const x = (i + 0.5) / 16, y = (j + 0.5) / 16; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { s += a.detail[j * 16 + i]; c++; } }
  return c ? s / c : 0.5;
}
const hasPic = (ctx: Ctx) => ctx.images.length > 0 && ctx.on('images') && !ctx.plan.typeOnly;

/** the R9 type scale: three levels 1 : ~3.5 : ~9 coupled to the headline size */
const levels = (ctx: Ctx, head: number) => { const ss = (ctx.num('smallScale') || 100) / 100; return { expl: clamp(head / 3.4, ctx.u * 1.8, ctx.u * 4.2), info: clamp(head / 9, ctx.u * 1.15, ctx.u * 1.9) * ss }; }; // info follows the smallScale control

// ---------------------------------------------------------------- 1. type-led
// headline length → semantic breaks → silhouette → image in the silhouette's negative space (crop with the frame) →
// info density → ornament only when there is quiet room for it
export function typeled(ctx: Ctx, from?: Strategy): void {
  const { W, H, u, pal } = ctx;
  const c = contentOf(ctx);
  const start = { n: ctx.nodes.length, occ: ctx.occupied.length };
  const o = out(ctx, 'typeled');
  const on = pal.bg;
  const C = ctx.grid.content;
  const land = W > H * 1.15;
  // 1. how many lines the content asks for
  const k = c.zh ? (c.hlChars <= 3 ? 1 : c.hlChars <= 8 ? 2 : 3) : c.hlWords <= 1 ? 1 : c.hlWords <= 3 ? Math.min(c.hlWords, 3) : c.hlWords <= 6 ? 3 : 4;
  const fam = display(ctx, c.zh, true);
  const wf = (s: string) => ctx.measure.width(s, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 });
  const profile = ctx.rng.pick(['balanced', 'descending', 'any'] as const);
  const lines = semanticBreak(c.hl.t, { k, profile, width: wf }) ?? [c.hl.t];
  const sil = silhouetteFor(lines, wf, () => ctx.rng.next());
  o.sem.vars.lines = { kind: 'coupled', value: lines.length, from: 'headline.length' };
  o.sem.vars.silhouette = { kind: 'coupled', value: sil, from: 'lines.profile' };
  // 2. size: the widest line fills the measure; capacity = the display size must stay a display size
  const measure = land ? C.w * ctx.rng.range(0.55, 0.68) : C.w;
  const widest = Math.max(...lines.map(wf)) / 100;
  let size = measure / widest;
  const capH = (c.zh ? 0.86 : 0.72) * size * (1 + (lines.length - 1) * 1.05);
  const maxH = H * (land ? 0.72 : 0.5);
  if (capH > maxH) size *= maxH / capH;
  if (size < u * 7.5 && from !== 'programme' && c.items.length >= 4) return programme(ctx, 'typeled'); // too much copy for a type-led poster: switch
  // 3. where the headline sits decides where the image can go
  const top = ctx.rng.chance(0.55);
  const hb = { x: C.x, y: top ? C.y + u * 2 : C.y, w: measure, h: maxH };
  const align = land && ctx.rng.chance(0.3) ? 'end' : 'start';
  if (align === 'end') hb.x = C.x + C.w - measure;
  const ink = strong(ctx, on);
  const accent = accentOn(ctx, on, 2.6);
  const hlFill = accent && ctx.rng.chance(0.3) ? accent : ink;
  // dry layout to know the height, then place top or bottom
  const dry = silhouette(lines, sil, hb, (s) => ({ family: fam.family, weight: fam.weight, size: s, tracking: 0 }), ctx.measure, { size, leading: c.zh ? 1.08 : 0.98, cap: c.zh ? 0.86 : 0.72, zh: c.zh });
  if (!top) hb.y = C.y + C.h - dry.h;
  const head = setHeadline(ctx, o, lines, sil, hb, fam, c.zh, hlFill, size, align);
  const lv = levels(ctx, Math.max(...head.lines.map((l) => l.size)));
  // 4–5 run as one coupled step: if the info does not fit, the image yields first; if it still does not fit, the
  // structure switches (programme) instead of shrinking the type
  const snap = { n: ctx.nodes.length, occ: ctx.occupied.length, sem: JSON.stringify(o.sem) };
  const restore = () => { ctx.nodes.length = snap.n; ctx.occupied.length = snap.occ; Object.assign(o.sem, JSON.parse(snap.sem)); };
  const place = (withImg: boolean) => {
    // 4. negative space of the silhouette: right of the short lines (step / wedge / ragged) or the opposite band
    const free: Rect = top ? { x: C.x, y: head.box.y + head.box.h + u * 4, w: C.w, h: C.y + C.h - (head.box.y + head.box.h) - u * 4 } : { x: C.x, y: C.y, w: C.w, h: head.box.y - C.y - u * 4 };
    const shortest = head.lines.reduce((a, l) => (l.w < a.w ? l : a), head.lines[0]);
    const side = !land && head.lines.length >= 2 && shortest.w < measure * 0.55 && sil !== 'block';
    const asset = withImg && hasPic(ctx) ? ctx.images[0] : null;
    let imgBox: Rect | null = null;
    if (asset) {
      const shape = shapeOf(asset);
      if (side && shape !== 'wide') {
        // tall / round subjects go beside the short line, top-aligned to it (anchor relation)
        const x = shortest.x + shortest.w + u * 4;
        imgBox = { x, y: shortest.y - shortest.size * 0.8, w: C.x + C.w - x, h: Math.min(free.h * 0.5 + shortest.size, H * 0.4) };
        if (imgBox.w < u * 18) imgBox = null;
      }
      if (!imgBox) {
        // band in the free space; its proportion follows the subject (wide subject → wide band, tall → narrow column)
        const hFrac = shape === 'tall' ? 0.9 : shape === 'wide' ? 0.6 : 0.75;
        const bh = free.h * hFrac - u * 2;
        const bw = shape === 'tall' ? Math.min(C.w * 0.55, bh * 0.8) : C.w;
        if (bh > u * 14) imgBox = { x: shape === 'tall' && ctx.rng.chance(0.5) ? C.x + C.w - bw : C.x, y: top ? free.y : free.y + free.h - bh - (free.h - bh) * 0.15, w: bw, h: bh };
      }
      if (imgBox) {
        const n = ctx.image(asset, imgBox);
        o.role(n.id, 'image');
        o.sem.crops.push({ node: n.id, protect: asset.subject });
        o.sem.relations.push({ type: 'align', a: head.ids[0], b: n.id, edge: 'left' });
        ctx.occupied.push(imgBox);
      }
    }
    // 5. secondary density follows what is left
    const rest: Rect = imgBox ? (top ? { x: C.x, y: imgBox.y + imgBox.h + u * 3, w: C.w, h: C.y + C.h - (imgBox.y + imgBox.h) - u * 3 } : { x: C.x, y: C.y, w: C.w, h: imgBox.y - C.y - u * 3 }) : free;
    const besideImg = imgBox && imgBox.x > C.x + u ? { x: C.x, y: imgBox.y, w: imgBox.x - C.x - u * 4, h: imgBox.h } : imgBox && imgBox.w < C.w * 0.7 ? { x: imgBox.x + imgBox.w + u * 4, y: imgBox.y, w: C.x + C.w - imgBox.x - imgBox.w - u * 4, h: imgBox.h } : null;
    const area = besideImg && besideImg.w > u * 22 && besideImg.h > rest.h ? besideImg : rest;
    let y = top ? area.y : area.y + area.h * 0.15;
    const ex = line(ctx, o, c.sub, area.x, y + lv.expl * 0.85, lv.expl, on, 'explanation', 'start', 'big.sub', area.w);
    if (ex) { o.sem.relations.push({ type: 'align', a: head.ids[0], b: ex.id, edge: 'left' }); y += ex.box.h + u * 3; }
    const kind = c.times ? 'list' : c.items.length >= 4 && area.w > u * 50 ? 'columns' : 'stack';
    let ib = infoGroup(ctx, o, c.items, { x: area.x, y, w: area.w, h: area.y + area.h - y }, on, kind, lv.info * (c.items.length <= 3 ? 1.35 : 1)); // few facts read as facts, not footnotes
    if (!ib && kind !== 'columns') ib = infoGroup(ctx, o, c.items, { x: area.x, y, w: area.w, h: area.y + area.h - y }, on, 'columns', lv.info);

    return { imgBox, ok: !!ib || !c.items.length };
  };
  let r = place(true);
  if (!r.ok && hasPic(ctx)) { restore(); r = place(false); o.sem.vars.imageYield = { kind: 'coupled', value: 'yes', from: 'info>capacity' }; }
  if (!r.ok && c.items.length >= 3 && from !== 'programme') { ctx.nodes.length = start.n; ctx.occupied.length = start.occ; return programme(ctx, 'typeled'); }
  const imgBox = r.imgBox;
  // 6. ornament only when the page has quiet room: one hairline + the meta, aligned to the headline's left edge
  const quiet = (W * H - (head.box.w * head.box.h) - (imgBox ? imgBox.w * imgBox.h : 0)) / (W * H);
  if (quiet > 0.45 && ctx.on('ornament') && c.meta[0]) {
    const my = top ? C.y + C.h : C.y + u * 1.5;
    const mn = line(ctx, o, c.meta[0], C.x, my, ctx.size('meta'), on, 'ornament', 'start', 'small.note');
    if (c.meta[1]) line(ctx, o, c.meta[1], C.x + C.w, my, ctx.size('meta'), on, 'ornament', 'end', 'small.note');
    if (mn) hair(ctx, C.x, top ? my - u * 2.5 : my + u * 1.5, C.x + C.w, top ? my - u * 2.5 : my + u * 1.5, 0.6);
  }
  o.sem.vars.headSize = { kind: 'free', value: size, range: [u * 7, u * 40] };
  o.sem.layers = ['ground', 'image', 'headline', 'info'];
}

// ---------------------------------------------------------------- 2. image-led: headline interleaved with the subject
// subject shape → frame → crop (subject scale + position) → headline line count and band at the subject's upper body →
// cut-out drawn over the headline (declared interleave) → info in the calmest region
export function interleave(ctx: Ctx): void {
  const { W, H, u } = ctx;
  const c = contentOf(ctx);
  const cand = ctx.images.find((a) => a.cutout && a.subject);
  if (!cand || !hasPic(ctx)) return typeled(ctx, 'interleave');
  // capacity: a long headline cannot be crossed by a subject and stay readable
  if ((c.zh && c.hlChars > 6) || (!c.zh && (c.hl.t.length > 16 || c.hlWords > 3))) return exhibit(ctx, 'interleave');
  const a = cand;
  ctx.images = [a, ...ctx.images.filter((x) => x !== a)];
  const o = out(ctx, 'interleave');
  const sj = a.subject!;
  // crop: subject height 60–80 % of the frame, centred or on an eye (offset)
  const frame = { x: 0, y: 0, w: W, h: H };
  const subjH = ctx.rng.range(0.6, 0.8);
  const s0 = Math.max(W / a.w, H / a.h);
  const zoom = clamp((subjH * H) / (sj.h * a.h * s0), 1, 2.4);
  const sx = ctx.rng.chance(0.6) ? 0.5 : ctx.rng.pick([0.38, 0.62]);
  const dw = a.w * s0 * zoom, dh = a.h * s0 * zoom;
  const cxImg = (sj.x + sj.w / 2) * dw, topImg = sj.y * dh;
  const ox = clamp(W * sx - cxImg, W - dw, 0), oy = clamp(H * (1 - subjH) * 0.75 - topImg, H - dh, 0);
  const fx = dw > W ? ox / (W - dw) : 0.5, fy = dh > H ? oy / (H - dh) : 0.5;
  const photo = ctx.image(a, frame, { fx, fy, zoom });
  o.role(photo.id, 'image');
  const dr = imageDrawRect(photo);
  const sTop = dr.y + sj.y * dr.h, sH = sj.h * dr.h, sL = dr.x + sj.x * dr.w, sW = sj.w * dr.w;
  o.sem.crops.push({ node: photo.id, protect: sj, busy: busy(a, sj) });
  // headline band crosses the subject's upper body
  const fam = display(ctx, c.zh, true);
  const k = c.zh ? 1 : c.hlWords >= 3 ? 2 : 1;
  const wf = (s: string) => ctx.measure.width(s, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 });
  const lines = semanticBreak(c.hl.t, { k, width: wf }) ?? [c.hl.t];
  const measure = W - u * 8;
  let size = measure / (Math.max(...lines.map(wf)) / 100);
  size = Math.min(size, H * 0.3 / lines.length);
  const by = clamp(sTop + sH * ctx.rng.range(0.12, 0.3), u * 6, H * 0.55);
  const lg = ctx.legible(a, frame, { x: u * 4, y: by, w: measure, h: size }, 200, true);
  const fill = lg.lum > 0.55 ? ctx.pal.dark : ctx.pal.light;
  const head = setHeadline(ctx, o, lines, 'stack', { x: u * 4, y: by, w: measure, h: H }, fam, c.zh, fill, size);
  // the cut-out goes over the headline only when it actually overlaps a part of it (depth, not erasure)
  const overlap = Math.max(0, Math.min(head.box.x + head.box.w, sL + sW) - Math.max(head.box.x, sL)) / head.box.w;
  if (overlap > 0.12 && overlap < 0.75) {
    const cut = ctx.image(a, frame, { fx, fy, zoom, cutout: true });
    o.role(cut.id, 'image');
    o.sem.breaks.push({ kind: 'interleave', nodes: [...head.ids, cut.id, photo.id], reason: 'the subject stands in front of the headline: depth, the word stays readable' });
    o.sem.layers = ['photo', 'headline', 'subject', 'info'];
  } else o.sem.layers = ['photo', 'headline', 'info'];
  o.sem.relations.push({ type: 'anchor', a: photo.id, b: head.ids[0], side: 'inside', gap: by - sTop });
  // info in the calmest corner band (detail map), coloured from the photo under it
  const lv = levels(ctx, size);
  const bands = [{ x: 0.04, y: 0.78, w: 0.45, h: 0.18 }, { x: 0.51, y: 0.78, w: 0.45, h: 0.18 }, { x: 0.04, y: 0.04, w: 0.45, h: 0.14 }];
  const toImg = (b: typeof bands[0]) => ({ x: (b.x * W - dr.x) / dr.w, y: (b.y * H - dr.y) / dr.h, w: (b.w * W) / dr.w, h: (b.h * H) / dr.h });
  const calm = bands.map((b) => ({ b, v: busy(a, toImg(b)) + (b.y < 0.5 && by < H * 0.3 ? 1 : 0) })).sort((p, q) => p.v - q.v)[0].b;
  const area = { x: calm.x * W, y: calm.y * H, w: calm.w * W, h: calm.h * H };
  const lg2 = ctx.legible(a, frame, area, 14, true);
  const on2 = lg2.lum > 0.5 ? '#f4f1ea' : '#141414';
  if (lg2.opacity > 0.15) { const sc = ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: area.x - u * 2, y: area.y - u * 2, w: area.w + u * 4, h: area.h + u * 4, fill: lg2.color, opacity: Math.min(0.55, lg2.opacity) }); o.role(sc.id, 'ornament'); }
  let y = area.y;
  const ex = line(ctx, o, c.sub, area.x, y + lv.expl * 0.6, lv.expl * 0.6, on2, 'explanation', 'start', 'big.sub', area.w);
  if (ex) y += ex.box.h + u * 2;
  infoGroup(ctx, o, c.items.slice(0, 4), { x: area.x, y, w: area.w, h: area.y + area.h - y + u * 3 }, on2, c.items.length > 3 ? 'columns' : 'stack', lv.info);
}

// ---------------------------------------------------------------- 3. info-led: the programme is the poster
// item count → headline scale (fewer rows, larger head) → list form (time column when the notes are times) →
// columns when the rows exceed the capacity → image only if room is left
export function programme(ctx: Ctx, from?: Strategy): void {
  const { W, H, u, pal } = ctx;
  const c = contentOf(ctx);
  if (c.items.length < 3 && from !== 'typeled') return typeled(ctx, 'programme');
  const o = out(ctx, 'programme');
  const on = pal.bg;
  const C = ctx.grid.content;
  const land = W > H * 1.15;
  const n = c.items.length;
  const fam = display(ctx, c.zh, true);
  const wf = (s: string) => ctx.measure.width(s, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 });
  const k = c.zh ? (c.hlChars > 6 ? 2 : 1) : c.hlWords >= 3 ? Math.min(3, c.hlWords) : c.hlWords;
  const lines = semanticBreak(c.hl.t, { k, profile: 'descending', width: wf }) ?? [c.hl.t];
  const headW = land ? C.w * 0.42 : C.w;
  let size = headW / (Math.max(...lines.map(wf)) / 100);
  size = Math.min(size, (H * (n > 6 ? 0.2 : 0.3)) / lines.length);
  const ink = strong(ctx, on);
  const head = setHeadline(ctx, o, lines, lines.length > 1 && ctx.rng.chance(0.4) ? 'block' : 'stack', { x: C.x, y: C.y + u, w: headW, h: H }, fam, c.zh, ink, size);
  const lv = levels(ctx, size);
  let y = head.box.y + head.box.h + u * 3;
  const colX = land ? C.x + C.w * 0.5 : C.x;
  const colW = land ? C.w * 0.5 : C.w;
  if (land) y = C.y + u;
  const ex = line(ctx, o, c.sub, land ? C.x : C.x, land ? head.box.y + head.box.h + u * 3 + lv.expl : y + lv.expl * 0.85, lv.expl, on, 'explanation', 'start', 'big.sub', land ? headW : C.w);
  if (ex && !land) y = ex.box.y + ex.box.h + u * 4;
  hair(ctx, colX, y - u * 1.5, colX + colW, y - u * 1.5, 0.8, ink);
  const area = { x: colX, y, w: colW, h: C.y + C.h - y - u * 6 };
  // the list is the evidence of a programme: it takes the size the room allows (rows × leading, longest act)
  const lf = ctx.role('small.main', c.items[0]?.main.lang ?? 'en');
  const longest = Math.max(1, ...c.items.map((it) => ctx.measure.width(it.main.t + (c.times ? '00:00   ' : ''), { family: lf.family, weight: lf.weight, size: 100, tracking: 0 }) / 100));
  const listSize = clamp(Math.min(area.h / (Math.max(1, n) * 1.32 * 1.2), (colW * 0.85) / longest), u * 1.8, u * 4.2) * Math.min(1.3, (ctx.num('smallScale') || 100) / 100);
  let ib = infoGroup(ctx, o, c.items, area, on, 'list', listSize, 'programme');
  if (!ib) { o.sem.vars.listSwitch = { kind: 'coupled', value: 'columns', from: 'items>capacity' }; ib = infoGroup(ctx, o, c.items, area, on, 'columns', listSize * 0.9, 'programme'); }
  // meta row: venue / price on the baseline of the content box
  const mr = C.y + C.h;
  c.meta.slice(0, 2).forEach((m, i) => line(ctx, o, m, i ? C.x + C.w : C.x, mr, ctx.size('note'), on, 'action', i ? 'end' : 'start', 'small.note'));
  // the image only takes leftover room: a strip anchored to the list's top right
  if (hasPic(ctx) && ib && !land) {
    const left = C.y + C.h - (ib.y + ib.h) - u * 10;
    if (left > H * 0.14) {
      const fr = { x: C.x, y: ib.y + ib.h + u * 4, w: C.w, h: left };
      const im = ctx.image(ctx.images[0], fr); o.role(im.id, 'image'); o.sem.crops.push({ node: im.id, protect: ctx.images[0].subject });
    }
  } else if (hasPic(ctx) && land) {
    const fr = { x: C.x, y: C.y + C.h * 0.55, w: headW, h: C.h * 0.38 };
    const im = ctx.image(ctx.images[0], fr); o.role(im.id, 'image');
  }
  o.sem.layers = ['ground', 'headline', 'programme', 'image'];
}

// ---------------------------------------------------------------- 4. balanced: the picture as an exhibited object
// picture proportion → frame on the canon block (35–55 % area) → title as a caption anchored to the frame edge →
// title size coupled to the frame width → info aligned to the frame's left edge at the foot
export function exhibit(ctx: Ctx, from?: Strategy): void {
  const { W, H, u, pal } = ctx;
  if (!hasPic(ctx)) return typeled(ctx, 'exhibit');
  const c = contentOf(ctx);
  const o = out(ctx, 'exhibit');
  const on = pal.bg;
  const a = ctx.images[0];
  const land = W > H * 1.15;
  const cn = canon(W, H, ctx.rng.chance(0.5)).block;
  const area = W * H * ctx.rng.range(0.3, 0.5);
  const ar = clamp(a.w / a.h, 0.62, 1.7);
  let fw = Math.sqrt(area * ar), fh = fw / ar;
  const maxW = land ? cn.w * 0.58 : cn.w, maxH = land ? cn.h : cn.h * 0.7;
  const k = Math.min(1, maxW / fw, maxH / fh); fw *= k; fh *= k;
  if (!land) { const room = H - u * 26 - cn.y; if (fh > room) { fw *= room / fh; fh = room; } } // a tall picture leaves the caption + info their room
  const E = eyes(W, H);
  // the frame's top-left sits on the canon block corner or its centre on an eye (stable vs offset)
  const stable = ctx.rng.chance(0.5);
  let fx = stable ? cn.x + (cn.w - fw) / 2 : clamp(E[ctx.rng.pick([0, 1])].x - fw / 2, cn.x, cn.x + cn.w - fw);
  if (land) fx = ctx.rng.chance(0.5) ? cn.x : cn.x + cn.w - fw;
  const fy = cn.y;
  const fr = { x: fx, y: fy, w: fw, h: fh };
  const im = ctx.image(a, fr);
  o.role(im.id, 'image'); o.sem.crops.push({ node: im.id, protect: a.subject });
  ctx.occupied.push(fr);
  // caption title: below the frame (portrait) or beside it (landscape), set to the frame width at most
  const fam = display(ctx, c.zh, false);
  const wf = (s: string) => ctx.measure.width(s, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 });
  const tb = land ? { x: fx <= cn.x + 1 ? fx + fw + u * 5 : cn.x, y: fy, w: cn.w - fw - u * 5, h: fh } : { x: fx, y: fy + fh + u * 4, w: fw, h: H - (fy + fh) - u * 12 };
  const k2 = c.zh ? (c.hlChars > 6 ? 2 : 1) : c.hlWords > 2 ? 2 : 1;
  const lines = semanticBreak(c.hl.t, { k: k2, width: wf }) ?? [c.hl.t];
  let size = Math.min(tb.w / (Math.max(...lines.map(wf)) / 100), u * (c.zh ? 9 : 10));
  if (from === 'interleave') size = Math.min(size * 1.15, tb.w / (Math.max(...lines.map(wf)) / 100));
  const head = setHeadline(ctx, o, lines, 'stack', tb, fam, c.zh, strong(ctx, on), size);
  o.sem.relations.push({ type: 'align', a: im.id, b: head.ids[0], edge: 'left' }, { type: 'anchor', a: im.id, b: head.ids[0], side: land ? 'right' : 'below', gap: u * 4 });
  const lv = levels(ctx, size);
  let y = head.box.y + head.box.h + u * 2.5;
  const ex = line(ctx, o, c.sub, tb.x, y + lv.expl * 0.6, Math.min(lv.expl, u * 2.2), on, 'explanation', 'start', 'big.sub', tb.w);
  if (ex) y = ex.box.y + ex.box.h + u * 4;
  // info row at the foot, aligned to the frame's left edge, columns on the frame's width
  const C = ctx.grid.content;
  const footY = C.y + C.h - u * 7;
  const ia = { x: land ? tb.x : fx, y: Math.max(y, footY - u * 2), w: land ? tb.w : Math.max(fw, C.w * 0.6), h: C.y + C.h - Math.max(y, footY - u * 2) };
  const ib = infoGroup(ctx, o, c.items, ia, on, c.items.length > 1 ? 'columns' : 'stack', lv.info);
  if (ib) o.sem.relations.push({ type: 'align', a: im.id, b: 'info', edge: 'left' });
  if (c.meta[0]) line(ctx, o, c.meta[0], C.x + C.w, C.y + u, ctx.size('meta'), on, 'ornament', 'end', 'small.note');
  if (wcag(pal.accent, on) > 2 && ctx.on('ornament') && ctx.rng.chance(0.5)) { const r = ctx.add({ kind: 'rect', id: ctx.id('mk'), layer: 'ornament', x: fx, y: fy - u * 2.2, w: u * 4, h: u * 0.6, fill: pal.accent }); o.role(r.id, 'ornament'); }
  o.sem.layers = ['ground', 'image', 'caption', 'info'];
}


// ---------------------------------------------------------------- 5. layout-first picture: type in the declared zones
// (phase 9) the picture was generated with its empty zones planned (manifest `zones`): full bleed, the crop keeps the
// zones and the subject in frame → headline fills the headline zone (lines from its proportion) → its colour from the
// luminance under it, the accent from the picture's own accent → a cut-out subject overlaps the letterforms when the
// picture declares interleave → info in the info zone, overflow continues below it, never over the subject
export function zoned(ctx: Ctx): void {
  const { W, H, u } = ctx;
  const a = ctx.images.find((x) => x.zones?.length);
  if (!a || !hasPic(ctx)) return typeled(ctx, 'zoned' as Strategy);
  ctx.images = [a, ...ctx.images.filter((x) => x !== a)];
  const c = contentOf(ctx);
  const o = out(ctx, 'zoned');
  const zh = a.zones!.find((z) => z.role === 'headline') ?? a.zones![0];
  const zi = a.zones!.find((z) => z.role === 'info');
  // crop: keep the union of the zones and the subject (only bites for formats other than the picture's own)
  const keep = [zh, ...(zi ? [zi] : []), ...(a.subject ? [a.subject] : [])];
  const kx0 = Math.min(...keep.map((r) => r.x)), kx1 = Math.max(...keep.map((r) => r.x + r.w));
  const ky0 = Math.min(...keep.map((r) => r.y)), ky1 = Math.max(...keep.map((r) => r.y + r.h));
  const s0 = Math.max(W / a.w, H / a.h), dw = a.w * s0, dh = a.h * s0;
  const fxa = dw > W + 1 ? clamp((((kx0 + kx1) / 2) * dw - W / 2) / (dw - W), 0, 1) : 0.5;
  const fya = dh > H + 1 ? clamp((((ky0 + ky1) / 2) * dh - H / 2) / (dh - H), 0, 1) : 0.5;
  const frame = { x: 0, y: 0, w: W, h: H };
  const photo = ctx.image(a, frame, { fx: fxa, fy: fya });
  o.role(photo.id, 'image');
  o.sem.crops.push({ node: photo.id, protect: a.subject, busy: a.subject ? busy(a, a.subject) : 0 });
  const dr = imageDrawRect(photo);
  const toCanvas = (z: { x: number; y: number; w: number; h: number }): Rect => {
    const x0 = clamp(dr.x + z.x * dr.w, u * 4, W - u * 4), y0 = clamp(dr.y + z.y * dr.h, u * 4, H - u * 4);
    const x1 = clamp(dr.x + (z.x + z.w) * dr.w, u * 4, W - u * 4), y1 = clamp(dr.y + (z.y + z.h) * dr.h, u * 4, H - u * 4);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };
  const hz = toCanvas(zh);
  // headline: line count from the zone's proportion and the copy length
  const fam = display(ctx, c.zh, true);
  const wf = (t: string) => ctx.measure.width(t, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 });
  const zr = hz.w / Math.max(1, hz.h);
  const kMax = c.zh ? (c.hlChars <= 3 ? 1 : c.hlChars <= 4 ? (zr < 1.6 ? 2 : 1) : c.hlChars <= 8 ? 2 : 3) : Math.min(c.hlWords, zr > 2.4 ? 2 : 3);
  let best: { lines: string[]; size: number } | null = null;
  for (let k = 1; k <= Math.max(1, kMax); k++) {
    const ls = semanticBreak(c.hl.t, { k, profile: 'any', width: wf }) ?? [c.hl.t];
    const lead = c.zh ? 1.08 : 0.98, cap = c.zh ? 0.86 : 0.72;
    const sz = Math.min(hz.w / (Math.max(...ls.map(wf)) / 100), hz.h / (cap + (ls.length - 1) * lead));
    if (!best || sz > best.size * 1.08) best = { lines: ls, size: sz };
  }
  const lines = best!.lines;
  const size = Math.min(best!.size, H * 0.28);
  o.sem.vars.lines = { kind: 'coupled', value: lines.length, from: 'zone.proportion' };
  const lg = ctx.legible(a, frame, hz, 200, true);
  const ink = lg.lum > 0.5 ? '#151413' : '#f5f2ea';
  const acc = a.accent && wcag(a.accent, lg.color ?? (lg.lum > 0.5 ? '#ffffff' : '#000000')) >= 0 ? a.accent : null;
  const accOk = (bg: string) => !!acc && wcag(acc, bg) >= 3;
  const bgHz = lg.lum > 0.5 ? '#e8e4dc' : '#101420';
  const zoneBg = a.palette[0] ?? bgHz;
  // the picture's accent colours the headline when it reads on the zone; otherwise it marks the explanation / rule
  const hlAcc = accOk(zoneBg) && ctx.rng.chance(0.45);
  const head = setHeadline(ctx, o, lines, 'stack', { x: hz.x, y: hz.y, w: hz.w, h: hz.h }, fam, c.zh, hlAcc ? acc! : ink, size);
  o.sem.vars.accent = { kind: 'coupled', value: acc ?? 'none', from: 'image.accent' };
  // interleave: the cut-out is drawn over the headline where it crosses the letterforms
  if (a.interleave && a.cutout && a.subject) {
    const sL = dr.x + a.subject.x * dr.w, sW = a.subject.w * dr.w;
    const ov = Math.max(0, Math.min(head.box.x + head.box.w, sL + sW) - Math.max(head.box.x, sL)) / Math.max(1, head.box.w);
    if (ov > 0.1) {
      const cut = ctx.image(a, frame, { fx: fxa, fy: fya, cutout: true });
      o.role(cut.id, 'image');
      o.sem.breaks.push({ kind: 'interleave', nodes: [...head.ids, cut.id, photo.id], reason: 'the subject passes in front of the headline letterforms (declared by the picture)' });
      o.sem.layers = ['photo', 'headline', 'subject', 'info'];
    }
  }
  if (!o.sem.layers?.length) o.sem.layers = ['photo', 'headline', 'info'];
  // info zone: explanation + items + meta; continues below the headline when the picture declares no info zone
  const lv = levels(ctx, size);
  const C = ctx.grid.content;
  const iz = zi ? toCanvas(zi) : { x: hz.x, y: head.box.y + head.box.h + u * 3, w: hz.w, h: C.y + C.h - (head.box.y + head.box.h) - u * 3 };
  const lg2 = ctx.legible(a, frame, iz, 14, true);
  const on2 = lg2.lum > 0.5 ? '#efebe3' : '#121212';
  let y = iz.y;
  const near = zi && Math.abs(iz.y - (head.box.y + head.box.h)) < u * 8;
  if (near) y = Math.max(y, head.box.y + head.box.h + u * 3);
  // landscape crops can map the info zone onto the headline: the info then starts below the headline (never under it)
  const hOver = Math.min(iz.x + iz.w, head.box.x + head.box.w) - Math.max(iz.x, head.box.x) > 0 && iz.y < head.box.y + head.box.h && iz.y + iz.h > head.box.y;
  if (hOver) y = Math.max(y, head.box.y + head.box.h + u * 3);
  const exFill = acc && wcag(acc, on2 === '#121212' ? '#121212' : '#efebe3') >= 3 && !hlAcc ? acc : null;
  const ex = line(ctx, o, c.sub, iz.x, y + lv.expl * 0.62, lv.expl * 0.62, on2, 'explanation', 'start', 'big.sub', iz.w);
  if (ex && exFill) ex.fill = exFill;
  if (ex) y = ex.box.y + ex.box.h + u * 2.2;
  if (exFill === null && accOk(on2 === '#121212' ? '#121212' : '#efebe3') && ctx.on('ornament')) { const r = ctx.add({ kind: 'rect', id: ctx.id('mk'), layer: 'ornament', x: iz.x, y: y - u * 1.2, w: u * 4, h: u * 0.5, fill: acc! }); o.role(r.id, 'ornament'); y += u * 1.2; }
  const bottom = Math.max(iz.y + iz.h, C.y + C.h - (a.subject && a.subject.y * dr.h + dr.y < iz.y + iz.h + u * 20 ? 0 : 0));
  const kind = c.times ? 'list' : c.items.length >= 3 && iz.w > u * 50 ? 'columns' : 'stack';
  let ib = infoGroup(ctx, o, c.items, { x: iz.x, y, w: iz.w, h: bottom - y }, on2, kind, lv.info);
  if (!ib) ib = infoGroup(ctx, o, c.items, { x: iz.x, y, w: iz.w, h: bottom - y + u * 6 }, on2, kind === 'columns' ? 'stack' : 'columns', lv.info * 0.9);
  if (ib) y = ib.y + ib.h + u * 2;
  c.meta.slice(0, 2).forEach((m) => { const n = line(ctx, o, m, iz.x, y + ctx.size('note') * 0.9, ctx.size('note'), on2, 'action', 'start', 'small.note', iz.w); if (n) y = n.box.y + n.box.h + u * 1.2; });
  o.sem.relations.push({ type: 'align', a: head.ids[0], b: 'info', edge: 'left' });
}

export const COMPOSERS_V8: Record<Strategy, (ctx: Ctx) => void> = { typeled: (c) => typeled(c), interleave, programme: (c) => programme(c), exhibit: (c) => exhibit(c), zoned };
