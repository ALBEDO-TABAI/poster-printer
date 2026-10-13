// Phase 7 compositions: realisers for the idea layer (gen/ideas.ts). Each one implements one idea's tension rule
// literally: emptiness (ma), substitution, hanzi-as-image, repetition + one anomaly, data-as-form (calendar) and
// reveal (window). Original rule systems; anchors come from the dynamic-symmetry eyes and the canon frame (gen/frame.ts).
import type { Ctx } from './ctx';
import type { Rect } from './grid';
import { wcag } from '../color/contrast';
import { tonal } from '../color/strategy';
import { img, groupArray } from './comps';
import { rawText, hair } from './comps2';
import { heroWord, width100, capOf, strong, condFam, label, issue, year, zhHeavy, accentOn, system } from './comps3';
import { roundedPath } from './masks';
import { eyes, canon } from './frame';
import { imageDrawRect } from '../render/svg';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pad2 = (n: number) => String(n).padStart(2, '0');
const enDisplay = (ctx: Ctx) => { const r = ctx.role('big.main', 'en'); return r.weight >= 600 && !/Script|Hand|Brush|Marker|Pacifico|Caveat/i.test(r.family) ? { family: r.family, weight: r.weight } : ctx.rd.chance(0.6) ? condFam(ctx) : { family: 'Archivo Black', weight: 400 }; };
const land = (ctx: Ctx) => ctx.W > ctx.H * 1.15;
const wideF = (ctx: Ctx) => ctx.W > ctx.H * 1.5;
const hasPic = (ctx: Ctx) => !!img(ctx) && ctx.on('images') && !ctx.plan.typeOnly;

// ---------------------------------------------------------------- emptiness (ma)
function ma(ctx: Ctx) {
  const { W, H, pal, u } = ctx;
  const T = ctx.texts;
  const on = pal.bg;
  const E = eyes(W, H);
  const cn = canon(W, H, ctx.rng.chance(0.5)).block;
  // hero on an eye: upper eyes on portrait (the foot is the caption's), any eye on long formats
  const eye = wideF(ctx) ? ctx.rng.pick([E[0], E[1], E[2], E[3]]) : ctx.rng.pick([E[0], E[1]]);
  const asset = img(ctx);
  let hero: Rect;
  const wordHero = !(hasPic(ctx) && asset);
  if (hasPic(ctx) && asset) {
    const area = W * H * ctx.rng.range(0.09, 0.15);
    const ar = clamp(asset.w / asset.h, 0.7, 1.4);
    const hw = Math.sqrt(area * ar), hh = hw / ar;
    hero = { x: eye.x - hw / 2, y: eye.y - hh / 2, w: hw, h: hh };
    const round = ctx.rng.chance(0.25);
    ctx.image(asset, hero, { clip: round ? { type: 'circle', cx: eye.x, cy: eye.y, r: Math.min(hw, hh) / 2 } : undefined });
    if (round) hero = { x: eye.x - Math.min(hw, hh) / 2, y: eye.y - Math.min(hw, hh) / 2, w: Math.min(hw, hh), h: Math.min(hw, hh) };
    ctx.occupied.push(hero);
  } else {
    // a small, exact word or character
    const hw = heroWord(ctx, 8);
    const fam = hw.zh ? zhHeavy(ctx) : enDisplay(ctx);
    const capR = capOf(ctx, fam, hw.zh);
    const size = Math.min((W * (wideF(ctx) ? 0.22 : 0.34)) / width100(ctx, hw.t, fam, hw.zh ? 0.02 : -0.01), (H * 0.12) / capR);
    const n = rawText(ctx, { id: ctx.id('mah'), role: 'big.main', text: hw.t, lang: hw.zh ? 'zh' : 'en', x: eye.x, y: eye.y + (capR * size) / 2, size, family: fam.family, weight: fam.weight, fill: accentOn(ctx, on, 3) && ctx.rng.chance(0.35) ? pal.accent : strong(ctx, on), anchor: 'middle', tracking: hw.zh ? 0.02 : -0.01 });
    hero = n.box;
  }
  // a tiny accent mark tied to the hero (extension: loud colour, ≤ 1% of the area)
  if (ctx.on('ornament') && wcag(pal.accent, on) > 1.5) {
    const r = u * ctx.rng.range(0.7, 1.1);
    const left = hero.x + hero.w / 2 < W / 2;
    ctx.add({ kind: 'circle', id: ctx.id('madot'), layer: 'ornament', cx: left ? hero.x + hero.w + u * 2.2 : hero.x - u * 2.2, cy: hero.y + hero.h - r, r, fill: pal.accent });
  }
  // caption block at the canon foot corner opposite the hero
  const right = eye.x > W / 2;
  const bw = Math.min(cn.w * 0.5, u * 42);
  const box = { x: right ? cn.x : cn.x + cn.w - bw, y: cn.y + cn.h - u * 22, w: bw, h: u * 22 };
  ctx.group(wordHero ? { main: T.sub, note: T.note } : { main: T.headline, sub: T.sub, note: T.note }, 'small', box, { mainSize: ctx.size('smallMain') * (wordHero ? 1.1 : 1.45), align: 'start', valign: 'bottom', on, mode: 'balance', maxLines: 3 });
  // tracked meta on the canon head
  label(ctx, `${T.meta[0]?.t ?? issue(ctx)}`.toUpperCase(), cn.x, cn.y, on, { tracking: 0.24 });
  label(ctx, year(ctx), cn.x + cn.w, cn.y, on, { anchor: 'end', tracking: 0.24 });
  if (ctx.rt.chance(0.5)) groupArray(ctx, { x: right ? cn.x + cn.w - bw : cn.x, y: cn.y + cn.h + u * 2, w: bw, h: H - (cn.y + cn.h) - u * 6 }, on, 1, { valign: 'top', maxPerRow: 1 });
}

