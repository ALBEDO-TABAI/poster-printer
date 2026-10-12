# Pairwise preference mode — data model (Phase 8, design only)

Status: **design only**. rate.html keeps its 1–9 mode and its export (`kind: 'ratings', version: 1`) unchanged.
A pairwise session would export a *separate* document kind, so every existing reader keeps working.

## Why
Absolute 1–9 ratings drift within and across sessions (phase 6–7 same-session means moved by ~0.3). The phase 7–8
evaluations were already pairwise (wins + ½ ties). A pairwise mode records that judgement directly, stores
*what differed* between the two posters, and lets the taste model learn from the differences (Bradley–Terry /
logistic on feature deltas) rather than from noisy absolute scores.

## Judgements
`'A' | 'B' | 'both-ok' | 'both-bad'` (+ `skip`). `both-ok` / `both-bad` are ties with a level, so they also
carry an absolute signal: `both-bad` pairs are a gate/negative set, `both-ok` pairs are a usable-floor set.

## Export document
```jsonc
{
  "app": "poster-printer", "kind": "pairs", "version": 1, "generator": "<APP_VERSION>",
  "exported": "2026-10-12T03:00:00Z",
  "featureNames": ["…"],                 // same list as the ratings export
  "pairs": [ {
    "id": "p-<seed>-<ts>", "ts": 1760000000000,
    "judgement": "A",                   // 'A' | 'B' | 'both-ok' | 'both-bad'
    "ms": 2300,                         // time to decide (fast = confident)
    "shown": { "left": "A", "swap": false },   // blinding: which side A was drawn on
    "content": {                         // shared content: both posters show the same copy
      "kind": "random" | "custom",
      "custom": { "headline": "…", "sub": "…", "small": [], "note": [], "meta": [], "prose": "" } | null,
      "textSeed": "…"
    },
    "design": "same-content" | "same-structure" | "same-palette" | "free",   // what was held fixed
    "A": { "entry": <Rating.entry>, "features": {…}, "taste": 7.1, "route": "p7", "strategy": null, "cell": "text/mid/stable" },
    "B": { "entry": <Rating.entry>, "features": {…}, "taste": 7.3, "route": "band-scale", "strategy": "typeled", "cell": "balanced/mid/offset" },
    "diff": {                            // computed at export time from the two scenes
      "comp": ["edge", "typeled"], "idea": ["scale", "scale"], "palette": "different" | "same",
      "images": "same" | "different", "mutation": [null, "H"],
      "features": { "headSize": 0.04, "hier": -1.2, "imgShare": 0.18 }  // B − A, only |Δ| above a small threshold
    },
    "reproduced": true                   // both entries re-create their scenes exactly (entryScene)
  } ]
}
```
`entry` is exactly the `Rating.entry` object of the 1–9 export (seeds, ratio, styleId, params, modules, modes,
fonts, picked), so `entryScene(entry)` re-creates each side and old tooling can read either side as a rating row
without its `rating` field.

## Pair construction (the useful pairs are near-misses)
- `same-content`: same text seed / custom copy, different design (route, strategy, palette) — teaches strategy choice.
- `same-structure`: same entry with one semantic mutation (µH / µI / µC / µM) — teaches the mutation's direction.
- `same-palette`: same colours, different structure.
- `free`: two independent draws — the calibration set.
Sides are randomised and the route / strategy / taste are hidden while judging (only shown after, like `I` today).

## Training use
For A/B: `y = 1[A > B]`, input `f(A) − f(B)`, logistic (equivalent to a Bradley–Terry score that is linear in the
features); ties are dropped from the logistic and used as `both-ok` / `both-bad` floor and ceiling labels for the
gate calibration. The 1–9 and pairwise sets can be combined (ratings → implied pairs within a session).
