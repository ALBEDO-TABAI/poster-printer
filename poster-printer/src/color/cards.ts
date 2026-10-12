// Palette cards rendered as standalone SVG (900×1200). Four original layouts.
import { wcag } from '../engine/color/contrast';
import { mix, hexToLch, hexToRgb } from '../engine/color/convert';
import type { LibPalette } from '../engine/color/palette';
import { Rng } from '../engine/rng';
import { describe, type CardMeta } from './names';

export type CardLayout = 'columns' | 'ledger' | 'muse' | 'mosaic';
export const CARD_LAYOUTS: { id: CardLayout; zh: string; en: string }[] = [
  { id: 'columns', zh: '色柱', en: 'Columns' }, { id: 'ledger', zh: '色票册', en: 'Ledger' }, { id: 'muse', zh: '灵感', en: 'Muse' }, { id: 'mosaic', zh: '拼贴', en: 'Mosaic' },
];
export const CARD_W = 900, CARD_H = 1200;
export const CARD_FONTS = ['Jost', 'Playfair Display', 'IBM Plex Mono', 'Noto Serif SC', 'Noto Sans SC'];

const SANS = `'Jost', 'Noto Sans SC', sans-serif`, SERIF = `'Playfair Display', 'Noto Serif SC', serif`, MONO = `'IBM Plex Mono', monospace`, ZH = `'Noto Serif SC', serif`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v: number) => Math.round(v * 10) / 10;
const ink = (bg: string) => (wcag('#151515', bg) >= wcag('#fbfaf6', bg) ? '#151515' : '#fbfaf6');
const soft = (bg: string) => mix(ink(bg), bg, 0.38);
const T = (x: number, y: number, s: string, o: { size: number; fam: string; fill: string; w?: number; anchor?: string; ls?: number; op?: number }) =>
  `<text x="${n(x)}" y="${n(y)}" font-family="${o.fam}" font-size="${n(o.size)}" font-weight="${o.w ?? 400}" fill="${o.fill}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.ls ? ` letter-spacing="${n(o.ls)}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}>${esc(s)}</text>`;
const R = (x: number, y: number, w: number, h: number, fill: string, rx = 0, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" rx="${rx}" fill="${fill}"${extra}/>`;
/** wrap a CJK title into lines of ≤ k chars, balanced */
function zhLines(t: string, k: number) { const cs = Array.from(t); const lines = Math.ceil(cs.length / k); const per = Math.ceil(cs.length / lines); const out: string[] = []; for (let i = 0; i < cs.length; i += per) out.push(cs.slice(i, i + per).join('')); return out; }
const rgbStr = (h: string) => hexToRgb(h).join(' · ');
const cmyk = (h: string) => { const [r, g, b] = hexToRgb(h).map((v) => v / 255); const k = 1 - Math.max(r, g, b); if (k >= 1) return '0 0 0 100'; return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)).join(' '); };

/** palettes with few colours get gentle derived tints so every layout has enough slots */
export function slots(cols: string[], k: number): string[] {
  const out = [...cols];
  let i = 0;
  while (out.length < k) { const c = cols[i % cols.length]; const [L] = hexToLch(c); out.push(mix(c, L > 55 ? '#1a1a1a' : '#faf8f2', 0.35 + 0.15 * Math.floor(i / cols.length))); i++; }
  return out;
}

function columns(p: LibPalette, m: CardMeta, frame: string): string {
  const W = CARD_W, H = CARD_H, pad = 44, gap = 14;
  const cols = slots(p.colors, Math.max(4, p.colors.length));
  const fi = ink(frame);
  const top = pad, colH = H * 0.74 - pad;
  const weights = cols.map((_, i) => (i === 0 ? 1.5 : i === 2 ? 1.25 : 1));
  const tw = weights.reduce((a, b) => a + b, 0);
  const avail = W - pad * 2 - gap * (cols.length - 1);
  let x = pad, s = '';
  cols.forEach((c, i) => {
    const w = (avail * weights[i]) / tw;
    s += R(x, top, w, colH, c, 18);
    const ti = ink(c);
    s += T(x + 16, top + colH - 22, c.toUpperCase(), { size: 17, fam: MONO, fill: ti, op: 0.85 });
    const d = describe(c);
    s += T(x + 16, top + 34, p.names?.[i] ?? d.en, { size: 13, fam: SANS, fill: ti, ls: 1.2, op: 0.75 });
    x += w + gap;
  });
  // footer
  const fy = top + colH + 52;
  s += T(pad - 4, fy + 92, m.idx, { size: 118, fam: SERIF, fill: fi, w: 600 });
  const lines = zhLines(m.title, 6);
  lines.forEach((l, i) => (s += T(W * 0.42, fy + 44 + i * 54, l, { size: 46, fam: ZH, fill: fi, w: 700 })));
  s += T(W * 0.42, fy + 44 + lines.length * 54 + 6, m.titleEn, { size: 18, fam: SERIF, fill: soft(frame), w: 400 });
  s += T(W - pad, fy + 6, m.label, { size: 12, fam: SANS, fill: soft(frame), anchor: 'end', ls: 2.4 });
  s += T(W - pad, H - pad, m.tags.join(' · '), { size: 15, fam: SANS, fill: soft(frame), anchor: 'end', ls: 1 });
  s += R(pad, H - pad - 2, W * 0.28, 2, fi);
  return s;
}

