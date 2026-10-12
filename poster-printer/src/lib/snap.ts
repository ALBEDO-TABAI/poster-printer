// Snap-to-grid for manual drags: a moving box snaps its left / centre / right edge to column edges (and the canvas
// centre and margins), and its top / middle / bottom to row edges, when within `tol` canvas px.
export interface SnapLines { xs: number[]; ys: number[] }
type Box = { x: number; y: number; w: number; h: number };

export function snapMove(b: Box, dx: number, dy: number, lines: SnapLines, tol: number): { dx: number; dy: number; gx?: number; gy?: number } {
  const best = (cands: number[], targets: number[]) => {
    let d = Infinity, hit: number | undefined, off = 0;
    for (const c of cands) for (const t of targets) { const v = t - c; if (Math.abs(v) < Math.abs(d) && Math.abs(v) <= tol) { d = v; hit = t; off = v; } }
    return hit === undefined ? null : { off, hit };
  };
  const sx = best([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], lines.xs);
  const sy = best([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], lines.ys);
  return { dx: dx + (sx?.off ?? 0), dy: dy + (sy?.off ?? 0), gx: sx?.hit, gy: sy?.hit };
}

/** snap lines from a grid: column/row edges (both sides of each gutter), margins and the canvas centre lines */
export function gridSnapLines(g: { x: number[]; y: number[]; gutter: number; nc: number; nr: number; W: number; H: number }): SnapLines {
  const hg = g.gutter / 2;
  const xs = new Set<number>([g.W / 2]);
  g.x.forEach((x, i) => { if (i === 0 || i === g.nc) xs.add(x); else { xs.add(x - hg); xs.add(x + hg); } });
  const ys = new Set<number>([g.H / 2]);
  g.y.forEach((y, i) => { if (i === 0 || i === g.nr) ys.add(y); else { ys.add(y - hg); ys.add(y + hg); } });
  const r = (v: number) => Math.round(v * 10) / 10;
  return { xs: [...xs].map(r).sort((a, b) => a - b), ys: [...ys].map(r).sort((a, b) => a - b) };
}
