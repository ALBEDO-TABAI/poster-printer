// Phase 12: optical weight and balance. Each block carries visual mass = ink coverage (stroke density from weight and
// family) × area × contrast with the ground; the poster's centre of visual mass (COM) is the mass-weighted centroid.
// An asymmetric poster is fine when its heavy mass is anchored (on a canvas edge / corner, or spanning the measure);
// a heavy block floating off-centre with only hairline text to answer it is "lopsided".
// Also: the weight-jump rule. Heavy display (≥ 700 or a black / condensed-black family) next to hairline info text
// (≤ 300) reads lopsided; the info is set at 400 (size trimmed so its measure does not change).
import type { Scene, SceneNode, TextNode } from '../types';
import type { Measurer } from '../text/measure';
import { readText } from './geo';

const HEAVY_FAM = /Anton|Bebas|Black|Ultra|Heavy|Alfa Slab|Abril|Bowlby|Big Shoulders|Dela Gothic|Unbounded|Smiley|Rubik Mono|Bungee|Titan|Archivo Black|Six Caps|League Gothic|ZCOOL QingKe/i;
export const effWeight = (t: { family: string; weight: number }) => (HEAVY_FAM.test(t.family) ? Math.max(t.weight, 800) : t.weight);
/** ink coverage of a set line (0..1): ~0.13 at 200, ~0.27 at 400, ~0.62 at 900 */
export const density = (w: number) => 0.12 + 0.5 * Math.pow(Math.max(100, Math.min(950, w)) / 900, 1.6);

