// Phase 5 compositions: typographic systems beyond the giant numeral (index / programme / spec sheets, echo patterns,
// knockout blocks, vertical columns, quote-led pages, type on a ring) and a magazine cover with the subject in front of
// the masthead. Principles learned from contemporary generative poster tools; every layout here is original.
import type { Ctx, Align, ImageAsset } from './ctx';
import type { Rect } from './grid';
import type { Shape } from '../types';
import { wcag, relLum } from '../color/contrast';
import { tonal } from '../color/strategy';
import { Rng } from '../rng';
import { imageDrawRect } from '../render/svg';
import { breakWords } from '../text/breaker';
import { header, groupArray, bigTitle, img, headlineSize, prose } from './comps';
import { rawText, hair } from './comps2';
import { roundedPath, archPath, stampPath } from './masks';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pad2 = (n: number) => String(n).padStart(2, '0');
const isZh = (t: string) => /[\u4e00-\u9fff]/.test(t);
const COND = ['Anton', 'Bebas Neue', 'Oswald', 'Archivo Black'];
/** a heavy CJK display face: thin / light role faces become Source Han Sans / Serif Heavy at poster scale */
export function zhHeavy(ctx: Ctx, strict = false): { family: string; weight: number } {
  const r = ctx.role('big.main', 'zh');
  if (strict && /Smiley|QingKe|KuaiLe|Ma Shan|Zhi Mang|Liu Jian|Long Cang/.test(r.family)) return /Ma Shan|Zhi Mang|Liu Jian|Long Cang/.test(r.family) ? { family: 'Source Han Serif CN', weight: 900 } : { family: 'Source Han Sans CN', weight: 900 };
  if (r.weight >= 600 || /Smiley|QingKe|KuaiLe|Ma Shan|Zhi Mang|Liu Jian|Long Cang/.test(r.family)) return { family: r.family, weight: r.weight };
  return /Serif|Song|Ming|WenKai|XiaoWei/i.test(r.family) ? { family: 'Source Han Serif CN', weight: 900 } : { family: 'Source Han Sans CN', weight: 900 };
}
const MASTHEADS_EN = ['FORMA', 'MARGIN', 'ATLAS', 'SIGNAL', 'NORTH', 'LUMEN', 'PAPER', 'FIELD', 'OBJECT', 'PLAIN', 'CIRCA', 'RANGE', 'STILL', 'ORBIT', 'GRAIN', 'TIDE', 'VERSO', 'MERIDIAN', 'HALCYON', 'OPAL', 'QUIET', 'KIOSK', 'ARC', 'DUSK', 'CANVAS', 'TEMPO', 'RELIEF', 'LOOM'];
const MASTHEADS_ZH = ['白页', '片刻', '纸上', '日常', '一隅', '平面', '回声', '远方'];
export const condFam = (ctx: Ctx) => { const f = ctx.rtd.pick(COND); return { family: f, weight: f === 'Oswald' ? 700 : 400 }; };
export const capOf = (ctx: Ctx, fam: { family: string; weight: number }, zh: boolean) => (zh ? 0.86 : ctx.measure.metrics({ family: fam.family, weight: fam.weight, size: 100, tracking: 0 }).cap);
export const width100 = (ctx: Ctx, t: string, fam: { family: string; weight: number }, tr = 0) => ctx.measure.width(t, { family: fam.family, weight: fam.weight, size: 100, tracking: tr }) / 100;
/** strong contrast colour for type on `on` */
export const strong = (ctx: Ctx, on: string) => ctx.textColor(on, 300);
export const accentOn = (ctx: Ctx, on: string, min = 3) => (wcag(ctx.pal.accent, on) >= min ? ctx.pal.accent : null);
/** a short display word from the copy */
export function heroWord(ctx: Ctx, maxLen = 9): { t: string; zh: boolean } {
  const hl = ctx.texts.headline;
  if (hl.lang === 'zh') return { t: Array.from(hl.t.replace(/[\s，。、！？：；“”「」·]/g, '')).slice(0, 4).join(''), zh: true };
  const ws = hl.t.split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w) && w.length <= maxLen);
  const w = ws.sort((a, b) => b.length - a.length)[0] ?? hl.t.split(/\s+/)[0];
  return { t: w.toUpperCase(), zh: false };
}
export function label(ctx: Ctx, t: string, x: number, y: number, on: string, o: { anchor?: Align; size?: number; fill?: string; weight?: number; tracking?: number; mono?: boolean } = {}) {
  const f = o.mono ? { family: 'IBM Plex Mono', weight: 500 } : ctx.fonts.en['small.note'];
  const size = o.size ?? ctx.size('meta');
  return rawText(ctx, { role: 'small.note', text: t, x, y, size, family: f.family, weight: o.weight ?? Math.max(500, f.weight), fill: o.fill ?? ctx.textColor(on, size), anchor: o.anchor, tracking: o.tracking ?? 0.1 });
}
/** mark every text node added since `from` as part of a typographic system (exempt from block budgets / demotion) */
export const system = (ctx: Ctx, from: number) => { for (let i = from; i < ctx.nodes.length; i++) { const n = ctx.nodes[i]; if (n.kind === 'text') n.tag = 'system'; } };
export const issue = (ctx: Ctx) => { const v = `NO. ${pad2(ctx.rd.int(1, 48))}`; return ctx.texts.facts?.issue || v; };
export const year = (ctx: Ctx) => { const v = String(2024 + ctx.rd.int(1, 3)); return ctx.texts.facts?.year || v; };

