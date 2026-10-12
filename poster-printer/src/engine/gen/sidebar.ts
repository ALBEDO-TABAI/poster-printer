import type { Ctx } from './ctx';
import type { Rect } from './grid';
import { metaRow } from './decor';

/** Sidebar template library: 8 families, 18 templates. Each can keep its own saved type size. */
export const SIDEBAR_TEMPLATES: { id: string; family: string; zh: string; en: string; w: number }[] = [
  { id: 'strip.3', family: 'strip', zh: '三竖条', en: 'Triple strip', w: 5 },
  { id: 'strip.2', family: 'strip', zh: '双竖条', en: 'Double strip', w: 2 },
  { id: 'strip.4', family: 'strip', zh: '四竖条', en: 'Quad strip', w: 1 },
  { id: 'data.rows', family: 'data', zh: '多栏数据', en: 'Data rows', w: 2 },
  { id: 'data.header', family: 'data', zh: '带表头数据', en: 'Data + header', w: 1.2 },
  { id: 'data.dense', family: 'data', zh: '密集数据', en: 'Dense data', w: 0.8 },
  { id: 'paired.split', family: 'paired', zh: '成对包裹', en: 'Paired', w: 1.5 },
  { id: 'paired.top', family: 'paired', zh: '顶部成对', en: 'Paired top', w: 1 },
  { id: 'index.number', family: 'index', zh: '编号页眉', en: 'Indexed note', w: 1.5 },
  { id: 'index.letter', family: 'index', zh: '字母页眉', en: 'Lettered note', w: 0.8 },
  { id: 'center.vertical', family: 'center', zh: '居中竖排', en: 'Center vertical', w: 1 },
  { id: 'center.stack', family: 'center', zh: '居中堆叠', en: 'Center stack', w: 0.8 },
  { id: 'corners.2', family: 'corners', zh: '上下锚定', en: 'Top & bottom', w: 0.8 },
  { id: 'corners.4', family: 'corners', zh: '四角锚定', en: 'Four corners', w: 1 },
  { id: 'timeline', family: 'timeline', zh: '时间线', en: 'Timeline', w: 1.2 },
  { id: 'colophon', family: 'colophon', zh: '版权页', en: 'Colophon', w: 1 },
  { id: 'ruler', family: 'ruler', zh: '刻度尺', en: 'Ruler', w: 0.9 },
  { id: 'tags', family: 'tags', zh: '标签堆', en: 'Tag stack', w: 0.9 },
];
const LEGACY: Record<string, string> = { strip: 'strip.3', data: 'data.rows', paired: 'paired.split', index: 'index.number', center: 'center.vertical', corners: 'corners.4' };

