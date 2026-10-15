// The splash shows the library's counts before the data loads, so they are constants checked here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE_COUNT } from '../src/lib/assets';

describe('splash counts', () => {
  it('palette count matches the palette data', () => {
    const rows = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
    expect(rows.length).toBe(PALETTE_COUNT);
  });
});