function ledger(p: LibPalette, m: CardMeta, frame: string): string {
  const W = CARD_W, H = CARD_H, pad = 54;
  const fi = ink(frame), fs = soft(frame);
  let s = '';
  s += T(pad, pad + 14, m.label, { size: 13, fam: SANS, fill: fs, ls: 3 });
  s += T(W - pad, pad + 14, `No. ${m.idx}`, { size: 15, fam: MONO, fill: fs, anchor: 'end' });
  s += T(pad, pad + 96, m.title, { size: 58, fam: ZH, fill: fi, w: 700 });
  s += T(pad, pad + 136, m.titleEn, { size: 20, fam: SERIF, fill: fs });
  s += R(pad, pad + 162, W - pad * 2, 2, fi);
  const cols = p.colors;
  const top = pad + 196, bottom = H - pad - 70;
  const rowH = Math.min(170, (bottom - top) / cols.length);
  cols.forEach((c, i) => {
    const y = top + i * rowH;
    const sh = rowH - 22;
    s += R(pad, y, 250, sh, c, sh / 2 > 40 ? 40 : sh / 2);
    s += T(pad + 280, y + 30, String(i + 1).padStart(2, '0'), { size: 15, fam: MONO, fill: fs });
    s += T(pad + 330, y + 34, c.toUpperCase(), { size: 34, fam: MONO, fill: fi, w: 500 });
    const d = describe(c);
    s += T(pad + 330, y + 66, p.names?.[i] ?? d.en, { size: 17, fam: SERIF, fill: fi });
    s += T(pad + 330, y + 92, `${d.zh}  ·  RGB ${rgbStr(c)}  ·  CMYK ${cmyk(c)}`, { size: 13, fam: SANS, fill: fs });
    if (i < cols.length - 1) s += R(pad + 280, y + rowH - 12, W - pad * 2 - 280, 1, fs, 0, ' opacity="0.5"');
  });
  s += R(pad, H - pad - 44, W - pad * 2, 2, fi);
  s += T(pad, H - pad, m.tags.join('  /  '), { size: 15, fam: SANS, fill: fs, ls: 1 });
  s += T(W - pad, H - pad, p.src === 'wada' ? 'after Wada, 1933' : 'curated set', { size: 14, fam: SERIF, fill: fs, anchor: 'end' });
  return s;
}

function muse(p: LibPalette, m: CardMeta, frame: string): string {
  const W = CARD_W, H = CARD_H, pad = 34, gap = 16;
  const cols = slots(p.colors, 4);
  const big = cols[0], bi = ink(big);
  const topH = (H - pad * 2) * 0.6;
  let s = R(pad, pad, W - pad * 2, topH, big, 26);
  s += T(pad + 40, pad + 60, m.label, { size: 13, fam: SANS, fill: bi, ls: 3, op: 0.8 });
  s += T(W - pad - 40, pad + 60, m.idx, { size: 54, fam: SERIF, fill: bi, anchor: 'end', w: 600 });
  const lines = zhLines(m.title, 5);
  lines.forEach((l, i) => (s += T(pad + 40, pad + topH - 70 - (lines.length - 1 - i) * 92, l, { size: 84, fam: ZH, fill: bi, w: 700 })));
  s += T(pad + 40, pad + topH - 32, `${m.titleEn}  —  ${big.toUpperCase()}`, { size: 18, fam: SERIF, fill: bi, op: 0.85 });
  const y2 = pad + topH + gap, h2 = H - pad - y2 - 58;
  const w2 = (W - pad * 2 - gap) / 2;
  [cols[1], cols[2]].forEach((c, i) => {
    const x = pad + i * (w2 + gap);
    s += R(x, y2, w2, h2, c, 22);
    const ci = ink(c);
    s += T(x + 26, y2 + 44, c.toUpperCase(), { size: 22, fam: MONO, fill: ci });
    s += T(x + 26, y2 + h2 - 26, (p.names?.[i + 1] ?? describe(c).en).toUpperCase(), { size: 12, fam: SANS, fill: ci, ls: 2, op: 0.8 });
  });
  // strip
  const sy = H - pad - 38;
  const sw = (W - pad * 2) / cols.length;
  cols.forEach((c, i) => (s += R(pad + i * sw, sy, sw + 0.5, 38, c, 0)));
  s += `<rect x="${pad}" y="${sy}" width="${W - pad * 2}" height="38" rx="10" fill="none" stroke="${frame}" stroke-width="0"/>`;
  return s;
}

