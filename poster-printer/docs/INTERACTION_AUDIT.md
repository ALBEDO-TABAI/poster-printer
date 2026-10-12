# Interaction audit — phase 14 (v14)

Harness: `npm run qa:interaction [label]` (`scripts/qa/interaction.mjs`). It uses real Playwright input on 41 chrome
controls and runs 30 behaviour checks. Measurements:
- **click → next paint**: Event Timing `duration` plus a MutationObserver/rAF timestamp
- **handler time**: Event Timing `processingEnd − processingStart`
- **long tasks**: Long Tasks API
- **slider drag**: rAF frame intervals while scrubbing 标题尺度, over 41 pointer moves

It writes `test-results/interaction-<label>.json`. Machine: the box's headless Chrome with a software rasteriser (no GPU),
so absolute frame times are pessimistic. Compare the before and after numbers, not the absolute values.

## Results

| | before (P13, dev) | after (dev) | after (prod build) |
|---|---|---|---|
| behaviour checks failing | **9 / 30** | 0 / 30 | 0 / 30 |
| controls with handler > 16 ms | 20 / 41 | 12 | **1** (theme toggle, 35 ms) |
| controls with a long task > 50 ms in their window | 14 | 6 | 5 (all engine work after the feedback frame, see below) |
| click → visual > 100 ms | 12 | 1 | 1 |
| click → visual, median | — | 23 ms | 24 ms |
| slider drag frame p50 / p95 | **133 / 200 ms** (52/52 frames dropped) | 17–33 / 83–117 ms | **17 / 83 ms** (9/129 dropped) |
| long tasks during the drag | 0 (all raster) | 0 | 0 |
| live re-render (regen) median | 25 ms | 6–10 ms | 3 ms |
| worst single handler | 540 ms (open 版式 library) | ~48 ms | 35 ms |

Most of the "handler > 16 ms" entries in dev are React dev-mode overhead (StrictMode double render, `jsxDEV`). The prod
column is what 白 runs.

## Issues found → fixed

| # | Issue (how it showed) | Root cause | Fix |
|---|---|---|---|
| 1 | Rails sat at the top while the poster was centred | `.rail { top: var(--top) }` | `placeRails()` puts both rails on the poster's centre axis. Clamped between the top bar and the dock band, snapped to 4 px, glides on `--t-4`. Measured: poster centre 501, rails 500 / 500. At 1280×640 they clamp (rails 152–528 and 240–456, inside 72–552). |
| 2 | Library / history film never closed on an outside click | No outside-click rule | A click on bare stage closes the *light* panels (library, film). The inspector and 高级调校 are work panels: they stay open and close with Esc or their rail button. |
| 3 | 检查器 + 高级调校 both "open" (one hidden behind the other; closing one revealed the other) | `togglePanel('adv')` did not clear `insp` | There is now one right-hand panel; each replaces the other. The layers button toggles like the other rail buttons. |
| 4 | Esc on a `?` explainer closed the whole panel; explainers never closed on an outside click; several could be open at once | The explainer had no dismissal logic | The explainer is now a light popover. Esc closes it first, and so does a click elsewhere or opening another explainer. |
| 5 | Focus lost after ⌘K closed | Nothing restored focus | Sheets remember their opener and hand focus back on close. |
| 6 | Toasts stacked and lingered (`已锁定…到之后的抽卡` ×N, undo ×N) | Every call appended a toast; there was no exit | Dedupe by message or group (each pin replaces the last one). At most 3 on screen. Lifetime 2–4.2 s by length, then an exit animation. `aria-live`. |
| 7 | Double-clicking 抽一张 drew twice | No guard | The second click of a double-click (`event.detail > 1`) is ignored on 抽一张 and on the remix buttons, and held-Space auto-repeat is ignored. Separate presses always count (e2e "one draw per press" stays green). |
| 8 | Slider drag at 7 fps | (a) The whole shell re-rendered on every frame (`Shell` subscribed to `scene`; `AdvNav` / `AdvMain` subscribed to `params`). (b) Every move ran the full engine pass with gates. (c) The 584 px advanced panel re-blurred its backdrop every frame (the poster tucks under its rim): 17 → 100 ms per frame on its own. | (a) Narrow string selectors, memoised `ParamCtl`, identity-stable `pins` / `honor`, a subscription outside React. (b) The live scheduler renders one preview per frame (rAF, with a 40 ms timer fallback) using `preview: true`, which skips only the measure-only passes (raster gates, geo report, balance report). The full pass with gates, palette-fit and the "本张不受影响" check runs 160 ms after input stops. Re-layout params are not previewed: they land on the settle pass. (c) While scrubbing, the side panels swap the live blur for a 94 % tint of the same material and get the blur back on release. Pointer-move dock recede is rAF-coalesced and paused while dragging. |
| 9 | Opening 版式 library: 540–630 ms block; style library 230 ms | Every composition thumbnail was rendered synchronously in `useMemo`; style previews ran in a burst of idle callbacks | One shared idle queue (`src/ui/idle.ts`) runs one job per idle slot. Thumbnails render with `preview: true`. |
| 10 | Panel / sheet opens forced a synchronous layout (~100–180 ms) | `fitFrame()` read the zone probe inside the layout effect; the first `LSeg` placement read `offsetLeft` during mount | The zone is measured after the frame that applied the classes has painted. The first segmented-thumb placement is deferred one frame (the thumb stays hidden until it is placed). |
| 11 | Panels collapsed empty when closing (content unmounted on the same frame) | `{open && <Body/>}` | `useLinger`: content stays mounted through the exit animation. On open, the glass starts in the click's own frame and the body mounts on the next one. |
| 12 | Draw / remix / ratio clicks blocked input for 50–110 ms before anything moved | Engine work ran inside the click handler | `afterPaint()`: the press, LED, busy state and the ratio thumb (`pendingRatio`) paint first, then the engine runs. |
| 13 | Closed panels still composited (opacity 0 + `filter: blur(6px)` on backdrop-filter glass); a backdrop blur on the scrim and on every `.pt` button | — | Closed panels are `visibility: hidden` after their exit and use `contain: layout paint style`. The filter blur is gone. The scrim and `.pt` buttons no longer use backdrop-filter. |

