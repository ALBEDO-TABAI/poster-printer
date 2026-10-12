// THROWAWAY audit harness (phase A): for every engine param, does a change (a) re-render the current poster,
// (b) change subsequent draws (fixed seeds, selector on, deterministic budget)? Writes test-results/audit/params.json
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0 && s.palettes.length > 0; }, null, { timeout: 90000 });
page.setDefaultTimeout(0);
const OVER = JSON.parse(process.env.AUDIT_OVER || '{}'); const NSEED = +(process.env.AUDIT_SEEDS || 3);
const res = await page.evaluate(async ([OVER, NSEED]) => {
  const { PARAMS, DEFAULT_PARAMS } = await import('/src/engine/params.ts');
  const useStore = window.__rea; // the app's store instance — capture BEFORE importing store.ts: a second module copy overwrites window.__rea
  const { buildInput } = await import('/src/store.ts');
  window.__rea = useStore;
  const { applyEdits } = await import('/src/lib/edits.ts').catch(() => ({ applyEdits: (x) => x }));
  const { generate } = await import('/src/engine/generate.ts');
  const { renderSVG } = await import('/src/engine/render/svg.ts');
  const st = useStore.getState;
  const strip = (svg) => svg.replace(/id="[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '').replace(/href="#[^"]*"/g, '');
  const flat = (sc) => { const m = new Map(); let i = 0; const w = (n) => { if (!n) return; m.set(n.id ?? 'n' + i++, JSON.stringify({ ...n, children: undefined })); (n.children || []).forEach(w); }; (sc.nodes || []).forEach(w); m.set('__bg', JSON.stringify(sc.bg)); m.set('__tex', JSON.stringify(sc.texture ?? null)); m.set('__filter', JSON.stringify(sc.filter ?? sc.tune ?? null)); return m; };
  const ndiff = (a, b) => { const A = flat(a), B = flat(b); let d = 0; for (const k of new Set([...A.keys(), ...B.keys()])) if (A.get(k) !== B.get(k)) d++; return d; };
  const alts = (p) => {
    if (p.type === 'bool') return [!p.def];
    if (p.type === 'seg') { const o = p.options.map((x) => x.v).filter((v) => v !== p.def); return p.key === 'composition' ? ['swiss', 'typo'] : o.slice(0, 2); }
    const lo = p.min, hi = p.max; return [hi !== p.def ? hi : lo, lo !== p.def ? lo : (p.def + hi) / 2].filter((v, i, a) => a.indexOf(v) === i);
  };
  // three base posters (fresh draws, default style), recorded as entries
  const style0 = st().styleId; const params0 = { ...st().params, ...OVER };
  const bases = [];
  for (const sd of ['AUDITa', 'AUDITb', 'AUDITc']) {
    useStore.setState({ seeds: { layout: sd + 'L', text: sd + 'T', color: sd + 'C', image: sd + 'I' }, params: { ...params0 }, edits: {}, decorSalt: '' });
    await st().regen(true); bases.push(st().history[st().hIndex]);
  }
  const entryScene = (e) => { const s = useStore.getState(); return generate({ ...buildInput({ ...s, seeds: e.seeds, decorSalt: e.decorSalt, ratio: e.ratio, styleId: e.styleId, params: e.params, modules: e.modules, modes: e.modes, fonts: e.fonts, customOn: false, custom: null, placed: e.placed ?? [] }, { keepPicked: e.picked }), budgetMs: 1e9 }).scene; };
  // drift: does a no-op regen(false) (what every slider move triggers) keep the current poster?
  const drift = [];
  for (const e of bases) { await st().restore(e, false); const a = strip(renderSVG(st().scene)); const ca = st().scene.info.comp; await st().regen(false); drift.push({ changed: a !== strip(renderSVG(st().scene)), comp: ca + '→' + st().scene.info.comp, nodes: ndiff(entryScene(e), st().scene) }); }
  const live = async (k, v) => {
    let changed = 0, nodes = 0, fit = 0, info = [], pinned = 0;
    for (const e of bases) {
      // UI path: restore, no-op regen (control), then the real slider path regen(false)
      await st().restore(e, false); await st().regen(false); const a = st().scene; const aSvg = strip(renderSVG(a));
      useStore.setState({ params: { ...st().params, [k]: v } }); await st().regen(false);
      const b = st().scene; const bSvg = strip(renderSVG(b));
      if (aSvg !== bSvg) { changed++; nodes += ndiff(a, b); }
      if (JSON.stringify(b.info.paletteFit ?? null) !== JSON.stringify(a.info.paletteFit ?? null)) fit++;
      if (b.info.comp !== a.info.comp) info.push(a.info.comp + '→' + b.info.comp);
      // pinned path: the exact same poster (all picks kept) re-rendered with the new value
      const p0 = entryScene(e), p1 = entryScene({ ...e, params: { ...e.params, [k]: v } });
      if (p0 && p1 && strip(renderSVG(p0)) !== strip(renderSVG(p1))) pinned++;
    }
    return { changed, nodes, fit, info, pinned };
  };
  const SEEDS = Array.from({ length: NSEED }, (_, i) => 'F' + (i + 1));
  const fut = async (k, v) => {
    let changed = 0, comp = 0, noise = 0;
    for (const sd of SEEDS) {
      const S0 = { ...st(), seeds: { layout: sd + 'L', text: sd + 'T', color: sd + 'C', image: sd + 'I' }, params: { ...params0 }, history: [], hIndex: -1, result: null, decorSalt: '', edits: {} };
      const gen = (pp) => generate({ ...buildInput({ ...S0, params: pp }), budgetMs: 1e9 });
      const a = gen({ ...params0 }), a2 = gen({ ...params0 }), b = gen({ ...params0, [k]: v });
      if (strip(renderSVG(a.scene)) !== strip(renderSVG(a2.scene))) noise++;
      if (strip(renderSVG(a.scene)) !== strip(renderSVG(b.scene))) changed++;
      if (a.picked.comp !== b.picked.comp) comp++;
    }
    return { changed, of: SEEDS.length, comp, noise };
  };
  const out = [];
  for (const p of PARAMS) {
    const row = { key: p.key, type: p.type, section: p.section, card: p.card, zh: p.zh, def: p.def, style: params0[p.key], tests: [] };
    for (const v of alts(p)) row.tests.push({ v, live: await live(p.key, v), next: await fut(p.key, v) });
    out.push(row);
  }
  // style reset check: does picking the same style again reset params?
  return { images: st().presetImages.length, palettes: st().palettes.length, style: style0, drift, bases: bases.map((e) => e.picked.comp), rows: out };
}, [OVER, NSEED]);
fs.writeFileSync(process.env.AUDIT_OUT || 'test-results/audit/params.json', JSON.stringify(res, null, 1));
console.log('rows', res.rows.length, 'errors', errs.length, errs.slice(0, 3));
await browser.close();
