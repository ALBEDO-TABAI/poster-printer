import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5180/?fresh');
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0; }, null, { timeout: 90000 });
console.log(await page.evaluate(async () => {
  const st = window.__rea.getState; const w = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const sig = () => JSON.stringify(st().scene.nodes.filter((n) => n.kind !== 'text').map((n) => [n.kind, n.x, n.y, n.w, n.h]));
  const out = { drift: 0, restoreDrift: 0, bg: 0, soft: 0, bgDraw: 0, n: 6 };
  for (let i = 0; i < 6; i++) {
    await st().draw(); const c = st().result.picked.comp;
    st().setParam('titleScale', 120); await w(); st().setParam('titleScale', 130); await w(); st().setParam('titleScale', 100); await w();
    if (st().result.picked.comp !== c) out.drift++;
    const geo = sig();
    await st().draw(); await st().go(-1); st().setParam('margin', Number(st().params.margin)); await w();
    if (sig() !== geo || st().result.picked.comp !== c) out.restoreDrift++;
    const bg0 = st().scene.bg; st().setParam('bgPref', 'dark'); await w(200);
    const L = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; };
    if (L(st().scene.bg) < 0.4 && st().result.picked.comp === c) out.bg++;
    st().togglePin('bgPref'); await st().draw(); if (L(st().scene.bg) < 0.4) out.bgDraw++; st().clearPins(); st().setParam('bgPref', 'auto'); await w();
  }
  return JSON.stringify({ ...out, overrides: st().scene.info.overrides ?? null });
}));
await browser.close();
