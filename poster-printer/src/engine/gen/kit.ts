// Detail kit, script-lettering layer and faint background geometry for art direction v2. Every item is small or
// tonal, lands only on plain field (never over copy or photos) and runs before direct()/polish() so the budgets
// and contrast repair still see it.
import type { Ctx } from './ctx';
import type { Rect } from './grid';
import type { SceneNode, Shape, ImageNode } from '../types';
import { sampleBg } from './quality';
import { wcag, relLum } from '../color/contrast';
import { tonal } from '../color/strategy';
import { ornament, signature, overlap } from './decor';
import { rectPath } from './masks';
import { rawText, hair } from './comps2';

const SCRIPT_OK = new Set(['inset', 'centered', 'swiss', 'split', 'fan', 'fullbleed', 'cards']);

/** plain field under `b` (no photo, no panel in a different colour, no copy) */
function plain(ctx: Ctx, b: Rect, pad = 0): boolean {
  const bb = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  if (ctx.occupied.some((o) => overlap(o, bb))) return false;
  for (const n of ctx.nodes) if (n.kind === 'text' && n.layer !== 'zones' && overlap(n.box, bb)) return false;
  for (const n of ctx.nodes) if (n.kind === 'image' && overlap(imgBox(n), bb)) return false;
  return sampleBg(ctx, ctx.nodes, bb, ctx.pal.bg).every((c) => wcag(c, ctx.pal.bg) < 1.08);
}
function imgBox(n: ImageNode): Rect {
  const c = n.clip;
  if (c?.type === 'rect') return { x: c.x, y: c.y, w: c.w, h: c.h };
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}
const quiet = (ctx: Ctx) => ctx.textColor(ctx.pal.bg, 10);
const bigImageShare = (ctx: Ctx) => Math.max(0, ...ctx.nodes.filter((n): n is ImageNode => n.kind === 'image' && !n.cutout && (n.opacity ?? 1) > 0.6 && n.clip?.type !== 'text').map((n) => { const b = imgBox(n); return (b.w * b.h) / (ctx.W * ctx.H); }));

function captionRow(ctx: Ctx, where: 'top' | 'bottom') {
  const { W, H, grid: g, u } = ctx;
  const C = g.content;
  const sz = Math.max(8.5, ctx.size('meta') * 0.92);
  const band = where === 'bottom' ? { x: C.x, y: C.y + C.h + u * 0.6, w: C.w, h: H - (C.y + C.h) - u * 1.4 } : { x: C.x, y: u * 1.2, w: C.w, h: C.y - u * 1.8 };
  if (band.h < sz * 2.2 || !plain(ctx, band)) return false;
  const T = ctx.texts;
  const n0 = W > H * 1.3 ? 5 : 4;
  const no = `NO. ${String(ctx.rd.int(1, 48)).padStart(2, '0')}`, yr = String(2020 + ctx.rd.int(4, 7));
  let vals = [T.meta[0]?.t, T.facts?.issue || no, T.meta[1]?.t, T.meta[2]?.t, T.facts?.year || yr].filter(Boolean) as string[];
  if (T.custom) {
    // phase 8: real content never gets invented issue numbers, years or filler meta
    const shown = [T.headline.t, T.sub.t, ...T.groups.slice(0, T.customItems ?? 0).map((g) => g.main.t + ' ' + g.note.t)].join(' ');
    // a footer never repeats what the poster already says (date, venue)
    vals = [...T.meta.slice(0, T.customMeta ?? 0).map((m) => m.t), T.facts?.issue, T.facts?.year].filter((v): v is string => !!v && !shown.includes(v));
    if (vals.length < 2) return false;
  }
  const n = T.custom ? Math.min(n0, vals.length) : n0;
  const col = quiet(ctx);
  const ly = where === 'bottom' ? band.y + u * 0.2 : band.y + band.h - u * 0.2;
  hair(ctx, C.x, ly, C.x + C.w, ly, 0.45, col);
  const f = ctx.fonts.en['small.note'];
  for (let i = 0; i < n; i++) {
    const t = (vals[i % vals.length] || '').toUpperCase().slice(0, 22);
    const x = C.x + (i * C.w) / n;
    const y = where === 'bottom' ? ly + sz * 1.55 : ly - sz * 0.75;
    rawText(ctx, { layer: 'ornament', role: 'kit', text: t, x: x + (i ? u * 0.8 : 0), y, size: sz, family: /[\u4e00-\u9fff]/.test(t) ? ctx.fonts.zh['small.note'].family : f.family, weight: Math.max(500, f.weight), fill: col, tracking: 0.1, tag: 'kit' });
    if (i) hair(ctx, x, ly + (where === 'bottom' ? u * 0.3 : -u * 0.3), x, ly + (where === 'bottom' ? sz * 1.9 : -sz * 1.9), 0.4, col);
  }
  return true;
}

