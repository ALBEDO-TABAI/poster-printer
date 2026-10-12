// Screenshots of the glass shell in key states + the palette and rating pages. usage: node scripts/qa/ui-port-shot.mjs [outDir] [only]
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || 'test-results/ui';
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const STATES = [
  ['home', ''], ['insp', '?open=insp'], ['sel', '?open=sel'], ['adv', '?open=adv&intent=layout&focus=whitespace'], ['adv-layers', '?open=adv&intent=layers'],
  ['lib-styles', '?open=lib:styles'], ['lib-images', '?open=lib:images'], ['lib-layout', '?open=lib:layout'], ['film', '?open=film'], ['cmdk', '?open=cmdk&q=留白'], ['export', '?open=export'],
  ['keys', '?open=keys'], ['grid', '?grid=1&open=grid'], ['deck', '?view=deck'], ['rt', '?rt=1&open=insp'], ['adv-insp-lib', '?open=lib:styles,adv'],
];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errs = [];
for (const theme of ['light', 'dark']) {
  for (const [name, q] of STATES) {
    if (only && !only.split(',').includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((th) => { window.__forceTheme = th; }, theme);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${theme}/${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errs.push(`${theme}/${name}: pageerror ${e.message}`));
    await page.goto(base + q);
    await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 });
    await page.evaluate((th) => window.__rea.getState().set('theme', th), theme);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/${name}-${theme}.png` });
    await ctx.close();
  }
}
// standalone pages (theme comes from localStorage)
for (const theme of ['light', 'dark']) {
  for (const [name, path, sel] of [['palette', 'color.html', '.card-svg svg'], ['rate', 'rate.html', '.rate-frame svg']]) {
    if (only && !only.split(',').includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((th) => { localStorage.setItem('rea.theme', JSON.stringify(th)); }, theme);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${theme}/${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errs.push(`${theme}/${name}: pageerror ${e.message}`));
    await page.goto(base.replace(/\/?$/, '/') + path);
    await page.waitForSelector(sel, { timeout: 60000 });
    if (name === 'rate') { await page.evaluate(() => localStorage.removeItem('pp.ratings.v1')); for (const k of ['7', '5', '8']) { await page.keyboard.press(k); await page.waitForTimeout(500); } }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/${name}-${theme}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