function mosaic(p: LibPalette, m: CardMeta, frame: string): string {
  const W = CARD_W, H = CARD_H, pad = 30, gap = 10;
  const r = new Rng('mosaic|' + p.id);
  type Rc = { x: number; y: number; w: number; h: number };
  const tiles: Rc[] = [{ x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 }];
  const k = 7 + Math.min(3, p.colors.length);
  while (tiles.length < k) {
    tiles.sort((a, b) => b.w * b.h - a.w * a.h);
    const t = tiles.shift()!;
    const f = r.range(0.36, 0.64);
    if (t.w > t.h * 0.9) { const w1 = (t.w - gap) * f; tiles.push({ ...t, w: w1 }, { ...t, x: t.x + w1 + gap, w: t.w - w1 - gap }); }
    else { const h1 = (t.h - gap) * f; tiles.push({ ...t, h: h1 }, { ...t, y: t.y + h1 + gap, h: t.h - h1 - gap }); }
  }
  tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  const cols = slots(p.colors, Math.max(3, p.colors.length));
  const order = tiles.map((_, i) => cols[(i * 2 + (i > 3 ? 1 : 0)) % cols.length]);
  const bySize = tiles.map((t, i) => ({ t, i })).sort((a, b) => b.t.w * b.t.h - a.t.w * a.t.h);
  const titleI = bySize[0].i, idxI = bySize[1].i, glyphI = bySize[Math.min(4, bySize.length - 1)].i;
  let s = '';
  tiles.forEach((t, i) => {
    const c = order[i], ci = ink(c);
    s += R(t.x, t.y, t.w, t.h, c, 14);
    if (i === titleI) {
      const lines = zhLines(m.title, Math.max(3, Math.floor(t.w / 70)));
      const fsz = Math.min(66, (t.w - 50) / Math.max(...lines.map((l) => Array.from(l).length)));
      lines.forEach((l, j) => (s += T(t.x + 24, t.y + 30 + fsz * (j + 1) * 1.15, l, { size: fsz, fam: ZH, fill: ci, w: 700 })));
      s += T(t.x + 24, t.y + t.h - 24, m.titleEn, { size: 16, fam: SERIF, fill: ci, op: 0.85 });
    } else if (i === idxI) {
      s += T(t.x + t.w - 20, t.y + Math.min(t.h - 20, 110), m.idx, { size: Math.min(96, t.h * 0.6, t.w * 0.38), fam: SERIF, fill: ci, anchor: 'end', w: 600 });
      s += T(t.x + 20, t.y + t.h - 20, m.label, { size: 11, fam: SANS, fill: ci, ls: 2.4, op: 0.8 });
    } else if (i === glyphI && t.w > 90 && t.h > 90) {
      const rr = Math.min(t.w, t.h) * 0.3;
      s += `<circle cx="${n(t.x + t.w / 2)}" cy="${n(t.y + t.h / 2)}" r="${n(rr)}" fill="none" stroke="${ci}" stroke-width="2"/><path d="M${n(t.x + t.w / 2)} ${n(t.y + t.h / 2 - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(t.x + t.w / 2)} ${n(t.y + t.h / 2 + rr)}Z" fill="${ci}"/>`;
    } else if (t.w > 120 && t.h > 50) {
      s += T(t.x + 16, t.y + 30, c.toUpperCase(), { size: 15, fam: MONO, fill: ci, op: 0.9 });
      if (t.h > 110) s += T(t.x + 16, t.y + t.h - 18, m.tags[i % m.tags.length] ?? '', { size: 14, fam: SANS, fill: ci, op: 0.75 });
    }
  });
  void frame;
  return s;
}

export function renderCard(layout: CardLayout, p: LibPalette, m: CardMeta, o: { fontCss?: string; frame?: 'auto' | 'dark' | 'paper' } = {}): string {
  const avgL = p.colors.reduce((a, c) => a + hexToLch(c)[0], 0) / p.colors.length;
  const frame = o.frame === 'dark' ? '#121212' : o.frame === 'paper' ? '#f3f0e8' : layout === 'ledger' ? '#f3f0e8' : avgL > 62 ? '#151515' : layout === 'mosaic' ? '#f3f0e8' : avgL < 40 ? '#f3f0e8' : '#141414';
  const body = layout === 'columns' ? columns(p, m, frame) : layout === 'ledger' ? ledger(p, m, frame) : layout === 'muse' ? muse(p, m, frame) : mosaic(p, m, frame);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">${o.fontCss ? `<defs><style>${o.fontCss}</style></defs>` : ''}${R(0, 0, CARD_W, CARD_H, frame, 0)}${body}</svg>`;
}
