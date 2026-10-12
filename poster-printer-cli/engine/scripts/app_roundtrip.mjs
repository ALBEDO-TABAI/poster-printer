#!/usr/bin/env node
// Round-trip probe: import Poster JSON files into the running web app (its own "Import JSON" file input),
// then dump what the app renders: exportSVG(scene, false) (= window.__reaSVG) and a 1× PNG (window.__reaRaster).
// usage: node app_roundtrip.mjs <appUrl> <outDir> <poster.json>...   → prints JSON [{file, method, svg, png, entryId}]
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [appUrl, outDir, ...files] = process.argv.slice(2);
if (!appUrl || !outDir || !files.length) { console.error('usage: app_roundtrip.mjs <appUrl> <outDir> <poster.json>...'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.POSTER_PRINTER_CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--font-render-hinting=none'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 })).newPage();
await page.goto(appUrl);
await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 });
const out = [];
for (const f of files) {
  const want = JSON.stringify(JSON.parse(readFileSync(f, 'utf8')).entry.seeds);  // restore() pushes a new history entry (new id) with the same seeds
  let method = 'file-input';
  // the app's own Import JSON inputs (Export sheet / More panel); open the export sheet if none is mounted
  let input = page.locator('input[type=file][accept=".json,application/json"]');
  if (!(await input.count())) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /导出|Export/.test(x.textContent || '')); b?.click(); });
    await page.waitForTimeout(400);
    input = page.locator('input[type=file][accept=".json,application/json"]');
  }
  if (await input.count()) await input.first().setInputFiles(f);
  else { method = 'store.restore'; await page.evaluate((t) => { const j = JSON.parse(t); window.__rea.getState().restore(j.entry, true); }, readFileSync(f, 'utf8')); }
  const ok = await page.waitForFunction((id) => { const s = window.__rea.getState(); return JSON.stringify(s.history?.[s.hIndex]?.seeds) === id && !!s.scene; }, want, { timeout: 30000 }).then(() => true, () => false);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const svg = await page.evaluate(() => window.__reaSVG());
  const png = await page.evaluate(() => window.__reaRaster(1));
  const b = basename(f).replace(/\.json$/, '');
  const svgPath = join(outDir, b + '.app.svg'), pngPath = join(outDir, b + '.app.png');
  writeFileSync(svgPath, svg ?? '');
  writeFileSync(pngPath, Buffer.from(String(png).split(',')[1] ?? '', 'base64'));
  out.push({ file: f, method, restored: ok, entryId: await page.evaluate(() => { const s = window.__rea.getState(); return s.history?.[s.hIndex]?.id; }), svg: svgPath, png: pngPath });
}
await browser.close();
console.log(JSON.stringify(out));
