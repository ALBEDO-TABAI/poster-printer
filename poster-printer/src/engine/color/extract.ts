import { rgbToLab, labToHex, type Lab } from './convert';
import { Rng } from '../rng';

export interface Swatch { hex: string; weight: number; lab: Lab }

/** k-means in Lab on sampled pixels (rgba Uint8 array). Deterministic (seeded k-means++). */
export function extractPalette(data: Uint8ClampedArray | number[], k = 5, maxSamples = 6000, seed = 'kmeans'): Swatch[] {
  const pts: Lab[] = [];
  const n = data.length / 4;
  const step = Math.max(1, Math.floor(n / maxSamples));
  for (let i = 0; i < n; i += step) {
    if (data[i * 4 + 3] < 128) continue;
    pts.push(rgbToLab([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]));
  }
  if (!pts.length) return [];
  const rng = new Rng(seed);
  const cents: Lab[] = [pts[Math.floor(rng.next() * pts.length)]];
  const d2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  while (cents.length < k) {
    const ds = pts.map((p) => Math.min(...cents.map((c) => d2(p, c))));
    const tot = ds.reduce((a, b) => a + b, 0);
    let r = rng.next() * tot, idx = 0;
    for (; idx < ds.length - 1; idx++) { r -= ds[idx]; if (r <= 0) break; }
    cents.push(pts[idx]);
  }
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < 14; it++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bv = Infinity;
      for (let c = 0; c < cents.length; c++) { const v = d2(pts[i], cents[c]); if (v < bv) { bv = v; best = c; } }
      assign[i] = best;
    }
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) { const s = sums[assign[i]]; s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3]++; }
    for (let c = 0; c < cents.length; c++) if (sums[c][3]) cents[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
  }
  const counts = cents.map(() => 0);
  for (let i = 0; i < pts.length; i++) counts[assign[i]]++;
  return cents.map((c, i) => ({ hex: labToHex(c), weight: counts[i] / pts.length, lab: c })).sort((a, b) => b.weight - a.weight);
}
