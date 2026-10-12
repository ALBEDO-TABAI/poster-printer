// usage: node scripts/qa/page-shot.mjs <path> out.png [js] [waitMs]
import { chromium } from 'playwright';
const [path = '/', out = '/tmp/page.png', js = '', wait = '1500'] = process.argv.slice(2);
const base = process.env.REA_URL || 'http://127.0.0.1:5180';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto(base + path);
await page.waitForTimeout(Number(wait));
if (js) { await page.evaluate(js); await page.waitForTimeout(900); }
await page.screenshot({ path: out });
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'ok');
await browser.close();
