import type { Ctx } from './ctx';
import type { Rect } from './grid';
import { wcag } from '../color/contrast';
import { mix } from '../color/convert';

const f = (v: number) => (Math.round(v * 10) / 10).toString();
export const ICONS = ['asterisk', 'globe', 'gridCircle', 'crossCircle', 'diamond', 'sunburst', 'target', 'squareGrid', 'registration', 'barcode', 'star4', 'arrows', 'halfDisc', 'waves'] as const;
export type IconKind = (typeof ICONS)[number];

export function iconPath(kind: IconKind, cx: number, cy: number, s: number): { d: string; fill?: boolean } {
  const r = s / 2;
  const circ = (rr: number) => `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  switch (kind) {
    case 'asterisk': {
      let d = '';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 8; d += `M${f(cx - Math.cos(a) * r)} ${f(cy - Math.sin(a) * r)}L${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; }
      return { d };
    }
    case 'globe': return { d: circ(r) + `M${f(cx)} ${f(cy - r)}a${f(r * 0.45)} ${f(r)} 0 1 0 0 ${f(2 * r)}a${f(r * 0.45)} ${f(r)} 0 1 0 0 ${f(-2 * r)}M${f(cx - r)} ${f(cy)}H${f(cx + r)}M${f(cx - r * 0.87)} ${f(cy - r / 2)}H${f(cx + r * 0.87)}M${f(cx - r * 0.87)} ${f(cy + r / 2)}H${f(cx + r * 0.87)}` };
    case 'gridCircle': { const q = r * 0.62; return { d: circ(r) + `M${f(cx - q)} ${f(cy - q)}h${f(2 * q)}v${f(2 * q)}h${f(-2 * q)}zM${f(cx)} ${f(cy - q)}v${f(2 * q)}M${f(cx - q)} ${f(cy)}h${f(2 * q)}` }; }
    case 'crossCircle': { const q = r * 0.707; return { d: circ(r * 0.6) + `M${f(cx - r)} ${f(cy - q * 0.5)}L${f(cx + r)} ${f(cy + q * 0.5)}M${f(cx - r)} ${f(cy + q * 0.5)}L${f(cx + r)} ${f(cy - q * 0.5)}M${f(cx + r - 6)} ${f(cy + q * 0.5 - 6)}L${f(cx + r)} ${f(cy + q * 0.5)}L${f(cx + r - 8)} ${f(cy + q * 0.5 + 1)}` }; }
    case 'diamond': return { d: `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy)}L${f(cx)} ${f(cy + r)}L${f(cx - r)} ${f(cy)}ZM${f(cx)} ${f(cy - r * 0.55)}L${f(cx + r * 0.55)} ${f(cy)}L${f(cx)} ${f(cy + r * 0.55)}L${f(cx - r * 0.55)} ${f(cy)}Z` };
    case 'sunburst': {
      let d = circ(r * 0.32);
      for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; d += `M${f(cx + Math.cos(a) * r * 0.45)} ${f(cy + Math.sin(a) * r * 0.45)}L${f(cx + Math.cos(a) * r * (i % 2 ? 0.8 : 1))} ${f(cy + Math.sin(a) * r * (i % 2 ? 0.8 : 1))}`; }
      return { d };
    }
    case 'target': return { d: circ(r) + circ(r * 0.62) + circ(r * 0.25) + `M${f(cx - r * 1.2)} ${f(cy)}H${f(cx + r * 1.2)}M${f(cx)} ${f(cy - r * 1.2)}V${f(cy + r * 1.2)}` };
    case 'squareGrid': { let d = `M${f(cx - r)} ${f(cy - r)}h${f(2 * r)}v${f(2 * r)}h${f(-2 * r)}z`; for (const t of [-1 / 3, 1 / 3]) d += `M${f(cx + t * 2 * r)} ${f(cy - r)}v${f(2 * r)}M${f(cx - r)} ${f(cy + t * 2 * r)}h${f(2 * r)}`; d += `M${f(cx - r / 3)} ${f(cy - r / 3)}h${f(2 * r / 3)}v${f(2 * r / 3)}h${f(-2 * r / 3)}z`; return { d }; }
    case 'registration': return { d: circ(r * 0.55) + `M${f(cx - r)} ${f(cy)}H${f(cx + r)}M${f(cx)} ${f(cy - r)}V${f(cy + r)}` };
    case 'barcode': { let d = ''; let x = cx - r; const ws = [1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2]; for (let i = 0; i < ws.length && x < cx + r; i++) { const w = ws[i] * s / 40; if (i % 2 === 0) d += `M${f(x)} ${f(cy - r * 0.45)}h${f(w)}v${f(r * 0.9)}h${f(-w)}z`; x += w + s / 40; } return { d, fill: true }; }
    case 'star4': return { d: `M${f(cx)} ${f(cy - r)}Q${f(cx)} ${f(cy)} ${f(cx + r)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy + r)}Q${f(cx)} ${f(cy)} ${f(cx - r)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy - r)}Z`, fill: true };
    case 'arrows': return { d: `M${f(cx - r)} ${f(cy + r)}L${f(cx + r)} ${f(cy - r)}M${f(cx + r * 0.3)} ${f(cy - r)}H${f(cx + r)}V${f(cy - r * 0.3)}M${f(cx - r)} ${f(cy - r)}L${f(cx + r)} ${f(cy + r)}M${f(cx + r)} ${f(cy + r * 0.3)}V${f(cy + r)}H${f(cx + r * 0.3)}` };
    case 'halfDisc': return { d: `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}Z`, fill: true };
    case 'waves': { let d = ''; for (let k = 0; k < 3; k++) { const y = cy - r * 0.5 + k * r * 0.5; d += `M${f(cx - r)} ${f(y)}q${f(r / 4)} ${f(-r / 4)} ${f(r / 2)} 0t${f(r / 2)} 0t${f(r / 2)} 0t${f(r / 2)} 0`; } return { d }; }
  }
}

