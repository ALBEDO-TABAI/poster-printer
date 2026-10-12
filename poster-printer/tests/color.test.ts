import { describe, expect, it } from 'vitest';
import { hexToRgb, rgbToHex, rgbToLab, labToRgb, mix, deltaE, hexToLch, lchToHex } from '../src/engine/color/convert';
import { wcag, apca, relLum, bestText } from '../src/engine/color/contrast';
import { extractPalette } from '../src/engine/color/extract';
import { buildPalette, textOn, type ColorMode } from '../src/engine/color/palette';
import { Rng } from '../src/engine/rng';
import { readFileSync } from 'node:fs';

describe('conversions', () => {
  it('hex <-> rgb round trip', () => {
    for (const h of ['#000000', '#ffffff', '#1db385', '#ff4f2b', '#123456']) expect(rgbToHex(hexToRgb(h))).toBe(h);
  });
  it('rgb -> lab -> rgb is stable', () => {
    for (const c of [[0, 0, 0], [255, 255, 255], [200, 30, 60], [12, 180, 99]] as [number, number, number][]) {
      const back = labToRgb(rgbToLab(c));
      back.forEach((v, i) => expect(Math.abs(v - c[i])).toBeLessThanOrEqual(1));
    }
  });
  it('white has L=100, black L=0', () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 0);
  });
  it('lch round trip & gamut clamp', () => {
    const [L, C, H] = hexToLch('#3c78d8');
    expect(deltaE(lchToHex(L, C, H), '#3c78d8')).toBeLessThan(1.5);
    expect(lchToHex(60, 200, 30)).toMatch(/^#[0-9a-f]{6}$/); // out-of-gamut request still valid
  });
  it('mix endpoints', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
  });
});

describe('contrast', () => {
  it('WCAG black/white = 21', () => { expect(wcag('#000000', '#ffffff')).toBeCloseTo(21, 1); });
  it('WCAG symmetric and 1 for same colour', () => {
    expect(wcag('#336699', '#ffffff')).toBeCloseTo(wcag('#ffffff', '#336699'), 6);
    expect(wcag('#abcdef', '#abcdef')).toBeCloseTo(1, 6);
  });
  it('relative luminance bounds', () => { expect(relLum('#000000')).toBe(0); expect(relLum('#ffffff')).toBeCloseTo(1, 5); });
  it('APCA polarity: dark on light positive, light on dark negative', () => {
    expect(apca('#000000', '#ffffff')).toBeGreaterThan(100);
    expect(apca('#ffffff', '#000000')).toBeLessThan(-100);
  });
  it('bestText picks a passing candidate', () => {
    const t = bestText('#f4f1ea', ['#f0f0f0', '#222222']);
    expect(t).toBe('#222222');
  });
});

describe('k-means extraction', () => {
  it('recovers dominant colours of a synthetic image', () => {
    const px: number[] = [];
    for (let i = 0; i < 3000; i++) px.push(220, 40, 40, 255);
    for (let i = 0; i < 1500; i++) px.push(20, 60, 200, 255);
    for (let i = 0; i < 500; i++) px.push(250, 250, 240, 255);
    const sw = extractPalette(px, 3);
    expect(sw[0].weight).toBeGreaterThan(sw[1].weight);
    expect(deltaE(sw[0].hex, '#dc2828')).toBeLessThan(3);
    expect(sw.some((s) => deltaE(s.hex, '#143cc8') < 3)).toBe(true);
  });
  it('is deterministic', () => {
    const px: number[] = [];
    const r = new Rng('img');
    for (let i = 0; i < 5000; i++) px.push(r.int(0, 255), r.int(0, 255), r.int(0, 255), 255);
    expect(extractPalette(px, 5).map((s) => s.hex)).toEqual(extractPalette(px, 5).map((s) => s.hex));
  });
});

describe('palette roles', () => {
  const lib = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8')) as { colors: string[] }[];
  it('library is large and well-formed', () => {
    expect(lib.length).toBeGreaterThan(1000);
    for (const p of lib.slice(0, 200)) for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
  for (const mode of ['normal', 'random', 'experimental'] as ColorMode[]) {
    it(`${mode}: ink is legible on bg for 300 library palettes`, () => {
      let fails = 0;
      for (let i = 0; i < 300; i++) {
        const r = new Rng(mode + i);
        const p = buildPalette(lib[(i * 7) % lib.length].colors, mode, r, { source: 'test' });
        expect(p.bg).toMatch(/^#[0-9a-f]{6}$/);
        if (wcag(p.ink, p.bg) < 4.5) fails++;
        for (const f of p.fills) { const t = textOn(f, p, 3); if (wcag(t, f) < 3) fails++; }
      }
      expect(fails).toBe(0);
    });
  }
  it('soft mode lowers chroma', () => {
    const src = ['#ff0055', '#00c2ff', '#ffe600', '#111111'];
    const a = buildPalette(src, 'normal', new Rng('s'), { source: 't' });
    const b = buildPalette(src, 'normal', new Rng('s'), { source: 't', soft: true });
    expect(hexToLch(b.accent)[1]).toBeLessThanOrEqual(hexToLch(a.accent)[1] + 1);
  });
});

import { hexToOklch, oklchToHex, isTasteful, maxTasteChroma } from '../src/engine/color/oklch';
describe('OKLCH + experimental taste bounds', () => {
  it('oklch round trip is close', () => {
    for (const h of ['#ff4f2b', '#1db385', '#3a5fcd', '#808080', '#f2efe9']) {
      const [L, C, H] = hexToOklch(h);
      expect(deltaE(oklchToHex(L, C, H), h)).toBeLessThan(1.5);
    }
  });
  it('gamut mapping always yields valid sRGB', () => {
    const rng = new Rng('gamut');
    for (let i = 0; i < 500; i++) expect(oklchToHex(rng.range(0, 1), rng.range(0, 0.4), rng.range(0, 360))).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('cyan band is capped tighter than red', () => {
    expect(maxTasteChroma(0.7, 200)).toBeLessThan(maxTasteChroma(0.6, 30));
  });
  it('experimental palettes stay within perceptual bounds and AA', () => {
    const rng = new Rng('exp-bounds');
    const srcs = [['#00e5ff', '#00ffcc', '#ff00ff'], ['#39ff14', '#00ffff', '#ffff00'], ['#ff4f2b', '#1d3557', '#f1faee'], ['#0ff', '#08f', '#f0f']];
    for (let i = 0; i < 300; i++) {
      const p = buildPalette(srcs[i % srcs.length], 'experimental', rng, { source: 'image' });
      expect(isTasteful(p.accent, 0.02)).toBe(true);
      expect(wcag(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
      const [L, C, h] = hexToOklch(p.bg);
      if (h > 170 && h < 235) expect(C).toBeLessThan(0.12);
      expect(L).toBeGreaterThan(0.15);
    }
  });
});
