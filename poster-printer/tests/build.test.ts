// Phase 18: the construction engine (src/engine/build/) — properties every page must keep.
import { describe, expect, it } from 'vitest';
import { generate, type GenInput, type GenResult } from '../src/engine/generate';
import type { SceneNode, TextNode } from '../src/engine/types';
import { LIBRARY, instantiate } from '../src/engine/build/library';
import { ARCHETYPES } from '../src/engine/build/compose';
import { PARAMS } from '../src/engine/params';
import { breakTitle, pickBreak } from '../src/engine/build/lines';
import { dateParts } from '../src/engine/build/copy';
import { Rng } from '../src/engine/rng';
import { input, RATIOS, LINEUP } from './p8util';

const STYLES = ['neue-grid', 'zh-modern-song', 'editorial-play', 'instrument', 'zh-hk-mag', 'didone-salon'];
const flat = (ns: SceneNode[], out: SceneNode[] = []): SceneNode[] => { for (const n of ns) { if (n.kind === 'group') flat(n.children, out); else out.push(n); } return out; };
const texts = (r: GenResult) => flat(r.scene.nodes).filter((n): n is TextNode => n.kind === 'text');
const keepOf = (inp: GenInput, a: GenResult): GenInput => {
  const pk = a.picked;
  return { ...inp, forceComp: pk.comp, forcePlan: pk.plan, forceIdea: pk.idea, forceKind: pk.kind, avoid: pk.avoid, layoutSalt: pk.layoutSalt, forceAttempt: pk.attempt ?? 0, lockedImages: pk.imageIds, lockedTexts: pk.texts, lockedPalette: pk.palette, layers: pk.layers ?? null };
};
/** the poster's words joined (mixed lines are set as runs, one node per script run) */
const words = (r: GenResult) => texts(r).map((t) => t.lines.map((l) => l.text).join(' ')).join(' ').replace(/\s+/g, '').toLowerCase();

function cases(): { inp: GenInput; tag: string }[] {
  const out: { inp: GenInput; tag: string }[] = [];
  for (let k = 0; k < 60; k++) {
    const ratio = RATIOS[k % RATIOS.length], style = STYLES[k % STYLES.length];
    const extra: Record<string, unknown> = {};
    if (k % 4 === 3) extra.modules = { ...(input('x', ratio, style) as GenInput).modules, images: false };
    if (k % 5 === 4) extra.custom = LINEUP;
    out.push({ inp: input(`B${k}`, ratio, style, 'build', extra) as GenInput, tag: `${k} ${ratio} ${style}${extra.custom ? ' custom' : ''}${k % 4 === 3 ? ' noimg' : ''}` });
  }
  return out;
}

