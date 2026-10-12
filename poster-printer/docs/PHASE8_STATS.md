# Phase 8 — design strategy as the unit of randomness

All ratings are by my eye (Grok Bot) on contact sheets. Blinding is partial: the pairwise sheets hide which side
is new, but I wrote the strategies and can recognise some of them. The fixed-content comparison was not blinded
(the composition labels were visible). Treat every number here as an estimate.

## 1. Diagnostic: hit rate or expression ceiling? (P7 = 7e31781, served from 5183)
Four original fictional contents (lotgo-research/p8/contents.json), 200 candidates each, 800 posters in total.

| content | best by eye | distinct concepts among the best ~10 | what went wrong with real copy |
|---|---|---|---|
| A 夜航 (short CN event) | 8 (A018 hanzi crop, A036 occlusion) | 4 (hanzi crop ×4 near-identical, occlusion, vertical, edge) | ring words, numerals and issue numbers invented |
| B lineup (6 acts, bilingual) | 7.5 | 3 | lineup dropped in about 95% (2 of 6 acts shown); title broken mid-word (低频夜L / OWFREQ, stacked Latin letters) |
| C photo exhibition | 7.5 | 3 | quote filled with filler prose; cover masthead invented (CIRCA / MARGIN) |
| D product launch | 7.5–8 | 3–4 | cover masthead invented (LOOM / QUIET); invented calendar date; launch facts tiny |

**Verdict: it is a ceiling, not a hit-rate problem.**
- The best of 200 is never above 8.
- The top candidates are re-draws of the same few arrangements: four near-identical 夜 crops, for example.
- The failures are structural. The generator has no structure that can carry a six-act lineup, and it had no notion of real copy, so it invented content. More sampling cannot fix either.

## 2. What was built
- **Scene semantics** (src/engine/p8/semantic.ts). Stored as an optional `scene.info.sem`, so it is backward compatible; legacy scenes get their semantics inferred.
  - Roles: headline / explanation / info / action / ornament / image.
  - Info groups with an internal order. Members carry `grp` and move as one unit in `polish`.
  - Align, anchor and scale relations.
  - Layers, crop specs (protect and busy regions) and fixed / coupled / free variables.
  - Declared breaks. A licensed overlap or interleave skips the occlusion reorder and the glyph-hit cost.
- **Typography** (p8/typeset.ts):
  - Phrase-aware headline breaking. In CN, closing and opening particles and even offsets are cheap breaks, and a short closed run such as a name is never split. In EN, function words never dangle. Bilingual titles break at the script boundary and mixed-script lines are penalised. No punctuation starts a line.
  - Six silhouettes: stack, block (headline-as-shape), step, cascade, wedge and big–small. The stack is fitted to the box height.
  - Optical left edge from real glyph ink: `measure.ink`, available in the browser.
- **Line breaker** (text/breaker.ts), the CLI issues:
  - Names, venues, dates and prices are unbreakable: a no-space run with ≤ 4 Han characters and ≤ 8 characters.
  - A lone separator ( · / — ) ends the previous line instead of starting a new one.
  - Short Latin segments between separators (Lin Zhiyuan, Hall B) stay whole.
- **Real copy is never padded with filler.** This only applies when custom copy or facts are given.
  - Item, note and meta counts are honoured.
  - Facts are derived from the copy: year, issue, day numeral, masthead = the title, sticker, and programme times.
  - Ring words come from the title. The footer never repeats the date or venue already shown.
  - The quote composition uses the sub-title when there is no prose.
- **Coupled design grammar** (p8/grammar.ts). Four strategies, each a chain where one choice propagates:
  - `typeled`: length → semantic lines → silhouette → picture in the negative space shaped by the subject → info density → ornament only with ≥ 45% quiet. When info does not fit, the picture yields first, then the structure switches to `programme`. Type is never shrunk instead.
  - `interleave`: cut-out subject crossing the headline, as a declared break. It falls back to `typeled` or `exhibit` when the content does not fit.
  - `programme`: rows → list size fitted to the room, with a time column; columns on overflow.
  - `exhibit`: framed picture on the canon block, caption title, info aligned to the frame.
- **Image–type co-planning.**
  - Crops use subject, protect and busy regions (detail map). The subject shape decides the frame proportion.
  - Real copy also draws a content-relevant picture: copy words, plus a CN concept map, matched against picture titles.
  - Conditional image generation was **skipped**: no image-generation tool was available (GetDynamicTools had no GenerateImage).
