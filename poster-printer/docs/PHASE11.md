# Phase 11 — modern hanzi faces, geometric hard gates, palette fit, light selector

All ratings and judgements below are by eye (Grok Bot). Blinding was partial. The user's A/B test is still to come.

## 1. Hanzi faces
- Brush and calligraphy styles are now **opt-in only**: zh-brush-title, zh-cursive-air, zh-longcang, zh-wild-grass, zh-wenkai-note and zh-xiaowei (`OPT_IN_STYLES`, `optIn: true`).
  - Random draws (`RANDOM_STYLES`: editor random, rate.html, lab) never pick them.
  - The CLI ranks them −6 unless the brief names them.
- New OFL faces: **Chiron Sung HK** (a modern Song/Ming) and **Chiron Hei HK**. Two new styles use them: `zh-modern-song` and `zh-modern-hei`.
- Several style and pairing hanzi display faces were moved off old-style faces. The licenses/FONTS.md entry for Phase 11 lists them.
- **水木明体 is not bundled.** Its licence is IPA 1.0, not OFL. MiSans, HarmonyOS Sans and Huiwen-mincho are not bundled either (proprietary or custom licences). Details are in licenses/FONTS.md.

## 2. Geometric hard gates (`src/engine/aesthetic/geo.ts`)
The gates run on readable text boxes:
- **collide:** two text boxes intersect, unless the overlap is declared intentional.
- **bleed:** text runs off the canvas.
- **padding:** text sits closer than 1.5 grid units to an edge.
- **panel:** text straddles a panel edge.
- **align:** near-miss left edges (soft).

A failing attempt is retried. A safe-area nudge moves small text up to 1.5u inward, and only when that creates no new collision.

Root-cause fixes:
- **calendar:** the event disc is placed before the grid, and day numbers under the disc are not drawn.
- **zoned:** the info zone starts below the headline when they would overlap.

Audit: `scripts/qa/geo-audit.mjs`. It covers 200 random draws, measured on rendered DOM ink boxes in headless Chrome.

| | rejected | main kinds |
|---|---|---|
| P10 (2125f12) | 30 / 200 (15%) | collide 19, padding 18, panel 6, bleed 1 (edge, calendar, anomaly worst) |
| P11 | 4 / 200 (2%) | collide 4 (cover ×2, hanzi, fullbleed); engine boxes pass, DOM ink boxes differ |

Most of the drop comes from gate + retry + nudge. Only calendar and zoned are true layout fixes. The cover masthead vs. running-text collision is not root-fixed yet.

## 3. Palette fit (`src/engine/color/fit.ts`)
Fails:
- **fights-image:** a loud flat hue sits 50–130° from every hue in the picture.
- **mood-quiet-vs-neon:** quiet copy (exhibition, poetry, tea…) gets neon or high mean chroma.
- **thin-serif-neon:** a thin serif display face on neon.
- **muddy-low-contrast:** a desaturated mid-tone ground with ink contrast below 4.5.
- **vibrating-text:** saturated near-complementary text on a ground of similar lightness.
- **poor-fit:** several small misfits add up.

A failing palette is redrawn from the picture's own colours first (de-mudded, accent boosted), then from curated wada/nice palettes, and the best fit is kept. This applies in normal and random colour modes; experimental mode and pinned or base palettes are untouched.

Result on 200 in-app random draws: 156 eligible, **14 repaired (9%)** (fights-image 7, poor-fit 3, quiet-vs-neon 3, vibrating 1), 0 still failing.

Sheet: `docs/showcase/phase11_palette_fit.jpg`, rejected (fit off) vs. kept, same seed. A changed palette also changes the selector's pick, so the layout/picture can differ too.

## 4. Selector → light touch (default)
`SELECT.mode = 'light'`. Candidates are first filtered by hard costs (gates, geometry fails ×3, palette-fit fails ×2, dropped content). Among the survivors the pick is a seeded uniform draw, and taste has weight 0.15, so it acts only as a tie-break. Light mode skips the alternative-composition and P8 strategy-route searches, because those re-impose the learned taste. `selectMode: 'taste'` restores the P10 behaviour.

## 5. A/B setup (rate.html → A/B pairs)
Each pair is one draw: seeds, ratio, style and composition `auto`, rendered by two arms.
- **p11:** gates + light selector. Opt-in brush styles map to zh-modern-song / zh-modern-hei.
- **p10-random:** no selector (`select: 0`), `geoGate: false`, `paletteFit: false`, and the full P10 style pool.

Sides are shuffled per pair, and the export records `arms: {a, b}` plus `arm` on each side. Code-level layout fixes (calendar, zoned) apply to both arms.

Before/after sheet: `docs/showcase/phase11_before_after.jpg` (same seeds; P10 default vs. P11 default).