// ---------------------------------------------------------------- stickers (procedural, original)
export function barcode(ctx: Ctx, x: number, y: number, w: number, h: number, ink: string, paper: string) {
  ctx.add({ kind: 'rect', id: ctx.id('bc'), layer: 'ornament', x: x - w * 0.06, y: y - h * 0.08, w: w * 1.12, h: h * 1.38, fill: paper });
  let cx = x; let d = '';
  const r = ctx.rd;
  while (cx < x + w) { const bw = r.pick([1, 1, 2, 3]) * w * 0.012; d += `M${cx.toFixed(1)} ${y.toFixed(1)}h${bw.toFixed(1)}v${h.toFixed(1)}h${(-bw).toFixed(1)}z`; cx += bw + r.pick([1, 2, 2, 3]) * w * 0.011; }
  ctx.add({ kind: 'path', id: ctx.id('bcb'), layer: 'ornament', d, fill: ink });
  rawText(ctx, { layer: 'ornament', role: 'small.note', text: Array.from({ length: 12 }, () => r.int(0, 9)).join(''), x: x + w / 2, y: y + h * 1.24, size: h * 0.2, family: 'IBM Plex Mono', weight: 500, fill: ink, anchor: 'middle', tracking: 0.12, tag: 'kit' });
}
export function roundSticker(ctx: Ctx, cx: number, cy: number, r: number, fill: string, ink: string, lines: string[]) {
  ctx.add({ kind: 'circle', id: ctx.id('stk'), layer: 'ornament', cx, cy, r, fill });
  ctx.add({ kind: 'circle', id: ctx.id('stk'), layer: 'ornament', cx, cy, r: r * 0.86, fill: 'none', stroke: ink, sw: Math.max(1, r * 0.02), dash: ctx.rd.chance(0.5) ? `${(r * 0.05).toFixed(1)} ${(r * 0.05).toFixed(1)}` : undefined });
  const sz = r * (lines.length > 2 ? 0.26 : 0.34);
  const y0 = cy - ((lines.length - 1) * sz * 1.05) / 2 + sz * 0.36;
  lines.forEach((l, i) => rawText(ctx, { layer: 'ornament', role: 'small.note', text: l, x: cx, y: y0 + i * sz * 1.05, size: i === 0 && lines.length > 1 ? sz * 1.25 : sz, family: 'Archivo Black', weight: 400, fill: ink, anchor: 'middle', tracking: 0.02, tag: 'kit' }));
}
export function tagSticker(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, ink: string, t: string) {
  ctx.add({ kind: 'path', id: ctx.id('tag'), layer: 'ornament', d: roundedPath({ x, y, w, h }, h * 0.18), fill });
  ctx.add({ kind: 'circle', id: ctx.id('tagh'), layer: 'ornament', cx: x + h * 0.32, cy: y + h / 2, r: h * 0.09, fill: ctx.pal.bg });
  rawText(ctx, { layer: 'ornament', role: 'small.note', text: t, x: x + h * 0.6, y: y + h * 0.62, size: h * 0.34, family: 'IBM Plex Mono', weight: 600, fill: ink, tracking: 0.08, tag: 'kit' });
}
export function tape(ctx: Ctx, cx: number, cy: number, w: number, ang: number) {
  const h = w * 0.3, a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
  ctx.add({ kind: 'path', id: ctx.id('tape'), layer: 'ornament', d: 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z', fill: ctx.pal.light, opacity: 0.72 });
}

// ---------------------------------------------------------------- 1. magazine cover, subject in front of masthead
function cover(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const cut = ctx.images.find((a) => a.cutout && a.subject);
  if (cut) ctx.images = [cut, ...ctx.images.filter((a) => a !== cut)];
  const asset = img(ctx);
  const land = W > H * 1.2;
  const mf = ctx.texts.facts?.masthead;
  const mw0 = ctx.texts.headline.lang === 'zh' && ctx.rd.chance(0.6) ? { t: MASTHEADS_ZH[Math.floor(ctx.rt.next() * MASTHEADS_ZH.length)], zh: true } : { t: MASTHEADS_EN[Math.floor(new Rng(ctx.rt.seed + '|mast|' + ctx.texts.headline.t).next() * MASTHEADS_EN.length)], zh: false };
  const mw = mf ? { t: mf, zh: /[\u3400-\u9fff]/.test(mf) } : mw0;
  const fam = mw.zh ? zhHeavy(ctx) : ctx.rtd.chance(0.55) ? condFam(ctx) : ctx.rtd.pick([{ family: 'DM Serif Display', weight: 400 }, { family: 'Bodoni Moda', weight: 700 }, { family: 'Archivo Black', weight: 400 }]);
  const capR = capOf(ctx, fam, mw.zh);
  const tr = mw.zh ? 0.02 : -0.01;
  let size = (C.w + u * 2) / width100(ctx, mw.t, fam, tr);
  size = Math.min(size, (H * (land ? 0.42 : 0.27)) / capR);
  const cap = capR * size;
  let my = C.y + u * 4.5;
  const full = { x: 0, y: 0, w: W, h: H };
  let mastFill = strong(ctx, pal.bg);
  let on = pal.bg;
  if (asset && ctx.on('images')) {
    const front = !!asset.cutout;
    const node = ctx.image(asset, full, {});
    const mwPx0 = width100(ctx, mw.t, fam, tr) * size;
    if (front && asset.subject) {
      // depth: slide the masthead down (within the top third) so the subject's head overlaps its lower part
      const dr0 = imageDrawRect(node);
      const top0 = dr0.y + asset.subject.y * dr0.h;
      const want = top0 - cap * 0.62;
      if (want > my) my = Math.min(want, H * (land ? 0.2 : 0.24));
    }
    // masthead colour from the photo under it
    const lg = ctx.legible(asset, full, { x: C.x, y: my, w: C.w, h: cap }, 200, true);
    const acc = accentOn(ctx, lg.lum > 0.5 ? '#ffffff' : '#000000', 1);
    const useAcc = ctx.rtd.chance(0.4) && acc && (lg.lum > 0.5 ? relLum(pal.accent) < 0.2 : relLum(pal.accent) > 0.45);
    mastFill = useAcc ? pal.accent : lg.fill;
    // busy or mid-tone sky behind the masthead: a soft scrim keeps the title legible
    if (lg.opacity > 0.08) ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: 0, y: 0, w: W, h: my + cap + u * 10, fill: `lg(90,${lg.color},${Math.min(0.7, lg.opacity * 1.4 + 0.1).toFixed(2)},${lg.color},0)` });
    rawText(ctx, { id: ctx.id('mast'), role: 'big.main', text: mw.t, lang: mw.zh ? 'zh' : 'en', x: W / 2, y: my + cap, size, family: fam.family, weight: fam.weight, fill: mastFill, anchor: 'middle', tracking: tr, clip: { type: 'rect', x: 0, y: 0, w: W, h: H } });
    if (front) {
      // the subject only goes in front when it overlaps the lower part of the masthead (depth, not erasure)
      const dr = imageDrawRect(node);
      const sj = asset.subject!;
      const top = dr.y + sj.y * dr.h;
      const sx0 = dr.x + sj.x * dr.w, sx1 = sx0 + sj.w * dr.w;
      const mwPx = mwPx0;
      const m0 = W / 2 - mwPx / 2, m1 = W / 2 + mwPx / 2;
      const hidden = Math.max(0, Math.min(m1, sx1) - Math.max(m0, sx0)) / Math.max(1, mwPx);
      // how much of the letter height is covered: a subject that only reaches the lower part keeps every letter readable
      const vCover = clamp((my + cap - top) / cap, 0, 1);
      const nLetters = Array.from(mw.t).length;
      const okH = mw.zh ? (nLetters >= 2 ? 0.5 : 0.3) : nLetters >= 5 ? 0.62 : 0.48;
      if (top < my + cap * 0.95 && (hidden < okH || vCover < 0.45)) ctx.image(asset, full, { cutout: true });
    }
    on = lg.lum > 0.5 ? '#f4f1ea' : '#141414';
    // cover lines: a left column of 3 stacked lines with short rules, legible over the photo. Phase 22: a v3 type
    // re-roll may hang the column on the right and set the cover story flush right (v2 posters keep left / left)
    const cv = ctx.typeV3 ? ctx.rt.fork('cover') : null;
    const colRight = !!cv && cv.chance(0.5), storyEnd = !!cv && cv.chance(0.5);
    const colW = land ? W * 0.24 : C.w * 0.36;
    const ys = my + cap + u * 6;
    const region = { x: colRight ? C.x + C.w - colW : C.x, y: ys, w: colW, h: C.y + C.h - ys - u * 12 };
    const lr = ctx.legible(asset, full, region, 30);
    const sw = colW + C.x + u * 8;
    if (lr.opacity > 0.15) ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: colRight ? W - sw : 0, y: ys - u * 2, w: sw, h: H - ys + u * 2, fill: `lg(${colRight ? 180 : 0},${lr.color},${Math.min(0.7, lr.opacity * 1.2).toFixed(2)},${lr.color},0)` });
    const T = ctx.texts;
    const items = [T.groups[0], T.groups[1], T.groups[2]].filter(Boolean);
    const step = Math.min(region.h / Math.max(1, items.length), u * 16);
    items.forEach((gp, i) => {
      const y = region.y + i * step;
      const hx = colRight ? region.x + colW - u * 5 : C.x;
      hair(ctx, hx, y, hx + u * 5, y, 0.9, lr.fill);
      ctx.group({ main: gp.main, note: gp.note }, 'small', { x: region.x, y: y + u * 1.4, w: colW, h: step - u * 2 }, { mainSize: ctx.size('smallMain') * 0.82, align: colRight ? 'end' : 'start', on: lr.color, fill: lr.fill, mode: 'words', lines: 2 });
    });
    // headline as the cover story, bottom
    const bw = C.w * (land ? 0.5 : 0.7);
    const by = { x: storyEnd ? C.x + C.w - bw : C.x, y: C.y + C.h - u * 12, w: bw, h: u * 12 };
    const lb = ctx.legible(asset, full, by, 60);
    if (lb.opacity > 0.15) ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: 0, y: H * 0.72, w: W, h: H * 0.28, fill: `lg(90,${lb.color},0,${lb.color},${Math.min(0.75, lb.opacity * 1.3).toFixed(2)})` });
    ctx.group({ main: T.headline, sub: T.sub }, 'small', by, { mainSize: ctx.size('smallMain') * 1.35, align: storyEnd ? 'end' : 'start', valign: 'bottom', on: lb.color, fill: lb.fill, mode: 'words', lines: 2 });
    // issue line under the masthead
    label(ctx, `${issue(ctx)}  ·  ${T.meta[0]?.t ?? ''}  ·  ${year(ctx)}`, W - C.x, my + cap + u * 3, on, { anchor: 'end', fill: lg.fill });
    // barcode corner
    if (ctx.on('ornament') && ctx.rd.chance(0.75)) barcode(ctx, C.x + C.w - u * 13, C.y + C.h - u * 7, u * 13, u * 5, '#111111', '#f6f4ef');
  } else {
    // type-only cover: masthead on a colour band, cover lines in a numbered column, a sticker
    const band = { x: 0, y: 0, w: W, h: my + cap + u * 5 };
    const bandCol = wcag(pal.accent, pal.bg) > 1.6 ? pal.accent : tonal(pal.bg, 0.12);
    ctx.add({ kind: 'rect', id: ctx.id('mband'), layer: 'zones', ...band, fill: bandCol });
    rawText(ctx, { id: ctx.id('mast'), role: 'big.main', text: mw.t, lang: mw.zh ? 'zh' : 'en', x: W / 2, y: my + cap, size, family: fam.family, weight: fam.weight, fill: strong(ctx, bandCol), anchor: 'middle', tracking: tr });
    const A = { x: C.x, y: band.h + u * 6, w: C.w, h: C.y + C.h - band.h - u * 6 };
    const hs = Math.min(headlineSize(ctx, A.w * 0.9), u * 13);
    const hh = bigTitle(ctx, { x: A.x, y: A.y, w: A.w * 0.9, h: A.h * 0.45 }, on, { align: 'start', size: hs, withSub: true });
    const ly = A.y + hh + u * 5;
    hair(ctx, A.x, ly, A.x + A.w, ly);
    const n = 3;
    const cw = (A.w - u * 4) / n;
    for (let i = 0; i < n; i++) {
      const gp = ctx.texts.groups[i % ctx.texts.groups.length];
      label(ctx, pad2(i + 1), A.x + i * (cw + u * 2), ly + u * 4, on, { fill: accentOn(ctx, on, 2) ?? undefined, size: ctx.size('meta') * 1.4, weight: 700 });
      ctx.group({ main: gp.main, note: gp.note }, 'small', { x: A.x + i * (cw + u * 2), y: ly + u * 6.5, w: cw, h: A.y + A.h - ly - u * 7 }, { mainSize: ctx.size('smallMain') * 0.78, align: 'start', on, mode: 'words', lines: 2 });
    }
    label(ctx, `${issue(ctx)} · ${year(ctx)}`, W - C.x, band.h - u * 2, bandCol, { anchor: 'end' });
    if (ctx.on('ornament')) roundSticker(ctx, C.x + C.w - u * 9, band.h + u * 1, u * 8, pal.ink === pal.bg ? pal.dark : strong(ctx, pal.bg), pal.bg, ['NEW', ctx.texts.meta[1]?.t?.slice(0, 10) ?? 'ISSUE']);
  }
}

