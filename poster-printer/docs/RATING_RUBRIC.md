# Rating rubric (phase 7)

All ratings in this project are **by eye** (one rater: the agent working on the generator), on a 1–9 scale, with
half-points allowed from phase 7 on. They are a consistent internal yardstick, not a user study. 白's own ratings from
`/rate.html` (exported and turned into `scripts/taste/train.csv` rows by `scripts/taste/ratings-to-csv.mjs`) take
precedence over these whenever they exist.

## What the numbers mean

| score | definition | typical tells |
|---|---|---|
| **5** | Competent parts, no poster. Something is visibly off: type fighting the picture, a muddy or noisy palette, illegible small copy, an empty or crowded region nobody chose. | You notice the defect before the message. |
| **6** | Clean, but a template. No defect, yet nothing decided: even sizes, a palette that is merely inoffensive, the picture and the type sit next to each other instead of working together. | Looks like a default theme. |
| **7** | Solid. Clear hierarchy (one focal element, everything else clearly secondary), a harmonious palette, generous and intentional space, one strong move (scale, crop, colour). Would pass as a good commercial template. | Nothing to fix, little to remember. |
| **8** | Designer-grade. One clear idea that organises the sheet (scale shock, substitution, crop, data as form…), confident contrast of scale, a restrained palette with one accent, refined type (tracking, rag, CJK spacing correct), picture and type interlock. Only small nitpicks remain. | You would believe a studio made it. |
| **9** | Portfolio piece. The idea is witty or memorable — content and form connect (the cup photo replaces the character 盏 in 一盏茶) — every element earns its place, no defect at 100 % zoom, and the 64 px thumbnail reads instantly. Would be accepted into a design annual. Rare by design. | You want to print it. |

Half points (x.5) are used when a poster clearly beats the anchors of its band but does not reach the next band.
Scores below 5 are possible (broken output) but have not occurred since phase 3.

## Procedure

1. Look at the thumbnail first (about 160 px tall on a contact sheet): does it read, is there one focal point?
2. Then at full size: type details, collisions, crop of the picture, edge tension, colour count.
3. Compare with the frozen anchors of the band you are considering (below); move half a point up or down.
4. Defects cap the score: any collision or illegible copy caps at 6; a clumsy crop of a face or subject caps at 7.

## Pairwise comparison (phase 7)

For each seed of an evaluation set, the phase-7 poster and the phase-6 poster (same seed, same style, ratio and modes,
rendered by the phase-6 code in a git worktree at commit cde87d6) are shown side by side, left/right randomised with a
fixed seed (`lotgo-research/ourtools/pairs.py`). The verdict (L / R / tie) is written for every pair before the key is
opened. Question asked: *which one would you rather print?* Win rate = (wins + ½ ties) / pairs.

Blinding is partial: the rater wrote the new compositions and can recognise some of them (ma, substitute, hanzi,
anomaly, calendar, window). Pairs where both sides use an older composition are reported separately as a check.

## Frozen anchors (`docs/anchors/`)

Frozen on 2026-10-12 before the phase-7 evaluation set was drawn. 5–8 come from earlier rated sets (P3, P6); the
8.5 and 9 anchors come from phase-7 development rounds (seeds P7DEV1 / P7DEV2 — not the evaluation seed), because no
earlier poster had been rated 9.

| file | score | source | why |
|---|---|---|---|
| a01_5.jpg | 5 | P3 o003 | Painting cut into a blob mask; small copy floats with no relation to the image; the mask edge is the loudest thing. |
| a02_5.jpg | 5 | P3 o035 | Procedural blob texture overpowers a tiny title; no hierarchy, the noise is the content. |
| a03_5.jpg | 5 | P3 o045 | Woodblock print cut and stacked with a tile of type; competing frames, cramped copy. |
| a04_5.jpg | 5 | P3 o053 | Wide sheet with a small textured word in the middle; the format is wasted, type texture muddy. |
| a05_6.jpg | 6 | P6 p034 | Dark field, big CJK title jammed at the foot with the picture strip; clean but heavy and unbalanced. |
| a06_6.jpg | 6 | P6 p054 | Grey photo and grey type: low contrast, no accent, nothing decided. |
| a07_6.jpg | 6 | P6 p062 | Peach photo with a title on a scrim: tidy but generic; the scrim reads as a sticker. |
| a08_6.jpg | 6 | P6 p077 | Escalator photo with a white title: correct but flat; title size timid for the format. |
| a09_7.jpg | 7 | P6 p001 | Quote on a checker field: clear hierarchy, pleasant palette, but the checker is decoration not idea. |
| a10_7.jpg | 7 | P6 p002 | Vertical CJK title on ochre: strong, but the right half is under-used. |
| a11_7.jpg | 7 | P6 p010 | Giant S crop with a flower photo: one strong move, copy placement a bit arbitrary. |
| a12_7.jpg | 7 | P6 p012 | ARC on green: bold and clean, the picture-less half reads as a template. |
| a13_8.jpg | 8 | P6 p006 | CONCRETE BLOOM: type and photo interlock, confident scale, one accent. |
| a14_8.jpg | 8 | P6 p009 | 城市漫游 vertical on pale blue with a small photo: calm, exact, good CJK rhythm. |
| a15_8.jpg | 8 | P6 p022 | ROOM TONE on teal with a photo band: poster-like scale contrast, tight palette. |
| a16_8.jpg | 8 | P6 p031 | 纸上建筑 dark with a framed photo: structured, refined small type. |
| a17_8_5.jpg | 8.5 | P7DEV1 p035 | Hanzi as image: 像 at 0.9× the short side cropped by the edge, vertical title column, a seal accent. One idea, carried through. |
| a18_8_5.jpg | 8.5 | P7DEV2 p026 | Substitution: the O of ECHOES is a city photo disc on a near-black field; legible, witty, quiet copy. |
| a19_8_5.jpg | 8.5 | P7DEV1 p045 | 尘 cropped by the foot, light on dark (light–dark contrast only); the small dot grid is the one nitpick. |
| a20_9.jpg | 9 | P7DEV1 p022 | 一[cup photo]茶: the photo of a cup replaces 盏 in 一盏茶 — content and form connect; pale field, clean copy, nothing extra. |
