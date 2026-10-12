// Phase 11: strict geometric hard gates on the laid-out text (the user's "detail failures": overlapping text, text out
// of bounds, unreasonable padding, near-miss alignment). Works on any box map: the engine's measured boxes (n.box,
// measured with the real font metrics) during generation, or DOM-rendered bounding boxes in the headless audit
// (scripts/qa/geo-audit.mjs). Declared intentional overlaps (scene.info.sem breaks: overlap / interleave) are exempt.
import type { Scene, SceneNode, TextNode } from '../types';

export interface Box { x: number; y: number; w: number; h: number }
export interface GeoIssue { kind: 'collide' | 'bleed' | 'padding' | 'panel' | 'align'; a: string; b?: string; v: number }
export interface GeoReport { fails: GeoIssue[]; soft: GeoIssue[] }

const inter = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** text that is read (not texture / ghost / watermark / glyph art) */
export function readText(n: TextNode) {
  if (n.layer !== 'text' && n.layer !== 'sidebar' && n.layer !== 'band') return false;
  if ((n.opacity ?? 1) < 0.45 || n.role === 'glyph' || n.tag === 'anchor' || n.tag === 'ghost') return false;
  if (!n.lines.length || !n.lines.some((l) => l.text.trim())) return false;
  if (n.fill === 'none' && !n.stroke) return false;
  return true;
}

function flatten(ns: SceneNode[], out: SceneNode[] = []) {
  for (const n of ns) { if (n.kind === 'group') { if (!(n as { transform?: string }).transform) flatten(n.children, out); } else out.push(n); }
  return out;
}

export function geoGates(scene: Scene, boxes?: Map<string, Box>): GeoReport {
  const { w: W, h: H } = scene;
  const u = Math.min(W, H) / 100;
  const all = flatten(scene.nodes);
  const texts = all.filter((n): n is TextNode => n.kind === 'text' && readText(n as TextNode) && !(n as TextNode).rotate);
  const box = (t: TextNode) => boxes?.get(t.id) ?? t.box;
  const sem = scene.info.sem as { breaks?: { kind: string; nodes: string[] }[] } | undefined;
  const lic = new Set<string>();
  for (const b of sem?.breaks ?? []) if (b.kind === 'overlap' || b.kind === 'interleave') for (const x of b.nodes) for (const y of b.nodes) lic.add(x + '|' + y);
  const fails: GeoIssue[] = [], soft: GeoIssue[] = [];
  // 1. collisions: two read text boxes overlapping by more than a sliver (ascender / descender slack is 12 % of the
  // smaller line height; boxes are ink-ish line boxes)
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (lic.has(a.id + '|' + b.id)) continue;
    const A = box(a), B = box(b);
    const sh = Math.min(A.h, B.h) * 0.12;
    const As = { x: A.x, y: A.y + sh, w: A.w, h: Math.max(0, A.h - 2 * sh) }, Bs = { x: B.x, y: B.y + sh, w: B.w, h: Math.max(0, B.h - 2 * sh) };
    const ov = inter(As, Bs);
    const small = Math.min(As.w * As.h, Bs.w * Bs.h);
    if (small > 0 && ov / small > 0.04) fails.push({ kind: 'collide', a: a.id, b: b.id, v: +(ov / small).toFixed(3) });
  }
  // 2. bleed: text off the canvas. Display type larger than 12u may bleed on purpose (declared by its size); anything
  // smaller must stay on the page
  for (const t of texts) {
    const B = box(t);
    const out = Math.max(0, -B.x, B.x + B.w - W, -B.y, B.y + B.h - H);
    if (out > 1.5 && t.role !== 'band' && !(t.size > u * 12 && out < Math.max(B.w, B.h) * 0.45)) fails.push({ kind: 'bleed', a: t.id, v: +(out / u).toFixed(2) });
    // (role band = a running ticker: it bleeds by design)
    // 3. padding to the canvas edge for running / small text: below 1.5u fails, below 2u is soft
    else if (t.size < u * 6 && out <= 1.5) {
      const pad = Math.min(B.x, W - B.x - B.w, B.y, H - B.y - B.h);
      if (pad < 1.5 * u) fails.push({ kind: 'padding', a: t.id, v: +(pad / u).toFixed(2) });
      else if (pad < 2 * u) soft.push({ kind: 'padding', a: t.id, v: +(pad / u).toFixed(2) });
    }
  }
  // 4. panels: text that straddles the edge of a filled panel it starts in, or sits closer than 1u to that edge
  const panels = all.filter((n) => n.kind === 'rect' && n.layer !== 'bg' && (n.opacity ?? 1) > 0.6 && n.w * n.h > W * H * 0.02 && n.w < W * 0.98 && n.h < H * 0.98) as { id: string; x: number; y: number; w: number; h: number }[];
  for (const t of texts) {
    if (t.size > u * 12) continue;
    const B = box(t);
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    for (const p of panels) {
      if (cx < p.x || cx > p.x + p.w || cy < p.y || cy > p.y + p.h) continue;
      const pad = Math.min(B.x - p.x, p.x + p.w - B.x - B.w, B.y - p.y, p.y + p.h - B.y - B.h);
      if (pad < -0.5 * u) fails.push({ kind: 'panel', a: t.id, b: p.id, v: +(pad / u).toFixed(2) });
      else if (pad < 0.8 * u) soft.push({ kind: 'panel', a: t.id, b: p.id, v: +(pad / u).toFixed(2) });
    }
  }
  // 5. near-miss alignment: two start-anchored text left edges 0.25u–1.2u apart look like a mistake (snap or separate)
  const lefts = texts.filter((t) => t.anchor === 'start' && t.size < u * 8).map((t) => ({ id: t.id, x: box(t).x }));
  for (let i = 0; i < lefts.length; i++) for (let j = i + 1; j < lefts.length; j++) {
    const d = Math.abs(lefts[i].x - lefts[j].x);
    if (d > 0.25 * u && d < 1.2 * u) soft.push({ kind: 'align', a: lefts[i].id, b: lefts[j].id, v: +(d / u).toFixed(2) });
  }
  return { fails, soft };
}