// ---------------------------------------------------------------- 2. index / programme / spec sheet
function index(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const land = W > H * 1.15;
  const wide = W > H * 1.6;
  const v = ctx.rt.weighted({ programme: 1.2, list: 1.2, spec: 1 });
  const T = ctx.texts;
  const acc = accentOn(ctx, on, 2.2);
  // head: either a knockout accent block or a big set headline
  const blockHead = acc && ctx.rng.chance(0.45);
  const headArea: Rect = wide ? { x: C.x, y: C.y, w: C.w * 0.4, h: C.h } : land ? { x: C.x, y: C.y, w: C.w * 0.42, h: C.h } : { x: C.x, y: C.y, w: C.w, h: C.h * 0.4 };
  let tableArea: Rect = land ? { x: C.x + C.w * 0.47, y: C.y + u * 6, w: C.w * 0.53, h: C.h - u * 6 } : { x: C.x, y: C.y + C.h * 0.44, w: C.w, h: C.h * 0.56 };
  if (blockHead) {
    const b = land ? { x: 0, y: 0, w: headArea.x + headArea.w + u * 2, h: H } : { x: 0, y: 0, w: W, h: headArea.y + headArea.h };
    ctx.add({ kind: 'rect', id: ctx.id('ihead'), layer: 'zones', ...b, fill: pal.accent });
    const hs = Math.min(headlineSize(ctx, headArea.w), u * (land ? 13 : 14));
    bigTitle(ctx, { x: headArea.x, y: headArea.y + u * 7, w: headArea.w, h: headArea.h - u * 12 }, pal.accent, { align: 'start', valign: land ? 'bottom' : 'bottom', size: hs, withSub: true });
    label(ctx, `${T.meta[0]?.t ?? ''}`, headArea.x, headArea.y + u * 1.5, pal.accent);
    label(ctx, issue(ctx), headArea.x + headArea.w, headArea.y + u * 1.5, pal.accent, { anchor: 'end' });
    if (!land) tableArea = { ...tableArea, y: b.h + u * 5, h: C.y + C.h - b.h - u * 5 };
  } else {
    header(ctx, { x: C.x, y: C.y, w: C.w, h: C.h }, on, 'top');
    const hs = Math.min(headlineSize(ctx, headArea.w) * 1.1, u * (land ? 14 : 16));
    bigTitle(ctx, { x: headArea.x, y: headArea.y + u * 6, w: headArea.w, h: headArea.h - u * 8 }, on, { align: 'start', valign: 'top', size: hs, withSub: true, withNote: land });
  }
  // the table
  const rowsMax = clamp(Math.floor(tableArea.h / (u * (v === 'spec' ? 10 : 7.5))), 3, wide ? 6 : 7);
  // real lists (texts.facts.times) get exactly their rows: no empty ruled lines
  const nReal = T.facts?.times ? T.groups.filter((g) => g.main.t).length : 0;
  const rowsN = nReal ? clamp(nReal, 3, rowsMax) : rowsMax;
  const rowH = tableArea.h / rowsN;
  const ink = ctx.textColor(on, 100);
  const f = ctx.fonts;
  const times = ['09:30', '10:45', '12:00', '13:15', '14:30', '16:00', '17:30', '19:00', '20:30'];
  const startT = ctx.rd.int(0, 2);
  const sys0 = ctx.nodes.length;
  for (let i = 0; i < rowsN; i++) {
    const y = tableArea.y + i * rowH;
    hair(ctx, tableArea.x, y, tableArea.x + tableArea.w, y, i === 0 ? 0.95 : 0.5);
    const gp = T.groups[i % T.groups.length];
    const w2 = T.words[i % Math.max(1, T.words.length)];
    const main = i < T.groups.length ? gp.main : w2 ?? gp.sub;
    const note = i < T.groups.length ? gp.note : T.meta[i % T.meta.length];
    const baseY = y + Math.min(rowH * 0.62, u * 5.2);
    if (v === 'spec') {
      // big value at left, label + note to the right
      const val0 = ctx.rd.pick([`${ctx.rd.int(12, 96)}%`, `${ctx.rd.int(2, 48)}`, `${ctx.rd.int(100, 980)}`, `${ctx.rd.int(1, 9)}.${ctx.rd.int(0, 9)}`, `×${ctx.rd.int(2, 12)}`]);
      const val = T.facts?.values ? (T.facts.values[i] ?? '') : val0;
      const vs = Math.min(rowH * 0.62, u * 8);
      const vf = ctx.rtd.chance(0.5) ? { family: 'Archivo Black', weight: 400 } : { family: f.en['big.main'].family, weight: f.en['big.main'].weight };
      rawText(ctx, { role: 'small.main', text: val, x: tableArea.x, y: y + vs * 0.92 + u * 1.2, size: vs, family: vf.family, weight: vf.weight, fill: i === 0 && acc && !blockHead ? acc : ink, tracking: -0.02 });
      ctx.group({ main, note }, 'small', { x: tableArea.x + tableArea.w * 0.42, y: y + u * 1.6, w: tableArea.w * 0.58, h: rowH - u * 2.4 }, { mainSize: Math.min(u * 2.6, rowH * 0.3) / (ctx.size('smallMain') / ctx.size('smallMain')), align: 'start', on, mode: 'words', lines: 2 });
    } else {
      const num = v === 'programme' ? (T.facts?.times ? (T.facts.times[i] ?? '') : times[(startT + i) % times.length]) : pad2(i + 1);
      const ns = v === 'list' ? Math.min(rowH * 0.56, u * 6) : Math.min(rowH * 0.3, u * 2.6);
      if (v === 'list') rawText(ctx, { role: 'small.main', text: num, x: tableArea.x, y: y + u * 1.4 + ns * 0.74, size: ns, family: 'Archivo Black', weight: 400, fill: acc ?? ink, tracking: -0.02 });
      else label(ctx, num, tableArea.x, y + u * 1.4 + ns * 0.72, on, { mono: true, size: ns, weight: 600, fill: acc && i === 0 ? acc : ink, tracking: 0 });
      const mx = tableArea.x + tableArea.w * (v === 'programme' ? 0.24 : 0.2);
      const mwid = tableArea.w * 0.48;
      ctx.text(main, 'small.main', { x: mx, y: y + u * 1.4, w: mwid, h: rowH - u * 2 }, { size: Math.min(u * (land ? 2.8 : 3.4), rowH * 0.36), align: 'start', on, mode: 'greedy', maxLines: 2 });
      if (note?.t) ctx.text(note, 'small.note', { x: tableArea.x + tableArea.w * 0.72, y: y + u * 1.6, w: tableArea.w * 0.28, h: rowH - u * 2 }, { size: ctx.size('note') * 0.95, align: 'end', on, mode: 'greedy', maxLines: 3 });
    }
  }
  hair(ctx, tableArea.x, tableArea.y + tableArea.h, tableArea.x + tableArea.w, tableArea.y + tableArea.h, 0.95);
  system(ctx, sys0);
  // a small image cell or a prose column in the head area when there is room
  const asset = img(ctx);
  if (asset && ctx.on('images') && !ctx.plan.typeOnly && !blockHead && ctx.rng.chance(0.6)) {
    const fr = land ? { x: headArea.x, y: C.y + C.h - C.h * 0.38, w: headArea.w * 0.62, h: C.h * 0.38 } : { x: C.x + C.w * 0.64, y: C.y + u * 6, w: C.w * 0.36, h: C.h * 0.3 };
    if (!ctx.occupied.some((o) => o.x < fr.x + fr.w && o.x + o.w > fr.x && o.y < fr.y + fr.h && o.y + o.h > fr.y)) { ctx.image(asset, fr, { filter: ctx.rd.chance(0.4) ? { grayscale: true, contrast: 1.1 } : {} }); ctx.occupied.push(fr); }
  } else if (land && !blockHead) prose(ctx, { x: headArea.x, y: C.y + C.h * 0.72, w: headArea.w * 0.8, h: C.h * 0.28 }, on, 'start', 0);
}

