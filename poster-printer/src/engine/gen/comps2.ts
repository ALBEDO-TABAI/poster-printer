// Art direction v2 compositions: one committed idea per poster, learned from contemporary generative poster tools
// (principles only): typography-only sheets with a faint giant numeral, edge-bleeding condensed headlines, ghost +
// reveal photo treatments, bento cards cut from one photo, translucent veils, single-photo mosaics and small insets.
import type { Ctx, Align, ImageAsset } from './ctx';
import type { Rect } from './grid';
import type { Shape, TextNode, ImgFilter } from '../types';
import { breakWords } from '../text/breaker';
import { wcag, relLum } from '../color/contrast';
import { mix } from '../color/convert';
import { tonal } from '../color/strategy';
import { roundedPath, tornPath, archPath, rectPath, stampPath, shardPath, wedgePath, halfDiscPath, stairPath } from './masks';
import { header, groupArray, bigTitle, img, headlineSize, prose } from './comps';
import type { PT } from './pick';
import { zhHeavy } from './comps3';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pad2 = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- helpers
/** a raw single/multi-line text node with a measured box (baseline-positioned lines) */
export function rawText(ctx: Ctx, o: { id?: string; layer?: TextNode['layer']; role: string; text: string; lang?: 'en' | 'zh'; x: number; y: number; size: number; family: string; weight: number; fill: string; anchor?: Align; tracking?: number; opacity?: number; clip?: Shape; stroke?: string; sw?: number; leading?: number; tag?: string }): TextNode {
  const lines = o.text.split('\n');
  const zh = o.lang === 'zh' || /[\u4e00-\u9fff]/.test(o.text);
  const sp = { family: o.family, weight: o.weight, size: o.size, tracking: o.tracking ?? 0 };
  const w = Math.max(...lines.map((l) => ctx.measure.width(l, sp)));
  const cap = (zh ? 0.86 : ctx.measure.metrics(sp).cap) * o.size;
  const lead = (o.leading ?? 1) * o.size;
  const anchor = o.anchor ?? 'start';
  const bx = anchor === 'start' ? o.x : anchor === 'middle' ? o.x - w / 2 : o.x - w;
  const node: TextNode = {
    kind: 'text', id: o.id ?? ctx.id('rt'), layer: o.layer ?? 'text', role: o.role, lang: zh ? 'zh' : 'en',
    lines: lines.map((l, i) => ({ text: l, x: o.x, y: o.y + i * lead })), size: o.size, family: o.family, weight: o.weight, tracking: o.tracking ?? 0,
    fill: o.fill, anchor, box: { x: bx, y: o.y - cap, w, h: cap + (lines.length - 1) * lead }, raw: o.text, opacity: o.opacity, clip: o.clip, stroke: o.stroke, sw: o.sw, tag: o.tag,
  };
  ctx.add(node);
  if (node.layer === 'text' && !o.clip) ctx.occupied.push(node.box);
  return node;
}
const canvasClip = (ctx: Ctx): Shape => ({ type: 'rect', x: 0, y: 0, w: ctx.W, h: ctx.H });
const enWord = (ctx: Ctx) => {
  const all = [ctx.texts.headline, ctx.texts.sub, ...ctx.texts.groups.map((g) => g.main), ...ctx.texts.words].filter((t) => t.lang === 'en');
  for (const t of all) { const w = t.t.split(/\s+/).find((x) => /^[A-Za-z]{3,9}$/.test(x)); if (w) return w; }
  return null;
};
/** the poster's anchor glyph: a numeral, letter or hanzi drawn from the copy */
function anchorText(ctx: Ctx, kind: 'numeral' | 'letter'): string {
  if (kind === 'numeral') { const v = ctx.rd.pick([pad2(ctx.rd.int(1, 12)), pad2(ctx.rd.int(1, 31)), String(ctx.rd.int(2, 9)), pad2(ctx.rd.int(10, 99))]); return ctx.texts.facts?.numeral || v; }
  const hl = ctx.texts.headline;
  if (hl.lang === 'zh') return Array.from(hl.t.replace(/[\s，。、！？：；“”「」]/g, ''))[0] ?? '白';
  const w = enWord(ctx);
  return (w ? w[0] : 'R').toUpperCase();
}
/** faint giant tonal glyph that sits on the field (does not count as copy, never collides) */
export function anchorGlyph(ctx: Ctx, t: string, o: { hFrac: number; ax: 'start' | 'middle' | 'end'; ay: 'top' | 'bottom' | 'middle'; bleed?: number; color?: string; outline?: boolean; opacity?: number; family?: string; weight?: number }) {
  if (!ctx.on('zones')) return null;
  const { W, H } = ctx;
  const zh = /[\u4e00-\u9fff]/.test(t);
  const fam = o.family ? { family: o.family, weight: o.weight ?? 400 } : zh ? ctx.fonts.glyphZh : ctx.fonts.glyph;
  const sp = { family: fam.family, weight: fam.weight, size: 100, tracking: -0.02 };
  const w1 = ctx.measure.width(t, sp) / 100;
  const capR = zh ? 0.86 : ctx.measure.metrics(sp).cap;
  let size = (H * o.hFrac) / capR;
  size = Math.min(size, (W * (1.05 + (o.bleed ?? 0))) / Math.max(0.3, w1));
  const cap = capR * size, b = (o.bleed ?? 0) * size;
  const x = o.ax === 'start' ? -b * 0.6 + ctx.u * 0.5 : o.ax === 'end' ? W + b * 0.6 - ctx.u * 0.5 : W / 2;
  const y = o.ay === 'top' ? cap - b * 0.4 + ctx.u * 2 : o.ay === 'bottom' ? H + b * 0.3 - ctx.u * 1.5 : H / 2 + cap / 2;
  // a committed anchor: either a clear tonal step of the field or the accent at full strength
  const accentOK = wcag(ctx.pal.accent, ctx.pal.bg) >= 1.7 && !o.outline;
  const col = o.color ?? (accentOK && ctx.rd.chance(0.7) ? ctx.pal.accent : tonal(ctx.pal.bg, ctx.rd.range(0.07, 0.11)));
  return rawText(ctx, { id: ctx.id('anchor'), layer: 'zones', role: 'anchor', text: t, x, y, size, family: fam.family, weight: fam.weight, fill: o.outline ? 'none' : col, stroke: o.outline ? col : undefined, sw: o.outline ? Math.max(1.5, size * 0.006) : undefined, anchor: o.ax, tracking: -0.02, clip: canvasClip(ctx), opacity: o.opacity, tag: 'anchor' });
}
/** hairline in the quiet ink of the field */
export function hair(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, op = 0.7, col?: string) {
  if (!ctx.on('lines')) return;
  ctx.add({ kind: 'line', id: ctx.id('hl'), layer: 'lines', x1, y1, x2, y2, stroke: col ?? ctx.textColor(ctx.pal.bg, 10), sw: Math.max(1, ctx.u * 0.09), opacity: op });
}
const fitSize = (ctx: Ctx, lines: string[], fam: string, weight: number, targetW: number, tracking = 0) => {
  const w100 = Math.max(...lines.map((l) => ctx.measure.width(l, { family: fam, weight, size: 100, tracking })));
  return (targetW / Math.max(1, w100)) * 100;
};
/** crisp photo treatment choice (duotone only on calm images, never on top of another treatment) */
function crisp(ctx: Ctx, asset: ImageAsset): ImgFilter {
  if (ctx.rd.chance(0.18)) return { grayscale: true, contrast: 1.08 };
  return {};
}
const meanDetail = (a: ImageAsset) => (a.detail?.length ? a.detail.reduce((s, v) => s + v, 0) / a.detail.length : 0.3);
/** small-caps style label, tracked open */
function label(ctx: Ctx, t: string, x: number, y: number, on: string, o: { anchor?: Align; size?: number; weight?: number; op?: number } = {}) {
  const f = ctx.fonts.en['small.note'];
  const size = o.size ?? ctx.size('meta');
  return rawText(ctx, { role: 'small.note', text: t, x, y, size, family: f.family, weight: o.weight ?? Math.max(500, f.weight), fill: ctx.textColor(on, size), anchor: o.anchor, tracking: 0.12, opacity: o.op });
}

