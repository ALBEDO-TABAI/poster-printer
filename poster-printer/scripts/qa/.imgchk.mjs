import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('LOG', m.type(), m.text().slice(0, 200)));
await page.goto(process.env.U || 'http://127.0.0.1:5180/');
await page.waitForFunction(() => window.__rea?.getState().scene, null, { timeout: 90000 });
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => { const s = window.__rea.getState(); return JSON.stringify({ imgs: s.presetImages.length, pals: s.palettes.length, ready: s.ready, nodesImg: document.querySelectorAll('.frame svg image').length }); }));
await browser.close();