// ---------------------------------------------------------------- 3. echo: repeated word pattern
function echo(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const hw = heroWord(ctx, 9);
  const fam = hw.zh ? zhHeavy(ctx) : condFam(ctx);
  const capR = capOf(ctx, fam, hw.zh);
  const land = W > H * 1.15;
  const rows = land ? ctx.rng.int(4, 5) : ctx.rng.int(6, 8);
  const lead = 1.04;
  const sizeH = H / (rows * lead * capR + 0.2) * 0.98;
  const sizeW = (W * 1.02) / width100(ctx, hw.t, fam, -0.01);
  const size = Math.min(sizeH, sizeW);
  const cap = capR * size;
  const gap = (H - rows * cap) / (rows + 1);
  const ink = strong(ctx, on);
  const acc = accentOn(ctx, on, 1.6);
  const hot = ctx.rng.int(0, rows - 1);
  const style = ctx.rng.weighted({ outline: 2, tonal: 1.4 });
  const tone = tonal(on, 0.12);
  for (let i = 0; i < rows; i++) {
    const y = gap + i * (cap + gap) + cap;
    const solid = i === hot;
    const fill = solid ? acc ?? ink : style === 'outline' ? 'none' : tone;
    rawText(ctx, { layer: solid ? 'text' : 'zones', role: solid ? 'big.main' : 'anchor', text: hw.t, lang: hw.zh ? 'zh' : 'en', x: W / 2, y, size, family: fam.family, weight: fam.weight, fill, stroke: !solid && style === 'outline' ? ctx.textColor(on, 20) : undefined, sw: !solid && style === 'outline' ? Math.max(1.2, size * 0.008) : undefined, anchor: 'middle', tracking: -0.01, clip: solid ? undefined : { type: 'rect', x: 0, y: 0, w: W, h: H }, tag: solid ? undefined : 'anchor' });
  }
  // the copy sits in a field-coloured card that interrupts the pattern
  const hotY = gap + hot * (cap + gap);
  const cardH = Math.min(H * 0.34, u * 34);
  const cardW = land ? C.w * 0.36 : C.w * 0.62;
  const topHalf = hotY > H / 2;
  const right = ctx.rt.chance(0.5);
  const card = { x: right ? C.x + C.w - cardW : C.x, y: topHalf ? C.y + u * 2 : C.y + C.h - cardH, w: cardW, h: cardH };
  ctx.add({ kind: 'rect', id: ctx.id('card'), layer: 'zones', x: card.x - u * 2.5, y: card.y - u * 2.5, w: card.w + u * 5, h: card.h + u * 5, fill: on });
  ctx.occupied.push(card);
  const T = ctx.texts;
  ctx.group({ main: T.headline.lang === 'zh' || hw.t.length < T.headline.t.length ? T.headline : T.sub, sub: T.sub, note: T.note }, 'big', { x: card.x, y: card.y + u * 3.5, w: card.w, h: card.h * 0.62 }, { mainSize: Math.min(headlineSize(ctx, card.w) * 0.55, u * 6.5), align: 'start', on, mode: 'balance', maxLines: 3 });
  label(ctx, `${T.meta[0]?.t ?? ''} — ${issue(ctx)}`, card.x, card.y + u * 0.6, on);
  groupArray(ctx, { x: card.x, y: card.y + card.h * 0.66, w: card.w, h: card.h * 0.34 }, on, 2, { valign: 'bottom', maxPerRow: 2 });
}

