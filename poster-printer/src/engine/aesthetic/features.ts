// Fast scene-graph features for the learned taste score (no pixels: everything comes from the scene the generator built).
import type { Scene, SceneNode, TextNode } from '../types';
import { relLum, wcag } from '../color/contrast';
import { hexToOklch } from '../color/oklch';
import { gates } from './gates';
import { IDEA_IDS } from '../gen/ideas';
import { ITTEN } from '../color/itten';

export const COMP_KEYS = ['layered', 'split', 'checker', 'fullbleed', 'giant', 'partition', 'cards', 'fan', 'typefill', 'swiss', 'centered', 'bands', 'typo', 'edge', 'ghost', 'bento', 'veil', 'mosaic', 'inset', 'cover', 'index', 'echo', 'knockout', 'vertical', 'quote', 'ring', 'poster', 'gallery', 'stack'];
// (object / panorama are new in phase 6: no training labels yet, so they carry no one-hot and are scored by structure alone)
/** phase 7: compositions added after the phase-6 training sets (one-hots, so future ratings can teach the model about them) */
export const COMP_KEYS_7 = ['object', 'panorama', 'ma', 'substitute', 'hanzi', 'anomaly', 'calendar', 'window'];

function flat(nodes: SceneNode[], out: SceneNode[] = []): SceneNode[] {
  for (const n of nodes) { if (n.kind === 'group') flat(n.children, out); else out.push(n); }
  return out;
}
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const chroma = (c: string) => (isHex(c) ? hexToOklch(c)[1] : 0);

