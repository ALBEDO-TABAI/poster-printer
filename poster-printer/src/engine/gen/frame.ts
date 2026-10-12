// Proportional frames beyond the column grid (phase 7): placement anchors only — never score terms.
// - root-rectangle "eyes" (dynamic symmetry): where the perpendiculars from the corners meet the main diagonals;
//   with a = W/H and t = 1/(1+a²) the eyes are (t,t), (1−t,1−t), (1−t,t), (t,1−t) in normalised coordinates.
//   3:4 → 0.36/0.64; 16:9 → 0.24/0.76; 21:9 → 0.155/0.845: strong positions near the short ends on long formats.
// - canon frame (Van de Graaf / Tschichold, ninths): margins inner:top:outer:bottom = 2:3:4:6 of W/9 and H/9,
//   used bottom-heavy for single-sided posters (text block high, deep foot).
export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

export function eyes(W: number, H: number): Pt[] {
  const a = W / H, t = 1 / (1 + a * a), lo = Math.min(t, 1 - t), hi = 1 - lo;
  // feet of the corner perpendiculars on both diagonals: the same fraction on both axes; sorted top-left, top-right, bottom-left, bottom-right
  return [{ x: W * lo, y: H * lo }, { x: W * hi, y: H * lo }, { x: W * lo, y: H * hi }, { x: W * hi, y: H * hi }];
}

/** the canon text block (ninths): returns the block and the four margins */
export function canon(W: number, H: number, mirror = false): { block: Box; m: { l: number; t: number; r: number; b: number } } {
  const u = W / 9, v = H / 9;
  const inner = u * 1, outer = u * 1.5; // the 2:4 book ratio is too wide for a poster; keep the 2:3 proportion on a gentler scale
  const top = v * 1, bottom = v * 2;
  const l = mirror ? outer : inner, r = mirror ? inner : outer;
  return { block: { x: l, y: top, w: W - l - r, h: H - top - bottom }, m: { l, t: top, r, b: bottom } };
}

/** extra snap lines (eyes + canon) offered next to the grid's own lines */
export function frameLines(W: number, H: number): { xs: number[]; ys: number[] } {
  const e = eyes(W, H), c = canon(W, H).block;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { xs: [...new Set([...e.map((p) => r(p.x)), r(c.x), r(c.x + c.w)])], ys: [...new Set([...e.map((p) => r(p.y)), r(c.y), r(c.y + c.h)])] };
}