// ---------------------------------------------------------------- 4. knockout: headline cut out of a colour block
function knockout(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const land = W > H * 1.15;
  const blockCol = wcag(pal.accent, pal.bg) > 1.5 ? pal.accent : relLum(pal.bg) > 0.4 ? pal.dark : pal.light;
  const holeCol = strong(ctx, blockCol) === pal.bg || wcag(pal.bg, blockCol) >= 2.6 ? pal.bg : strong(ctx, blockCol);
  const hw = ctx.texts.headline;
  const zh = hw.lang === 'zh';
  const fam = zh ? zhHeavy(ctx, true) : condFam(ctx); // knockout needs a solid stroke: no thin brush in the hole
  const raw = zh ? hw.t.replace(/[\s，。、！？：；]/g, '') : hw.t.toUpperCase();
  const words = zh ? Array.from(raw) : raw.split(/\s+/);
  const nL = zh ? (words.length > 4 ? 2 : 1) : clamp(words.length, 1, 3);
  let lines: string[];
  if (zh) { const per = Math.ceil(words.length / nL); lines = []; for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join('')); }
  else lines = breakWords(raw, nL, (t) => ctx.measure.width(t, { family: fam.family, weight: fam.weight, size: 100, tracking: 0 }));
  const capR = capOf(ctx, fam, zh);
  const blk: Rect = land ? { x: 0, y: 0, w: W * ctx.rng.range(0.56, 0.66), h: H } : { x: 0, y: ctx.rng.chance(0.5) ? 0 : H * 0.36, w: W, h: H * 0.64 };
  if (land && ctx.rng.chance(0.5)) blk.x = W - blk.w;
  ctx.add({ kind: 'rect', id: ctx.id('kblock'), layer: 'zones', ...blk, fill: blockCol });
  const inner = { x: blk.x + u * 5, y: blk.y + u * 6, w: blk.w - u * 10, h: blk.h - u * 12 };
  const w100 = Math.max(...lines.map((l) => width100(ctx, l, fam)));
  const lead = zh ? 1.0 : 0.92;
  let size = inner.w / w100;
  size = Math.min(size, inner.h / (capR + (lines.length - 1) * lead) * 0.9);
  const blockH = capR * size + (lines.length - 1) * size * lead;
  const y0 = inner.y + inner.h - blockH + capR * size;
  rawText(ctx, { id: ctx.id('ko'), role: 'big.main', text: lines.join('\n'), lang: zh ? 'zh' : 'en', x: inner.x, y: y0, size, family: fam.family, weight: fam.weight, fill: holeCol, anchor: 'start', leading: lead });
  label(ctx, `${ctx.texts.meta[0]?.t ?? ''}`, inner.x, blk.y + u * 4, blockCol);
  label(ctx, issue(ctx), inner.x + inner.w, blk.y + u * 4, blockCol, { anchor: 'end' });
  // rest: photo + info, or info columns
  const rest: Rect = land ? (blk.x > 0 ? { x: C.x, y: C.y, w: blk.x - C.x - u * 4, h: C.h } : { x: blk.w + u * 4, y: C.y, w: W - blk.w - u * 4 - C.x, h: C.h }) : blk.y > 0 ? { x: C.x, y: C.y, w: C.w, h: blk.y - C.y - u * 3 } : { x: C.x, y: blk.h + u * 3, w: C.w, h: C.y + C.h - blk.h - u * 3 };
  const on = pal.bg;
  const asset = img(ctx);
  if (asset && ctx.on('images') && !ctx.plan.typeOnly && land && W > H * 1.5) {
    // long formats: the photo owns the whole remaining side edge-to-edge; the copy moves into the block above the headline
    const fr = blk.x > 0 ? { x: 0, y: 0, w: blk.x, h: H } : { x: blk.w, y: 0, w: W - blk.w, h: H };
    ctx.image(asset, fr, { filter: ctx.rd.chance(0.25) ? { grayscale: true, contrast: 1.08 } : {} });
    ctx.occupied.push(fr);
    const room = y0 - capR * size - (inner.y + u * 2);
    if (room > u * 8) {
      ctx.group({ main: ctx.texts.sub, note: ctx.texts.note }, 'small', { x: inner.x, y: inner.y + u * 2, w: inner.w * 0.42, h: room * 0.8 }, { mainSize: ctx.size('smallMain') * 0.85, align: 'start', on: blockCol, mode: 'words', lines: 2 });
      groupArray(ctx, { x: inner.x + inner.w * 0.55, y: inner.y + u * 2, w: inner.w * 0.45, h: room * 0.8 }, blockCol, 2, { valign: 'top', maxPerRow: 2 });
    }
  } else if (asset && ctx.on('images') && !ctx.plan.typeOnly && rest.h > u * 18) {
    const fr = land ? { x: rest.x, y: rest.y, w: rest.w, h: rest.h * 0.56 } : { x: rest.x + rest.w * 0.5, y: rest.y, w: rest.w * 0.5, h: rest.h };
    const shape = ctx.rd.weighted({ rect: 3, arch: 1, rounded: 1, stamp: ctx.plan.material === 'stamp' ? 3 : 0.3 });
    const clip: Shape | undefined = shape === 'arch' ? { type: 'path', d: archPath(fr) } : shape === 'rounded' ? { type: 'path', d: roundedPath(fr, u * 2) } : shape === 'stamp' ? { type: 'path', d: stampPath(fr, u * 1) } : undefined;
    ctx.image(asset, fr, { clip, filter: ctx.rd.chance(0.25) ? { grayscale: true, contrast: 1.08 } : {} });
    ctx.occupied.push(fr);
    const tx = land ? { x: rest.x, y: rest.y + rest.h * 0.62, w: rest.w, h: rest.h * 0.38 } : { x: rest.x, y: rest.y, w: rest.w * 0.46, h: rest.h };
    ctx.group({ main: ctx.texts.sub, note: ctx.texts.note }, 'small', { ...tx, h: tx.h * 0.55 }, { mainSize: ctx.size('smallMain') * 0.85, align: 'start', on, mode: 'words', lines: 2 });
    groupArray(ctx, { x: tx.x, y: tx.y + tx.h * 0.6, w: tx.w, h: tx.h * 0.4 }, on, 2, { valign: 'bottom', maxPerRow: 2 });
  } else {
    ctx.group({ main: ctx.texts.sub, note: ctx.texts.note }, 'small', { x: rest.x, y: rest.y + u * 2, w: rest.w * (land ? 1 : 0.5), h: rest.h * 0.5 }, { mainSize: ctx.size('smallMain') * 0.9, align: 'start', on, mode: 'words', lines: 2 });
    groupArray(ctx, { x: rest.x, y: rest.y + rest.h * 0.5, w: rest.w, h: rest.h * 0.5 }, on, land ? 2 : 3, { valign: 'bottom', maxPerRow: land ? 1 : 3 });
    prose(ctx, { x: land ? rest.x : rest.x + rest.w * 0.55, y: rest.y + u * 2, w: rest.w * (land ? 0.9 : 0.45), h: rest.h * 0.4 }, on, 'start', 0);
  }
}

