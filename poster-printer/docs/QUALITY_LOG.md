# Quality log — phase 3 aesthetic pass

Benchmark: `scripts/qa/quality-spec.json`: 108 fixed jobs (62 styles × 13 compositions × 6 ratios, fixed seeds).
Rendered with `REA_DUMP=1 node scripts/qa/showcase.mjs quality/<round> scripts/qa/quality-spec.json`, then scored with
`node scripts/qa/rescore.mjs quality/<round>` (layout score minus design-audit penalty), plus a 1–10 rating per poster
from looking at every image on 3×3 sheets (`scripts/qa/gridsheet.py`). Ratings are stored in `quality/ratings-*.txt`. The render folders are git-ignored.

| Round | Change set | Design score (avg /100) | Audit penalty | Visual rating (avg /10) |
|---|---|---|---|---|
| before | phase-2 baseline (commit 480ff97) | 90.9 | 8.0 | **5.43** |
| r1 | direction pass (scale snap, block/decor budgets, edge cohesion, busy scrims, accent share), harmony + de-mud, optical tracking, CJK compression/hanging, widows, mood pairings, saliency crops, centeredWide, freeSlots hard obstacles, drag snapping | 96.3 | 2.7 | ~6 (sheet review only) |
| r2 | subject term in audit, big-curve weighting and cap, layered subject-aware band, detail map renormalised, grain ×2.2 | 95.2 | 4.0 | ~6 (sheet review only) |
| r3 (final) | protectBox + focal clearance, layered in-front rule, micro text skips scrims, grain ×1.6 soft-light, focal detection counts type-fill/clipped display words, labels keep one step above notes | 95.4 | 3.8 | **6.22** |

Per-poster changes from before to r3: 73 improved, 34 unchanged, 1 worse (q083: the harmony gate swapped the rich red ground for a pale one, and the orange band now competes with the title).
Best 24 of r3 average 7.0/10.

Penalty parts (avg) before → r3: blocks 1.36→0, focal 0.60→0, align 2.64→2.12, quiet 0.44→0.55, decor 1.01→0,
accent 0.74→0.04, busy 0.97→0.28, harmony 0.26→0.01, subject n/a→0.76.

Notes from the visual review:
* Clear wins: single focal point (competing headlines are demoted), no ghost glyph behind a giant word, fewer stray icons, scrims under copy on busy photos, wide `centered` no longer sparse, and statue/figure faces are no longer covered by headlines.
* Still weak: checker comps with image tiles plus 3–4 flat fills (q067, q080); busy abstract textures (fluid/waves) used full-bleed (q040, q054); a few tall `centered`/`split` posters with a small image and lots of empty ground (q009, q101, q103); poor automatic cut-out masks on some flora images.

## Phase 4 — art direction v2 (2026-10-12)

Goal: make random draws as varied and premium as the LotGO reference, following `lotgo-research/GAP_ANALYSIS.md`.

**Method.** 110 fresh random draws (`lotgo-research/ourtools/p4_spec.json`, seed 20261012), the same method as the phase 3 sample:
- a random built-in style;
- a 3:4-weighted ratio;
- modes: 40% none / 40% one / 20% two.

Every draw was classified by eye with the same schema and rated for premium 1–10. Three rounds were run.

| round | change | mean | ≥8 | ≤5 |
|---|---|---|---|---|
| r1 | first v2 pass | 6.65 | 6% | 4.5% |
| r2 | typo block variant, accent anchors, more edge in type-only, script whitelist, quieter veil | 6.79 | 9% | 1.8% |
| r3/r4 | accent anchors 70%, procedural abstracts out of the random pool, more centred/Swiss type-only | **6.83** | **10%** | **0.9%** |

For comparison, phase 3 was 6.00 / 0% / 19%, and LotGO is 7.25 / 34% / 1.1%.

**Targets.**
- The ≤5 target (<5%) is met.
- The mean target (≥7) is not met: it reached 6.83.
  - About 25% of the draws are solid 6s. These are mostly sparse 16:9 / 21:9 layouts, quiet single-hue type posters, and plain photo + text-half splits.

The full three-way table is in `docs/PHASE4_STATS.md`, and the labels are in `docs/phase4_labels.txt`.

**Bug found by the new tests.** On mid-luminance single-hue fields, the ink could stay below 4.5:1. The fix falls back to the deepest shade or palest tint, then to pure black or white.

## Phase 5 — generator quality (2026-10-12)

**Goal (raised by 白).** Reach a premium mean of at least 8.0, at least 60% of posters rated 8 or more, and fewer than 5% rated 6 or less, with variety at or above LotGO. Down-weight anything that averages below 7. The UI is unchanged in this phase.