// ---------------------------------------------------------------- 1. typography-only
function typo(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const land = W > H * 1.15;
  const v = ctx.rng.weighted({ numeral: 2.5, stack: 2, centered: 1.5, index: 2, block: 3.5 });
  const outline = ctx.rd.chance(0.18);
  if (v === 'numeral') {
    const right = ctx.rng.chance(0.65);
    anchorGlyph(ctx, anchorText(ctx, 'numeral'), { hFrac: land ? 0.86 : ctx.rng.range(0.55, 0.72), ax: right ? 'end' : 'start', ay: 'bottom', bleed: ctx.rng.range(0, 0.12), outline });
    header(ctx, { x: C.x, y: C.y, w: C.w, h: 0 }, on, 'top');
    const hw = land ? C.w * 0.5 : C.w * 0.78;
    bigTitle(ctx, { x: right ? C.x : C.x + C.w - hw, y: C.y + u * 7, w: hw, h: C.h * 0.38 }, on, { align: right ? 'start' : 'end', size: Math.min(headlineSize(ctx, hw), u * ctx.rng.range(land ? 12 : 9, land ? 16 : 13)), withNote: true });
    const gh = ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + u * 2;
    groupArray(ctx, { x: right ? C.x : C.x + C.w * 0.45, y: C.y + C.h - gh, w: C.w * 0.55, h: gh }, on, land ? 3 : 2, { valign: 'bottom', maxPerRow: land ? 3 : 2 });
    if (land) prose(ctx, { x: right ? C.x : C.x + C.w - hw, y: C.y + C.h * 0.5, w: hw * 0.45, h: C.h * 0.2 }, on, right ? 'start' : 'end', 0);
  } else if (v === 'stack') {
    header(ctx, { x: C.x, y: C.y, w: C.w, h: 0 }, on, 'top');
    const hs = headlineSize(ctx, C.w) * ctx.rng.range(0.9, 1.15);
    const h = bigTitle(ctx, { x: C.x, y: C.y + u * 6, w: C.w, h: C.h * 0.55 }, on, { align: 'start', size: hs, mode: 'words', lines: 3, withSub: true });
    const ry = C.y + u * 6 + h + u * 3;
    hair(ctx, C.x, ry, C.x + C.w, ry);
    anchorGlyph(ctx, anchorText(ctx, 'letter'), { hFrac: land ? 0.7 : 0.48, ax: ctx.rng.chance(0.5) ? 'end' : 'start', ay: 'bottom', bleed: 0.08, outline });
    const colW = (C.w - u * 3) / 2;
    const py = Math.max(ry + u * 3, C.y + C.h * 0.7);
    prose(ctx, { x: C.x + colW + u * 3, y: py, w: colW * 0.9, h: C.y + C.h - py }, on, 'start', 0);
    groupArray(ctx, { x: C.x, y: C.y + C.h - u * 10, w: colW, h: u * 10 }, on, 1, { valign: 'bottom', maxPerRow: 1 });
  } else if (v === 'centered') {
    anchorGlyph(ctx, anchorText(ctx, ctx.rd.chance(0.5) ? 'letter' : 'numeral'), { hFrac: land ? 0.82 : 0.5, ax: 'middle', ay: 'middle', outline });
    const T = ctx.texts;
    const hw = C.w * (land ? 0.55 : 0.8);
    const cy = H * ctx.rng.range(0.4, 0.52);
    const small = label(ctx, `— ${(T.meta[0]?.t || 'No.').toUpperCase()} —`, W / 2, cy - u * 12, on, { anchor: 'middle' });
    void small;
    bigTitle(ctx, { x: W / 2 - hw / 2, y: cy - u * 8, w: hw, h: H * 0.35 }, on, { align: 'middle', size: Math.min(headlineSize(ctx, hw), u * (land ? 16 : 12)), withNote: true });
    header(ctx, { x: C.x, y: C.y, w: C.w, h: C.h }, on, 'bottom', 1);
    hair(ctx, W / 2 - u * 4, C.y + u * 2, W / 2 + u * 4, C.y + u * 2, 0.8);
  } else if (v === 'block') {
    // a solid colour block carrying the giant numeral, copy on the open field
    const acc = wcag(pal.accent, on) > 1.5 ? pal.accent : relLum(on) > 0.4 ? pal.dark : pal.light;
    const topB = ctx.rng.chance(0.55);
    const blk: Rect = land ? { x: ctx.rng.chance(0.5) ? 0 : W * 0.55, y: 0, w: W * 0.45, h: H } : topB ? { x: 0, y: 0, w: W, h: H * ctx.rng.range(0.42, 0.55) } : { x: 0, y: H * ctx.rng.range(0.5, 0.6), w: W, h: H };
    blk.h = Math.min(blk.h, H - blk.y);
    if (ctx.on('zones')) ctx.add({ kind: 'rect', id: ctx.id('blk'), layer: 'zones', x: blk.x, y: blk.y, w: blk.w, h: blk.h, fill: acc });
    const t = anchorText(ctx, ctx.rd.chance(0.6) ? 'numeral' : 'letter');
    const fam = ctx.fonts.glyph;
    const capR = /[\u4e00-\u9fff]/.test(t) ? 0.86 : ctx.measure.metrics({ family: fam.family, weight: fam.weight, size: 100, tracking: 0 }).cap;
    const sz = Math.min(fitSize(ctx, [t], fam.family, fam.weight, blk.w * 0.92, -0.02), (blk.h * 0.92) / capR);
    rawText(ctx, { layer: 'zones', role: 'anchor', text: t, x: blk.x + blk.w / 2, y: blk.y + blk.h / 2 + (capR * sz) / 2, size: sz, family: fam.family, weight: fam.weight, fill: ctx.textColor(acc, 200), anchor: 'middle', tracking: -0.02, clip: { type: 'rect', ...blk }, tag: 'anchor' });
    ctx.occupied.push(blk);
    const free: Rect = land ? (blk.x > 0 ? { x: C.x, y: C.y, w: blk.x - C.x - u * 4, h: C.h } : { x: blk.w + u * 4, y: C.y, w: C.x + C.w - blk.w - u * 4, h: C.h }) : topB ? { x: C.x, y: blk.y + blk.h + u * 4, w: C.w, h: C.y + C.h - blk.y - blk.h - u * 4 } : { x: C.x, y: C.y, w: C.w, h: blk.y - C.y - u * 4 };
    const gh = ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + u * 2;
    if (!topB || land) header(ctx, { x: free.x, y: free.y, w: free.w, h: 0 }, on, 'top');
    bigTitle(ctx, { x: free.x, y: free.y + (!topB || land ? u * 5 : 0), w: free.w, h: free.h - gh - u * 6 }, on, { align: 'start', valign: topB && !land ? 'top' : 'bottom', size: Math.min(headlineSize(ctx, free.w), u * (land ? 14 : 12)), withSub: true });
    groupArray(ctx, { x: free.x, y: free.y + free.h - gh, w: free.w, h: gh }, on, 2, { valign: 'bottom', maxPerRow: 2 });
  } else {
    // index: numbered list down one column, headline at the foot, numeral top corner
    anchorGlyph(ctx, anchorText(ctx, 'numeral'), { hFrac: land ? 0.6 : 0.36, ax: 'end', ay: 'top', bleed: 0.05, outline });
    const lw = land ? C.w * 0.32 : C.w * 0.5;
    let y = C.y + u * 3;
    const n = Math.min(5, ctx.texts.groups.length);
    for (let i = 0; i < n; i++) {
      const gm = ctx.texts.groups[i].main;
      label(ctx, pad2(i + 1), C.x, y + ctx.size('smallSub'), on, { size: ctx.size('meta') });
      const r = ctx.text(gm, 'small.main', { x: C.x + u * 5, y, w: lw, h: u * 6 }, { size: ctx.size('smallSub') * 1.25, on, mode: 'single', fit: true });
      y += Math.max(r.h, u * 2) + u * 1.6;
      hair(ctx, C.x, y - u * 0.8, C.x + lw + u * 5, y - u * 0.8, 0.35);
    }
    const hs = headlineSize(ctx, C.w);
    bigTitle(ctx, { x: C.x, y: C.y + C.h * 0.45, w: C.w, h: C.h * 0.55 }, on, { align: 'start', valign: 'bottom', size: hs, withSub: true });
  }
}

