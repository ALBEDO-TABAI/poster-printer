# Phase 10: the user's ratings (rate.html export, 239 posters)

## Data
- 239 ratings. Distribution: 6 ×34, 7 ×104, 8 ×100, 9 ×1. Mean 7.28.
- Ratios: 3:4 ×68, 9:16 ×51, 16:9 ×37, 4:3 ×35, 1:1 ×31, 21:9 ×17.
- Parsed with `node scripts/taste/ratings-to-csv.mjs <export> --set U1`. All features were present, so nothing had to be recomputed.

## Agreement with the old selector (trained on my by-eye labels)
The old selector's taste score agrees with the user's score at Spearman **−0.11** (MAE 0.78). In effect it ranked these posters slightly backwards.

Compared with the old selector, the user rates these higher:
- Layouts: window +1.6, fan +1.5, swiss +1.3, checker +1.1, split +1.1, inset / bands +0.8, edge / cover / echo / fullbleed +0.55.
- Ideas: reveal, immersion, anomaly, occlusion, specimen.
- Styles: neue-grid, zh-colossal, floral-script, outline-wide.

The user rates these lower:
- Layouts: hanzi −0.8, ring −0.5, quote −0.4, substitute −0.3, centered.
- Styles: zh-thin-air, zh-longcang, zh-cursive-air, instrument.

## Retraining (scripts/taste/train_user.py)
The integer scores are treated as ordinal, not as exact values:
- **Interval loss:** a score r means "r.x", so any prediction in [r, r+1) costs nothing. Finer-step ratings use r ± 0.25.
- **Pairwise loss:** a RankNet term on every pair of user ratings with different scores, plus A/B judgements once they exist.
- **By-eye labels:** they keep only a light squared loss (weight 0.15, against 3 for the user's).
- **Shipping:** the model is boosted depth-3 trees in the same format as before, so the app needs no other changes.

5-fold cross-validation over the user's ratings, repeated twice. My labels were always in training.

| model | Spearman | pair accuracy | user score of the best of 8 (random 7.29, oracle 8.02) |
|---|---|---|---|
| old (shipped) | −0.11 | 0.445 | 7.23 |
| GBR on integer scores (user ×3) | +0.01 | 0.504 | 7.23 |
| **interval + pairwise (new)** | **+0.22** | **0.609** | **7.47** |

Caveats:
- The weight 0.15 was picked from 3 values on this same CV, so the result is slightly optimistic.
- On its training data the model reaches Spearman 0.92, so it overfits. 239 ratings is a weak signal.

## What their 8+ have that their ≤6 lack
Effect sizes, d = mean difference / SD:
- **More real information:** more characters (+0.63), more small items (+0.35), more lines and rules (+0.36), more aligned columns (+0.40).
- **Edge-to-edge and denser:** smaller minimum margin (−0.39), fewer empty quadrants (−0.35), higher density and equilibrium (+0.34, +0.44).
- **Calmer type system:** fewer font weights (−0.44), a smaller headline relative to the page (−0.41), less extreme three-level hierarchy (−0.44).
- **Less Chinese-display-led:** lower Chinese share (−0.49), fewer hanzi layouts (−0.46), fewer centred ones (−0.52).
- **Liked layouts:** swiss, cover, window, occlusion and anomaly appear only among the highs.
- **Disliked layouts:** mosaic, veil and substitute lean low.
- 9:16 is rated a little lower.

Contact sheet: `docs/showcase/user_ratings_top_bottom.jpg`. It shows the 9 plus 23 random 8s, and 24 random 6s.

## Effect on random draws (48 draws, the same seeds, old vs new model)
- **How much changed:** 43 of 48 posters changed and 21 of 48 changed composition. The new model picks fewer knockout and quote posters, and more ring, anomaly, calendar and cover posters.
- **My own by-eye pairwise check:** new 6, old 23, 14 ties. My eye is the taste the old model learned and that the user disagrees with, so this mainly confirms the disagreement. It does not measure the user's preference.
- **The honest estimate is the cross-validation figure:** about +0.2 in the user's score for the selector's pick among 8 candidates.
- **How to verify:** the A/B mode in rate.html, old against new.

## rate.html
- **Finer scores:** Shift+digit (or Shift+click) gives +0.5. `]` / `[` nudge the last rating by ±0.25.
- **A/B mode:** two posters of the same ratio side by side. ← / A = left better, → / B = right better, ↓ / = = tie. Undo removes the last pair.
- **Export:** it now carries `pairs` and each rating's `step`. ratings-to-csv writes finer-step ratings to set `<set>f` and A/B judgements to `scripts/taste/pairs.csv`; train_user.py uses both.