**Method.** The same as phase 4. Each round used a fresh seed. The final round was 110 draws from `p5h_spec.json` (seed 20261017).

**Rounds** (mean / ≥8 / ≤6):

| Round | Mean | ≥8 | ≤6 |
|---|---|---|---|
| r2 | 6.95 | 31% | 30% |
| r3 | 7.11 | 40% | 21% |
| r3-fresh | 7.25 | 41% | 14.5% |
| r4 | 7.32 | 45% | 11.8% |
| final | **7.40** | **51%** | **10.0%** |

**Kept.** Strong compositions, by mean score in the final round:

| Composition | Mean |
|---|---|
| ring | 7.83 |
| quote | 7.69 |
| edge | 7.38 |
| knockout | 7.38 |
| vertical | 7.35 |
| cover | 7.20 (8 when the subject stands in front) |

**Down-weighted to zero in auto draws.** Each layout averaged below 7 in r2–r3:
- inset
- ghost
- split
- checker
- partition
- cards
- centered
- bands
- index (on photo draws)

Mode boosts were remapped onto the strong compositions.

**Fixes**
- `groupArray` returned NaN x when no grid column fell inside its area. It now falls back to a single column. This also cleared the old "negative rect width" render warning: 0 errors in the last two renders.
- Rotated spine text is no longer clipped.
- Vertical CJK columns are no longer dropped by the block budget. Table rows and system text are tagged `system`.
- On a cover, the masthead is kept legible when a cut-out would hide more than 42% of it.
- The masthead name is hash-picked from 28+8 curated names, so CIRCA no longer repeats.
- Long formats keep their picture.
- zh echo posters were noisy, so they are down-weighted.
- Restore and replay are now exact. Locks used to change the art-direction plan's inputs, so restoring a history entry could re-derive a different plan, which changed the detail kit and mask shapes. This was pre-existing and hidden by the e2e length check. The plan is now stored in `picked.plan` and replayed via `forcePlan`. A test covers 60 replays.

**Still weak.**
- Long formats: 16:9 and 21:9 both average 7.0.
- Sparse hanzi edge posters on pale fields.
- Thin brush script used as a knockout.

8.0 was not reached. See `docs/PHASE5_STATS.md`.

## Phase 6 — taste selector (2026-10-12)

**Goal (raised by 白).** Premium mean ≥ 8.0 while restoring layout variety to LotGO's level (archetype effective kinds ≥ 10.2). Generator only; UI untouched.

**Strategy change.** Rule tuning had plateaued at 7.40, so each fresh draw now builds 8 candidates and keeps the best by a learned taste model (gradient-boosted trees on ~90 scene features, trained on 989 of my by-eye ratings from phases 3–6). Phase-5 rejects came back on probation (only their best candidates pass).

**Rounds** (fresh seed each; mean / ≥8 / ≤6): r1 7.32 / 45% / 10.9% · r2 7.39 / 50% / 10.0% · final **7.35 / 46% / 10.9%**, ≤5 0%.

**Variety.** Archetype effective kinds 8.4 → **10.6** (LotGO 10.2 at n=110); compositions used 14 → 22 (effective 10.0 → 16.1).

**Selector agreement with my ratings** on unseen posters: Spearman 0.63 (r1), 0.61 (r2), 0.47 (final set, within-composition 0.58), MAE ≈ 0.45.

**Honest reading.** Selection among layout variants gains about a quarter point and saturates; pushing further only works by favouring a few compositions, which destroys the variety 白 asked for. 8.0 needs better composers. Wide formats stayed at ~7.0 (aim was 7.8). Details: `docs/PHASE6_STATS.md`.

## Phase 7: idea layer + gates (2026-10-12)

**Goal.** Add an idea layer above the compositions, fix the evaluation (anchors and pairwise), add hard gates and a CJK pass, and retrain the selector. Keep variety ≥ 10.

**Result.** On the final set (seed 20261025, 110 draws), P7 won **55.9%** of blind pairs against P6 on the same seeds (38 W / 47 T / 25 L). The earlier rounds gave 60.5% and 57.7%.

I rated both versions in the same session on the half-point scale:

| | mean | ≥7.5 | ≤6 | 9s |
|---|---|---|---|---|
| P6 | 7.22 | 51% | 2 | 0 |
| P7 | **7.29** | **60%** | **0** | **0** |

Variety is 10.27 archetype effective kinds (≥ 10.1 over 480 simulated draws).