## Remaining (honest)

- The long tasks still listed (draw 70–96 ms, 换结构 71–81 ms, ratio 77–108 ms, theme 53–61 ms, style-library previews
  ~130–200 ms per style) are engine and render work. They run **after** the feedback frame, so they no longer delay the
  visual response. Removing them needs the generator in a Worker (OffscreenCanvas `measureText`); that is not done here.
- The theme toggle re-renders the whole tree (35 ms handler, prod).
- `controls.mjs` (P13 regression): 82/84. `zoneStrength` and `glyphSize` show 0/12 on the harness's fixed seeds. Both
  are chance-gated classic params: a direct probe shows them changing the poster on other seeds (checker, swiss), and they
  stay labelled 仅经典构图. Re-layout params now land on the settle pass (~160 ms), and the harness waits for it.

## Motion system (`src/styles/motion.css`)

- **Tokens**: `--t-1` 140 ms (press/hover), `--t-2` 200 ms (popovers, exits), `--t-3` 260 ms (panels, sheets), `--t-4` 320 ms (layout moves).
- **Curves**: `--e-std` cubic-bezier(.2,.8,.2,1); `--e-exit` cubic-bezier(.4,0,1,1); `--e-spring` is a critically damped `linear()` spring with ≈ 2 % overshoot. The legacy `--ease-*` and `--d-*` tokens alias to these, so existing transitions join the system.
- **Press**: scale .97.
- **Panels**: scale + fade from their rail (transform-origin is the rail at the poster axis). Exits are faster than entrances.
- **Sheets**: grow from the button that opened them.
- **Other elements**: explainers, notes and the context bar are anchored pop-fades. Toasts rise in and fade down. Pin chips grow in and shrink out (removed chips linger 220 ms). The segmented thumb slides in 280 ms with a hair of squash (it was 520 ms with a .82 squash). The poster crossfades + settles (scale 1.012 → 1, 320 ms; the 10 px blur pass was dropped).
- **Reduced motion**: `prefers-reduced-motion` or `?rm=1` keeps only short fades.

Artifacts: `test-results/ui/phaseC_*.png` (rails centred ± grid, short window, advanced, explainer, one toast + chips,
sheet mid-growth, export, library) and `test-results/ui/phaseC_demo.mp4` (~40 s).
