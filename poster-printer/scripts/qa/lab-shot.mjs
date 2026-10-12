// usage: node scripts/qa/lab-shot.mjs "<query>" out.png
import { chromium } from 'playwright';
const [q = '', out = '/tmp/lab.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:5180/lab.html?${q}`);
await page.waitForFunction(() => window.__labDone, null, { timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify(await page.evaluate(() => window.__labDone)));
if (errs.length) console.log('ERRORS', errs.slice(0, 10));
await browser.close();
