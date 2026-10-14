// Phase 19: the palette editor — the user's own colours on top of a drawn palette.
import { describe, expect, it } from 'vitest';
import { generate, type GenInput, type GenResult } from '../src/engine/generate';
import { withRoles, cleanEdits, normHex, coreOf, type Palette } from '../src/engine/color/palette';
import { wcag } from '../src/engine/color/contrast';
import type { SceneNode } from '../src/engine/types';
import { input, RATIOS } from './p8util';

const flat = (ns: SceneNode[], out: SceneNode[] = []): SceneNode[] => { for (const n of ns) { if (n.kind === 'group') flat(n.children, out); else out.push(n); } return out; };
const keepOf = (inp: GenInput, a: GenResult): GenInput => {
  const pk = a.picked;
  return { ...inp, forceComp: pk.comp, forcePlan: pk.plan, forceIdea: pk.idea, forceKind: pk.kind, avoid: pk.avoid, layoutSalt: pk.salt, forceAttempt: pk.attempt ?? 0, lockedImages: pk.imageIds, lockedTexts: pk.texts, lockedPalette: pk.palette, layers: pk.layers ?? null, select: 0 };
};
const geometry = (r: GenResult) => JSON.stringify(flat(r.scene.nodes).map((n) => [n.id, Math.round((n as { x?: number }).x ?? 0), Math.round((n as { y?: number }).y ?? 0)]));
const base: Palette = { bg: '#0b2a4a', ink: '#f4efe6', inkSoft: '#c9c4ba', accent: '#e8603c', alt: '#3d6e8f', fills: ['#e8603c', '#3d6e8f', '#c9a227'], light: '#f7f4ee', dark: '#10161d', source: 'test', sourceColors: ['#0b2a4a', '#e8603c'] };

describe('withRoles', () => {
  it('uses every colour the user set exactly', () => {
    const p = withRoles(base, { bg: '#F3E9D2', accent: '#e4002b', alt: '#123456', ink: '#111111', inkSoft: '#555555' });
    expect([p.bg, p.accent, p.alt, p.ink, p.inkSoft]).toEqual(['#f3e9d2', '#e4002b', '#123456', '#111111', '#555555']);
    expect(p.user?.base).toEqual(coreOf(base));
  });
  it('gives a changed ground a text colour that reads on it, and a matching soft ink', () => {
    const p = withRoles(base, { bg: '#f3e9d2' }); // the drawn ink is near-white: it no longer reads
    expect(wcag(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcag(p.inkSoft, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(p.user?.edits).toEqual({ bg: '#f3e9d2' }); // only the user's colour counts as theirs
  });
  it('lets block fills follow a changed accent / alt, and sets one fill by its place', () => {
    const p = withRoles(base, { accent: '#e4002b', f2: '#00ff00' });
    expect(p.fills).toEqual(['#e4002b', '#3d6e8f', '#00ff00']);
  });
  it('is deterministic, idempotent and resets with fewer edits', () => {
    const e = { bg: '#f3e9d2', accent: '#e4002b' };
    const a = withRoles(base, e);
    expect(withRoles(a, e)).toEqual(a);
    expect(withRoles(withRoles(a, { accent: '#e4002b' }), e)).toEqual(a);
    const r = withRoles(a, {});
    expect(r.user).toBeUndefined();
    expect(coreOf(r)).toEqual(coreOf(base));
    expect(withRoles(base, {})).toBe(base); // a palette without user colours is returned untouched
  });
  it('keeps only valid colours and keys', () => {
    expect(normHex('ABC')).toBe('#aabbcc');
    expect(normHex('#E4002B')).toBe('#e4002b');
    expect(normHex('purple')).toBeNull();
    expect(cleanEdits({ bg: 'nope', ink: '#000', f7: '#ffffff', zz: '#ffffff' } as never)).toEqual({ ink: '#000000' });
  });
});

describe('the generator with user colours', () => {
  const cases = Array.from({ length: 12 }, (_, k) => input(`PE${k}`, RATIOS[k % RATIOS.length], ['neue-grid', 'zh-modern-song', 'zh-hk-mag'][k % 3], k % 2 ? 'build' : 'auto') as GenInput);
  it('a new draw takes the colours (and its layout is the one it would have had)', () => {
    for (const inp of cases.slice(0, 6)) {
      const plain = generate(inp);
      const r = generate({ ...inp, paletteEdits: { bg: '#f3e9d2', accent: '#e4002b' } });
      expect(r.picked.palette.bg).toBe('#f3e9d2');
      expect(r.picked.palette.accent).toBe('#e4002b');
      expect(r.scene.bg === '#f3e9d2' || !inp.modules.bg).toBe(true);
      expect(r.picked.palette.user?.base.bg).toBe(plain.picked.palette.bg);
    }
  });
  it('an edit on a kept poster changes colours only — every node stays where it was', () => {
    for (const inp of cases) {
      const a = generate(inp);
      const k = keepOf(inp, a);
      const b = generate({ ...k, paletteEdits: { bg: '#f3e9d2', ink: '#1a1a1a', accent: '#e4002b' } });
      expect(geometry(b), inp.seeds.layout).toBe(geometry(a));
      expect(b.picked.palette.bg).toBe('#f3e9d2');
    }
  });
  it('replays exactly: stored edits are used when none are passed, {} resets to the drawn palette', () => {
    for (const inp of cases.slice(0, 6)) {
      const a = generate(inp);
      const e = { bg: '#f3e9d2', f1: '#1d4ed8' };
      const b = generate({ ...keepOf(inp, a), paletteEdits: e });
      const again = generate({ ...keepOf(inp, b), paletteEdits: e });
      expect(JSON.stringify(again.scene)).toBe(JSON.stringify(b.scene));
      const cli = generate({ ...keepOf(inp, b), paletteEdits: undefined }); // other callers (CLI, deck) pass none
      expect(JSON.stringify(cli.scene)).toBe(JSON.stringify(b.scene));
      const reset = generate({ ...keepOf(inp, b), paletteEdits: {} });
      expect(JSON.stringify(reset.scene)).toBe(JSON.stringify(generate({ ...keepOf(inp, a), paletteEdits: {} }).scene));
      expect(reset.picked.palette.user).toBeUndefined();
    }
  });
  it('leaves posters without user colours exactly as before', () => {
    for (const inp of cases) {
      const a = generate(inp);
      expect(a.picked.palette.user).toBeUndefined();
      const b = generate({ ...keepOf(inp, a), paletteEdits: {} });
      const c = generate(keepOf(inp, a));
      expect(JSON.stringify(b.scene)).toBe(JSON.stringify(c.scene));
    }
  });
  it('never sets text in a user ink that cannot be read on the user ground', () => {
    for (const inp of cases) {
      const a = generate(inp);
      const g = a.picked.palette.bg;
      const b = generate({ ...keepOf(inp, a), paletteEdits: { ink: g } });
      expect(b.picked.quality?.lowContrast ?? 0, inp.seeds.layout).toBe(0);
    }
  });
});
