import { imageDrawRect } from '../render/svg';
import type { Ctx, ImageAsset, Align } from './ctx';
import { cellRect, inset, type Rect } from './grid';
import type { Shape, ImgFilter, ImageNode } from '../types';
import { metaRow, bigGlyph, gridDecor, ornament, signature, curves, shapes, noiseMarks, ICONS, overlap } from './decor';
import { roundedPath, tornPath, fanPath, archPath, wavePath, brushPath, rectPath } from './masks';
import { wcag, relLum } from '../color/contrast';
import { mix, adjust } from '../color/convert';
import type { PT } from './pick';
import type { LegacyComp } from '../../data/styles';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- shared helpers
export function alignPick(ctx: Ctx, side?: 'left' | 'right'): Align {
  const a = ctx.str('align');
  if (a === 'center') return 'middle';
  if (a === 'lr') return side === 'right' ? 'end' : ctx.rt.chance(0.7) ? 'start' : 'end';
  if (a === 'array') return 'start';
  return ctx.rt.weighted<Align>({ start: 6, end: 2, middle: 1.5 });
}

export function imgFilter(ctx: Ctx, onDark = true): ImgFilter {
  const f: ImgFilter = {};
  const duo = ctx.num('duotone') / 100 + (ctx.mode('experimental') ? 0.15 : 0) + (ctx.mode('random') ? 0.1 : 0);
  if (ctx.rng.chance(duo)) {
    const dark = relLum(ctx.pal.dark) < 0.1 ? ctx.pal.dark : '#111111';
    const light = ctx.rng.chance(0.5) ? ctx.pal.accent : ctx.pal.bg;
    f.duotone = onDark ? [dark, relLum(light) > 0.25 ? light : ctx.pal.light] : [mix(dark, ctx.pal.accent, 0.3), ctx.pal.light];
  }
  return f;
}

export function maskKind(ctx: Ctx, fallback: string[] = ['rect']): string {
  const k = ctx.str('maskKind');
  const v2 = ctx.plan.v2;
  if (ctx.mode('brushImage')) return v2 ? 'torn' : 'brush';
  if (k !== 'auto') return k;
  const pick = ctx.rng.pick(fallback);
  // art direction v2 retires blob / wavy masks: a torn edge or a clean rect reads as deliberate
  if (v2 && (pick === 'brush' || pick === 'wave')) return ctx.rng.chance(0.5) ? 'torn' : 'rect';
  return pick;
}

export function maskShape(ctx: Ctx, kind: string, r: Rect, o: { tornEdges?: { t?: boolean; r?: boolean; b?: boolean; l?: boolean }; corner?: number } = {}): Shape | undefined {
  const rough = ctx.num('tornRough') / 100;
  switch (kind) {
    case 'rounded': return { type: 'path', d: roundedPath(r, ctx.num('cornerRadius') * ctx.u / 12) };
    case 'torn': return { type: 'path', d: tornPath(ctx.rng, r, o.tornEdges ?? { t: true, b: true }, rough) };
    case 'fan': return { type: 'path', d: fanPath(r, o.corner ?? ctx.rng.int(0, 3), Math.min(r.w, r.h) * (r.w / r.h > 1.4 || r.h / r.w > 1.4 ? 1 : 1)) };
    case 'arch': return { type: 'path', d: archPath(r) };
    case 'circle': return { type: 'circle', cx: r.x + r.w / 2, cy: r.y + r.h / 2, r: Math.min(r.w, r.h) / 2 };
    case 'wave': return { type: 'path', d: wavePath(ctx.rng, r, ctx.u * 1.6, ctx.rng.range(1, 2.5), ctx.rng.chance(0.5) ? 'top' : 'bottom') };
    case 'brush': return { type: 'path', d: brushPath(ctx.rng, r, ctx.rng.int(2, 4)) };
    default: return undefined;
  }
}

export function img(ctx: Ctx, i = 0): ImageAsset | null { return ctx.images.length ? ctx.images[i % ctx.images.length] : null; }

/** text color + overlay for text placed over an image region */
function overImage(ctx: Ctx, asset: ImageAsset, frame: Rect, region: Rect, size: number) {
  const lg = ctx.legible(asset, frame, region, size, true);
  return lg;
}

export function header(ctx: Ctx, area: Rect, on: string, where: 'top' | 'bottom' = 'top', idx = 0) {
  const n = ctx.num('metaCount');
  if (n <= 0) return 0;
  const cnt = where === 'top' ? Math.min(3, Math.ceil(n / 2)) : Math.min(3, Math.floor(n / 2));
  if (cnt <= 0) return 0;
  return metaRow(ctx, area, where === 'top' ? area.y : area.y + area.h, on, where, cnt, idx);
}

export function headlineSize(ctx: Ctx, w: number) { return clamp(w / 3.2, ctx.u * 6, ctx.u * 30) * ctx.num('titleScale') / 100; }

/** small groups distributed in an array of columns within area (bottom aligned) */
export function groupArray(ctx: Ctx, area: Rect, on: string, n: number, o: { valign?: 'top' | 'bottom'; align?: Align; startIdx?: number; colsFrom?: number[]; maxPerRow?: number } = {}) {
  if (n <= 0 || !ctx.on('text')) return 0;
  const g = ctx.grid;
  let xs = (o.colsFrom ?? g.x).filter((x) => x >= area.x - 1 && x <= area.x + area.w + 1);
  if (xs.length < 2) xs = [area.x, area.x + area.w]; // no grid columns inside the area: treat it as one column
  const cols = Math.max(1, xs.length - 1);
  const k = Math.min(n, o.maxPerRow ?? Math.max(1, Math.min(4, cols)));
  const span = Math.max(1, Math.floor(cols / k));
  let hmax = 0;
  for (let i = 0; i < k; i++) {
    const c0 = Math.min(cols - 1, i * span);
    const x0 = xs[c0], x1 = xs[Math.min(cols, c0 + span)] ?? area.x + area.w;
    const gp = ctx.u * 1.2;
    const box = { x: x0 + (c0 > 0 ? gp / 2 : 0), y: area.y, w: Math.max(0, x1 - x0 - gp), h: Math.max(0, area.h) };
    const grp = ctx.texts.groups[((o.startIdx ?? 0) + i) % ctx.texts.groups.length];
    const h = ctx.group({ main: grp.main, note: ctx.rt.chance(0.75) ? grp.note : undefined, sub: ctx.rt.chance(0.25) ? grp.sub : undefined }, 'small', box, { mainSize: ctx.size('smallMain'), align: o.align ?? 'start', valign: o.valign ?? 'bottom', on, mode: 'words', lines: 2, maxLines: 3, accentRule: ctx.rt.chance(0.3) });
    hmax = Math.max(hmax, h);
  }
  return hmax;
}

export function bigTitle(ctx: Ctx, box: Rect, on: string, o: { align?: Align; valign?: 'top' | 'bottom'; withSub?: boolean; withNote?: boolean; size?: number; fill?: string; lines?: number; mode?: 'balance' | 'words' | 'greedy' } = {}) {
  if (!ctx.on('text')) return 0;
  const T = ctx.texts;
  const w = box.w * ctx.num('maxLineWidth') / 100;
  const bx = { ...box, w, x: o.align === 'end' ? box.x + box.w - w : o.align === 'middle' ? box.x + (box.w - w) / 2 : box.x };
  return ctx.group({ main: T.headline, sub: o.withSub === false ? undefined : T.sub, note: o.withNote ? T.note : undefined }, 'big', bx, {
    mainSize: o.size ?? headlineSize(ctx, w), align: o.align ?? 'start', valign: o.valign, on, fill: o.fill, accentRule: ctx.rt.chance(0.35), mode: o.mode ?? (ctx.rt.chance(0.5) ? 'words' : 'balance'), lines: o.lines ?? ctx.rt.int(2, 3),
  });
}

function allowedIcons(ctx: Ctx) {
  const set = String(ctx.p.ornamentSet ?? '').split(',').filter((x) => (ICONS as readonly string[]).includes(x));
  return (set.length ? set : [...ICONS]) as (typeof ICONS)[number][];
}
export function ornaments(ctx: Ctx, area: Rect, on: string, count = ctx.num('ornaments')) {
  if (!ctx.on('ornament') || count <= 0) return;
  const s = ctx.u * 3.4 * ctx.num('ornamentSize') / 100;
  const spots = ctx.rd.shuffle([
    { x: area.x + s / 2, y: area.y + s / 2 }, { x: area.x + area.w - s / 2, y: area.y + s / 2 },
    { x: area.x + s / 2, y: area.y + area.h - s / 2 }, { x: area.x + area.w - s / 2, y: area.y + area.h - s / 2 },
  ]);
  const col = wcag(ctx.pal.accent, on) > 2.2 && ctx.rd.chance(0.5) ? ctx.pal.accent : ctx.textColor(on, 30);
  let placed = 0;
  for (const sp of spots) {
    if (placed >= count) break;
    const box = { x: sp.x - s / 2, y: sp.y - s / 2, w: s, h: s };
    if (ctx.occupied.some((r) => overlap(r, box))) continue;
    if (ctx.rd.chance(0.25)) { signature(ctx, sp.x - (sp.x > area.x + area.w / 2 ? s * 3.5 : s / 2), sp.y - s / 3, s * 4, col, sp.x > area.x + area.w / 2 ? 'end' : 'start'); }
    else ornament(ctx, ctx.rd.pick(allowedIcons(ctx)), sp.x, sp.y, s, col);
    ctx.occupied.push(box);
    placed++;
  }
}

export function prose(ctx: Ctx, box: Rect, on: string, align: Align = 'start', i = 0) {
  const n = ctx.num('proseCount');
  if (n <= i || !ctx.on('text')) return 0;
  const size = ctx.size('note') * (0.85 + ctx.num('proseSize') / 100);
  const r = ctx.text(ctx.texts.prose[i % ctx.texts.prose.length], 'small.note', box, { size, align, on, mode: 'greedy', fit: false, leading: 1.5 });
  return r.h;
}

export function bandStrip(ctx: Ctx, y: number, h: number, fill?: string) {
  if (!ctx.on('band')) return;
  const col = fill ?? ctx.pal.accent;
  ctx.add({ kind: 'rect', id: ctx.id('band'), layer: 'band', x: 0, y, w: ctx.W, h, fill: col });
  const words = [ctx.texts.headline, ...ctx.texts.groups.map((g) => g.main)].filter((t) => t.lang === 'en').map((t) => t.t.toUpperCase());
  const seq = (words.length ? words : ['POSTER', 'PRINTER']).join('  —  ');
  const size = h * 0.42;
  const fam = ctx.fonts.en['small.note'];
  const sp = { family: fam.family, weight: Math.max(500, fam.weight), size, tracking: 0.12 };
  let t = seq;
  while (ctx.measure.width(t, sp) < ctx.W * 1.1 && t.length < 600) t += '  —  ' + seq;
  ctx.add({ kind: 'text', id: ctx.id('bandt'), layer: 'band', role: 'band', lang: 'en', lines: [{ text: t, x: -size, y: y + h / 2 + size * 0.36 }], size, family: sp.family, weight: sp.weight, tracking: 0.12, fill: ctx.textColor(col, size), anchor: 'start', box: { x: 0, y, w: ctx.W, h }, raw: t });
}

