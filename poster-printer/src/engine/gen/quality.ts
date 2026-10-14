// Layout-quality pass: resolves collisions between text blocks and decorative glyphs / giant type,
// repairs low-contrast text by sampling the *effective* background under it, and scores the result so the
// generator can reject cluttered or overlapping draws and redraw within its time budget.
import { licensedPairs, type SceneSemantics } from '../p8/semantic';
import type { SceneNode, TextNode, ImageNode, RectNode, Shape } from '../types';
import type { Ctx, ImageAsset } from './ctx';
import { hexToRgb, rgbToHex, mix } from '../color/convert';
import { wcag, relLum } from '../color/contrast';
import { imageDrawRect } from '../render/svg';
import { designAudit, type Audit } from './audit';

type Box = { x: number; y: number; w: number; h: number };
export const interArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
export const union = (bs: Box[]): Box => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)); return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }; };

export interface QualityReport {
  score: number;
  overlaps: number; glyphHits: number; lowContrast: number; offCanvas: number; clutter: number; empty: number;
  moved: number; dropped: number; recolored: number; scrims: number; outlined: number;
  /** design-principle penalty (see audit.ts) and its main measurements */
  design: number; audit?: Audit;
  /** phase 19 (only on posters with user colours): text in the user's own colours that the contrast repair changed,
   *  and text left as the user chose because "keep my colours" (fitOverride) is on */
  mineFixed?: number; mineKept?: number;
}

const isText = (n: SceneNode): n is TextNode => n.kind === 'text';
const visibleText = (n: TextNode) => n.lines.length > 0 && n.fill !== 'none' && n.raw !== '' && n.box.w > 0;

/** primary = giant headline type / decorative glyphs (they keep their place); others are movable */
function isPrimary(ctx: Ctx, t: TextNode) {
  return t.role === 'glyph' || t.layer === 'ornament' || t.size >= ctx.u * 7;
}
function glyphBox(t: TextNode): Box {
  // trim side bearings / descender space a little so near-misses aren't flagged
  const b = t.box; const ix = b.w * 0.04, iy = b.h * 0.06;
  return { x: b.x + ix, y: b.y + iy, w: Math.max(0, b.w - 2 * ix), h: Math.max(0, b.h - 2 * iy) };
}
const lowPriority = (t: TextNode) => /note|meta|tick/.test(t.role) || t.layer === 'sidebar';

function shiftText(t: TextNode, dx: number, dy: number) {
  t.lines = t.lines.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }));
  t.box = { ...t.box, x: t.box.x + dx, y: t.box.y + dy };
}