export function ornament(ctx: Ctx, kind: IconKind, cx: number, cy: number, s: number, color: string, sw = 1.4) {
  const ic = iconPath(kind, cx, cy, s);
  ctx.add({ kind: 'path', id: ctx.id('o'), layer: 'ornament', d: ic.d, fill: ic.fill ? color : 'none', stroke: ic.fill ? undefined : color, sw: ic.fill ? undefined : sw * (s / 40), cap: 'round' });
}

/** script signature as ornament */
export function signature(ctx: Ctx, x: number, y: number, w: number, color: string, anchor: 'start' | 'end' = 'start') {
  const words = ['Studio Notes', 'Field Edition', 'Paper Hours', 'with love', 'First Proof', 'Night Draft', 'Atelier'];
  const t0 = ctx.rd.pick(words);
  const fam = ctx.rd.pick(['Sacramento', 'Great Vibes', 'Dancing Script']);
  const t = ctx.texts.facts?.signature ?? t0;
  if (!t) return;
  const size = Math.min(w / (t.length * 0.32), ctx.u * 3.2);
  ctx.add({ kind: 'text', id: ctx.id('sig'), layer: 'ornament', role: 'signature', lang: 'en', lines: [{ text: t, x: anchor === 'start' ? x : x + w, y: y + size * 0.7 }], size, family: fam, weight: 400, tracking: 0, fill: color, anchor, box: { x, y, w, h: size }, raw: t });
}

