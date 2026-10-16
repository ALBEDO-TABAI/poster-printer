// electron-builder `mac.sign` hook: ad-hoc signature for the whole bundle, inside-out, with plain codesign.
// Replaces @electron/osx-sign, whose file walk runs isbinaryfile on every file and crashes on one of the web
// assets. Ad-hoc (no Apple Developer ID) is enough on Apple silicon: macOS then offers "Open Anyway" in
// System Settings → Privacy & Security instead of calling the app "damaged".
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MACHO = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);

function isMachO(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(4);
    return fs.readSync(fd, b, 0, 4, 0) === 4 && MACHO.has(b.readUInt32BE(0));
  } finally { fs.closeSync(fd); }
}

function collect(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      collect(p, out);
      if (/\.(app|framework)$/.test(e.name)) out.push(p);
    } else if (e.isFile() && isMachO(p)) out.push(p);
  }
  return out;
}

const sign = (p) => execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', p], { stdio: 'pipe' });

module.exports = async function adhocSign(opts) {
  const app = opts.app;
  const depth = (p) => p.split(path.sep).length;
  const items = collect(app, []).sort((a, b) => depth(b) - depth(a));
  for (const p of items) sign(p);
  sign(app);
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
  console.log(`  • ad-hoc signed  ${items.length} nested items + ${path.basename(app)}`);
};
