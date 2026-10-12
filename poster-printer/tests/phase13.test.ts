// Phase 13: user choices win. `honor` lists the params the user chose (pins + tweaks); without it the engine is unchanged.
import { describe, it, expect } from 'vitest';
import { generate } from '../src/engine/generate';
import { relLum } from '../src/engine/color/contrast';
import { input } from './p8util';
import { DEFAULT_PARAMS, REMOVED_PARAMS, PARAMS, DRAW_ONLY, RELAYOUT } from '../src/engine/params';

const seeds = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'];
const gen = (seed: string, params: Record<string, unknown>, honor?: string[]) => {
  const inp = input(seed, '3:4', 'zh-swiss') as unknown as { params: Record<string, unknown> };
  return generate({ ...(inp as object), params: { ...inp.params, ...params }, honor, select: 4 } as never);
};

describe('phase 13: honoured choices', () => {
  it('a dark ground the user asked for survives the plan tone, mono/clash and Itten strategies', () => {
    let dark = 0, darkNoHonor = 0;
    for (const s of seeds) {
      if (relLum(gen(s, { bgPref: 'dark' }, ['bgPref']).scene.bg) < 0.2) dark++;
      if (relLum(gen(s, { bgPref: 'dark' }).scene.bg) < 0.2) darkNoHonor++;
    }
    expect(dark).toBe(seeds.length);
    expect(darkNoHonor).toBeLessThan(seeds.length); // phase 12 behaviour without honor: the plan decides
  });
  it('a light ground is honoured too', () => {
    for (const s of seeds) expect(relLum(gen(s, { bgPref: 'light' }, ['bgPref']).scene.bg)).toBeGreaterThan(0.5);
  });
  it('no honor = identical to the previous engine (replays and CLI unchanged)', () => {
    for (const s of seeds.slice(0, 3)) expect(JSON.stringify(gen(s, {}, []).scene.nodes)).toBe(JSON.stringify(gen(s, {}).scene.nodes));
  });
  it('honoured treatments reach every composition: duotone 100 colours all photos', () => {
    let imgs = 0, duo = 0;
    for (const s of seeds) {
      const sc = gen(s, { duotone: 100, imageCount: 1 }, ['duotone', 'imageCount']).scene;
      const walk = (ns: { kind: string; children?: unknown[]; filter?: { duotone?: unknown }; cutout?: boolean; halftone?: unknown }[]) => { for (const n of ns) { if (n.kind === 'group') walk(n.children as never); else if (n.kind === 'image' && !n.cutout && !n.halftone) { imgs++; if (n.filter?.duotone) duo++; } } };
      walk(sc.nodes as never);
    }
    expect(imgs).toBeGreaterThan(0);
    expect(duo).toBe(imgs);
  });
  it('palette fit only warns for an honoured colour choice, and reports what it did', () => {
    for (const s of seeds) {
      const r = gen(s, { bgPref: 'color', soft: true }, ['bgPref', 'soft']);
      const ov = (r.scene.info.overrides ?? []) as { kind: string; keys: string[] }[];
      for (const o of ov) { expect(['repaired', 'warn', 'kept']).toContain(o.kind); expect(o.keys.length).toBeGreaterThan(0); }
    }
  });
  it('schema: removed params are gone, metadata lists are consistent', () => {
    const keys = PARAMS.map((p) => p.key);
    for (const k of REMOVED_PARAMS) { expect(keys).not.toContain(k); expect(DEFAULT_PARAMS[k]).toBeUndefined(); }
    for (const k of [...DRAW_ONLY, ...RELAYOUT]) expect(keys).toContain(k);
  });
});