function cornerMark(ctx: Ctx) {
  const { grid: g, u } = ctx;
  const C = g.content;
  const s = u * ctx.rd.range(2.6, 3.6);
  const spots = ctx.rd.shuffle([[C.x + s / 2, C.y + s / 2], [C.x + C.w - s / 2, C.y + s / 2], [C.x + s / 2, C.y + C.h - s / 2], [C.x + C.w - s / 2, C.y + C.h - s / 2]]);
  const col = wcag(ctx.pal.accent, ctx.pal.bg) > 2.4 && ctx.rd.chance(0.4) ? ctx.pal.accent : quiet(ctx);
  for (const [x, y] of spots) {
    const b = { x: x - s / 2, y: y - s / 2, w: s, h: s };
    if (!plain(ctx, b, u)) continue;
    ornament(ctx, ctx.rd.pick(['registration', 'crossCircle', 'asterisk', 'halfDisc', 'star4', 'target'] as const), x, y, s, col, 1.2);
    ctx.occupied.push(b);
    return true;
  }
  return false;
}

function sig(ctx: Ctx) {
  const { grid: g, u } = ctx;
  const C = g.content;
  const w = u * 16;
  const spots = ctx.rd.shuffle([[C.x + C.w - w, C.y + C.h - u * 5, 'end'], [C.x, C.y + C.h - u * 5, 'start'], [C.x + C.w - w, C.y + u * 1, 'end']] as [number, number, 'start' | 'end'][]);
  for (const [x, y, a] of spots) {
    const b = { x, y, w, h: u * 4 };
    if (!plain(ctx, b, u * 0.5)) continue;
    signature(ctx, x, y, w, wcag(ctx.pal.accent, ctx.pal.bg) > 2 ? ctx.pal.accent : quiet(ctx), a);
    ctx.occupied.push(b);
    return true;
  }
  return false;
}

function dots(ctx: Ctx) {
  if (!ctx.on('noise')) return false;
  const { W, H, u } = ctx;
  const nx = ctx.rd.int(4, 7), ny = ctx.rd.int(3, 5), sp = u * ctx.rd.range(1.4, 2.2);
  const bw = (nx - 1) * sp, bh = (ny - 1) * sp;
  const col = quiet(ctx);
  for (let k = 0; k < 14; k++) {
    const x = ctx.rd.range(u * 4, W - bw - u * 4), y = ctx.rd.range(u * 4, H - bh - u * 4);
    const b = { x: x - u, y: y - u, w: bw + u * 2, h: bh + u * 2 };
    if (!plain(ctx, b, u)) continue;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) ctx.add({ kind: 'circle', id: ctx.id('dot'), layer: 'noise', cx: x + i * sp, cy: y + j * sp, r: u * 0.2, fill: col, opacity: 0.6 });
    ctx.occupied.push(b);
    return true;
  }
  return false;
}

function frame(ctx: Ctx) {
  if (!ctx.on('lines')) return false;
  const { W, H, u } = ctx;
  const m = u * ctx.rd.range(1.6, 2.6);
  const onPhoto = bigImageShare(ctx) > 0.6;
  const col = onPhoto ? '#ffffff' : quiet(ctx);
  ctx.add({ kind: 'rect', id: ctx.id('frame'), layer: 'lines', x: m, y: m, w: W - 2 * m, h: H - 2 * m, fill: 'none', stroke: col, sw: Math.max(1, u * 0.1), opacity: onPhoto ? 0.7 : 0.5, tag: 'kit' });
  return true;
}