const lum = (hex?: string) => { if (!hex || hex[0] !== '#') return null; const v = parseInt(hex.slice(1, 7), 16); const c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const flat = (ns: SceneNode[], out: SceneNode[] = []) => { for (const n of ns) { if (n.kind === 'group') { if (!n.transform) flat(n.children, out); } else out.push(n); } return out; };

export interface Mass { id: string; kind: string; m: number; x: number; y: number; box: { x: number; y: number; w: number; h: number } }
export interface Balance { dev: number; dx: number; dy: number; anchored: boolean; lopsided: boolean; heavy: string | null; jump: number }

export function masses(scene: Scene, measure?: Measurer): Mass[] {
  const { w: W, h: H } = scene; const bgL = lum(scene.bg) ?? 0.9;
  const con = (fill?: string) => { const l = lum(fill); return l === null ? 0.4 : Math.abs(l - bgL) * 0.85 + 0.15; };
  const out: Mass[] = [];
  for (const n of flat(scene.nodes)) {
    const op = n.opacity ?? 1; if (op < 0.2) continue;
    if (n.kind === 'text') {
      if (!readText(n) || n.rotate) continue;
      const d = density(effWeight(n)); const c = con(n.fill) * op; const capH = 0.72 * n.size;
      let m = 0, sx = 0, sy = 0;
      for (const l of n.lines) {
        const lw = measure ? measure.width(l.text, { family: n.family, weight: n.weight, size: n.size, tracking: n.tracking, fallback: n.fallback }) : n.box.w;
        const cx = n.anchor === 'start' ? l.x + lw / 2 : n.anchor === 'end' ? l.x - lw / 2 : l.x;
        const mm = lw * capH * d * c; m += mm; sx += mm * cx; sy += mm * (l.y - capH / 2);
      }
      if (m > 0) out.push({ id: n.id, kind: 'text', m, x: sx / m, y: sy / m, box: n.box });
    } else if (n.kind === 'image' || n.kind === 'rect') {
      const a = n.w * n.h; if (a <= 0 || a > 0.85 * W * H) continue;
      const m = a * op * (n.kind === 'image' ? 0.42 : con(n.fill) * 0.9); if (n.kind === 'rect' && (!n.fill || n.fill === 'none')) continue;
      out.push({ id: n.id, kind: n.kind, m, x: n.x + n.w / 2, y: n.y + n.h / 2, box: { x: n.x, y: n.y, w: n.w, h: n.h } });
    } else if (n.kind === 'circle' && n.fill && n.fill !== 'none') {
      const a = Math.PI * n.r * n.r; if (a > 0.85 * W * H) continue;
      out.push({ id: n.id, kind: 'circle', m: a * op * con(n.fill) * 0.9, x: n.cx, y: n.cy, box: { x: n.cx - n.r, y: n.cy - n.r, w: 2 * n.r, h: 2 * n.r } });
    }
  }
  return out;
}

/** centre-of-mass deviation (0 = centred, 1 = in a corner), anchoring of the heaviest block, and the weight jump */
export function balanceOf(scene: Scene, measure?: Measurer): Balance {
  const { w: W, h: H } = scene; const u = Math.min(W, H) / 100;
  const ms = masses(scene, measure);
  const M = ms.reduce((s, x) => s + x.m, 0);
  if (!M) return { dev: 0, dx: 0, dy: 0, anchored: true, lopsided: false, heavy: null, jump: 0 };
  const cx = ms.reduce((s, x) => s + x.m * x.x, 0) / M, cy = ms.reduce((s, x) => s + x.m * x.y, 0) / M;
  const dx = (cx - W / 2) / (W / 2), dy = (cy - H / 2) / (H / 2);
  const dev = Math.hypot(dx, dy) / Math.SQRT2;
  const hv = ms.reduce((a, b) => (b.m > a.m ? b : a));
  const b = hv.box; const e = 5 * u;
  const anchored = b.x <= e || b.y <= e || b.x + b.w >= W - e || b.y + b.h >= H - e || b.w >= 0.8 * W || b.h >= 0.8 * H;
  const jump = weightJump(scene);
  const lopsided = !anchored && (dev > 0.3 || (dev > 0.22 && jump >= 500));
  return { dev: +dev.toFixed(3), dx: +dx.toFixed(3), dy: +dy.toFixed(3), anchored, lopsided, heavy: hv.id, jump };
}

const isInfo = (t: TextNode) => t.role !== 'big.main';
/** effective weight gap between the heaviest display line and the lightest reading text */
export function weightJump(scene: Scene): number {
  const ts = flat(scene.nodes).filter((n): n is TextNode => n.kind === 'text' && readText(n));
  const disp = ts.filter((t) => t.role === 'big.main' || t.role === 'edge' || t.size > Math.min(scene.w, scene.h) * 0.08);
  const info = ts.filter((t) => !disp.includes(t) && isInfo(t));
  if (!disp.length || !info.length) return 0;
  return Math.max(...disp.map(effWeight)) - Math.min(...info.map((t) => t.weight));
}

/**
 * Weight-jump rule: with a heavy display (effective ≥ 700), reading text set at ≤ 300 goes to 400; its size is trimmed
 * by the typical advance growth (1.5 % / 3 %) so every line keeps about its width — geometry stays put.
 */
export function pairWeights(scene: Scene, _measure?: Measurer): number {
  const ts = flat(scene.nodes).filter((n): n is TextNode => n.kind === 'text' && readText(n));
  const disp = ts.filter((t) => t.role === 'big.main' || t.size > Math.min(scene.w, scene.h) * 0.08);
  if (!disp.length || Math.max(...disp.map(effWeight)) < 700) return 0;
  let n = 0;
  for (const t of ts) {
    if (disp.includes(t) || t.weight > 300 || t.vertical) continue;
    // a fixed advance-growth model (not a measurement): a 300 → 400 step widens a line ~1.5 %, 200 → 400 ~3 %. Measuring
    // the two weights would depend on which weight files a page happened to load (the CLI and the editor differ).
    const k = t.weight <= 200 ? 0.97 : 0.985;
    t.weight = 400;
    t.size = +(t.size * k).toFixed(3);
    n++;
  }
  return n;
}
