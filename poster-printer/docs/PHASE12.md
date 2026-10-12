# Phase 12 — string widths, widows / orphans, optical balance

Measured with `scripts/qa/text-audit.mjs`: 200 in-app draws (seeds TXT0–199), rendered as inline SVG in headless Chrome, every line measured in the DOM. Before = P11 (fe4401e), after = P12, same seeds. The balance model always comes from the P12 tree, so both sides are measured with the same ruler.

| | P11 | P12 |
|---|---|---|
| lines where engine width ≠ rendered width (> 3 % and > 2 px) | 435 / 3389 (12.8 %) | 10 / 3359 (0.3 %) |
| orphan / widow lines | 47 in 39 posters (37 lone numbers, 10 short last words) | 2 in 2 posters |
| unanchored lopsided posters | 10 | 0 |
| posters with display–info weight jump ≥ 500 | 34 | 28 |
| centre-of-mass deviation, median / p90 | 0.227 / 0.448 | 0.212 / 0.448 |
| geometry audit (P11 gates, DOM boxes) | 4 / 200 | 6 / 200 (all DOM-only; engine boxes 0) |

## Why widths were wrong
1. **The inline poster inherited the app shell's UI font features.** The body sets `font-feature-settings: 'cv11','ss01','ss03'`. In EB Garamond, Cinzel and other faces these swap glyphs, so lines in the editor ran up to 21 % wider than measured. The export was not affected. Fix: the root `<svg>` now resets inherited typography (`SVG_TYPE_RESET`).
2. **Optical-size axes.** Inter and other variable faces were measured at 100 px. The renderer applies `font-optical-sizing:auto`, so small text came out 4–9 % wider. Fix: the measurer now measures at the real size, bucketed to 0.5 px up to 24 px and 4 % steps above.
3. **Collapsed double spaces.** SVG collapsed `"NO. 23  ·  2026"`. Fix: such text now gets `xml:space="preserve"`.

CJK punctuation compression was already modelled (`cjkLine`). The remaining 0.3 % are italic and overhang ink differences.

## Widow / orphan rules
- **Number binding.** A number group binds to the word before it: Track 01, Gallery 3, Sheet 2/6, 03.14 — 06.30. A short unit after a number (3 Min) and a one- or two-letter word (Side B) bind too.
- **Detection.** `widowKind(lines)` flags a lone number line, a final line under 2 Han characters, or a final single short Latin word (≤ 5 letters under a multi-word line, or under 40 % of the widest line). A balanced one-word stack (Print / Room) is not a widow.
- **Repair, in order:**
  1. Balanced re-break at the same line count.
  2. Pull-down: the previous line gives its last word.
  3. Fewer lines, by shrinking up to 8 % and tightening Latin tracking up to 0.012 em.
  4. Otherwise leave it.
- **Forced word stacks** re-stack on k − 1 lines. Semantic headline breaks pay +8 for a number line and +6 for a short last word.
- **Not touched:** author line breaks (`\n`).

## Optical weight and balance (`src/engine/aesthetic/balance.ts`)
- **Mass.** For text: line width × cap height × stroke density × contrast with the ground. Stroke density comes from weight, and black or condensed-black families count as ≥ 800. Images and filled panels contribute too.
- **Deviation.** The centre of visual mass is compared with the poster centre: 0 = centred, 1 = in a corner.
- **Anchored.** The heaviest block touches a canvas edge (within 5 % of the short side) or spans ≥ 80 % of the width or height. Swiss asymmetry is intended, so anchored posters are not penalised.
- **Lopsided.** Not anchored and deviation > 0.30, or deviation > 0.22 with a weight jump ≥ 500. Lopsided candidates cost the light selector 1.5.
- **Weight-jump rule.** Under a heavy display (effective ≥ 700), reading text set at ≤ 300 goes to 400. Its size is trimmed (to no less than 94 %) so each line keeps its measured width, leaving geometry unchanged.
- **Caveat.** "Lopsided 10 → 0" uses the same model that steers the selector, so that number shows the model working, not an independent judgement. Judged by eye, the before/after sheet shows calmer posters, but the selector sometimes picks a different picture or palette.

Sheet: `docs/showcase/phase12_details.jpg`.