/** layout repair before gating: small running text closer than 2u to the canvas edge moves inward to 2u, unless the move
 * would make it collide with another text (then the gate decides) */
export function safeArea(scene: Scene): number {
  const { w: W, h: H } = scene;
  const u = Math.min(W, H) / 100;
  const texts = flatten(scene.nodes).filter((n): n is TextNode => n.kind === 'text' && readText(n as TextNode) && !(n as TextNode).rotate && !(n as TextNode).vertical);
  const min = 2 * u;
  let moved = 0;
  for (const t of texts) {
    if (t.size >= u * 6 || t.clip) continue;
    const B = t.box;
    if (B.x < -1 || B.y < -1 || B.x + B.w > W + 1 || B.y + B.h > H + 1) continue;
    let dx = 0, dy = 0;
    if (B.x < min) dx = min - B.x; else if (W - B.x - B.w < min) dx = W - B.x - B.w - min;
    if (B.y < min) dy = min - B.y; else if (H - B.y - B.h < min) dy = H - B.y - B.h - min;
    if (!dx && !dy) continue;
    if (Math.abs(dx) > u * 1.5 || Math.abs(dy) > u * 1.5) continue; // a larger move is a layout decision, not a nudge
    const nb = { x: B.x + dx, y: B.y + dy, w: B.w, h: B.h };
    const hit = texts.some((o) => o !== t && inter(nb, o.box) > 0.04 * Math.min(nb.w * nb.h, o.box.w * o.box.h) && inter(B, o.box) <= 0.04 * Math.min(B.w * B.h, o.box.w * o.box.h));
    if (hit) continue;
    t.box = nb; t.lines = t.lines.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }));
    moved++;
  }
  return moved;
}
