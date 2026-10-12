// Component slots: small, self-contained graphic components (stamps, tickets, barcodes …) that the user
// drops onto a poster and places freely. Placements persist across draws; their contents re-flow with the
// current palette, fonts and copy, and their inks are chosen against what is actually underneath them.
import type { SceneNode, TextNode, GroupNode, Scene } from './types';
import type { Ctx } from './gen/ctx';
import type { PT } from './gen/pick';
import { Rng } from './rng';
import { wcag } from './color/contrast';
import { sampleBg } from './gen/quality';
import { nodeBoxOf } from './bbox';

export type ColorRole = 'auto' | 'accent' | 'ink' | 'plate';
export interface PlacedComponent {
  id: string;
  type: string;
  /** top-left as a fraction of canvas width / height */
  x: number; y: number;
  scale: number;
  salt: string;
  color: ColorRole;
  rot?: number;
  /** fixed copy (else drawn from the poster's copy) */
  text?: string;
}
export interface ComponentDef { id: string; zh: string; en: string; w: number; h: number }
export const COMPONENTS: ComponentDef[] = [
  { id: 'stamp', zh: '圆形印章', en: 'Round stamp', w: 15, h: 15 },
  { id: 'ticket', zh: '票根', en: 'Ticket stub', w: 30, h: 11 },
  { id: 'date', zh: '日期块', en: 'Date block', w: 14, h: 15 },
  { id: 'barcode', zh: '条形码', en: 'Barcode', w: 24, h: 9 },
  { id: 'tag', zh: '胶囊标签', en: 'Pill tag', w: 20, h: 4.6 },
  { id: 'star', zh: '星形贴纸', en: 'Star sticker', w: 14, h: 14 },
  { id: 'index', zh: '编号', en: 'Index number', w: 16, h: 10 },
  { id: 'caption', zh: '图注块', en: 'Caption block', w: 28, h: 11 },
  { id: 'chips', zh: '色卡条', en: 'Colour chips', w: 30, h: 7 },
  { id: 'arrow', zh: '箭头标注', en: 'Arrow mark', w: 24, h: 5 },
  { id: 'grid', zh: '点阵码', en: 'Dot code', w: 11, h: 11 },
  { id: 'signature', zh: '签名', en: 'Signature', w: 24, h: 8 },
  { id: 'label', zh: '文字标签', en: 'Text label', w: 26, h: 6 },
  { id: 'folio', zh: '页码', en: 'Folio', w: 13, h: 3.2 },
];
export const compDef = (id: string) => COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0];
export const compSize = (type: string, scale: number, W: number, H: number) => { const u = Math.min(W, H) / 100; const d = compDef(type); return { w: d.w * u * scale, h: d.h * u * scale }; };

type Box = { x: number; y: number; w: number; h: number };
const inter = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Free-slot search: scan a lattice of positions and pick the one with the least weighted overlap
 *  (text ×4, images/glyphs ×1.5, other components ×6), with a mild preference for the margins. */
