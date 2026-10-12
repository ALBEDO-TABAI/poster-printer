// Art-direction pass (phase 3). It runs after a composer has laid the poster out and before `polish`.
// It encodes the principles in docs/DESIGN_PRINCIPLES.md as hard rules:
//   1. modular type scale (snap) + one clear focal point (secondary type ≤ focal / ratio²)
//   2. text-block budget (few, intentional blocks; meta row ≤ 3–5 items)
//   3. decoration budget (decoration is punctuation, not wallpaper)
//   4. grid-edge cohesion (blocks share edges / margins) + cross-column baseline alignment
//   5. legibility on busy images via a soft gradient scrim (no hard boxes)
//   6. colour proportion: the accent stays ≈10 % of the canvas
import type { SceneNode, TextNode, ImageNode, RectNode } from '../types';
import type { Ctx, ImageAsset } from './ctx';
import { typeScale, snapToScale } from '../typo';
import { imageDrawRect } from '../render/svg';
import { clipBox, interArea, union } from './quality';
import { deltaE } from '../color/convert';
import { relLum } from '../color/contrast';
import { ACCENT_CAP, isOpponentAccent } from '../color/accent';
import { RESTRAINT, RESTRAINT_BLOCKS } from './grid';

type Box = { x: number; y: number; w: number; h: number };
export interface DirectionReport { ratio: number; snapped: number; demoted: number; dropped: number; frameDropped: number; decorDropped: number; aligned: number; baselines: number; scrims: number; recolored: number }

const RATIO_BY_COMP: Record<string, number> = { giant: 1.618, typefill: 1.618, swiss: 1.333, cards: 1.333, centered: 1.414, checker: 1.414, fan: 1.414, split: 1.5, fullbleed: 1.5, partition: 1.5, layered: 1.5, bands: 1.5 };

const isText = (n: SceneNode): n is TextNode => n.kind === 'text';
const visible = (t: TextNode) => t.lines.length > 0 && t.fill !== 'none' && t.raw !== '' && t.box.w > 0 && (t.opacity ?? 1) > 0.3;
const numeric = (t: TextNode) => /^[\d\s.\-/:№#]+$/.test(t.raw.trim());
const inflate = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });

/** scale a laid-out text node about its anchor / top edge */
export function scaleText(t: TextNode, f: number) {
  if (Math.abs(f - 1) < 1e-3) return;
  const top = t.box.y;
  t.size *= f;
  t.lines = t.lines.map((l) => ({ ...l, y: top + (l.y - top) * f }));
  const w = t.box.w * f, h = t.box.h * f;
  const ax = t.anchor === 'start' ? t.box.x : t.anchor === 'middle' ? t.box.x + t.box.w / 2 : t.box.x + t.box.w;
  t.box = { x: t.anchor === 'start' ? ax : t.anchor === 'middle' ? ax - w / 2 : ax - w, y: top, w, h };
  if (t.sw) t.sw *= f;
}
function shiftText(t: TextNode, dx: number, dy: number) {
  t.lines = t.lines.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }));
  t.box = { ...t.box, x: t.box.x + dx, y: t.box.y + dy };
}

/** union-find clusters of text blocks that read as one group */
export function textClusters(ts: TextNode[], u: number): TextNode[][] {
  const parent = ts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const a = ts[i].box, b = ts[j].box;
    const hOver = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -u * 0.5;
    const vGap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
    if (hOver && vGap < Math.max(u * 1.6, 0.9 * Math.min(ts[i].size, ts[j].size))) parent[find(i)] = find(j);
  }
  const m = new Map<number, TextNode[]>();
  ts.forEach((t, i) => { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r)!.push(t); });
  return [...m.values()];
}

