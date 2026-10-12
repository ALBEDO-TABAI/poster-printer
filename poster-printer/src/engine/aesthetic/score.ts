// Learned taste score: predicted 1–10 "premium" rating of a finished scene (see scripts/taste/ and docs/PHASE6_STATS.md).
import type { Scene } from '../types';
import { sceneFeatures } from './features';
import { TASTE_MODEL } from './model';

export function tasteFromFeatures(f: Record<string, number>): number {
  const M = TASTE_MODEL;
  const x = M.names.map((k) => f[k] ?? 0);
  let s = M.init;
  for (const [feat, thr, left, right, val] of M.trees) {
    let i = 0;
    while (left[i] !== -1) i = x[feat[i]] <= thr[i] ? left[i] : right[i];
    s += M.lr * val[i];
  }
  return s;
}
export function tasteScore(scene: Scene): number { return tasteFromFeatures(sceneFeatures(scene)); }
