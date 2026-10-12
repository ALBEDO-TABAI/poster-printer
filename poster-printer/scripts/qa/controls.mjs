// Phase 13 regression: every visible control must change the current poster or future draws, or be honestly labelled.
// Also: no layout drift on the adjust path, 换X keeps the layout, pins/locks hold on draws, session survives reload.
// Usage: node scripts/qa/controls.mjs  (APP_URL defaults to the dev server on 5180). Writes test-results/controls.json.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const URL = process.env.APP_URL || 'http://127.0.0.1:5180/';
const N = Number(process.env.CTRL_POSTERS || 4), D = Number(process.env.CTRL_DRAWS || 6);
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const boot = async (q = '?fresh') => {
  await page.goto(URL + q);
  await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0 && s.palettes.length > 0; }, null, { timeout: 90000 });
};
await boot();
// the visible controls and their declared scope, read from the UI's own IA (no second copy of the store: __rea is the app's)
const defs = await page.evaluate(async () => {
  const keep = window.__rea;
  const ia = await import('/src/ui/shell/ia.ts');
  const pm = await import('/src/engine/params.ts');
  window.__rea = keep;
  const CL = new Set(['split', 'checker', 'fullbleed', 'giant', 'partition', 'cards', 'fan', 'typefill', 'swiss', 'centered', 'layered', 'bands']);
  window.__CL = [...CL];
  return ia.UIPARAMS.filter((p) => p.tier > 0).map((p) => ({ key: p.key, tier: p.tier, type: p.type, min: p.min, max: p.max, def: p.def, options: p.options?.map((o) => o.v),
    scope: pm.DRAW_ONLY.includes(p.key) ? 'draws' : p.tier === 3 ? 'classic' : pm.RELAYOUT.includes(p.key) ? 'relayout' : pm.REPICK_PALETTE.includes(p.key) ? 'palette' : pm.REPICK_TEXT.includes(p.key) ? 'text' : 'live' }));
}).then((d) => (process.env.CTRL_ONLY ? d.filter((x) => process.env.CTRL_ONLY.split(',').includes(x.key)) : d));
const res = await page.evaluate(async ({ defs, N, D }) => {
  const S = window.__rea; const st = S.getState; const w = (ms = 90) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => { await w(60); for (let i = 0; i < 40 && st().noEffect === undefined; i++) await w(20); await w(60); };
  const sig = () => JSON.stringify([st().scene.bg, st().scene.nodes, st().scene.tune, st().scene.texture]);
  const seedsOf = (i) => ({ layout: 'ctl-L' + i, text: 'ctl-T' + i, color: 'ctl-C' + i, image: 'ctl-I' + i });
  const fresh = async (i, comp) => { st().resetParams('all'); st().clearPins(); S.setState({ seeds: seedsOf(i), decorSalt: '', edits: {}, honor: [] }); if (comp) S.setState((s) => ({ params: { ...s.params, composition: comp } })); await st().regen(true); };
  const alt = (d, cur) => d.type === 'bool' ? [!cur] : d.type === 'seg' ? d.options.filter((o) => o !== String(cur)).slice(0, 3) : [d.min, d.max, (d.min + d.max) / 2].filter((v) => v !== Number(cur)).slice(0, 2);
  const out = [];
  for (const d of defs) {
    const r = { key: d.key, scope: d.scope, tier: d.tier, live: 0, draws: 0, layoutKept: 0, liveN: 0 };
    if (d.scope !== 'draws') {
      const comps = d.scope === 'classic' ? ['split', 'checker', 'fullbleed', 'giant', 'partition', 'cards', 'fan', 'typefill', 'swiss', 'centered', 'layered', 'bands'] : [undefined];
      for (let i = 0; i < (d.scope === 'classic' ? comps.length : N); i++) {
        await fresh(i, comps[i % comps.length]);
        // control: a no-op adjust must not move anything
        st().setParam('margin', Number(st().params.margin)); await settle();
        const a = sig(), c = st().result.picked.comp; let changed = false;
        for (const v of alt(d, st().params[d.key])) { st().setParam(d.key, v); await w(140); if (sig() !== a) { changed = true; break; } await w(300); if (sig() !== a) { r.late = (r.late || 0) + 1; changed = true; break; } }
        r.liveN++; if (changed) r.live++;
        if (st().result.picked.comp === c) r.layoutKept++;
      }
    }
    if (d.scope === 'draws' || d.tier <= 2) {
      // future draws: the same fixed seeds with and without the pinned value
      const drawWith = async (i, pin) => {
        st().resetParams('all'); st().clearPins();
        S.setState((s) => ({ pins: pin ? { [d.key]: pin.v } : {}, seeds: seedsOf(100 + i), decorSalt: '', edits: {}, params: pin ? { ...s.params, [d.key]: pin.v } : s.params, honor: pin ? [d.key] : [] }));
        await st().regen(true); return sig();
      };
      const v = alt(d, st().params[d.key])[0];
      let n = 0;
      for (let i = 0; i < D; i++) { const a = await drawWith(i, null); const b = await drawWith(i, { v }); if (a !== b) n++; }
      r.draws = n; r.drawsN = D;
      st().clearPins();
    }
    out.push(r);
  }
  return out;
}, { defs, N, D });
// verdicts
const rows = res.map((r) => {
  let ok, why = '';
  if (r.scope === 'draws') { ok = r.draws > 0; why = `draws ${r.draws}/${r.drawsN}`; }
  else if (r.scope === 'classic') { ok = r.live > 0; why = `labelled classic · on the 12 classic comps ${r.live}/${r.liveN}`; }
  else { ok = r.live > 0 || r.draws > 0; why = `live ${r.live}/${r.liveN}` + (r.drawsN ? ` · draws ${r.draws}/${r.drawsN}` : '') + (r.live ? '' : ' (this poster: says 本张不受影响)'); if (r.scope === 'live' && r.layoutKept < r.liveN) { ok = false; why += ` · layout moved ${r.liveN - r.layoutKept}`; } }
  return { ...r, ok, why };
});
// flows
const flows = await page.evaluate(async () => {
  const S = window.__rea; const st = S.getState; const w = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const geo = () => JSON.stringify(st().scene.nodes.filter((n) => n.kind !== 'text').map((n) => [n.id, n.kind, Math.round(n.x ?? 0), Math.round(n.y ?? 0)]));
  const f = { sliderDrift: 0, restoreDrift: 0, variants: {}, styleKeepsPins: 0, locks: {}, undoPins: false, n: 6 };
  st().resetParams('all'); st().clearPins();
  for (let i = 0; i < 6; i++) {
    await st().draw(); const c = st().result.picked.comp, g = geo();
    for (const v of [120, 140, 100]) { st().setParam('titleScale', v); await w(); }
    if (st().result.picked.comp !== c || geo() !== g) f.sliderDrift++;
    await st().draw(); await st().go(-1); st().setParam('saturation', 110); await w(); st().setParam('saturation', 100); await w();
    if (st().result.picked.comp !== c || geo() !== g) f.restoreDrift++;
  }
  for (const v of ['text', 'color', 'image', 'decor', 'structure']) {
    let kept = 0, changed = 0;
    for (let i = 0; i < 6; i++) { await st().draw(); const c = st().result.picked.comp, a = JSON.stringify(st().scene.nodes); await st().variant(v); if (st().result.picked.comp === c) kept++; if (JSON.stringify(st().scene.nodes) !== a) changed++; }
    f.variants[v] = { compKept: kept, changed, n: 6 };
  }
  st().setParam('bgPref', 'dark'); st().togglePin('bgPref');
  for (let i = 0; i < 3; i++) { await st().variant('tendency'); if (st().pins.bgPref === 'dark' && st().params.bgPref === 'dark') f.styleKeepsPins++; }
  st().clearPins(); st().resetParams('all');
  for (const k of ['text', 'color', 'image', 'images']) {
    await st().draw(); if (k.startsWith('image')) for (let j = 0; j < 8 && !st().result.picked.imageIds.length; j++) await st().draw();
    const p = st().result.picked; st().toggleLock(k); let same = 0;
    for (let i = 0; i < 4; i++) { await st().draw(); const q = st().result.picked; const fld = k === 'text' ? 'texts' : k === 'color' ? 'palette' : 'imageIds'; const A = k === 'image' ? JSON.stringify(p.imageIds[0]) : JSON.stringify(p[fld]); const B = k === 'image' ? JSON.stringify(q.imageIds[0]) : JSON.stringify(q[fld]); if (A === B) same++; }
    st().toggleLock(k); f.locks[k] = `${same}/4`;
  }
  return f;
});
// persistence across reload (UI undo stack lives in the page; checked in e2e)
await page.evaluate(async () => { const st = window.__rea.getState; await st().draw(); st().setParam('titleScale', 150); st().setParam('bgPref', 'light'); st().togglePin('bgPref'); await new Promise((r) => setTimeout(r, 900)); window.__before = 1; });
const before = await page.evaluate(() => { const s = window.__rea.getState(); return { t: s.params.titleScale, pin: s.pins.bgPref, n: s.history.length, comp: s.result.picked.comp, sig: JSON.stringify(s.scene.nodes.map((n) => [n.id, n.kind])) }; });
await boot('');
const after = await page.evaluate(() => { const s = window.__rea.getState(); return { t: s.params.titleScale, pin: s.pins.bgPref, n: s.history.length, comp: s.result.picked.comp, sig: JSON.stringify(s.scene.nodes.map((n) => [n.id, n.kind])) }; });
const persist = { params: before.t === after.t, pins: before.pin === after.pin, history: after.n === Math.min(before.n, 60), poster: before.comp === after.comp && before.sig === after.sig };
await page.evaluate(() => localStorage.removeItem('rea.session.v1'));
await browser.close();
const fails = rows.filter((r) => !r.ok);
const flowFail = [];
if (flows.sliderDrift) flowFail.push('slider drift ' + flows.sliderDrift);
if (flows.restoreDrift) flowFail.push('restore drift ' + flows.restoreDrift);
for (const v of ['text', 'color', 'image', 'decor']) if (flows.variants[v].compKept < 6) flowFail.push(`换${v} moved layout`);
if (flows.styleKeepsPins < 3) flowFail.push('换风格 dropped pins');
for (const [k, v] of Object.entries(flows.locks)) if (v !== '4/4') flowFail.push(`lock ${k} ${v}`);
for (const [k, v] of Object.entries(persist)) if (!v) flowFail.push('persist ' + k);
if (errs.length) flowFail.push('page errors: ' + errs.slice(0, 2).join(' | '));
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/controls.json', JSON.stringify({ rows, flows, persist, fails: fails.map((r) => r.key), flowFail }, null, 1));
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.key.padEnd(16)} ${r.scope.padEnd(8)} ${r.why}`);
console.log('flows', JSON.stringify(flows));
console.log('persist', JSON.stringify(persist));
console.log(`controls: ${rows.length - fails.length}/${rows.length} ok; flow failures: ${flowFail.length ? flowFail.join('; ') : 'none'}`);
process.exit(fails.length || flowFail.length ? 1 : 0);
