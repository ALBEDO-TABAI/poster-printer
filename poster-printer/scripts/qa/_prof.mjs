import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1512, height: 945 } })).newPage();
await p.goto((process.env.APP_URL||'http://127.0.0.1:5180/')+'?fresh');
await p.waitForFunction(() => window.__rea?.getState().scene, null, { timeout: 90000 }); await p.waitForTimeout(2500);
await p.click('#r-adv'); await p.waitForTimeout(500); await p.click('#adv-nav [data-intent="type"]'); await p.waitForTimeout(400);
const bb = await p.locator('#adv-main .scrub[data-k="titleScale"]').boundingBox();
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.mouse.move(bb.x + bb.width * 0.3, bb.y + 10); await p.mouse.down();
for (let i = 0; i <= 40; i++) { await p.mouse.move(bb.x + bb.width * (0.3 + 0.6 * i / 40), bb.y + 10); await p.waitForTimeout(16); }
await p.mouse.up(); await p.waitForTimeout(800);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const tot = new Map();
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => (v / 1000).toFixed(0).padStart(6) + 'ms ' + k).join('\n'));
// inclusive per url
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const inc = new Map(); profile.samples.forEach((id, i) => { const seen = new Set(); let x = id; while (x) { const n = byId.get(x); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}`; if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + (dt[i] || 0)); } x = parent.get(x); } });
console.log('--- inclusive'); console.log([...inc].sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, v]) => (v / 1000).toFixed(0).padStart(6) + 'ms ' + k).join('\n'));
await b.close();