// ---------- compositions

/** 1. image block + type block */
function split(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const land = W > H * 1.15;
  const asset = img(ctx);
  const share = clamp(ctx.num('imageShare') / 100, 0.2, 0.8);
  const bleed = ctx.rng.chance(0.55);
  const gap = g.gutter > 0 ? g.gutter : ctx.u * 2.4;
  let frame: Rect, T: Rect;
  let imgFirst = ctx.rng.chance(0.55);
  if (!land) {
    const k = clamp(Math.round(g.nr * share), 1, g.nr - 1);
    const [r0, r1] = imgFirst ? [0, k] : [g.nr - k, g.nr];
    frame = cellRect(g, 0, g.nc, r0, r1, bleed);
    T = imgFirst ? { x: C.x, y: g.y[k] + gap, w: C.w, h: C.y + C.h - g.y[k] - gap } : { x: C.x, y: C.y, w: C.w, h: g.y[g.nr - k] - C.y - gap };
  } else {
    const k = clamp(Math.round(g.nc * share), 1, g.nc - 1);
    const [c0, c1] = imgFirst ? [0, k] : [g.nc - k, g.nc];
    frame = cellRect(g, c0, c1, 0, g.nr, bleed);
    T = imgFirst ? { x: g.x[k] + gap, y: C.y, w: C.x + C.w - g.x[k] - gap, h: C.h } : { x: C.x, y: C.y, w: g.x[g.nc - k] - C.x - gap, h: C.h };
  }
  const on = pal.bg;
  // zone color behind text region sometimes
  if (ctx.on('zones') && ctx.rng.chance(ctx.num('zoneStrength') / 160)) {
    const zc = ctx.rng.pick(pal.fills.slice(0, ctx.num('zoneColors')));
    const zr = land ? { x: T.x - gap / 2, y: 0, w: T.w + gap / 2 + (imgFirst ? g.m.r : 0), h: H } : { x: 0, y: imgFirst ? T.y - gap / 2 : 0, w: W, h: T.h + gap / 2 + (imgFirst ? g.m.b : g.m.t) };
    if (!imgFirst && !land) zr.h = T.y + T.h + gap / 2;
    ctx.add({ kind: 'rect', id: ctx.id('z'), layer: 'zones', ...zr, fill: zc });
    return splitText(ctx, T, zc, frame, asset, land, imgFirst, bleed);
  }
  splitText(ctx, T, on, frame, asset, land, imgFirst, bleed);
}

function splitText(ctx: Ctx, T: Rect, on: string, frame: Rect, asset: ImageAsset | null, land: boolean, imgFirst: boolean, bleed: boolean) {
  const g = ctx.grid;
  gridDecor(ctx, T, ctx.textColor(on, 10), { rows: ctx.rng.chance(0.3), ticks: ctx.rng.chance(0.4) });
  // image
  if (asset && ctx.on('images')) {
    const mk = maskKind(ctx, ['rect', 'rect', 'rect', 'torn', 'wave', bleed ? 'rect' : 'rounded', !bleed && !land ? 'arch' : 'rect']);
    const edges = land ? (imgFirst ? { r: true } : { l: true }) : imgFirst ? { b: true } : { t: true };
    let fr = frame;
    if (mk === 'arch' || mk === 'circle') {
      const s = Math.min(frame.w * 0.8, frame.h * (mk === 'arch' ? 1.6 : 1) * 0.92);
      const aw = mk === 'arch' ? Math.min(frame.w, s * 0.62) : s;
      fr = { x: frame.x + (frame.w - aw) * ctx.rng.pick([0, 0.5, 1]), y: frame.y, w: aw, h: frame.h };
    }
    const clip = maskShape(ctx, mk, fr, { tornEdges: edges });
    const im = ctx.image(asset, fr, { clip, filter: imgFilter(ctx) });
    // caption on image
    if (ctx.on('text') && ctx.rt.chance(0.45)) {
      const grp = ctx.texts.groups[5];
      const bw = Math.min(fr.w * 0.45, ctx.u * 26);
      const region = { x: fr.x + ctx.u * 2.5 + (bleed ? g.m.l * 0.6 : 0), y: fr.y + fr.h - ctx.u * 14, w: bw, h: ctx.u * 11 };
      const lg = overImage(ctx, asset, fr, region, ctx.size('smallMain'));
      if (lg.opacity > 0.05) im.overlay = { color: lg.color, opacity: Math.min(0.45, lg.opacity * 0.7) };
      ctx.group({ main: grp.main, note: grp.note }, 'small', region, { mainSize: ctx.size('smallMain') * 0.85, align: 'start', valign: 'bottom', on: lg.color, fill: lg.fill, mode: 'words', lines: 2 });
    }
  }
  // header
  let top = T.y, bottom = T.y + T.h;
  if (ctx.rt.chance(0.75)) { const hh = header(ctx, { ...T, y: top }, on, 'top'); top += hh + ctx.u * 3; }
  if (ctx.rt.chance(0.35)) { const hh = header(ctx, { ...T, y: T.y, h: T.h }, on, 'bottom', 3); bottom -= hh + ctx.u * 2; }
  const align = alignPick(ctx);
  // big glyph (behind)
  if (ctx.rng.chance(0.35)) bigGlyph(ctx, { x: T.x, y: top, w: T.w * 0.7, h: (bottom - top) * 0.75 }, on, { align: align === 'end' ? 'end' : 'start' });
  // title & groups: decide vertical arrangement
  const smallN = ctx.num('smallGroups');
  const titleAtTop = land ? ctx.rt.chance(0.6) : !imgFirst || ctx.rt.chance(0.6);
  const region = { x: T.x, y: top, w: T.w, h: bottom - top };
  const estGroups = smallN > 0 ? ctx.size('smallMain') * 2.2 + ctx.size('note') * 3 + ctx.u * 4 : 0;
  const titleBox = { ...region, h: Math.max(region.h * 0.35, region.h - estGroups - ctx.u * 4) };
  if (titleAtTop) {
    const th = bigTitle(ctx, titleBox, on, { align, withNote: ctx.rt.chance(0.3) });
    const rest = { x: region.x, y: region.y + th + ctx.u * 4, w: region.w, h: region.h - th - ctx.u * 4 };
    if (rest.h > ctx.u * 10) groupArray(ctx, rest, on, smallN, { valign: 'bottom', align: ctx.str('align') === 'center' ? 'middle' : 'start' });
    if (rest.h > ctx.u * 30) prose(ctx, { x: align === 'end' ? rest.x : rest.x + rest.w * 0.55, y: rest.y + ctx.u * 2, w: rest.w * 0.4, h: rest.h * 0.4 }, on, align === 'end' ? 'start' : 'start');
  } else {
    const gh = groupArray(ctx, { ...region, h: region.h * 0.4 }, on, smallN, { valign: 'top' });
    const tb = { x: region.x, y: region.y + gh + ctx.u * 4, w: region.w, h: region.h - gh - ctx.u * 4 };
    bigTitle(ctx, tb, on, { align, valign: 'bottom' });
  }
  ornaments(ctx, region, on, Math.min(1, ctx.num('ornaments')));
  noiseMarks(ctx, T, ctx.textColor(on, 10));
  if (ctx.rng.chance(0.25)) bandStrip(ctx, land ? ctx.H - g.m.b * 0.9 : imgFirst ? frame.y + frame.h - ctx.u * 3.2 : frame.y, ctx.u * 3.2);
}

