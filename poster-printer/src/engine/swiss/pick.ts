// Phase 16 — companions for the grid compositions. A random draw starts from one picture; the modular and bleed-grid
// compositions show a set. Companions come from the pool on their own stream (the picked ids are stored, so replays
// lock them): the hero's own source tier first and its category first, so the set reads as one series, not a
// scrapbook. A locked or given set is never extended.
import { Rng } from '../rng';
import type { ImageAsset } from '../gen/ctx';

/** how many pictures a grid draw shows when nobody said */
export function gridCount(rng: Rng, pool: number, wide: boolean): number {
  const n = Number(rng.weighted(wide ? { 2: 2, 3: 3, 4: 2.5, 5: 1.5 } : { 2: 1.2, 3: 3, 4: 3, 5: 2, 6: 1 }));
  return Math.max(1, Math.min(8, pool, n));
}

export function companions(hero: ImageAsset, pool: ImageAsset[], have: ImageAsset[], want: number, seed: string): ImageAsset[] {
  const rng = new Rng(seed + '|grid');
  const taken = new Set(have.map((a) => a.id));
  const free = pool.filter((a) => !taken.has(a.id));
  const tier = (a: ImageAsset) => a.tier ?? (a.user ? 'user' : 'photo');
  const score = (a: ImageAsset) => (tier(a) === tier(hero) ? 6 : a.tier === 'proc' || hero.tier === 'proc' ? 0.01 : 0.2) * (a.category && a.category === hero.category ? 2.5 : 1) * (a.user && hero.user ? 3 : 1);
  const out: ImageAsset[] = [];
  const left = [...free];
  while (out.length < want - have.length && left.length) {
    const w = left.map(score);
    let r = rng.next() * w.reduce((s, v) => s + v, 0);
    let k = left.length - 1;
    for (let i = 0; i < left.length; i++) { r -= w[i]; if (r <= 0) { k = i; break; } }
    out.push(left[k]); left.splice(k, 1);
  }
  return out;
}