// ---------------------------------------------------------------- effective background sampling
const grayOfLum = (L: number) => { const v = L <= 0.0031308 ? 12.92 * L : 1.055 * L ** (1 / 2.4) - 0.055; const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return rgbToHex([c, c, c]); };
// ---- tiny absolute-path polygoniser (M L H V A C Q Z), arcs sampled; cached per d-string
const polyCache = new Map<string, number[][]>();
function pathPolys(d: string): number[][] {
  const hit = polyCache.get(d); if (hit) return hit;
  const toks = d.match(/[MLHVACQZmlhvacqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const polys: number[][] = []; let cur: number[] = []; let x = 0, y = 0, sx = 0, sy = 0; let i = 0; let cmd = 'M';
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    switch (cmd) {
      case 'M': if (cur.length) polys.push(cur); x = num(); y = num(); sx = x; sy = y; cur = [x, y]; cmd = 'L'; break;
      case 'L': x = num(); y = num(); cur.push(x, y); break;
      case 'H': x = num(); cur.push(x, y); break;
      case 'V': y = num(); cur.push(x, y); break;
      case 'C': num(); num(); num(); num(); x = num(); y = num(); cur.push(x, y); break;
      case 'Q': num(); num(); x = num(); y = num(); cur.push(x, y); break;
      case 'A': {
        const r = num(); num(); num(); const laf = num(), sf = num(); const x1 = num(), y1 = num();
        const c = Math.hypot(x1 - x, y1 - y);
        if (r > 0 && c > 0 && c <= 2 * r + 1e-6) {
          const h = Math.sqrt(Math.max(0, r * r - (c / 2) ** 2));
          const ux = (x1 - x) / c, uy = (y1 - y) / c, nx = -uy, ny = ux, mx = (x + x1) / 2, my = (y + y1) / 2;
          const sgn = laf !== sf ? 1 : -1;
          const cx = mx + sgn * h * nx, cy = my + sgn * h * ny;
          const a0 = Math.atan2(y - cy, x - cx); let da = Math.atan2(y1 - cy, x1 - cx) - a0;
          if (sf && da < 0) da += Math.PI * 2; if (!sf && da > 0) da -= Math.PI * 2;
          for (let k = 1; k <= 8; k++) { const a = a0 + (da * k) / 8; cur.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
        } else cur.push(x1, y1);
        x = x1; y = y1; break;
      }
      case 'Z': case 'z': x = sx; y = sy; if (cur.length) polys.push(cur); cur = []; break;
      default: i++; // unsupported relative command: skip token
    }
  }
  if (cur.length) polys.push(cur);
  if (polyCache.size > 400) polyCache.clear();
  polyCache.set(d, polys);
  return polys;
}
function inPath(d: string, px: number, py: number) {
  let inside = false;
  for (const p of pathPolys(d)) for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}
function inShape(s: Shape | undefined, x: number, y: number): boolean {
  if (!s) return true;
  switch (s.type) {
    case 'rect': return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    case 'circle': return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    case 'union': return s.shapes.some((c) => inShape(c, x, y));
    case 'text': return false; // glyph clips: thin strokes, treat as not covering
    case 'path': return inPath(s.d, x, y);
    default: return true;
  }
}
function imageColorAt(n: ImageNode, a: ImageAsset | undefined, x: number, y: number): string | null {
  if (n.cutout) return null; // alpha unknown → transparent
  let L = 0.35;
  if (a?.lum && a.lumW && a.lumH) {
    const dr = imageDrawRect(n);
    const u = (x - dr.x) / dr.w, v = (y - dr.y) / dr.h;
    const gi = Math.min(a.lumW - 1, Math.max(0, Math.floor(u * a.lumW))), gj = Math.min(a.lumH - 1, Math.max(0, Math.floor(v * a.lumH)));
    L = a.lum[gj * a.lumW + gi] ?? 0.35;
  }
  const f = n.filter || {};
  if (f.bright) L = Math.min(1, L * f.bright ** 2.2);
  if (f.contrast && f.contrast !== 1) { const g = L ** (1 / 2.2); L = Math.max(0, Math.min(1, (g - 0.5) * f.contrast + 0.5)) ** 2.2; }
  let col = grayOfLum(L);
  if (f.duotone) col = mix(f.duotone[0], f.duotone[1], L ** (1 / 2.2));
  if (n.overlay) col = mix(col, n.overlay.color, n.overlay.opacity);
  return col;
}
/** colour of the scene at (x,y) using nodes[0..upto) */
export function colorAt(ctx: Ctx, nodes: SceneNode[], upto: number, x: number, y: number, bg: string, assets: Map<string, ImageAsset>, parentClip?: Shape): string {
  for (let i = upto - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!ctx.on(n.layer)) continue;
    let c: string | null = null;
    let gop = 1;
    if (n.kind === 'rect') {
      const inside = n.fill && n.fill !== 'none' && x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h && inShape(n.clip, x, y) && n.w * n.h > ctx.u * ctx.u * 4;
      if (inside && n.fill.startsWith('lg(')) { const g = gradAt(n.fill, n, x, y); if (g.a > 0.02) { c = g.c; gop = g.a; } }
      else if (inside) c = n.fill;
    } else if (n.kind === 'path') {
      if (n.fill && n.fill !== 'none' && !n.fill.startsWith('lg(') && n.layer !== 'lines' && n.layer !== 'curves' && inShape(n.clip, x, y)) {
        if (inPath(n.d, x, y)) c = n.fill;
      }
    } else if (n.kind === 'circle') {
      if (n.fill && n.fill !== 'none' && (x - n.cx) ** 2 + (y - n.cy) ** 2 <= n.r * n.r) c = n.fill;
    } else if (n.kind === 'image') {
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h && inShape(n.clip, x, y) && inShape(parentClip, x, y)) c = imageColorAt(n, assets.get(n.imageId), x, y);
    } else if (n.kind === 'group') {
      if (inShape(n.clip, x, y)) { const inner = colorAt(ctx, n.children, n.children.length, x, y, '', assets, n.clip); if (inner) c = inner; }
    }
    if (!c) continue;
    const op = (n.opacity ?? 1) * gop;
    if (op >= 0.98) return c;
    const below = colorAt(ctx, nodes, i, x, y, bg, assets, parentClip) || bg;
    return mix(below, c, op);
  }
  return bg;
}
/** colour + alpha of an `lg(angle,c1,o1,c2,o2,…)` gradient fill at a point of its rect */
export function gradAt(fill: string, r: Box, x: number, y: number): { c: string; a: number } {
  const parts = fill.slice(3, -1).split(',');
  const ang = (Number(parts[0]) * Math.PI) / 180;
  const cnt = (parts.length - 1) / 2;
  const u = (x - r.x) / Math.max(1e-6, r.w) - 0.5, v = (y - r.y) / Math.max(1e-6, r.h) - 0.5;
  const t = Math.max(0, Math.min(1, u * Math.cos(ang) + v * Math.sin(ang) + 0.5));
  const pos = t * (cnt - 1); const i = Math.min(cnt - 2, Math.floor(pos)); const f = pos - i;
  if (cnt < 2) return { c: parts[1], a: Number(parts[2]) };
  const c0 = parts[1 + i * 2], a0 = Number(parts[2 + i * 2]), c1 = parts[3 + i * 2], a1 = Number(parts[4 + i * 2]);
  return { c: mix(c0, c1, f), a: a0 + (a1 - a0) * f };
}
export function textContrast(ctx: Ctx, nodes: SceneNode[], idx: number, t: TextNode, fill: string, bg: string, assets: Map<string, ImageAsset>, q = 0.2, nx = 5) {
  const b = t.box; const vals: number[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < 3; j++) {
    const x = b.x + ((i + 0.5) / nx) * b.w, y = b.y + ((j + 0.5) / 3) * b.h;
    vals.push(wcag(fill, colorAt(ctx, nodes, idx, x, y, bg, assets)));
  }
  vals.sort((a, c) => a - c);
  return vals[Math.floor(vals.length * q)];
}

