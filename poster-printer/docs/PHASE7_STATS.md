# Phase 7: idea layer, gates, CJK pass, retrained selector

All ratings are **by eye (Grok Bot)** on the scale in `docs/RATING_RUBRIC.md`, using half-points and checked against the frozen anchors in `docs/anchors/`. Blinding is only partial. Pair sides are randomised and the key is opened after judging, but I wrote the new composers, so I can sometimes recognise them.

## Headline numbers (final set: seed 20261025, 110 fresh random draws, shipped code ea66de9)

| | LotGO | P5 | P6 | **P7** |
|---|---|---|---|---|
| mean (P6-era integer scale, from PHASE6_STATS) | 7.25 | 7.40 | 7.35 | — |
| **same-session half-point scale, same 110 seeds** | — | — | 7.22 | **7.29** |
| ≥ 8 (same session) | — | — | 5 (4.5%) | 5 (4.5%) |
| ≥ 7.5 (same session) | — | — | 56 (51%) | **66 (60%)** |
| ≤ 6 (same session) | — | — | 2 | **0** |
| count of 9s | 0 | 0 | 0 | **0** |
| **blind pairwise P7 vs P6 (same seeds)** | | | | **55.9%** (38 W / 47 T / 25 L) |
| archetype effective kinds | 10.6 (10.2 @ n=110) | 8.4 | 10.6 | **10.27** (P6 on these seeds: 9.91) |
| compositions used / effective | — | 14 / 10.0 | 22 / 16.1 | 19 / 13.4 (+ 14 ideas, effective 11.4) |

Scale note. In P6 I rated whole numbers. In P7 I used half-points against anchors, and the half-point scale came out stricter. Most "8"s from P6 are 7.5 here, so the ≥8 shares cannot be compared across phases (P6 46% vs P7 4.5%). The fair comparisons are the **same-session absolute ratings of both versions on the same seeds** and the **blind pairwise preference**. On the 28 P6 posters I re-rated in a second sitting, the mean |difference| was 0.02 (27/28 identical). Same-session ratings are therefore consistent.

### Rounds (iterate until plateau)

| round | seed | P7 mean | pairwise vs P6 | main change afterwards |
|---|---|---|---|---|
| dev 1 / dev 2 | 60 + 48 draws | — | — | glyph anomalies, sparse ma and window fixed; knockout share cut |
| r1 | 20261023 | 7.35 | — | idea weights re-balanced (hanzi best at 8.12, window worst at 6.81) |
| r2 | 20261024 | 7.40 | **60.5%** (60/13/37) | zh substitute no longer cuts words; ma does not repeat the headline |
| r2 re-render | 20261024 | 7.37 | 57.7% | ma needs a picture; flatter archetype targets; deterministic retry budget |
| final | 20261025 | 7.29 (same-session scale) | **55.9%** | emptiness idea down-weighted (lost 3 blind rounds) |

Pairwise preference over P6 holds at 56–60% across three seed sets. Absolute means did not move beyond about ±0.05 between rounds, so the plateau is reached with this design.

### Where P7 wins and loses (final set, pairwise P7 win rate, ties count ½)

- **Strong:** ring/orbit 0.79, hanzi-as-image 0.75 (on r2: 7/7 wins), knockout/tension 0.74, vertical 0.65, cover/occlusion 0.67, anomaly idea 0.71.
- **Weak:** emptiness/ma 0.07 (it made the poster feel empty rather than intentional), inset 0.12, fullbleed/immersion 0.17, bento/specimen 0.20–0.29, quote/voice 0.35.
- **New composers only:** 0.455 (n=11). **Older composers reached through the idea layer, gates and Itten palettes:** 0.571 (n=99). Most of the gain therefore comes from the idea → palette → gate pipeline, not from the six new composers.

## What was added

1. **Idea layer** (`src/engine/gen/ideas.ts`). Each draw first picks one of 14 ideas: scale shock, substitution, occlusion, repetition with one anomaly, reveal, tension edge, emptiness (ma), data-as-form, hanzi-as-image, split meaning, orbit, voice, specimen and immersion. Each idea is an original rule system: a tension rule, the compositions that realise it, one dominant Itten contrast, a frame (grid, dynamic-symmetry eyes or canon), and the single allowed rule-break. Six new composers are in `comps5.ts`: ma, substitute, hanzi, anomaly, calendar and window. The idea is stored in `picked.idea` and replays exactly. It shows in the params schema (`idea`).
2. **Evaluation fix.** `docs/RATING_RUBRIC.md` defines 5/6/7/8/9 and the procedure. There are 20 frozen anchors (a01–a20, 5 → 9, each with a written rationale). Blind pairwise sheets compare against P6 on the same seeds, with the key opened after judging.
3. **Gates** (`src/engine/aesthetic/gates.ts`). These are measured on a 40-cell raster of the scene graph in about 1 ms. Hard failures redraw within a deterministic, counted budget. Soft failures are penalties in the selector rank (taste − penalty). See the table below.
4. **Art-director loop.** I acted as the director: dev and rating rounds above, with pairwise judging and per-idea and per-composition win rates driving weights and parameter ranges. Ranges narrowed this way: ma image area 0.09–0.15, window radius 0.22–0.30·S with a 0.32–0.46 wash, and anomaly glyph weight. No local VLM was practical.
5. **CJK pass** (verified on our fonts in Chrome, `lotgo-research/ourtools/cjk_probe.mjs`):
   - Noto Sans SC 900 face is 0.91 em with an ink side gap of 0.074 em, about the same as Inter 800's 0.075.
   - SC 400 has a gap of 0.109 em.
   - The ink centre sits 0.365 em above the baseline, which matches our box model.
   - zh tracking is never negative unless set explicitly. Optical tracking is −0.01 em at ≥9× body and +0.02 em at small sizes (SPEC §15.2/15.4).
   - Han↔Latin/digit boundaries get a U+2005 quarter space (§15.6).
   - There are no one-character last lines: 3 characters minimum for display text, 2 elsewhere (§15.7).
   - Canon and root-2 eyes were added as extra snap anchors, not score terms.
   - Smiley Sans and LXGW WenKai measured identically to the fallback in headless Chrome for 国, so I could not verify them.
