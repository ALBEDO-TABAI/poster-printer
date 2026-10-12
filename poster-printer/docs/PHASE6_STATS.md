# Phase 6 — evaluation (Poster Printer)

Phase 6 changed strategy from rule tuning to a **taste selector**: every fresh auto draw generates several candidates and keeps the one a learned aesthetic model scores highest. Evaluation is the same as phases 4–5: 110 fresh random draws from a seeded spec (`p6c_spec.json`, seed 20261020, 62 styles, all six ratios, random modes), rendered by the real app at :5180 through `lotgo-research/ourtools/render.mjs`, and rated **by my eye** on the same 1–10 "premium" scale. These ratings are one rater's judgement (Grok Bot), not a panel or a user study. Labels: `docs/phase6_labels.txt` (final) and `docs/phase6_labels_rounds.txt` (tuning rounds).

## Targets vs result

| target (raised by 白) | phase 6 result | met? |
|---|---|---|
| premium mean ≥ 8.0 | **7.35** (P5 7.40 · LotGO 7.25) — rounds 7.32 / 7.39 / 7.35 | **no** — still plateaued at ~7.35–7.40 |
| layout-type variety ≥ LotGO (archetype effective kinds ≥ 10.2) | **10.6** (P5 8.4 · LotGO 10.2 at n=110, 10.6 on all 360) | **yes** |
| engine compositions used | 22 distinct, effective **16.1** (P5 14 / 10.0) | variety restored |
| wide 16:9 / 21:9 mean 7.8+ | 6.95 (n=22; rounds 6.59 / 7.00 / 6.95) | **no** |
| premium ≤ 5 | **0%** (P5 0.9%) | yes |

Net: phase 6 keeps phase-5 quality (−0.05, inside rating noise) while bringing variety from well below LotGO back to LotGO's level. It does **not** reach a mean of 8.0.

## Taste selector

- `src/engine/aesthetic/features.ts`: ~90 scene-graph features computed from the finished scene (composition one-hot, type hierarchy, headline size / contrast / position, text area and alignment, image area / clips / cut-out, decoration counts, palette lightness / chroma / hue spread, 24×24 occupancy and balance, quality score, plan flags). No pixels, so it is cheap (~0.2 ms per scene).
- `src/engine/aesthetic/model.ts`: gradient-boosted trees (250 trees, depth 3) exported from scikit-learn by `scripts/taste/export.py`, evaluated in TypeScript by `score.ts`. The TS evaluator matches Python (test in `tests/phase6.test.ts`).
- Training data: **1,099 by-eye ratings** from phases 3–6 (`scripts/taste/train.csv`, produced by `TASTE_EXPORT=1 npx vitest run scripts/taste/export-features.test.ts`). The shipped model was trained on everything except the final phase-6 evaluation set (`python3 scripts/taste/export.py P6` reproduces it byte-for-byte).
- `generate()` (`src/engine/generate.ts`): candidate 0 is the sampler's natural draw; candidates 1..7 keep the composition and plan and re-draw the layout stream (and on alternate candidates the picture or the colour source; object and cover keep their picture because the cut-out subject is the idea). If the best scores below 7.0 (7.3 for compositions on probation) one challenger composition is drawn by the same entropy-aware sampler and gets K/2 variants. The winner's salt / composition / plan / seeds are stored, so history replays exactly.
- K = 8 (`SELECT_K` in `src/store.ts`); knobs in `SELECT` (`generate.ts`).

### Held-out agreement with my ratings

| evaluation | Spearman | within-composition Spearman | MAE |
|---|---|---|---|
| leave-one-set-out over all 11 rating sets (GBR) | 0.72 | 0.53 | — |
| round r1 (110 new draws, model trained on phases 3–5 only) | **0.63** | 0.53 | 0.45 |
| round r2 (110 new draws, trained through r1) | 0.61 | 0.33 | 0.42 |
| **final set (110 new draws, the shipped model, never trained on them)** | **0.47** | **0.58** | **0.45** |

In r1 the model's top quarter averaged 7.89 vs 7.12 for the rest. Note that the final-set correlation is measured on posters the selector already picked, which narrows the range and lowers correlation.

### What the selector can and cannot do

