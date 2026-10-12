// CPU profile of one click (SEL), top inclusive frames
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1512, height: 945 } })).newPage();
await p.goto((process.env.APP_URL || 'http://127.0.0.1:5180/') + '?fresh');
await p.waitForFunction(() => window.__rea?.getState().scene, null, { timeout: 90000 }); await p.waitForTimeout(2500);
for (const pre of (process.env.PRE || '').split('|').filter(Boolean)) { await p.click(pre); await p.waitForTimeout(500); }
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.click(process.env.SEL); await p.waitForTimeout(+(process.env.WAIT || 800));
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const inc = new Map(); profile.samples.forEach((id, i) => { const seen = new Set(); let x = id; while (x) { const n = byId.get(x); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}`; if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + (profile.timeDeltas[i] || 0)); } x = parent.get(x); } });
console.log([...inc].filter(([k]) => !/react-dom|jsx-dev|^\((root|idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => (v / 1000).toFixed(0).padStart(6) + 'ms ' + k).join('\n'));
await b.close();