/** 2. image sliced along grid cells, alternating with color/text cells */
function checker(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const land = W > H * 1.15;
  const on = pal.bg;
  const hasHeader = ctx.rng.chance(0.7);
  let hb = 0;
  if (hasHeader) {
    const h = header(ctx, { x: g.m.l, y: g.m.t * 0.9, w: W - g.m.l - g.m.r, h: 0 }, on, 'top');
    hb = g.m.t * 0.9 + h + ctx.u * 3;
  }
  const R = { x: 0, y: hb, w: W, h: H - hb };
  const nc = land ? clamp(g.nc, 3, 6) : clamp(g.nc, 2, 4);
  const nr = clamp(Math.round(nc * (R.h / R.w)), 2, 7);
  const cw = R.w / nc, ch = R.h / nr;
  const share = clamp(ctx.num('imageShare') / 100, 0.2, 0.8);
  const asset = img(ctx), asset2 = ctx.num('imageCount') > 1 ? img(ctx, 1) : null;
  const randomShift = ctx.mode('random') || ctx.str('maskKind') === 'random';
  type Cell = { i: number; j: number; r: Rect; kind: 'img' | 'color' | 'text' | 'glyph' | 'bg'; fill?: string };
  const cells: Cell[] = [];
  const parity = ctx.rng.int(0, 1);
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    const r = { x: R.x + i * cw, y: R.y + j * ch, w: cw, h: ch };
    const isImg = asset && ctx.on('images') && (((i + j + parity) % 2 === 0) ? ctx.rng.chance(Math.min(0.95, share * 1.5)) : ctx.rng.chance(share * 0.35));
    cells.push({ i, j, r, kind: isImg ? 'img' : 'color' });
  }
  const nonImg = cells.filter((c) => c.kind !== 'img');
  // headline cell: prefer top-row non-image cell
  const fills = pal.fills.slice(0, Math.max(1, ctx.num('zoneColors')));
  nonImg.forEach((c) => (c.fill = ctx.rng.chance(0.35) ? on : ctx.rng.pick(fills)));
  const tcells = ctx.rt.shuffle(nonImg);
  const titleCell = tcells.sort((a, b) => a.j - b.j)[0];
  // image slices
  if (asset) {
    const imgCells = cells.filter((c) => c.kind === 'img');
    const byAsset = (c: Cell) => (asset2 && (c.i + c.j) % 3 === 0 ? asset2 : asset);
    if (!randomShift) {
      for (const a of [asset, asset2]) {
        if (!a) continue;
        const cs = imgCells.filter((c) => byAsset(c) === a);
        if (cs.length) ctx.image(a, R, { clip: { type: 'union', shapes: cs.map((c) => ({ type: 'rect' as const, ...c.r })) }, filter: imgFilter(ctx) });
      }
    } else {
      for (const c of imgCells) {
        const a = byAsset(c);
        const sh = ctx.rng.range(-0.15, 0.15);
        ctx.image(a, { x: R.x, y: R.y + sh * R.h * 0.3, w: R.w, h: R.h }, { clip: { type: 'rect', ...c.r }, fy: clamp((a.focus?.y ?? 0.5) + sh, 0, 1), filter: imgFilter(ctx) });
      }
    }
  }
  for (const c of nonImg) ctx.add({ kind: 'rect', id: ctx.id('cell'), layer: 'zones', ...c.r, fill: c.fill! });
  // text cells
  const pad = ctx.u * 2.4;
  if (titleCell) {
    const span = titleCell.i < nc - 1 && cells.find((c) => c.i === titleCell.i + 1 && c.j === titleCell.j && c.kind !== 'img') ? 2 : 1;
    if (span === 2) { const nb = cells.find((c) => c.i === titleCell.i + 1 && c.j === titleCell.j)!; nb.fill = titleCell.fill; nb.kind = 'text'; ctx.add({ kind: 'rect', id: ctx.id('cell'), layer: 'zones', ...nb.r, fill: titleCell.fill! }); }
    titleCell.kind = 'text';
    const box = inset({ ...titleCell.r, w: titleCell.r.w * span }, pad);
    const al = ctx.rt.chance(0.5) ? 'end' : 'start';
    bigTitle(ctx, box, titleCell.fill!, { align: al, size: headlineSize(ctx, box.w) * 0.8, withNote: true, lines: 3, mode: 'words' });
  }
  const rest = tcells.filter((c) => c.kind === 'color');
  let gi = 0, glyphN = 0;
  for (const c of rest) {
    if (gi < ctx.num('smallGroups') && ctx.rt.chance(0.75)) {
      const grp = ctx.texts.groups[gi++];
      const al: Align = ctx.rt.chance(0.5) ? 'end' : 'start';
      ctx.group({ main: grp.main, note: grp.note }, 'small', inset(c.r, pad), { mainSize: ctx.size('smallMain'), align: al, valign: ctx.rt.chance(0.5) ? 'top' : 'bottom', on: c.fill!, mode: 'words', lines: 2 });
      c.kind = 'text';
    } else if (ctx.rng.chance(glyphN ? 0.25 : 0.5) && ctx.bool('bigGlyph')) {
      const gt = glyphN === 0 ? undefined : glyphN === 1 ? ((v: string) => ctx.texts.facts?.numeral || v)(String(ctx.rd.int(1, 12)).padStart(2, '0')) : ctx.rd.pick(['+', '*', '→', '§', '&']);
      glyphN++;
      bigGlyph(ctx, { x: c.r.x, y: c.r.y + c.r.h * 0.12, w: c.r.w, h: c.r.h * 0.95 }, c.fill!, { align: 'middle', text: gt, color: mix(c.fill!, ctx.textColor(c.fill!, 60), 0.35) });
      c.kind = 'glyph';
    }
  }
  if (ctx.on('lines') && ctx.num('gridOpacity') > 0) {
    for (let i = 1; i < nc; i++) ctx.add({ kind: 'line', id: ctx.id('gl'), layer: 'lines', x1: R.x + i * cw, y1: R.y, x2: R.x + i * cw, y2: H, stroke: ctx.textColor(on, 10), sw: 0.6, opacity: 0.15 });
  }
}

/** 3. full-bleed image with overlay type */
function fullbleed(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx);
  const frame = { x: 0, y: 0, w: W, h: H };
  if (!asset || !ctx.on('images')) return swiss(ctx);
  const brushMask = ctx.mode('brushMask');
  const im = ctx.image(asset, frame, { filter: imgFilter(ctx) });
  void im;
  const pos = ctx.rt.weighted(brushMask ? { bottom: 5, top: 3 } : { bottom: 5, top: 3, middle: 1 });
  const tb = pos === 'bottom' ? { x: C.x, y: C.y + C.h * 0.4, w: C.w, h: C.h * 0.6 } : pos === 'top' ? { x: C.x, y: C.y + ctx.u * 5, w: C.w, h: C.h * 0.55 } : { x: C.x, y: C.y + C.h * 0.25, w: C.w, h: C.h * 0.5 };
  // legibility scrim
  const lg = overImage(ctx, asset, frame, tb, 80);
  const textFill = lg.fill;
  if (brushMask) {
    // color overlay with brush-stroke window revealing the image
    const win = pos === 'bottom' ? { x: C.x + C.w * 0.04, y: C.y + ctx.u * 7, w: C.w * 0.92, h: C.h * 0.4 - ctx.u * 9 } : { x: C.x + C.w * 0.04, y: C.y + C.h * 0.56, w: C.w * 0.92, h: C.h * 0.24 };
    const brush = ctx.plan.v2 ? tornPath(ctx.rng, win, { t: true, r: true, b: true, l: true }, 0.4) : brushPath(ctx.rng, win, ctx.rng.int(2, 3));
    ctx.add({ kind: 'path', id: ctx.id('bm'), layer: 'zones', d: `${rectPath({ x: 0, y: 0, w: W, h: H })}${brush}`, fill: pal.bg, opacity: 1, rule: 'evenodd' });
  } else if (lg.opacity > 0.04) {
    const ang = pos === 'bottom' ? 90 : pos === 'top' ? 270 : 90;
    const o = lg.opacity;
    ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: 0, y: 0, w: W, h: H, fill: pos === 'middle' ? lg.color : `lg(${ang},${lg.color},0,${lg.color},${(o * 0.55).toFixed(2)},${lg.color},${Math.min(0.9, o * 1.25).toFixed(2)})`, opacity: pos === 'middle' ? o * 0.8 : 1 });
  }
  void im;
  const on = brushMask ? pal.bg : lg.color;
  const fillFor = (size: number) => (brushMask ? ctx.textColor(pal.bg, size) : textFill);
  // header over image
  const hy = g.m.t;
  const metaFill = brushMask ? ctx.textColor(pal.bg, 10) : ctx.legible(asset, frame, { x: C.x, y: hy, w: C.w, h: ctx.u * 3 }, 10).fill;
  const nMeta = ctx.num('metaCount');
  if (nMeta > 0 && ctx.on('text')) {
    const saved = ctx.nodes.length;
    header(ctx, { x: C.x, y: hy, w: C.w, h: 0 }, on, 'top');
    for (let i = saved; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = metaFill; }
  }
  const align = alignPick(ctx);
  if (pos === 'bottom') {
    const gh = ctx.num('smallGroups') > 0 ? ctx.size('smallMain') * 2.3 + ctx.size('note') * 3 + ctx.u * 3 : 0;
    const saved = ctx.nodes.length;
    groupArray(ctx, { x: C.x, y: C.y + C.h - gh, w: C.w, h: gh }, on, Math.min(3, ctx.num('smallGroups')), { valign: 'bottom' });
    for (let i = saved; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = fillFor(nd.size); }
    const saved2 = ctx.nodes.length;
    bigTitle(ctx, { x: C.x, y: tb.y, w: C.w, h: C.y + C.h - gh - ctx.u * 4 - tb.y }, on, { align, valign: 'bottom', fill: fillFor(80) });
    for (let i = saved2; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = fillFor(nd.size); }
  } else {
    const saved = ctx.nodes.length;
    bigTitle(ctx, tb, on, { align, fill: fillFor(80), withNote: true });
    const gh = ctx.size('smallMain') * 2.3 + ctx.size('note') * 3 + ctx.u * 3;
    const r2 = { x: C.x, y: C.y + C.h - gh, w: C.w, h: gh };
    const lg2 = ctx.legible(asset, frame, r2, 30);
    if (!brushMask && lg2.opacity > 0.1) ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: 0, y: H * 0.6, w: W, h: H * 0.4, fill: `lg(90,${lg2.color},0,${lg2.color},${Math.min(0.8, lg2.opacity * 1.2).toFixed(2)})` });
    groupArray(ctx, r2, on, Math.min(3, ctx.num('smallGroups')), { valign: 'bottom' });
    for (let i = saved; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = nd.box.y > H * 0.6 && !brushMask ? lg2.fill : fillFor(nd.size); }
  }
  ornaments(ctx, { x: C.x, y: C.y + ctx.u * 4, w: C.w, h: C.h * 0.3 }, on, Math.min(1, ctx.num('ornaments')));
  if (ctx.rng.chance(0.2)) bandStrip(ctx, pos === 'top' ? H - ctx.u * 4 : 0, ctx.u * 4);
}