6. **Selector retrain.** New features:
   - composition one-hots (`c_<new comp>`)
   - idea one-hots (`i_<idea>`)
   - Itten contrast one-hots (`k_<contrast>`)
   - gate features, including `gHueFam`
   - Ngo balance, equilibrium, symmetry and density

   Results on 1,210 rated posters (GBR):

   | | before (P6 features) | after |
   |---|---|---|
   | LOSO Spearman | 0.718 | **0.748** |
   | held-out P6 Spearman | 0.468 | **0.552** |

   The export format of `rate.html` is unchanged. `scripts/taste/ratings-to-csv.mjs` recomputes missing new feature columns from the stored scene, so future ratings from 白 retrain the model directly. P7 labels are in `lotgo-research/classify/labels_O7.txt` (half-points, not yet in the training set).
7. **Perf and determinism.** Quality and gate retries now count attempts, using a shared selector budget of 12 extra attempts, instead of wall-clock time. Replays pass `forceAttempt`, so they are exact on any machine. The flaky P6 test is fixed. Gate rasterising of large brush paths uses a scanline pass. Browser generation on the final set: mean 49 ms, p95 113 ms, max 127 ms (it had been 510 ms with brush masks).

## Gates

Calibrated on the 1,210 posters rated in phases 3–6:

| rule | type | source |
|---|---|---|
| ≤ 3 flat fills (≥1% area, ΔE-merged, background counted) | **hard** | brief |
| ≤ 3 core hue families (C > 0.05, hues within 60° merge); 3 families = soft | **hard** (>3) / soft (=3) | art-kb **R1** (replaces "≤2 high-chroma", which did not separate ratings) |
| 64 px thumbnail readability (headline cap ≥ 3.5 px and ΔL ≥ 25, or a photo hero ≥ 4%) | **hard** | brief |
| contrasting accent ≤ 8% (only an accent outside the dominant hue family) | soft | art-kb **R2** |
| one tone band ≥ 55% | soft | brief |
| headline ΔL ≥ 35 (≥ 20 earlier was hard) | **soft**, waived for minimal | art-kb (e) |
| centroid offset by style: centred 0–7%, minimal 3–35%, hero 2–20%, editorial 4–17% | soft | art-kb **R5** |
| near-miss alignments: 0.05 per near-miss (0.02 for hero styles), capped at 5 | penalty | art-kb **R14** / §5 |

Soft rather than hard where the brief said hard: on our rated data, accent, tone band and centroid separated ratings by less than 0.1 point, so making them hard would only cost variety. Validation on the 1,210 rated posters:

| | hard-fail rate | rating gap, fail vs pass | corr(rating, −soft count) |
|---|---|---|---|
| old gates | 13.3% | −0.44 | −0.003 |
| new gates | **9.4%** | **−0.40** | **+0.058** |

The new gates flag fewer posters with almost the same rating gap, and the soft count now points the right way.

On the final set: 0 hard failures. Soft failures were centroid 33, tone 20, headline ΔL 8 and accent 4, for a mean penalty of 0.05.

### art-kb rules (poster-aesthetics-01 §7) adopted, and their A/B effect

- **Adopted:** R0 (style-conditional thresholds, by composition family), R1, R2, R5, R14, and (e)/(f) as soft or style-read terms. R7 was already covered: each idea carries exactly one rule-break, applied to the headline.
- **Not adopted as rules:** largest empty rectangle and bleed quota (not valid globally, per the art agent's own finding); type-level ratios (left as style parameters); R15/R12 content-derived information. The data/calendar idea is our only content-driven one, and it won only 25–50% blind, so it was not up-weighted.
- **Blind A/B, new vs old gates.** 40 seeds (20261026), shipped code vs 3e9262b, same selector. 24/40 posters came out identical. On the 16 that differed: new 4 / tie 7 / old 5 (0.47). **Neutral within noise.** I kept the rules because they are better calibrated on the rated data (fewer false failures, correct soft sign) and they improved the model.

## Remaining gaps

- **No 9s.** The best posters are 8 (scale-shock hanzi, knockout with a photo, the vertical CJK stack). A 9 needs a real conceptual twist tied to the copy. Our texts are generic event and slogan sets, which matches the art agent's R15 finding. That needs content work: real information fields and content-derived parameters.
- **The quiet ideas are weak.** emptiness/ma, inset, immersion/fullbleed and specimen/bento lose to P6 blind. Variety ≥ 10 keeps them in the mix, which is a real trade-off between quality and variety.
- **The new composers do not beat older ones yet** (0.455 pairwise). hanzi is the exception.
- **Rater limits.** Ratings are by eye and only partly blind. The shift to a half-point scale makes cross-phase absolute numbers hard to compare. Pairwise is the trustworthy number.
- **CJK fonts.** Smiley Sans and LXGW could not be measured headless (fallback rendering).