function construct(ctx: Ctx) {
  if (!ctx.on('lines') || bigImageShare(ctx) > 0.35) return false;
  const g = ctx.grid;
  const C = g.content;
  const col = quiet(ctx);
  const op = 0.13;
  for (const x of g.x) ctx.add({ kind: 'line', id: ctx.id('cg'), layer: 'lines', x1: x, y1: 0, x2: x, y2: ctx.H, stroke: col, sw: 0.8, opacity: op, tag: 'kit' });
  for (const y of g.y) ctx.add({ kind: 'line', id: ctx.id('cg'), layer: 'lines', x1: 0, y1: y, x2: ctx.W, y2: y, stroke: col, sw: 0.8, opacity: op * 0.8, tag: 'kit' });
  if (ctx.rd.chance(0.5)) {
    ctx.add({ kind: 'line', id: ctx.id('cg'), layer: 'lines', x1: C.x, y1: C.y, x2: C.x + C.w, y2: C.y + C.h, stroke: col, sw: 0.8, opacity: op, tag: 'kit' });
    ctx.add({ kind: 'line', id: ctx.id('cg'), layer: 'lines', x1: C.x + C.w, y1: C.y, x2: C.x, y2: C.y + C.h, stroke: col, sw: 0.8, opacity: op, tag: 'kit' });
  }
  if (ctx.rd.chance(0.5)) { const r = Math.min(C.w, C.h) / 2; ctx.add({ kind: 'circle', id: ctx.id('cg'), layer: 'lines', cx: C.x + C.w / 2, cy: C.y + C.h / 2, r, fill: 'none', stroke: col, sw: 0.8, opacity: op, tag: 'kit' }); }
  return true;
}

// ---------------------------------------------------------------- script lettering as texture
const SCRIPT_WORDS = ['Summer', 'Bonjour', 'Matinée', 'Atelier', 'Weekend', 'Morning', 'Archive', 'Studio', 'Holiday', 'Paradise', 'Lovely', 'Daydream', 'Journal', 'Moonlight', 'Season'];
function script(ctx: Ctx) {
  if (!ctx.on('zones') || !SCRIPT_OK.has(ctx.comp)) return false;
  const { W, H, u, pal } = ctx;
  const en = [ctx.texts.headline, ...ctx.texts.words].filter((t) => t.lang === 'en').flatMap((t) => t.t.split(/\s+/)).find((w) => /^[A-Za-z]{4,10}$/.test(w));
  let word = en ? en[0].toUpperCase() + en.slice(1).toLowerCase() : ctx.rd.pick(SCRIPT_WORDS);
  if (ctx.rd.chance(0.35)) word = ctx.rd.pick(SCRIPT_WORDS);
  const sig = ctx.texts.facts?.signature;
  if (sig !== undefined) { const sw = sig.split(/\s+/).find((w) => /^[A-Za-z]{4,10}$/.test(w)); word = en ? en[0].toUpperCase() + en.slice(1).toLowerCase() : sw ? sw[0].toUpperCase() + sw.slice(1).toLowerCase() : ''; if (!word) return false; }
  const family = ctx.rd.pick(['Great Vibes', 'Sacramento', 'Dancing Script', 'Pacifico']);
  const weight = family === 'Dancing Script' ? 600 : 400;
  const targetW = W * ctx.rd.range(0.7, 1.0);
  const w100 = ctx.measure.width(word, { family, weight, size: 100, tracking: 0 });
  const size = Math.min((targetW / Math.max(1, w100)) * 100, H * 0.36);
  const cx = W / 2 + ctx.rd.range(-W * 0.08, W * 0.08), by = H * ctx.rd.range(0.38, 0.72);
  // photo-filled script when a photo is on the page but does not cover it
  const asset = ctx.images[0];
  const share = bigImageShare(ctx);
  const firstText = ctx.nodes.findIndex((n) => n.layer === 'text');
  const at = firstText < 0 ? ctx.nodes.length : firstText;
  let node: SceneNode;
  const sw0 = (w100 * size) / 100;
  const sb0 = { x: cx - sw0 / 2, y: by - size * 0.75, w: sw0, h: size * 0.95 };
  const hitsCopy = ctx.nodes.some((n) => n.kind === 'text' && n.layer === 'text' && overlap(n.box, sb0));
  if (asset && ctx.on('images') && share < 0.5 && !hitsCopy && ctx.rd.chance(0.45)) {
    const clip: Shape = { type: 'text', lines: [{ text: word, x: cx, y: by }], size, family, weight, anchor: 'middle' };
    node = { kind: 'image', id: ctx.id('scriptimg'), layer: 'images', imageId: asset.id, src: asset.src, iw: asset.w, ih: asset.h, x: 0, y: 0, w: W, h: H, fx: 0.5, fy: 0.5, zoom: 1, clip, tag: 'script' } as ImageNode;
  } else {
    const sw = (w100 * size) / 100;
    const sb = { x: cx - sw / 2, y: by - size * 0.75, w: sw, h: size * 0.95 };
    const overText = ctx.occupied.some((o) => overlap(o, sb)) || ctx.nodes.some((n) => n.kind === 'text' && n.layer === 'text' && overlap(n.box, sb));
    const strong = !overText && share < 0.3 && wcag(pal.accent, pal.bg) > 1.8;
    const col = strong ? pal.accent : tonal(pal.bg, relLum(pal.bg) > 0.5 ? 0.12 : 0.14);
    node = rawText(ctx, { layer: 'zones', role: 'script', text: word, x: cx, y: by, size, family, weight, fill: col, anchor: 'middle', opacity: strong ? 0.92 : 0.85, clip: { type: 'rect', x: 0, y: 0, w: W, h: H }, tag: 'script' });
    ctx.nodes.splice(ctx.nodes.indexOf(node), 1);
  }
  ctx.nodes.splice(at, 0, node);
  void u;
  return true;
}