// ---------------------------------------------------------------- 2. edge-bleeding condensed headline
function edge(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const hl = ctx.texts.headline;
  const zh = hl.lang === 'zh';
  const fam = zh ? zhHeavy(ctx) : (() => { const f = ctx.rd.pick(['Anton', 'Bebas Neue', 'Oswald', 'Anton']); return { family: f, weight: f === 'Oswald' ? 700 : 400 }; })();
  const raw = zh ? hl.t.replace(/[\s，。、！？：；]/g, '') : hl.t.toUpperCase();
  const words = zh ? Array.from(raw) : raw.split(/\s+/);
  const nLines = zh ? (words.length > 4 ? 2 : 1) : Math.min(3, words.length > 3 ? 3 : words.length);
  let lines: string[];
  if (zh) { const per = Math.ceil(words.length / nLines); lines = []; for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join('')); }
  else lines = breakWords(raw, nLines, (t) => ctx.measure.width(t, { family: fam.family, weight: fam.weight, size: 100, tracking: -0.005 }));
  lines = lines.slice(0, 3);
  const bleed = ctx.rng.range(0.02, 0.06);
  // a short hanzi headline cropped at the edge reads as a mistake: it sits whole on the margin instead
  const shortZh = zh && words.length <= 4;
  let size = fitSize(ctx, lines, fam.family, fam.weight, shortZh ? C.w : W * (1 + bleed * 2), -0.005);
  const sp = { family: fam.family, weight: fam.weight, size: 100, tracking: -0.005 };
  const capR = zh ? 0.86 : ctx.measure.metrics(sp).cap;
  const lead = zh ? 1.0 : 0.9;
  const maxH = H * (W > H * 1.5 ? 0.5 : W > H ? 0.62 : 0.58);
  const hOf = (s: number) => capR * s + (lines.length - 1) * s * lead;
  let anchor: Align = 'middle', x = W / 2;
  if (hOf(size) > maxH) { size = maxH / (capR + (lines.length - 1) * lead); anchor = 'start'; x = C.x - u * 0.6; }
  const top = ctx.rng.chance(0.5);
  const cap = capR * size;
  const blockH = hOf(size);
  if (shortZh) { anchor = 'start'; x = C.x; }
  const y0 = shortZh ? (top ? C.y + cap : C.y + C.h - blockH + cap) : top ? cap - cap * ctx.rng.range(0.02, 0.1) : H - blockH + cap + cap * ctx.rng.range(0.02, 0.08);
  const fill = ctx.rd.chance(0.35) && wcag(pal.accent, on) > 3 ? pal.accent : ctx.textColor(on, 200);
  const hNode = rawText(ctx, { id: ctx.id('edge'), role: 'big.main', text: lines.join('\n'), lang: zh ? 'zh' : 'en', x, y: y0, size, family: fam.family, weight: fam.weight, fill, anchor, tracking: -0.005, leading: lead });
  // the micro system lives in the remaining band
  const R = top ? { x: C.x, y: hNode.box.y + hNode.box.h + u * 4, w: C.w, h: 0 } : { x: C.x, y: C.y, w: C.w, h: 0 };
  R.h = top ? C.y + C.h - R.y : hNode.box.y - u * 4 - C.y;
  if (R.h < u * 8) return;
  const asset = img(ctx);
  const withImg = !!asset && ctx.on('images') && !ctx.plan.typeOnly && ctx.rng.chance(W > H * 1.5 || shortZh ? 0.9 : 0.55);
  const cols = W > H ? 4 : 3;
  const cw = (R.w - u * 2.4 * (cols - 1)) / cols;
  const colX = (i: number) => R.x + i * (cw + u * 2.4);
  if (withImg && asset) {
    const iw = ctx.rng.chance(0.5) ? cw : cw * 2 + u * 2.4;
    const ix = colX(ctx.rng.chance(0.5) ? cols - 1 : 0) - (iw > cw && ctx.rng.chance(0.5) ? 0 : 0);
    const fr = { x: Math.min(ix, R.x + R.w - iw), y: top ? R.y + u * 2 : R.y, w: iw, h: R.h - u * 2 };
    const clip: Shape | undefined = ctx.plan.material === 'torn' ? { type: 'path', d: tornPath(ctx.rd, fr, { t: true, b: true }, 0.4) } : undefined;
    const node = ctx.image(asset, fr, { filter: crisp(ctx, asset), clip });
    if (ctx.plan.material === 'halftone') node.halftone = { ink: ctx.textColor(on, 40), paper: on, cell: u * 0.9 };
    ctx.occupied.push(fr);
  }
  const free = [...Array(cols).keys()].map((i) => ({ x: colX(i), y: R.y + (top ? u * 2 : 0), w: cw, h: R.h - u * 2 })).filter((b) => !ctx.occupied.some((o) => o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y));
  const T = ctx.texts;
  if (free[0]) ctx.group({ main: T.sub, note: T.note }, 'small', free[0], { mainSize: ctx.size('smallMain') * 0.9, align: 'start', valign: top ? 'top' : 'bottom', on, mode: 'words', lines: 3 });
  if (free[1]) prose(ctx, { ...free[1], h: free[1].h * 0.8 }, on, 'start', 0);
  if (free[2]) ctx.group({ main: T.groups[0].main, note: T.groups[0].note }, 'small', free[2], { mainSize: ctx.size('smallSub') * 1.3, align: free[2].x + free[2].w > W - C.x - 2 ? 'end' : 'start', valign: top ? 'bottom' : 'top', on, mode: 'words', lines: 2 });
  // cropped paragraph texture running off the canvas edge
  if (ctx.rng.chance(0.45) && ctx.on('zones')) {
    const txt = T.prose.map((p) => p.t).join(' ').repeat(3);
    const sz = ctx.size('note') * 0.95;
    const f = ctx.role('small.note', T.prose[0]?.lang ?? 'en');
    const bw = W * 0.42;
    const by = top ? H - u * 3 - sz * 9 : u * 3;
    const lines2: string[] = [];
    let cur = '';
    for (const wd of txt.split(/(\s+)/)) { if (ctx.measure.width(cur + wd, { family: f.family, weight: f.weight, size: sz, tracking: 0 }) > bw * 1.4) { lines2.push(cur.trim()); cur = wd; if (lines2.length >= 8) break; } else cur += wd; }
    rawText(ctx, { layer: 'zones', role: 'texture', text: lines2.join('\n'), x: W - bw * 0.95, y: by + sz, size: sz, family: f.family, weight: f.weight, fill: ctx.textColor(on, 10), leading: 1.45, opacity: 0.4, clip: { type: 'rect', x: W - bw, y: by - sz, w: bw, h: sz * 11 }, tag: 'texture' });
  }
  header(ctx, { x: C.x, y: C.y, w: C.w, h: C.h }, on, top ? 'bottom' : 'top', 2);
}

