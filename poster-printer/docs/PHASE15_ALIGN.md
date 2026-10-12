# Phase 15: alignment with Ar't, re-verified on 白's ratings

This phase answers Ar't's `art-kb/knowledge/rea-alignment-01.md` §7 and §7.6. The claims were re-checked independently with `scripts/align/verify_u1.py`; the output is in `scripts/align/verify_u1.json`.

**Data:** U1, n = 239, one rater (白), integer 6–9.

**Methods:**
- 4000 bootstrap resamples.
- Fixed-effects OLS with dummies for composition (34 levels) and aspect ratio (6 levels). This tests whether an effect survives composition and aspect-ratio mix.

**How to read the results:**
- A raw difference with a CI that excludes 0, but an adjusted slope with a CI that includes 0, means the effect is plausible but confounded or underpowered.
- The confidence intervals below are not corrected for multiple comparisons (8 tests).

## Verdicts

Columns: **Raw diff [95% CI]** is the gap in mean score between the two groups. **Spearman ρ [CI]** is the rank correlation with the score. **Adjusted slope [CI]** is the per-unit effect after composition and aspect fixed effects.

| Ar't claim | Raw diff [95% CI] | Spearman ρ [CI] | Adjusted slope [CI] | Verdict |
|---|---|---|---|---|
| Text: ≥140 chars vs <80 (7.44 vs 7.10, n 126 / 30) | +0.34 [0.04, 0.63] | +0.21 [0.10, 0.34] | +0.0014/char [0.0004, 0.0026] | **Verified.** Survives adjustment and is the strongest signal. Ar't's ρ is 0.245; ours is 0.21 after tie handling |
| Margin: <2u vs ≥6u (7.54 vs 7.07, n 39 / 14) | +0.47 [0.10, 0.84] | −0.155 [−0.24, 0.01] | −0.010/u [−0.029, 0.006] | **Direction holds, partly confounded** by composition and aspect ratio (the slope shrinks 40%). Moderate change only |
| ≥4 weights vs 3 (7.10 vs 7.40) | −0.30 [−0.51, −0.09] | −0.07 [−0.18, 0.09] | −0.10/weight [−0.22, 0.02] | **Weak.** Raw difference is real; adjusted CI touches 0. No new rule; the P12 weight-pair rule stays |
| Max/min size ratio ≥6 (6.83, n 12) | −0.48 [−0.95, −0.02] | −0.03 | −0.05 [−0.11, 0.02] | **Weak.** n = 12 and it does not survive adjustment. Not implemented |
| heroDL 25–35 not worse than ≥35 (7.62 vs 7.28, n 8 / 218) | +0.35 [−0.05, 0.70] | −0.12 [−0.27, −0.01] | −0.005/L [−0.012, 0.001] | **"Not worse" holds; "better" is not shown.** A higher heroDL does not raise ratings, so the 35 threshold has no support → lowered to 25 |
| Near-miss alignment harmless (≥1: 7.46 vs 0: 7.25, n 41 / 198) | +0.22 [−0.01, 0.43] | +0.16 [0.08, 0.33] | +0.035 [−0.04, 0.11] | **Verified: no harm found.** Penalty reduced |
| Accent 2–15% fine (7.6 vs 7.28, n 10) | +0.32 [0.00, 0.65] | +0.08 | +0.015/% [−0.01, 0.05] | **Consistent, n small.** Supports one 15% cap |
| More text blocks (≥13 vs ≤8: 7.37 vs 7.20) | +0.17 [−0.04, 0.39] | +0.04 | +0.02/block [−0.007, 0.049] | **Not significant.** Budget raised moderately, 8 → 10 |

### Composition means
The raw per-composition means have n = 1–19, so they were shrunk toward the grand mean with empirical Bayes:
- within-composition variance 0.465;
- between-composition variance 0.072;
- shrinkage constant k ≈ 6.5.

Shrunk means: window 7.60, cover 7.60, swiss 7.58, edge 7.48, inset 7.40, fullbleed 7.37 … ring 7.09, ma 7.07, hanzi 6.99, centered 6.91.

### 9:16 formats
9:16 averages 7.10 vs 7.34 for the other formats, a gap of −0.24 [−0.46, −0.02]. After composition fixed effects the gap is **−0.08**. The low score therefore comes mostly from which compositions get drawn on tall formats, not from the format itself. Tall posters in U1 also carried fewer characters (144 vs 172) and larger minimum margins (3.9u vs 2.3u). No 9:16-specific rule was added; the margin and composition changes act on both causes.

## Changes (engine only)

| Change | Files |
|---|---|
| **Composition prior.** Each composition's final share is multiplied by exp(2.5 · (shrunk − 7.285)), clamped to [0.5, 1.8] (`USER_SHRUNK`, `userPrior`). Swiss, window, fullbleed and inset leave probation. Swiss weight goes 0.45 → 1.0, and the `data` idea now realises swiss. Before this, no idea realised swiss, so it got 0 of 200 auto draws. Hanzi idea weight 1.5 → 1.0 | `gen/sampler.ts`, `gen/ideas.ts` |
| **One accent rule** (`color/accent.ts`, `ACCENT_CAP` = 0.15). Only an opponent accent is capped: hue more than 60° from the field, or a chromatic accent on an achromatic field. Same-family spot colours are never counted. Before: gate 8%, audit 15% (any accent), direction 15% (any accent zone) | `color/accent.ts`, `aesthetic/gates.ts`, `gen/audit.ts`, `gen/direction.ts` |
| **heroDL soft gate 35 → 25.** The soft id stays `heroDL35` so existing logs still match | `aesthetic/gates.ts` |
| **Near-miss.** Soft flag from 3 near-misses (was 2). Penalty per near-miss 0.05 / hero 0.02 → 0.02 / 0.01, pending an A/B | `aesthetic/gates.ts` |
| **Margin default 4.5% → 3%; block budget 8 → 10.** `RESTRAINT` compositions (ma, inset, exhibit, centered, quote) keep 4.5% through `padGrid`, unless the margin is honoured, and keep a budget of 8 | `params.ts`, `gen/grid.ts`, `generate.ts`, `gen/direction.ts`, `gen/audit.ts` |

**Backward compatibility:**
- History entries store full params and the picked composition, so replays of old posters are unchanged.
- `padGrid` makes no random draws.
- Users with a persisted margin of 4.5 keep it until they reset.

**Not done:**
- Ar't request 7, a controlled A/B of slogan vs real copy. Skipped because 白 said A/B is no longer important; noted for later.
- A rule for max/min size ratio ≥6, and a 3-weight cap: the evidence is too weak.

## Checks

| Check | Result |
|---|---|
| vitest | 210 / 210 (1 skipped) |
| `tsc` | clean |
| `qa:e2e` | PASSED, 156 checks |

**DOM geometric audit**, 200 draws (`scripts/qa/geo-audit.mjs`):
- Rejection rate: before 3.0%, after 2.5%.
- Composition counts, before → after: swiss 0 → 8, window 8 → 10, fullbleed 9 → 11, cover 8 → 10, hanzi 6 → 2, substitute 14 → 9, veil 10 → 8, edge 16 → 20. Centered stays near 0 (voice idea only).

**Contact sheet:** `docs/showcase/phase15_align.jpg`. It shows before (HEAD `1250cac`) and after on the same 64 showcase seeds; 21 of 64 compositions changed. The first 10 pairs on the sheet changed composition; the last 6 kept it.

**Honesty notes:**
- All of the above comes from one rater with integer scores. The CIs are wide, and with 8 tests at least one false positive is plausible.
- The prior is deliberately mild (×0.5–1.8) so that it does not lock in noise.