describe('construction engine pages', () => {
  const all = cases().map((c) => ({ ...c, r: generate(c.inp) }));
  it('always set the title, never repeat a line, keep text on the canvas and legible', () => {
    for (const { r, tag } of all) {
      const T = texts(r);
      const title = r.picked.texts.headline.t.replace(/\s+/g, '').toLowerCase();
      // the title is on the page (possibly split into lines or runs)
      expect(words(r).includes(title) || Array.from(title).every((ch) => words(r).includes(ch)), tag).toBe(true);
      // no long line appears twice
      const seen = new Map<string, number>();
      for (const t of T) { const s = t.lines.map((l) => l.text).join('').trim(); if (s.length >= 4 && !/^[\d.:\-/ ]+$/.test(s)) seen.set(s, (seen.get(s) ?? 0) + 1); }
      for (const [s, n] of seen) expect(n, `${tag}: "${s}" ×${n}`).toBe(1);
      // inside the canvas, legible
      const S = Math.min(r.scene.w, r.scene.h);
      for (const t of T) {
        if (t.rotate) continue;
        expect(t.box.x, `${tag} ${t.raw}`).toBeGreaterThan(-2);
        expect(t.box.x + t.box.w, `${tag} ${t.raw}`).toBeLessThan(r.scene.w + 2);
        expect(t.box.y, `${tag} ${t.raw}`).toBeGreaterThan(-2);
        expect(t.box.y + t.box.h, `${tag} ${t.raw}`).toBeLessThan(r.scene.h + 2);
        expect(t.size, `${tag} ${t.raw}`).toBeGreaterThanOrEqual(S * 0.0095);
      }
    }
  });
  it('replay exactly and record their page archetype', () => {
    for (const { inp, r, tag } of all.slice(0, 24)) {
      expect(r.picked.kind, tag).toMatch(/^build:/);
      const b = generate(keepOf(inp, r));
      expect(JSON.stringify(b.scene.nodes), tag).toBe(JSON.stringify(r.scene.nodes));
    }
  });
  it('mostly pass the hard gates', () => {
    const fails = all.filter(({ r }) => ((r.scene.info.gates as { fails?: string[] })?.fails ?? []).length);
    expect(fails.length / all.length).toBeLessThan(0.15);
  });
  it('a type re-roll changes the text group and keeps every picture frame', () => {
    let changed = 0;
    for (const { inp, r } of all.slice(0, 20)) {
      const b = generate({ ...keepOf(inp, r), reroll: { layer: 'type', salt: 't1', base: r.scene } });
      const pics = (x: GenResult) => flat(x.scene.nodes).filter((n) => n.kind === 'image' && !(n as { cutout?: boolean }).cutout).map((n) => JSON.stringify([(n as { x: number }).x, (n as { y: number }).y, (n as { w: number }).w, (n as { h: number }).h])).join('|');
      expect(pics(b)).toBe(pics(r));
      if (words(b) !== words(r) || JSON.stringify(texts(b).map((t) => [Math.round(t.box.x), Math.round(t.box.y), Math.round(t.size)])) !== JSON.stringify(texts(r).map((t) => [Math.round(t.box.x), Math.round(t.box.y), Math.round(t.size)]))) changed++;
    }
    expect(changed).toBeGreaterThanOrEqual(17);
  });
  it('a type re-roll moves to another construction, a placement re-roll to another archetype, and both replay exactly', () => {
    const v = (x: GenResult, k: string) => String((x.scene.info.sem as { vars?: Record<string, { value?: unknown }> } | undefined)?.vars?.[k]?.value ?? '');
    let newC = 0, newK = 0, n = 0;
    for (const { inp, r } of all.slice(0, 16)) {
      const t = generate({ ...keepOf(inp, r), reroll: { layer: 'type', salt: 'tt', base: r.scene } });
      const p = generate({ ...keepOf(inp, r), reroll: { layer: 'place', salt: 'pp', base: r.scene } });
      n++;
      // (a giant two / four character block has no construction to change)
      if (!v(r, 'construction') || v(t, 'construction') !== v(r, 'construction')) newC++;
      if (p.picked.kind !== r.picked.kind) newK++;
      for (const b of [t, p]) expect(JSON.stringify(generate(keepOf(inp, b)).scene.nodes)).toBe(JSON.stringify(b.scene.nodes));
    }
    expect(newC).toBeGreaterThanOrEqual(n - 2);
    expect(newK).toBeGreaterThanOrEqual(n - 2);
  });
  it('a grid re-roll keeps the archetype and mostly the construction, and moves the page onto another grid', () => {
    const v = (x: GenResult, k: string) => String((x.scene.info.sem as { vars?: Record<string, { value?: unknown }> } | undefined)?.vars?.[k]?.value ?? '');
    let moved = 0, sameC = 0, n = 0;
    for (const { inp, r } of all.slice(0, 20)) {
      const b = generate({ ...keepOf(inp, r), reroll: { layer: 'grid', salt: 'g1', base: r.scene } });
      expect(b.picked.kind).toBe(r.picked.kind);
      if (!v(r, 'construction')) continue;
      n++;
      if (v(b, 'construction') === v(r, 'construction')) sameC++;
      if (JSON.stringify(texts(b).map((t) => [Math.round(t.box.x), Math.round(t.box.y), Math.round(t.size)])) !== JSON.stringify(texts(r).map((t) => [Math.round(t.box.x), Math.round(t.box.y), Math.round(t.size)]))) moved++;
    }
    expect(moved).toBeGreaterThanOrEqual(Math.floor(n * 0.85));
    expect(sameC).toBeGreaterThanOrEqual(Math.floor(n * 0.6));
  });
});

describe('every page archetype on every format', () => {
  it('keeps its text on the canvas, legible, and sets the title', () => {
    const names = ['photoBand', 'fullBleed', 'openSide', 'masthead', 'centreFrame', 'windowInset', 'split', 'plate', 'giantBlock', 'typeFill', 'latinArch', 'gate', 'scattered', 'quietEmblem', 'totem', 'infoForm', 'colourMass', 'strip', 'mosaic'];
    let k = 0;
    for (const a of names) for (const ratio of RATIOS) {
      const style = STYLES[k % STYLES.length];
      const extra: Record<string, unknown> = { params: { ...(input('x', ratio, style) as GenInput).params, composition: 'build', archetype: a } };
      if (k % 3 === 2) extra.custom = LINEUP;
      const r = generate(input(`A${k++}`, ratio, style, 'build', extra) as GenInput);
      const tag = `${a} ${ratio} ${style}`;
      const S = Math.min(r.scene.w, r.scene.h);
      for (const t of texts(r)) {
        if (t.rotate) continue;
        expect(t.box.x, `${tag} ${t.raw}`).toBeGreaterThan(-2);
        expect(t.box.y, `${tag} ${t.raw}`).toBeGreaterThan(-2);
        expect(t.box.x + t.box.w, `${tag} ${t.raw}`).toBeLessThan(r.scene.w + 2);
        expect(t.box.y + t.box.h, `${tag} ${t.raw}`).toBeLessThan(r.scene.h + 2);
        expect(t.size, `${tag} ${t.raw}`).toBeGreaterThanOrEqual(S * 0.0095);
      }
      const title = r.picked.texts.headline.t.replace(/\s+/g, '').toLowerCase();
      expect(words(r).includes(title) || Array.from(title).every((ch) => words(r).includes(ch)), tag).toBe(true);
    }
  });
});

