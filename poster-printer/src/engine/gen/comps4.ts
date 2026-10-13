// Phase 6 compositions: an object poster (a cut-out subject standing in front of a giant word on a flat field) and a
// panorama for long formats (a full-width photo with a solid title band carrying a one-line headline). Original layouts.
import type { Ctx } from './ctx';
import { wcag } from '../color/contrast';
import { tonal } from '../color/strategy';
import { img, groupArray } from './comps';
import { rawText, hair } from './comps2';
import { heroWord, width100, capOf, strong, condFam, label, issue, year, zhHeavy, roundSticker } from './comps3';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** the object poster: flat field, giant word, the cut-out subject in front of the word's lower half, quiet info */
function object(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const cut = ctx.images.find((a) => a.cutout && a.subject);
  const land = W > H * 1.15;
  const field = pal.bg;
  const T = ctx.texts;
  const hw = heroWord(ctx, land ? 10 : 8);
  const fam = hw.zh ? zhHeavy(ctx, true) : ctx.rtd.chance(0.7) ? condFam(ctx) : { family: 'Archivo Black', weight: 400 };
  const capR = capOf(ctx, fam, hw.zh);
  const tr = hw.zh ? 0.02 : -0.01;
  let size = (C.w + u * 1.5) / width100(ctx, hw.t, fam, tr);
  size = Math.min(size, (H * (land ? 0.5 : 0.36)) / capR);
  const cap = capR * size;
  const wordFill = wcag(pal.accent, field) >= 2.2 && ctx.rtd.chance(0.6) ? pal.accent : strong(ctx, field);
  // the word sits a little above the middle; the subject stands on a ground line below it
  const wy = H * (land ? 0.5 : 0.42) + cap / 2;
  rawText(ctx, { id: ctx.id('objw'), role: 'big.main', text: hw.t, lang: hw.zh ? 'zh' : 'en', x: W / 2, y: wy, size, family: fam.family, weight: fam.weight, fill: wordFill, anchor: 'middle', tracking: tr });
  if (cut && ctx.on('images')) {
    const sj = cut.subject!;
    const ground = land ? H * 0.9 : H * 0.8;
    const sh = (ground - (wy - cap * 0.55)) / 1; // subject height so its top lands in the word's upper half
    const sH = sh / (sj.h * cut.h), sW = (W * (land ? 0.28 : 0.42)) / (sj.w * cut.w);
    const scale = Math.max(sH, Math.min(sW, sH * 1.45)); // slender subjects grow until they hold the middle
    const fw = cut.w * scale, fh = cut.h * scale;
    const cx = W / 2 + (land ? (ctx.rd.chance(0.5) ? -1 : 1) * W * 0.12 : 0);
    const fr = { x: cx - (sj.x + sj.w / 2) * fw, y: ground - (sj.y + sj.h) * fh, w: fw, h: fh };
    // soft contact shadow
    const sw = sj.w * fw * 0.42;
    ctx.add({ kind: 'path', id: ctx.id('shadow'), layer: 'images', d: `M${cx - sw} ${ground}a${sw} ${u * 1.4} 0 1 0 ${sw * 2} 0a${sw} ${u * 1.4} 0 1 0 ${-sw * 2} 0z`, fill: tonal(field, -0.25), opacity: 0.35 });
    ctx.image(cut, fr, { cutout: true, fx: 0.5, fy: 0.5 });
    ctx.occupied.push({ x: cx - sj.w * fw / 2, y: ground - sj.h * fh, w: sj.w * fw, h: sj.h * fh });
  }
  // info: top label row, headline + sub bottom-left, two groups bottom-right
  const on = field;
  label(ctx, `${issue(ctx)}`, C.x, C.y + u * 1.5, on);
  label(ctx, `${T.meta[0]?.t ?? ''}  ·  ${year(ctx)}`, C.x + C.w, C.y + u * 1.5, on, { anchor: 'end' });
  hair(ctx, C.x, C.y + u * 3.2, C.x + C.w, C.y + u * 3.2, 0.8, strong(ctx, on));
  const by = land ? { x: C.x, y: H * 0.9 - u * 1, w: C.w * 0.4, h: H - H * 0.9 - u } : { x: C.x, y: H * 0.82, w: C.w * 0.5, h: C.y + C.h - H * 0.82 };
  ctx.group({ main: T.headline, sub: T.sub }, 'small', by, { mainSize: ctx.size('smallMain') * (land ? 0.95 : 1.15), align: 'start', valign: 'bottom', on, mode: 'words', lines: 2 });
  groupArray(ctx, { x: C.x + C.w * (land ? 0.6 : 0.56), y: by.y, w: C.w * (land ? 0.4 : 0.44), h: by.h }, on, 2, { valign: 'bottom', maxPerRow: 2 });
  if (ctx.on('ornament') && ctx.rd.chance(0.3)) roundSticker(ctx, C.x + C.w - u * 7, C.y + u * 12, u * 6, pal.accent, strong(ctx, pal.accent), ((a: string[]) => ctx.texts.facts?.sticker ?? a)([ctx.rd.pick(['NEW', 'NO.', 'VOL.']), String(ctx.rd.int(1, 24))]));
}