**Honest reading.** The gain is real but small, and it comes mostly from the idea → palette → gate pipeline acting on the older compositions. Of the new composers, only hanzi-as-image clearly beats P6. The quiet ideas (ma, inset, fullbleed) still lose. 9s would need content: real information fields and copy-derived parameters (art-kb R15). See `docs/PHASE7_STATS.md`.

## Phase 8
- Diagnostic: best-of-200 ≤ 8 on 4 fixed contents, top candidates = same arrangements → expression/structure ceiling, not hit rate.
- Fixed contents: lineup now carried (B usable ~35%→~55%), no invented copy; ceiling unchanged. 110 random: 52.3% vs P7, 0 nines.

## Real copy in the web app (2026-10-14)

**Question.** With the user's own copy (Text panel › 自定义文字), does the poster show every line, and nothing else?

**Setup.** Release build 1.4.0. Two uploaded pictures, copy = title + subtitle + three info lines (date, venue, price): the common case. Styles Instrument, 现代宋 and Neue Grid, ratio 3:4, 10 draws per style and picture, so 60 per row. A draw is clean when every given line is on the poster (whitespace ignored) and no other word is (weekday and month names allowed). Driven through `window.__rea`, as in `docs/README_IMAGES.md`.

| Layout | Clean | A line left out | Sample words added |
|---|---|---|---|
| automatic (as shipped) | 34 / 60 | 18 | 15 |
| 构成编排 `build`, locked | 51 / 60 | 9 (always the subtitle) | **0** |
| `fullbleed` / `giant` / `split` / `layered`, locked | 0 / 60 each | 41–60 | 50–60 |

The automatic picks went to `build` 42 times out of 60. Most of the failures were the other picks, the older composers. The Swiss `modular` / `bleedgrid` grids (phase 16) also kept the copy whenever they came up. An earlier run with a richer copy (list items and a note as well) had something wrong in 41 of 60 automatic draws.

**Cause.** `pickTexts` (`engine/gen/pick.ts`) writes the custom copy over a full sample text set. Slots the copy does not fill keep their sample text: group subs, `words`, meta beyond the given ones, notes. The construction engine reads only the real slots when the copy is custom (`build/copy.ts`: groups sliced to `customItems`, meta to `customMeta`, no `words`). The older composers (`gen/comps*.ts`, `kit.ts`, `sidebar.ts`, `decor.ts`) read the sample slots, and some leave given lines out. For example, `giant` sets only one word of the title, and `fullbleed` shows two of the three info lines.

**What it changed.** The READMEs and the package README now say this plainly and advise locking 构成编排 for real copy. The CLI is not affected: its correctness gates check every item.

**Next.** Empty the sample slots when the copy is custom and teach the older composers to skip empty slots (as `build/copy.ts` does), or keep them out of automatic draws when the copy is real. Measure again with this protocol. Earlier posters must still replay byte-identically.

## The 1:2.1 format (2026-10-15)

**Question.** A seventh ratio, 1:2.1 (1200 × 2520, close to a full phone screen), was added. Does it still give good layouts?

**Method.** Automatic draws called straight through the engine with the same input at 1:2.1 and at 9:16 (60 seeds, built-in styles in turn, preset pictures), rated by eye 1–10 per pair. Every composition was also drawn twice at 1:2.1.

| Round | 1:2.1 mean | ≥ 7 | ≤ 6 | 9:16 mean | ≥ 7 | ≤ 6 |
|---|---|---|---|---|---|---|
| as added (seeds TALL0–59) | 6.68 | 36 | 15 | 6.85 | 40 | 14 |
| with the rules below (fresh seeds TB0–59) | **7.03** | **49** | **6** | 6.87 | 45 | 10 |

**What went wrong.** The engine reads only W and H, so nothing broke, but a page that tall turns an open field into a long empty one.
- Type-only posters averaged 6.2 (title at the top, the rest empty).
- 构成编排 archetypes that float a small block on the page: plate 5.3, scattered 5.7, typeFill 5.8, centreFrame 5.8, colourMass 6.0, strip 6.4. The photo-led ones (photoBand, masthead, split, windowInset, mosaic, fullBleed, openSide) rated 7.1–7.5.
- Older compositions built on emptiness: ma, swiss, substitute, exhibit, object, inset, centered, checker rated 4.5–5.5.

**Rules** (only when H / W > 1.9, so the six older ratios and every earlier poster are unchanged):
- `generate.ts`: a type-only plan keeps the picture 60% of the time (wide formats already always keep it).
- `gen/sampler.ts`: `TALL_OFF` switches the emptiness compositions off.
- `build/compose.ts`: `TALL_ARCH` down-weights the weak archetypes.

**Still weak.** Quote with a small photo, ghost and window leave some empty field; a few type-only posters remain by design.