Simulation over 300 draws (approx text measurer, model's own predictions):

| setting | ms avg / max | predicted mean | archetype eff. | comps eff. |
|---|---|---|---|---|
| K=1 (no selection) | 3.8 / 26 | 6.96 | 10.7 | 20.7 |
| **K=8, 1 challenger (shipped)** | 29 / 135 | 7.20 | 10.3 | 17.7 |
| K=12, 1 challenger | 44 / 177 | 7.22 | 10.2 | 17.7 |
| K=8, 2 challengers, accept 7.3 | 44 / 192 | 7.28 | 9.3 | 13.6 |
| K=8, 3 challengers, accept 7.5 | 56 / 196 | 7.34 | 8.2 | 11.0 |

Selecting among layout variants of one composition gains ~+0.25 and then saturates; further gains come only from switching to the high-scoring compositions, which collapses variety. Since 白 asked for variety ≥ LotGO, the shipped setting stops at one challenger. Reaching 8.0 needs better composers, not more selection.

**Timing (real app, Chromium, 110 final draws):** mean 30 ms, p95 56 ms, max 81 ms per draw (r2: mean 32, max 129). **Deviation:** the selector runs on the main thread, not in a Web Worker — the scene builder measures text with the page's canvas fonts and moving it into a worker needs OffscreenCanvas font loading and store plumbing, which touches app code outside the generator. It stays well under the ~300 ms budget; a worker is listed as follow-up.

**Not done:** the optional CLIP/LAION aesthetic cross-check (no pixel model was run).

## Changes in this phase

- **Sampler v2** (`src/engine/gen/sampler.ts`): archetype-first weighting (target share per archetype × preference inside it), recency penalties per archetype and composition, probation list. Layouts removed in phase 5 for averaging < 7 are back in the pool on probation: the selector only accepts their best candidates (higher bar).
- **Two new compositions** (`src/engine/gen/comps4.ts`): 物件海报 object (a cut-out subject standing in front of a giant word on a flat field, portrait/square only) and 全景横幅 panorama (full-width photo plus a band that hugs a one- or two-line heavy headline).
- **Weak cases:**
  - wide: echo, mosaic and object dropped on ≥16:9 (rated 5–6); veil and split dropped on 21:9; knockout and panorama boosted on wide; panorama needs a picture and puts the band at the bottom more often. Result 6.95 — the 7.8 aim was not reached.
  - short CN headlines on pale grounds (edge): ≤4 characters no longer bleed; they fit the margin and sit on it.
  - thin brush-script headlines in knockout: knockout maps brush/thin CJK faces to Source Han 900.
  - cover subject in front of masthead: the masthead slides down so the subject overlaps its lower part, and the legibility rule is relaxed by headline length (≤50% hidden for CJK, ≤62% for EN ≥5 letters). Typeset covers without a picture are down-weighted (they rated 6–7).
  - index: the system-tagged timetable counts as one block in the audit.
- Strongest archetypes this phase (final set): vertical 7.80, veil 7.75, bento 7.67, knockout 7.64, ring 7.58. Object rated 8 when the subject is present (it rated 5 in r1 when the selector re-drew the picture; fixed).

## Rounds

| round | seed | what changed | mean | ≥8 | ≤6 | archetype eff. |
|---|---|---|---|---|---|---|
| r1 | 20261018 | selector K=8, sampler v2, object/panorama | 7.32 | 45% | 10.9% | 9.7* |
| r2 | 20261019 | object keeps its picture; no echo/mosaic/object on wide; model retrained with r1 | 7.39 | 50% | 10.0% | 9.9* |
| **final** | 20261020 | panorama needs a picture; 21:9 tightened; typeset cover down; model retrained with r2 | **7.35** | **46%** | **10.9%** | **10.6** |

*r1/r2 archetype counts mapped cover→LAY regardless of cut-out; the final row uses the cut-aware mapping from the catalog.


Manual sets: LotGO n=360, P3 n=110, P4 n=110, P5 n=110, P6 n=110 (P5 = 110 fresh random draws, seed 20261017; P6 = 110 fresh random draws, seed 20261020, taste selector on; same render path and rating scale).

P5/P6 note: premium was rated by eye per poster; archetype and image codes for P5/P6 were derived from the scene graph (composition → archetype, image nodes → fb / half / inset / multi + circle / shape / cut) instead of hand-typed, so axes that were only hand-labelled in earlier phases (faces, decoration, tone words) are not repeated for P5/P6.

## Quality

| metric | LotGO | ours P3 | ours P4 | ours P5 | ours P6 |
|---|---|---|---|---|---|
| premium mean | 7.25 | 6.00 | 6.83 | 7.40 | 7.35 |
| premium ≥8 | 34% | 0% | 10% | 51% | 46% |
| premium ≤6 | 13.1% | 80.9% | 26.4% | 10.0% | 10.9% |
| premium ≤5 | 1.1% | 19.1% | 0.9% | 0.9% | 0.0% |

## Variety

| metric | LotGO | ours P3 | ours P4 | ours P5 | ours P6 |
|---|---|---|---|---|---|
| archetypes used | 14 | 12 | 12 | 11 | 12 |
| archetype effective kinds | 10.6 | 9.1 | 7.1 | 8.4 | 10.6 |
| arch × image combos (distinct) | 89 | 38 | 42 | 23 | 32 |
| combo effective kinds | 41.7 | 23.2 | 23.8 | 16.5 | 23.2 |
| no-image share | 31% | 7% | 34% | 27% | 22% |

## Size-matched variety (LotGO resampled to n=110, 300 draws)

- LotGO at n=110: distinct combos 45.7, combo effective kinds 30.8, archetype effective kinds 10.2
- ours P3 engine compositions used: 12 distinct, effective 10.8
- ours P4 engine compositions used: 19 distinct, effective 15.3
- ours P5 engine compositions used: 14 distinct, effective 10.0
- ours P6 engine compositions used: 22 distinct, effective 16.1

## Automatic image metrics (median, IQR; all frames)

| metric | LotGO | ours P3 | ours P4 | ours P5 | ours P6 |
|---|---|---|---|---|---|
| mean L* | 46.40 (35.00–61.10) | 49.45 (38.32–68.12) | 52.75 (38.58–65.95) | 51.20 (37.17–60.60) | 51.25 (38.27–61.60) |
| tonal range L* | 52.20 (32.20–67.20) | 59.75 (49.27–74.65) | 64.55 (48.90–77.75) | 66.00 (55.38–80.08) | 67.50 (55.22–77.75) |
| mean chroma C* | 19.90 (10.20–31.60) | 16.10 (10.85–26.18) | 22.15 (14.00–34.02) | 23.80 (14.47–37.45) | 24.55 (12.00–38.02) |
| colorfulness (Hasler) | 15.30 (8.00–23.50) | 15.10 (8.33–21.65) | 19.45 (12.38–27.52) | 21.35 (13.12–31.47) | 19.95 (13.00–32.40) |
| photo area fraction | 0.22 (0.15–0.32) | 0.36 (0.25–0.45) | 0.32 (0.23–0.41) | 0.35 (0.28–0.46) | 0.39 (0.28–0.56) |
| flat colours ≥3% | 3.00 (2.00–3.00) | 3.00 (3.00–4.00) | 3.00 (2.00–4.00) | 3.00 (3.00–4.00) | 4.00 (3.00–4.00) |

## Archetype distribution

| arch | LotGO | ours P3 | ours P4 | ours P5 | ours P6 |
|---|---|---|---|---|---|
| FB — full-bleed image + overlay type | 5% | 12% | 3% | 11% | 11% |
| SPL — split (vertical/horizontal zones) | 13% | 24% | 11% | 15% | 13% |
| MOD — modular checker / sliced grid | 11% | 7% | 6% | 4% | 6% |
| GG — giant glyph / type-as-hero | 18% | 10% | 44% | 22% | 14% |
| BAND — horizontal band(s) | 6% | 14% | 5% | 2% | 7% |
| CARD — rounded/outlined cards & panels | 8% | 5% | 7% | 4% | 6% |
| PART — translucent colour-block partition over image | 6% | 0% | 4% | 3% | 5% |
| TORN — torn-paper panel collage | 1% | 1% | 0% | 0% | 0% |
| CTR — centred typographic minimal | 11% | 5% | 5% | 12% | 11% |
| SWI — Swiss asymmetric typographic | 10% | 1% | 3% | 16% | 11% |
| FAN — curve/semicircle mask grid | 0% | 8% | 4% | 11% | 12% |
| INSET — colour field + small inset image | 7% | 12% | 8% | 0% | 3% |
| LAY — cover: subject in front of masthead (depth) | 3% | 3% | 1% | 2% | 2% |
| COL — sticker collage | 0% | 0% | 0% | 0% | 0% |

## P6 premium by engine composition

| composition | n | mean |
|---|---|---|
| knockout | 14 | 7.64 |
| quote | 12 | 7.17 |
| ring | 12 | 7.58 |
| vertical | 10 | 7.80 |
| cover | 8 | 6.88 |
| edge | 8 | 7.38 |
| mosaic | 6 | 7.33 |
| bento | 6 | 7.67 |
| panorama | 6 | 7.33 |
| fullbleed | 4 | 6.75 |
| veil | 4 | 7.75 |
| typo | 4 | 7.50 |
| echo | 3 | 7.33 |
| inset | 3 | 7.00 |
| bands | 2 | 7.00 |
| index | 2 | 7.00 |
| fan | 1 | 6.00 |
| ghost | 1 | 7.00 |
| cards | 1 | 6.00 |
| checker | 1 | 7.00 |
| partition | 1 | 6.00 |
| object | 1 | 8.00 |

## P6 premium by ratio

| ratio | n | mean |
|---|---|---|
| 3:4 | 60 | 7.60 |
| 4:3 | 13 | 7.00 |
| 21:9 | 11 | 7.00 |
| 16:9 | 11 | 6.91 |
| 9:16 | 9 | 7.44 |
| 1:1 | 6 | 7.00 |