// ---------------------------------------------------------------- substitution
function substitute(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const T = ctx.texts;
  const on = pal.bg;
  const asset = img(ctx);
  const hw = heroWord(ctx, land(ctx) ? 10 : 7);
  const ink = strong(ctx, on);
  const accentInk = accentOn(ctx, on, 3);
  const fill = accentInk && ctx.rt.chance(0.3) ? accentInk : ink;
  if (hw.zh) {
    const full = Array.from(T.headline.t.replace(/[\s，。、！？：；“”「」·]/g, ''));
    const chars = full.length <= 6 ? full : Array.from(hw.t).slice(0, 4);
    if (chars.length < 2) chars.push('白');
    const k = ctx.rng.int(0, chars.length - 1);
    const fam = zhHeavy(ctx, true);
    const n = chars.length;
    const vert = !land(ctx) && n >= 3 && ctx.rng.chance(0.4);
    const size = vert ? Math.min((C.h * 0.8) / n, C.w * 0.5) : Math.min((C.w * 1.0) / n, H * (land(ctx) ? 0.55 : 0.32));
    const x0 = vert ? C.x + C.w - size : C.x + (C.w - n * size) / 2;
    const y0 = vert ? C.y + u * 2 : (land(ctx) ? H * 0.2 : H * 0.18);
    chars.forEach((ch, i) => {
      const cx = vert ? x0 : x0 + i * size, cy = vert ? y0 + i * size : y0;
      if (i === k) {
        const fr = { x: cx + size * 0.04, y: cy + size * 0.04, w: size * 0.92, h: size * 0.92 };
        if (asset && hasPic(ctx)) { ctx.image(asset, fr, { clip: ctx.rng.chance(0.5) ? { type: 'circle', cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, r: fr.w / 2 } : undefined }); ctx.occupied.push(fr); }
        else ctx.add({ kind: 'circle', id: ctx.id('subd'), layer: 'zones', cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, r: fr.w / 2, fill: pal.accent });
      } else rawText(ctx, { id: ctx.id('subc'), role: 'big.main', text: ch, lang: 'zh', x: cx + size / 2, y: cy + size * 0.88, size, family: fam.family, weight: fam.weight, fill, anchor: 'middle' });
    });
    const below = vert ? { x: C.x, y: C.y + C.h * 0.55, w: C.w - size - u * 4, h: C.h * 0.45 } : { x: C.x, y: y0 + size + u * 5, w: C.w * 0.6, h: C.y + C.h - (y0 + size + u * 5) };
    ctx.group({ main: T.sub, note: T.note }, 'small', { ...below, h: Math.min(below.h, u * 26) }, { mainSize: ctx.size('smallMain'), align: 'start', on, mode: 'balance', maxLines: 3 });
    groupArray(ctx, { x: C.x, y: C.y + C.h - u * 14, w: C.w, h: u * 14 }, on, 2, { valign: 'bottom', maxPerRow: 2 });
    label(ctx, issue(ctx), C.x, C.y + u * 1, on);
    return;
  }
  // Latin: a round letter (O, Q, 0) becomes a disc. Without one, the word keeps every letter and the picture
  // substitutes its full stop instead (a disc on the baseline): the word stays legible, the dot carries the image.
  const word = hw.t;
  const fam = enDisplay(ctx);
  const tr = -0.01;
  let k = word.search(/[OQ0]/);
  const stop = k < 0;
  if (stop) k = word.length;
  const L = word.slice(0, k), R = stop ? '' : word.slice(k + 1), ch = stop ? '' : word[k];
  const capR = capOf(ctx, fam, false);
  const wL = width100(ctx, L, fam, tr), wR = width100(ctx, R, fam, tr), wC = ch ? width100(ctx, ch, fam, tr) : 0;
  const slot100 = stop ? capR * 0.62 : Math.max(wC, capR * 1.04);
  const gap100 = stop ? 0.06 : 0.02;
  let size = (C.w + u * 2) / (wL + wR + slot100 + gap100 * 2);
  size = Math.min(size, (H * (land(ctx) ? 0.5 : 0.34)) / capR);
  const cap = capR * size;
  const total = (wL + wR + slot100 + gap100 * 2) * size;
  const x0 = W / 2 - total / 2;
  const base = land(ctx) ? H * 0.5 + cap / 2 : H * 0.42 + cap / 2;
  if (L) rawText(ctx, { id: ctx.id('subl'), role: 'big.main', text: L, x: x0, y: base, size, family: fam.family, weight: fam.weight, fill, tracking: tr });
  const sx = x0 + (wL + gap100) * size, sw = slot100 * size;
  const fr = stop ? { x: sx, y: base - sw, w: sw, h: sw } : { x: sx + sw / 2 - cap * 0.52, y: base - cap * 1.02, w: cap * 1.04, h: cap * 1.04 };
  if (asset && hasPic(ctx)) {
    ctx.image(asset, fr, { clip: { type: 'circle', cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, r: fr.w / 2 } });
    ctx.occupied.push(fr);
  } else ctx.add({ kind: 'circle', id: ctx.id('subd'), layer: 'zones', cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, r: Math.min(fr.w, fr.h) / 2, fill: pal.accent });
  if (R) rawText(ctx, { id: ctx.id('subr'), role: 'big.main', text: R, x: sx + sw + gap100 * size, y: base, size, family: fam.family, weight: fam.weight, fill, tracking: tr });
  // copy: sub under the word's left edge; meta top; two groups at the foot
  const left = Math.max(C.x, x0);
  ctx.group({ main: T.sub, note: T.note }, 'small', { x: left, y: base + u * 5, w: C.w * (land(ctx) ? 0.4 : 0.6), h: Math.min(u * 24, C.y + C.h - base - u * 18) }, { mainSize: ctx.size('smallMain'), align: 'start', on, mode: 'balance', maxLines: 3 });
  label(ctx, issue(ctx), C.x, C.y + u * 1.5, on);
  label(ctx, `${T.meta[0]?.t ?? ''}  ·  ${year(ctx)}`, C.x + C.w, C.y + u * 1.5, on, { anchor: 'end' });
  groupArray(ctx, { x: C.x + C.w * (land(ctx) ? 0.55 : 0.0), y: C.y + C.h - u * 14, w: C.w * (land(ctx) ? 0.45 : 1), h: u * 14 }, on, 2, { valign: 'bottom', maxPerRow: 2 });
}