/** Feature vector as a name→value record; the model reads it by FEATURE_NAMES order. */
export function sceneFeatures(scene: Scene): Record<string, number> {
  const W = scene.w, H = scene.h, A = W * H, u = Math.min(W, H) / 100;
  const ns = flat(scene.nodes);
  const texts = ns.filter((n): n is TextNode => n.kind === 'text');
  const imgs = ns.filter((n) => n.kind === 'image') as Extract<SceneNode, { kind: 'image' }>[];
  const bg = isHex(scene.bg) ? scene.bg : '#ffffff';
  const f: Record<string, number> = {};
  f.aspect = Math.log(W / H);
  f.wide = W / H > 1.5 ? 1 : 0;
  const comp = String(scene.info?.comp ?? '');
  for (const c of COMP_KEYS) f['c_' + c] = comp === c ? 1 : 0;
  // ---- type
  const sizes = texts.map((t) => t.size).sort((a, b) => b - a);
  const big = texts.reduce<TextNode | null>((m, t) => (!m || t.size > m.size ? t : m), null);
  f.nText = texts.length;
  f.chars = texts.reduce((s, t) => s + (t.raw?.length ?? 0), 0);
  f.zhShare = f.chars ? texts.reduce((s, t) => s + (t.lang === 'zh' ? t.raw.length : 0), 0) / f.chars : 0;
  f.headSize = sizes[0] ? sizes[0] / Math.min(W, H) : 0;
  f.hier = sizes[1] ? sizes[0] / sizes[1] : 4;
  f.hier3 = sizes[2] ? sizes[1] / sizes[2] : 2;
  f.smallCount = texts.filter((t) => t.size < u * 1.6).length;
  f.families = new Set(texts.map((t) => t.family)).size;
  f.weights = new Set(texts.map((t) => t.weight)).size;
  f.headLines = big ? big.lines.length : 0;
  f.headW = big ? Math.min(2, big.box.w / W) : 0;
  f.headH = big ? Math.min(2, big.box.h / H) : 0;
  f.headArea = big ? Math.min(2, (big.box.w * big.box.h) / A) : 0;
  f.headCy = big ? (big.box.y + big.box.h / 2) / H : 0.5;
  f.headCx = big ? (big.box.x + big.box.w / 2) / W : 0.5;
  f.headBleed = big ? ((big.box.x < 1 ? 1 : 0) + (big.box.x + big.box.w > W - 1 ? 1 : 0) + (big.box.y < 1 ? 1 : 0) + (big.box.y + big.box.h > H - 1 ? 1 : 0)) : 0;
  f.headContrast = big && isHex(big.fill) ? Math.min(21, wcag(big.fill, bg)) : 0;
  f.headStroke = big && big.stroke ? 1 : 0;
  f.headVertical = big && (big.vertical || big.rotate) ? 1 : 0;
  f.headWeight = big ? big.weight / 900 : 0;
  f.textArea = texts.reduce((s, t) => s + t.box.w * t.box.h, 0) / A;
  const lefts = new Set(texts.filter((t) => t.anchor === 'start').map((t) => Math.round(t.box.x / (u * 2))));
  f.alignCols = lefts.size;
  f.alignRatio = texts.length ? lefts.size / texts.length : 0;
  f.offCanvasText = texts.filter((t) => t.box.x + t.box.w < 0 || t.box.x > W || t.box.y > H || t.box.y + t.box.h < 0).length;
  f.minMargin = texts.length ? Math.min(...texts.filter((t) => t !== big).map((t) => Math.min(t.box.x, t.box.y, W - t.box.x - t.box.w, H - t.box.y - t.box.h)), 99 * u) / u : 0;
  f.outlineText = texts.filter((t) => t.stroke && (!t.fill || t.fill === 'none')).length;
  // ---- images
  f.nImg = imgs.length;
  const iA = imgs.map((i) => (Math.max(0, Math.min(W, i.x + i.w) - Math.max(0, i.x)) * Math.max(0, Math.min(H, i.y + i.h) - Math.max(0, i.y))) / A);
  f.imgMax = iA.length ? Math.max(...iA) : 0;
  f.imgSum = Math.min(2, iA.reduce((s, v) => s + v, 0));
  f.cutout = imgs.some((i) => i.cutout) ? 1 : 0;
  f.imgClip = imgs.filter((i) => i.clip).length;
  f.imgGray = imgs.filter((i) => i.filter?.grayscale || i.filter?.duotone).length;
  f.halftone = imgs.some((i) => i.halftone) ? 1 : 0;
  // ---- shapes / decoration
  const deco = ns.filter((n) => n.layer === 'ornament' || n.layer === 'noise' || n.layer === 'curves');
  f.nDeco = deco.length;
  f.nLines = ns.filter((n) => n.kind === 'line').length;
  f.nRects = ns.filter((n) => n.kind === 'rect').length;
  f.nPaths = ns.filter((n) => n.kind === 'path').length;
  f.nCircles = ns.filter((n) => n.kind === 'circle').length;
  f.nNodes = ns.length;
  // ---- colour
  const fills = new Set<string>();
  for (const n of ns) { const c = (n as { fill?: string }).fill; if (isHex(c) && n.kind !== 'text') fills.add(c.toLowerCase()); }
  f.fills = fills.size;
  f.bgLum = relLum(bg);
  f.bgChroma = chroma(bg);
  const pal = scene.palette as unknown as Record<string, string>;
  f.accChroma = isHex(pal?.accent) ? chroma(pal.accent) : 0;
  f.accContrast = isHex(pal?.accent) ? Math.min(21, wcag(pal.accent, bg)) : 0;
  const hues = [...fills].map((c) => hexToOklch(c)).filter((l) => l[1] > 0.05).map((l) => l[2]);
  let spread = 0;
  for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) { const d = Math.abs(hues[i] - hues[j]) % 360; spread = Math.max(spread, Math.min(d, 360 - d)); }
  f.hueSpread = spread / 180;
  // ---- space: coverage of a coarse occupancy raster (text + images + zone rects that are not the background)
  const G = 24, cells = new Uint8Array(G * G);
  const mark = (x: number, y: number, w: number, h: number, v: number) => {
    const x0 = Math.max(0, Math.floor((x / W) * G)), x1 = Math.min(G - 1, Math.floor(((x + w) / W) * G));
    const y0 = Math.max(0, Math.floor((y / H) * G)), y1 = Math.min(G - 1, Math.floor(((y + h) / H) * G));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) cells[yy * G + xx] |= v;
  };
  for (const t of texts) mark(t.box.x, t.box.y, t.box.w, t.box.h, 1);
  for (const i of imgs) mark(i.x, i.y, i.w, i.h, 2);
  for (const n of ns) if (n.kind === 'rect' && n.id !== 'bg' && n.w * n.h > A * 0.02 && n.w * n.h < A * 0.95) mark(n.x, n.y, n.w, n.h, 4);
  let occ = 0, tOcc = 0, mx = 0, my = 0, quads = [0, 0, 0, 0];
  for (let i = 0; i < G * G; i++) if (cells[i]) { occ++; const x = i % G, y = Math.floor(i / G); mx += x; my += y; quads[(x < G / 2 ? 0 : 1) + (y < G / 2 ? 0 : 2)]++; if (cells[i] & 1) tOcc++; }
  f.occupied = occ / (G * G);
  f.textOcc = tOcc / (G * G);
  f.balX = occ ? Math.abs(mx / occ / (G - 1) - 0.5) : 0;
  f.balY = occ ? Math.abs(my / occ / (G - 1) - 0.5) : 0;
  f.emptyQuads = quads.filter((q) => q < (G * G) / 4 * 0.08).length;
  // ---- generator's own measurements
  const info = (scene.info ?? {}) as Record<string, any>;
  f.qScore = Number(info.score ?? 90) / 100;
  const d = info.direction ?? {};
  f.dDemoted = Number(d.demoted ?? 0); f.dDropped = Number(d.dropped ?? 0); f.dScrims = Number(d.scrims ?? 0); f.dRecolored = Number(d.recolored ?? 0);
  const pl = info.plan ?? {};
  f.typeOnly = pl.typeOnly ? 1 : 0;
  f.grain = Number(pl.grain ?? 0) > 0 ? 1 : 0;
  f.mono = pl.palette === 'mono' ? 1 : 0;
  f.clash = pl.palette === 'clash' ? 1 : 0;
  f.geometry = pl.geometry && pl.geometry !== 'none' ? 1 : 0;
  f.material = pl.material && pl.material !== 'none' ? 1 : 0;
  f.kitN = Array.isArray(pl.kit) ? pl.kit.length : 0;
  f.texture = scene.texture && scene.texture.amount > 0 ? 1 : 0;
  // ---- phase 7: idea layer, Itten contrast, gate measurements, Ngo-style layout measures
  for (const c of COMP_KEYS_7) f['c_' + c] = comp === c ? 1 : 0;
  const idea = (info.idea ?? {}) as { id?: string; contrast?: string };
  for (const i of IDEA_IDS) f['i_' + i] = idea.id === i ? 1 : 0;
  for (const k of ITTEN) f['k_' + k] = idea.contrast === k ? 1 : 0;
  const g = gates(scene);
  f.gFills = g.flatFills; f.gLoud = g.loud; f.gHueFam = g.hueFam; f.gAccent = g.accent; f.gTone = g.toneBand; f.gHeroDL = g.heroDL / 100;
  f.gThumb = Math.min(20, g.thumbCap); f.gThumbOK = g.thumbOK ? 1 : 0; f.gCentroid = g.centroid; f.gNearMiss = Math.min(8, g.nearMiss);
  f.gHard = g.fails.length; f.gSoft = g.soft.length;
  // Ngo et al. (2003) on element boxes: balance (area × lever arm, left/right & top/bottom), equilibrium (area centroid),
  // symmetry (mirror of box centres), density (share of the canvas covered by elements)
  const els = [...texts.map((t) => t.box), ...imgs.map((i) => ({ x: Math.max(0, i.x), y: Math.max(0, i.y), w: Math.min(W, i.x + i.w) - Math.max(0, i.x), h: Math.min(H, i.y + i.h) - Math.max(0, i.y) }))].filter((b) => b.w > 0 && b.h > 0);
  let wl = 0, wr = 0, wt = 0, wb = 0, ax = 0, ay = 0, at = 0, sym = 0;
  for (const b of els) {
    const a = b.w * b.h, cx = b.x + b.w / 2 - W / 2, cy = b.y + b.h / 2 - H / 2;
    if (cx < 0) wl += a * -cx; else wr += a * cx;
    if (cy < 0) wt += a * -cy; else wb += a * cy;
    ax += a * cx; ay += a * cy; at += a;
  }
  for (const b of els) { const cx = b.x + b.w / 2 - W / 2; const mirror = els.some((o) => o !== b && Math.abs(o.x + o.w / 2 - W / 2 + cx) < u * 3 && Math.abs(o.y - b.y) < u * 3); if (mirror || Math.abs(cx) < u * 2) sym++; }
  f.ngoBalance = 1 - (Math.abs(wl - wr) / Math.max(wl, wr, 1) + Math.abs(wt - wb) / Math.max(wt, wb, 1)) / 2;
  f.ngoEquilibrium = at ? 1 - (Math.abs(ax / at) / (W / 2) + Math.abs(ay / at) / (H / 2)) / 2 : 1;
  f.ngoSymmetry = els.length ? sym / els.length : 0;
  f.ngoDensity = Math.min(1.5, at / A);
  return f;
}
export const FEATURE_NAMES = Object.keys(sceneFeatures({ w: 100, h: 100, bg: '#ffffff', nodes: [], palette: { accent: '#000000' } as never, info: {} }));
