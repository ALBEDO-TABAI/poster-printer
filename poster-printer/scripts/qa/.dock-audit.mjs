import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5180/');
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0; }, null, { timeout: 90000 });
console.log(await page.evaluate(async () => {
  const st = window.__rea.getState; const sv = () => JSON.stringify(st().scene.nodes); const out = {};
  for (const v of ['text', 'decor', 'color', 'image', 'tendency', 'structure']) {
    let ch = 0, comp = 0, pReset = 0;
    for (let i = 0; i < 6; i++) { await st().draw(); st().setParam('titleScale', 140); await new Promise((r) => setTimeout(r, 80)); const a = sv(), c = st().result.picked.comp; await st().variant(v); if (sv() !== a) ch++; if (st().result.picked.comp !== c) comp++; if (st().params.titleScale !== 140) pReset++; st().setParam('titleScale', 100); }
    out[v] = `changed ${ch}/6, comp changed ${comp}/6, params reset ${pReset}/6`;
  }
  // draw keeps params?
  st().setParam('titleScale', 150); await new Promise((r) => setTimeout(r, 80)); await st().draw(); out.drawKeepsParams = st().params.titleScale === 150; st().setParam('titleScale', 100);
  // locks
  const L = {};
  for (const k of ['text', 'color', 'image', 'images']) { await st().draw(); const p = st().result.picked; st().toggleLock(k); let same = 0; for (let i = 0; i < 4; i++) { await st().draw(); const q = st().result.picked; const f = k === 'text' ? 'texts' : k === 'color' ? 'palette' : 'imageIds'; const A = k === 'image' ? JSON.stringify(p.imageIds?.[0]) : JSON.stringify(p[f]); const B = k === 'image' ? JSON.stringify(q.imageIds?.[0]) : JSON.stringify(q[f]); if (A === B) same++; } st().toggleLock(k); L[k] = `kept ${same}/4`; }
  out.locks = L;
  return JSON.stringify(out, null, 1);
}));
await browser.close();
