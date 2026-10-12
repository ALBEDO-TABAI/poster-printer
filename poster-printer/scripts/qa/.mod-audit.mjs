// THROWAWAY: layers (modules) + modes: live (vs no-op regen control) and next draws (8 fixed seeds)
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5180/');
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0 && s.palettes.length > 0; }, null, { timeout: 90000 });
page.setDefaultTimeout(0);
const r = await page.evaluate(async () => {
  const useStore = window.__rea; const { buildInput } = await import('/src/store.ts'); window.__rea = useStore;
  const { generate } = await import('/src/engine/generate.ts'); const { renderSVG } = await import('/src/engine/render/svg.ts');
  const st = useStore.getState; const strip = (x) => x.replace(/id="[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '').replace(/href="#[^"]*"/g, '');
  const p0 = { ...st().params }, m0 = { ...st().modules };
  const bases = [];
  for (const sd of ['AUDITa', 'AUDITb', 'AUDITc']) { useStore.setState({ seeds: { layout: sd + 'L', text: sd + 'T', color: sd + 'C', image: sd + 'I' }, params: { ...p0 }, modules: { ...m0 }, modes: [], edits: {} }); await st().regen(true); bases.push(st().history[st().hIndex]); }
  const test = async (patch) => {
    let L = 0, N = 0;
    for (const e of bases) { await st().restore(e, false); await st().regen(false); const a = strip(renderSVG(st().scene)); useStore.setState(patch(st())); await st().regen(false); if (a !== strip(renderSVG(st().scene))) L++; }
    for (let i = 1; i <= 8; i++) { const sd = 'F' + i; const S0 = { ...st(), params: { ...p0 }, modules: { ...m0 }, modes: [], seeds: { layout: sd + 'L', text: sd + 'T', color: sd + 'C', image: sd + 'I' }, history: [], hIndex: -1, result: null, edits: {}, decorSalt: '' };
      const a = generate({ ...buildInput(S0), budgetMs: 1e9 }), b = generate({ ...buildInput({ ...S0, ...patch(S0) }), budgetMs: 1e9 }); if (strip(renderSVG(a.scene)) !== strip(renderSVG(b.scene))) N++; }
    return `L${L}/3 N${N}/8`;
  };
  const out = {};
  for (const k of Object.keys(m0)) out['module:' + k + (m0[k] ? ' off' : ' on')] = await test((s) => ({ modules: { ...s.modules, [k]: !m0[k] } }));
  for (const k of ['experimental', 'card', 'clash', 'random', 'layered', 'nice', 'wada', 'brushImage', 'brushMask', 'bandMask']) out['mode:' + k] = await test(() => ({ modes: [k] }));
  return out;
});
fs.writeFileSync('test-results/audit/modules.json', JSON.stringify(r, null, 1)); console.log(r);
await browser.close();
