# Phase 5 — evaluation (Poster Printer, formerly REA Poster)

Evaluation is the same as phase 4: 110 fresh random draws from a seeded spec (`p5h_spec.json`, seed 20261017, 62 styles, all six ratios, random modes). They were rendered by the real app at :5180 through `lotgo-research/ourtools/render.mjs` and rated by eye on the same 1–10 "premium" scale used for LotGO, phase 3 and phase 4. Per-poster labels are in `docs/phase5_labels.txt`; the CSV is `lotgo-research/ours5i/catalog.csv`, in the same schema.

## Targets vs result

| target (raised by 白) | phase 5 result | met? |
|---|---|---|
| premium mean ≥ 8.0 | **7.40** (LotGO 7.25 · P4 6.83 · P3 6.00) | no — plateaued at 7.3–7.4 |
| share ≥ 8 ≥ 60% | **51%** (LotGO 34% · P4 10%) | no |
| share ≤ 6 < 5% | **10.0%** (LotGO 13.1% · P4 26.4%) | no |
| ≤ 5 (phase-4 metric) | 0.9% | yes |
| variety ≥ LotGO | archetype effective kinds 8.4 vs LotGO 10.2 at n=110; engine compositions used 14, effective 10.0 | no — traded for quality (see below) |

## Rounds

Each round was rated on a fresh seed, so tuning never saw the evaluation set.

| round | seed | what changed | mean | ≥8 | ≤6 |
|---|---|---|---|---|---|
| r2 | 20261013 | first V3 compositions | 6.95 | 31% | 30% |
| r3 | 20261013 | wide formats restricted; mode remap; masthead fixes | 7.11 | 40% | 21% |
| r3-fresh | 20261015 | same code, fresh draw | 7.25 | 41% | 14.5% |
| r4 | 20261016 | sub-7 layouts zeroed (inset, ghost; bands/veil mode boosts cut); wide knockout puts the photo edge to edge; ring/quote/vertical up | 7.32 | 45% | 11.8% |
| **r5 (final)** | 20261017 | zh echo ×0.35; no type-only quote on wide; wide formats keep their picture; groupArray NaN fix | **7.40** | **51%** | **10.0%** |

The last three rounds gained +0.07 and +0.08. By the brief's definition, that is a plateau for this approach.

## Four-way comparison

Manual sets: LotGO n=360, P3 n=110, P4 n=110, P5 n=110 (P5 = 110 fresh random draws, seed 20261017, same render path and rating scale).

P5 note: premium was rated by eye per poster; archetype and image codes for P5 were derived from the scene graph (composition → archetype, image nodes → fb / half / inset / multi + circle / shape / cut) instead of hand-typed, so axes that were only hand-labelled in earlier phases (faces, decoration, tone words) are not repeated for P5.

## Quality

| metric | LotGO | ours P3 | ours P4 | ours P5 |
|---|---|---|---|---|
| premium mean | 7.25 | 6.00 | 6.83 | 7.40 |
| premium ≥8 | 34% | 0% | 10% | 51% |
| premium ≤6 | 13.1% | 80.9% | 26.4% | 10.0% |
| premium ≤5 | 1.1% | 19.1% | 0.9% | 0.9% |

## Variety

| metric | LotGO | ours P3 | ours P4 | ours P5 |
|---|---|---|---|---|
| archetypes used | 14 | 12 | 12 | 11 |
| archetype effective kinds | 10.6 | 9.1 | 7.1 | 8.4 |
| arch × image combos (distinct) | 89 | 38 | 42 | 23 |
| combo effective kinds | 41.7 | 23.2 | 23.8 | 16.5 |
| no-image share | 31% | 7% | 34% | 27% |

## Size-matched variety (LotGO resampled to n=110, 300 draws)

- LotGO at n=110: distinct combos 45.7, combo effective kinds 30.8, archetype effective kinds 10.2
- ours P3 engine compositions used: 12 distinct, effective 10.8
- ours P4 engine compositions used: 19 distinct, effective 15.3
- ours P5 engine compositions used: 14 distinct, effective 10.0

## Automatic image metrics (median, IQR; all frames)

| metric | LotGO | ours P3 | ours P4 | ours P5 |
|---|---|---|---|---|
| mean L* | 46.40 (35.00–61.10) | 49.45 (38.32–68.12) | 52.75 (38.58–65.95) | 51.20 (37.17–60.60) |
| tonal range L* | 52.20 (32.20–67.20) | 59.75 (49.27–74.65) | 64.55 (48.90–77.75) | 66.00 (55.38–80.08) |
| mean chroma C* | 19.90 (10.20–31.60) | 16.10 (10.85–26.18) | 22.15 (14.00–34.02) | 23.80 (14.47–37.45) |
| colorfulness (Hasler) | 15.30 (8.00–23.50) | 15.10 (8.33–21.65) | 19.45 (12.38–27.52) | 21.35 (13.12–31.47) |
| photo area fraction | 0.22 (0.15–0.32) | 0.36 (0.25–0.45) | 0.32 (0.23–0.41) | 0.35 (0.28–0.46) |
| flat colours ≥3% | 3.00 (2.00–3.00) | 3.00 (3.00–4.00) | 3.00 (2.00–4.00) | 3.00 (3.00–4.00) |

