// Phase 7 hard gates (AESTHETICS_RESEARCH.md §5): a coarse raster of the scene graph (64 px on the long side, the
// "thumbnail test") measured for colour economy, tone structure, hero contrast, readability and balance.
// Pure and deterministic: no pixels from the renderer; photos contribute their 16×16 luminance maps when known.
import type { Scene, SceneNode, TextNode, ImageNode, Shape } from '../types';
import { hexToOklab, hexToOklch } from '../color/oklch';
import { imageDrawRect } from '../render/svg';
import { ACCENT_CAP, isOpponentAccent } from '../color/accent';

export interface GateAsset { id: string; palette?: string[]; lum?: number[]; lumW?: number; lumH?: number }
export interface GateReport {
  /** distinct flat (non-text, non-photo) colours covering ≥1 % of the canvas */
  flatFills: number;
  /** distinct loud colours (OKLCH C > 0.12) anywhere outside photos */
  loud: number;
  /** core hue families among flat fills ≥1 % and text inks (C > 0.05; hues within 60° merge) — art-kb R1 */
  hueFam: number;
  /** style family the thresholds are read from (art-kb R0/R5/R14): centered, minimal, hero or editorial */
  gStyle: GateStyle;
  /** share of the canvas in the accent colour (when the accent is not the ground) */
  accent: number;
  /** share of the largest of three tone bands (dark / mid / light) */
  toneBand: number;
  /** headline ΔL against its ground (OKLab L × 100) */
  heroDL: number;
  /** headline cap height at a 64 px thumbnail (px); photos ≥ 4 % count as a readable hero too */
  thumbCap: number;
  thumbOK: boolean;
  /** visual-weight centroid offset from the centre, as a share of the half-diagonal-normalised canvas */
  centroid: number;
  /** element edges that almost (but not quite) line up */
  nearMiss: number;
  /** names of the failed hard rules (a draw that fails one is redrawn when the retry budget allows) */
  fails: string[];
  /** names of the failed soft rules (penalties only) */
  soft: string[];
}

export type GateStyle = 'centered' | 'minimal' | 'hero' | 'editorial';
/** composition → gate style. Ranges from /workspace/art-kb/knowledge/poster-aesthetics-01.md §6 (596 measured works) */
const GATE_STYLE: Record<string, GateStyle> = { quote: 'centered', ring: 'centered', centered: 'centered', fan: 'centered', ma: 'minimal', inset: 'minimal', fullbleed: 'hero', cover: 'hero', object: 'hero', window: 'hero', ghost: 'hero', hanzi: 'hero', giant: 'hero', substitute: 'hero', exhibit: 'minimal', interleave: 'hero', bleedgrid: 'hero' };
/** acceptable visual-centroid offset per style (R5): general 5–15 %, centred 0–5 %, minimal up to 35 % (we keep a margin) */
const CENTROID: Record<GateStyle, [number, number]> = { centered: [0, 0.07], minimal: [0.03, 0.35], hero: [0.02, 0.2], editorial: [0.04, 0.17] };
function hueFamilies(hexes: string[]): number {
  const hs = hexes.map(hexToOklch).filter((c) => c[1] > 0.05).map((c) => ((c[2] % 360) + 360) % 360).sort((a, b) => a - b);
  if (!hs.length) return 0;
  // circular single-link clustering: a gap > 60° starts a new family
  let fam = 0;
  for (let i = 0; i < hs.length; i++) { const next = i + 1 < hs.length ? hs[i + 1] : hs[0] + 360; if (next - hs[i] > 60) fam++; }
  return Math.max(1, fam);
}
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
type Lab = [number, number, number];
const dE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function flat(nodes: SceneNode[], out: SceneNode[] = []): SceneNode[] {
  for (const n of nodes) { if (n.kind === 'group') flat(n.children, out); else out.push(n); }
  return out;
}

