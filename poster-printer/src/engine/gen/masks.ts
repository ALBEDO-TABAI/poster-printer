import { Rng } from '../rng';
import type { Rect } from './grid';

const f = (v: number) => (Math.round(v * 10) / 10).toString();
export const rectPath = (r: Rect) => `M${f(r.x)} ${f(r.y)}H${f(r.x + r.w)}V${f(r.y + r.h)}H${f(r.x)}Z`;

export function roundedPath(r: Rect, rad: number | [number, number, number, number]) {
  const [a, b, c, d] = (Array.isArray(rad) ? rad : [rad, rad, rad, rad]).map((v) => Math.min(v, r.w / 2, r.h / 2));
  const { x, y, w, h } = r;
  return `M${f(x + a)} ${f(y)}H${f(x + w - b)}A${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)}V${f(y + h - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}H${f(x + d)}A${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)}V${f(y + a)}A${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)}Z`;
}

/** jagged line between two points (torn paper). */
function tornLine(rng: Rng, x0: number, y0: number, x1: number, y1: number, rough: number): [number, number][] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(8, Math.round(len / 7));
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  const pts: [number, number][] = [];
  let off = 0;
  const amp = 2 + rough * 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    off = off * 0.55 + rng.gauss(0, amp) * 0.6;
    const big = Math.sin(t * Math.PI * 3 + rng.next() * 0.3) * amp * 0.6;
    const o = i === 0 || i === n ? 0 : off + big * 0.5;
    pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
  }
  return pts;
}

/** Rect with chosen edges torn. edges: t r b l */
export function tornPath(rng: Rng, r: Rect, edges: { t?: boolean; r?: boolean; b?: boolean; l?: boolean }, rough = 0.5) {
  const { x, y, w, h } = r;
  const seg = (on: boolean | undefined, a: [number, number], b: [number, number]) => (on ? tornLine(rng, a[0], a[1], b[0], b[1], rough) : [a, b]);
  const pts = [
    ...seg(edges.t, [x, y], [x + w, y]),
    ...seg(edges.r, [x + w, y], [x + w, y + h]).slice(1),
    ...seg(edges.b, [x + w, y + h], [x, y + h]).slice(1),
    ...seg(edges.l, [x, y + h], [x, y]).slice(1),
  ];
  return 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
}

/** Quarter-circle fan anchored in a corner of rect. corner 0=tl 1=tr 2=br 3=bl */
export function fanPath(r: Rect, corner: number, radius?: number) {
  const R = radius ?? Math.min(r.w, r.h);
  const cx = corner === 0 || corner === 3 ? r.x : r.x + r.w;
  const cy = corner === 0 || corner === 1 ? r.y : r.y + r.h;
  const sx = corner === 0 || corner === 3 ? 1 : -1;
  const sy = corner === 0 || corner === 1 ? 1 : -1;
  const sweep = sx * sy > 0 ? 1 : 0;
  return `M${f(cx)} ${f(cy)}L${f(cx + sx * R)} ${f(cy)}A${f(R)} ${f(R)} 0 0 ${sweep} ${f(cx)} ${f(cy + sy * R)}Z`;
}

/** Semicircle / arch: rect whose top is a half circle. */
export function archPath(r: Rect) {
  const rad = r.w / 2;
  const { x, y, w, h } = r;
  return `M${f(x)} ${f(y + h)}V${f(y + rad)}A${f(rad)} ${f(rad)} 0 0 1 ${f(x + w)} ${f(y + rad)}V${f(y + h)}Z`;
}

/** Wavy top edge band */
export function wavePath(rng: Rng, r: Rect, amp = 24, waves = 2, edge: 'top' | 'bottom' = 'top') {
  const pts: string[] = [];
  const ph = rng.range(0, Math.PI * 2);
  const n = 60;
  const yb = edge === 'top' ? r.y : r.y + r.h;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(`${f(r.x + r.w * t)} ${f(yb + Math.sin(t * Math.PI * 2 * waves + ph) * amp)}`);
  }
  if (edge === 'top') return `M${pts.join('L')}L${f(r.x + r.w)} ${f(r.y + r.h)}L${f(r.x)} ${f(r.y + r.h)}Z`;
  return `M${f(r.x)} ${f(r.y)}L${f(r.x + r.w)} ${f(r.y)}L${pts.reverse().join('L')}Z`;
}

/** Brush stroke blob covering (mostly) the rect: a few overlapping strokes with ragged ends. */
export function brushPath(rng: Rng, r: Rect, strokes = 3) {
  const out: string[] = [];
  const horizontal = r.w >= r.h * 0.8;
  for (let s = 0; s < strokes; s++) {
    const n = 40;
    const thick = (horizontal ? r.h : r.w) / strokes * rng.range(1.15, 1.5);
    const top: [number, number][] = [], bot: [number, number][] = [];
    const c0 = (s + 0.5) / strokes;
    const wob = rng.range(0, 6.28);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.02)) * 1.6 + 0.25);
      const th = thick * 0.5 * taper * (1 + rng.gauss(0, 0.04));
      const along = horizontal ? r.x + r.w * (-0.02 + t * 1.04) : r.y + r.h * (-0.02 + t * 1.04);
      const across = (horizontal ? r.y + r.h * c0 : r.x + r.w * c0) + Math.sin(t * 3 + wob) * thick * 0.12;
      const j1 = rng.gauss(0, thick * 0.025), j2 = rng.gauss(0, thick * 0.025);
      if (horizontal) { top.push([along, across - th + j1]); bot.push([along, across + th + j2]); }
      else { top.push([across - th + j1, along]); bot.push([across + th + j2, along]); }
    }
    const pts = [...top, ...bot.reverse()];
    out.push('M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z');
  }
  return out.join('');
}