/** 4. giant word spanning full width + image + stacked small groups */
function giant(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx);
  const on = pal.bg;
  const top = ctx.rng.chance(0.6);
  // giant word text
  const hl = ctx.texts.headline;
  let word = hl.lang === 'en' ? hl.t.split(' ').sort((a, b) => b.length - a.length)[0].toUpperCase() : Array.from(hl.t.replace(/\s/g, '')).slice(0, 4).join('');
  const rf = ctx.role('big.main', hl.lang);
  const sp = { family: rf.family, weight: rf.weight, size: 100, tracking: -0.01 };
  const w1 = ctx.measure.width(word, sp) / 100;
  let size = (W * 0.96) / w1;
  const maxH = H * (W > H ? 0.55 : 0.36);
  const cap0 = (hl.lang === 'zh' ? 0.86 : ctx.measure.metrics(sp).cap);
  size = Math.min(size, maxH / cap0);
  const cap = cap0 * size;
  const gy = top ? g.m.t + (ctx.rng.chance(0.4) ? 0 : ctx.u * 4) : H - g.m.b - cap - ctx.u * 2;
  const giantFill = ctx.rt.chance(0.5) && wcag(pal.accent, on) > 1.6 ? pal.accent : ctx.textColor(on, 200);
  const gnode = () => ctx.add({ kind: 'text', id: ctx.id('giant'), layer: 'text', role: 'big.main', lang: hl.lang, lines: [{ text: word, x: W / 2, y: gy + cap }], size, family: rf.family, weight: rf.weight, tracking: -0.01, fill: giantFill, anchor: 'middle', box: { x: W / 2 - (w1 * size) / 2, y: gy, w: w1 * size, h: cap }, raw: word });
  // image strip / block
  const variant = ctx.rng.weighted({ block: 3, strip: 2 });
  let frame: Rect | null = null;
  const layerCut = !!asset?.cutout && ctx.rng.chance(0.7);
  if (!asset || !ctx.on('images')) gnode();
  else {
    if (variant === 'block') {
      frame = top ? { x: 0, y: gy + cap * (layerCut ? ctx.rng.range(0.3, 0.6) : ctx.rng.range(1.15, 1.4)), w: W, h: H } : { x: 0, y: 0, w: W, h: gy - (layerCut ? -cap * ctx.rng.range(0.3, 0.6) : cap * 0.25) };
      if (top) frame.h = H - frame.y;
      const mk = maskKind(ctx, ['torn', 'rect', 'wave', 'torn']);
      const clip = maskShape(ctx, mk, frame, { tornEdges: top ? { t: true } : { b: true } });
      ctx.image(asset, frame, { clip, filter: imgFilter(ctx) });
      gnode();
      if (layerCut) ctx.image(asset, frame, { cutout: true, layer: 'images', filter: imgFilter(ctx) });
    } else {
      const sw = W * ctx.rng.range(0.3, 0.44);
      const sx = ctx.rng.range(W * 0.18, W * 0.82 - sw);
      frame = { x: sx, y: 0, w: sw, h: H };
      const clip: Shape = { type: 'path', d: tornPath(ctx.rng, frame, { l: true, r: true }, ctx.num('tornRough') / 100 + 0.3) };
      ctx.image(asset, frame, { clip, filter: imgFilter(ctx) });
      gnode();
      if (layerCut) ctx.image(asset, frame, { cutout: true, filter: imgFilter(ctx) });
    }
  }
  // stacked small groups in side columns
  const region = top ? { x: C.x, y: gy + cap + ctx.u * 5, w: C.w, h: C.y + C.h - (gy + cap + ctx.u * 5) } : { x: C.x, y: C.y + ctx.u * 2, w: C.w, h: gy - C.y - ctx.u * 6 };
  const colW = Math.min(C.w * 0.3, ctx.u * 26);
  const nL = Math.min(3, Math.ceil(ctx.num('smallGroups') / 2) + 1), nR = Math.min(3, Math.floor(ctx.num('smallGroups') / 2) + 1);
  const stack = (x: number, n: number, align: Align, idx: number) => {
    let y = region.y;
    const step = region.h / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const box = { x, y, w: colW, h: step - ctx.u * 2 };
      let onc = on, fill: string | undefined;
      if (frame && asset && overlap(frame, box)) { const lg = ctx.legible(asset, frame, box, 30); onc = lg.color; fill = lg.fill; }
      const grp = ctx.texts.groups[(idx + i) % 6];
      const isFirst = i === 0 && idx === 0;
      const saved = ctx.nodes.length;
      ctx.group({ main: isFirst ? ctx.texts.sub : grp.main, note: grp.note }, 'small', box, { mainSize: ctx.size('smallMain') * (isFirst ? 0.8 : 1), align, valign: 'top', on: onc, mode: 'words', lines: 3 });
      if (fill) for (let k = saved; k < ctx.nodes.length; k++) { const nd = ctx.nodes[k]; if (nd.kind === 'text') nd.fill = fill; }
      y += step;
    }
  };
  if (ctx.on('text')) {
    stack(region.x, nL, 'start', 0);
    stack(region.x + region.w - colW, nR, 'end', 3);
  }
  // meta
  const mh = header(ctx, { x: C.x, y: top ? C.y : C.y, w: C.w, h: C.h }, on, top ? 'bottom' : 'top', 2);
  void mh;
  ornaments(ctx, { x: C.x, y: top ? C.y + C.h * 0.4 : C.y, w: C.w, h: C.h * 0.6 }, on, Math.min(1, ctx.num('ornaments')));
}

/** 5. colour-clash partitions */
function partition(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const land = W > H * 1.15;
  const asset = img(ctx);
  const n = ctx.rng.weighted({ 2: 2, 3: 5, 4: 2 }) as unknown as string;
  const parts = Number(n);
  // edges along grid columns (portrait: vertical stripes)
  const axis = land ? 'x' : ctx.rng.chance(0.75) ? 'x' : 'y';
  const lines = axis === 'x' ? g.x.slice(1, -1) : g.y.slice(1, -1);
  const cuts = ctx.rng.sample(lines, Math.min(parts - 1, lines.length)).sort((a, b) => a - b);
  const edges = [0, ...cuts, axis === 'x' ? W : H];
  const rects: Rect[] = [];
  for (let i = 0; i < edges.length - 1; i++) rects.push(axis === 'x' ? { x: edges[i], y: 0, w: edges[i + 1] - edges[i], h: H } : { x: 0, y: edges[i], w: W, h: edges[i + 1] - edges[i] });
  const fills = [pal.bg, pal.accent, ...pal.fills.filter((f) => f !== pal.accent)];
  const imgIdx = asset && ctx.on('images') ? (ctx.rng.chance(0.6) ? rects.length - 1 : ctx.rng.int(0, rects.length - 1)) : -1;
  const torn = ctx.str('maskKind') === 'torn' || (ctx.str('maskKind') === 'auto' && ctx.rng.chance(0.6));
  const widest = rects.map((r, i) => ({ r, i })).filter((o) => o.i !== imgIdx).sort((a, b) => (axis === 'x' ? b.r.w - a.r.w : b.r.h - a.r.h))[0];
  const rf: string[] = [];
  rects.forEach((r, i) => {
    const fill = fills[i % fills.length];
    rf.push(fill);
    if (i === imgIdx && asset) {
      const ext = { ...r };
      const clip: Shape | undefined = torn ? { type: 'path', d: tornPath(ctx.rng, ext, axis === 'x' ? { l: i > 0, r: i < rects.length - 1 } : { t: i > 0, b: i < rects.length - 1 }, ctx.num('tornRough') / 100) } : undefined;
      ctx.image(asset, r, { clip, filter: ctx.rng.chance(0.55) ? { duotone: [mix(pal.dark, fill, 0.2), mix(pal.light, fill, 0.35)] } : imgFilter(ctx) });
    } else {
      const clip: Shape | undefined = torn && i > 0 ? { type: 'path', d: tornPath(ctx.rng, axis === 'x' ? { ...r, x: r.x - 6, w: r.w + 6 } : { ...r, y: r.y - 6, h: r.h + 6 }, axis === 'x' ? { l: true } : { t: true }, ctx.num('tornRough') / 100) } : undefined;
      ctx.add({ kind: 'rect', id: ctx.id('pt'), layer: 'zones', ...r, fill, clip });
    }
  });
  const main = widest ?? { r: rects[0], i: 0 };
  const mf = rf[main.i];
  // headline across top
  const C = g.content;
  const hl = ctx.texts.headline;
  const across = ctx.rt.chance(0.5);
  let acrossH = 0;
  if (across && ctx.on('text')) {
    const lang = hl.lang;
    const word = lang === 'zh' ? Array.from(hl.t).join('') : hl.t.toUpperCase();
    const col = pal.light;
    acrossH = ctx.text({ t: word, lang }, 'big.main', { x: C.x, y: C.y, w: C.w, h: H * (land ? 0.3 : 0.2) }, { size: headlineSize(ctx, C.w) * 1.4, align: 'middle', fill: wcag(col, mf) > 2 ? col : pal.dark, mode: 'single', fit: true, fitHeight: true, tracking: lang === 'zh' ? 0.3 : 0.02, noCase: true }).h;
    const saved = ctx.nodes.length;
    metaRow(ctx, C, C.y + H * 0.12, mf, 'top', 3, 1);
    for (let i = saved; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = ctx.textColor(rf[rects.findIndex((r) => nd.box.x + nd.box.w / 2 >= r.x && nd.box.x + nd.box.w / 2 <= r.x + r.w)] ?? mf, 10); }
  } else header(ctx, C, mf, 'top');
  // centered stack in main partition
  const mr = inset(main.r, ctx.u * 3);
  const top0 = across ? Math.max(C.y + H * 0.28, C.y + acrossH + ctx.u * 3) : C.y + H * 0.12;
  const box = { x: mr.x, y: top0, w: mr.w, h: Math.max(H * 0.3, C.y + C.h - top0 - ctx.u * 2) };
  if (axis === 'y') { box.y = mr.y; box.h = mr.h; }
  if (ctx.on('ornament') && ctx.rng.chance(0.6)) signature(ctx, box.x + box.w / 2 - ctx.u * 7, box.y, ctx.u * 14, pal.accent !== mf ? pal.accent : ctx.textColor(mf, 20), 'start');
  const gh = ctx.group({ main: across ? ctx.texts.groups[0].main : hl, sub: ctx.texts.sub, note: undefined }, 'big', { ...box, y: box.y + ctx.u * 6 }, { mainSize: headlineSize(ctx, box.w) * 0.85, align: 'middle', on: mf, accentRule: true, mode: 'balance' });
  const gy = box.y + ctx.u * 6 + gh + ctx.u * 4;
  if (ctx.on('text')) {
    const g2 = ctx.texts.groups[1];
    const h2 = ctx.group({ main: g2.main, note: g2.note }, 'small', { x: box.x, y: gy, w: box.w, h: box.h }, { mainSize: ctx.size('smallMain') * 0.9, align: 'middle', on: mf, mode: 'balance' });
    prose(ctx, { x: box.x, y: gy + h2 + ctx.u * 3, w: box.w, h: box.h }, mf, 'middle');
  }
  // side notes in other partitions
  rects.forEach((r, i) => {
    if (i === main.i || i === imgIdx || !ctx.on('text')) return;
    const b = inset(r, ctx.u * 2.4);
    const grp = ctx.texts.groups[2 + (i % 3)];
    ctx.group({ main: grp.main, note: grp.note }, 'small', { ...b, y: b.y + b.h * 0.55, h: b.h * 0.45 }, { mainSize: Math.min(ctx.size('smallMain') * 0.7, b.w / 4), align: 'start', valign: 'bottom', on: rf[i], mode: 'words', lines: 2 });
  });
  if (ctx.on('ornament') && ctx.num('ornaments') > 0) {
    const s = ctx.u * 4;
    ornament(ctx, ctx.rd.pick(allowedIcons(ctx)), main.r.x + main.r.w * 0.2, H - g.m.b - s, s, pal.accent !== mf ? pal.accent : ctx.textColor(mf, 20));
  }
  gridDecor(ctx, { x: 0, y: 0, w: W, h: H }, ctx.textColor(mf, 10), { nodes: true, numbers: false, cols: true });
}