/** polygon of a path made only of M/L/H/V/Z commands; null for curves (sampled by bbox at half weight) */
function poly(d: string): { pts: [number, number][][]; box: [number, number, number, number] } | null {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const rings: [number, number][][] = []; let cur: [number, number][] = [];
  let x = 0, y = 0, cmd = '', curved = false;
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    switch (cmd) {
      case 'M': x = num(); y = num(); if (cur.length) rings.push(cur); cur = [[x, y]]; cmd = 'L'; break;
      case 'm': x += num(); y += num(); if (cur.length) rings.push(cur); cur = [[x, y]]; cmd = 'l'; break;
      case 'L': x = num(); y = num(); cur.push([x, y]); break;
      case 'l': x += num(); y += num(); cur.push([x, y]); break;
      case 'H': x = num(); cur.push([x, y]); break;
      case 'h': x += num(); cur.push([x, y]); break;
      case 'V': y = num(); cur.push([x, y]); break;
      case 'v': y += num(); cur.push([x, y]); break;
      case 'Z': case 'z': if (cur.length) rings.push(cur); cur = []; break;
      default: {
        // curves: keep the end points (control points bound the hull) and flag for a softer weight
        curved = true;
        const n = /[Cc]/.test(cmd) ? 6 : /[SsQq]/.test(cmd) ? 4 : /[Aa]/.test(cmd) ? 7 : 2;
        const v: number[] = []; for (let k = 0; k < n && i < tok.length && !/[a-zA-Z]/.test(tok[i]); k++) v.push(num());
        if (v.length < 2) { i++; break; }
        const rel = cmd === cmd.toLowerCase();
        const ex = v[v.length - 2], ey = v[v.length - 1];
        x = rel ? x + ex : ex; y = rel ? y + ey : ey; cur.push([x, y]);
      }
    }
  }
  if (cur.length) rings.push(cur);
  if (!rings.length) return null;
  // a 40-cell raster needs no more than ~200 vertices per ring (brush masks carry thousands)
  for (let k = 0; k < rings.length; k++) { const r = rings[k]; if (r.length > 200) { const st = r.length / 200; rings[k] = Array.from({ length: 200 }, (_, j) => r[Math.floor(j * st)]); } }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [px, py] of r) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  void curved;
  return { pts: rings, box: [x0, y0, x1, y1] };
}
function inPoly(rings: [number, number][][], x: number, y: number) {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const polyCache = new Map<string, ReturnType<typeof poly>>();
const getPoly = (d: string) => { let p = polyCache.get(d); if (p === undefined) { p = poly(d); if (polyCache.size > 2000) polyCache.clear(); polyCache.set(d, p); } return p; };

/** even-odd scanline fill of a polygon at cell centres: one pass over the edges per row instead of per cell */
function polyMask(rings: [number, number][][], GX: number, GY: number, W: number, H: number): Uint8Array {
  const m = new Uint8Array(GX * GY);
  for (let j = 0; j < GY; j++) {
    const y = ((j + 0.5) / GY) * H; const xs: number[] = [];
    for (const r of rings) for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
      const [xi, yi] = r[i], [xk, yk] = r[k];
      if ((yi > y) !== (yk > y)) xs.push(((xk - xi) * (y - yi)) / (yk - yi) + xi);
    }
    if (!xs.length) continue;
    xs.sort((a, b) => a - b);
    let c = 0;
    for (let i = 0; i < GX; i++) { const x = ((i + 0.5) / GX) * W; while (c < xs.length && xs[c] <= x) c++; if (c % 2) m[j * GX + i] = 1; }
  }
  return m;
}

function inShape(s: Shape | undefined, x: number, y: number): boolean {
  if (!s) return true;
  switch (s.type) {
    case 'rect': return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    case 'circle': return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    case 'path': { const p = getPoly(s.d); return p ? inPoly(p.pts, x, y) : true; }
    case 'union': return s.shapes.some((t) => inShape(t, x, y));
    case 'text': return true;
  }
}