// ---------------------------------------------------------------- 5. vertical columns (CJK) / rotated spine (Latin)
function vertical(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const T = ctx.texts;
  const hl = T.headline;
  const zh = hl.lang === 'zh';
  const ink = strong(ctx, on);
  const acc = accentOn(ctx, on, 2.5);
  const right = ctx.rng.chance(0.6);
  if (zh) {
    const chars = Array.from(hl.t.replace(/[\s，。、！？：；“”]/g, ''));
    const nCol = chars.length > 5 ? 2 : 1;
    const per = Math.ceil(chars.length / nCol);
    const fam = zhHeavy(ctx);
    const size = Math.min((C.h * 0.9) / per, (C.w * 0.48) / nCol);
    const colX = (i: number) => (right ? C.x + C.w - size / 2 - i * size * 1.15 : C.x + size / 2 + i * size * 1.15);
    for (let i = 0; i < nCol; i++) {
      const t = chars.slice(i * per, (i + 1) * per).join('\n');
      const vn = rawText(ctx, { id: ctx.id('vcol'), role: 'big.main', text: t, lang: 'zh', x: colX(i), y: C.y + size * 0.88, size, family: fam.family, weight: fam.weight, fill: i === 0 || !acc ? ink : acc, anchor: 'middle', leading: 1.0 });
      vn.vertical = true;
    }
    const used = nCol * size * 1.15;
    const A = right ? { x: C.x, y: C.y, w: C.w - used - u * 4, h: C.h } : { x: C.x + used + u * 4, y: C.y, w: C.w - used - u * 4, h: C.h };
    // thin column rules and small horizontal copy
    hair(ctx, right ? A.x + A.w + u * 2 : A.x - u * 2, C.y, right ? A.x + A.w + u * 2 : A.x - u * 2, C.y + C.h, 0.6);
    ctx.group({ main: T.sub, note: T.note }, 'small', { x: A.x, y: A.y + u * 4, w: A.w * 0.9, h: A.h * 0.3 }, { mainSize: ctx.size('smallMain') * 0.85, align: 'start', on, mode: 'words', lines: 3 });
    const asset = img(ctx);
    if (asset && ctx.on('images') && !ctx.plan.typeOnly && A.w > u * 25) {
      const fr = { x: A.x, y: A.y + A.h * 0.38, w: A.w * 0.8, h: A.h * 0.36 };
      ctx.image(asset, fr, { clip: ctx.rd.chance(0.4) ? { type: 'path', d: archPath(fr) } : undefined });
      ctx.occupied.push(fr);
    }
    groupArray(ctx, { x: A.x, y: A.y + A.h * 0.8, w: A.w, h: A.h * 0.2 }, on, 2, { valign: 'bottom', maxPerRow: 2 });
    label(ctx, issue(ctx), A.x, C.y + u * 1, on);
  } else {
    // Latin: the headline runs up the spine, rotated, at full height
    const fam = condFam(ctx);
    const word = hl.t.toUpperCase();
    const w1 = width100(ctx, word, fam, 0);
    const capR = capOf(ctx, fam, false);
    const size = Math.min((H * 0.94) / w1, (W * 0.34) / capR);
    const cap = capR * size;
    // rotate(-90) reads bottom-to-top with glyphs extending left (right edge); rotate(90) reads top-to-bottom, glyphs extending right (left edge)
    const x = right ? W - u * 2 : u * 2;
    const y = right ? H / 2 + (w1 * size) / 2 : H / 2 - (w1 * size) / 2;
    const n = rawText(ctx, { id: ctx.id('spine'), role: 'big.main', text: word, x, y, size, family: fam.family, weight: fam.weight, fill: acc ?? ink });
    ctx.occupied.pop();
    n.rotate = right ? -90 : 90; n.vertical = true;
    n.box = { x, y, w: 1, h: 1 };
    const band = right ? { x: C.x, y: C.y, w: W - cap - u * 8 - C.x, h: C.h } : { x: cap + u * 6, y: C.y, w: C.x + C.w - cap - u * 6, h: C.h };
    ctx.occupied.push(right ? { x: W - cap - u * 3, y: 0, w: cap + u * 3, h: H } : { x: 0, y: 0, w: cap + u * 3, h: H });
    header(ctx, band, on, 'top');
    ctx.group({ main: T.sub, note: T.note }, 'big', { x: band.x, y: band.y + u * 6, w: band.w * 0.85, h: band.h * 0.34 }, { mainSize: Math.min(headlineSize(ctx, band.w) * 0.6, u * 8), align: 'start', on, mode: 'balance', maxLines: 3 });
    const asset = img(ctx);
    if (asset && ctx.on('images') && !ctx.plan.typeOnly) {
      const fr = { x: band.x, y: band.y + band.h * 0.42, w: band.w * 0.66, h: band.h * 0.32 };
      ctx.image(asset, fr, {}); ctx.occupied.push(fr);
    } else prose(ctx, { x: band.x, y: band.y + band.h * 0.45, w: band.w * 0.6, h: band.h * 0.25 }, on, 'start', 0);
    groupArray(ctx, { x: band.x, y: band.y + band.h * 0.8, w: band.w, h: band.h * 0.2 }, on, 3, { valign: 'bottom', maxPerRow: 3 });
  }
}

