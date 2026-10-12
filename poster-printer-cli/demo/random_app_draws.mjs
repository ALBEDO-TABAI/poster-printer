#!/usr/bin/env node
// Baseline for the demo: random draws from the web app itself (its own "draw" button, default settings and
// its built-in placeholder copy). usage: node random_app_draws.mjs <appUrl> <outDir> [n=12]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [url, out, n = '12'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.POSTER_PRINTER_CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(url);
await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 });
const res = [];
for (let i = 0; i < +n; i++) {
  // a random built-in style per draw (seeded by i, reproducible), then the app's own draw
  await page.evaluate((i) => { const s = window.__rea.getState(); const ids = s.styles.map((x) => x.id); s.pickStyle(ids[(i * 37 + 11) % ids.length]); window.__rea.getState().draw(); }, i);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => { const s = window.__rea.getState(); const e = s.history[s.hIndex]; return { style: e.styleId, comp: e.picked?.comp, idea: e.picked?.idea ?? null, taste: e.picked?.taste ?? null }; });
  const png = await page.evaluate(() => window.__reaRaster(0.5));
  const f = join(out, `random-${String(i + 1).padStart(2, '0')}.png`);
  writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
  res.push({ file: f, ...info });
}
await b.close();
console.log(JSON.stringify(res));