describe('text-group engine', () => {
  it('breaks titles the reference way', () => {
    for (const t of ['写给失眠街区的笔记', '来自地图边缘的观测', '一个小房间的现场录音']) {
      const sl = breakTitle(t, 'short-long')!;
      expect(sl.length).toBe(2);
      expect(Array.from(sl[0]).length).toBeLessThan(Array.from(sl[1]).length);
      expect(sl.every((l) => Array.from(l).length >= 2)).toBe(true);
    }
    expect(breakTitle('B面', 'short-long')).toBeNull(); // never a one-character line
    // a break never splits a common word (the leading one-character word shifts the parity)
    for (const shape of ['short-long', 'long-short', 'equal'] as const) {
      const L = breakTitle('用影子丈量季节', shape);
      if (L) expect(L.join('|')).not.toMatch(/影\|子|季\|节|丈\|量/);
    }
    expect(breakTitle('用影子丈量季节', 'short-long')).toEqual(['用影子', '丈量季节']);
    const r = new Rng('x');
    expect(pickBreak(r, 'Live recordings from small rooms').lines.length).toBeGreaterThanOrEqual(1);
  });
  it('parses dates into parts (the weekday only with a year)', () => {
    expect(dateParts('2026.12.05')).toMatchObject({ y: '2026', m: '12', d: '05', wd: 'SAT' });
    expect(dateParts('10.16-10.22')).toMatchObject({ m: '10', d: '16', m2: '10', d2: '22' });
    expect(dateParts('12月5日')?.wd).toBeUndefined();
  });
  it('every construction instantiates for a full bilingual copy', () => {
    const copy = { title: { t: '低频夜', lang: 'zh' as const }, cn: '低频夜', en: 'LOW FREQUENCY NIGHT', sub: { t: '六组现场 · 一夜', lang: 'zh' as const }, num: { v: '120', unit: '¥' }, date: '2026.12.05', year: '2026', items: [{ main: { t: '22:00 雾港', lang: 'zh' as const }, note: null }, { main: { t: '23:00 白噪', lang: 'zh' as const }, note: null }, { main: { t: '00:00 K-Line', lang: 'en' as const }, note: null }], meta: [{ t: '仓库七号', lang: 'zh' as const }], para: null, labels: [], index: 'No.07', dp: dateParts('2026.12.05'), custom: true };
    let ok = 0;
    for (const c of LIBRARY) if (instantiate(c, { copy, r: new Rng(c.id), shape: c.shape })?.root) ok++;
    // a few constructions decline a 3-character title by design (stamp grid: 4 chars; split spread: 2 or 4; staircase /
    // closed rectangle: 2 lines; title + paragraph: a paragraph)
    expect(ok).toBeGreaterThanOrEqual(LIBRARY.length - 6);
  });
  it('the archetype and construction params list every archetype and construction', () => {
    const opt = (k: string) => (PARAMS.find((p) => p.key === k) as { options: { v: string }[] }).options.map((o) => o.v).filter((v) => v !== 'auto');
    expect(opt('construction').sort()).toEqual(LIBRARY.map((c) => c.id).sort());
    expect(opt('archetype').sort()).toEqual(Object.keys(ARCHETYPES).sort());
  });
  it('never sets a date twice when an info line is that same date (real copy)', () => {
    const copy = { headline: 'Sugar Lab', sub: 'A candy pop-up', small: [], note: [], prose: '', meta: ['2027.05.20', '18 West Street', 'Free entry'] };
    let shown = 0;
    for (let k = 0; k < 60; k++) {
      const r = generate(input(`DD${k}`, RATIOS[k % RATIOS.length], STYLES[k % STYLES.length], 'build', { custom: copy }) as GenInput);
      const n = texts(r).filter((t) => t.lines.map((l) => l.text).join('').replace(/\s/g, '') === '2027.05.20').length;
      expect(n, `DD${k} ${r.picked.kind}`).toBeLessThanOrEqual(1);
      if (n === 1 || words(r).includes('2027.05.20')) shown++;
    }
    expect(shown).toBe(60); // the date is still on every poster
  });
});
