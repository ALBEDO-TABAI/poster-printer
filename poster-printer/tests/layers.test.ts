// Phase 17: layered layout streams — 网格 grid / 图位 placement / 排字 type re-rolled one at a time (generate.ts).
import { describe, expect, it } from 'vitest';
import { generate, layerSig, visibleChange, type GenInput, type GenResult, type Layer } from '../src/engine/generate';
import { FIXED_PLACE } from '../src/engine/layers';
import { COMPS } from '../src/data/styles';
import { cyrb128 } from '../src/engine/rng';
import { input, RATIOS } from './p8util';

const STYLES = ['neue-grid', 'zh-modern-song', 'editorial-play', 'instrument'];
/** the input that re-renders a poster with its own picks (what the app's history / keepLayout path passes) */
const keepOf = (inp: GenInput, a: GenResult): GenInput => {
  const pk = a.picked;
  return { ...inp, forceComp: pk.comp, forcePlan: pk.plan, forceIdea: pk.idea, layoutSalt: pk.layoutSalt, forceAttempt: pk.attempt ?? 0, lockedImages: pk.imageIds, lockedTexts: pk.texts, lockedPalette: pk.palette, layers: pk.layers ?? null };
};
const reroll = (inp: GenInput, a: GenResult, layer: Layer, salt: string) => generate({ ...keepOf(inp, a), reroll: { layer, salt, base: a.scene } });
const fp = (r: GenResult) => cyrb128(JSON.stringify(r.scene.nodes)).map((x) => x.toString(36)).join('.');

describe('legacy posters (no layers) replay their single stream', () => {
  it('scenes match the fingerprints of the phase-16 engine', () => {
    // fingerprints taken from the phase-16 build: a poster made before phase 17 must keep replaying exactly
    const GOLD: [string, string, string, string, string][] = [
      ['G1', '3:4', 'neue-grid', 'auto', '1ez76t2.1ns5cyw.1w86rv7.15dz68d'], ['G2', '16:9', 'zh-modern-song', 'modular', '1xy2piw.1e3yev9.iljx33.377zgi'],
      ['G3', '1:1', 'editorial-play', 'bleedgrid', '1p8cak1.18c58sp.1utw6pv.1dv89ff'], ['G4', '9:16', 'instrument', 'typeled', '37qfg1.18t9jbw.1tu9oou.jsx8yb'],
      ['G5', '4:3', 'neue-grid', 'split', '1mzgyyw.14irc6j.vvqz7.jbz9dc'], ['G6', '3:4', 'zh-modern-song', 'cover', '1rw7qt8.zjwx6p.130ku9w.1t72l2x'],
      ['G7', '21:9', 'editorial-play', 'exhibit', '12arwhz.20s4yo.1k8xel1.jyxt2q'], ['G8', '3:4', 'instrument', 'edge', 'zix20b.mbs6nj.z2t1q3.1cb65vj'],
    ];
    for (const [seed, ratio, style, comp, want] of GOLD) {
      const r = generate({ ...(input(seed, ratio, style, comp) as GenInput), layers: null });
      expect(fp(r), `${seed} ${comp}`).toBe(want);
      expect(r.picked.layers).toBeUndefined();
    }
  });
  it('a new poster is layered and replays exactly with its layers', () => {
    for (let k = 0; k < 8; k++) {
      const inp = input('N' + k, RATIOS[k % 6], STYLES[k % 4], k % 2 ? 'modular' : 'auto') as GenInput;
      const a = generate(inp);
      expect(a.picked.layers?.v).toBe(2);
      expect(fp(generate(keepOf(inp, a)))).toBe(fp(a));
    }
  });
});

