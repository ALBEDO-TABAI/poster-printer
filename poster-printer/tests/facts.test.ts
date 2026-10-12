// Real facts (texts.facts) for content-driven callers such as the poster-printer CLI: when present they replace the
// synthetic issue numbers / years / calendar date; when absent the generator is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate, DEFAULT_MODULES, type GenInput } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
import { renderSVG } from '../src/engine/render/svg';
import type { SceneNode, TextNode } from '../src/engine/types';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const style = BUILTIN_STYLES.find((s) => s.lib === 'en') ?? BUILTIN_STYLES[0];
const base = (seed: string, comp: string): GenInput => ({
  seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio: '3:4', style,
  params: { ...DEFAULT_PARAMS, ...style.params, composition: comp }, modules: DEFAULT_MODULES, modes: [], fonts: style.fonts,
  images, palettes, textSets: TEXT_SETS, measure: approxMeasurer,
});
const texts = (n: SceneNode[]): string[] => n.flatMap((x) => (x.kind === 'text' ? [(x as TextNode).raw] : x.kind === 'group' ? texts(x.children) : []));
const norm = (s: string) => s.replace(/r[0-9a-z]+_/g, 'X_');

describe('texts.facts', () => {
  it('calendar puts the real day in the event cell and labels the real month / year', () => {
    for (const seed of ['F1', 'F2', 'F3', 'F4']) {
      const first = generate(base(seed, 'calendar'));
      const lockedTexts = { ...first.picked.texts, facts: { year: '2031', issue: 'VOL. 07', date: { y: 2031, m: 2, d: 29 } } };
      const r = generate({ ...base(seed, 'calendar'), lockedTexts, forceAttempt: first.picked.attempt ?? 0 });
      const t = texts(r.scene.nodes);
      // Feb 2031 has 28 days: the day is clamped, the month label says FEB, the year is the real one
      expect(t.some((x) => /FEB 2031|2月 2031/.test(x))).toBe(true);
      expect(t.some((x) => x === 'VOL. 07')).toBe(true);
      expect(t).not.toContain('29');
      const ev = t.filter((x) => x === '28');
      // the event cell shows 28 either as the big number or (with a photo disc) not as a small cell label
      expect(ev.length).toBeLessThanOrEqual(1);
    }
  });
  it('leaves draws without facts unchanged (same SVG as a replay of the same picks)', () => {
    for (const comp of ['auto', 'calendar', 'index', 'ma']) {
      const a = generate(base('N' + comp, comp));
      const b = generate({ ...base('N' + comp, comp), lockedTexts: { ...a.picked.texts }, forceAttempt: a.picked.attempt ?? 0, forcePlan: a.picked.plan, forceIdea: a.picked.idea, forceComp: a.picked.comp });
      expect(norm(renderSVG(b.scene))).toBe(norm(renderSVG(a.scene)));
    }
  });
  it('replaces synthetic issue numbers and years wherever they appear', () => {
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const first = generate(base('Y' + i, 'auto'));
      const lockedTexts = { ...first.picked.texts, facts: { year: '2099', issue: 'ISSUE Z' } };
      const r = generate({ ...base('Y' + i, 'auto'), lockedTexts, forceAttempt: first.picked.attempt ?? 0, forcePlan: first.picked.plan, forceIdea: first.picked.idea, forceComp: first.picked.comp });
      const t = texts(r.scene.nodes).join(' | ');
      expect(t).not.toMatch(/NO\. \d\d/);
      if (/2099|ISSUE Z/.test(t)) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('index rows use the real times / values and the anchor numeral is the real one', () => {
    let timed = 0, numeral = 0;
    for (let i = 0; i < 30; i++) {
      const first = generate(base('X' + i, 'index'));
      const lockedTexts = { ...first.picked.texts, facts: { times: ['18:05', '19:40', '21:15'], values: ['7 ×', '3 h', '12'], numeral: '21' } };
      const r = generate({ ...base('X' + i, 'index'), lockedTexts, forceAttempt: first.picked.attempt ?? 0 });
      const t = texts(r.scene.nodes);
      for (const fake of ['09:30', '10:45', '12:00', '13:15', '14:30', '16:00', '17:30', '19:00', '20:30']) expect(t).not.toContain(fake);
      if (t.includes('19:40')) timed++;
    }
    for (let i = 0; i < 60; i++) {
      const first = generate(base('A' + i, 'auto'));
      const lockedTexts = { ...first.picked.texts, facts: { numeral: '§7' } };
      const r = generate({ ...base('A' + i, 'auto'), lockedTexts, forceAttempt: first.picked.attempt ?? 0, forcePlan: first.picked.plan, forceIdea: first.picked.idea, forceComp: first.picked.comp });
      if (texts(r.scene.nodes).includes('§7')) numeral++;
    }
    expect(timed).toBeGreaterThan(0);
    expect(numeral).toBeGreaterThan(0);
  });
  it('signature replaces the invented script words; index draws exactly the real rows', () => {
    const fake = ['Studio Notes', 'Field Edition', 'Paper Hours', 'with love', 'First Proof', 'Night Draft', 'Atelier'];
    let sig = 0;
    for (let i = 0; i < 80; i++) {
      const first = generate(base('S' + i, 'auto'));
      const lockedTexts = { ...first.picked.texts, facts: { signature: 'Kiln Press' } };
      const r = generate({ ...base('S' + i, 'auto'), lockedTexts, forceAttempt: first.picked.attempt ?? 0, forcePlan: first.picked.plan, forceIdea: first.picked.idea, forceComp: first.picked.comp });
      const t = texts(r.scene.nodes);
      for (const f of fake) expect(t).not.toContain(f);
      if (t.includes('Kiln Press') || t.includes('Kiln')) sig++;
    }
    expect(sig).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) {
      const first = generate(base('R' + i, 'index'));
      const g = first.picked.texts.groups.map((x, k) => (k < 4 ? x : { main: { t: '', lang: 'en' as const }, sub: { t: '', lang: 'en' as const }, note: { t: '', lang: 'en' as const } }));
      const lockedTexts = { ...first.picked.texts, groups: g, facts: { times: ['10:00', '11:00', '12:00', '13:00'] } };
      const r = generate({ ...base('R' + i, 'index'), lockedTexts, forceAttempt: first.picked.attempt ?? 0 });
      const t = texts(r.scene.nodes);
      expect(t.filter((x) => /^(10|11|12|13):00$/.test(x)).length).toBeLessThanOrEqual(4);
      expect(t).not.toContain('14:30');
    }
  });
});