/** Grid lines, nodes, zone numbers, tick labels */
export function gridDecor(ctx: Ctx, area: Rect, color: string, o: { cols?: boolean; rows?: boolean; nodes?: boolean; numbers?: boolean; ticks?: boolean; avoid?: Rect[] } = {}) {
  const g = ctx.grid;
  const op = ctx.num('gridOpacity') / 100;
  if (op <= 0) return;
  const lw = ctx.num('lineWeight') * 0.8;
  const dash = ctx.bool('dashed') ? `${f(lw * 4)} ${f(lw * 4)}` : undefined;
  const inside = (x: number, y: number) => x >= area.x - 0.5 && x <= area.x + area.w + 0.5 && y >= area.y - 0.5 && y <= area.y + area.h + 0.5;
  if (ctx.on('lines') && o.cols !== false) {
    for (const x of g.x) if (x >= area.x - 0.5 && x <= area.x + area.w + 0.5)
      ctx.add({ kind: 'line', id: ctx.id('gl'), layer: 'lines', x1: x, y1: area.y, x2: x, y2: area.y + area.h, stroke: color, sw: lw, opacity: 0.22 * op, dash });
  }
  if (ctx.on('lines') && o.rows) {
    for (const y of g.y) if (y >= area.y - 0.5 && y <= area.y + area.h + 0.5)
      ctx.add({ kind: 'line', id: ctx.id('gl'), layer: 'lines', x1: area.x, y1: y, x2: area.x + area.w, y2: y, stroke: color, sw: lw, opacity: 0.16 * op, dash });
  }
  const ns = ctx.num('nodeSize');
  if (ctx.on('noise') && o.nodes !== false && ns > 0) {
    for (const x of g.x) for (const y of g.y) if (inside(x, y) && ctx.rd.chance(0.75))
      ctx.add({ kind: 'circle', id: ctx.id('nd'), layer: 'noise', cx: x, cy: y, r: ns * 0.5 * (ctx.S / 1200) * 1.2, fill: color, opacity: 0.55 * op });
  }
  if (ctx.bool('zoneNumbers') && o.numbers !== false && ctx.on('zones')) {
    const labels = ['ZN', 'UNIT', 'FLD', 'No.', 'PT.', 'SEC', 'MOD', 'R'];
    const lab = ctx.rd.pick(labels);
    let k = 0;
    for (let j = 0; j < g.nr; j++) for (let i = 0; i < g.nc; i++) {
      const x = g.x[i] + 4, y = g.y[j] + 4;
      if (!inside(x, y) || !ctx.rd.chance(0.28)) continue;
      const box = { x, y, w: 40, h: 12 };
      if ((o.avoid || []).concat(ctx.occupied).some((r) => overlap(r, box))) continue;
      k++;
      const t = `${lab}${String(j * g.nc + i + 1).padStart(2, '0')}`;
      const sz = Math.max(7.5, ctx.u * 0.62);
      ctx.add({ kind: 'text', id: ctx.id('zn'), layer: 'zones', role: 'zone', lang: 'en', lines: [{ text: t, x, y: y + sz }], size: sz, family: ctx.fonts.en['small.note'].family, weight: 400, tracking: 0.08, fill: color, anchor: 'start', box: { x, y, w: 30, h: sz }, raw: t, opacity: 0.55 * op });
      if (k > 9) break;
    }
  }
  if (ctx.bool('tickText') && o.ticks) {
    // ruler tick labels along the left margin
    const sz = Math.max(7, ctx.u * 0.58);
    const x = Math.max(4, g.m.l * 0.35);
    for (let j = 0; j <= g.nr; j++) {
      const y = g.y[j];
      if (y < area.y || y > area.y + area.h) continue;
      const t = String(Math.round(((y - g.y[0]) / (g.y[g.nr] - g.y[0])) * 100)).padStart(3, '0');
      ctx.add({ kind: 'line', id: ctx.id('tk'), layer: 'lines', x1: x - 2, y1: y, x2: x + 4, y2: y, stroke: color, sw: 0.8, opacity: 0.6 * op });
      ctx.add({ kind: 'text', id: ctx.id('tt'), layer: 'lines', role: 'tick', lang: 'en', lines: [{ text: t, x: x + 7, y: y + sz * 0.35 }], size: sz, family: ctx.fonts.en['small.note'].family, weight: 400, tracking: 0.05, fill: color, anchor: 'start', box: { x, y, w: 20, h: sz }, raw: t, opacity: 0.55 * op });
    }
  }
}

export const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Header / footer row of tiny meta labels (left / center / right) */
export function metaRow(ctx: Ctx, area: Rect, y: number, on: string, where: 'top' | 'bottom', count = 3, startIdx = 0) {
  if (!ctx.on('text') || count <= 0) return 0;
  const sz = ctx.size('meta');
  const n = Math.min(count, 3);
  const positions: ('start' | 'middle' | 'end')[] = n === 1 ? ['start'] : n === 2 ? ['start', 'end'] : ['start', 'middle', 'end'];
  let hmax = 0;
  positions.forEach((al, i) => {
    const a = ctx.texts.meta[(startIdx + i) % ctx.texts.meta.length];
    const b = ctx.texts.groups[(startIdx + i + 3) % ctx.texts.groups.length].main;
    const two = ctx.rd.chance(0.55);
    const t = two ? { t: `${a.t}\n${b.t}`, lang: a.lang === 'zh' || b.lang === 'zh' ? ('zh' as const) : ('en' as const) } : a;
    const w = area.w / 3;
    const bx = al === 'start' ? area.x : al === 'middle' ? area.x + area.w / 2 - w / 2 : area.x + area.w - w;
    const r = ctx.text(t, 'small.note', { x: bx, y, w, h: 40 }, { size: sz, align: al, on, mode: 'single', fit: true, valign: where === 'top' ? 'top' : 'bottom', id: ctx.id('meta'), weight: i === 1 ? Math.max(500, ctx.role('small.note', t.lang).weight) : undefined });
    if (where === 'bottom') {
      const dy = y - (r.node.box.y + r.h);
      r.node.lines.forEach((l) => (l.y += dy)); r.node.box.y += dy;
    }
    hmax = Math.max(hmax, r.h);
  });
  return hmax;
}