/** 6. rounded cards */
function cards(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx), asset2 = img(ctx, 1);
  const gap = Math.max(ctx.u, ctx.num('cardGap') * ctx.u / 12);
  const rad = ctx.num('cornerRadius') * ctx.u / 12;
  let on = pal.bg;
  if (asset && ctx.on('images') && ctx.rng.chance(0.45)) {
    ctx.image(asset, { x: 0, y: 0, w: W, h: H }, { filter: { blur: 18, sat: 0.8 }, overlay: { color: pal.dark, opacity: 0.55 } });
    on = mix(pal.dark, asset.palette[0] ?? pal.dark, 0.35);
  }
  // headline top
  const hl = ctx.texts.headline;
  const r1 = ctx.on('text') ? ctx.text(hl, 'big.main', { x: C.x, y: C.y, w: C.w, h: H * 0.2 }, { size: headlineSize(ctx, C.w) * 1.2, align: ctx.rt.chance(0.7) ? 'middle' : 'start', on, mode: 'single', fit: true, maxLines: 1 }) : { h: 0 };
  let y = C.y + r1.h + ctx.u * 2;
  y += header(ctx, { x: C.x, y, w: C.w, h: 0 }, on, 'top', 1) + gap;
  const footH = ctx.size('meta') * 2.5;
  const avail = C.y + C.h - footH - y;
  const land = W > H * 1.15;
  const cols = land ? 3 : 2;
  const rows = land ? 2 : 3;
  const rh = (avail - gap * (rows - 1)) / rows;
  const cw = (C.w - gap * (cols - 1)) / cols;
  const cardFill = ctx.rng.chance(0.5) ? pal.accent : pal.alt;
  const lightCard = mix(pal.light, pal.bg, 0.15);
  // row 0: title card spanning
  const tc = { x: C.x, y, w: C.w, h: rh };
  ctx.add({ kind: 'rect', id: ctx.id('card'), layer: 'zones', ...tc, rx: rad, fill: cardFill });
  // title card: headline group anchored bottom-right, a meta column top-left and a running index bottom-left
  const ti = inset(tc, ctx.u * 3);
  const valign = ctx.rt.chance(0.6) ? 'bottom' : 'top';
  ctx.group({ main: ctx.texts.groups[0].main, sub: ctx.texts.sub }, 'big', { x: ti.x + ti.w * 0.3, y: ti.y, w: ti.w * 0.7, h: ti.h }, { mainSize: Math.min(rh * 0.34, ctx.u * 8.5), align: 'end', valign, on: cardFill, mode: 'balance' });
  const metaTop = valign === 'bottom';
  let my = metaTop ? ti.y : ti.y + ti.h * 0.45;
  const mtc = ctx.textColor(cardFill, 10);
  ctx.add({ kind: 'rect', id: ctx.id('rule'), layer: 'ornament', x: ti.x, y: my, w: ctx.u * 5, h: Math.max(1.2, ctx.u * 0.25), fill: mtc });
  my += ctx.u * 1.4;
  for (let k = 0; k < 3; k++) {
    const m = ctx.texts.meta[(k + 2) % Math.max(1, ctx.texts.meta.length)];
    if (!m) break;
    my += ctx.text(m, 'small.note', { x: ti.x, y: my, w: ti.w * 0.3, h: ctx.u * 4 }, { size: ctx.size('meta'), on: cardFill, mode: 'single', fit: true }).h + ctx.u * 0.6;
  }
  if (metaTop) ctx.text({ t: '01', lang: 'en' }, 'big.main', { x: ti.x, y: ti.y + ti.h - Math.min(ti.h * 0.4, ctx.u * 11), w: ti.w * 0.3, h: Math.min(ti.h * 0.4, ctx.u * 11) }, { size: Math.min(ti.h * 0.34, ctx.u * 9), on: cardFill, mode: 'single', align: 'start', fit: true, opacity: 0.85 });
  y += rh + gap;
  const kinds: ('img' | 'text')[] = [];
  if (land) kinds.push(...(ctx.rng.pick([['img', 'text', 'img'], ['img', 'img', 'text'], ['text', 'img', 'img']]) as ('img' | 'text')[]));
  else for (let i = 0; i < (rows - 1) * cols; i++) kinds.push(i < cols ? 'img' : 'text');
  if (!land && ctx.rng.chance(0.4)) kinds.reverse();
  const continuous = ctx.rng.chance(0.65);
  let gi = 1;
  kinds.forEach((k, idx) => {
    const r = Math.floor(idx / cols), c = idx % cols;
    const box = { x: C.x + c * (cw + gap), y: y + r * (rh + gap), w: cw, h: rh };
    const a = continuous || !asset2 || asset2 === asset ? asset : c % 2 === 0 ? asset : asset2;
    const rowFrame = { x: C.x, y: box.y, w: C.w, h: rh };
    if (k === 'img' && a && ctx.on('images')) ctx.image(a, continuous ? rowFrame : box, { clip: { type: 'path', d: roundedPath(box, rad) }, filter: imgFilter(ctx), fx: continuous ? undefined : c % 2 ? 0.7 : 0.3 });
    else {
      const f = ctx.rng.chance(0.6) ? lightCard : pal.fills[idx % pal.fills.length] ?? lightCard;
      ctx.add({ kind: 'rect', id: ctx.id('card'), layer: 'zones', ...box, rx: rad, fill: f });
      const b = inset(box, ctx.u * 3);
      const tc2 = ctx.textColor(f, 12);
      ctx.add({ kind: 'rect', id: ctx.id('rule'), layer: 'ornament', x: b.x, y: b.y, w: 1.5, h: ctx.u * 4, fill: tc2 });
      const grp = ctx.texts.groups[gi++ % ctx.texts.groups.length];
      const tx = b.x + ctx.u * 1.6;
      const mh = ctx.text(grp.main, 'small.main', { x: tx, y: b.y, w: b.w * 0.8, h: b.h * 0.45 }, { size: Math.min(ctx.size('smallMain') * 1.25, b.h * 0.2), on: f, mode: 'balance', fit: true }).h;
      const note = grp.note?.t ? grp.note : grp.sub?.t ? grp.sub : ctx.texts.sub;
      if (note?.t) ctx.text(note, 'small.note', { x: tx, y: b.y + mh + ctx.u * 1.2, w: b.w * 0.72, h: b.h - mh - ctx.u * 1.2 }, { size: ctx.size('note') * 1.05, on: f, mode: 'greedy', fit: false, maxLines: 4 });
      // card index, bottom-right
      ctx.text({ t: String(idx + 2).padStart(2, '0'), lang: 'en' }, 'big.main', { x: b.x, y: b.y + b.h - Math.min(b.h * 0.42, ctx.u * 12), w: b.w, h: Math.min(b.h * 0.42, ctx.u * 12) }, { size: Math.min(b.h * 0.36, ctx.u * 10), on: f, mode: 'single', align: 'end', fit: true, opacity: 0.85 });
    }
  });
  header(ctx, { x: C.x, y: C.y, w: C.w, h: C.h }, on, 'bottom', 4);
}

/** 7. math-curve fans */
function fan(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx);
  const on = pal.bg;
  const hh = header(ctx, C, on, 'top');
  const R = { x: C.x, y: C.y + hh + ctx.u * 2, w: C.w, h: C.h - hh - ctx.u * 2 };
  const land = W > H * 1.15;
  const nc = land ? ctx.rng.pick([3, 4]) : ctx.rng.pick([2, 2, 3]);
  const nr = clamp(Math.round((R.h / R.w) * nc), 2, 5);
  const cw = R.w / nc, ch = R.h / nr;
  const shapesL: Shape[] = [];
  const solid: { s: Shape; fill: string }[] = [];
  const textCell = ctx.rng.pick([0, nc - 1, (nr - 1) * nc, nr * nc - 1, ctx.rng.int(0, nc * nr - 1)]);
  const pattern = ctx.rng.weighted({ rotate: 2, mirror: 3, same: 1.5, petal: 2, random: 1.5 });
  const sameC = ctx.rng.int(0, 3);
  const mix = ctx.rng.weighted({ none: 2, few: 2, many: 1 });
  let tcell: Rect | null = null;
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    const r = { x: R.x + i * cw, y: R.y + j * ch, w: cw, h: ch };
    if (j * nc + i === textCell) { tcell = r; continue; }
    const k = ctx.rng.weighted({ fan: 7, half: 1.2, circle: 1, rect: 0.6, empty: 0.6 });
    if (k === 'empty') continue;
    // corner index: 0 TL, 1 TR, 2 BR, 3 BL (as fanPath expects)
    let corner: number;
    if (pattern === 'rotate') corner = (i + j * 3) % 4;
    else if (pattern === 'mirror') corner = [[2, 3], [1, 0]][j % 2][i % 2];
    else if (pattern === 'same') corner = sameC;
    else if (pattern === 'petal') { const cx = (i + 0.5) / nc < 0.5, cy = (j + 0.5) / nr < 0.5; corner = cy ? (cx ? 2 : 3) : cx ? 1 : 0; }
    else corner = ctx.rng.int(0, 3);
    let shp: Shape;
    if (k === 'fan') shp = { type: 'path', d: fanPath(r, corner, Math.min(r.w, r.h)) };
    else if (k === 'circle') shp = { type: 'circle', cx: r.x + r.w / 2, cy: r.y + r.h / 2, r: Math.min(r.w, r.h) / 2 };
    else if (k === 'half') shp = { type: 'path', d: archPath({ x: r.x, y: r.y + Math.max(0, r.h - r.w), w: r.w, h: Math.min(r.h, r.w) }) };
    else shp = { type: 'rect', ...r };
    const toSolid = !asset || !ctx.on('images') || (mix === 'few' && ctx.rng.chance(0.22)) || (mix === 'many' && ctx.rng.chance(0.45));
    if (toSolid) solid.push({ s: shp, fill: ctx.rng.chance(0.4) ? pal.accent : ctx.rng.pick(pal.fills) });
    else shapesL.push(shp);
  }
  const shapePath = (s: Shape) => (s.type === 'path' ? s.d : s.type === 'rect' ? rectPath(s) : s.type === 'circle' ? `M${s.cx - s.r} ${s.cy}a${s.r} ${s.r} 0 1 0 ${2 * s.r} 0a${s.r} ${s.r} 0 1 0 ${-2 * s.r} 0` : '');
  for (const so of solid) ctx.add({ kind: 'path', id: ctx.id('fs'), layer: 'shapes', d: shapePath(so.s), fill: so.fill === on ? pal.alt : so.fill });
  if (asset && ctx.on('images') && shapesL.length) ctx.image(asset, R, { clip: { type: 'union', shapes: shapesL }, filter: imgFilter(ctx) });
  gridDecor(ctx, R, ctx.textColor(on, 10), { rows: true, nodes: true, numbers: false });
  if (tcell) {
    const b = inset(tcell, ctx.u * 2.5);
    bigTitle(ctx, b, on, { align: ctx.rt.chance(0.5) ? 'start' : 'end', valign: ctx.rt.chance(0.5) ? 'top' : 'bottom', size: headlineSize(ctx, b.w) * 0.75, withNote: true, mode: 'words' });
  }
  ornaments(ctx, R, on, Math.min(1, ctx.num('ornaments')));
}

