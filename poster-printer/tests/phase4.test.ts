import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rng } from '../src/engine/rng';
import { monoPalette, clashPalette, commitTone } from '../src/engine/color/strategy';
import { wcag } from '../src/engine/color/contrast';
import { hexToOklch } from '../src/engine/color/oklch';
import { drawPlan } from '../src/engine/gen/plan';
import { generate, DEFAULT_MODULES } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
import { renderSVG } from '../src/engine/render/svg';
import type { Ratio, SceneNode } from '../src/engine/types';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const walk = (ns: SceneNode[], f: (n: SceneNode) => void) => ns.forEach((n) => { f(n); if (n.kind === 'group') walk(n.children, f); });
function run(seed: string, ratio: Ratio, styleIdx: number, comp = 'auto') {
  const style = BUILTIN_STYLES[styleIdx % BUILTIN_STYLES.length];
  return generate({
    seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never,
    modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer,
  });
}

describe('phase 4 palette strategies', () => {
  it('single-hue palettes keep one hue family and readable ink', () => {
    for (let i = 0; i < 60; i++) {
      const r = new Rng('mono' + i);
      const tone = (['dark', 'light', 'sat'] as const)[i % 3];
      const p = monoPalette((i * 37) % 360, tone, r);
      expect(wcag(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
      const hb = hexToOklch(p.bg)[2], ha = hexToOklch(p.alt)[2];
      const dh = Math.min(Math.abs(hb - ha), 360 - Math.abs(hb - ha));
      if (hexToOklch(p.bg)[1] > 0.03 && hexToOklch(p.alt)[1] > 0.03) expect(dh).toBeLessThan(40);
    }
  });
  it('clash palettes put a distant hue on the accent and keep ink readable', () => {
    for (let i = 0; i < 40; i++) {
      const p = clashPalette((i * 53) % 360, new Rng('clash' + i));
      expect(wcag(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('tone commitment keeps ink readable', () => {
    const base = monoPalette(30, 'sat', new Rng('b'));
    for (const t of ['dark', 'light', 'sat'] as const) expect(wcag(commitTone(base, t, new Rng(t)).ink, commitTone(base, t, new Rng(t)).bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('phase 4 draw plan', () => {
  it('shares land near their targets (type-only ~28%, grain ≤15%, mono ~30%)', () => {
    const N = 2000; let to = 0, gr = 0, mono = 0, clash = 0;
    for (let i = 0; i < N; i++) {
      const p = drawPlan('s' + i, DEFAULT_PARAMS as never, { modes: new Set(), canDropImages: true, retro: false, paletteFree: true });
      if (p.typeOnly) to++; if (p.grain > 0) gr++; if (p.palette === 'mono') mono++; if (p.palette === 'clash') clash++;
    }
    expect(to / N).toBeGreaterThan(0.2); expect(to / N).toBeLessThan(0.36);
    expect(gr / N).toBeLessThanOrEqual(0.15);
    expect(mono / N).toBeGreaterThan(0.22); expect(mono / N).toBeLessThan(0.38);
    expect(clash / N).toBeGreaterThan(0.02); expect(clash / N).toBeLessThan(0.11);
  });
  it('planV2 off restores the legacy behaviour', () => {
    const p = drawPlan('x', { ...DEFAULT_PARAMS, planV2: false } as never, { modes: new Set(), canDropImages: true, retro: false, paletteFree: true });
    expect(p.v2).toBe(false);
  });
});

describe('phase 4 compositions', () => {
  const comps = ['typo', 'edge', 'ghost', 'bento', 'veil', 'mosaic', 'inset'];
  const ratios: Ratio[] = ['3:4', '1:1', '16:9', '9:16', '21:9'];
  it('every new composition renders on every ratio with finite geometry', () => {
    for (const c of comps) for (const [k, ra] of ratios.entries()) {
      const { scene } = run(c + k, ra, k * 7 + 3, c);
      const svg = renderSVG(scene);
      expect(svg).not.toMatch(/NaN|undefined/);
      walk(scene.nodes, (n) => { if ('x' in n) { expect(Number.isFinite((n as { x: number }).x)).toBe(true); } });
    }
  });
  it('random draws are mostly flat and use many compositions', () => {
    const used = new Set<string>(); let grain = 0; const N = 80;
    for (let i = 0; i < N; i++) {
      const { scene } = run('R' + i, (['3:4', '1:1', '4:3', '9:16'] as Ratio[])[i % 4], i);
      used.add(String(scene.info.comp));
      const plan = scene.info.plan as { grain: number } | undefined;
      if (plan && plan.grain > 0) grain++;
    }
    expect(used.size).toBeGreaterThanOrEqual(10); // phase 5: sub-7 layouts were deliberately down-weighted (was 12)
    expect(grain / N).toBeLessThan(0.3);
  });
});