/** oversized decorative glyph */
export function bigGlyph(ctx: Ctx, area: Rect, on: string, o: { color?: string; align?: 'start' | 'end' | 'middle'; anchorY?: 'top' | 'bottom'; text?: string; maxH?: number; opacity?: number } = {}) {
  if (!ctx.bool('bigGlyph') || !ctx.on('ornament')) return null;
  const kind = ctx.str('glyphKind');
  let t = o.text ?? ctx.texts.glyph;
  if (!o.text) {
    if (kind === 'letter') t = ctx.rd.pick(['A', 'R', 'M', 'G', 'K', 'B', 'S', 'Q']);
    else if (kind === 'number') t = String(ctx.rd.int(1, 99)).padStart(2, '0');
    else if (kind === 'cjk') t = ctx.rd.pick(['格', '栏', '序', '风', '白', '象', '形', '间']);
    else if (kind === 'word') t = ctx.texts.words[0].t.split(' ')[0].toUpperCase();
  }
  const zh = /[\u4e00-\u9fff]/.test(t);
  const fam = zh ? ctx.fonts.glyphZh : ctx.fonts.glyph;
  const sp = { family: fam.family, weight: fam.weight, size: 100, tracking: -0.02 };
  const w1 = ctx.measure.width(t, sp) / 100;
  const hmax = o.maxH ?? area.h;
  const scale = ctx.num('glyphSize') / 100;
  let size = Math.min(area.w * 0.95 / Math.max(0.3, w1), hmax / 0.8) * scale;
  size = Math.max(ctx.u * 8, size);
  const cap = (zh ? 0.86 : ctx.measure.metrics(sp).cap) * size;
  const al = o.align ?? 'start';
  const x = al === 'start' ? area.x - size * 0.04 : al === 'end' ? area.x + area.w + size * 0.02 : area.x + area.w / 2;
  const y = o.anchorY === 'bottom' ? area.y + area.h : area.y + cap;
  const col = o.color ?? mix(on, wcag(ctx.pal.ink, on) > 3 ? ctx.pal.ink : ctx.pal.light, 0.12);
  return ctx.add({ kind: 'text', id: ctx.id('glyph'), layer: 'ornament', role: 'glyph', lang: zh ? 'zh' : 'en', lines: [{ text: t, x, y }], size, family: fam.family, weight: fam.weight, tracking: -0.02, fill: col, anchor: al, box: { x: al === 'start' ? x : al === 'end' ? x - w1 * size : x - (w1 * size) / 2, y: y - cap, w: w1 * size, h: cap }, raw: t, opacity: (o.opacity ?? 1) * ctx.num('glyphOpacity') / 100 });
}