/** 8. image inside big type */
function typefill(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx);
  const on = pal.bg;
  const land = W > H * 1.15;
  const splitY = land ? C.y + C.h * 0.42 : C.y + C.h * ctx.rng.range(0.42, 0.55);
  header(ctx, C, on, 'top');
  const T = { x: C.x, y: C.y + ctx.u * 7, w: C.w, h: splitY - C.y - ctx.u * 12 };
  // left: headline, right: groups aligned right
  bigTitle(ctx, { ...T, w: T.w * 0.62, y: T.y + T.h * 0.15, h: T.h * 0.85 }, on, { align: 'start', size: headlineSize(ctx, T.w * 0.55) * 0.75, mode: 'words', lines: 4 });
  const rx = T.x + T.w * 0.66, rw = T.w * 0.34;
  let yy = T.y + T.h * 0.2;
  for (let i = 0; i < Math.min(3, ctx.num('smallGroups')); i++) {
    const grp = ctx.texts.groups[i + 1];
    yy += ctx.group({ main: grp.main, note: ctx.rt.chance(0.5) ? grp.note : undefined }, 'small', { x: rx, y: yy, w: rw, h: T.h }, { mainSize: ctx.size('smallMain') * 0.6, align: 'end', on, mode: 'words', lines: 2 }) + ctx.u * 3;
  }
  ornaments(ctx, { ...T, w: T.w * 0.4 }, on, 1);
  metaRow(ctx, C, splitY - ctx.u * 3, on, 'bottom', 3, 5);
  // giant words
  const hlWords = ctx.texts.headline.lang === 'en' ? ctx.texts.headline.t.split(/\s+/).filter((w) => w.length > 1) : [];
  const extra = ctx.texts.words.filter((w) => w.lang === 'en').map((w) => w.t.split(' ')[0]);
  let words = [...hlWords, ...extra].map((w) => w.toUpperCase().replace(/[^A-Z0-9&]/g, '')).filter(Boolean);
  let zhFill = false;
  if (!hlWords.length && ctx.texts.headline.lang === 'zh') {
    const chars = Array.from(ctx.texts.headline.t.replace(/[\s，。、·]/g, ''));
    const per = chars.length <= 2 ? chars.length : 2;
    words = [];
    for (let i = 0; i < chars.length && words.length < 2; i += per) words.push(chars.slice(i, i + per).join(''));
    zhFill = true;
  }
  if (!words.length) words = ['FORM'];
  const want = land ? (zhFill ? 1 : Math.min(2, Math.max(1, hlWords.length))) : zhFill ? words.length : Math.min(4, Math.max(hlWords.length, ctx.rng.int(2, 3)));
  const lines = (land && zhFill ? [words.join('')] : words).slice(0, want);
  const B = { x: ctx.u * 1.2, y: splitY, w: W - ctx.u * 2.4, h: H - splitY - ctx.u * 1.2 };
  const fam = zhFill ? ctx.fonts.glyphZh : ctx.fonts.glyph;
  const rf = ctx.role('big.main', zhFill ? 'zh' : 'en');
  const family = rf.weight >= 600 || /Anton|Bebas|Oswald|Six Caps|League|Big Shoulders|Archivo/.test(rf.family) ? rf.family : fam.family;
  const weight = family === rf.family ? Math.max(rf.weight, 700) : Math.max(fam.weight, 700);
  const lh = B.h / lines.length;
  const tl: { text: string; x: number; y: number }[] = [];
  let maxSize = 0;
  const sizes: number[] = [];
  lines.forEach((t, i) => {
    const sp = { family, weight, size: 100, tracking: -0.01 };
    const w1 = ctx.measure.width(t, sp) / 100;
    const cap = zhFill ? 0.86 : ctx.measure.metrics(sp).cap;
    const size = Math.min(B.w / w1, (lh * 0.9) / cap);
    sizes.push(size); maxSize = Math.max(maxSize, size);
    tl.push({ text: t, x: W / 2, y: B.y + lh * (i + 1) - (lh - cap * size) / 2 });
  });
  // one text node per line (sizes differ) → union clip
  const clipShapes: Shape[] = lines.map((t, i) => ({ type: 'text', lines: [tl[i]], size: sizes[i], family, weight, anchor: 'middle', tracking: -0.01 }));
  if (asset && ctx.on('images')) {
    // keep the picture-in-type legible against the ground: push the image's tone away from the background
    const bgL = relLum(on), imL = ctx.imageLum(asset, B, B);
    const ratio = (Math.max(bgL, imL) + 0.05) / (Math.min(bgL, imL) + 0.05);
    let filter = imgFilter(ctx);
    let outline = false;
    if (ratio < 3) {
      const bgLight = bgL > 0.3;
      const k = ratio < 1.5 ? 1 : 0.6;
      filter = bgLight
        ? { ...filter, bright: Math.min(filter.bright ?? 1, 1 - 0.38 * k), contrast: Math.max(filter.contrast ?? 1, 1.12) }
        : { ...filter, bright: Math.max(filter.bright ?? 1, 1 + 0.45 * k), contrast: Math.max(filter.contrast ?? 1, 1.08) };
      outline = ratio < 2;
    }
    ctx.image(asset, B, { clip: { type: 'union', shapes: clipShapes }, filter });
    if (outline || ctx.rng.chance(0.15)) {
      const ink = ctx.textColor(on, 40);
      lines.forEach((t, i) => ctx.add({ kind: 'text', id: ctx.id('tfo'), layer: 'ornament', role: 'glyph', lang: zhFill ? 'zh' : 'en', lines: [tl[i]], size: sizes[i], family, weight, tracking: -0.01, fill: 'none', stroke: ink, sw: Math.max(1.2, ctx.u * 0.14), anchor: 'middle', box: { x: B.x, y: tl[i].y - sizes[i] * 0.7, w: B.w, h: sizes[i] * 0.7 }, raw: t }));
    }
  } else {
    lines.forEach((t, i) => ctx.add({ kind: 'text', id: ctx.id('tf'), layer: 'text', role: 'big.main', lang: 'en', lines: [tl[i]], size: sizes[i], family, weight, tracking: -0.01, fill: pal.accent, anchor: 'middle', box: { x: B.x, y: tl[i].y - sizes[i] * 0.7, w: B.w, h: sizes[i] * 0.7 }, raw: t }));
  }
}

/** 9. Swiss structural poster: visible grid, circle, labels at nodes */
function swiss(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const on = pal.bg;
  const ink = ctx.textColor(on, 10);
  const wide = W / H > 1.5;
  gridDecor(ctx, { x: C.x, y: C.y, w: C.w, h: C.h }, ink, { rows: true, nodes: true, numbers: true, ticks: true });
  // zone tint
  if (ctx.on('zones') && ctx.rng.chance(0.4 + ctx.num('zoneStrength') / 200)) {
    const c0 = ctx.rng.int(0, g.nc - 2), r0 = ctx.rng.int(1, g.nr - 2);
    const zr = cellRect(g, c0, Math.min(g.nc, c0 + ctx.rng.int(2, 3)), r0, Math.min(g.nr, r0 + ctx.rng.int(2, 4)));
    ctx.add({ kind: 'rect', id: ctx.id('z'), layer: 'zones', ...zr, fill: mix(on, ink, 0.06) });
  }
  // image in a zone
  const asset = img(ctx);
  if (asset && ctx.on('images') && ctx.num('imageShare') > 15) {
    let fr: Rect;
    if (wide) {
      // wide formats: the image takes a right-hand column block, the title keeps the left
      const k = Math.max(1, Math.round(g.nc * ctx.rng.range(0.28, 0.4)));
      const c0 = g.nc - k - (ctx.rng.chance(0.4) && g.nc - k > Math.ceil(g.nc * 0.6) ? 1 : 0);
      fr = cellRect(g, c0, c0 + k, 0, g.nr);
    } else {
      const k = ctx.rng.int(1, Math.max(1, Math.floor(g.nc / 2)));
      const c0 = ctx.rng.int(0, g.nc - k), r0 = ctx.rng.int(Math.floor(g.nr / 3), Math.max(Math.floor(g.nr / 3), g.nr - 2));
      fr = cellRect(g, c0, c0 + k, r0, Math.min(g.nr, r0 + ctx.rng.int(1, 3)));
      // never let the picture climb into the headline zone
      const top = C.y + C.h * 0.42;
      if (fr.y < top) { const b = fr.y + fr.h; fr = { ...fr, y: top, h: Math.max(b - top, C.h * 0.18) }; }
    }
    ctx.image(asset, fr, { filter: ctx.rng.chance(0.5) ? { grayscale: true, contrast: 1.1 } : imgFilter(ctx), clip: maskShape(ctx, maskKind(ctx, ['rect', 'rect', 'circle', 'arch']), fr) });
  }
  // circle
  if (ctx.on('curves') && ctx.rng.chance(0.75)) {
    const cx = g.x[ctx.rng.int(1, g.nc - 1)], cy = g.y[ctx.rng.int(Math.floor(g.nr / 3), Math.max(Math.floor(g.nr / 3), g.nr - 2))];
    const r = Math.min(C.w, C.h) * ctx.rng.range(0.22, 0.34);
    ctx.add({ kind: 'circle', id: ctx.id('cv'), layer: 'curves', cx, cy, r, stroke: ink, sw: ctx.num('lineWeight'), opacity: 0.8 });
    if (ctx.on('text')) ctx.text(ctx.texts.words[1] ?? ctx.texts.groups[0].main, 'small.note', { x: cx - r * 0.9, y: cy - 6, w: r * 0.9, h: 12 }, { size: ctx.size('meta') * 1.1, on, mode: 'single', tracking: 0.1, noCase: false });
  }
  if (ctx.bool('guides') && ctx.on('lines')) {
    ctx.add({ kind: 'line', id: ctx.id('gd'), layer: 'lines', x1: C.x, y1: C.y, x2: C.x + C.w, y2: C.y + C.h, stroke: ink, sw: 0.7, opacity: 0.25, dash: '3 5' });
    ctx.add({ kind: 'line', id: ctx.id('gd'), layer: 'lines', x1: C.x + C.w, y1: C.y, x2: C.x, y2: C.y + C.h, stroke: ink, sw: 0.7, opacity: 0.25, dash: '3 5' });
  }
  // glyph + headline top-left
  const align = alignPick(ctx);
  bigGlyph(ctx, { x: C.x, y: C.y, w: C.w * 0.4, h: C.h * 0.35 }, on, { align: align === 'end' ? 'end' : 'start', opacity: 0.6 });
  const tw = wide ? C.w * 0.56 : C.w * (align === 'middle' ? 1 : 0.8);
  const th = bigTitle(ctx, { x: C.x, y: C.y, w: tw, h: C.h * (wide ? 0.55 : 0.4) }, on, { align: wide ? 'start' : align, withSub: true, size: headlineSize(ctx, tw) * (wide ? 0.85 : 0.7) });
  // small labels at nodes
  for (let i = 0; i < ctx.num('metaCount'); i++) {
    const x = g.x[ctx.rt.int(0, g.nc - 1)] + 5, y = g.y[ctx.rt.int(2, g.nr - 1)] + 5;
    const box = { x, y, w: ctx.u * 12, h: ctx.u * 3 };
    if (ctx.occupied.some((r) => overlap(r, box)) || y < C.y + th) continue;
    ctx.text(ctx.texts.meta[i], 'small.note', box, { size: ctx.size('meta'), on, mode: 'single', fit: true });
  }
  groupArray(ctx, { x: C.x, y: C.y + C.h * 0.7, w: wide ? C.w * 0.56 : C.w, h: C.h * 0.3 }, on, ctx.num('smallGroups'), { valign: 'bottom' });
  shapes(ctx, C, [pal.accent]);
  ornaments(ctx, C, on);
  curves(ctx, C, ink);
}