/** Non-orthogonal (skewed) quad cut */
export function skewPath(r: Rect, skew: number, side: 'left' | 'right' = 'right') {
  const d = r.h * skew;
  const { x, y, w, h } = r;
  if (side === 'right') return `M${f(x)} ${f(y)}H${f(x + w + Math.min(0, d))}L${f(x + w - Math.max(0, d) + Math.min(0, d) * 0)} ${f(y + h)}H${f(x)}Z`;
  return `M${f(x + Math.max(0, d))} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x + Math.max(0, -d))}Z`;
}

/** postage-stamp edge: rect whose outline is a row of semicircular perforations */
export function stampPath(r: Rect, hole: number) {
  const { x, y, w, h } = r;
  const nx = Math.max(3, Math.round(w / (hole * 2.4))), ny = Math.max(3, Math.round(h / (hole * 2.4)));
  const sx = w / nx, sy = h / ny, rr = Math.min(hole, sx * 0.32, sy * 0.32);
  let d = `M${f(x)} ${f(y)}`;
  for (let i = 0; i < nx; i++) { const cx = x + sx * (i + 0.5); d += `H${f(cx - rr)}A${f(rr)} ${f(rr)} 0 0 0 ${f(cx + rr)} ${f(y)}`; }
  d += `H${f(x + w)}`;
  for (let j = 0; j < ny; j++) { const cy = y + sy * (j + 0.5); d += `V${f(cy - rr)}A${f(rr)} ${f(rr)} 0 0 0 ${f(x + w)} ${f(cy + rr)}`; }
  d += `V${f(y + h)}`;
  for (let i = nx - 1; i >= 0; i--) { const cx = x + sx * (i + 0.5); d += `H${f(cx + rr)}A${f(rr)} ${f(rr)} 0 0 0 ${f(cx - rr)} ${f(y + h)}`; }
  d += `H${f(x)}`;
  for (let j = ny - 1; j >= 0; j--) { const cy = y + sy * (j + 0.5); d += `V${f(cy + rr)}A${f(rr)} ${f(rr)} 0 0 0 ${f(x)} ${f(cy - rr)}`; }
  return d + 'Z';
}
/** parallelogram shard: top edge shifted by `skew` (fraction of width) */
export function shardPath(r: Rect, skew: number) {
  const s = r.w * skew;
  return `M${f(r.x + Math.max(0, s))} ${f(r.y)}H${f(r.x + r.w + Math.min(0, s))}L${f(r.x + r.w - Math.max(0, s))} ${f(r.y + r.h)}H${f(r.x - Math.min(0, s))}Z`;
}
/** wedge: triangle from one full edge to a point on the opposite edge */
export function wedgePath(r: Rect, side: 'l' | 'r' | 't' | 'b', at = 0.5) {
  const { x, y, w, h } = r;
  switch (side) {
    case 'l': return `M${f(x)} ${f(y)}L${f(x + w)} ${f(y + h * at)}L${f(x)} ${f(y + h)}Z`;
    case 'r': return `M${f(x + w)} ${f(y)}L${f(x)} ${f(y + h * at)}L${f(x + w)} ${f(y + h)}Z`;
    case 't': return `M${f(x)} ${f(y)}L${f(x + w)} ${f(y)}L${f(x + w * at)} ${f(y + h)}Z`;
    default: return `M${f(x)} ${f(y + h)}L${f(x + w)} ${f(y + h)}L${f(x + w * at)} ${f(y)}Z`;
  }
}
/** half disc sitting on one edge of the rect (diameter = that edge) */
export function halfDiscPath(r: Rect, edge: 't' | 'b' | 'l' | 'r') {
  const { x, y, w, h } = r;
  if (edge === 'b' || edge === 't') {
    const R = Math.min(w / 2, h);
    const cx = x + w / 2, by = edge === 'b' ? y + h : y;
    return `M${f(cx - R)} ${f(by)}A${f(R)} ${f(R)} 0 0 ${edge === 'b' ? 1 : 0} ${f(cx + R)} ${f(by)}Z`;
  }
  const R = Math.min(h / 2, w);
  const cy = y + h / 2, bx = edge === 'r' ? x + w : x;
  return `M${f(bx)} ${f(cy - R)}A${f(R)} ${f(R)} 0 0 ${edge === 'r' ? 0 : 1} ${f(bx)} ${f(cy + R)}Z`;
}
/** staircase: n steps rising from bottom-left (or bottom-right when flip) */
export function stairPath(r: Rect, n: number, flip = false) {
  const { x, y, w, h } = r;
  const sw = w / n, sh = h / n;
  const pts: [number, number][] = [[x, y + h]];
  for (let i = 0; i < n; i++) { const top = y + h - sh * (i + 1); pts.push([x + sw * i, top], [x + sw * (i + 1), top]); }
  pts.push([x + w, y + h]);
  const P = flip ? pts.map(([px, py]) => [2 * x + w - px, py]) : pts;
  return 'M' + P.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
}
