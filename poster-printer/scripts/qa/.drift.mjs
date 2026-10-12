import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5180/');
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0; }, null, { timeout: 90000 });
console.log(await page.evaluate(async () => {
  const st = window.__rea.getState; const out = [];
  for (let i = 0; i < 8; i++) {
    await st().draw(); const a = st().result.picked; const sa = st().scene;
    await st().regen(false); await st().regen(false); const b = st().result.picked; const sb = st().scene;
    const e = st().history[st().hIndex]; await st().draw(); await st().restore(e, false); const sr = st().scene; await st().regen(false); const sr2 = st().scene;
    out.push(`  after 2 no-op regens salt ${a.salt}→${b.salt}; history-restore then slider: same=${JSON.stringify(sr.nodes) === JSON.stringify(sr2.nodes)} comp ${sr.info.comp}→${sr2.info.comp} salt after restore=${st().history[st().hIndex]?.picked?.salt}`);
    const diff = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    out.push(`${a.comp}→${b.comp} changed: ${diff.join(',') || '—'} svgSame=${JSON.stringify(sa.nodes) === JSON.stringify(sb.nodes)}`);
  }
  return out.join('\n');
}));
await browser.close();
