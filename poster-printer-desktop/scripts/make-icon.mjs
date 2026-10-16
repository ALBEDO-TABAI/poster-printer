// build/icon.svg -> build/icon.icns (macOS iconset via sharp + iconutil). Run: node scripts/make-icon.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'build/icon.svg');
const work = mkdtempSync(join(tmpdir(), 'rpp-icon-'));
const set = join(work, 'icon.iconset');
execFileSync('mkdir', ['-p', set]);
const master = await sharp(svg, { density: 144 }).resize(1024, 1024).png().toBuffer();
for (const base of [16, 32, 128, 256, 512]) {
  for (const k of [1, 2]) {
    const px = base * k;
    const name = `icon_${base}x${base}${k === 2 ? '@2x' : ''}.png`;
    await sharp(master).resize(px, px, { kernel: 'lanczos3' }).png().toFile(join(set, name));
  }
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', join(root, 'build/icon.icns')]);
await sharp(master).png().toFile(join(root, 'build/icon.png'));
rmSync(work, { recursive: true, force: true });
console.log('wrote build/icon.icns and build/icon.png');