// ---------------------------------------------------------------- faint background geometry
function geometry(ctx: Ctx) {
  const kind = ctx.plan.geometry;
  if (kind === 'none' || !ctx.on('zones') || bigImageShare(ctx) > 0.55) return false;
  const { W, H, pal } = ctx;
  const t1 = tonal(pal.bg, ctx.rd.range(0.03, 0.05)), t2 = tonal(pal.bg, ctx.rd.range(0.06, 0.08));
  const out: SceneNode[] = [];
  const P = (d: string, fill: string) => out.push({ kind: 'path', id: ctx.id('geo'), layer: 'zones', d, fill, tag: 'geometry' });
  if (kind === 'nested') {
    const cx = W * ctx.rd.pick([0.5, 0.5, 0.3, 0.7]), cy = H * ctx.rd.pick([0.5, 0.6, 0.75]);
    const n = ctx.rd.int(3, 5);
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n;
      const w = W * 1.3 * k, h = H * 1.0 * k;
      P(rectPath({ x: cx - w / 2, y: cy - h / 2, w, h }), i % 2 ? t1 : t2);
    }
  } else if (kind === 'rays') {
    const cx = W * ctx.rd.pick([0, 0.5, 1]), cy = ctx.rd.chance(0.6) ? H : 0;
    const n = ctx.rd.int(14, 22), R = Math.hypot(W, H) * 1.1;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
      d += `M${cx} ${cy}L${(cx + Math.cos(a0) * R).toFixed(1)} ${(cy + Math.sin(a0) * R).toFixed(1)}L${(cx + Math.cos(a1) * R).toFixed(1)} ${(cy + Math.sin(a1) * R).toFixed(1)}Z`;
    }
    P(d, t1);
  } else if (kind === 'tri') {
    P(`M0 ${H}L${W} ${H}L${(W * ctx.rd.range(0.1, 0.9)).toFixed(1)} ${(H * ctx.rd.range(0.25, 0.55)).toFixed(1)}Z`, t1);
    if (ctx.rd.chance(0.6)) P(`M${W} 0L${W} ${(H * ctx.rd.range(0.4, 0.8)).toFixed(1)}L${(W * ctx.rd.range(0.2, 0.5)).toFixed(1)} 0Z`, t2);
  } else {
    const nc = ctx.rd.int(4, 8), cw = W / nc, nr = Math.ceil(H / cw);
    let d = '';
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) if ((i + j) % 2 === 0) d += rectPath({ x: i * cw, y: j * cw, w: cw, h: cw });
    P(d, t1);
  }
  ctx.nodes.splice(1, 0, ...out);
  return true;
}

/** run the per-draw extras chosen by the plan */
export function applyExtras(ctx: Ctx) {
  const plan = ctx.plan;
  if (!plan.v2) return;
  geometry(ctx);
  if (plan.script) script(ctx);
  for (const k of plan.kit) {
    if (k === 'footer') captionRow(ctx, 'bottom');
    else if (k === 'header') captionRow(ctx, 'top');
    else if (k === 'mark') cornerMark(ctx);
    else if (k === 'signature') sig(ctx);
    else if (k === 'dots') dots(ctx);
    else if (k === 'frame') frame(ctx);
    else if (k === 'construct' && (plan.typeOnly || ctx.comp === 'typo' || ctx.comp === 'edge' || ctx.comp === 'swiss')) construct(ctx);
  }
}
