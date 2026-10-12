// Exercises the deck view end to end: draws, reorders, exports a multi-page PDF and a PNG zip.
// usage: node scripts/qa/deck-export.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/deck-qa';
mkdirSync(out, { recursive: true });
const base = process.env.REA_URL || 'http://127.0.0.1:5180';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto(base + '/?view=deck');
await page.waitForSelector('.deck-thumb', { timeout: 30000 });
await page.waitForTimeout(1200);
const n0 = await page.locator('.deck-thumb').count();
await page.click('.deck-add');
await page.keyboard.press('Space');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
const n1 = await page.locator('.deck-thumb').count();
const save = async (label) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click(`[data-qa=${label}]`)]);
  const p = out + '/' + dl.suggestedFilename();
  await dl.saveAs(p);
  return p;
};
const pdf = await save('deck-pdf');
const zip = await save('deck-zip');
await page.screenshot({ path: out + '/deck-ui.png' });
console.log(JSON.stringify({ pagesBefore: n0, pagesAfter: n1, pdf, zip, errors: errs }));
await browser.close();
process.exit(n1 === n0 + 1 && !errs.length ? 0 : 1);
