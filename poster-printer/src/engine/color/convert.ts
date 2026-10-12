export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const delin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToLab([r, g, b]: RGB): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToRgb([L, a, b]: Lab): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = finv(fx) * 0.95047, Y = finv(fy), Z = finv(fz) * 1.08883;
  const R = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const G = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const B = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  return [delin(R), delin(G), delin(B)].map((v) => Math.max(0, Math.min(255, v))) as RGB;
}
export const hexToLab = (h: string) => rgbToLab(hexToRgb(h));
export const labToHex = (l: Lab) => rgbToHex(labToRgb(l));

/** LCh helpers (CIELab-based) */
export function hexToLch(h: string): [number, number, number] {
  const [L, a, b] = hexToLab(h);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, Math.hypot(a, b), H];
}
export function lchToHex(L: number, C: number, H: number): string {
  const r = (H * Math.PI) / 180;
  // reduce chroma until in gamut
  for (let c = C; c >= 0; c -= 2) {
    const lab: Lab = [L, c * Math.cos(r), c * Math.sin(r)];
    const rgb = labToRgbRaw(lab);
    if (rgb.every((v) => v >= -0.5 && v <= 255.5)) return rgbToHex(rgb as RGB);
  }
  return labToHex([L, 0, 0]);
}
function labToRgbRaw([L, a, b]: Lab): number[] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = finv(fx) * 0.95047, Y = finv(fy), Z = finv(fz) * 1.08883;
  const lin2 = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return lin2.map((c) => (c < 0 ? -1 : delin(c)));
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
export function deltaE(a: string, b: string) {
  const A = hexToLab(a), B = hexToLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
/** adjust lightness/chroma in LCh */
export function adjust(hex: string, { dL = 0, cMul = 1, dH = 0, L, C }: { dL?: number; cMul?: number; dH?: number; L?: number; C?: number }) {
  const [l, c, h] = hexToLch(hex);
  return lchToHex(Math.max(0, Math.min(100, L ?? l + dL)), Math.max(0, C ?? c * cMul), (h + dH + 360) % 360);
}