- **Search loop** (generate.ts plus p8/search.ts).
  - Flow: the P7 selector → 2 strategy routes retrieved from the exemplar bank by design problem → 2 candidates each → semantic mutations of the 2 best elites → MAP-Elites archive over lead × density × stability, returned as `result.archive`.
  - Mutations are encoded in the layout salt, so replays are exact: µH (headline dominance: scale + space), µI (info fragmented: columns ↔ list), µC (crop tension: zoom), µM (mood: new colour system).
  - The P7 winner is kept unless something beats it by a margin of 0.25 (+0.2 for the type-led family) after a session-variety cost.
  - With real copy, a content-coverage term costs rank: dropped items or meta, or stacked Latin letters.
  - The budget is counted, not timed. e2e: average 67 ms, maximum 134 ms (limit 250).
- **Exemplar bank** (src/data/recipes.ts). Nine recipes abstracted from our own ≥ 8 posters (anchors a13–a20, O7 018/019/025/043/046). Each records roles, relations, what variation keeps it working and what content breaks it, and is retrieved by title length, info amount, CN/EN, picture, subject shape and emphasis. Only the four strategies are forced as routes; forcing P7 layouts concentrated the archetype mix.
- **Pairwise rating data model**: docs/PAIRWISE_MODEL.md, design only. The rate.html export is unchanged.

## 3. Evaluation

### Fixed contents
Same 50 specs per content, same selector budget: P7 = first 50 of the diagnostic, P8 = lotgo-research/p8/p8e.

| content | best old → new | usable share (≥ 7, rough) old → new | distinct concepts old → new | P8 strategy wins |
|---|---|---|---|---|
| A 夜航 | 8 → 8 | ~70% → ~70% | 4 → 4 | 12/50 |
| B lineup | 7.5 → 8 (programme with all six acts) | ~35% → ~55% | 3 → 4 | 8/50 |
| C photo | 7.5 → 7.5 | ~55% → ~65% (no filler quotes, right masthead) | 3 → 4 | 13/50 |
| D launch | 8 → 7.5–8 | ~60% → ~65% | 4 → 4 | 12/50 |

The gain is in **content fit**: B now carries the lineup, and C and D no longer invent copy. The best-of-all ceiling did not move.

### 110 random draws, P8 vs P7
Seed 20261112, the same specs on both systems.
- 75 of 110 are pixel-identical or near-identical, because the P7 route still wins most random draws. These count as ties.
- On the 35 that differ: new 18, old 13, tie 4. That is a 57% win rate on the differing pairs.
- Overall rate: **52.3%** (ties = ½).
- **9s: 0** in either system. The best new posters are about 8 (p020 Tea Hours interleave, p098 Night Survey).

### Variety
Archetype effective kinds over 480 selected draws: 10.27, the same as P7. The test stays ≥ 10.

### CLI demo briefs
Rebuilt the CLI engine bundle and ran the 3 demo briefs (showcase/phase8_cli_demo.jpg).
- Names (林知远) no longer split, and no separator starts a line.
- The music night shows the full timetable in two of six candidates.
- The talk brief draws a relevant auditorium-seats picture.
- The talk candidates are still similar to each other (4 of 6 share a list layout). Variety for talk briefs remains a gap.
- The "index omits the venue" issue was not reproduced or fixed specifically.
- CLI unit and e2e tests: 49 passed.

## 4. Honest gaps
- The **ceiling did not move**: no 9s, and the best by eye is still about 8. The new strategies are clean and content-complete, but typographically conventional. They add structures, not stronger ideas.
- Only 4 strategies were piloted; extending the grammar to more is still to do. The headline-as-shape, knockout and mask variants of `interleave` are basic.
- Mixed-script headlines are still broken mid-word inside some P7 layouts (edge / knockout); only the new strategies use the semantic breaker.
- The taste model has no one-hot for the new strategies, so they are judged on structure alone. Pairwise data (docs/PAIRWISE_MODEL.md) is the way to teach it.
- The image-generation experiment was skipped because no tool was available.
- Confound: the real-copy fixes (no filler, derived facts, relevant picture) change P7 layouts too, so part of the fixed-content gain is not caused by the strategies.
