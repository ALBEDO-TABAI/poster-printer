// Bundles the engine against a rea-poster checkout (REA_POSTER, default ../../poster-printer):
//   dist/engine.mjs  Node CLI (pure ops, node backend, chromium driver)
//   dist/page.js     browser bundle loaded by headless Chrome (the app's own measurer / fonts / exporter)
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const rea = resolve(process.env.REA_POSTER ?? fileURLToPath(new URL('../../poster-printer', import.meta.url)));
if (!existsSync(rea + '/src/engine/generate.ts')) { console.error('rea-poster not found at ' + rea); process.exit(3); }
let reaCommit = '?'; try { reaCommit = execFileSync('git', ['-C', rea, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* */ }
const info = { rea, reaCommit, built: new Date().toISOString() };
const common = { bundle: true, alias: { '@rea': rea + '/src' }, nodePaths: [rea + '/node_modules'], logLevel: 'warning', define: { __BUILD_INFO__: JSON.stringify(info) }, sourcemap: false };
await build({ ...common, entryPoints: ['src/node-main.ts'], outfile: 'dist/engine.mjs', platform: 'node', format: 'esm', target: 'node20', external: ['playwright-core', '@resvg/resvg-js', 'sharp'], banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
await build({ ...common, entryPoints: ['src/page-main.ts'], outfile: 'dist/page.js', platform: 'browser', format: 'iife', target: 'chrome110' });
console.log(JSON.stringify({ outputs: ['dist/engine.mjs', 'dist/page.js'], ...info }));