// ---------------------------------------------------------------- hanzi as image
const SIMPLE_HAN = new Set(Array.from('一二三十人入八工土士大小上下中日口回田目曰门山川也了己已乙七九'));
function hanzi(ctx: Ctx) {
  const { W, H, S, pal, u } = ctx;
  const T = ctx.texts;
  const on = pal.bg;
  const hl = T.headline;
  const chars = Array.from(hl.t.replace(/[\s，。、！？：；“”「」·]/g, ''));
  // a character with enough structure to read as an image once cropped (frame-like 日 口 回 read as plain shapes)
  const rich = chars.filter((c) => !SIMPLE_HAN.has(c));
  const ch = (rich.length ? rich[ctx.rng.int(0, Math.min(1, rich.length - 1))] : chars[0]) ?? '白';
  const fam = ctx.rt.chance(0.5) ? zhHeavy(ctx, true) : { family: ctx.rt.chance(0.5) ? 'Source Han Serif CN' : 'Source Han Sans CN', weight: 900 };
  const size = (S * ctx.rng.range(0.78, 0.98)) / 0.88;
  const E = eyes(W, H);
  const wide = land(ctx);
  // the glyph is cropped by one edge (licensed break): right or bottom on portrait, a short end on long formats
  const edge = wide ? (ctx.rng.chance(0.5) ? 'l' : 'r') : ctx.rng.pick(['r', 'b', 'r']);
  const bleed = size * ctx.rng.range(0.1, 0.2);
  let cx: number, cy: number;
  if (edge === 'r') { cx = W - size / 2 + bleed; cy = wide ? H / 2 : E[0].y + size * 0.1; }
  else if (edge === 'l') { cx = size / 2 - bleed; cy = H / 2; }
  else { cx = E[ctx.rng.pick([0, 1])].x; cx = clamp(cx, size / 2, W - size / 2); cy = H - size / 2 + bleed; }
  const inkCol = strong(ctx, on);
  const glyphFill = pal.source === 'itten:lightdark' || !accentOn(ctx, on, 2.2) || ctx.rt.chance(0.6) ? inkCol : pal.accent;
  rawText(ctx, { id: ctx.id('hz'), role: 'big.main', text: ch, lang: 'zh', x: cx, y: cy + size * 0.38, size, family: fam.family, weight: fam.weight, fill: glyphFill, anchor: 'middle' });
  const gBox = { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
  // the free side: vertical headline column + horizontal sub, on the canon block
  const free: Rect = edge === 'r' ? { x: u * 6, y: u * 6, w: Math.max(u * 20, gBox.x - u * 10), h: H - u * 12 }
    : edge === 'l' ? { x: gBox.x + gBox.w + u * 4, y: u * 6, w: W - (gBox.x + gBox.w) - u * 10, h: H - u * 12 }
      : { x: u * 6, y: u * 6, w: W - u * 12, h: Math.max(u * 20, gBox.y - u * 8) };
  const vs = clamp((free.h * 0.55) / Math.max(4, chars.length), u * 2.4, u * 6);
  const vtxt = chars.join('\n');
  const colX = free.x + vs / 2;
  const vn = rawText(ctx, { id: ctx.id('hzv'), role: 'big.sub', text: vtxt, lang: 'zh', x: colX, y: free.y + vs * 0.88, size: vs, family: ctx.role('big.main', 'zh').family, weight: Math.min(700, Math.max(500, ctx.role('big.main', 'zh').weight)), fill: inkCol, anchor: 'middle', leading: 1.12 });
  vn.vertical = true;
  // seal: a small accent square carrying two characters (≤ 5% of the area)
  if (ctx.on('ornament')) {
    const s = u * ctx.rng.range(5, 7);
    const sx = colX - s / 2, sy = free.y + vs * 1.12 * chars.length + u * 3;
    if (sy + s < H - u * 4) {
      ctx.add({ kind: 'rect', id: ctx.id('seal'), layer: 'ornament', x: sx, y: sy, w: s, h: s, fill: pal.accent, rx: s * 0.06 });
      const two = (chars.slice(-2).join('') || '白页');
      rawText(ctx, { layer: 'ornament', role: 'small.note', text: Array.from(two).join('\n'), lang: 'zh', x: sx + s / 2, y: sy + s * 0.44, size: s * 0.38, family: 'Source Han Serif CN', weight: 900, fill: wcag(pal.bg, pal.accent) > wcag(pal.ink, pal.accent) ? pal.bg : pal.ink, anchor: 'middle', leading: 1.05, tag: 'kit' }).vertical = true;
    }
  }
  const tx = colX + vs + u * 3;
  const tb = { x: tx, y: free.y + free.h * 0.55, w: Math.max(u * 16, free.x + free.w - tx), h: free.h * 0.45 };
  ctx.group({ main: T.sub, note: T.note }, 'small', tb, { mainSize: ctx.size('smallMain') * 0.8, align: 'start', valign: ctx.layered && ctx.rt.chance(0.4) ? 'top' : 'bottom', on, mode: 'balance', maxLines: 3 });
  label(ctx, issue(ctx), tx, free.y + u * 1, on);
  // optional small picture as the counterweight in the opposite quadrant (≤ 6%)
  const asset = img(ctx);
  if (asset && hasPic(ctx) && ctx.rng.chance(0.45) && tb.w > u * 18) {
    const a = W * H * 0.04, ar = clamp(asset.w / asset.h, 0.75, 1.33), w = Math.min(tb.w, Math.sqrt(a * ar));
    const fr = { x: tx, y: free.y + u * 6, w, h: w / ar };
    ctx.image(asset, fr); ctx.occupied.push(fr);
  }
}

// ---------------------------------------------------------------- repetition + one anomaly
function anomaly(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const T = ctx.texts;
  const on = pal.bg;
  const wide = land(ctx);
  const area: Rect = wide ? { x: C.x, y: C.y, w: C.w * 0.62, h: C.h } : { x: C.x, y: C.y + u * 6, w: C.w, h: C.h * 0.58 };
  const shape = ctx.rng.weighted<'circle' | 'square' | 'glyph' | 'bar'>({ circle: 3, square: 2, glyph: 0, bar: 1.5 });
  const cols = shape === 'bar' ? ctx.rng.int(7, 12) : wide ? ctx.rng.int(5, 8) : ctx.rng.int(3, 5);
  const cell = area.w / cols;
  const rows = shape === 'bar' ? 1 : Math.max(2, Math.floor(area.h / cell));
  const gap = cell * (shape === 'bar' ? 0.35 : ctx.rng.range(0.1, 0.22));
  const n = cols * rows;
  const odd = ctx.rng.int(0, n - 1);
  const asset = img(ctx);
  const usePic = asset && hasPic(ctx) && ctx.rng.chance(0.55);
  const unitCol = ctx.rng.chance(0.55) ? strong(ctx, on) : tonal(on, 0.22);
  const oddCol = wcag(pal.accent, on) > 1.3 ? pal.accent : strong(ctx, on);
  const oddMode = usePic ? 'pic' : ctx.rng.weighted<'colour' | 'turn' | 'hollow'>({ colour: 3, turn: shape === 'square' ? 1.5 : 0, hollow: 1 });
  const hw = heroWord(ctx, 6);
  const gl = hw.zh ? Array.from(hw.t)[0] : hw.t[0];
  const gfam = hw.zh ? zhHeavy(ctx, true) : enDisplay(ctx);
  const y0 = area.y + (area.h - rows * cell) / 2;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const b = { x: area.x + c * cell + gap / 2, y: (shape === 'bar' ? area.y : y0 + r * cell) + gap / 2, w: cell - gap, h: (shape === 'bar' ? area.h : cell) - gap };
    const isOdd = i === odd;
    const col = isOdd && oddMode === 'colour' ? oddCol : unitCol;
    if (isOdd && oddMode === 'pic' && asset) {
      const clip = shape === 'circle' ? { type: 'circle' as const, cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: b.w / 2 } : undefined;
      ctx.image(asset, b, { clip }); ctx.occupied.push(b);
      continue;
    }
    const hollow = isOdd && oddMode === 'hollow';
    if (shape === 'circle') ctx.add({ kind: 'circle', id: ctx.id('au'), layer: 'zones', cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: b.w / 2, fill: hollow ? 'none' : col, stroke: hollow ? unitCol : undefined, sw: hollow ? Math.max(2, u * 0.4) : undefined });
    else if (shape === 'square' || shape === 'bar') {
      if (isOdd && oddMode === 'turn') {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2 * 0.86;
        ctx.add({ kind: 'path', id: ctx.id('au'), layer: 'zones', d: `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`, fill: unitCol });
      } else ctx.add({ kind: 'rect', id: ctx.id('au'), layer: 'zones', x: b.x, y: b.y, w: b.w, h: b.h, fill: hollow ? 'none' : col, stroke: hollow ? unitCol : undefined, sw: hollow ? Math.max(2, u * 0.4) : undefined });
    } else {
      const sz = (b.h * 0.95) / (hw.zh ? 0.88 : capOf(ctx, gfam, false));
      const t = rawText(ctx, { id: ctx.id('ag'), role: 'big.note', text: gl, lang: hw.zh ? 'zh' : 'en', x: b.x + b.w / 2, y: b.y + b.h * 0.97, size: Math.min(sz, (b.w * 0.95) / Math.max(0.3, width100(ctx, gl, gfam))), family: gfam.family, weight: gfam.weight, fill: col, anchor: 'middle', tag: 'system' });
      if (hollow) { t.fill = 'none'; t.stroke = unitCol; t.sw = Math.max(1.5, u * 0.25); }
    }
  }
  ctx.occupied.push({ x: area.x, y: y0, w: area.w, h: rows * cell });
  // the copy takes the rest: big headline, sub, groups
  const rest: Rect = wide ? { x: area.x + area.w + u * 5, y: C.y, w: C.x + C.w - (area.x + area.w + u * 5), h: C.h } : { x: C.x, y: y0 + rows * cell + u * 5, w: C.w, h: C.y + C.h - (y0 + rows * cell + u * 5) };
  const hh = ctx.group({ main: T.headline, sub: T.sub }, 'big', { x: rest.x, y: rest.y, w: rest.w * (wide ? 1 : 0.8), h: rest.h * 0.62 }, { mainSize: Math.min(u * (wide ? 9 : 10), rest.h * 0.3), align: 'start', on, mode: 'balance', maxLines: 3 });
  groupArray(ctx, { x: rest.x, y: rest.y + hh + u * 3, w: rest.w, h: Math.max(u * 8, rest.h - hh - u * 3) }, on, wide ? 2 : 3, { valign: 'bottom', maxPerRow: wide ? 2 : 3 });
  label(ctx, `${pad2(odd + 1)} / ${pad2(n)}`, C.x + C.w, C.y + u * 1.5, on, { anchor: 'end', mono: true });
  label(ctx, issue(ctx), C.x, C.y + u * 1.5, on);
}