export function freeSlots(scene: Scene, w: number, h: number, extra: Box[] = [], n = 6): Box[] {
  const W = scene.w, H = scene.h, m = Math.min(W, H) * 0.04;
  const obs: { b: Box; k: number }[] = [];
  // hard obstacles: real copy (text / sidebar) and other placed components, with a breathing margin
  const hard: Box[] = [];
  const pad = Math.min(W, H) * 0.012;
  const grow = (b: Box): Box => ({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad });
  const walk = (ns: SceneNode[]) => {
    for (const nd of ns) {
      if (nd.layer === 'bg' || nd.layer === 'texture' || nd.layer === 'zones') continue;
      if (nd.kind === 'group') { if (nd.id.startsWith('pc-')) { const b = nodeBoxOf(nd); if (b) { obs.push({ b, k: 6 }); hard.push(grow(b)); } continue; } walk(nd.children); continue; }
      const b = nodeBoxOf(nd); if (!b || b.w * b.h > W * H * 0.6) continue;
      const realText = nd.kind === 'text' && nd.layer !== 'ornament' && nd.role !== 'glyph' && nd.role !== 'tick' && (nd.opacity ?? 1) > 0.3;
      if (realText) hard.push(grow(b));
      obs.push({ b, k: nd.kind === 'text' ? (nd.layer === 'ornament' || nd.role === 'glyph' ? 2 : 4) : nd.kind === 'image' ? 1.2 : 0.4 });
    }
  };
  walk(scene.nodes);
  for (const b of extra) { obs.push({ b, k: 6 }); hard.push(grow(b)); }
  // candidate origins on a lattice, nudged onto grid lines when the generator exported them
  const snap = scene.info?.snap as { xs: number[]; ys: number[] } | undefined;
  const sx = Math.max(8, (W - 2 * m - w) / 18), sy = Math.max(8, (H - 2 * m - h) / 18);
  const toLine = (v: number, lines: number[] | undefined, size: number, lo: number, hi: number) => {
    if (!lines?.length) return v;
    let best = v, bd = Infinity;
    for (const L of lines) for (const c of [L, L - size]) { const d = Math.abs(c - v); if (d < bd && d < Math.max(sx, sy) * 0.6 && c >= lo && c <= hi) { bd = d; best = c; } }
    return best;
  };
  const soft: { b: Box; cost: number }[] = [];
  const free: { b: Box; cost: number }[] = [];
  for (let y0 = m; y0 <= H - m - h + 0.1; y0 += sy) for (let x0 = m; x0 <= W - m - w + 0.1; x0 += sx) {
    const x = toLine(x0, snap?.xs, w, m * 0.5, W - m * 0.5 - w), y = toLine(y0, snap?.ys, h, m * 0.5, H - m * 0.5 - h);
    const b = { x, y, w, h };
    let cost = 0;
    for (const o of obs) cost += (inter(b, o.b) / (w * h)) * o.k;
    const edge = Math.min(x, y, W - x - w, H - y - h) / Math.min(W, H);
    cost += edge * 0.25;
    (hard.some((hb) => inter(hb, b) > 0) ? soft : free).push({ b, cost });
  }
  free.sort((a, b) => a.cost - b.cost);
  soft.sort((a, b) => a.cost - b.cost);
  const out: Box[] = [];
  for (const c of [...free, ...soft]) { if (out.every((o) => inter(o, c.b) === 0)) out.push(c.b); if (out.length >= n) break; }
  return out;
}