/** colour of node n at (x, y) as [OKLab, alpha], or null when the point is outside */
function sample(n: SceneNode, x: number, y: number, assets: Map<string, GateAsset> | undefined): { lab: Lab; a: number; hex?: string } | null {
  if (!inShape(n.clip, x, y)) return null;
  const op = n.opacity ?? 1;
  switch (n.kind) {
    case 'rect': if (!isHex(n.fill) || x < n.x || x > n.x + n.w || y < n.y || y > n.y + n.h) return null; return { lab: labOf(n.fill), a: op, hex: n.fill };
    case 'circle': if (!isHex(n.fill) || (x - n.cx) ** 2 + (y - n.cy) ** 2 > n.r * n.r) return null; return { lab: labOf(n.fill), a: op, hex: n.fill };
    case 'path': {
      if (!isHex(n.fill)) return null;
      const p = getPoly(n.d); if (!p) return null;
      const [x0, y0, x1, y1] = p.box; if (x < x0 || x > x1 || y < y0 || y > y1) return null;
      return inPoly(p.pts, x, y) ? { lab: labOf(n.fill), a: op, hex: n.fill } : null;
    }
    case 'image': {
      const im = n as ImageNode;
      if (x < im.x || x > im.x + im.w || y < im.y || y > im.y + im.h) return null;
      const as = assets?.get(im.imageId);
      let L = 0.6; let ab: [number, number] = [0, 0];
      if (as?.palette?.length) { const m = meanLab(as); L = m[0]; if (!im.filter?.grayscale && !im.filter?.duotone) ab = [m[1], m[2]]; }
      if (as?.lum && as.lumW && as.lumH) {
        const dr = imageDrawRect(im);
        const u = Math.min(as.lumW - 1, Math.max(0, Math.floor(((x - dr.x) / dr.w) * as.lumW)));
        const v = Math.min(as.lumH - 1, Math.max(0, Math.floor(((y - dr.y) / dr.h) * as.lumH)));
        L = Math.cbrt(Math.max(0, as.lum[v * as.lumW + u]));
      }
      if (im.filter?.duotone && isHex(im.filter.duotone[0]) && isHex(im.filter.duotone[1])) {
        const a = hexToOklab(im.filter.duotone[0]), b = hexToOklab(im.filter.duotone[1]);
        const t = Math.min(1, Math.max(0, L));
        return { lab: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], a: op };
      }
      let lab: Lab = [L, ab[0], ab[1]];
      if (im.overlay && isHex(im.overlay.color)) { const o = hexToOklab(im.overlay.color), k = im.overlay.opacity; lab = [lab[0] + (o[0] - lab[0]) * k, lab[1] + (o[1] - lab[1]) * k, lab[2] + (o[2] - lab[2]) * k]; }
      return { lab, a: op };
    }
    default: return null;
  }
}

function nodeBox(n: SceneNode): [number, number, number, number] | null {
  switch (n.kind) {
    case 'rect': case 'image': return [n.x, n.y, n.x + n.w, n.y + n.h];
    case 'circle': return [n.cx - n.r, n.cy - n.r, n.cx + n.r, n.cy + n.r];
    case 'path': { const p = getPoly(n.d); return p ? p.box : null; }
    default: return null;
  }
}
const meanCache = new WeakMap<GateAsset, Lab>();
const meanLab = (a: GateAsset): Lab => { let m = meanCache.get(a); if (!m) { const l = a.palette!.map(labOf); m = [0, 1, 2].map((k) => l.reduce((s, v) => s + v[k], 0) / l.length) as Lab; meanCache.set(a, m); } return m; };
const labCache = new Map<string, Lab>();
const labOf = (h: string): Lab => { let l = labCache.get(h); if (!l) { l = hexToOklab(h); if (labCache.size > 4000) labCache.clear(); labCache.set(h, l); } return l; };

