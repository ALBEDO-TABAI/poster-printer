// Minimal multi-page PDF writer: one full-bleed JPEG per page (DCTDecode), page size in points.
export interface PdfPage { jpeg: Uint8Array; pxW: number; pxH: number; ptW: number; ptH: number }

export function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}

export function makePdf(pages: PdfPage[], meta: { title?: string; producer?: string } = {}): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const offsets: number[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const esc = (s: string) => s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const n = pages.length;
  // 1 catalog, 2 pages, 3 info, then per page: page, content, image
  const pid = (i: number) => 4 + i * 3;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pid(i)} 0 R`).join(' ')}] >>`));
  obj(3, () => push(`<< /Title (${esc(meta.title ?? 'Deck')}) /Producer (${esc(meta.producer ?? 'Poster Printer')}) >>`));
  pages.forEach((pg, i) => {
    const w = pg.ptW.toFixed(2), h = pg.ptH.toFixed(2);
    obj(pid(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${pid(i) + 2} 0 R >> >> /Contents ${pid(i) + 1} 0 R >>`));
    const cs = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(pid(i) + 1, () => { push(`<< /Length ${cs.length} >>\nstream\n`); push(cs); push('\nendstream'); });
    obj(pid(i) + 2, () => { push(`<< /Type /XObject /Subtype /Image /Width ${pg.pxW} /Height ${pg.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`); push(pg.jpeg); push('\nendstream'); });
  });
  const total = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0; for (const c of parts) { out.set(c, p); p += c.length; }
  return out;
}