describe('re-rolling one layer', () => {
  it('排字 keeps every picture frame and changes the type (all compositions)', () => {
    let n = 0, changed = 0;
    for (const comp of COMPS) for (let k = 0; k < 3; k++) {
      const inp = input(`T${comp}${k}`, RATIOS[(k * 2 + comp.length) % 6], STYLES[k % 4], comp) as GenInput;
      const a = generate(inp);
      const b = reroll(inp, a, 'type', 's' + k);
      expect(layerSig(b.scene, 'pics'), `${a.picked.comp} ${k}`).toBe(layerSig(a.scene, 'pics'));
      expect(b.picked.comp).toBe(a.picked.comp);
      expect(b.picked.layers?.type).toBeTruthy();
      n++; if (layerSig(b.scene, 'type') !== layerSig(a.scene, 'type')) changed++;
    }
    expect(changed / n).toBeGreaterThan(0.85);
  }, 120000);
  it('图位 keeps the composition and moves the pictures where the layout allows it', () => {
    let n = 0, moved = 0;
    for (const comp of COMPS) for (let k = 0; k < 2; k++) {
      const inp = input(`P${comp}${k}`, RATIOS[(k * 3 + comp.length) % 6], STYLES[(k + 1) % 4], comp) as GenInput;
      const a = generate(inp);
      const b = reroll(inp, a, 'place', 'p' + k);
      expect(b.picked.comp).toBe(a.picked.comp);
      expect(b.picked.texts).toEqual(a.picked.texts);
      if (FIXED_PLACE.has(a.picked.comp)) { expect(layerSig(b.scene, 'pics'), a.picked.comp).toBe(layerSig(a.scene, 'pics')); continue; }
      n++; if (layerSig(b.scene, 'place') !== layerSig(a.scene, 'place')) moved++;
    }
    expect(moved / n).toBeGreaterThan(0.6);
  }, 120000);
  it('网格 re-draws the grid and keeps the composition', () => {
    for (const comp of ['modular', 'bleedgrid', 'split', 'swiss', 'typeled']) for (let k = 0; k < 2; k++) {
      const inp = input(`R${comp}${k}`, RATIOS[k * 3], STYLES[k], comp) as GenInput;
      const a = generate(inp);
      const b = reroll(inp, a, 'grid', 'g' + k);
      expect(b.picked.comp).toBe(a.picked.comp);
      expect(layerSig(b.scene, 'grid')).not.toBe(layerSig(a.scene, 'grid'));
    }
  });
  it('layer salts are deterministic and independent', () => {
    const inp = input('D1', '3:4', 'neue-grid', 'modular') as GenInput;
    const a = generate(inp);
    const t1 = reroll(inp, a, 'type', 'x'), t2 = reroll(inp, a, 'type', 'x');
    expect(fp(t1)).toBe(fp(t2));
    // a type salt then a placement salt: the placement does not depend on the type salt
    const p1 = generate({ ...keepOf(inp, a), layers: { v: 2, place: 'q' } });
    const p2 = generate({ ...keepOf(inp, a), layers: { v: 2, place: 'q', type: 'z' } });
    expect(layerSig(p2.scene, 'pics')).toBe(layerSig(p1.scene, 'pics'));
  });
  it('a legacy poster becomes layered on its first layer re-roll', () => {
    const inp = input('L1', '3:4', 'neue-grid', 'modular') as GenInput;
    const a = generate({ ...inp, layers: null });
    const b = reroll(inp, a, 'type', 'y');
    expect(a.picked.layers).toBeUndefined();
    expect(b.picked.layers).toEqual(expect.objectContaining({ v: 3, type: expect.any(String) }));   // phase 22: a re-roll makes a v3 poster
  });
});

// phase 22 (白: on a 构成编排 masthead poster T found nothing and R changed nothing you could see): a re-roll is judged by
// what a viewer notices, and a v3 re-roll draws what v2 kept fixed (the grid's margin, a masthead's set-up, cover lines)
describe('re-rolls a viewer can see (phase 22)', () => {
  const SHOW = ['zh-new-chinese', 'zh-mincho', 'zh-heavy-hei', 'zh-cold-hei', 'instrument', 'didone-salon', 'neue-grid', 'poster-gothic'];
  const keep = (inp: GenInput, a: GenResult): GenInput => ({ ...keepOf(inp, a), layoutSalt: a.picked.salt, forceKind: a.picked.kind, avoid: a.picked.avoid, select: 0 } as GenInput);
  const rate = (arch: string | null, n: number) => {
    let t = 0, r = 0;
    for (let i = 0; i < n; i++) {
      const b0 = input('V' + i, i % 3 ? '3:4' : RATIOS[i % 6], SHOW[i % SHOW.length], arch ? 'build' : 'auto') as GenInput;
      const one = { ...b0, ...(arch ? { params: { ...b0.params, archetype: arch } } : {}), images: (b0 as { images: unknown[] }).images.slice(i % 40, i % 40 + 1) } as GenInput;
      const a = generate(one);
      for (const layer of ['type', 'grid'] as Layer[]) {
        const b = generate({ ...keep(one, a), reroll: { layer, salt: 'v' + i, base: a.scene } });
        if (!visibleChange(a.scene, b.scene, layer)) { if (layer === 'type') t++; else r++; }
      }
    }
    return { t: t / n, r: r / n };
  };
  it('排字 and 网格 change something visible on almost every poster', () => {
    const all = rate(null, 120), mast = rate('masthead', 60);
    expect(all.t).toBeLessThan(0.03);
    expect(all.r).toBeLessThan(0.05);
    expect(mast.t).toBeLessThan(0.03);
    expect(mast.r).toBeLessThan(0.06);
  }, 120000);
  it('a v2 poster replays exactly; only a re-roll makes v3', () => {
    const inp = input('W1', '3:4', 'zh-cold-hei', 'build') as GenInput;
    const a = generate(inp);
    expect(a.picked.layers?.v).toBe(2);
    expect(fp(generate(keepOf(inp, a)))).toBe(fp(a));
    const b = reroll(inp, a, 'grid', 'g');
    expect(b.picked.layers?.v).toBe(3);
  });
});