// ------------------------------------------------------------------ builders
function textNode(ctx: Ctx, id: string, t: string, lang: 'zh' | 'en', role: 'small.note' | 'small.main' | 'big.main', x: number, base: number, size: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'start', weight?: number, tracking = 0): TextNode {
  const sp = { ...ctx.spec(role, lang, size), tracking };
  const w = ctx.lineW(t, sp);
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w;
  return { kind: 'text', id, layer: 'ornament', role: 'component', lang, lines: [{ text: t, x, y: base }], size, family: sp.family, fallback: sp.fallback, weight: weight ?? sp.weight, tracking, italic: sp.italic, fill, anchor, box: { x: x0, y: base - size * 0.82, w, h: size * 1.05 }, raw: t };
}
function fitSize(ctx: Ctx, t: string, lang: 'zh' | 'en', role: 'small.note' | 'small.main' | 'big.main', maxW: number, size: number) {
  const w = ctx.lineW(t, ctx.spec(role, lang, size));
  return w > maxW ? size * (maxW / w) : size;
}
const short = (p: PT | undefined, n: number) => { if (!p) return ''; const t = p.t.replace(/\s+/g, ' ').trim(); if (p.lang === 'zh') return Array.from(t).slice(0, n).join(''); const ws = t.split(' '); let o = ''; for (const w of ws) { if ((o + ' ' + w).trim().length > n * 1.9) break; o = (o + ' ' + w).trim(); } return o || ws[0]; };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Build one placed component as a group of nodes. */
export function buildComponent(ctx: Ctx, pc: PlacedComponent, bg: string): GroupNode {
  const { W, H } = ctx;
  const { w, h } = compSize(pc.type, pc.scale, W, H);
  const x = Math.max(-w * 0.5, Math.min(W - w * 0.5, pc.x * W)), y = Math.max(-h * 0.5, Math.min(H - h * 0.5, pc.y * H));
  const box = { x, y, w, h };
  const r = new Rng('pc|' + pc.id + '|' + pc.salt);
  const pal = ctx.pal;
  // inks against the real background under the slot
  const under = sampleBg(ctx, ctx.nodes, box, bg);
  const minC = (c: string) => Math.min(...under.map((b) => wcag(c, b)));
  const cands = [pal.ink, pal.light, pal.dark, pal.bg, pal.accent, '#ffffff', '#111111'];
  let ink = cands.reduce((a, c) => (minC(c) > minC(a) + 0.2 ? c : a), pal.ink);
  let accent = minC(pal.accent) >= 2.6 ? pal.accent : minC(pal.alt) >= 2.6 ? pal.alt : ink;
  let plate: string | null = null;
  if (pc.color === 'accent' && minC(pal.accent) >= 2) { ink = pal.accent; accent = pal.accent; }
  if (pc.color === 'ink') { accent = ink; }
  if (pc.color === 'plate' || (pc.color === 'auto' && minC(ink) < 3)) {
    plate = minC(pal.bg) > 1.6 || pc.color === 'plate' ? pal.bg : pal.light;
    ink = wcag(pal.ink, plate) >= wcag(pal.light, plate) ? pal.ink : pal.light;
    accent = wcag(pal.accent, plate) >= 2.6 ? pal.accent : ink;
  }
  const paper = plate ?? (wcag(pal.bg, accent) >= 3 ? pal.bg : wcag('#ffffff', accent) > wcag('#111111', accent) ? '#ffffff' : '#111111');
  const id = (k: string) => `pc-${pc.id}-${k}`;
  const T = ctx.texts;
  const copy = (pool: PT[], n: number): { t: string; lang: 'zh' | 'en' } => { if (pc.text) return { t: pc.text, lang: /[\u3400-\u9fff]/.test(pc.text) ? 'zh' : 'en' }; const p = pool.length ? pool[r.int(0, pool.length - 1)] : T.headline; return { t: short(p, n), lang: p.lang }; };
  const k = Math.min(W, H) / 100 * pc.scale; // 1 component unit
  const kids: SceneNode[] = [];
  if (plate) kids.push({ kind: 'rect', id: id('plate'), layer: 'ornament', x: x - k, y: y - k, w: w + 2 * k, h: h + 2 * k, fill: plate, rx: pc.type === 'stamp' || pc.type === 'star' ? (w + 2 * k) / 2 : k * 0.6, opacity: 0.94 });
  const num = String(r.int(1, 99)).padStart(2, '0');
  switch (pc.type) {
    case 'stamp': {
      const cx = x + w / 2, cy = y + h / 2, R = w / 2;
      kids.push({ kind: 'circle', id: id('o'), layer: 'ornament', cx, cy, r: R - k * 0.4, fill: 'none', stroke: accent, sw: k * 0.55 });
      kids.push({ kind: 'circle', id: id('i'), layer: 'ornament', cx, cy, r: R - k * 1.6, fill: 'none', stroke: accent, sw: k * 0.22, dash: `${k * 0.5} ${k * 0.4}` });
      const c = copy(T.words.length ? T.words : T.meta, 4);
      const s = fitSize(ctx, c.t, c.lang, 'small.main', R * 1.25, k * 2.4);
      kids.push(textNode(ctx, id('t'), c.lang === 'en' ? c.t.toUpperCase() : c.t, c.lang, 'small.main', cx, cy + s * 0.3, s, accent, 'middle', 700));
      kids.push(textNode(ctx, id('n'), 'Nº ' + num, 'en', 'small.note', cx, cy + R * 0.55, k * 1.3, accent, 'middle', 600, 0.1));
      kids.push(textNode(ctx, id('y'), String(2020 + r.int(0, 9)), 'en', 'small.note', cx, cy - R * 0.42, k * 1.2, accent, 'middle', 600, 0.2));
      break;
    }
    case 'ticket': {
      const cut = w * 0.7;
      kids.push({ kind: 'rect', id: id('b'), layer: 'ornament', x, y, w, h, fill: accent, rx: k * 0.8 });
      kids.push({ kind: 'line', id: id('p'), layer: 'ornament', x1: x + cut, y1: y + k, x2: x + cut, y2: y + h - k, stroke: paper, sw: k * 0.3, dash: `${k * 0.6} ${k * 0.5}` });
      kids.push({ kind: 'circle', id: id('c1'), layer: 'ornament', cx: x + cut, cy: y, r: k * 1.1, fill: under[1] });
      kids.push({ kind: 'circle', id: id('c2'), layer: 'ornament', cx: x + cut, cy: y + h, r: k * 1.1, fill: under[7] });
      const c = copy(T.groups.map((g) => g.main), 8);
      const s = fitSize(ctx, c.t, c.lang, 'small.main', cut - k * 4, k * 3);
      kids.push(textNode(ctx, id('t'), c.t, c.lang, 'small.main', x + k * 2, y + h * 0.5 + s * 0.15, s, paper, 'start', 700));
      kids.push(textNode(ctx, id('m'), c.lang === 'zh' ? '入场券 · 单人' : 'ADMIT ONE', c.lang, 'small.note', x + k * 2, y + h - k * 1.6, k * 1.25, paper, 'start', 500, 0.15));
      kids.push(textNode(ctx, id('n'), num, 'en', 'small.main', x + cut + (w - cut) / 2, y + h / 2 + k * 1.2, k * 3.4, paper, 'middle', 700));
      break;
    }
    case 'date': {
      const d = String(r.int(1, 28)).padStart(2, '0');
      kids.push({ kind: 'rect', id: id('r'), layer: 'ornament', x, y, w, h: k * 0.5, fill: accent });
      kids.push(textNode(ctx, id('m'), MONTHS[r.int(0, 11)], 'en', 'small.note', x, y + k * 3, k * 1.8, ink, 'start', 700, 0.15));
      kids.push(textNode(ctx, id('d'), d, 'en', 'big.main', x - k * 0.3, y + h - k * 3.2, fitSize(ctx, d, 'en', 'big.main', w, k * 8.5), ink, 'start', 700));
      kids.push({ kind: 'line', id: id('l'), layer: 'ornament', x1: x, y1: y + h - k * 2.2, x2: x + w, y2: y + h - k * 2.2, stroke: ink, sw: k * 0.18 });
      kids.push(textNode(ctx, id('y'), String(2020 + r.int(0, 9)) + ' · ' + ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][r.int(0, 6)], 'en', 'small.note', x, y + h - k * 0.3, k * 1.3, ink, 'start', 500, 0.1));
      break;
    }
    case 'barcode': {
      let bx = x; const bh = h - k * 2.4;
      while (bx < x + w - k * 0.3) { const bw = k * [0.2, 0.2, 0.4, 0.6][r.int(0, 3)]; if (r.chance(0.62)) kids.push({ kind: 'rect', id: id('b' + kids.length), layer: 'ornament', x: bx, y, w: bw, h: bh, fill: ink }); bx += bw + k * 0.18; }
      const digits = Array.from({ length: 12 }, () => r.int(0, 9)).join('');
      kids.push(textNode(ctx, id('d'), digits.replace(/(\d)(\d{6})(\d{5})/, '$1 $2 $3'), 'en', 'small.note', x + w / 2, y + h - k * 0.2, fitSize(ctx, digits + '  ', 'en', 'small.note', w, k * 1.7), ink, 'middle', 500, 0.12));
      break;
    }
    case 'tag': {
      kids.push({ kind: 'rect', id: id('b'), layer: 'ornament', x, y, w, h, fill: accent, rx: h / 2 });
      const c = copy(T.meta, 10);
      const s = fitSize(ctx, c.t, c.lang, 'small.note', w - h * 1.4, h * 0.46);
      kids.push({ kind: 'circle', id: id('dot'), layer: 'ornament', cx: x + h * 0.5, cy: y + h / 2, r: h * 0.13, fill: paper });
      kids.push(textNode(ctx, id('t'), c.lang === 'en' ? c.t.toUpperCase() : c.t, c.lang, 'small.note', x + h * 0.85, y + h / 2 + s * 0.36, s, paper, 'start', 600, 0.08));
      break;
    }
    case 'star': {
      const cx = x + w / 2, cy = y + h / 2, R = w / 2, n = 14 + r.int(0, 3) * 2;
      let d = '';
      for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2; const rr = i % 2 ? R * 0.82 : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
      kids.push({ kind: 'path', id: id('s'), layer: 'ornament', d: d + 'Z', fill: accent });
      const c = pc.text ? copy([], 4) : r.chance(0.5) ? { t: ['NEW', 'HOT', 'Nº' + num, 'LIVE'][r.int(0, 3)], lang: 'en' as const } : copy(T.words.length ? T.words : T.meta, 3);
      const s = fitSize(ctx, c.t, c.lang, 'small.main', R * 1.3, k * 3.6);
      kids.push(textNode(ctx, id('t'), c.lang === 'en' ? c.t.toUpperCase() : c.t, c.lang, 'small.main', cx, cy + s * 0.34, s, paper, 'middle', 800));
      break;
    }
    case 'index': {
      kids.push(textNode(ctx, id('no'), 'No.', 'en', 'small.note', x, y + k * 2, k * 1.8, ink, 'start', 600));
      kids.push(textNode(ctx, id('n'), num, 'en', 'big.main', x + k * 4.6, y + h - k * 0.6, fitSize(ctx, num, 'en', 'big.main', w - k * 4.6, k * 9.5), accent, 'start', 700));
      break;
    }
    case 'caption': {
      kids.push({ kind: 'line', id: id('l'), layer: 'ornament', x1: x, y1: y, x2: x + w, y2: y, stroke: ink, sw: k * 0.3 });
      const c = copy(T.groups.map((g) => g.main), 10);
      const s = fitSize(ctx, c.t, c.lang, 'small.main', w, k * 2.3);
      kids.push(textNode(ctx, id('t'), c.t, c.lang, 'small.main', x, y + k * 1.4 + s, s, ink, 'start', 700));
      const nt = short(T.meta[r.int(0, Math.max(0, T.meta.length - 1))], 14), nl = T.meta[0]?.lang ?? 'en';
      kids.push(textNode(ctx, id('n1'), nt, nl, 'small.note', x, y + h - k * 2.4, fitSize(ctx, nt, nl, 'small.note', w, k * 1.35), ink, 'start', 400));
      kids.push(textNode(ctx, id('n2'), 'FIG. ' + num + ' — ' + (2020 + r.int(0, 9)), 'en', 'small.note', x, y + h - k * 0.3, k * 1.2, accent, 'start', 600, 0.1));
      break;
    }
    case 'chips': {
      const cols = [pal.accent, pal.alt, ...pal.fills, pal.ink].filter((c, i, a) => a.indexOf(c) === i).slice(0, 5);
      const cw = w / cols.length;
      cols.forEach((c, i) => {
        kids.push({ kind: 'rect', id: id('c' + i), layer: 'ornament', x: x + i * cw, y, w: cw - k * 0.4, h: h - k * 2.2, fill: c, stroke: minC(c) < 1.3 ? ink : undefined, sw: k * 0.12 });
        kids.push(textNode(ctx, id('h' + i), c.toUpperCase().slice(1), 'en', 'small.note', x + i * cw, y + h - k * 0.3, Math.min(k * 1.15, fitSize(ctx, '000000', 'en', 'small.note', cw - k * 0.6, k * 1.15)), ink, 'start', 500));
      });
      break;
    }
    case 'arrow': {
      const ay = y + h * 0.65;
      kids.push({ kind: 'line', id: id('l'), layer: 'ornament', x1: x, y1: ay, x2: x + w - k * 0.4, y2: ay, stroke: accent, sw: k * 0.35 });
      kids.push({ kind: 'path', id: id('h'), layer: 'ornament', d: `M${x + w - k * 2.4} ${ay - k * 1.3}L${x + w} ${ay}L${x + w - k * 2.4} ${ay + k * 1.3}`, fill: 'none', stroke: accent, sw: k * 0.35, cap: 'round' });
      const c = copy(T.meta, 10);
      kids.push(textNode(ctx, id('t'), c.lang === 'en' ? c.t.toUpperCase() : c.t, c.lang, 'small.note', x, ay - k * 1.1, fitSize(ctx, c.t, c.lang, 'small.note', w * 0.8, k * 1.5), ink, 'start', 600, 0.1));
      break;
    }
    case 'grid': {
      const n = 9, c = w / n;
      const finder = (i: number, j: number) => (i < 3 && j < 3) || (i >= n - 3 && j < 3) || (i < 3 && j >= n - 3);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (finder(i, j)) continue;
        if (r.chance(0.5)) kids.push({ kind: 'rect', id: id(`q${i}_${j}`), layer: 'ornament', x: x + i * c, y: y + j * c, w: c * 0.92, h: c * 0.92, fill: ink });
      }
      for (const [i, j] of [[0, 0], [n - 3, 0], [0, n - 3]]) {
        kids.push({ kind: 'rect', id: id(`f${i}_${j}`), layer: 'ornament', x: x + i * c + c * 0.2, y: y + j * c + c * 0.2, w: c * 2.6, h: c * 2.6, fill: 'none', stroke: ink, sw: c * 0.4 });
        kids.push({ kind: 'rect', id: id(`g${i}_${j}`), layer: 'ornament', x: x + i * c + c * 0.95, y: y + j * c + c * 0.95, w: c * 1.1, h: c * 1.1, fill: accent });
      }
      break;
    }
    case 'folio': {
      const tx = pc.text ?? num + ' / ' + String(r.int(2, 20)).padStart(2, '0');
      const s = fitSize(ctx, tx, 'en', 'small.note', w * 0.7, h * 0.62);
      kids.push({ kind: 'line', id: id('l'), layer: 'ornament', x1: x, y1: y + h * 0.5, x2: x + w - ctx.lineW(tx, ctx.spec('small.note', 'en', s)) - k, y2: y + h * 0.5, stroke: ink, sw: k * 0.14, opacity: 0.8 });
      kids.push(textNode(ctx, id('t'), tx, 'en', 'small.note', x + w, y + h * 0.5 + s * 0.34, s, ink, 'end', 600, 0.06));
      break;
    }
    case 'label': {
      const c = copy(T.groups.map((g) => g.main), 12);
      const s = fitSize(ctx, c.t, c.lang, 'small.main', w, h * 0.62);
      kids.push(textNode(ctx, id('t'), c.t, c.lang, 'small.main', x, y + h * 0.62, s, ink, 'start', 700));
      kids.push({ kind: 'rect', id: id('u'), layer: 'ornament', x, y: y + h * 0.82, w: Math.min(w, ctx.lineW(c.t, ctx.spec('small.main', c.lang, s))), h: k * 0.45, fill: accent });
      break;
    }
    default: { // signature
      let d = `M${x} ${y + h * 0.55}`;
      const segs = 6 + r.int(0, 3);
      for (let i = 1; i <= segs; i++) {
        const px = x + (w * 0.9 * i) / segs, py = y + h * (0.2 + r.next() * 0.45);
        d += `Q${(px - w * 0.06).toFixed(1)} ${(y + h * (r.chance(0.5) ? 0.05 : 0.7)).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      kids.push({ kind: 'path', id: id('s'), layer: 'ornament', d, fill: 'none', stroke: accent, sw: k * 0.38, cap: 'round' });
      kids.push({ kind: 'line', id: id('l'), layer: 'ornament', x1: x, y1: y + h - k * 2.3, x2: x + w, y2: y + h - k * 2.3, stroke: ink, sw: k * 0.15 });
      const c = copy(T.meta, 12);
      kids.push(textNode(ctx, id('t'), c.t, c.lang, 'small.note', x, y + h - k * 0.3, fitSize(ctx, c.t, c.lang, 'small.note', w, k * 1.25), ink, 'start', 500));
    }
  }
  const cx = x + w / 2, cy = y + h / 2;
  return { kind: 'group', id: 'pc-' + pc.id, layer: 'ornament', tag: 'component', children: kids, transform: pc.rot ? `rotate(${pc.rot} ${cx.toFixed(1)} ${cy.toFixed(1)})` : undefined };
}

/** Append placed components (after the quality pass, so layout never moves them). */
export function addComponents(ctx: Ctx, placed: PlacedComponent[], bg: string) {
  for (const pc of placed) ctx.nodes.push(buildComponent(ctx, pc, bg));
}