export function sidebar(ctx: Ctx, R: Rect, on: string, tplIn: string, sizes: Record<string, number> = {}) {
  const tpl = tplIn === 'auto' || !tplIn ? ctx.rng.weighted(SIDEBAR_TEMPLATES.map((t) => [t.id, t.w] as [string, number])) : LEGACY[tplIn] ?? tplIn;
  const fs = (sizes[tpl] ?? ctx.num('sidebarFont')) / 100;
  const meta = ctx.size('meta') * fs, note = ctx.size('note') * fs;
  const ink = ctx.textColor(on, 10);
  const T = ctx.texts;
  const u = ctx.u;
  const L = (x: number, y: number, w: number, t: { t: string; lang: 'zh' | 'en' } | undefined, size = meta, weight?: number, align: 'start' | 'end' | 'middle' = 'start') =>
    t ? ctx.text(t, 'small.note', { x, y, w, h: 200 }, { size, on, mode: 'greedy', fit: false, layer: 'sidebar', weight, align }).h : 0;
  const line = (x1: number, y1: number, x2: number, y2: number, op = 0.6, sw = 0.6) => ctx.add({ kind: 'line', id: ctx.id('sbl'), layer: 'sidebar', x1, y1, x2, y2, stroke: ink, sw, opacity: op });
  if (ctx.bool('sidebarRule') && ctx.on('lines')) ctx.add({ kind: 'line', id: ctx.id('sbr'), layer: 'sidebar', x1: R.x + R.w + u, y1: R.y, x2: R.x + R.w + u, y2: R.y + R.h, stroke: ink, sw: 0.8, opacity: 0.5 });
  const fam = tpl.split('.')[0];
  switch (fam) {
    case 'strip': {
      const n = Number(tpl.split('.')[1] || 3);
      const cw = R.w / n;
      for (let c = 0; c < n; c++) {
        let y = R.y + c * u * 4;
        for (let k = 0; k < 3; k++) y += L(R.x + c * cw, y, cw - 4, T.meta[(c * 3 + k) % T.meta.length]) + u * 1.5;
      }
      L(R.x, R.y + R.h - note * 6, R.w, T.prose[1] ?? T.note, note);
      break;
    }
    case 'data': {
      let y = R.y;
      const dense = tpl === 'data.dense';
      if (tpl !== 'data.rows') { y += L(R.x, y, R.w, T.groups[0].main, note * 1.3, 700) + note; line(R.x, y, R.x + R.w, y, 1, 1.4); y += 4; }
      else { y += L(R.x, y, R.w, T.groups[0].main, note * 1.2, 700) + note * 1.2; }
      const rows = dense ? 12 : 7;
      for (let k = 0; k < rows && y < R.y + R.h - meta * 3; k++) {
        line(R.x, y, R.x + R.w, y);
        const a = T.meta[k % T.meta.length];
        ctx.text(a, 'small.note', { x: R.x, y: y + 4, w: R.w * 0.62, h: 20 }, { size: meta, on, mode: 'single', layer: 'sidebar' });
        ctx.text({ t: String(ctx.rd.int(10, 990)).padStart(3, '0'), lang: 'en' }, 'small.note', { x: R.x, y: y + 4, w: R.w, h: 20 }, { size: meta, on, mode: 'single', align: 'end', layer: 'sidebar' });
        y += meta * (dense ? 2.1 : 2.6);
      }
      break;
    }
    case 'paired': {
      const yb = tpl === 'paired.top' ? R.y + note * 9 : R.y + R.h - note * 8;
      L(R.x, R.y, R.w, T.groups[1].main, note * 1.25, 700);
      L(R.x, R.y + note * 2.2, R.w, T.groups[1].note.t ? T.groups[1].note : T.meta[2], note);
      L(R.x, yb, R.w, T.groups[2].main, note * 1.25, 700);
      L(R.x, yb + note * 2.2, R.w, T.groups[2].note.t ? T.groups[2].note : T.meta[3], note);
      break;
    }
    case 'index': {
      const num = tpl === 'index.letter' ? String.fromCharCode(65 + ctx.rd.int(0, 25)) : String(ctx.rd.int(1, 24)).padStart(2, '0');
      const rf = ctx.role('small.main', 'en');
      ctx.text({ t: num, lang: 'en' }, 'small.main', { x: R.x, y: R.y, w: R.w, h: R.w }, { size: R.w * 0.55 * Math.sqrt(fs), on, mode: 'single', layer: 'sidebar', family: rf.family });
      L(R.x, R.y + R.w * 0.6, R.w, T.groups[3].main, note * 1.2, 700);
      L(R.x, R.y + R.w * 0.6 + note * 2.4, R.w, T.groups[3].note.t ? T.groups[3].note : T.meta[4], note);
      break;
    }
    case 'center': {
      const t = T.groups[4].main;
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      if (tpl === 'center.stack') {
        const ls = Array.from(t.t.replace(/\s+/g, '').slice(0, 8));
        const size = Math.min(R.w * 0.45, u * 2.6) * fs;
        ls.forEach((ch, i) => ctx.text({ t: t.lang === 'en' ? ch.toUpperCase() : ch, lang: t.lang }, 'small.main', { x: R.x, y: cy - (ls.length * size * 1.15) / 2 + i * size * 1.15, w: R.w, h: size * 1.2 }, { size, on, mode: 'single', align: 'middle', layer: 'sidebar', fit: false }));
      } else {
        const size = Math.min(R.w * 0.5, u * 2.2) * fs;
        ctx.add({ kind: 'text', id: ctx.id('sbc'), layer: 'sidebar', role: 'small.note', lang: t.lang, lines: [{ text: t.t.toUpperCase(), x: cx, y: cy }], size, family: ctx.fonts[t.lang]['small.note'].family, weight: 600, tracking: 0.3, fill: ink, anchor: 'middle', box: { x: cx, y: cy, w: 1, h: 1 }, raw: t.t, rotate: -90 });
      }
      L(R.x, R.y, R.w, T.meta[0]);
      L(R.x, R.y + R.h - meta * 3, R.w, T.meta[1]);
      break;
    }
    case 'timeline': {
      const x = R.x + u * 0.8;
      const n = 5;
      line(x, R.y + u, x, R.y + R.h - u, 0.7, 0.8);
      for (let k = 0; k < n; k++) {
        const y = R.y + u + (k * (R.h - u * 6)) / (n - 1);
        ctx.add({ kind: 'circle', id: ctx.id('sbd'), layer: 'sidebar', cx: x, cy: y, r: u * 0.45, fill: k === 0 ? ctx.pal.accent : ink });
        ctx.text({ t: String(ctx.rd.int(1, 12)).padStart(2, '0') + '.' + String(ctx.rd.int(1, 28)).padStart(2, '0'), lang: 'en' }, 'small.note', { x: x + u * 1.6, y: y - meta * 0.7, w: R.w - u * 2, h: 20 }, { size: meta, on, mode: 'single', layer: 'sidebar', weight: 700 });
        L(x + u * 1.6, y + meta * 0.9, R.w - u * 2.4, T.meta[k % T.meta.length]);
      }
      break;
    }
    case 'colophon': {
      let y = R.y;
      y += L(R.x, y, R.w, { t: T.groups[0].main.lang === 'zh' ? '版本说明' : 'COLOPHON', lang: T.groups[0].main.lang }, note * 1.1, 700) + note;
      for (let k = 0; k < 4; k++) {
        y += L(R.x, y, R.w, T.meta[k % T.meta.length], meta, 600) + 2;
        y += L(R.x, y, R.w, T.prose[k % T.prose.length], meta * 0.92) + note * 1.2;
        if (y > R.y + R.h * 0.8) break;
      }
      { const yr = String(2020 + ctx.rd.int(0, 9)); L(R.x, R.y + R.h - meta * 2, R.w, { t: '© ' + (T.facts?.year || yr), lang: 'en' }); }
      break;
    }
    case 'ruler': {
      const x = R.x + R.w - u * 0.5;
      line(x, R.y, x, R.y + R.h, 0.8, 0.8);
      const step = u * 2;
      for (let y = R.y, k = 0; y <= R.y + R.h; y += step, k++) {
        const long = k % 5 === 0;
        line(x - (long ? u * 2 : u), y, x, y, 0.8, 0.7);
        if (long) ctx.text({ t: String(k * 2), lang: 'en' }, 'small.note', { x: x - u * 8, y: y - meta * 0.4, w: u * 5.6, h: 20 }, { size: meta * 0.9, on, mode: 'single', align: 'end', layer: 'sidebar' });
      }
      L(R.x, R.y, R.w * 0.55, T.meta[0], meta, 700);
      break;
    }
    case 'tags': {
      let y = R.y;
      const items = [...T.meta.slice(0, 5), ...T.words.slice(0, 2)];
      for (const it of items) {
        const h = meta * 2;
        const tw = Math.min(R.w, ctx.lineW(it.t, ctx.spec('small.note', it.lang, meta)) + meta * 1.6);
        ctx.add({ kind: 'rect', id: ctx.id('sbt'), layer: 'sidebar', x: R.x, y, w: tw, h, rx: h / 2, fill: 'none', stroke: ink, sw: 0.8 });
        ctx.text(it, 'small.note', { x: R.x + meta * 0.8, y: y + h * 0.28, w: tw, h }, { size: meta, on, mode: 'single', layer: 'sidebar', fit: false });
        y += h + u * 0.9;
        if (y > R.y + R.h - h) break;
      }
      break;
    }
    default: { // corners
      metaRow(ctx, R, R.y, on, 'top', 2, 6);
      if (tpl === 'corners.4') metaRow(ctx, R, R.y + R.h, on, 'bottom', 2, 8);
      else L(R.x, R.y + R.h - note * 4, R.w, T.groups[5]?.main ?? T.meta[6], note * 1.1, 700);
    }
  }
  return tpl;
}