## Archetype distribution

| arch | LotGO | ours P3 | ours P4 | ours P5 |
|---|---|---|---|---|
| FB — full-bleed image + overlay type | 5% | 12% | 3% | 11% |
| SPL — split (vertical/horizontal zones) | 13% | 24% | 11% | 15% |
| MOD — modular checker / sliced grid | 11% | 7% | 6% | 4% |
| GG — giant glyph / type-as-hero | 18% | 10% | 44% | 22% |
| BAND — horizontal band(s) | 6% | 14% | 5% | 2% |
| CARD — rounded/outlined cards & panels | 8% | 5% | 7% | 4% |
| PART — translucent colour-block partition over image | 6% | 0% | 4% | 3% |
| TORN — torn-paper panel collage | 1% | 1% | 0% | 0% |
| CTR — centred typographic minimal | 11% | 5% | 5% | 12% |
| SWI — Swiss asymmetric typographic | 10% | 1% | 3% | 16% |
| FAN — curve/semicircle mask grid | 0% | 8% | 4% | 11% |
| INSET — colour field + small inset image | 7% | 12% | 8% | 0% |
| LAY — cover: subject in front of masthead (depth) | 3% | 3% | 1% | 2% |
| COL — sticker collage | 0% | 0% | 0% | 0% |

## P5 premium by engine composition

| composition | n | mean |
|---|---|---|
| vertical | 17 | 7.35 |
| edge | 16 | 7.38 |
| knockout | 16 | 7.38 |
| cover | 15 | 7.20 |
| quote | 13 | 7.69 |
| ring | 12 | 7.83 |
| typo | 4 | 7.25 |
| bento | 4 | 7.50 |
| mosaic | 4 | 7.00 |
| veil | 3 | 7.00 |
| echo | 2 | 7.50 |
| giant | 2 | 6.50 |
| fullbleed | 1 | 7.00 |
| index | 1 | 8.00 |

## P5 premium by ratio

| ratio | n | mean |
|---|---|---|
| 3:4 | 59 | 7.49 |
| 9:16 | 16 | 7.69 |
| 16:9 | 12 | 7.00 |
| 4:3 | 10 | 7.10 |
| 21:9 | 7 | 7.00 |
| 1:1 | 6 | 7.50 |


## Where the remaining ≤6 posters come from (final round, 11 posters)

- **Long formats.** 16:9 averages 7.00 and 21:9 averages 7.00, against 7.49 for 3:4 and 7.69 for 9:16. The weak cases are:
  - a thin brush-script knockout on 21:9;
  - a cover whose cut-out subject covers a short hanzi masthead;
  - a sparse 4:3 vertical spine.
- **Sparse zh edge posters.** These have a short hanzi headline cropped at the foot on a pale field (3 posters).
- **Single weak ones.** One mosaic, one giant and one typo poster with too little content.

## Why 8.0 was not reached

- The 8-rated posters already come from every strong composition: ring 7.83, quote 7.69, edge, knockout, vertical, cover. Each of those also produces 7s; none averages ≥ 8 on its own.
- Lifting the mean to 8 would need either a composition that reliably rates 8–9, or a much stronger selector. The current quality gate scores geometry, not taste.
- Rating is by one eye on a 1–10 scale. On that scale LotGO itself averages 7.25 and has 34% ≥ 8, so phase 5 now rates above the reference.

## Variety trade-off

- 白's instruction was to be ruthless with layouts averaging below 7. Zeroing inset, ghost, bands, split, checker, partition, cards and centered in auto draws cut the composition spread:
  - phase 4 used 19 compositions, effective 15.3;
  - phase 5 uses 14, effective 10.0.
- The archetype spread rose a little over phase 4 (8.4 vs 7.1 effective kinds) because the new compositions land in archetypes that were rare before: SWI, CTR and FAN. It is still below LotGO's 10.2.
- The P5 arch × image combo counts in the variety table are **not** comparable to earlier phases. P5 image codes were derived automatically from the scene graph with a coarser vocabulary, whereas P3/P4/LotGO were hand-typed with a richer one.
- Every removed layout is still selectable by hand in 构图. The recency sampler keeps the same composition from repeating back-to-back:
  - the last 4 draws are weighted ×0.15 / 0.35 / 0.6 / 0.6;
  - all weights are flattened with w^0.85.