/** long formats: a full-width photo and a solid band holding a one-line (or two-line) headline across the whole width */
function panorama(ctx: Ctx) {
  const { W, H, grid: g, pal, u } = ctx;
  const C = g.content;
  const T = ctx.texts;
  const asset = img(ctx);
  const bandTop = ctx.rng.chance(0.15);
  const hl = T.headline;
  const zh = hl.lang === 'zh';
  const fam = zh ? zhHeavy(ctx, true) : condFam(ctx);
  const raw = zh ? hl.t.replace(/[\s，。、！？：；]/g, '') : hl.t.toUpperCase();
  const capR = capOf(ctx, fam, zh);
  const maxBand = H * (W > H * 2 ? 0.44 : 0.4);
  const textW = C.w * 0.74;
  let lines = [raw];
  let size = textW / width100(ctx, raw, fam, -0.005);
  if (capR * size < (maxBand - u * 6) * 0.38) {
    // too long for one line at a strong size: two balanced lines
    const ws = zh ? Array.from(raw) : raw.split(/\s+/);
    const half = Math.ceil(ws.length / 2);
    lines = [ws.slice(0, half).join(zh ? '' : ' '), ws.slice(half).join(zh ? '' : ' ')].filter(Boolean);
    size = textW / Math.max(...lines.map((l) => width100(ctx, l, fam, -0.005)));
  }
  const lead0 = zh ? 1.02 : 0.92;
  size = Math.min(size, ((maxBand - u * 6) * 0.92) / (capR + (lines.length - 1) * lead0));
  // the band hugs the headline: no dead colour above a small title
  const bandH = clamp(capR * size + (lines.length - 1) * size * lead0 + u * 9, H * 0.24, maxBand);
  const band = { x: 0, y: bandTop ? 0 : H - bandH, w: W, h: bandH };
  const photo = { x: 0, y: bandTop ? bandH : 0, w: W, h: H - bandH };
  const bandCol = ctx.rd.chance(0.5) && wcag(pal.accent, pal.bg) > 1.4 ? pal.accent : ctx.rd.chance(0.5) ? pal.bg : tonal(pal.bg, relDark(pal.bg) ? 0.08 : -0.06);
  ctx.add({ kind: 'rect', id: ctx.id('pband'), layer: 'zones', ...band, fill: bandCol });
  if (asset && ctx.on('images') && !ctx.plan.typeOnly) {
    ctx.image(asset, photo, { filter: ctx.rd.chance(0.2) ? { grayscale: true, contrast: 1.08 } : {} });
    ctx.occupied.push(photo);
  } else {
    ctx.add({ kind: 'rect', id: ctx.id('pfield'), layer: 'zones', ...photo, fill: tonal(bandCol, relDark(bandCol) ? 0.12 : -0.1) });
  }
  const inner = { x: C.x, y: band.y + u * 3, w: C.w, h: bandH - u * 6 };
  const lead = zh ? 1.02 : 0.92;
  size = Math.min(size, (inner.h * 0.92) / (capR + (lines.length - 1) * lead));
  const blockH = capR * size + (lines.length - 1) * size * lead;
  const y0 = inner.y + inner.h - blockH + capR * size;
  rawText(ctx, { id: ctx.id('pano'), role: 'big.main', text: lines.join('\n'), lang: zh ? 'zh' : 'en', x: inner.x, y: y0, size, family: fam.family, weight: fam.weight, fill: strong(ctx, bandCol), anchor: 'start', tracking: -0.005, leading: lead });
  // the right quarter of the band: sub + two info groups, top-aligned to the band
  const rx = inner.x + inner.w * 0.78;
  const rw = inner.w * 0.22;
  ctx.group({ main: T.sub, note: T.note }, 'small', { x: rx, y: inner.y, w: rw, h: inner.h * 0.45 }, { mainSize: ctx.size('smallMain') * 0.8, align: 'start', on: bandCol, mode: 'words', lines: 2 });
  groupArray(ctx, { x: rx, y: inner.y + inner.h * 0.5, w: rw, h: inner.h * 0.5 }, bandCol, 2, { valign: 'bottom', maxPerRow: 2 });
  // a label strip at the photo edge
  const ly = bandTop ? band.y + bandH - u * 1.2 : band.y + u * 1.6;
  void ly;
  label(ctx, `${issue(ctx)}  ·  ${T.meta[0]?.t ?? ''}`, rx, bandTop ? inner.y + inner.h + u * 1.8 : band.y + u * 2.2, bandCol);
  void clamp;
}
const relDark = (c: string) => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 110; };

export const COMPOSERS_V4 = { object, panorama };
