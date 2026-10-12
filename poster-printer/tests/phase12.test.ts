import { describe, it, expect } from 'vitest';
import { breakLines, breakBalanced, tokenize, widowKind } from '../src/engine/text/breaker';
import { approxMeasurer, sizeBucket } from '../src/engine/text/measure';
import { renderSVG, SVG_TYPE_RESET } from '../src/engine/render/svg';

const wf = (t: string) => approxMeasurer.width(t, { family: 'x', weight: 400, size: 10 });

describe('phase 12 typesetting', () => {
  it('numbers bind to the word before them; short units / letters ride along', () => {
    expect(tokenize('Track 01').map((t) => t.t)).toEqual(['Track 01']);
    expect(tokenize('Steep 3 Min').map((t) => t.t)).toEqual(['Steep 3 Min']);
    expect(tokenize('Side B').map((t) => t.t)).toEqual(['Side B']);
    expect(tokenize('a cup of tea').map((t) => t.t)).toEqual(['a', 'cup', 'of', 'tea']);
  });
  it('never strands a lone number group', () => {
    for (let w = 20; w < 120; w += 3) for (const s of ['Opening Night 2026', 'Sheet 2/6', 'Gallery 3 Hall 12']) {
      const ls = breakLines(s, w, wf);
      expect(ls.some((l) => /^[\d./:]+$/.test(l.trim()))).toBe(false);
    }
  });
  it('widowKind', () => {
    expect(widowKind(['What the river', 'keeps'], 'en', wf)).toBe('en-short');
    expect(widowKind(['Print', 'Room'], 'en', wf)).toBe(null); // balanced one-word stack
    expect(widowKind(['TRACK', '01'], 'en', wf)).toBe('number');
    expect(widowKind(['青色寂', '静'], 'zh', wf)).toBe('zh-short');
    expect(widowKind(['青色', '寂静'], 'zh', wf)).toBe(null);
  });
  it('balanced breaking keeps the line count and evens the lines', () => {
    const ls = breakBalanced('What the river keeps', 70, wf);
    expect(widowKind(ls, 'en', wf)).toBe(null);
  });
  it('size buckets are monotone and close', () => {
    let prev = 0;
    for (let s = 4; s < 200; s += 0.7) { const b = sizeBucket(s); expect(b).toBeGreaterThanOrEqual(prev); prev = b; if (s > 5 && s < 72) expect(Math.abs(b - s) / s).toBeLessThan(0.03); }
  });
  it('inline posters reset inherited page typography; double spaces survive', () => {
    const svg = renderSVG({ w: 100, h: 100, bg: '#fff', palette: {} as never, info: {}, nodes: [{ kind: 'text', id: 't', layer: 'text', role: 'small.note', lang: 'en', lines: [{ text: 'NO. 1  ·  2026', x: 0, y: 10 }], size: 10, family: 'Inter', weight: 400, tracking: 0, fill: '#000', anchor: 'start', box: { x: 0, y: 0, w: 50, h: 10 }, raw: 'NO. 1  ·  2026' }] } as never);
    expect(svg).toContain(SVG_TYPE_RESET);
    expect(svg).toContain('xml:space="preserve"');
  });
});

import { balanceOf, pairWeights, density } from '../src/engine/aesthetic/balance';
describe('phase 12 optical balance', () => {
  const T = (id: string, x: number, y: number, size: number, weight: number, role = 'small.note', family = 'Inter') => ({ kind: 'text', id, layer: 'text', role, lang: 'en', lines: [{ text: 'Hello world', x, y }], size, family, weight, tracking: 0, fill: '#111111', anchor: 'start', box: { x, y: y - size, w: size * 6, h: size * 1.2 }, raw: 'Hello world' });
  it('density grows with weight', () => { expect(density(900)).toBeGreaterThan(density(400)); expect(density(400)).toBeGreaterThan(density(200)); });
  it('a heavy block floating off-centre is lopsided; anchored to the edge it is not', () => {
    const floating = { w: 1000, h: 1000, bg: '#ffffff', palette: {} as never, info: {}, nodes: [T('a', 120, 300, 120, 900, 'big.main', 'Anton'), T('b', 600, 900, 10, 200)] };
    expect(balanceOf(floating as never, approxMeasurer).lopsided).toBe(true);
    const anchored = { ...floating, nodes: [T('a', 10, 140, 120, 900, 'big.main', 'Anton'), T('b', 600, 900, 10, 200)] };
    expect(balanceOf(anchored as never, approxMeasurer).anchored).toBe(true);
  });
  it('weight-jump rule lifts hairline info under a heavy display without widening it', () => {
    const sc = { w: 1000, h: 1000, bg: '#ffffff', palette: {} as never, info: {}, nodes: [T('a', 50, 200, 140, 900, 'big.main'), T('b', 50, 900, 12, 200)] } as never;
    const before = approxMeasurer.width('Hello world', { family: 'Inter', weight: 200, size: 12 });
    expect(pairWeights(sc, approxMeasurer)).toBe(1);
    const b = (sc as { nodes: { weight: number; size: number }[] }).nodes[1];
    expect(b.weight).toBe(400);
    expect(approxMeasurer.width('Hello world', { family: 'Inter', weight: 400, size: b.size })).toBeLessThanOrEqual(before + 1e-6);
  });
});