export function clipBox(c: Shape | undefined): Box | null {
  if (!c) return null;
  if (c.type === 'rect') return { x: c.x, y: c.y, w: c.w, h: c.h };
  if (c.type === 'circle') return { x: c.cx - c.r, y: c.cy - c.r, w: 2 * c.r, h: 2 * c.r };
  if (c.type === 'path') { const ps = pathPolys(c.d).flat(); if (ps.length < 2) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i + 1 < ps.length; i += 2) { x0 = Math.min(x0, ps[i]); x1 = Math.max(x1, ps[i]); y0 = Math.min(y0, ps[i + 1]); y1 = Math.max(y1, ps[i + 1]); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
  return null;
}

// ---------------------------------------------------------------- main pass
export function polish(ctx: Ctx): QualityReport {
  const { W, H, u } = ctx;
  const nodes = ctx.nodes;
  const rep: QualityReport = { score: 100, overlaps: 0, glyphHits: 0, lowContrast: 0, offCanvas: 0, clutter: 0, empty: 0, moved: 0, dropped: 0, recolored: 0, scrims: 0, outlined: 0, design: 0 };
  const texts = nodes.filter(isText).filter((t) => ctx.on(t.layer) && visibleText(t) && !t.rotate && !t.vertical && !t.clip);
  const primaries = texts.filter((t) => isPrimary(ctx, t) && (t.opacity ?? 1) >= 0.3);
  const movable = texts.filter((t) => !isPrimary(ctx, t));

  // 0. decorative micro-labels (zone numbers, ticks, ornament captions) give way to real copy
  const decoLabel = (t: TextNode) => t.role === 'zone' || t.role === 'tick' || (t.layer !== 'text' && t.layer !== 'sidebar' && t.size < u * 2);
  const removed = new Set<SceneNode>();
  for (const d of movable.filter(decoLabel)) {
    if (texts.some((o) => o !== d && !decoLabel(o) && interArea(d.box, o.box) > 0)) { removed.add(d); rep.dropped++; }
  }
  const movable2 = movable.filter((t) => !removed.has(t));
  movable.length = 0; movable.push(...movable2);

  // 1. cluster movable texts that belong together (stacked groups)
  const parent = movable.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < movable.length; i++) for (let j = i + 1; j < movable.length; j++) {
    const a = movable[i].box, b = movable[j].box;
    const hOver = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -u * 0.5;
    const vGap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
    if (hOver && vGap < Math.max(u * 1.6, 0.9 * Math.min(movable[i].size, movable[j].size))) parent[find(i)] = find(j);
  }
  // phase 8: members of a declared info group (`grp`) move as one unit
  const gi = new Map<string, number>();
  movable.forEach((t, i) => { const g = (t as TextNode & { grp?: string }).grp; if (!g) return; if (gi.has(g)) parent[find(i)] = find(gi.get(g)!); else gi.set(g, i); });
  const clusters = new Map<number, TextNode[]>();
  movable.forEach((t, i) => { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r)!.push(t); });
  // accent rules that sit inside a cluster travel with it
  const rules = nodes.filter((n): n is RectNode => n.kind === 'rect' && n.layer === 'ornament' && n.h < u * 0.9 && n.w < u * 9);

  const obstacles: Box[] = primaries.map(glyphBox);
  const placed: Box[] = [];
  const minX = u * 1.2, minY = u * 1.2, maxX = W - u * 1.2, maxY = H - u * 1.2;
  const hits = (b: Box) => {
    const A = Math.max(1, b.w * b.h);
    let g = 0, o = 0;
    for (const ob of obstacles) g += interArea(b, ob);
    for (const p of placed) o += interArea(b, p);
    return { g: g / A, o: o / A };
  };
  const order = [...clusters.values()].sort((a, b) => nodes.indexOf(a[0]) - nodes.indexOf(b[0]));
  for (const cl of order) {
    // intra-cluster: un-stack members whose boxes overlap (e.g. a 2-line note above a title)
    const byY = [...cl].sort((a, b) => a.box.y - b.box.y);
    for (let i = 1; i < byY.length; i++) for (let j = 0; j < i; j++) {
      const a = byY[j].box, b = byY[i].box;
      const ov = interArea(a, b);
      if (ov > Math.min(a.w * a.h, b.w * b.h) * 0.04) { const push = a.y + a.h - b.y + Math.max(2, u * 0.6); shiftText(byY[i], 0, push); rep.moved++; }
    }
    const bb = union(cl.map((t) => t.box));
    const h0 = hits(bb);
    const outside = bb.y + bb.h > H - u * 0.5 || bb.y < u * 0.5;
    if (h0.g < 0.03 && h0.o < 0.03 && !outside) { placed.push(bb); continue; }
    // search the nearest free position: vertical first (keeps column alignment), then horizontal, then diagonal
    const step = Math.max(u * 1.2, Math.min(bb.h * 0.5, u * 3));
    let best: { dx: number; dy: number } | null = null;
    const cands: [number, number][] = [];
    for (let k = 1; k <= 22; k++) { cands.push([0, k * step], [0, -k * step]); }
    for (let k = 1; k <= 10; k++) { cands.push([k * step, 0], [-k * step, 0]); }
    for (let k = 1; k <= 8; k++) for (const sx of [-1, 1]) for (const sy of [-1, 1]) cands.push([sx * k * step, sy * k * step]);
    cands.sort((a, b) => Math.hypot(a[0], a[1] * 0.8) - Math.hypot(b[0], b[1] * 0.8));
    for (const [dx, dy] of cands) {
      const nb = { ...bb, x: bb.x + dx, y: bb.y + dy };
      if (nb.x < minX || nb.y < minY || nb.x + nb.w > maxX || nb.y + nb.h > maxY) continue;
      if (Math.abs(dy) > H * 0.32 || Math.abs(dx) > W * 0.3) continue;
      const h = hits(nb);
      if (h.g < 0.02 && h.o < 0.02) { best = { dx, dy }; break; }
    }
    if (best) {
      for (const t of cl) shiftText(t, best.dx, best.dy);
      for (const r of rules) if (r.x >= bb.x - 2 && r.x + r.w <= bb.x + bb.w + 2 && r.y >= bb.y - u && r.y + r.h <= bb.y + bb.h + u) { r.x += best.dx; r.y += best.dy; }
      const gs = new Set(cl.map((t) => (t as TextNode & { grp?: string }).grp).filter(Boolean));
      if (gs.size) for (const n of nodes) if (n.kind === 'rect' && !rules.includes(n) && gs.has((n as RectNode & { grp?: string }).grp)) { n.x += best.dx; n.y += best.dy; }
      placed.push({ ...bb, x: bb.x + best.dx, y: bb.y + best.dy });
      rep.moved += cl.length;
    } else if (cl.every(lowPriority)) {
      for (const t of cl) removed.add(t);
      rep.dropped += cl.length;
    } else {
      // last resort: drop only the low-priority members and keep the rest
      const keep = cl.filter((t) => !lowPriority(t));
      for (const t of cl) if (lowPriority(t)) { removed.add(t); rep.dropped++; }
      const kb = union(keep.map((t) => t.box)); const hk = hits(kb);
      if (hk.g >= 0.03) rep.glyphHits++;
      if (hk.o >= 0.03) rep.overlaps++;
      placed.push(kb);
    }
  }
  if (removed.size) ctx.nodes = nodes.filter((n) => !removed.has(n));

  // 1b. occlusion: a headline-scale word must never sit *under* an opaque photo/zone drawn later
  //     (cut-outs and type-fill images are deliberate depth effects and keep their order)
  // phase 8: a declared break (scene semantics) licenses its nodes to overlap and keep their order
  const lic = licensedPairs((ctx as { sem?: SceneSemantics }).sem);
  {
    const L = ctx.nodes;
    for (const t of primaries) {
      if (t.layer !== 'text' || removed.has(t)) continue;
      const ti = L.indexOf(t);
      if (ti < 0) continue;
      const area = t.box.w * t.box.h;
      let last = -1;
      for (let j = ti + 1; j < L.length; j++) {
        const n = L[j];
        const opaque = (n.opacity ?? 1) > 0.5 && ctx.on(n.layer);
        if (!opaque || lic.has(t.id + '|' + n.id)) continue;
        let b: Box | null = null;
        if (n.kind === 'image' && !n.cutout && n.clip?.type !== 'text') b = clipBox(n.clip) ?? { x: n.x, y: n.y, w: n.w, h: n.h };
        else if (n.kind === 'rect' && n.layer !== 'bg' && n.fill !== 'none' && n.w * n.h < W * H * 0.9) b = n;
        if (b && interArea(b, glyphBox(t)) > area * 0.1) last = j;
      }
      if (last > ti) { L.splice(ti, 1); L.splice(last, 0, t); rep.moved++; }
    }
  }

  // 2. contrast repair against the effective background
  const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
  const bg = ctx.pal.bg;
  const list = ctx.nodes;
  const cands = [ctx.pal.ink, ctx.pal.light, ctx.pal.dark, ctx.pal.bg, ctx.pal.accent, '#111111', '#f7f5f0'];
  // headline over a split background (part plain, part photo): no single fill reads on both, so give the
  // word a quiet outline in the colour that separates it from the darker/lighter part
  const outlineIfSplit = (t: TextNode, i: number) => {
    if (t.stroke) return true;
    const lo = textContrast(ctx, list, i, t, t.fill, bg, assets, 0.08, 9);
    if (lo >= 1.7) return false;
    const opts = [ctx.pal.light, ctx.pal.dark, ctx.pal.bg, '#ffffff', '#111111'];
    const best = opts.reduce((a, c) => (wcag(c, t.fill) > wcag(a, t.fill) ? c : a), opts[0]);
    t.stroke = best; t.sw = Math.max(1.5, t.size * 0.022);
    rep.outlined++;
    return true;
  };
  // phase 19: the user's own colours (palette editor). With "keep my colours" on, text in them is left as chosen;
  // otherwise the repair runs as always and is counted, so the editor can say what it changed.
  const mine = ctx.pal.user ? new Set(Object.values(ctx.pal.user.edits).map((c) => String(c).toLowerCase())) : null;
  if (mine) { rep.mineFixed = 0; rep.mineKept = 0; }
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!isText(t) || !ctx.on(t.layer) || !visibleText(t) || t.clip || (t.opacity ?? 1) < 0.5) continue;
    if (t.role === 'glyph' || t.layer === 'ornament') continue;
    const large = t.size >= u * 4;
    const need = large ? 2.6 : 3.6;
    const cur = textContrast(ctx, list, i, t, t.fill, bg, assets);
    if (cur >= need) { if (large) outlineIfSplit(t, i); continue; }
    if (mine?.has(t.fill.toLowerCase())) {
      if (ctx.p.fitOverride) { rep.mineKept!++; rep.lowContrast++; continue; }
      rep.mineFixed!++;
    }
    let bestC = t.fill, bestV = cur;
    for (const c of cands) { const v = textContrast(ctx, list, i, t, c, bg, assets); if (v > bestV + 0.15) { bestV = v; bestC = c; } }
    if (bestC !== t.fill) { t.fill = bestC; rep.recolored++; }
    if (bestV >= need) { if (large) outlineIfSplit(t, i); continue; }
    if (large && outlineIfSplit(t, i)) continue;
    if (!large) {
      // small text that still can't be read: a quiet label plate behind it
      const lightText = relLum(t.fill) > 0.4;
      const plate = lightText ? ctx.pal.dark : ctx.pal.light;
      const pad = Math.max(u * 0.6, t.size * 0.35);
      const pr: RectNode = { kind: 'rect', id: ctx.id('plate'), layer: t.layer, x: t.box.x - pad, y: t.box.y - pad, w: t.box.w + 2 * pad, h: t.box.h + 2 * pad, fill: plate, opacity: 0.9 };
      list.splice(i, 0, pr); i++;
      if (wcag(t.fill, plate) < 4.5) t.fill = lightText ? ctx.pal.light : ctx.pal.dark;
      rep.scrims++;
    } else rep.lowContrast++;
  }

  // big-vs-big collisions (two headline-scale texts on top of each other) can't be nudged: score them
  const bigText = primaries.filter((t) => t.layer === 'text');
  for (let i = 0; i < bigText.length; i++) for (let j = i + 1; j < bigText.length; j++) {
    if (lic.has(bigText[i].id + '|' + bigText[j].id)) continue;
    const a = glyphBox(bigText[i]), b = glyphBox(bigText[j]);
    if (interArea(a, b) > Math.min(a.w * a.h, b.w * b.h) * 0.08) rep.glyphHits++;
  }

  // 3. scoring
  const finalTexts = ctx.nodes.filter(isText).filter((t) => ctx.on(t.layer) && visibleText(t) && !t.rotate && !t.vertical);
  const mov = finalTexts.filter((t) => !isPrimary(ctx, t) && !t.clip);
  let pairOverlap = 0;
  for (let i = 0; i < mov.length; i++) for (let j = i + 1; j < mov.length; j++) {
    const a = interArea(mov[i].box, mov[j].box);
    if (a > Math.min(mov[i].box.w * mov[i].box.h, mov[j].box.w * mov[j].box.h) * 0.05) pairOverlap++;
  }
  rep.overlaps += pairOverlap;
  for (const t of mov) if (t.box.x < -1 || t.box.y < -1 || t.box.x + t.box.w > W + 1 || t.box.y + t.box.h > H + 1) rep.offCanvas++;
  const textArea = mov.reduce((s, t) => s + t.box.w * t.box.h, 0) / (W * H);
  const count = mov.length;
  rep.clutter = Math.max(0, count - 34) * 0.6 + Math.max(0, textArea - 0.16) * 120;
  // emptiness: little besides the background
  const bigVisual = ctx.nodes.filter((n) => n.layer !== 'bg' && ctx.on(n.layer) && ((n.kind === 'image' && n.w * n.h > W * H * 0.05) || (n.kind === 'rect' && n.w * n.h > W * H * 0.05) || (n.kind === 'text' && n.size > u * 6))).length;
  rep.empty = bigVisual === 0 ? 1 : 0;
  const hidden = new Set<string>(['bg', 'zones', 'lines', 'curves', 'noise', 'texture', 'text', 'ornament', 'shapes', 'images', 'sidebar', 'band'].filter((l) => !ctx.on(l as never)));
  rep.audit = designAudit({ nodes: ctx.nodes, W, H, palette: ctx.pal, images: ctx.images, comp: ctx.comp, hidden });
  rep.design = rep.audit.penalty;
  rep.score = Math.max(0, 100 - rep.design - rep.overlaps * 14 - rep.glyphHits * 18 - rep.lowContrast * 9 - rep.offCanvas * 6 - rep.clutter - rep.empty * 15 - rep.dropped * 1.5 - rep.scrims * 2);
  void hexToRgb;
  return rep;
}

/** Colours actually visible under a box (3×3 samples), used by placed components to pick legible inks. */
export function sampleBg(ctx: Ctx, nodes: SceneNode[], box: Box, bg: string): string[] {
  const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
  const out: string[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(colorAt(ctx, nodes, nodes.length, box.x + (box.w * (i + 0.5)) / 3, box.y + (box.h * (j + 0.5)) / 3, bg, assets) || bg);
  return out;
}