// ---------------------------------------------------------------- 3. ghost + reveal (same photo, washed + crisp)
function ghost(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const asset = img(ctx);
  if (!asset || !ctx.on('images')) return typo(ctx);
  const on = pal.bg;
  const full = { x: 0, y: 0, w: W, h: H };
  const dark = relLum(on) < 0.2;
  const ghostShade = dark ? tonal(on, 0.32) : tonal(on, 0.3);
  ctx.image(asset, full, { filter: { duotone: dark ? [on, ghostShade] : [ghostShade, on] }, opacity: ctx.rng.range(0.5, 0.75), id: ctx.id('ghost') });
  const fx = 0.5, fy = 0.5;
  const kind = ctx.rng.weighted({ window: 3, strip: 2, shard: 1.4, word: 1.2, arch: 1, stamp: ctx.plan.material === 'stamp' ? 3 : 0.3 });
  const land = W > H * 1.15;
  let clip: Shape;
  let reveal: Rect;
  const side = ctx.rng.chance(0.5);
  let textArea: Rect;
  if (kind === 'strip') {
    const sw = W * ctx.rng.range(0.24, 0.36);
    const sx = side ? W * ctx.rng.range(0.52, 0.7) - sw / 2 + sw / 2 : W * ctx.rng.range(0.3, 0.48) - sw / 2;
    reveal = land ? { x: 0, y: H * 0.3, w: W, h: H * 0.32 } : { x: Math.max(0, sx), y: 0, w: sw, h: H };
    clip = { type: 'path', d: rectPath(reveal) };
    textArea = land ? { x: C.x, y: reveal.y + reveal.h + u * 3, w: C.w, h: C.y + C.h - reveal.y - reveal.h - u * 3 } : side ? { x: C.x, y: C.y, w: reveal.x - C.x - u * 3, h: C.h } : { x: reveal.x + reveal.w + u * 3, y: C.y, w: C.x + C.w - reveal.x - reveal.w - u * 3, h: C.h };
  } else if (kind === 'word' && ctx.texts.headline.lang === 'en' && enWord(ctx)) {
    const word = enWord(ctx)!.toUpperCase();
    const fam = ctx.fonts.glyph;
    const size = fitSize(ctx, [word], fam.family, fam.weight, C.w * 1.0, -0.02);
    const capR = ctx.measure.metrics({ family: fam.family, weight: fam.weight, size: 100, tracking: 0 }).cap;
    const sz = Math.min(size, (H * 0.36) / capR);
    const by = H * (side ? 0.42 : 0.62);
    clip = { type: 'text', lines: [{ text: word, x: W / 2, y: by }], size: sz, family: fam.family, weight: fam.weight, tracking: -0.02, anchor: 'middle' };
    reveal = { x: C.x, y: by - capR * sz, w: C.w, h: capR * sz };
    textArea = side ? { x: C.x, y: by + u * 5, w: C.w, h: C.y + C.h - by - u * 5 } : { x: C.x, y: C.y, w: C.w, h: reveal.y - C.y - u * 4 };
  } else {
    const ww = land ? W * ctx.rng.range(0.34, 0.44) : C.w * ctx.rng.range(0.56, 0.74);
    const wh = land ? H * ctx.rng.range(0.56, 0.7) : H * ctx.rng.range(0.34, 0.46);
    const wx = land ? (side ? W - C.x - ww : C.x) : side ? C.x + C.w - ww : C.x;
    const wy = land ? (H - wh) / 2 : ctx.rng.chance(0.55) ? C.y + u * 7 : C.y + C.h - wh - u * 2;
    reveal = { x: wx, y: wy, w: ww, h: wh };
    const d = kind === 'shard' ? shardPath(reveal, ctx.rng.pick([-0.18, 0.18])) : kind === 'arch' ? archPath(reveal) : kind === 'stamp' ? stampPath(reveal, u * 1.1) : roundedPath(reveal, Math.min(ww, wh) * ctx.rng.range(0.04, 0.12));
    clip = { type: 'path', d };
    textArea = C;
  }
  // copy goes into the largest calm region beside the reveal
  {
    const rv = reveal;
    const cands: Rect[] = [
      { x: C.x, y: C.y + u * 5, w: C.w, h: rv.y - C.y - u * 9 },
      { x: C.x, y: rv.y + rv.h + u * 4, w: C.w, h: C.y + C.h - rv.y - rv.h - u * 4 },
      { x: C.x, y: C.y + u * 5, w: rv.x - C.x - u * 4, h: C.h - u * 5 },
      { x: rv.x + rv.w + u * 4, y: C.y + u * 5, w: C.x + C.w - rv.x - rv.w - u * 4, h: C.h - u * 5 },
    ].filter((r) => r.w >= u * 22 && r.h >= u * 14);
    const prefer = kind === 'word' ? cands : cands;
    if (prefer.length) textArea = prefer.sort((a, b) => b.w * Math.min(b.h, u * 60) - a.w * Math.min(a.h, u * 60))[0];
    else textArea = { x: C.x, y: C.y + u * 5, w: C.w, h: C.h * 0.3 };
  }
  const crispNode = ctx.image(asset, full, { clip, filter: crisp(ctx, asset), fx, fy });
  if (ctx.plan.material === 'halftone' && kind !== 'word') crispNode.halftone = { ink: relLum(on) < 0.2 ? pal.light : pal.dark, paper: pal.accent !== on && wcag(pal.accent, pal.dark) > 3 ? pal.accent : pal.light, cell: u * 0.85 };
  ctx.occupied.push(reveal);
  // copy: headline + one group, in the calm part of the field
  const align: Align = textArea.x > W / 2 - u ? 'end' : 'start';
  const bt = { ...textArea };
  const gh = ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + u * 2;
  bigTitle(ctx, { ...bt, h: Math.max(u * 10, bt.h - gh - u * 2) }, on, { align, valign: textArea.y > H / 2 ? 'top' : 'bottom', size: Math.min(headlineSize(ctx, bt.w), u * 12), withSub: true });
  groupArray(ctx, { x: bt.x, y: bt.y + bt.h - gh, w: bt.w, h: gh }, on, Math.min(2, ctx.num('smallGroups')), { valign: 'bottom', align, maxPerRow: 2 });
  header(ctx, { x: C.x, y: C.y, w: C.w, h: 0 }, on, 'top');
}