/** 10. centred editorial stack */
function centered(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  if (W / H > 1.5) return centeredWide(ctx);
  const C = g.content;
  const on = pal.bg;
  const land = W > H * 1.15;
  ornaments(ctx, { x: C.x, y: C.y, w: C.w, h: ctx.u * 8 }, on, 2);
  const colW = Math.min(C.w * (land ? 0.42 : 0.62), ctx.u * 60);
  const cx = land ? C.x + C.w * 0.62 : C.x + C.w / 2;
  let y = C.y + C.h * (land ? 0.12 : 0.18);
  if (ctx.on('text')) {
    const lab = ctx.texts.meta[0];
    y += ctx.text({ t: lab.t, lang: lab.lang }, 'small.note', { x: cx - colW / 2, y, w: colW, h: 20 }, { size: ctx.size('meta') * 1.15, align: 'middle', on, mode: 'single', weight: 700, tracking: 0.12 }).h + ctx.u * 2;
    y += ctx.group({ main: ctx.texts.headline }, 'big', { x: cx - colW / 2, y, w: colW, h: C.h * 0.3 }, { mainSize: headlineSize(ctx, colW) * 0.7, align: 'middle', on, mode: 'balance', maxLines: 2, ...(ctx.layered && wcag(pal.accent, on) >= 3 && ctx.rt.chance(0.35) ? { fill: pal.accent } : {}) }) + ctx.u * 1.5;
    y += ctx.text(ctx.texts.note, 'big.note', { x: cx - colW / 2, y, w: colW, h: 100 }, { size: ctx.size('note') * 1.05, align: 'middle', on, mode: 'greedy', fit: false, tracking: 0.06 }).h + ctx.u * 4;
  }
  const asset = img(ctx);
  const imgW = land ? C.w * 0.3 : C.w * ctx.rng.range(0.28, 0.4);
  const groupsN = Math.min(3, ctx.num('smallGroups'));
  const bottomWordH = C.h * 0.14;
  const avail = C.y + C.h - bottomWordH - ctx.u * 6 - y;
  const step = avail / Math.max(1, groupsN);
  if (asset && ctx.on('images')) {
    const ih = Math.min(avail * 0.7, imgW * 1.3);
    const fr = land ? { x: C.x, y: C.y + C.h * 0.2, w: imgW, h: C.h * 0.6 } : { x: ctx.rng.chance(0.5) ? C.x : C.x + C.w - imgW, y: y + avail * 0.25, w: imgW, h: ih };
    ctx.image(asset, fr, { clip: maskShape(ctx, maskKind(ctx, ['rect', 'arch', 'rect', 'rounded']), fr), filter: imgFilter(ctx) });
    ctx.occupied.push(fr);
  }
  for (let i = 0; i < groupsN && ctx.on('text'); i++) {
    const grp = ctx.texts.groups[i];
    const gw = colW * 0.75;
    ctx.group({ main: grp.main, note: grp.note }, 'small', { x: cx - gw / 2, y: y + i * step, w: gw, h: step }, { mainSize: ctx.size('smallMain') * 0.75, align: 'middle', on, mode: 'balance' });
  }
  // bottom spaced word (an occasional signature, not a tic): otherwise a ruled meta row closes the column
  if (ctx.on('text') && !ctx.rtd.chance(0.3)) {
    const ry = C.y + C.h - ctx.u * 6;
    ctx.add({ kind: 'line', id: ctx.id('rule'), layer: 'lines', x1: C.x, y1: ry, x2: C.x + C.w, y2: ry, stroke: ctx.textColor(on, 10), sw: Math.max(1, ctx.u * 0.09), opacity: 0.7 });
    metaRow(ctx, C, C.y + C.h, on, 'bottom', 3, 2);
  } else if (ctx.on('text')) {
    const cands = [...ctx.texts.headline.t.split(/\s+/), ...ctx.texts.words.flatMap((w) => w.t.split(/\s+/))].filter((w) => /^[A-Za-z]{3,8}$/.test(w));
    const word = (cands.sort((a, b) => Math.abs(a.length - 5) - Math.abs(b.length - 5))[0] ?? 'FORM').toUpperCase();
    const rf = ctx.role('big.main', 'en');
    const sp = { family: rf.family, weight: rf.weight, size: 100, tracking: 0.35 };
    const w1 = ctx.measure.width(word, sp) / 100;
    const size = Math.min(C.w / w1, bottomWordH / 0.72);
    const col = ctx.rt.chance(0.6) && wcag(pal.accent, on) > 1.8 ? pal.accent : ctx.textColor(on, 100);
    ctx.add({ kind: 'text', id: ctx.id('bw'), layer: 'text', role: 'big.main', lang: 'en', lines: [{ text: word, x: W / 2, y: C.y + C.h }], size, family: rf.family, weight: rf.weight, tracking: 0.35, fill: col, anchor: 'middle', box: { x: C.x, y: C.y + C.h - size * 0.72, w: C.w, h: size * 0.72 }, raw: word });
    metaRow(ctx, C, C.y + C.h - size * 0.72 - ctx.u * 3, on, 'bottom', 3, 2);
  }
  gridDecor(ctx, C, ctx.textColor(on, 10), { cols: ctx.rng.chance(0.3), nodes: ctx.rng.chance(0.4), numbers: false });
}

/**
 * 10b. centred layout on very wide canvases (16:9, 21:9). A centred column floating in a wide field reads as empty,
 * so the field is anchored: a full-height image panel bleeds off one side, the column is centred in what remains,
 * the label groups sit in one row on a shared baseline and a tracked display word spans the column's full width.
 */
function centeredWide(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const on = pal.bg;
  const asset = img(ctx);
  const left = ctx.rng.chance(0.5);
  const panelW = asset && ctx.on('images') ? W * ctx.rng.range(0.3, 0.38) : 0;
  if (panelW) {
    const fr = left ? { x: 0, y: 0, w: panelW, h: H } : { x: W - panelW, y: 0, w: panelW, h: H };
    ctx.image(asset!, fr, { filter: imgFilter(ctx) });
    ctx.occupied.push(fr);
  }
  const A = panelW ? (left ? { x: panelW + u * 6, y: C.y, w: W - panelW - u * 6 - (W - C.x - C.w), h: C.h } : { x: C.x, y: C.y, w: W - panelW - u * 6 - C.x, h: C.h }) : C;
  const cx = A.x + A.w / 2;
  const colW = Math.min(A.w * 0.8, u * 120);
  ornaments(ctx, { x: A.x, y: A.y, w: A.w, h: u * 8 }, on, 1);
  let y = A.y + A.h * 0.1;
  if (ctx.on('text')) {
    const lab = ctx.texts.meta[0];
    y += ctx.text({ t: lab.t, lang: lab.lang }, 'small.note', { x: cx - colW / 2, y, w: colW, h: 20 }, { size: ctx.size('meta') * 1.15, align: 'middle', on, mode: 'single', weight: 700, tracking: 0.12 }).h + u * 2.5;
    y += ctx.group({ main: ctx.texts.headline }, 'big', { x: cx - colW / 2, y, w: colW, h: A.h * 0.34 }, { mainSize: Math.min(headlineSize(ctx, colW) * 0.8, u * 13), align: 'middle', on, mode: 'balance', maxLines: 2 }) + u * 2;
    y += ctx.text(ctx.texts.note, 'big.note', { x: cx - colW * 0.35, y, w: colW * 0.7, h: 100 }, { size: ctx.size('note') * 1.05, align: 'middle', on, mode: 'greedy', fit: false }).h + u * 5;
    // label groups: one row, shared top line, centred under the column
    const n = Math.min(3, Math.max(2, ctx.num('smallGroups')));
    const gw = Math.min(colW / n, u * 30);
    const x0 = cx - (gw * n) / 2;
    for (let i = 0; i < n; i++) {
      const grp = ctx.texts.groups[i % ctx.texts.groups.length];
      ctx.group({ main: grp.main, note: grp.note }, 'small', { x: x0 + i * gw + u, y, w: gw - u * 2, h: A.h * 0.2 }, { mainSize: ctx.size('smallMain') * 0.7, align: 'middle', on, mode: 'balance' });
    }
    // tracked display word across the column foot (occasionally)
    if (ctx.rtd.chance(0.3)) {
    const cands = [...ctx.texts.headline.t.split(/\s+/), ...ctx.texts.words.flatMap((w) => w.t.split(/\s+/))].filter((w) => /^[A-Za-z]{3,8}$/.test(w));
    const word = (cands.sort((a, b) => Math.abs(a.length - 5) - Math.abs(b.length - 5))[0] ?? 'FORM').toUpperCase();
    const rf = ctx.role('big.main', 'en');
    const sp = { family: rf.family, weight: rf.weight, size: 100, tracking: 0.3 };
    const w1 = ctx.measure.width(word, sp) / 100;
    const size = Math.min(A.w / w1, (A.h * 0.2) / 0.72);
    const ww = w1 * size;
    const col = ctx.rt.chance(0.6) && wcag(pal.accent, on) > 1.8 ? pal.accent : ctx.textColor(on, 100);
    ctx.add({ kind: 'text', id: ctx.id('bw'), layer: 'text', role: 'big.main', lang: 'en', lines: [{ text: word, x: cx, y: A.y + A.h }], size, family: rf.family, weight: rf.weight, tracking: 0.3, fill: col, anchor: 'middle', box: { x: cx - ww / 2, y: A.y + A.h - size * 0.72, w: ww, h: size * 0.72 }, raw: word });
    }
  }
  metaRow(ctx, { x: A.x, y: C.y, w: A.w, h: C.h }, C.y, on, 'top', 3, 2);
}

