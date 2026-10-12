// slider-drag frame probe: frame intervals while scrubbing titleScale, optionally with glass disabled (isolates raster cost)
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', ...(process.env.GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-gpu-rasterization'] : [])] });
const p = await (await b.newContext({ viewport: { width: 1512, height: 945 } })).newPage();
await p.goto((process.env.APP_URL || 'http://127.0.0.1:5180/') + '?fresh');
await p.waitForFunction(() => window.__rea?.getState().scene, null, { timeout: 90000 }); await p.waitForTimeout(2500);
await p.click('#r-adv'); await p.waitForTimeout(500); await p.click('#adv-nav [data-intent="type"]'); await p.waitForTimeout(400);
async function run(label) {
  const bb = await p.locator('#adv-main .scrub[data-k="titleScale"]').boundingBox();
  await p.evaluate(() => { window.__fr = []; let l = performance.now(); const t = (x) => { window.__fr.push(x - l); l = x; window.__h = requestAnimationFrame(t); }; window.__h = requestAnimationFrame(t); window.__n = 0; window.__rea.subscribe((s, v) => { if (s.scene !== v.scene) window.__n++; }); });
  await p.mouse.move(bb.x + bb.width * 0.3, bb.y + 10); await p.mouse.down();
  for (let i = 0; i <= 40; i++) { await p.mouse.move(bb.x + bb.width * (0.3 + 0.5 * (i % 20) / 20), bb.y + 10); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(300);
  console.log(label, await p.evaluate(() => { cancelAnimationFrame(window.__h); const f = window.__fr.slice(1).sort((a, b) => a - b); return { frames: f.length, p50: f[f.length >> 1].toFixed(0), p95: f[Math.floor(f.length * .95)].toFixed(0), scenes: window.__n }; }));
}
const sels = (process.env.SELS || '').split('|').filter(Boolean);
await run('glass');
for (const sel of sels) { await p.addStyleTag({ content: sel + '{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' }); await run('minus ' + sel); }
await b.close();