// ---------------------------------------------------------------- 4. bento cards from one photo
type Card = { r: [number, number, number, number]; k: 'title' | 'photo' | 'photo2' | 'photo3' | 'outline' | 'tone' };
const BENTO: Card[][] = [
  [{ r: [0, 0, 4, 2], k: 'title' }, { r: [4, 0, 6, 2], k: 'tone' }, { r: [0, 2, 6, 5], k: 'photo' }, { r: [0, 5, 3, 8], k: 'photo2' }, { r: [3, 5, 6, 8], k: 'outline' }],
  [{ r: [0, 0, 4, 5], k: 'photo' }, { r: [4, 0, 6, 3], k: 'title' }, { r: [4, 3, 6, 5], k: 'photo2' }, { r: [0, 5, 2, 8], k: 'outline' }, { r: [2, 5, 6, 8], k: 'photo3' }],
  [{ r: [0, 0, 6, 3], k: 'title' }, { r: [0, 3, 3, 8], k: 'photo' }, { r: [3, 3, 6, 6], k: 'photo2' }, { r: [3, 6, 6, 8], k: 'tone' }],
  [{ r: [0, 0, 6, 4], k: 'photo' }, { r: [0, 4, 2, 6], k: 'outline' }, { r: [2, 4, 4, 6], k: 'photo2' }, { r: [4, 4, 6, 6], k: 'tone' }, { r: [0, 6, 6, 8], k: 'title' }],
  [{ r: [0, 0, 3, 3], k: 'tone' }, { r: [3, 0, 6, 5], k: 'photo' }, { r: [0, 3, 3, 8], k: 'title' }, { r: [3, 5, 6, 8], k: 'photo2' }],
];
function bento(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const asset = img(ctx);
  if (!asset || !ctx.on('images')) return typo(ctx);
  const on = pal.bg;
  const land = W > H * 1.15;
  const footer = ctx.rng.chance(0.4);
  const fh = footer ? u * 5.5 : 0;
  const gap = u * ctx.rng.range(1.0, 1.8);
  const A = { x: g.m.l * 0.7, y: g.m.t * 0.7, w: W - (g.m.l + g.m.r) * 0.7, h: H - (g.m.t + g.m.b) * 0.7 - (footer ? fh + gap : 0) };
  const rad = ctx.num('cornerRadius') * u / 12 * ctx.rng.range(0.6, 1.3);
  const tpl = ctx.rng.pick(BENTO);
  const mx = ctx.rng.chance(0.5), my = ctx.rng.chance(0.3);
  const [NC, NR] = land ? [8, 6] : [6, 8];
  const rectOf = (c: Card): Rect => {
    let [c0, r0, c1, r1] = c.r;
    if (mx) [c0, c1] = [6 - c1, 6 - c0];
    if (my) [r0, r1] = [8 - r1, 8 - r0];
    if (land) [c0, r0, c1, r1] = [r0, c0, r1, c1];
    const cw = A.w / NC, rh = A.h / NR;
    return { x: A.x + c0 * cw + (c0 > 0 ? gap / 2 : 0), y: A.y + r0 * rh + (r0 > 0 ? gap / 2 : 0), w: (c1 - c0) * cw - (c0 > 0 ? gap / 2 : 0) - (c1 < NC ? gap / 2 : 0), h: (r1 - r0) * rh - (r0 > 0 ? gap / 2 : 0) - (r1 < NR ? gap / 2 : 0) };
  };
  const titleFill = ctx.rng.chance(0.6) && wcag(pal.accent, on) > 1.25 ? pal.accent : relLum(on) > 0.5 ? pal.dark : pal.light;
  const toneFill = pal.alt !== on && wcag(pal.alt, on) > 1.12 ? pal.alt : tonal(on, 0.08);
  const outlined = ctx.rng.chance(0.3); // whole set outlined instead of filled
  const lw = Math.max(1.2, u * 0.16);
  let photoIdx = 0;
  const T = ctx.texts;
  const zooms = [1, ctx.rng.range(1.7, 2.4), ctx.rng.range(2.6, 3.4)];
  const material = ctx.plan.material;
  let materialUsed = false;
  for (const c of tpl) {
    const r = rectOf(c);
    const clipD = roundedPath(r, rad);
    if (c.k.startsWith('photo')) {
      const z = zooms[photoIdx];
      const fxy = photoIdx === 0 ? {} : { fx: ctx.rng.range(0.15, 0.85), fy: ctx.rng.range(0.2, 0.8) };
      let clip: Shape = { type: 'path', d: clipD };
      if (!materialUsed && photoIdx > 0 && material === 'stamp') { clip = { type: 'path', d: stampPath(r, u * 0.9) }; materialUsed = true; }
      else if (!materialUsed && photoIdx > 0 && material === 'torn') { clip = { type: 'path', d: tornPath(ctx.rd, r, { t: true, r: true }, 0.35) }; materialUsed = true; }
      const node = ctx.image(asset, r, { clip, zoom: z, ...fxy, filter: photoIdx > 0 && ctx.rd.chance(0.3) ? { grayscale: true } : {} });
      if (!materialUsed && photoIdx > 0 && material === 'halftone') { node.halftone = { ink: relLum(titleFill) < 0.3 ? titleFill : pal.dark, paper: relLum(titleFill) < 0.3 ? pal.light : titleFill, cell: u * 0.8 }; materialUsed = true; }
      photoIdx++;
      continue;
    }
    const fill = c.k === 'title' ? titleFill : c.k === 'tone' ? toneFill : 'none';
    const stroke = c.k === 'outline' || outlined ? ctx.textColor(on, 20) : undefined;
    const cardOn = outlined || c.k === 'outline' ? on : fill;
    ctx.add({ kind: 'path', id: ctx.id('card'), layer: 'zones', d: clipD, fill: outlined || c.k === 'outline' ? 'none' : fill, stroke, sw: stroke ? lw : undefined });
    const ip = Math.max(u * 2, Math.min(r.w, r.h) * 0.08);
    const inner = { x: r.x + ip, y: r.y + ip, w: r.w - ip * 2, h: r.h - ip * 2 };
    if (c.k === 'title') {
      label(ctx, (T.meta[0]?.t || 'No. 01').toUpperCase(), inner.x, inner.y + ctx.size('meta'), cardOn);
      bigTitle(ctx, { ...inner, y: inner.y + u * 3, h: inner.h - u * 3 }, cardOn, { align: 'start', valign: 'bottom', size: Math.min(headlineSize(ctx, inner.w) * 0.85, inner.h * 0.42), withSub: inner.h > u * 18 });
    } else if (c.k === 'tone') {
      const t = anchorText(ctx, 'numeral');
      const fam = ctx.fonts.glyph;
      const s = Math.min(fitSize(ctx, [t], fam.family, fam.weight, inner.w * 0.9), inner.h * 0.9 / 0.72);
      rawText(ctx, { layer: 'zones', role: 'anchor', text: t, x: inner.x, y: inner.y + inner.h, size: s, family: fam.family, weight: fam.weight, fill: ctx.textColor(cardOn, 200), clip: { type: 'path', d: clipD }, tag: 'anchor' });
      label(ctx, (T.groups[1]?.main.lang === 'en' ? T.groups[1].main.t : 'INDEX').toUpperCase().slice(0, 18), inner.x + inner.w, inner.y + ctx.size('meta'), cardOn, { anchor: 'end' });
    } else {
      ctx.group({ main: T.groups[0].main, note: T.groups[0].note }, 'small', inner, { mainSize: ctx.size('smallMain') * 0.85, align: 'start', valign: 'top', on: cardOn, mode: 'words', lines: 3 });
      const sl = label(ctx, '→', inner.x + inner.w, inner.y + inner.h, cardOn, { anchor: 'end', size: ctx.size('smallSub') * 1.4 });
      void sl;
    }
    ctx.occupied.push(r);
  }
  if (footer) {
    const fy = A.y + A.h + gap;
    const fr = { x: A.x, y: fy, w: A.w, h: fh };
    const ff = relLum(on) > 0.4 ? pal.dark : pal.light;
    ctx.add({ kind: 'path', id: ctx.id('foot'), layer: 'zones', d: roundedPath(fr, Math.min(rad, fh / 2)), fill: ff });
    const n = land ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? (T.meta[1]?.t || 'Edition') : i === n - 1 ? (T.meta[2]?.t || '2026') : T.groups[(i + 2) % T.groups.length].main.t;
      const lang = /[\u4e00-\u9fff]/.test(t) ? 'zh' : 'en';
      const x = fr.x + u * 2.5 + (i * (fr.w - u * 5)) / (n - 1);
      ctx.text({ t: lang === 'en' ? t.toUpperCase() : t, lang } as PT, 'small.note', { x: i === n - 1 ? x - fr.w / n : i === 0 ? x : x - fr.w / n / 2, y: fy + fh / 2 - ctx.size('meta') * 0.5, w: fr.w / n, h: ctx.size('meta') * 1.4 }, { size: ctx.size('meta'), align: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', on: ff, mode: 'single', fit: true });
    }
  }
}

// ---------------------------------------------------------------- 5. veil: translucent colour panels over a full-bleed photo
function veil(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const asset = img(ctx);
  if (!asset || !ctx.on('images')) return typo(ctx);
  const full = { x: 0, y: 0, w: W, h: H };
  const busy = meanDetail(asset) > 0.36;
  ctx.image(asset, full, { filter: busy ? { sat: 0.8, contrast: 0.92 } : {} });
  const sub = asset.subject ? asset.subject.x + asset.subject.w / 2 : asset.focus?.x ?? 0.5;
  const land = W > H * 1.15;
  const right = sub < 0.5;
  // main panel: a column (portrait) / half (landscape) opposite the subject
  const pw = land ? W * ctx.rng.range(0.36, 0.46) : W * ctx.rng.range(0.5, 0.62);
  const panel: Rect = land ? { x: right ? W - pw : 0, y: 0, w: pw, h: H } : ctx.rng.chance(0.5) ? { x: right ? W - pw : 0, y: H * ctx.rng.range(0.32, 0.45), w: pw, h: H } : { x: right ? W - pw : 0, y: 0, w: pw, h: H };
  panel.h = Math.min(panel.h, H - panel.y);
  const clash = ctx.plan.palette === 'clash' || ctx.rng.chance(0.25);
  const pfill = clash ? pal.accent : ctx.rng.chance(0.5) ? pal.bg : pal.accent;
  const op = ctx.rng.range(0.8, 0.9);
  const torn = ctx.plan.material === 'torn' || ctx.rng.chance(0.2);
  const d = torn ? tornPath(ctx.rd, panel, land ? (right ? { l: true } : { r: true }) : panel.y > 0 ? { t: true, ...(right ? { l: true } : { r: true }) } : right ? { l: true } : { r: true }, 0.45) : rectPath(panel);
  ctx.add({ kind: 'path', id: ctx.id('veil'), layer: 'zones', d, fill: pfill, opacity: op });
  // second, smaller panel in a deliberate second colour
  const s2 = ctx.rng.chance(0.4);
  let p2: Rect | null = null;
  if (s2) {
    const w2 = land ? W * 0.2 : W * 0.32, h2 = land ? H * 0.34 : H * 0.18;
    p2 = { x: right ? panel.x - w2 * 0.5 : panel.x + panel.w - w2 * 0.5, y: panel.y > 0 ? panel.y - h2 * 0.6 : H - h2 - (land ? H * 0.1 : H * 0.08), w: w2, h: h2 };
    const f2 = pfill === pal.accent ? (wcag(pal.alt, pal.accent) > 1.4 ? pal.alt : pal.bg) : pal.accent;
    ctx.add({ kind: 'path', id: ctx.id('veil'), layer: 'zones', d: rectPath(p2), fill: f2, opacity: Math.min(0.95, op + 0.05) });
    const t = anchorText(ctx, 'numeral');
    const fam = ctx.fonts.glyph;
    const s = Math.min(fitSize(ctx, [t], fam.family, fam.weight, w2 * 0.7), h2 * 0.75 / 0.72);
    rawText(ctx, { layer: 'zones', role: 'anchor', text: t, x: p2.x + w2 * 0.12, y: p2.y + h2 * 0.85, size: s, family: fam.family, weight: fam.weight, fill: ctx.textColor(f2, 200), clip: { type: 'rect', ...p2 }, tag: 'anchor' });
  }
  const pad = u * 3.5;
  const inner = { x: Math.max(panel.x + pad, C.x), y: Math.max(panel.y + pad, C.y), w: Math.min(panel.w - pad * 2, C.w), h: Math.min(panel.y + panel.h - pad, C.y + C.h) - Math.max(panel.y + pad, C.y) };
  if (p2) { /* keep copy off the small panel */ }
  const on = mix(pfill, '#808080', 0) && pfill;
  header(ctx, { x: inner.x, y: inner.y, w: inner.w, h: 0 }, on, 'top');
  const gh = ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + u * 2;
  bigTitle(ctx, { x: inner.x, y: inner.y + u * 6, w: inner.w, h: inner.h - gh - u * 8 }, on, { align: 'start', valign: ctx.rng.chance(0.5) ? 'top' : 'bottom', size: Math.min(headlineSize(ctx, inner.w), u * 12), withSub: true });
  groupArray(ctx, { x: inner.x, y: inner.y + inner.h - gh, w: inner.w, h: gh }, on, 2, { valign: 'bottom', maxPerRow: 2 });
}

// ---------------------------------------------------------------- 6. mosaic: one photo through a cell pattern / big mask, giant letter anchor
function mosaic(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const asset = img(ctx);
  if (!asset || !ctx.on('images')) return typo(ctx);
  const on = pal.bg;
  const full = { x: 0, y: 0, w: W, h: H };
  const v = ctx.rng.weighted({ cells: 3, stair: 1.4, wedge: 1.2, disc: 1.2 });
  const land = W > H * 1.15;
  const tones = [on, tonal(on, 0.05), pal.alt !== on ? pal.alt : tonal(on, 0.1)];
  if (v === 'cells') {
    const nc = land ? 5 : 3, nr = land ? 3 : 4;
    const cw = W / nc, rh = H / nr;
    const cells: Rect[] = [];
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) cells.push({ x: i * cw, y: j * rh, w: cw, h: rh });
    // photo cells: a diagonal-ish pattern covering ≤ 45 %
    const k = Math.floor(cells.length * ctx.rng.range(0.3, 0.45));
    const order = ctx.rng.shuffle(cells.map((_, i) => i)).sort((a, b) => ((a % nc) + Math.floor(a / nc)) % 2 - ((b % nc) + Math.floor(b / nc)) % 2);
    const photo = new Set(order.slice(0, k));
    // reserve a 2-cell text block + 1 anchor cell that never hold photo
    const letterCell = cells.findIndex((_, i) => !photo.has(i));
    const tiles = cells.map((c, i) => ({ c, i })).filter((x) => !photo.has(x.i));
    for (const t of tiles) {
      const f = t.i === letterCell && ctx.rng.chance(0.5) ? pal.accent : ctx.rd.pick(tones);
      if (f !== on) ctx.add({ kind: 'path', id: ctx.id('tile'), layer: 'zones', d: rectPath(t.c), fill: f });
    }
    ctx.image(asset, full, { clip: { type: 'union', shapes: [...photo].map((i) => ({ type: 'rect' as const, ...cells[i] })) }, filter: crisp(ctx, asset) });
    // giant letter fills one free cell
    const lc = cells[letterCell];
    if (lc) {
      const t = anchorText(ctx, 'letter');
      const fam = ctx.fonts.glyph;
      const lcFill = tiles.find((x) => x.i === letterCell) ? (ctx.nodes.slice().reverse().find((n) => n.kind === 'path' && n.id.startsWith('tile') && (n as { d: string }).d === rectPath(lc)) as { fill?: string } | undefined)?.fill ?? on : on;
      const s = Math.min(fitSize(ctx, [t], fam.family, fam.weight, lc.w * 0.86), (lc.h * 0.86) / 0.72);
      rawText(ctx, { layer: 'zones', role: 'anchor', text: t, x: lc.x + lc.w / 2, y: lc.y + lc.h * 0.5 + s * 0.36, size: s, family: fam.family, weight: fam.weight, fill: ctx.textColor(lcFill, 200), anchor: 'middle', clip: { type: 'rect', ...lc }, tag: 'anchor' });
      ctx.occupied.push(lc);
    }
    // copy: in the largest run of free cells (bottom row preference)
    const free = tiles.filter((x) => x.i !== letterCell).map((x) => x.c);
    const byRow = new Map<number, Rect[]>();
    for (const c of free) { const r = Math.round(c.y / rh); if (!byRow.has(r)) byRow.set(r, []); byRow.get(r)!.push(c); }
    let best: Rect | null = null;
    for (const [, cs] of byRow) {
      cs.sort((a, b) => a.x - b.x);
      let run: Rect[] = [];
      for (const c of cs) {
        if (run.length && Math.abs(run[run.length - 1].x + cw - c.x) > 1) run = [];
        run.push(c);
        const b = { x: run[0].x, y: c.y, w: run.length * cw, h: rh };
        if (!best || b.w > best.w || (b.w === best.w && b.y > best.y)) best = b;
      }
    }
    const tb = best ?? { x: 0, y: H - rh, w: cw, h: rh };
    const tonOn = (() => { const n = ctx.nodes.find((n) => n.kind === 'path' && n.id.startsWith('tile') && (n as { d: string }).d === rectPath({ x: tb.x, y: tb.y, w: cw, h: rh })) as { fill?: string } | undefined; return n?.fill ?? on; })();
    const ip = u * 3;
    bigTitle(ctx, { x: tb.x + ip, y: tb.y + ip, w: tb.w - ip * 2, h: tb.h - ip * 2 }, tonOn, { align: 'start', valign: 'bottom', size: Math.min(headlineSize(ctx, tb.w - ip * 2), (tb.h - ip * 2) * 0.32), withSub: tb.w > cw * 1.5 });
    const other = free.find((c) => c !== (best && byRow.get(Math.round(best.y / rh))?.[0]) && (c.y !== tb.y));
    if (other) {
      const o2 = (ctx.nodes.find((n) => n.kind === 'path' && n.id.startsWith('tile') && (n as { d: string }).d === rectPath(other)) as { fill?: string } | undefined)?.fill ?? on;
      ctx.group({ main: ctx.texts.groups[0].main, note: ctx.texts.groups[0].note }, 'small', { x: other.x + ip, y: other.y + ip, w: other.w - ip * 2, h: other.h - ip * 2 }, { mainSize: ctx.size('smallMain') * 0.8, align: 'start', valign: 'top', on: o2, mode: 'words', lines: 3 });
    }
    return;
  }
  // big single mask variants
  let d: string;
  let photoBox: Rect;
  if (v === 'stair') {
    photoBox = land ? { x: W * 0.4, y: 0, w: W * 0.6, h: H } : { x: 0, y: H * 0.38, w: W, h: H * 0.62 };
    d = stairPath(photoBox, ctx.rng.int(3, 5), ctx.rng.chance(0.5));
  } else if (v === 'wedge') {
    photoBox = land ? { x: W * 0.45, y: 0, w: W * 0.55, h: H } : { x: 0, y: H * 0.42, w: W, h: H * 0.58 };
    d = wedgePath(photoBox, land ? 'r' : 'b', ctx.rng.range(0.2, 0.8));
  } else {
    photoBox = land ? { x: W * 0.5, y: 0, w: W * 0.5, h: H } : { x: 0, y: H * 0.45, w: W, h: H * 0.55 };
    d = halfDiscPath(photoBox, land ? 'r' : 'b');
  }
  if (ctx.rng.chance(0.5)) ctx.add({ kind: 'path', id: ctx.id('tile'), layer: 'zones', d: rectPath(photoBox), fill: tones[1] });
  ctx.image(asset, full, { clip: { type: 'path', d }, filter: crisp(ctx, asset) });
  const textBox = land ? { x: C.x, y: C.y, w: W * 0.4 - C.x - u * 3, h: C.h } : { x: C.x, y: C.y, w: C.w, h: H * 0.38 - C.y - u * 2 };
  header(ctx, { x: textBox.x, y: textBox.y, w: textBox.w, h: 0 }, on, 'top');
  const t = anchorText(ctx, 'letter');
  anchorGlyph(ctx, t, { hFrac: land ? 0.5 : 0.3, ax: 'end', ay: 'top', bleed: 0.04 });
  bigTitle(ctx, { x: textBox.x, y: textBox.y + u * 5, w: textBox.w * (land ? 1 : 0.8), h: textBox.h - u * 5 }, on, { align: 'start', valign: 'bottom', size: Math.min(headlineSize(ctx, textBox.w), u * 11), withSub: true });
}

