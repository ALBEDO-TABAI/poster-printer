// Seeded deterministic RNG utilities (sfc32 seeded by cyrb128 string hash).
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export class Rng {
  private f: () => number;
  readonly seed: string;
  constructor(seed: string) {
    this.seed = seed;
    const s = cyrb128(seed);
    this.f = sfc32(s[0], s[1], s[2], s[3]);
    for (let i = 0; i < 12; i++) this.f();
  }
  next() { return this.f(); }
  range(a: number, b: number) { return a + (b - a) * this.f(); }
  int(a: number, b: number) { return Math.floor(a + (b - a + 1) * this.f()); }
  chance(p: number) { return this.f() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.f() * arr.length)]; }
  /** weighted pick from [item, weight][] or record */
  weighted<T extends string>(w: Partial<Record<T, number>> | [T, number][]): T {
    const entries: [T, number][] = Array.isArray(w) ? w : (Object.entries(w) as [T, number][]);
    let tot = 0;
    for (const [, v] of entries) tot += Math.max(0, v || 0);
    if (tot <= 0) return entries[0][0];
    let r = this.f() * tot;
    for (const [k, v] of entries) { r -= Math.max(0, v || 0); if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  sample<T>(arr: readonly T[], n: number): T[] { return this.shuffle(arr.slice()).slice(0, n); }
  gauss(mu = 0, sd = 1) {
    const u = 1 - this.f(), v = this.f();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  fork(label: string) { return new Rng(this.seed + '|' + label); }
}

const ALPHA = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
export function newSeed(len = 12): string {
  let s = '';
  const buf = new Uint32Array(len);
  (globalThis.crypto || ({ getRandomValues: (b: Uint32Array) => b.map(() => Math.random() * 2 ** 32) } as any)).getRandomValues(buf);
  for (let i = 0; i < len; i++) s += ALPHA[buf[i] % ALPHA.length];
  return s;
}
