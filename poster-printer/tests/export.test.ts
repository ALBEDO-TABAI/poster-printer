import { describe, expect, it } from 'vitest';
import { makeZip, crc32 } from '../src/lib/zip';
import { makePdf, jpegSize } from '../src/lib/pdf';

// smallest valid baseline JPEG header pieces we need: SOI + SOF0 (8x4) + EOI
const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x04, 0x00, 0x08, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

describe('zip writer', () => {
  it('crc32 matches the reference value', () => { expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926); });
  it('writes a valid store-only archive with a central directory', () => {
    const a = new TextEncoder().encode('hello'), b = new Uint8Array([1, 2, 3, 4]);
    const z = makeZip([{ name: 'a.txt', data: a }, { name: 'dir/页面.png', data: b }]);
    const dv = new DataView(z.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const eocd = z.length - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 10, true)).toBe(2);
    const cd = dv.getUint32(eocd + 16, true);
    expect(dv.getUint32(cd, true)).toBe(0x02014b50);
    expect(dv.getUint32(cd + 16, true)).toBe(crc32(a));
  });
});

describe('pdf writer', () => {
  it('reads JPEG dimensions', () => { expect(jpegSize(fakeJpeg)).toEqual({ w: 8, h: 4 }); });
  it('produces one page object per image with a consistent xref', () => {
    const pdf = makePdf([1, 2, 3].map(() => ({ jpeg: fakeJpeg, pxW: 8, pxH: 4, ptW: 400, ptH: 200 })), { title: 'T' });
    const s = new TextDecoder('latin1').decode(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s).toContain('/Count 3');
    expect((s.match(/\/Type \/Page /g) || []).length).toBe(3);
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xref, xref + 4)).toBe('xref');
    // every xref offset points at "n 0 obj"
    const rows = s.slice(xref).split('\n').slice(3, 3 + 12);
    rows.forEach((r, i) => { const off = Number(r.slice(0, 10)); expect(s.slice(off, off + 12)).toContain(`${i + 1} 0 obj`); });
  });
});