// ---------------------------------------------------------------- 7. inset: colour field, small framed photo, wide masthead
function inset(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const asset = img(ctx);
  if (!asset || !ctx.on('images')) return typo(ctx);
  const on = pal.bg;
  const land = W > H * 1.15;
  // masthead: headline set wide and tracked across the top, with hairlines
  const hl = ctx.texts.headline;
  const T = ctx.texts;
  const mh = hl.lang === 'en' && hl.t.length <= 22;
  let y = C.y;
  hair(ctx, C.x, y, C.x + C.w, y, 0.8);
  if (mh) {
    const f = ctx.role('big.main', 'en');
    const word = hl.t.toUpperCase();
    const tr = 0.14;
    const s = Math.min(fitSize(ctx, [word], f.family, f.weight, C.w, tr), u * 9);
    const cap = ctx.measure.metrics({ family: f.family, weight: f.weight, size: s, tracking: tr }).cap * s;
    rawText(ctx, { role: 'big.main', text: word, x: W / 2, y: y + u * 2 + cap, size: s, family: f.family, weight: f.weight, fill: ctx.textColor(on, 80), anchor: 'middle', tracking: tr });
    y += u * 4 + cap;
    hair(ctx, C.x, y, C.x + C.w, y, 0.8);
  } else {
    y += u * 2;
    const h = bigTitle(ctx, { x: C.x, y, w: C.w, h: C.h * 0.3 }, on, { align: 'middle', size: Math.min(headlineSize(ctx, C.w), u * 9), withSub: false });
    y += h + u * 2;
    hair(ctx, C.x, y, C.x + C.w, y, 0.8);
  }
  // inset photo
  const gh = ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + u * 2;
  const avail = C.y + C.h - (y + u * 4);
  let iw: number, ih: number, ix: number;
  const iy0 = y + u * 4;
  let textR: Rect;
  if (land) {
    ih = Math.max(u * 12, avail - u * 6);
    iw = ih * ctx.rng.range(0.72, 0.92);
    const left = ctx.rng.chance(0.5);
    ix = left ? C.x : C.x + C.w - iw;
    textR = left ? { x: C.x + iw + u * 5, y: iy0, w: C.w - iw - u * 5, h: avail } : { x: C.x, y: iy0, w: C.w - iw - u * 5, h: avail };
  } else {
    iw = W * ctx.rng.range(0.42, 0.56);
    ih = Math.max(u * 12, Math.min(iw * ctx.rng.range(1.0, 1.3), avail - gh - u * 12));
    iw = Math.min(iw, ih * 1.1);
    ix = ctx.rng.chance(0.6) ? (W - iw) / 2 : ctx.rng.chance(0.5) ? C.x : C.x + C.w - iw;
    textR = { x: C.x, y: iy0 + ih + u * 3, w: C.w, h: C.y + C.h - (iy0 + ih + u * 3) };
  }
  const fr = { x: ix, y: iy0 + (land ? 0 : Math.max(0, (avail - gh - u * 12 - ih) * ctx.rng.range(0, 0.4))), w: iw, h: ih };
  if (!land) textR = { x: C.x, y: fr.y + ih + u * 3, w: C.w, h: C.y + C.h - (fr.y + ih + u * 3) };
  const shape = ctx.plan.material === 'stamp' ? 'stamp' : ctx.rng.weighted({ rect: 3, rounded: 2, arch: 1.5, circle: 1, stamp: 0.8 });
  const clip: Shape | undefined = shape === 'stamp' ? { type: 'path', d: stampPath(fr, u * 0.8) } : shape === 'rounded' ? { type: 'path', d: roundedPath(fr, iw * 0.06) } : shape === 'arch' ? { type: 'path', d: archPath(fr) } : shape === 'circle' ? { type: 'circle', cx: fr.x + iw / 2, cy: fr.y + ih / 2, r: Math.min(iw, ih) / 2 } : undefined;
  if (shape === 'stamp') ctx.add({ kind: 'rect', id: ctx.id('mat'), layer: 'zones', x: fr.x - u * 1.4, y: fr.y - u * 1.4, w: iw + u * 2.8, h: ih + u * 2.8, fill: pal.light });
  const node = ctx.image(asset, fr, { clip, filter: crisp(ctx, asset) });
  if (ctx.plan.material === 'halftone') node.halftone = { ink: ctx.textColor(on, 40), paper: on, cell: u * 0.7 };
  if (shape === 'rect' && ctx.rng.chance(0.5) && ctx.on('lines')) ctx.add({ kind: 'rect', id: ctx.id('frm'), layer: 'lines', x: fr.x - u * 1.2, y: fr.y - u * 1.2, w: iw + u * 2.4, h: ih + u * 2.4, fill: 'none', stroke: ctx.textColor(on, 20), sw: Math.max(1, u * 0.1) });
  ctx.occupied.push(fr);
  if (textR.h < u * 6 || textR.w < u * 12) return;
  // caption, sub and footer groups in the text region
  if (mh) ctx.text(T.sub, 'big.sub', { x: textR.x, y: textR.y, w: Math.min(textR.w, u * 50), h: u * 10 }, { size: ctx.size('bigSub'), on, mode: 'balance', maxLines: 2 });
  ctx.text(T.note, 'small.note', { x: textR.x, y: textR.y + (mh ? u * 9 : 0), w: Math.min(textR.w, u * 34), h: u * 6 }, { size: ctx.size('note'), on, mode: 'greedy', fit: false, align: 'start' });
  const gy = Math.max(textR.y + u * 16, textR.y + textR.h - gh);
  if (textR.y + textR.h - gy >= u * 5) groupArray(ctx, { x: textR.x, y: gy, w: textR.w, h: textR.y + textR.h - gy }, on, land ? 2 : 3, { valign: 'bottom' });
}

export const COMPOSERS_V2 = { typo, edge, ghost, bento, veil, mosaic, inset };
export const meanImageDetail = meanDetail;
void clamp;
