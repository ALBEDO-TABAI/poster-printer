# Phase 4 — three-way comparison (LotGO vs ours phase 3 vs ours phase 4)

Manual sets: LotGO n=360, ours P3 n=110, ours P4 n=110 (110 fresh random draws, same method).

## Variety per axis (distinct values / effective kinds = 2^entropy)

| axis | LotGO | ours P3 | ours P4 |
|---|---|---|---|
| Archetype | 14 / 10.6 | 12 / 9.1 | 12 / 7.1 |
| Image treatment | 13 / 9.2 | 11 / 7.3 | 14 / 9.4 |
| Mask shapes | 8 / 3.0 | 9 / 3.2 | 10 / 2.5 |
| Headline scale | 4 / 3.3 | 4 / 3.4 | 4 / 3.4 |
| Type flags | 10 / 5.8 | 8 / 4.4 | 7 / 4.1 |
| Texture | 11 / 2.6 | 4 / 1.3 | 2 / 1.4 |
| Decoration | 8 / 4.3 | 5 / 2.1 | 9 / 5.7 |
| Style family | 10 / 6.3 | 8 / 6.6 | 10 / 8.5 |
| Tone | 3 / 2.9 | 3 / 3.0 | 3 / 2.9 |
| Contrast | 3 / 2.8 | 3 / 2.1 | 3 / 2.3 |
| Colorfulness | 3 / 2.9 | 3 / 2.8 | 3 / 2.8 |
| Palette n | 4 / 2.9 | 4 / 2.9 | 4 / 2.6 |

## Key shares

| metric | LotGO | ours P3 | ours P4 |
|---|---|---|---|
| arch × image combos (distinct) | 89 | 38 | 42 |
| combo entropy (eff. kinds) | 41.7 | 23.2 | 23.8 |
| no-image share | 31% | 7% | 34% |
| flat (no grain/texture) share | 74% | 0% | 90% |
| grain share | 1% | 97% | 10% |
| clash palettes | 6% | 4% | 4% |
| palette n=1 (single hue) | 38% | 36% | 15% |
| headline XL | 42% | 45% | 33% |
| contrast hi / mid / lo | 26% / 52% / 22% | 15% / 75% / 10% | 18% / 70% / 12% |
| tone light / mid / dark | 25% / 46% / 29% | 30% / 38% / 32% | 26% / 43% / 31% |
| colorfulness hi / mid / lo | 23% / 39% / 38% | 16% / 44% / 40% | 21% / 52% / 27% |
| premium mean | 7.25 | 6.00 | 6.83 |
| premium ≥8 | 34% | 0% | 10% |
| premium ≤5 | 1.1% | 19.1% | 0.9% |

## Automatic image metrics (median, IQR; all frames)

| metric | LotGO | ours P3 | ours P4 |
|---|---|---|---|
| mean L* | 46.40 (35.00–61.10) | 49.45 (38.32–68.12) | 52.75 (38.58–65.95) |
| tonal range L* | 52.20 (32.20–67.20) | 59.75 (49.27–74.65) | 64.55 (48.90–77.75) |
| mean chroma C* | 19.90 (10.20–31.60) | 16.10 (10.85–26.18) | 22.15 (14.00–34.02) |
| colorfulness (Hasler) | 15.30 (8.00–23.50) | 15.10 (8.33–21.65) | 19.45 (12.38–27.52) |
| photo area fraction | 0.22 (0.15–0.32) | 0.36 (0.25–0.45) | 0.32 (0.23–0.41) |
| flat colours ≥3% | 3.00 (2.00–3.00) | 3.00 (3.00–4.00) | 3.00 (2.00–4.00) |

## Archetype distribution

| arch | LotGO | ours P3 | ours P4 |
|---|---|---|---|
| FB — full-bleed image + overlay type | 5% | 12% | 3% |
| SPL — split (vertical/horizontal zones) | 13% | 24% | 11% |
| MOD — modular checker / sliced grid | 11% | 7% | 6% |
| GG — giant glyph / type-as-hero | 18% | 10% | 44% |
| BAND — horizontal band(s) | 6% | 14% | 5% |
| CARD — rounded/outlined cards & panels | 8% | 5% | 7% |
| PART — translucent colour-block partition over image | 6% | 0% | 4% |
| TORN — torn-paper panel collage | 1% | 1% | 0% |
| CTR — centred typographic minimal | 11% | 5% | 5% |
| SWI — Swiss asymmetric typographic | 10% | 1% | 3% |
| FAN — curve/semicircle mask grid | 0% | 8% | 4% |
| INSET — colour field + small inset image | 7% | 12% | 8% |
| LAY — cover: subject in front of masthead (depth) | 3% | 3% | 1% |
| COL — sticker collage | 0% | 0% | 0% |

## Premium by archetype (P4)

- FB: n=3, mean 6.67
- SPL: n=12, mean 6.58
- MOD: n=7, mean 6.57
- GG: n=48, mean 7.00
- BAND: n=6, mean 6.83
- CARD: n=8, mean 6.62
- PART: n=4, mean 7.00
- CTR: n=5, mean 6.80
- SWI: n=3, mean 6.67
- FAN: n=4, mean 6.25
- INSET: n=9, mean 6.89
- LAY: n=1, mean 7.00
## Size-matched variety (LotGO resampled to n=110, 300 draws)

- LotGO distinct arch×image combos at n=110: mean 45.7; effective kinds 30.8
- ours P3 engine compositions used: 12 distinct, effective 10.8
- ours P4 engine compositions used: 19 distinct, effective 15.3