/** decorative curves / arcs / circles */
export function curves(ctx: Ctx, area: Rect, color: string) {
  const n = ctx.num('curveCount');
  if (!ctx.on('curves') || n <= 0) return;
  for (let i = 0; i < n; i++) {
    const kind = ctx.rd.weighted({ circle: 3, arc: 3, sine: 2, spiral: 1 });
    const sw = ctx.num('lineWeight') * 1.1;
    if (kind === 'circle') {
      const r = ctx.rd.range(0.18, 0.42) * Math.min(area.w, area.h);
      const cx = ctx.rd.pick(ctx.grid.x.filter((x) => x > area.x && x < area.x + area.w).concat([area.x + area.w / 2]));
      const cy = ctx.rd.pick(ctx.grid.y.filter((y) => y > area.y && y < area.y + area.h).concat([area.y + area.h / 2]));
      ctx.add({ kind: 'circle', id: ctx.id('cv'), layer: 'curves', cx, cy, r, stroke: color, sw, opacity: 0.7, dash: ctx.rd.chance(0.3) ? '2 6' : undefined });
    } else if (kind === 'arc') {
      const R = ctx.rd.range(0.4, 0.9) * Math.max(area.w, area.h);
      const cx = ctx.rd.chance(0.5) ? area.x : area.x + area.w, cy = ctx.rd.chance(0.5) ? area.y : area.y + area.h;
      ctx.add({ kind: 'circle', id: ctx.id('cv'), layer: 'curves', cx, cy, r: R, stroke: color, sw, opacity: 0.55, clip: { type: 'rect', ...area } });
    } else if (kind === 'sine') {
      const y0 = ctx.rd.range(area.y + area.h * 0.2, area.y + area.h * 0.8);
      const amp = ctx.rd.range(10, 50) * ctx.u / 12, waves = ctx.rd.range(1, 3.5);
      let d = '';
      for (let k = 0; k <= 80; k++) { const t = k / 80; d += `${k ? 'L' : 'M'}${f(area.x + area.w * t)} ${f(y0 + Math.sin(t * Math.PI * 2 * waves) * amp)}`; }
      ctx.add({ kind: 'path', id: ctx.id('cv'), layer: 'curves', d, stroke: color, sw, opacity: 0.6 });
    } else {
      const cx = area.x + area.w * ctx.rd.range(0.3, 0.7), cy = area.y + area.h * ctx.rd.range(0.3, 0.7);
      let d = '';
      const turns = 3.2, a0 = ctx.rd.range(0, 6.28), R = Math.min(area.w, area.h) * 0.35;
      for (let k = 0; k <= 200; k++) { const t = k / 200; const a = a0 + t * turns * Math.PI * 2; const r = R * Math.exp((t - 1) * 2.6); d += `${k ? 'L' : 'M'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; }
      ctx.add({ kind: 'path', id: ctx.id('cv'), layer: 'curves', d, stroke: color, sw, opacity: 0.6 });
    }
  }
}

/** geometric shapes (circles / half discs / bars) in free cells */
export function shapes(ctx: Ctx, area: Rect, fills: string[]) {
  const n = ctx.num('shapeCount');
  if (!ctx.on('shapes') || n <= 0) return;
  for (let i = 0; i < n; i++) {
    const s = ctx.rd.range(0.08, 0.22) * Math.min(area.w, area.h);
    const cx = ctx.rd.range(area.x + s, area.x + area.w - s), cy = ctx.rd.range(area.y + s, area.y + area.h - s);
    const box = { x: cx - s, y: cy - s, w: 2 * s, h: 2 * s };
    if (ctx.occupied.some((r) => overlap(r, box))) continue;
    const col = ctx.rd.pick(fills);
    const k = ctx.rd.weighted({ disc: 3, half: 2, bar: 2, ring: 2, tri: 1 });
    if (k === 'disc') ctx.add({ kind: 'circle', id: ctx.id('sh'), layer: 'shapes', cx, cy, r: s * 0.5, fill: col });
    else if (k === 'ring') ctx.add({ kind: 'circle', id: ctx.id('sh'), layer: 'shapes', cx, cy, r: s * 0.5, stroke: col, sw: s * 0.08 });
    else if (k === 'half') ctx.add({ kind: 'path', id: ctx.id('sh'), layer: 'shapes', d: `M${f(cx - s / 2)} ${f(cy)}A${f(s / 2)} ${f(s / 2)} 0 0 1 ${f(cx + s / 2)} ${f(cy)}Z`, fill: col });
    else if (k === 'bar') ctx.add({ kind: 'rect', id: ctx.id('sh'), layer: 'shapes', x: cx - s, y: cy - s * 0.08, w: 2 * s, h: s * 0.16, fill: col });
    else ctx.add({ kind: 'path', id: ctx.id('sh'), layer: 'shapes', d: `M${f(cx)} ${f(cy - s / 2)}L${f(cx + s / 2)} ${f(cy + s / 2)}L${f(cx - s / 2)} ${f(cy + s / 2)}Z`, fill: col });
  }
}

/** scattered "noise" marks: tiny crosses, dots, dashes aligned to baseline */
export function noiseMarks(ctx: Ctx, area: Rect, color: string) {
  const amt = ctx.num('noiseAmount') / 100;
  if (!ctx.on('noise') || amt <= 0) return;
  const n = Math.round(amt * 14);
  for (let i = 0; i < n; i++) {
    const x = ctx.rd.pick(ctx.grid.x), y = ctx.rd.range(area.y, area.y + area.h);
    if (x < area.x || x > area.x + area.w) continue;
    const s = ctx.u * 0.6;
    const k = ctx.rd.weighted({ cross: 3, dots: 2, dash: 2 });
    if (k === 'cross') ctx.add({ kind: 'path', id: ctx.id('nz'), layer: 'noise', d: `M${f(x - s)} ${f(y)}H${f(x + s)}M${f(x)} ${f(y - s)}V${f(y + s)}`, stroke: color, sw: 0.9, opacity: 0.7 });
    else if (k === 'dots') for (let j = 0; j < 4; j++) ctx.add({ kind: 'circle', id: ctx.id('nz'), layer: 'noise', cx: x + j * s * 1.4, cy: y, r: s * 0.18, fill: color, opacity: 0.7 });
    else ctx.add({ kind: 'line', id: ctx.id('nz'), layer: 'noise', x1: x, y1: y, x2: x + s * 4, y2: y, stroke: color, sw: 1, opacity: 0.6 });
  }
}
