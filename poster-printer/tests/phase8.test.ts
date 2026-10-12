import { describe, it, expect } from 'vitest';
import { generate } from '../src/engine/generate';
import { BUILTIN_STYLES } from '../src/data/styles';
import { semanticBreak } from '../src/engine/p8/typeset';
import { semanticsOf } from '../src/engine/p8/semantic';
import type { TextNode } from '../src/engine/types';
import { input, finite, LINEUP, RATIOS } from './p8util';

describe('phase 8 semantic line breaking', () => {
  it('keeps EN phrases together and never strands function words', () => {
    const l = semanticBreak('A Night of Low Frequencies', { k: 2, profile: 'even', width: (s) => s.length })!;
    expect(l.length).toBe(2);
    for (const x of l) expect(x.trim()).not.toMatch(/\b(of|a|the)$/i);
  });
  it('breaks a CN title on a phrase boundary, no punctuation at line start', () => {
    const l = semanticBreak('城市夜间步行计划', { k: 2, profile: 'even', width: (s) => s.length })!;
    expect(l.join('')).toBe('城市夜间步行计划');
    expect(l[0].length % 2).toBe(0);
    const p = semanticBreak('夜航，城市的另一面', { k: 2, profile: 'even', width: (s) => s.length })!;
    for (const x of p) expect(x[0]).not.toMatch(/[，。、]/);
  });
});

describe('phase 8 strategies', () => {
  for (const comp of ['typeled', 'interleave', 'programme', 'exhibit']) {
    it(`${comp}: finite geometry, semantics stored, every ratio`, () => {
      for (const [i, ratio] of RATIOS.entries()) for (const s of [0, 1, 2]) {
        const r = generate(input(`p8${comp}${i}${s}`, ratio, BUILTIN_STYLES[(i * 5 + s) % BUILTIN_STYLES.length].id, comp));
        expect(finite(r.scene.nodes)).toBe(true);
        const sem = r.scene.info.sem as { strategy: string; roles: Record<string, string> } | undefined;
        expect(sem).toBeTruthy();
        expect(Object.values(sem!.roles)).toContain('headline');
        expect(r.ms).toBeLessThan(2500); // sanity only: the shared box can be heavily loaded; e2e owns the timing budget
      }
    });
  }
  it('real content: uses exactly the given items, no filler copy', () => {
    for (const comp of ['typeled', 'programme']) for (let s = 0; s < 4; s++) {
      const r = generate(input(`p8c${comp}${s}`, '3:4', BUILTIN_STYLES[s].id, comp, { custom: LINEUP }));
      const txt = (r.scene.nodes.filter((n) => n.kind === 'text') as TextNode[]).map((t) => t.raw).join(' ');
      const allowed = [LINEUP.headline, LINEUP.sub, ...LINEUP.small, ...LINEUP.meta].join(' ');
      for (const t of r.scene.nodes.filter((n) => n.kind === 'text') as TextNode[]) if (t.raw.length > 3 && t.role !== 'glyph') expect(allowed.replace(/\s+/g, '')).toContain(t.raw.replace(/\s+/g, '').slice(0, 4));
      expect(txt.length).toBeGreaterThan(10);
    }
  });
  it('a capacity overflow switches structure instead of shrinking type', () => {
    const r = generate(input('p8sw', '3:4', BUILTIN_STYLES[0].id, 'typeled', { custom: LINEUP }));
    const sem = r.scene.info.sem as { strategy: string };
    expect(['typeled', 'programme']).toContain(sem.strategy);
    const big = Math.max(...(r.scene.nodes.filter((n) => n.kind === 'text') as TextNode[]).map((t) => t.size));
    expect(big / Math.min(r.scene.w, r.scene.h)).toBeGreaterThan(0.06);
  });
  it('semantics serialise and are inferred for legacy scenes', () => {
    const r = generate(input('p8leg', '3:4', BUILTIN_STYLES[2].id, 'edge'));
    expect(r.scene.info.sem).toBeUndefined();
    const sem = semanticsOf(r.scene);
    expect(Object.values(sem.roles)).toContain('headline');
    const r2 = generate(input('p8ser', '3:4', BUILTIN_STYLES[2].id, 'programme', { custom: LINEUP }));
    const back = JSON.parse(JSON.stringify(r2.scene));
    expect(semanticsOf(back)).toEqual(r2.scene.info.sem);
  });
});

describe('phase 8 search', () => {
  it('routes, mutations and archive; replays exactly; deterministic', () => {
    const routes: Record<string, number> = {};
    for (const [i, ratio] of RATIOS.entries()) for (const s of [0, 1]) {
      const inp = input(`p8s${i}${s}`, ratio, BUILTIN_STYLES[(i * 3 + s) % BUILTIN_STYLES.length].id, 'auto', { select: 8, selectMode: 'taste' });
      const a = generate(inp), b = generate(inp);
      expect(JSON.stringify(a.scene)).toBe(JSON.stringify(b.scene));
      expect(a.archive?.length).toBeGreaterThan(0);
      routes[a.picked.route ?? '?'] = (routes[a.picked.route ?? '?'] ?? 0) + 1;
      const replay = generate({ ...(inp as object), seeds: a.seeds, forceComp: a.picked.comp, forcePlan: a.picked.plan, forceIdea: a.picked.idea, layoutSalt: a.picked.salt, forceAttempt: a.picked.attempt, select: 0 } as never);
      expect(JSON.stringify(replay.scene)).toBe(JSON.stringify(a.scene));
    }
    expect(Object.keys(routes).length).toBeGreaterThan(0);
  }, 120000);
});