// ---------------------------------------------------------------- 6. quote-led page
function quote(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const T = ctx.texts;
  const land = W > H * 1.15;
  const q = T.prose[0] ?? T.sub;
  const zh = q.lang === 'zh';
  const acc = accentOn(ctx, on, 1.8) ?? strong(ctx, on);
  const serif = zh ? zhHeavy(ctx) : ctx.rtd.pick([{ family: 'Instrument Serif', weight: 400 }, { family: 'DM Serif Display', weight: 400 }, { family: 'Playfair Display', weight: 500 }]);
  header(ctx, C, on, 'top');
  const A = land ? { x: C.x + C.w * 0.3, y: C.y + u * 8, w: C.w * 0.66, h: C.h * 0.66 } : { x: C.x, y: C.y + C.h * 0.27, w: C.w * 0.94, h: C.h * 0.5 };
  const asset = img(ctx);
  if (asset && ctx.on('images') && !ctx.plan.typeOnly) {
    // the quote's picture: a tall plate at the right (portrait: top-right square)
    const fr = land ? { x: W - W * 0.3, y: 0, w: W * 0.3, h: H } : { x: C.x + C.w * 0.56, y: C.y + u * 6, w: C.w * 0.44, h: C.h * 0.36 };
    ctx.image(asset, fr, { clip: !land && ctx.rd.chance(0.4) ? { type: 'path', d: archPath(fr) } : undefined, filter: ctx.rd.chance(0.3) ? { grayscale: true, contrast: 1.08 } : {} });
    ctx.occupied.push(fr);
    if (land) A.w = W * 0.7 - A.x - u * 5; else { A.y = fr.y + fr.h + u * 5; A.h = C.y + C.h - A.y - u * 18; }
  }
  const markSize = land ? C.h * 0.8 : C.w * (asset && !ctx.plan.typeOnly ? 0.46 : 0.62);
  rawText(ctx, { layer: 'zones', role: 'anchor', text: '\u201C', x: land ? C.x - u : C.x - u * 1.5, y: (land ? C.y : C.y + C.h * 0.06) + markSize * 0.72, size: markSize, family: 'DM Serif Display', weight: 400, fill: acc, clip: { type: 'rect', x: 0, y: 0, w: W, h: H }, tag: 'anchor' });
  const qs = clamp(Math.sqrt((A.w * A.h) / Math.max(20, Array.from(q.t).length)) * (zh ? 0.75 : 1.0), u * 3.6, u * 11);
  const q0 = ctx.nodes.length;
  const r = ctx.text(q, 'big.main', A, { size: qs, align: 'start', on, mode: 'greedy', family: serif.family, weight: serif.weight, leading: zh ? 1.35 : 1.12, tracking: zh ? 0.02 : -0.005, noCase: true, fit: true, maxLines: 8 });
  system(ctx, q0);
  const ay = A.y + r.h + u * 4;
  hair(ctx, A.x, ay, A.x + u * 8, ay, 0.9, acc);
  ctx.group({ main: T.headline, note: T.note }, 'small', { x: A.x, y: ay + u * 2, w: A.w * 0.7, h: u * 14 }, { mainSize: ctx.size('smallMain') * 0.9, align: 'start', on, mode: 'balance', maxLines: 2 });
  groupArray(ctx, { x: C.x, y: C.y + C.h - u * 12, w: C.w, h: u * 12 }, on, 3, { valign: 'bottom', maxPerRow: 3 });
}

