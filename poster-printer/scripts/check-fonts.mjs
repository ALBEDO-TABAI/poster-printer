// Fonts are generated (not in git). Fail early with instructions if they are missing.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
const man = new URL('../public/fonts/manifest.json', import.meta.url);
if (!existsSync(man)) {
  const src = process.env.REA_FONTS_SRC || '/workspace/fonts';
  if (existsSync(src + '/catalog.json')) {
    console.log(`[fonts] public/fonts missing — subsetting from ${src} …`);
    execSync('python3 scripts/build-fonts.py', { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname });
  } else {
    console.error(`[fonts] public/fonts/manifest.json is missing and no font source found at ${src}.\n` +
      `        Set REA_FONTS_SRC to a folder with catalog.json (see licenses/FONTS.md) and run: npm run fonts`);
    process.exit(1);
  }
}
