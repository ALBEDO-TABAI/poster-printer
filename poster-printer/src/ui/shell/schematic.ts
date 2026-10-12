// @ts-nocheck — ported verbatim from the prototype
/* "What this does" schematics — tiny live diagrams that react to a parameter's value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function schematic(def: any, v: any): string {
  const ink = 'currentColor';
  const fr = def.type === 'range' ? (Number(v) - def.min) / (def.max - def.min || 1) : 0;
  const page = (inner) => `<svg viewBox="0 0 92 92" fill="none" stroke="${ink}" stroke-width="1.2"><rect x="22" y="12" width="48" height="68" rx="2" fill="var(--stage)" stroke-opacity=".35"/>${inner}</svg>`;
  const k = def.key;
  if (k === 'margin') { const m = 2 + fr * 14; return page(`<rect x="${22 + m}" y="${12 + m}" width="${48 - 2 * m}" height="${68 - 2 * m}" stroke="var(--accent)" stroke-dasharray="2 2"/><rect x="${24 + m}" y="${14 + m}" width="${(48 - 2 * m) * .7}" height="7" fill="${ink}" stroke="none" opacity=".8"/>`); }
  if (k === 'cols' || k === 'gutter' || k === 'gridStrength') {
    const n = k === 'cols' ? Math.max(2, Number(v) || 4) : 4; const g = k === 'gutter' ? fr * 8 : 2; const w = (40 - g * (n - 1)) / n;
    let s = ''; for (let i = 0; i < n; i++) s += `<rect x="${26 + i * (w + g)}" y="16" width="${Math.max(.5, w)}" height="60" fill="var(--accent)" fill-opacity=".14" stroke="var(--accent)" stroke-opacity=".6"/>`; return page(s);
  }
  if (k === 'rows' || k === 'baseline') {
    const n = k === 'rows' ? Math.max(2, Number(v) || 6) : Math.round(14 - fr * 10); let s = ''; for (let i = 1; i < n; i++) s += `<line x1="24" x2="68" y1="${12 + i * 68 / n}" y2="${12 + i * 68 / n}" stroke="var(--accent)" stroke-opacity=".6"/>`; return page(s);
  }
  if (k === 'whitespace' || k === 'density' || k === 'blockBudget' || k === 'decorBudget') {
    const n = k === 'whitespace' ? Math.round(9 - fr * 7) : 3 + Math.round(fr * 6); let s = '';
    for (let i = 0; i < n; i++) s += `<rect x="${27 + (i % 3) * 14}" y="${18 + Math.floor(i / 3) * 18}" width="${i === 0 ? 24 : 10}" height="${i === 0 ? 12 : 4}" fill="${ink}" stroke="none" opacity="${i === 0 ? .85 : .4}"/>`; return page(s);
  }
  if (k === 'symmetry') { const off = (1 - fr) * 12; return page(`<line x1="46" y1="14" x2="46" y2="78" stroke="var(--accent)" stroke-dasharray="2 2"/><rect x="${32 + off}" y="22" width="${28 - off}" height="10" fill="${ink}" stroke="none" opacity=".85"/><rect x="${36 - off / 2}" y="40" width="20" height="4" fill="${ink}" stroke="none" opacity=".4"/>`); }
  if (['titleScale', 'smallRel', 'glyphSize', 'smallScale', 'proseSize', 'sidebarFont', 'ornamentSize'].includes(k)) {
    const s = 14 + fr * 46; return `<svg viewBox="0 0 92 92"><text x="46" y="${50 + s * .34}" text-anchor="middle" font-family="PP Display, sans-serif" font-weight="800" font-size="${s}" fill="${ink}" letter-spacing="-2">Aa</text><text x="46" y="84" text-anchor="middle" font-family="Inter" font-size="7" fill="${ink}" opacity=".45">${Math.round(Number(v))}${def.unit || ''}</text></svg>`;
  }
  if (k === 'cornerRadius') { const r = fr * 22; return `<svg viewBox="0 0 92 92"><rect x="18" y="22" width="56" height="48" rx="${r}" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)"/></svg>`; }
  if (k === 'cardGap' || k === 'groupGap' || k === 'mainBreath' || k === 'subBreath') { const g = 2 + fr * 16; return `<svg viewBox="0 0 92 92" fill="${ink}"><rect x="${46 - g / 2 - 24}" y="26" width="24" height="40" rx="4" opacity=".75"/><rect x="${46 + g / 2}" y="26" width="24" height="40" rx="4" opacity=".75"/></svg>`; }
  if (k === 'imageShare' || k === 'bandHeight' || k === 'sidebarWidth' || k === 'imageZoom') { const h = 6 + fr * 62; return page(`<rect x="22" y="${80 - h}" width="48" height="${h}" fill="var(--accent)" fill-opacity=".35" stroke="none"/><path d="M26 ${80 - h + 18} l8 -8 l6 6 l6 -9 l10 11" stroke="var(--accent)" opacity="${h > 24 ? 1 : 0}"/>`); }
  if (['textureAmount', 'noiseAmount', 'grainShare', 'scriptShare', 'duotone'].includes(k)) {
    let s = ''; const n = Math.round(fr * 140); let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) s += `<circle cx="${8 + rnd() * 76}" cy="${8 + rnd() * 76}" r="${.5 + rnd() * .9}" fill="${ink}" opacity="${.25 + rnd() * .5}"/>`;
    return `<svg viewBox="0 0 92 92">${s}</svg>`;
  }
  if (['contrast', 'saturation', 'brightness', 'imgSat', 'imgContrast', 'accentUse', 'minContrast', 'legibility'].includes(k)) {
    const f = k === 'contrast' || k === 'imgContrast' ? `contrast(${v}%)` : k === 'brightness' ? `brightness(${v}%)` : k === 'saturation' || k === 'imgSat' ? `saturate(${v}%)` : 'none';
    return `<svg viewBox="0 0 92 92"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#173f5f"/><stop offset=".35" stop-color="#20639b"/><stop offset=".6" stop-color="#f6d55c"/><stop offset="1" stop-color="#ed553b"/></linearGradient></defs><g style="filter:${f}"><rect x="10" y="22" width="72" height="48" rx="8" fill="url(#sg)"/></g></svg>`;
  }
  if (k === 'lineWeight' || k === 'ruleWeight' || k === 'gridOpacity' || k === 'nodeSize') {
    const w = k === 'gridOpacity' ? 1 : .4 + fr * 4; const op = k === 'gridOpacity' ? .1 + fr * .9 : .85; let s = '';
    for (let i = 0; i < 4; i++) s += `<line x1="14" x2="78" y1="${24 + i * 14}" y2="${24 + i * 14}" stroke="${ink}" stroke-width="${w}" opacity="${op}"/>`;
    if (k === 'nodeSize') for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += `<circle cx="${20 + j * 17}" cy="${24 + i * 14}" r="${fr * 3.5}" fill="var(--accent)"/>`;
    return `<svg viewBox="0 0 92 92">${s}</svg>`;
  }
  if (def.type === 'seg') {
    const opts = def.options.slice(0, 6); const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
    return `<svg viewBox="0 0 92 92">${opts.map((o, i) => `<g transform="translate(10 ${10 + i * 12.5})"><rect width="72" height="10" rx="5" fill="${o.v === v ? 'var(--accent)' : 'currentColor'}" opacity="${o.v === v ? 1 : .08}"/><text x="7" y="7.3" font-size="6.6" font-family="Inter, Noto Sans SC UI" fill="${o.v === v ? '#fff' : 'currentColor'}" opacity="${o.v === v ? 1 : .6}">${o[lang]}</text></g>`).join('')}</svg>`;
  }
  if (def.type === 'bool') {
    return `<svg viewBox="0 0 92 92"><rect x="22" y="34" width="48" height="26" rx="13" fill="${v ? 'var(--accent)' : 'currentColor'}" opacity="${v ? 1 : .15}"/><circle cx="${v ? 57 : 35}" cy="47" r="10" fill="#fff"/></svg>`;
  }
  // generic dial
  const a = -220 + fr * 260, rad = (d) => d * Math.PI / 180; const R = 28;
  const arc = (a0, a1) => { const x0 = 46 + R * Math.cos(rad(a0)), y0 = 50 + R * Math.sin(rad(a0)), x1 = 46 + R * Math.cos(rad(a1)), y1 = 50 + R * Math.sin(rad(a1)); return `M${x0} ${y0} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
  return `<svg viewBox="0 0 92 92" fill="none" stroke-linecap="round"><path d="${arc(-220, 40)}" stroke="currentColor" stroke-opacity=".12" stroke-width="6"/><path d="${arc(-220, Math.max(-219, a))}" stroke="var(--accent)" stroke-width="6"/><text x="46" y="55" text-anchor="middle" font-family="Geist Mono" font-size="12" fill="currentColor">${def.type === 'range' ? (Number.isInteger(def.step) ? Math.round(v) : Number(v).toFixed(1)) : ''}</text></svg>`;
}