// ---------------------------------------------------------------- 7. ring: type set around a disc
function ring(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const T = ctx.texts;
  const land = W > H * 1.15;
  const R = land ? C.h * 0.4 : C.w * 0.4;
  const cx = land ? C.x + C.w * 0.68 : W / 2;
  const cy = land ? H / 2 : C.y + C.h * 0.38;
  const asset = img(ctx);
  const acc = accentOn(ctx, on, 1.5);
  const disc = { x: cx - R * 0.78, y: cy - R * 0.78, w: R * 1.56, h: R * 1.56 };
  if (asset && ctx.on('images') && !ctx.plan.typeOnly) ctx.image(asset, disc, { clip: { type: 'circle', cx, cy, r: R * 0.78 } });
  else if (ctx.on('zones')) {
    ctx.add({ kind: 'circle', id: ctx.id('disc'), layer: 'zones', cx, cy, r: R * 0.78, fill: acc ?? tonal(on, 0.12) });
    const hw = heroWord(ctx, 6);
    const t = hw.zh ? Array.from(hw.t)[0] : ((v: string) => ctx.texts.facts?.numeral || v)(pad2(ctx.rd.int(1, 31)));
    const fam = hw.zh ? zhHeavy(ctx) : { family: 'DM Serif Display', weight: 400 };
    const sz = R * 0.9;
    rawText(ctx, { layer: 'zones', role: 'anchor', text: t, x: cx, y: cy + sz * capOf(ctx, fam, !!hw.zh) / 2, size: sz, family: fam.family, weight: fam.weight, fill: strong(ctx, acc ?? on), anchor: 'middle', clip: { type: 'rect', x: 0, y: 0, w: W, h: H }, tag: 'anchor' });
  }
  ctx.occupied.push({ x: cx - R * 1.08, y: cy - R * 1.08, w: R * 2.16, h: R * 2.16 });
  // ring text: each glyph placed and rotated on the circle
  const src = (T.custom ? T.headline.t : T.headline.lang === 'en' ? T.headline.t : T.words.find((w) => w.lang === 'en')?.t ?? T.sub.t).toUpperCase(); // real copy: no invented ring words
  const ringT = `${src} · ${T.meta[0]?.t ?? ''} · ${year(ctx)} · `.toUpperCase();
  const f = ctx.rtd.chance(0.5) ? { family: 'IBM Plex Mono', weight: 600 } : { family: 'Archivo Black', weight: 400 };
  const glyphs = Array.from(ringT);
  const rr = R * 0.92;
  const circ = 2 * Math.PI * rr;
  const sz = clamp((circ / glyphs.length) / 0.72, u * 1.6, R * 0.16);
  const ink = strong(ctx, on);
  if (ctx.on('text')) glyphs.forEach((ch, i) => {
    const a = -Math.PI / 2 + (i / glyphs.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    const n = rawText(ctx, { layer: 'ornament', role: 'texture', text: ch, x, y, size: sz, family: f.family, weight: f.weight, fill: ink, anchor: 'middle', tag: 'texture' });
    ctx.occupied.pop();
    n.rotate = (a * 180) / Math.PI + 90; n.box = { x, y, w: 1, h: 1 };
  });
  const A = land ? { x: C.x, y: C.y, w: C.w * 0.4, h: C.h } : { x: C.x, y: cy + R * 1.15, w: C.w, h: C.y + C.h - cy - R * 1.15 };
  header(ctx, C, on, 'top');
  bigTitle(ctx, { x: A.x, y: A.y + (land ? u * 8 : u * 2), w: A.w, h: A.h * 0.55 }, on, { align: 'start', valign: 'top', size: Math.min(headlineSize(ctx, A.w) * 0.8, u * 10), withSub: true });
  groupArray(ctx, { x: A.x, y: A.y + A.h * 0.7, w: A.w, h: A.h * 0.3 }, on, land ? 2 : 3, { valign: 'bottom', maxPerRow: land ? 2 : 3 });
}

export const COMPOSERS_V3 = { cover, index, echo, knockout, vertical, quote, ring };
export type V3Comp = keyof typeof COMPOSERS_V3;
export function stickersFor(ctx: Ctx) {
  // sparing sticker accents on image compositions: a tag, a round badge or tape, only on plain spots
  const { grid: g, u, pal } = ctx;
  const C = g.content;
  const k = ctx.rd.weighted({ round: 2, tag: 1.4, tape: 1, barcode: 1 });
  const ink = relLum(pal.accent) > 0.4 ? '#141414' : '#f6f4ef';
  if (k === 'round') roundSticker(ctx, C.x + C.w - u * 9, C.y + u * 14, u * 7.5, pal.accent, ink, [((v: string) => ctx.texts.facts?.sticker?.[0] ?? v)(ctx.rd.pick(['NEW', 'FREE', 'OPEN', 'LIVE', '限定', '新刊'])), ctx.texts.meta[0]?.t?.slice(0, 10) ?? '']);
  else if (k === 'tag') tagSticker(ctx, C.x + C.w - u * 24, C.y + C.h - u * 18, u * 22, u * 6.5, pal.accent, ink, `${issue(ctx)} / ${year(ctx)}`);
  else if (k === 'barcode') barcode(ctx, C.x + C.w - u * 14, C.y + C.h - u * 9, u * 13, u * 5, '#111111', '#f6f4ef');
  else {
    const im = ctx.nodes.find((n) => n.kind === 'image' && !n.cutout && n.w < ctx.W * 0.8);
    if (im && im.kind === 'image') tape(ctx, im.x + im.w * 0.15, im.y, u * 10, -12);
  }
}
