// Design audit: measures a finished scene against docs/DESIGN_PRINCIPLES.md and returns a penalty (0…45) that the
// quality score subtracts. Pure function of the scene so it can also re-score older renders (scripts/qa).
import type { SceneNode, TextNode, ImageNode } from '../types';
import type { ImageAsset } from './ctx';
import type { Palette } from '../color/palette';
import { deltaE } from '../color/convert';
import { ACCENT_CAP, isOpponentAccent } from '../color/accent';
import { harmonyScore } from '../color/harmony';
import { union, interArea } from './quality';
import { textClusters, detailUnder, imageBox, decorItems, decorBox, protectBox } from './direction';

type Box = { x: number; y: number; w: number; h: number };
export interface AuditInput { nodes: SceneNode[]; W: number; H: number; palette: Palette; images: ImageAsset[]; comp?: string; hidden?: Set<string> }
export interface Audit {
  blocks: number; subject: number; focalRatio: number; sizes: number; align: number; quiet: number; decor: number; accent: number; busy: number; harmony: number;
  penalty: number; parts: Record<string, number>;
}

const isText = (n: SceneNode): n is TextNode => n.kind === 'text';
const visible = (t: TextNode) => t.lines.length > 0 && t.fill !== 'none' && t.raw !== '' && t.box.w > 0 && (t.opacity ?? 1) > 0.3;
const numeric = (t: TextNode) => /^[\d\s.\-/:№#]+$/.test(t.raw.trim());
const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export function designAudit(a: AuditInput): Audit {
  const { W, H } = a;
  const u = Math.min(W, H) / 100;
  const on = (n: SceneNode) => !a.hidden?.has(n.layer);
  const nodes = a.nodes.filter(on);
  const assets = new Map(a.images.map((x) => [x.id, x] as [string, ImageAsset]));
  const texts = nodes.filter(isText).filter((t) => (t.layer === 'text' || t.layer === 'sidebar') && visible(t) && !t.clip && !t.rotate && !t.vertical && t.role !== 'glyph');
  const wide = W / H > 1.5;
  // blocks
  // a typographic system (index rows, programme tables) counts as one block
  const sys = texts.filter((t) => t.tag === 'system');
  const cls = textClusters(texts.filter((t) => t.layer === 'text' && t.tag !== 'system'), u);
  if (sys.length) cls.push(sys);
  const isFrame = (cl: TextNode[]) => { const b = union(cl.map((t) => t.box)); return cl.every((t) => t.size <= u * 1.3) && (b.y < u * 9 || b.y + b.h > H - u * 9); };
  const frame = cls.filter(isFrame), blocks = cls.filter((c) => !isFrame(c));
  const nBlocks = blocks.length + (frame.length ? 1 : 0);
  // focal
  const sizes = texts.filter((t) => !numeric(t)).map((t) => t.size).sort((x, y) => y - x);
  const distinct: number[] = [];
  for (const s of sizes) if (!distinct.some((d) => Math.abs(Math.log(d / s)) < 0.04)) distinct.push(s);
  const focalRatio = distinct.length >= 2 ? distinct[0] / distinct[1] : 3;
  const bigImage = nodes.some((n) => n.kind === 'image' && (() => { const b = imageBox(n); return b.w * b.h > W * H * 0.25; })());
  const nSizes = distinct.filter((s) => s > u * 1.3).length;
  // alignment
  const edgesOf = (b: Box) => [b.x, b.x + b.w, b.x + b.w / 2];
  const refs: number[][] = [[], [], []];
  for (const n of nodes) {
    if ((n.kind === 'rect' && n.layer !== 'bg' && n.w * n.h > W * H * 0.01) || n.kind === 'image') { const b = n.kind === 'image' ? imageBox(n) : n; refs[0].push(b.x, b.x + b.w); refs[1].push(b.x, b.x + b.w); refs[2].push(b.x + b.w / 2); }
  }
  refs[2].push(W / 2);
  const bb = blocks.map((cl) => union(cl.map((t) => t.box)));
  let aligned = 0;
  bb.forEach((b, i) => {
    const e = edgesOf(b);
    const others = bb.filter((_, j) => j !== i).map(edgesOf);
    const ok = [0, 1, 2].some((k) => others.some((o) => Math.abs(o[k] - e[k]) < u * 0.7) || refs[k].some((r) => Math.abs(r - e[k]) < u * 0.7));
    if (ok) aligned++;
  });
  const align = bb.length ? aligned / bb.length : 1;
  // quiet + accent share (24×24 samples)
  const N = 24;
  let quiet = 0, accent = 0, flat = 0;
  const oppAcc = isOpponentAccent(a.palette.accent, a.palette.bg); // phase 15: same-family spot colours are not counted
  const textBoxes = texts.filter((t) => t.size > u * 1.3).map((t) => t.box);
  const decoBoxes = decorItems(nodes, a.comp ?? '').map((d) => decorBox(d.n)).filter(Boolean) as Box[];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = ((i + 0.5) / N) * W, y = ((j + 0.5) / N) * H;
    if (textBoxes.some((b) => inBox(b, x, y))) continue;
    if (decoBoxes.some((b) => b.w * b.h < W * H * 0.2 && inBox(b, x, y))) continue;
    let hit: SceneNode | null = null;
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k];
      if ((n.opacity ?? 1) < 0.5 && n.kind !== 'image') continue;
      if (n.kind === 'rect' && n.fill !== 'none' && inBox(n, x, y)) { hit = n; break; }
      if (n.kind === 'image' && inBox(imageBox(n), x, y)) { hit = n; break; }
      if (n.kind === 'circle' && n.fill && n.fill !== 'none' && (x - n.cx) ** 2 + (y - n.cy) ** 2 <= n.r * n.r) { hit = n; break; }
    }
    if (!hit || hit.kind === 'rect' || hit.kind === 'circle') {
      quiet++; flat++;
      const f = hit && 'fill' in hit ? (hit.fill as string) : a.palette.bg;
      if (f && !f.startsWith('lg(') && f !== 'none' && deltaE(f, a.palette.accent) < 8 && deltaE(a.palette.accent, a.palette.bg) > 8 && oppAcc) accent++;
    } else if (hit.kind === 'image') {
      const img = hit as ImageNode;
      if (detailUnder(img, assets.get(img.imageId), { x: x - W / N / 2, y: y - H / N / 2, w: W / N, h: H / N }) < 0.3) quiet++;
    }
  }
  const q = quiet / (N * N);
  const accentShare = accent / (N * N);
  // busy text: blocks on detailed image areas with nothing calming between image and type
  let busy = 0;
  for (const cl of cls) {
    const b = union(cl.map((t) => t.box));
    const ti = Math.min(...cl.map((t) => nodes.indexOf(t)));
    let img: ImageNode | null = null;
    for (let k = 0; k < ti; k++) { const n = nodes[k]; if (n.kind === 'image' && !n.cutout && n.clip?.type !== 'text' && (n.opacity ?? 1) > 0.6 && interArea(imageBox(n), b) > b.w * b.h * 0.5) img = n; }
    if (!img) continue;
    const ii = nodes.indexOf(img);
    const calmed = nodes.slice(ii + 1, ti).some((n) => n.kind === 'rect' && n.fill !== 'none' && interArea(n, b) > b.w * b.h * 0.5) || cl.some((t) => t.stroke);
    if (!calmed && detailUnder(img, assets.get(img.imageId), b) > 0.4) busy++;
  }
  // subject protection: big type or flat cells on top of a subject's head (non cut-out images)
  let subj = 0;
  nodes.forEach((n, i) => {
    if (n.kind !== 'image' || n.cutout) return;
    const hd = protectBox(n, assets.get(n.imageId));
    if (!hd) return;
    const A = hd.w * hd.h; if (A <= 0) return;
    for (const m of nodes.slice(i + 1)) {
      if (m.kind === 'text' && m.layer === 'text' && visible(m) && m.size > u * 2.5 && !m.clip) subj += Math.min(1, interArea(m.box, hd) / A) * 1.0;
      else if (m.kind === 'rect' && m.layer === 'zones' && (m.opacity ?? 1) > 0.5 && m.fill !== 'none' && !String(m.fill).startsWith('lg(')) subj += Math.min(1, interArea(m, hd) / A) * 0.6;
    }
  });
  const decor = decorItems(nodes, a.comp ?? '').reduce((s, d) => s + d.w, 0);
  // treatments stacked on the photos (duotone, grayscale, halftone, torn/shaped clips, cut-outs, overlays): > 2 reads as noise
  const tr = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'image' || n.tag === 'script') continue;
    if (n.filter?.duotone) tr.add('duotone');
    if (n.filter?.grayscale && !n.filter.duotone) tr.add('gray');
    if (n.halftone) tr.add('halftone');
    if (n.cutout) tr.add('cutout');
    if (n.overlay && n.overlay.opacity > 0.15) tr.add('overlay');
    if (n.clip?.type === 'path' && /L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L/.test(n.clip.d) && n.clip.d.length > 600) tr.add('torn');
    if (n.clip?.type === 'text') tr.add('typefill');
  }
  for (const n of nodes) if (n.kind === 'group' && n.clip?.type === 'union') tr.add('bands');
  const treatments = tr.size;
  // mid-size text levels (between labels and display): more than three reads as indecisive
  const mid = distinct.filter((s) => s > u * 2.2 && s < u * 7).length;
  // busy photo detail directly under XL type
  let busyXL = 0;
  for (const t of texts) {
    if (t.size < u * 9) continue;
    const ti = nodes.indexOf(t);
    for (let k = 0; k < ti; k++) { const n = nodes[k]; if (n.kind === 'image' && !n.cutout && (n.opacity ?? 1) > 0.6 && n.clip?.type !== 'text' && interArea(imageBox(n), t.box) > t.box.w * t.box.h * 0.4 && detailUnder(n, assets.get(n.imageId), t.box) > 0.42 && !t.stroke) { busyXL++; break; } }
  }
  const imgs = nodes.filter((n) => n.kind === 'image' && (n.opacity ?? 1) > 0.6);
  const harmony = harmonyScore(a.palette).score;
  const parts: Record<string, number> = {
    blocks: Math.max(0, nBlocks - (10 + (wide ? 1 : 0))) * 3, // phase 15: 8 → 10, follows the blockBudget default
    focal: (focalRatio < 1.5 ? (1.5 - focalRatio) * 24 : 0) + (distinct[0] < u * 4 && !bigImage ? 8 : 0),
    sizes: Math.max(0, nSizes - 6) * 1.5,
    align: bb.length >= 3 ? (1 - align) * 12 : 0,
    quiet: q < 0.3 ? (0.3 - q) * 50 : q > (imgs.length ? 0.86 : 0.96) ? (q - (imgs.length ? 0.86 : 0.96)) * 60 : 0,
    decor: Math.max(0, decor - 3) * 3,
    accent: Math.max(0, accentShare - ACCENT_CAP) * 50,
    busy: busy * 5,
    harmony: harmony < 0.6 ? (0.6 - harmony) * 25 : 0,
    subject: Math.min(15, subj * 18),
    treatments: Math.max(0, treatments - 2) * 4,
    midLevels: Math.max(0, mid - 3) * 2,
    busyXL: busyXL * 6,
  };
  void flat;
  const penalty = Math.min(45, Object.values(parts).reduce((s, v) => s + v, 0));
  return { blocks: nBlocks, subject: subj, focalRatio, sizes: nSizes, align, quiet: q, decor, accent: accentShare, busy, harmony, penalty, parts };
}
