// "Art direction v2": one committed idea per draw. The plan is drawn up front from its own random stream, so the
// layout / colour / text seeds keep their meaning and a plan can be inspected (scene.info.plan).
import { Rng } from '../rng';
import type { Params } from '../params';
import type { ModeKey } from '../types';
import type { Tone } from '../color/strategy';

export type KitItem = 'footer' | 'header' | 'mark' | 'signature' | 'dots' | 'frame' | 'construct';
export type Geometry = 'none' | 'nested' | 'rays' | 'tri' | 'tiles';
export interface DrawPlan {
  v2: boolean;
  typeOnly: boolean;
  tone: Tone;
  palette: 'mono' | 'clash' | 'source';
  grain: number; // 0 = flat
  kit: KitItem[];
  script: boolean;
  geometry: Geometry;
  material: 'none' | 'torn' | 'stamp' | 'halftone';
}

export const OFF_PLAN: DrawPlan = { v2: false, typeOnly: false, tone: 'sat', palette: 'source', grain: -1, kit: [], script: false, geometry: 'none', material: 'none' };

export function drawPlan(seed: string, p: Params, o: { modes: Set<ModeKey>; canDropImages: boolean; retro: boolean; paletteFree: boolean }): DrawPlan {
  if (p.planV2 === false) return OFF_PLAN;
  const r = new Rng(seed + '|plan');
  const share = (k: string, d: number) => (p[k] === undefined ? d : Number(p[k])) / 100;
  const typeOnly = o.canDropImages && r.chance(share('typeOnlyShare', 28));
  const tone = r.weighted<Tone>({ dark: 3, light: 3, sat: 4 });
  let palette: DrawPlan['palette'] = 'source';
  if (o.paletteFree && !o.modes.has('experimental') && !o.modes.has('random')) {
    const clash = o.modes.has('clash') ? 0.5 : share('clashShare', 6);
    const roll = r.next();
    palette = roll < clash ? 'clash' : roll < clash + share('monoShare', 30) ? 'mono' : 'source';
  }
  const grainP = share('grainShare', 12) * (o.retro ? 2.2 : 1);
  const grain = r.chance(grainP) ? r.range(0.06, 0.1) : 0;
  const nKit = r.pick([1, 1, 2, 2, 2, 3]);
  const kit = r.shuffle<KitItem>(['footer', 'footer', 'header', 'mark', 'mark', 'signature', 'dots', 'frame', 'frame', 'construct'])
    .filter((k, i, a) => a.indexOf(k) === i).slice(0, nKit);
  const script = r.chance(share('scriptShare', 12));
  const geometry: Geometry = r.chance(typeOnly ? 0.5 : 0.1) ? r.weighted<Geometry>({ nested: 3, rays: 2, tri: 2, tiles: 2 }) : 'none';
  const material = r.weighted<DrawPlan['material']>({ none: 6, torn: 1.6, stamp: 1, halftone: 1 });
  return { v2: true, typeOnly, tone, palette, grain, kit, script, geometry, material };
}