/** Measure the gates on a scene. `assets` (image id → luminance map / palette) sharpens the photo regions. */
export function gates(scene: Scene, assets?: Map<string, GateAsset>): GateReport {
  const W = scene.w, H = scene.h, u = Math.min(W, H) / 100;
  const R = 40, long = Math.max(W, H), GX = Math.round((R * W) / long), GY = Math.round((R * H) / long);
  const ns = flat(scene.nodes);
  const texts = ns.filter((n): n is TextNode => n.kind === 'text' && !!n.lines?.length);
  const fills = ns.filter((n) => n.kind !== 'text' && n.kind !== 'line' && n.kind !== 'group' && n.layer !== 'noise' && n.layer !== 'texture');
  const bgHex = isHex(scene.bg) ? scene.bg.toLowerCase() : '#ffffff';
  const bgLab = hexToOklab(bgHex);
  const N = GX * GY;
  const ground: Lab[] = new Array(N);
  const owner: (string | null)[] = new Array(N); // flat hex that owns the cell (null = photo / blend)
  for (let k = 0; k < N; k++) { ground[k] = bgLab; owner[k] = bgHex; }
  // painter's order, each node only over the cells of its bounding box
  for (const n of fills) {
    if (n.id === 'bg') continue;
    const b = nodeBox(n);
    if (!b) continue;
    const i0 = Math.max(0, Math.floor((b[0] / W) * GX - 0.5)), i1 = Math.min(GX - 1, Math.ceil((b[2] / W) * GX - 0.5));
    const j0 = Math.max(0, Math.floor((b[1] / H) * GY - 0.5)), j1 = Math.min(GY - 1, Math.ceil((b[3] / H) * GY - 0.5));
    const pm = n.kind === 'path' && !n.clip && isHex(n.fill) ? getPoly(n.d) : null;
    const mask = pm ? polyMask(pm.pts, GX, GY, W, H) : null;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ((i + 0.5) / GX) * W, y = ((j + 0.5) / GY) * H;
      const s = mask ? (mask[j * GX + i] ? { lab: labOf((n as { fill: string }).fill), a: n.opacity ?? 1, hex: (n as { fill: string }).fill } : null) : sample(n, x, y, assets);
      if (!s) continue;
      const k = j * GX + i, lab = ground[k];
      if (s.a >= 0.98) { ground[k] = s.lab; owner[k] = s.hex ?? null; }
      else if (s.a > 0.02) { ground[k] = [lab[0] + (s.lab[0] - lab[0]) * s.a, lab[1] + (s.lab[1] - lab[1]) * s.a, lab[2] + (s.lab[2] - lab[2]) * s.a]; if (s.a >= 0.5) owner[k] = s.hex ?? null; }
    }
  }
  // text ink laid over the ground (coverage ≈ 0.3 body … 0.55 heavy display)
  const final: Lab[] = ground.map((l) => [...l] as Lab);
  const cellOf = (x: number, y: number) => { const i = Math.floor((x / W) * GX), j = Math.floor((y / H) * GY); return i >= 0 && j >= 0 && i < GX && j < GY ? j * GX + i : -1; };
  for (const t of texts) {
    const col = isHex(t.fill) ? t.fill : isHex(t.stroke) ? t.stroke! : null;
    if (!col) continue;
    const lab = hexToOklab(col), cov = Math.min(0.6, 0.25 + (t.weight / 900) * 0.3) * (t.opacity ?? 1) * (isHex(t.fill) ? 1 : 0.35);
    const b = t.box;
    for (let j = Math.max(0, Math.floor((b.y / H) * GY)); j <= Math.min(GY - 1, Math.floor(((b.y + b.h) / H) * GY)); j++)
      for (let i = Math.max(0, Math.floor((b.x / W) * GX)); i <= Math.min(GX - 1, Math.floor(((b.x + b.w) / W) * GX)); i++) {
        const k = j * GX + i; const g = final[k];
        final[k] = [g[0] + (lab[0] - g[0]) * cov, g[1] + (lab[1] - g[1]) * cov, g[2] + (lab[2] - g[2]) * cov];
      }
  }
  // ---- colour economy
  const area = new Map<string, number>();
  for (const o of owner) if (o) area.set(o, (area.get(o) ?? 0) + 1);
  const big = [...area.entries()].filter(([, v]) => v >= N * 0.01).map(([h]) => hexToOklab(h));
  const merged: Lab[] = [];
  for (const c of big) if (!merged.some((m) => dE(m, c) < 0.04)) merged.push(c);
  const flatFills = merged.length;
  const loudSet: Lab[] = [];
  const loudCands = [...area.entries()].filter(([, v]) => v >= N * 0.002).map(([h]) => h);
  for (const t of texts) if (isHex(t.fill)) loudCands.push(t.fill.toLowerCase());
  for (const h of loudCands) { if (hexToOklch(h)[1] <= 0.12) continue; const l = hexToOklab(h); if (!loudSet.some((m) => dE(m, l) < 0.06)) loudSet.push(l); }
  const loud = loudSet.length;
  const famHex = [...area.entries()].filter(([, v]) => v >= N * 0.01).map(([h]) => h);
  for (const t of texts) if (isHex(t.fill)) famHex.push(t.fill.toLowerCase());
  const hueFam = hueFamilies(famHex);
  const pal = scene.palette as unknown as Record<string, string>;
  let accent = 0;
  if (isHex(pal?.accent)) {
    const al = hexToOklab(pal.accent);
    // R2: only a CONTRASTING accent is limited (one outside the dominant hue family); a same-family accent is part of the field
    const dom = [...area.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? bgHex;
    const contrasting = isOpponentAccent(pal.accent, dom);
    if (contrasting && dE(al, bgLab) > 0.04) { let c = 0; for (let k = 0; k < N; k++) if (dE(ground[k], al) < 0.04) c++; accent = c / N; }
  }
  // ---- tone structure
  const bands = [0, 0, 0];
  for (const l of final) bands[l[0] < 0.45 ? 0 : l[0] < 0.75 ? 1 : 2]++;
  const toneBand = Math.max(...bands) / N;
  // ---- hero
  const hero = texts.reduce<TextNode | null>((m, t) => (!m || t.size * Math.sqrt(t.box.w * t.box.h) > m.size * Math.sqrt(m.box.w * m.box.h) ? t : m), null);
  let heroDL = 100, thumbCap = 0;
  if (hero) {
    const col = isHex(hero.fill) ? hero.fill : isHex(hero.stroke) ? hero.stroke! : null;
    if (col) {
      const L = hexToOklab(col)[0]; let s = 0, c = 0;
      const b = hero.box;
      for (const ln of hero.lines) for (let f = 0.15; f < 1; f += 0.2) {
        const y = ln.y - hero.size * 0.35; const x = b.x + b.w * f;
        const k = cellOf(x, y); if (k >= 0) { s += Math.abs(L - ground[k][0]); c++; }
      }
      heroDL = c ? (s / c) * 100 : 100;
    }
    thumbCap = (hero.size * (hero.lang === 'zh' ? 0.88 : 0.7) * 64) / long;
  }
  const imgs = ns.filter((n): n is ImageNode => n.kind === 'image');
  const imgHero = imgs.some((im) => {
    const vis = (Math.max(0, Math.min(W, im.x + im.w) - Math.max(0, im.x)) * Math.max(0, Math.min(H, im.y + im.h) - Math.max(0, im.y))) / (W * H);
    return vis >= 0.04 || (im.clip?.type === 'circle' && Math.PI * im.clip.r ** 2 >= W * H * 0.035);
  });
  const thumbOK = (thumbCap >= 3.5 && heroDL >= 25) || imgHero;
  // ---- balance: weight = distance from the ground tone (plus chroma)
  let sw = 0, mx = 0, my = 0;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const l = final[j * GX + i]; const w = Math.abs(l[0] - bgLab[0]) + Math.hypot(l[1] - bgLab[1], l[2] - bgLab[2]) * 0.8;
    sw += w; mx += w * ((i + 0.5) / GX); my += w * ((j + 0.5) / GY);
  }
  const centroid = sw > 1e-6 ? Math.hypot(mx / sw - 0.5, my / sw - 0.5) / Math.SQRT1_2 : 0;
  // ---- near misses: start/end edges of text blocks and image frames 0.4–1.5 u apart
  const xs: number[] = [], ys: number[] = [];
  for (const t of texts) { if (t.size > u * 20) continue; if (t.anchor === 'start' || !t.anchor) xs.push(t.box.x); else if (t.anchor === 'end') xs.push(t.box.x + t.box.w); ys.push(t.box.y); }
  for (const im of imgs) { if (im.x > 1 && im.x < W - 1) xs.push(im.x); if (im.x + im.w < W - 1 && im.x + im.w > 1) xs.push(im.x + im.w); if (im.y > 1) ys.push(im.y); }
  let nearMiss = 0;
  for (const arr of [xs]) for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) { const d = Math.abs(arr[a] - arr[b]); if (d > u * 0.4 && d < u * 1.5) nearMiss++; }
  void ys;
  const gStyle: GateStyle = GATE_STYLE[String((scene.info as { comp?: string } | undefined)?.comp ?? '')] ?? 'editorial';
  const fails: string[] = [];
  // hard: these four separate clearly in 1,210 rated posters (−0.36 mean rating when any fails, ~14 % of past draws)
  if (flatFills > 3) fails.push('fills');
  // art-kb R1: colour is limited by hue FAMILIES, not by high-chroma area (77 % of 596 measured works use ≤2)
  if (hueFam > 3) fails.push('hue');
  if (!thumbOK) fails.push('thumb');
  // soft (penalties): the research thresholds whose rating gap is small on our data
  const soft: string[] = [];
  if (hueFam === 3) soft.push('hue3');
  if (accent > ACCENT_CAP) soft.push('accent'); // R2, phase 15: one cap (15 %) for an opponent accent only (color/accent.ts)
  if (toneBand < 0.55) soft.push('tone');
  // headline ΔL is a soft, style-read score (low-key editorial work legitimately sits below 35)
  if (hero && heroDL < 20) soft.push('heroDL');
  // phase 15: 35 → 25. 白's U1: heroDL 25–35 averaged 7.62 (n=8) vs 7.28 at ≥35; ρ(heroDL, score) = −0.12. The id stays for logs.
  if (hero && heroDL < 25 && gStyle !== 'minimal') soft.push('heroDL35');
  const [c0, c1] = CENTROID[gStyle];
  if (centroid < c0 || centroid > c1) soft.push('centroid');
  // phase 15: near-misses showed no harm in 白's ratings (≥1: 7.46, n=41 vs 0: 7.25) — flagged from 3, penalised lightly
  if (nearMiss >= 3) soft.push('nearMiss');
  return { flatFills, loud, hueFam, gStyle, accent, toneBand, heroDL, thumbCap, thumbOK, centroid, nearMiss, fails, soft };
}

/** selector / retry penalty in taste points: a hard failure costs half a point, each soft one less than a tenth */
export function gatePenalty(g: GateReport): number {
  // R14 / §5: top editorial work has near-misses ≤10 % (vs ≈17 % for average) — a stronger penalty, except for hero styles
  const nm = g.gStyle === 'hero' ? 0.01 : 0.02; // phase 15: 0.05 / 0.02 → 0.02 / 0.01 pending an A/B (Ar't request 6)
  return 0.5 * g.fails.length + 0.08 * g.soft.length + nm * Math.min(5, g.nearMiss);
}