// ---------------------------------------------------------------- data as form: the date picks the cell
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function calendar(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const T = ctx.texts;
  const on = pal.bg;
  const zh = T.headline.lang === 'zh';
  let month = ctx.rd.int(0, 11), days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  let day = ctx.rd.int(1, days);
  let startDow = ctx.rd.int(0, 6);
  // a real event date (texts.facts, set by content-driven callers) picks the cell; the random draws above are still consumed
  const fd = T.facts?.date;
  if (fd && fd.m >= 1 && fd.m <= 12) {
    month = fd.m - 1; days = new Date(Date.UTC(fd.y, fd.m, 0)).getUTCDate(); day = clamp(Math.round(fd.d), 1, days);
    startDow = (new Date(Date.UTC(fd.y, fd.m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first, like the column heads
  }
  const ink = strong(ctx, on);
  const accent = wcag(pal.accent, on) > 1.4 ? pal.accent : ink;
  const mono = { family: 'IBM Plex Mono', weight: 500 };
  const timeline = wideF(ctx);
  const cells: { d: number; b: Rect }[] = [];
  let area: Rect;
  if (timeline) {
    area = { x: C.x, y: C.y + C.h * 0.58, w: C.w, h: C.h * 0.22 };
    const cw = area.w / days;
    for (let d = 1; d <= days; d++) cells.push({ d, b: { x: area.x + (d - 1) * cw, y: area.y, w: cw, h: area.h } });
  } else {
    area = { x: C.x, y: C.y + C.h * 0.4, w: C.w, h: C.h * 0.46 };
    const rows = Math.ceil((days + startDow) / 7);
    const cw = area.w / 7, ch = Math.min(area.h / (rows + 0.6), cw * 1.1);
    const heads = zh ? ['一', '二', '三', '四', '五', '六', '日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const hs = ctx.size('meta');
    heads.forEach((h, i) => rawText(ctx, { role: 'small.note', text: h, lang: zh ? 'zh' : 'en', x: area.x + i * cw + u * 0.6, y: area.y + hs, size: hs, family: zh ? ctx.role('small.note', 'zh').family : mono.family, weight: 500, fill: ink, tracking: 0.08, tag: 'system' }));
    for (let d = 1; d <= days; d++) { const k = d - 1 + startDow; cells.push({ d, b: { x: area.x + (k % 7) * cw, y: area.y + ch * 0.6 + Math.floor(k / 7) * ch, w: cw, h: ch } }); }
  }
  const from = ctx.nodes.length;
  const ns = timeline ? Math.min(cells[0].b.w * 0.42, u * 2.6) : Math.min(cells[0].b.h * 0.3, u * 3.2);
  // the event disc is placed first: grid numbers it would cover are not set (no text under text)
  const ev0 = cells.find((c) => c.d === day)!;
  const r0 = Math.min(ev0.b.w * (timeline ? 2.4 : 1.3), u * (timeline ? 13 : 16));
  const cx0 = clamp(ev0.b.x + ev0.b.w / 2, C.x + r0, C.x + C.w - r0), cy0 = ev0.b.y + ev0.b.h / 2;
  for (const c of cells) {
    if (c.d === day) continue;
    const nx = c.b.x + u * 0.6 + ns * 0.6, ny = c.b.y + ns * 0.7;
    if (Math.hypot(nx - cx0, ny - cy0) < r0 + ns * 1.2) { if (!timeline) hair(ctx, c.b.x, c.b.y, c.b.x + c.b.w - u * 0.8, c.b.y, 0.35, ink); continue; }
    rawText(ctx, { role: 'small.note', text: pad2(c.d), x: c.b.x + u * 0.6, y: c.b.y + ns * 1.1, size: ns, family: mono.family, weight: mono.weight, fill: ink, opacity: 0.55, tag: 'system' });
    if (!timeline) hair(ctx, c.b.x, c.b.y, c.b.x + c.b.w - u * 0.8, c.b.y, 0.35, ink);
    else hair(ctx, c.b.x, c.b.y + c.b.h, c.b.x, c.b.y + c.b.h - u * (c.d % 5 === 0 ? 3 : 1.5), 0.6, ink);
  }
  system(ctx, from);
  // the event cell: a disc 2.6 cells wide that overlaps its neighbours (licensed overlap), holding the photo or the number
  const ev = cells.find((c) => c.d === day)!;
  // the disc may overlap its neighbours but never the margin: at the edge columns it slides inward (still covering its cell)
  const r = Math.min(ev.b.w * (timeline ? 2.4 : 1.3), u * (timeline ? 13 : 16));
  const cx = clamp(ev.b.x + ev.b.w / 2, C.x + r, C.x + C.w - r), cy = ev.b.y + ev.b.h / 2;
  const asset = img(ctx);
  if (asset && hasPic(ctx) && ctx.rng.chance(0.6)) {
    const fr = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    ctx.image(asset, fr, { clip: { type: 'circle', cx, cy, r } });
    ctx.add({ kind: 'circle', id: ctx.id('evr'), layer: 'ornament', cx, cy, r: r + u * 0.6, fill: 'none', stroke: accent, sw: Math.max(2, u * 0.35) });
    ctx.occupied.push(fr);
  } else {
    ctx.add({ kind: 'circle', id: ctx.id('ev'), layer: 'zones', cx, cy, r, fill: accent });
    const fam = enDisplay(ctx);
    const sz = (r * 1.0) / capOf(ctx, fam, false);
    rawText(ctx, { id: ctx.id('evn'), role: 'big.main', text: pad2(day), x: cx, y: cy + (capOf(ctx, fam, false) * sz) / 2, size: sz, family: fam.family, weight: fam.weight, fill: strong(ctx, accent), anchor: 'middle' });
  }
  // the headline hangs from the event's column (data places the type)
  const hx = clamp(ev.b.x, C.x, C.x + C.w * (timeline ? 0.6 : 0.42));
  const top: Rect = timeline ? { x: hx, y: C.y + u * 6, w: C.x + C.w - hx, h: area.y - C.y - r - u * 8 } : { x: hx, y: C.y + u * 6, w: C.x + C.w - hx, h: area.y - C.y - u * 10 };
  ctx.group({ main: T.headline, sub: T.sub }, 'big', top, { mainSize: Math.min(u * 11, top.h * 0.42), align: 'start', valign: 'bottom', on, mode: 'balance', maxLines: 3 });
  // a leader from the headline down to the disc
  hair(ctx, hx, top.y + top.h + u * 1.5, hx, cy - r - u * 1, 0.8, accent);
  label(ctx, `${zh ? `${month + 1}月` : MON_EN[month]} ${year(ctx)}`, C.x, C.y + u * 1.5, on, { tracking: 0.2 });
  label(ctx, issue(ctx), C.x + C.w, C.y + u * 1.5, on, { anchor: 'end' });
  const foot = area.y + area.h + u * 4;
  if (C.y + C.h - foot > u * 8) groupArray(ctx, { x: C.x, y: foot, w: C.w, h: C.y + C.h - foot }, on, 3, { valign: 'bottom', maxPerRow: 3 });
}

// ---------------------------------------------------------------- reveal: a washed field and one crisp window
function windowC(ctx: Ctx) {
  const { W, H, S, pal, u } = ctx;
  const T = ctx.texts;
  const asset = img(ctx);
  if (!asset || !hasPic(ctx)) { ma(ctx); return; }
  const frame = { x: 0, y: 0, w: W, h: H };
  const duo = ctx.rng.chance(0.45);
  const base = ctx.image(asset, frame, { filter: duo ? { duotone: [pal.dark, pal.bg] } : { grayscale: true, contrast: 1 }, overlay: duo ? undefined : { color: pal.bg, opacity: ctx.rng.range(0.32, 0.46) } });
  // the window sits on the subject (the truth), or on an eye when the picture has no clear subject
  const dr = imageDrawRect(base);
  const sj = asset.subject;
  const E = eyes(W, H);
  let cx: number, cy: number;
  if (sj && sj.w * sj.h < 0.5) { cx = dr.x + (sj.x + sj.w / 2) * dr.w; cy = dr.y + (sj.y + sj.h / 2) * dr.h; }
  else { const e = ctx.rng.pick(E); cx = e.x; cy = e.y; }
  const r = S * ctx.rng.range(0.22, 0.3);
  cx = clamp(cx, r + u * 4, W - r - u * 4); cy = clamp(cy, r + u * 4, H - r - u * 4);
  const rect = ctx.rng.chance(0.3);
  ctx.image(asset, frame, { fx: base.fx, fy: base.fy, filter: { sat: 1.08, contrast: 1.04 }, clip: rect ? { type: 'rect', x: cx - r, y: cy - r * 1.25, w: r * 2, h: r * 2.5 } : { type: 'circle', cx, cy, r } });
  const ring = rect ? { x: cx - r, y: cy - r * 1.25, w: r * 2, h: r * 2.5 } : { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  ctx.occupied.push(ring);
  // the type lives on the washed half away from the window
  const field = duo ? pal.bg : pal.bg;
  const leftFree = cx > W / 2;
  const tw = (leftFree ? ring.x : W - (ring.x + ring.w)) - u * 12;
  const C = ctx.grid.content;
  const box: Rect = tw > W * 0.28 ? { x: leftFree ? C.x : ring.x + ring.w + u * 6, y: C.y + u * 4, w: tw, h: C.h * 0.55 } : { x: C.x, y: cy > H / 2 ? C.y + u * 4 : ring.y + ring.h + u * 5, w: C.w * 0.8, h: (cy > H / 2 ? ring.y - C.y - u * 8 : C.y + C.h - (ring.y + ring.h) - u * 18) };
  box.h = Math.max(box.h, u * 16); box.w = Math.max(box.w, u * 24);
  if (box.y + box.h > H - u * 4) box.y = Math.max(u * 4, H - u * 4 - box.h);
  ctx.group({ main: T.headline, sub: T.sub, note: T.note }, 'big', box, { mainSize: Math.min(u * 11, Math.max(u * 5, box.h * 0.32)), align: 'start', on: field, fill: duo ? strong(ctx, pal.bg) : undefined, mode: 'balance', maxLines: 3 });
  label(ctx, issue(ctx), C.x, C.y + u * 1.5, field);
  label(ctx, year(ctx), C.x + C.w, C.y + u * 1.5, field, { anchor: 'end' });
  groupArray(ctx, { x: C.x, y: C.y + C.h - u * 13, w: C.w, h: u * 13 }, field, 2, { valign: 'bottom', maxPerRow: 2 });
}

export const COMPOSERS_V5 = { ma, substitute, hanzi, anomaly, calendar, window: windowC };