/** mean image detail (0 calm … 1 busy) of an image node under a box */
export function detailUnder(n: ImageNode, a: ImageAsset | undefined, b: Box): number {
  if (!a?.detail || a.detail.length !== 256) return 0.3;
  const dr = imageDrawRect(n);
  let s = 0, c = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x = b.x + ((i + 0.5) / 6) * b.w, y = b.y + ((j + 0.5) / 4) * b.h;
    const u = (x - dr.x) / dr.w, v = (y - dr.y) / dr.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    s += a.detail[Math.min(15, Math.floor(v * 16)) * 16 + Math.min(15, Math.floor(u * 16))]; c++;
  }
  let d = c ? s / c : 0;
  if (n.filter?.blur) d *= 0.4;
  if (n.overlay) d *= 1 - Math.min(0.8, n.overlay.opacity);
  return d;
}
export const imageBox = (n: ImageNode): Box => {
  const f = { x: n.x, y: n.y, w: n.w, h: n.h };
  const c = clipBox(n.clip);
  if (!c) return f;
  const x0 = Math.max(f.x, c.x), y0 = Math.max(f.y, c.y), x1 = Math.min(f.x + f.w, c.x + c.w), y1 = Math.min(f.y + f.h, c.y + c.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
};

/** the salient subject of an image node in canvas coordinates (clipped to what is visible), or null */
export function subjectBox(n: ImageNode, a: ImageAsset | undefined): Box | null {
  const sj = a?.subject;
  if (!sj || sj.w * sj.h > 0.62) return null; // "everything is subject" (textures, landscapes): nothing to protect
  const dr = imageDrawRect(n);
  const b = { x: dr.x + sj.x * dr.w, y: dr.y + sj.y * dr.h, w: sj.w * dr.w, h: sj.h * dr.h };
  const ib = imageBox(n);
  const x0 = Math.max(b.x, ib.x), y0 = Math.max(b.y, ib.y), x1 = Math.min(b.x + b.w, ib.x + ib.w), y1 = Math.min(b.y + b.h, ib.y + ib.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
/** the "head" of a subject: its top 40 % (faces, roof lines, the neck of a vase) */
export const headOf = (b: Box): Box => ({ x: b.x + b.w * 0.1, y: b.y, w: b.w * 0.8, h: b.h * 0.4 });

/**
 * The part of an image that type must not cover. Bounded subjects → their head; close-ups whose cut-out fills the
 * frame (a bust, a face) → a box around the saliency focus. Textures / landscapes → nothing.
 */
export function protectBox(n: ImageNode, a: ImageAsset | undefined): Box | null {
  if (!a?.subject || n.cutout) return null;
  const sj = a.subject;
  const dr = imageDrawRect(n);
  const ib = imageBox(n);
  const clip = (b: Box): Box | null => { const x0 = Math.max(b.x, ib.x), y0 = Math.max(b.y, ib.y), x1 = Math.min(b.x + b.w, ib.x + ib.w), y1 = Math.min(b.y + b.h, ib.y + ib.h); return x1 - x0 > 4 && y1 - y0 > 4 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; };
  if (sj.w * sj.h <= 0.62) { const sb = subjectBox(n, a); return sb ? clip(headOf(sb)) : null; }
  if (!a.cutout) return null;
  const f = a.focus ?? { x: 0.5, y: 0.45 };
  const w = sj.w * dr.w * 0.55, h = sj.h * dr.h * 0.42;
  return clip({ x: dr.x + f.x * dr.w - w / 2, y: dr.y + f.y * dr.h - h * 0.6, w, h });
}

/** decorative items and their weight in the decoration budget */
export function decorItems(nodes: SceneNode[], comp: string): { n: SceneNode; kind: string; w: number }[] {
  const out: { n: SceneNode; kind: string; w: number }[] = [];
  let noise = false;
  for (const n of nodes) {
    if (n.layer === 'ornament' && n.kind === 'path') out.push({ n, kind: 'icon', w: 1 });
    else if (n.kind === 'text' && n.role === 'signature') out.push({ n, kind: 'signature', w: 1 });
    else if (n.kind === 'text' && n.role === 'glyph' && n.id.includes('glyph')) out.push({ n, kind: 'glyph', w: 1.5 });
    else if (n.layer === 'curves' && comp !== 'fan') { const b = decorBox(n); out.push({ n, kind: 'curve', w: b && Math.max(b.w, b.h) > 400 ? 1.25 : 0.5 }); } // big arcs weigh more (canvas short side = 1200)
    else if (n.layer === 'shapes') out.push({ n, kind: 'shape', w: 1 });
    else if (n.layer === 'noise' && !noise) { noise = true; out.push({ n, kind: 'noise', w: 1 }); }
  }
  return out;
}
export function decorBox(n: SceneNode): Box | null {
  switch (n.kind) {
    case 'text': return n.box;
    case 'circle': return { x: n.cx - n.r, y: n.cy - n.r, w: 2 * n.r, h: 2 * n.r };
    case 'rect': return n;
    case 'path': { const c = clipBox({ type: 'path', d: n.d }); return c; }
    case 'line': return { x: Math.min(n.x1, n.x2), y: Math.min(n.y1, n.y2), w: Math.abs(n.x2 - n.x1), h: Math.abs(n.y2 - n.y1) };
    default: return null;
  }
}

export function direct(ctx: Ctx, comp: string, o: { allowDrop?: boolean } = {}): DirectionReport {
  const { W, H, u } = ctx;
  const rep: DirectionReport = { ratio: 1.5, snapped: 0, demoted: 0, dropped: 0, frameDropped: 0, decorDropped: 0, aligned: 0, baselines: 0, scrims: 0, recolored: 0 };
  const tr = String(ctx.p.typeRatio ?? 'auto');
  const r = tr === 'auto' ? RATIO_BY_COMP[comp] ?? 1.5 : Number(tr) || 1.5;
  rep.ratio = r;
  const C = ctx.grid.content;
  const removed = new Set<SceneNode>();
  const body = () => ctx.nodes.filter(isText).filter((t) => t.layer === 'text' && ctx.on('text') && visible(t) && !t.clip && !t.rotate && !t.vertical && t.role !== 'glyph' && t.tag !== 'system' && !removed.has(t));

  // ---- 1. modular scale + focal hierarchy
  const levels = typeScale(ctx.size('note'), r, -2, 16);
  for (const t of body()) {
    if (t.size < u * 1.45 || t.size > u * 7) continue; // micro text is already at its floor; display words are fitted
    const s = snapToScale(t.size, levels, 1.04);
    if (Math.abs(s / t.size - 1) > 0.015) { scaleText(t, s / t.size); rep.snapped++; }
  }
  const ts = body();
  const focal = ts.reduce<TextNode | null>((b, t) => (!numeric(t) && (!b || t.size > b.size) ? t : b), null);
  // display type that is not a plain text node (type-fill images clipped by a word, clipped/outlined display words)
  let displaySize = 0;
  for (const n of ctx.nodes) {
    if (n.tag === 'script' || n.tag === 'anchor' || n.tag === 'texture') continue; // textures, not display copy
    if (n.kind === 'image' && n.clip?.type === 'text') displaySize = Math.max(displaySize, n.clip.size);
    else if (n.kind === 'text' && n.layer !== 'sidebar' && (n.clip || (n.role === 'glyph' && n.id.includes('tfo')))) displaySize = Math.max(displaySize, n.size);
  }
  if (focal) {
    const top = Math.max(focal.size, displaySize);
    const lim = top / Math.max(1.6, r * r * 0.85);
    const floor = (role: string) => (role.endsWith('main') ? levels[3] : levels[2]) * 1.0001; // labels stay a step above notes
    for (const t of ts) {
      if (t === focal || numeric(t) || t.raw === focal.raw || t.size <= lim) continue;
      if (!/main|sub/.test(t.role)) continue;
      // keep sibling copies of the focal word (e.g. multi-line display split over nodes) at full size
      if (Math.abs(t.size - focal.size) < focal.size * 0.02 && t.role === focal.role) continue;
      const target = Math.max(levels.filter((l) => l <= lim).pop() ?? lim, Math.min(t.size, floor(t.role)));
      if (target < t.size * 0.99) { scaleText(t, target / t.size); rep.demoted++; }
    }
  }

  // ---- 2. text-block budget
  const wide = W / H > 1.5;
  const clusters = textClusters(body(), u);
  const isFrame = (cl: TextNode[]) => {
    const b = union(cl.map((t) => t.box));
    return cl.every((t) => t.size <= u * 1.3) && (b.y < C.y + u * 4 || b.y + b.h > C.y + C.h - u * 4);
  };
  const frame = clusters.filter(isFrame);
  const blocks = clusters.filter((c) => !isFrame(c));
  const drop = (cl: TextNode[]) => {
    const bb = inflate(union(cl.map((t) => t.box)), u);
    for (const t of cl) removed.add(t);
    // accent rules that belonged to the block go with it
    for (const n of ctx.nodes) if (n.kind === 'rect' && n.layer === 'ornament' && n.h < u * 0.9 && n.w < u * 9 && n.x >= bb.x && n.x + n.w <= bb.x + bb.w && n.y >= bb.y && n.y + n.h <= bb.y + bb.h) removed.add(n);
  };
  if (o.allowDrop !== false) {
    // meta row: keep the outermost + centre items on each edge band (≤ 3 per edge, ≤ 5 on wide canvases)
    const perEdge = wide ? 5 : 3;
    for (const edge of ['top', 'bottom'] as const) {
      const row = frame.filter((cl) => { const b = union(cl.map((t) => t.box)); return edge === 'top' ? b.y < C.y + u * 4 : b.y + b.h > C.y + C.h - u * 4; })
        .map((cl) => ({ cl, b: union(cl.map((t) => t.box)) })).sort((a, b) => a.b.x - b.b.x);
      if (row.length <= perEdge) continue;
      const keep = new Set([row[0], row[row.length - 1]]);
      const mid = W / 2;
      const rest = row.filter((x) => !keep.has(x)).sort((a, b) => Math.abs(a.b.x + a.b.w / 2 - mid) - Math.abs(b.b.x + b.b.w / 2 - mid));
      for (const x of rest.slice(0, perEdge - 2)) keep.add(x);
      for (const x of row) if (!keep.has(x)) { drop(x.cl); rep.frameDropped += x.cl.length; }
    }
    const bb = RESTRAINT.has(String(ctx.comp)) ? Math.min(RESTRAINT_BLOCKS, ctx.num('blockBudget')) : ctx.num('blockBudget'); // phase 15
    const budget = Math.max(3, bb + (wide ? 1 : 0)) - (frame.length ? 1 : 0);
    if (blocks.length > budget) {
      const prio = (cl: TextNode[]) => {
        const b = union(cl.map((t) => t.box));
        let p = Math.sqrt(b.w * b.h) / u;
        if (cl.includes(focal!)) p += 1e6;
        if (cl.some((t) => t.role.startsWith('big.'))) p += 1e5;
        if (cl.some((t) => t.role === 'small.main')) p += 30;
        if (cl.some((t) => /sub/.test(t.role))) p += 8;
        // blocks hugging the content edges / margins anchor the composition
        const edgeD = Math.min(Math.abs(b.x - C.x), Math.abs(b.x + b.w - C.x - C.w), Math.abs(b.y - C.y), Math.abs(b.y + b.h - C.y - C.h));
        if (edgeD < u * 2) p += 10;
        return p;
      };
      const order = [...blocks].sort((a, b) => prio(a) - prio(b));
      for (const cl of order.slice(0, blocks.length - budget)) {
        if (prio(cl) >= 1e5) continue;
        drop(cl); rep.dropped += cl.length;
      }
    }
  }

  // ---- 3. decoration budget
  {
    const textBoxes = body().filter((t) => !removed.has(t)).map((t) => t.box);
    const imgs = ctx.nodes.filter((n): n is ImageNode => n.kind === 'image' && ctx.on(n.layer));
    const displayWord = body().some((t) => t.size >= u * 11);
    let items = decorItems(ctx.nodes, comp).filter((d) => !removed.has(d.n));
    const kill = (d: { n: SceneNode }) => {
      if (d.n.layer === 'noise') { for (const n of ctx.nodes) if (n.layer === 'noise') removed.add(n); }
      else removed.add(d.n);
      rep.decorDropped++;
    };
    for (const d of items) {
      const b = decorBox(d.n);
      if (!b) continue;
      if (d.kind === 'glyph') {
        const g = d.n as TextNode;
        const hitsText = textBoxes.some((tb) => interArea(tb, b) > Math.min(tb.w * tb.h, b.w * b.h) * 0.08);
        if (displayWord || hitsText || (focal && interArea(focal.box, b) > 0)) { if (g.size > u * 6) kill(d); }
      } else if (d.kind === 'icon' || d.kind === 'shape' || d.kind === 'signature') {
        const ib = inflate(b, -Math.min(b.w, b.h) * 0.1);
        if (textBoxes.some((tb) => interArea(inflate(tb, u * 0.5), ib) > 0) || imgs.some((im) => interArea(imageBox(im), ib) > ib.w * ib.h * 0.3 && !im.cutout)) kill(d);
      }
    }
    items = items.filter((d) => !removed.has(d.n));
    if (imgs.length) {
      const curves = items.filter((d) => d.kind === 'curve').sort((a, b) => { const A = decorBox(a.n), B = decorBox(b.n); return (B ? B.w * B.h : 0) - (A ? A.w * A.h : 0); });
      for (const c of curves.slice(0, Math.max(0, curves.length - 2))) kill(c);
      items = items.filter((d) => !removed.has(d.n));
    }
    const budget = ctx.num('decorBudget');
    const order = ['noise', 'shape', 'curve', 'glyph', 'signature', 'icon'];
    let total = items.reduce((s, d) => s + d.w, 0);
    for (const k of order) {
      if (total <= budget) break;
      for (const d of items.filter((x) => x.kind === k).reverse()) {
        if (total <= budget) break;
        if (k === 'icon' && items.filter((x) => x.kind === 'icon' && !removed.has(x.n)).length <= 1) break;
        kill(d); total -= d.w;
      }
    }
  }

  // ---- 3b. the focal block never sits on a subject's face: slide it vertically to the calmest clear band
  if (focal && ctx.on('images')) {
    const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
    const fi = ctx.nodes.indexOf(focal);
    const prot = ctx.nodes.slice(0, fi).filter((n): n is ImageNode => n.kind === 'image' && !removed.has(n)).map((n) => protectBox(n, assets.get(n.imageId))).filter(Boolean) as Box[];
    if (prot.length) {
      const all = textClusters(body(), u);
      const fc = all.find((cl) => cl.includes(focal))!;
      const others = all.filter((cl) => cl !== fc).map((cl) => union(cl.map((t) => t.box)));
      const fb = union(fc.map((t) => t.box));
      const cost = (b: Box, dy: number) => prot.reduce((s2, p) => s2 + interArea(b, p) / Math.max(1, Math.min(p.w * p.h, b.w * b.h)), 0) + others.reduce((s2, o2) => s2 + (interArea(b, o2) > 0 ? 0.8 : 0), 0) + (Math.abs(dy) / H) * 0.25;
      const c0 = cost(fb, 0);
      if (c0 > 0.2) {
        let best = 0, bv = c0;
        for (let y = C.y; y + fb.h <= C.y + C.h; y += u * 2) { const dy = y - fb.y; const v = cost({ ...fb, y }, dy); if (v < bv - 1e-6) { bv = v; best = dy; } }
        if (best !== 0 && bv < c0 * 0.6) { for (const t of fc) shiftText(t, 0, best); rep.aligned++; }
      }
    }
  }

  // ---- 4. grid-edge cohesion: blocks whose edges nearly line up are made to line up exactly
  {
    const cls = textClusters(body(), u).filter((cl) => !cl.includes(focal!) || cl.length > 1);
    const edges = (cl: TextNode[]) => { const b = union(cl.map((t) => t.box)); const a = cl[0].anchor; return { b, a, e: a === 'start' ? b.x : a === 'end' ? b.x + b.w : b.x + b.w / 2 }; };
    const targetsL = [C.x, ...ctx.grid.x.map((x, i) => (i > 0 && i < ctx.grid.nc ? x + ctx.grid.gutter / 2 : x))];
    const targetsR = [C.x + C.w, ...ctx.grid.x.map((x, i) => (i > 0 && i < ctx.grid.nc ? x - ctx.grid.gutter / 2 : x))];
    const info = cls.map((cl) => ({ cl, ...edges(cl) })).filter((x) => x.cl.every((t) => t.anchor === x.a));
    const onPlainGround = (b: Box) => !ctx.nodes.some((n) => (n.kind === 'rect' && n.layer === 'zones' && interArea(n, b) > 0 && interArea(n, b) < b.w * b.h * 0.95) || (n.kind === 'image' && interArea(imageBox(n), b) > 0));
    for (const x of info) {
      if (x.a === 'middle') continue;
      // 1) snap to a sibling block's edge, 2) else to a column edge / the margin (only on plain ground: not inside panels)
      const sib = info.filter((y) => y !== x && y.a === x.a).map((y) => y.e).filter((e) => Math.abs(e - x.e) > 0.5 && Math.abs(e - x.e) < u * 1.6);
      let tgt: number | null = sib.length ? sib.reduce((a, b) => (Math.abs(a - x.e) < Math.abs(b - x.e) ? a : b)) : null;
      if (tgt === null && onPlainGround(x.b)) {
        const cand = (x.a === 'start' ? targetsL : targetsR).filter((e) => Math.abs(e - x.e) > 0.5 && Math.abs(e - x.e) < u * 1.8);
        if (cand.length) tgt = cand.reduce((a, b) => (Math.abs(a - x.e) < Math.abs(b - x.e) ? a : b));
      }
      if (tgt === null) continue;
      const dx = tgt - x.e;
      const nb = { ...x.b, x: x.b.x + dx };
      if (nb.x < u || nb.x + nb.w > W - u) continue;
      for (const t of x.cl) shiftText(t, dx, 0);
      x.b = nb; x.e = tgt; rep.aligned++;
    }
    // cross-column baseline alignment: blocks side by side whose first baselines nearly match share one baseline
    const firsts = info.map((x) => ({ x, t: x.cl.slice().sort((a, b) => a.box.y - b.box.y)[0] }));
    for (let i = 0; i < firsts.length; i++) for (let j = i + 1; j < firsts.length; j++) {
      const A = firsts[i], B = firsts[j];
      if (Math.abs(A.t.size - B.t.size) > Math.max(A.t.size, B.t.size) * 0.12) continue;
      const ba = A.t.lines[0].y, bb = B.t.lines[0].y;
      const d = bb - ba;
      if (Math.abs(d) < 0.5 || Math.abs(d) > Math.max(u * 1.2, A.t.size * 0.6)) continue;
      const sideBySide = A.x.b.x + A.x.b.w <= B.x.b.x + u || B.x.b.x + B.x.b.w <= A.x.b.x + u;
      if (!sideBySide) continue;
      for (const t of B.x.cl) shiftText(t, 0, -d);
      B.x.b = { ...B.x.b, y: B.x.b.y - d };
      rep.baselines++;
    }
  }

  // ---- 5. busy-image legibility: one soft gradient scrim per image side, never a hard box
  if (ctx.p.busyScrim !== false && ctx.on('images')) {
    const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
    const cls = textClusters(body(), u);
    type Hit = { img: ImageNode; b: Box; d: number; cl: TextNode[] };
    const hits: Hit[] = [];
    for (const cl of cls) {
      if (cl.every((t) => t.size <= u * 1.4)) continue; // meta / micro text: recolour or a plate is enough
      const b = union(cl.map((t) => t.box));
      const ti = Math.min(...cl.map((t) => ctx.nodes.indexOf(t)));
      let best: Hit | null = null;
      for (let k = 0; k < ti; k++) {
        const n = ctx.nodes[k];
        if (n.kind !== 'image' || n.cutout || removed.has(n) || (n.opacity ?? 1) < 0.6 || n.clip?.type === 'text' || !ctx.on(n.layer)) continue;
        const ib = imageBox(n);
        if (interArea(ib, b) < b.w * b.h * 0.5) continue;
        const d = detailUnder(n, assets.get(n.imageId), b);
        if (!best || ctx.nodes.indexOf(n) > ctx.nodes.indexOf(best.img)) best = { img: n, b, d, cl };
      }
      // a later opaque zone between image and text already calms the area
      if (best && best.d > 0.36) {
        const bi = ctx.nodes.indexOf(best.img);
        const covered = ctx.nodes.slice(bi + 1, ti).some((n) => n.kind === 'rect' && n.fill !== 'none' && (n.opacity ?? 1) > 0.6 && interArea(n, b) > b.w * b.h * 0.6);
        if (!covered) hits.push(best);
      }
    }
    const byImg = new Map<ImageNode, Hit[]>();
    for (const h of hits) { if (!byImg.has(h.img)) byImg.set(h.img, []); byImg.get(h.img)!.push(h); }
    for (const [img, hs] of byImg) {
      const ib = imageBox(img);
      const a = assets.get(img.imageId);
      const lumAt = (b: Box) => { if (!a?.lum) return 0.3; const dr = imageDrawRect(img); let s = 0, c = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const uu = (b.x + ((i + 0.5) / 4) * b.w - dr.x) / dr.w, vv = (b.y + ((j + 0.5) / 3) * b.h - dr.y) / dr.h; if (uu < 0 || uu > 1 || vv < 0 || vv > 1) continue; s += a.lum[Math.min(15, Math.floor(vv * 16)) * 16 + Math.min(15, Math.floor(uu * 16))]; c++; } return c ? s / c : 0.3; };
      const sides = { top: [] as Hit[], bottom: [] as Hit[], left: [] as Hit[], right: [] as Hit[] };
      for (const h of hs) {
        const cy = h.b.y + h.b.h / 2, cx = h.b.x + h.b.w / 2;
        const narrow = h.b.w < ib.w * 0.42;
        if (narrow && ib.w > ib.h * 0.9 && (cx < ib.x + ib.w * 0.35 || cx > ib.x + ib.w * 0.65)) (cx < ib.x + ib.w / 2 ? sides.left : sides.right).push(h);
        else (cy > ib.y + ib.h / 2 ? sides.bottom : sides.top).push(h);
      }
      const bi = ctx.nodes.indexOf(img);
      let ins = 0;
      for (const [side, list] of Object.entries(sides) as [keyof typeof sides, Hit[]][]) {
        if (!list.length) continue;
        const ub = union(list.map((h) => h.b));
        const d = Math.max(...list.map((h) => h.d));
        const L = lumAt(ub);
        const dark = L < 0.45;
        const col = dark ? ctx.pal.dark : ctx.pal.light;
        const amax = Math.min(0.88, (dark ? 0.62 : 0.55) + 0.3 * Math.min(1, (d - 0.36) / 0.4));
        const pad = u * 5;
        let rect: Box, fill: string;
        if (side === 'bottom') { const y0 = Math.max(ib.y, ub.y - ub.h * 0.6 - pad); rect = { x: ib.x, y: y0, w: ib.w, h: ib.y + ib.h - y0 }; fill = `lg(90,${col},0,${col},${(amax * 0.85).toFixed(2)},${col},${amax.toFixed(2)})`; }
        else if (side === 'top') { const y1 = Math.min(ib.y + ib.h, ub.y + ub.h * 1.6 + pad); rect = { x: ib.x, y: ib.y, w: ib.w, h: y1 - ib.y }; fill = `lg(90,${col},${amax.toFixed(2)},${col},${(amax * 0.85).toFixed(2)},${col},0)`; }
        else if (side === 'left') { const x1 = Math.min(ib.x + ib.w, ub.x + ub.w * 1.5 + pad); rect = { x: ib.x, y: ib.y, w: x1 - ib.x, h: ib.h }; fill = `lg(0,${col},${amax.toFixed(2)},${col},${(amax * 0.85).toFixed(2)},${col},0)`; }
        else { const x0 = Math.max(ib.x, ub.x - ub.w * 0.5 - pad); rect = { x: x0, y: ib.y, w: ib.x + ib.w - x0, h: ib.h }; fill = `lg(0,${col},0,${col},${(amax * 0.85).toFixed(2)},${col},${amax.toFixed(2)})`; }
        const sc: RectNode = { kind: 'rect', id: ctx.id('scrim'), layer: img.layer, tag: 'scrim', ...rect, fill, clip: img.clip };
        ctx.nodes.splice(bi + 1 + ins, 0, sc); ins++;
        for (const h of list) for (const t of h.cl) t.fill = ctx.textColor(col, t.size);
        rep.scrims++;
      }
    }
  }

  // ---- 6. protect the subject: flat colour cells drawn over a subject's head are lifted (faces are never boxed out)
  if (ctx.on('images')) {
    const assets = new Map(ctx.images.map((a) => [a.id, a] as [string, ImageAsset]));
    ctx.nodes.forEach((n, i) => {
      if (n.kind !== 'image' || n.cutout || removed.has(n)) return;
      const hd = protectBox(n, assets.get(n.imageId));
      if (!hd) return;
      const txt = body().map((t) => t.box);
      for (const z of ctx.nodes.slice(i + 1)) {
        if (z.kind !== 'rect' || z.layer !== 'zones' || removed.has(z) || (z.opacity ?? 1) < 0.5 || z.w * z.h > W * H * 0.3) continue;
        const ov = interArea(z, hd);
        if (ov < Math.min(z.w * z.h, hd.w * hd.h) * 0.3) continue;
        if (txt.some((t) => interArea(t, z) > t.w * t.h * 0.5)) continue; // a text cell keeps its ground
        removed.add(z); rep.decorDropped++;
      }
    });
  }

  // ---- 7. colour proportion: accent-filled zones above ~15 % of the canvas become the secondary colour
  // phase 15: only an opponent accent is limited, with the shared cap (color/accent.ts); a same-family spot colour stays
  if (!ctx.mode('clash') && !ctx.mode('experimental') && isOpponentAccent(ctx.pal.accent, ctx.pal.bg)) {
    const acc = ctx.pal.accent;
    const zones = ctx.nodes.filter((n): n is RectNode => n.kind === 'rect' && (n.layer === 'zones' || n.layer === 'band') && !removed.has(n) && typeof n.fill === 'string' && !n.fill.startsWith('lg(') && deltaE(n.fill, acc) < 6 && (n.opacity ?? 1) > 0.6);
    let area = zones.reduce((s, z) => s + z.w * z.h, 0) / (W * H);
    const alt = deltaE(ctx.pal.alt, ctx.pal.bg) > 10 ? ctx.pal.alt : relLum(ctx.pal.bg) > 0.4 ? ctx.pal.dark : ctx.pal.light;
    for (const z of zones.sort((a, b) => b.w * b.h - a.w * a.h)) {
      if (area <= ACCENT_CAP) break;
      const old = z.fill;
      z.fill = alt; area -= (z.w * z.h) / (W * H); rep.recolored++;
      // text sitting on that zone keeps its contrast (polish re-checks after)
      for (const t of body()) if (interArea(t.box, z) > t.box.w * t.box.h * 0.6 && deltaE(t.fill, old) > 1) t.fill = ctx.textColor(alt, t.size);
    }
  }

  if (removed.size) ctx.nodes = ctx.nodes.filter((n) => !removed.has(n));
  return rep;
}