/** 11. subject cut-out layered in front of a giant headline */
function layered(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = ctx.images.find((a) => a.cutout) ?? null;
  if (!asset || !ctx.on('images')) return fullbleed(ctx);
  ctx.images = [asset, ...ctx.images.filter((a) => a !== asset)];
  const frame = { x: 0, y: 0, w: W, h: H };
  ctx.image(asset, frame, { filter: imgFilter(ctx) });
  const hl = ctx.texts.headline;
  const word = hl.lang === 'en' ? hl.t.split(' ').sort((a, b) => b.length - a.length)[0].toUpperCase() : Array.from(hl.t.replace(/\s/g, '')).slice(0, 3).join('');
  const rf = ctx.role('big.main', hl.lang);
  const sp = { family: rf.family, weight: rf.weight, size: 100, tracking: -0.01 };
  const w1 = ctx.measure.width(word, sp) / 100;
  const cap0 = hl.lang === 'zh' ? 0.86 : ctx.measure.metrics(sp).cap;
  const size = Math.min(C.w / w1, (H * 0.42) / cap0);
  const cap = cap0 * size;
  let gy = C.y + H * ctx.rng.range(0.06, 0.2);
  // depth only works when the subject overlaps *part* of the word: pick the band where the cut-out covers ~25 %
  const sj = asset.subject;
  let inFront = false;
  if (sj) {
    const dr = imageDrawRect({ ...frame, iw: asset.w, ih: asset.h, ...ctx.align(asset, frame, ctx.num('imageZoom') / 100), zoom: ctx.num('imageZoom') / 100 });
    const sb = { x: dr.x + sj.x * dr.w, y: dr.y + sj.y * dr.h, w: sj.w * dr.w, h: sj.h * dr.h };
    const wb = (y: number) => ({ x: W / 2 - (w1 * size) / 2, y, w: w1 * size, h: cap });
    const cover = (y: number) => { const b = wb(y); const ix = Math.max(0, Math.min(b.x + b.w, sb.x + sb.w) - Math.max(b.x, sb.x)), iy = Math.max(0, Math.min(b.y + b.h, sb.y + sb.h) - Math.max(b.y, sb.y)); return (ix * iy) / (b.w * b.h); };
    let best = gy, bv = Infinity;
    for (let k = 0; k <= 12; k++) {
      const y = C.y + ((C.h - cap) * k) / 12;
      const v = Math.abs(cover(y) - 0.25) + Math.abs(y - gy) / H * 0.3;
      if (v < bv) { bv = v; best = y; }
    }
    gy = best;
    inFront = cover(gy) > 0.55; // the subject would swallow the word: set it in front instead
  }
  const region = { x: C.x, y: gy, w: C.w, h: cap };
  const lg = ctx.legible(asset, frame, region, 200, true);
  const col = ctx.rt.chance(0.5) ? pal.accent : lg.lum > 0.5 ? pal.dark : pal.light;
  ctx.add({ kind: 'text', id: ctx.id('giant'), layer: 'text', role: 'big.main', lang: hl.lang, lines: [{ text: word, x: W / 2, y: gy + cap }], size, family: rf.family, weight: rf.weight, tracking: -0.01, fill: col, anchor: 'middle', box: { x: W / 2 - (w1 * size) / 2, y: gy, w: w1 * size, h: cap }, raw: word, opacity: 0.95 });
  if (!inFront) ctx.image(asset, frame, { cutout: true, filter: imgFilter(ctx) });
  // small text bottom-left with scrim
  const gb = { x: C.x, y: C.y + C.h * 0.68, w: C.w * 0.45, h: C.h * 0.32 };
  const lg2 = ctx.legible(asset, frame, gb, 30);
  if (lg2.opacity > 0.1) ctx.add({ kind: 'rect', id: ctx.id('scrim'), layer: 'images', x: 0, y: H * 0.55, w: W, h: H * 0.45, fill: `lg(90,${lg2.color},0,${lg2.color},${Math.min(0.75, lg2.opacity * 1.3).toFixed(2)})` });
  const saved = ctx.nodes.length;
  const grp = ctx.texts.groups[0];
  ctx.group({ main: grp.main, sub: ctx.texts.sub, note: grp.note }, 'small', gb, { mainSize: ctx.size('smallMain') * 1.1, align: 'start', valign: 'bottom', on: lg2.color, mode: 'words', lines: 2 });
  header(ctx, C, lg2.color, 'top');
  for (let i = saved; i < ctx.nodes.length; i++) { const nd = ctx.nodes[i]; if (nd.kind === 'text') nd.fill = nd.box.y < H * 0.3 ? ctx.legible(asset, frame, nd.box, 10).fill : lg2.fill; }
}

/** 12. horizontal bands */
function bands(ctx: Ctx) {
  const { W, H, grid: g, pal } = ctx;
  const C = g.content;
  const asset = img(ctx);
  const land = W > H * 1.15;
  const bandMask = ctx.mode('bandMask');
  const pos = ctx.str('bandPos');
  const bh = H * ctx.num('bandHeight') / 100;
  // layout: [title band][image band][info band]
  const order = pos === 'top' ? ['title', 'image', 'info'] : pos === 'bottom' ? ['info', 'image', 'title'] : ctx.rng.chance(0.6) ? ['title', 'image', 'info'] : ['image', 'title', 'info'];
  const imgH = land ? H * 0.5 : H * clamp(ctx.num('imageShare') / 100, 0.3, 0.6);
  const titleH = Math.max(bh, H * (W / H > 2 ? 0.3 : 0.22));
  const infoH = H - imgH - titleH;
  const hs: Record<string, number> = { title: titleH, image: imgH, info: infoH };
  let y = 0;
  const rects: Record<string, Rect> = {};
  for (const k of order) { rects[k] = { x: 0, y, w: W, h: hs[k] }; y += hs[k]; }
  const titleFill = ctx.rng.chance(0.5) ? pal.accent : pal.bg;
  const infoFill = ctx.rng.chance(0.5) ? pal.bg : pal.alt;
  if (asset && ctx.on('images')) {
    if (bandMask || ctx.rng.chance(0.3)) {
      ctx.image(asset, { x: 0, y: 0, w: W, h: H }, { clip: { type: 'rect', ...rects.image }, filter: imgFilter(ctx) });
    } else ctx.image(asset, rects.image, { filter: imgFilter(ctx) });
  }
  const translucent = ctx.rng.chance(0.3) && asset;
  ctx.add({ kind: 'rect', id: ctx.id('band'), layer: 'band', ...rects.title, fill: titleFill, opacity: translucent ? 0.88 : 1 });
  ctx.add({ kind: 'rect', id: ctx.id('band'), layer: 'zones', ...rects.info, fill: infoFill });
  const tb = { x: C.x, y: rects.title.y + Math.max(g.m.t * (rects.title.y === 0 ? 1 : 0.6), ctx.u * 3), w: C.w, h: rects.title.h - ctx.u * 6 };
  const mh = metaRow(ctx, tb, tb.y, titleFill, 'top', 1);
  bigTitle(ctx, { ...tb, y: tb.y + mh + ctx.u * 1.5, h: tb.h - mh }, titleFill, { align: 'start', withSub: false, size: headlineSize(ctx, C.w) * 0.8, mode: 'words', lines: 2 });
  const ib = { x: C.x, y: rects.info.y + ctx.u * 3, w: C.w, h: rects.info.h - ctx.u * 3 - (rects.info.y + rects.info.h >= H - 1 ? g.m.b : ctx.u * 3) };
  if (ib.h > ctx.u * 8) {
    const sub = ctx.text(ctx.texts.sub, 'big.sub', { x: ib.x, y: ib.y, w: ib.w * 0.6, h: ib.h }, { size: ctx.size('bigSub'), on: infoFill, mode: 'balance', maxLines: 2 });
    groupArray(ctx, { x: ib.x, y: ib.y + sub.h + ctx.u * 2, w: ib.w, h: ib.h - sub.h - ctx.u * 2 }, infoFill, ctx.num('smallGroups'), { valign: 'bottom' });
    gridDecor(ctx, rects.info, ctx.textColor(infoFill, 10), { numbers: false, nodes: true });
  }
  if (ctx.on('ornament') && asset) signature(ctx, W - g.m.r - ctx.u * 18, rects.image.y + rects.image.h - ctx.u * 6, ctx.u * 18, ctx.legible(asset, rects.image, { x: W - ctx.u * 20, y: rects.image.y + rects.image.h - ctx.u * 6, w: ctx.u * 18, h: ctx.u * 4 }, 20).fill, 'end');
}

export const COMPOSERS: Record<LegacyComp, (ctx: Ctx) => void> = { split, checker, fullbleed, giant, partition, cards, fan, typefill, swiss, centered, layered, bands };
export { adjust };
export type { PT };

/** Post-pass: mode-driven image treatments that apply across compositions (only to images with no text on top). */
export function applyModes(ctx: Ctx, comp: string) {
  const { W, H, pal } = ctx;
  const imgs = ctx.nodes.filter((n) => n.kind === 'image' && !n.cutout && n.layer === 'images') as ImageNode[];
  if (!imgs.length) return;
  const free = (n: ImageNode) => n.w * n.h < W * H * 0.85 && !ctx.occupied.some((r) => overlap(r, { x: n.x + 2, y: n.y + 2, w: n.w - 4, h: n.h - 4 }));
  const biggest = [...imgs].filter(free).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (ctx.mode('brushImage')) {
    for (const n of imgs) if (free(n) && (!n.clip || n.clip.type === 'rect')) n.clip = { type: 'path', d: ctx.plan.v2 ? tornPath(ctx.rd, n, { t: true, r: true, b: true, l: true }, 0.35) : brushPath(ctx.rd, n, ctx.rd.int(2, 4)) };
  }
  if (ctx.mode('bandMask') && biggest && comp !== 'bands') {
    const k = ctx.rd.int(3, 6);
    const shapes: Shape[] = [];
    const horiz = biggest.w >= biggest.h * 0.6;
    let t = 0;
    const span = horiz ? biggest.h : biggest.w;
    const unit = span / (k * 1.6);
    for (let i = 0; i < k && t < span; i++) {
      const s = unit * ctx.rd.range(0.6, 1.6);
      if (horiz) shapes.push({ type: 'rect', x: biggest.x, y: biggest.y + t, w: biggest.w, h: Math.min(s, span - t) });
      else shapes.push({ type: 'rect', x: biggest.x + t, y: biggest.y, w: Math.min(s, span - t), h: biggest.h });
      t += s + unit * ctx.rd.range(0.25, 0.7);
    }
    const idx = ctx.nodes.indexOf(biggest);
    ctx.nodes[idx] = { kind: 'group', id: biggest.id + '-bands', layer: 'images', clip: { type: 'union', shapes }, children: [biggest] };
  }
  if (ctx.mode('brushMask') && biggest && comp !== 'fullbleed') {
    const idx = ctx.nodes.indexOf(biggest);
    if (idx >= 0) {
      const win = { x: biggest.x + biggest.w * 0.06, y: biggest.y + biggest.h * 0.12, w: biggest.w * 0.88, h: biggest.h * 0.76 };
      const brush = ctx.plan.v2 ? tornPath(ctx.rd, win, { t: true, r: true, b: true, l: true }, 0.4) : brushPath(ctx.rd, win, ctx.rd.int(2, 3));
      ctx.nodes.splice(idx + 1, 0, { kind: 'path', id: ctx.id('bm'), layer: 'images', d: `${rectPath({ x: biggest.x - 1, y: biggest.y - 1, w: biggest.w + 2, h: biggest.h + 2 })}${brush}`, fill: pal.bg, rule: 'evenodd', clip: biggest.clip });
    }
  }
}
