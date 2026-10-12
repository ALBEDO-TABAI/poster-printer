# UI audit — controls vs. what the engine actually does (phase A)

> **Status (2026-10-12):** phase B is implemented. See `docs/PHASE13.md`. Re-check with `node scripts/qa/controls.mjs`.

Date: 2026-10-12 · Repo at `4537351` (phase 12 engine: light selector, gates, palette fit, zoned layout, plan v2 + ideas).
Trigger: 白's screenshot of 高级调校 → 色彩 (presets 柔和/标准/高反差/实验, 对比/饱和/明暗, 配色性格, 颜色来自, 底色明暗, 柔和):
“adjustments are not real-time and don't seem to affect 抽一张”.

**Verdict: the complaint is correct, and it is mostly not a UI wiring bug.** Every control *is* wired to the store and re-renders
within ~30–60 ms. But (1) about half the parameters no longer influence the phase 4–12 engine at all, (2) the ones that do
**re-roll the current poster** instead of adjusting it, and (3) the dock's 换X buttons also re-roll the whole layout.

## Method

Throwaway Playwright harness (`scripts/qa/.param-audit.mjs`, `.mod-audit.mjs`, `.dock-audit.mjs`, `.drift.mjs`; not committed, raw JSON in
`test-results/audit/`), run on the dev build with the full image (142) and palette (1340) libraries loaded. For each of the 101 params, two
non-default values (range: max/min; seg: two other options; bool: toggled):

* **L — live, UI path:** 3 base posters (fresh draws). Restore → one no-op re-render (control) → set the value through the store exactly as
  the slider does (`setParam` → `regen(false)`) → SVG diff against the control. `n/3` = posters that changed.
* **P — live, pinned:** the same poster re-created from its history entry with every pick kept (`keepPicked`) and only this value changed —
  what “adjust *this* poster” should mean.
* **N — next draws:** 8 fixed seed sets, full draw pipeline (light selector on, K = 8), deterministic budget; default vs changed value.
* **legacy:** the same run with `planV2 = false, idea = off, artDirection = false` (the pre-phase-4 path), to separate *dead* from *overridden*.

Repeat runs of the baseline were bit-identical (no noise). Status: ✅ works live and on draws · ⚠️ partial / conditional / probabilistic ·
❌ no measurable effect with default settings · ➖ not a poster parameter.

## Top problems (with root causes)

| # | Problem the user sees | Root cause | Evidence |
|---|---|---|---|
| 1 | **Half of 高级调校 does nothing.** 49 of 101 params change nothing on 3 posters or 8 fresh draws; 13 more only sometimes. | (a) 7 params are never read by the engine (`whitespace`, `symmetry`, `bigGroups`, `groupGap`, `accentUse`, `sliceCount`, `bandKind`). (b) ~35 are read only by the original 12 compositions in `gen/comps.ts` / `gen/decor.ts` (band, sidebar, big glyph, ornaments, grid marks, image mask/share/duotone/torn, zone colours, card gap…); the plan-v2 compositions chosen by default (ring, hanzi, knockout, calendar, quote, bento, window, …) don't read them. | table below; legacy column shows most of them do work when plan v2 is off |
| 2 | **Colour controls in the screenshot are overridden.** 底色明暗 (`bgPref`) and 柔和 (`soft`) have 0 effect; 颜色来自 (`paletteSource`) works on half of draws; preset 柔和 only works through its `saturation: 85`. | `generate.ts`: after the palette is built, plan v2 (default on, `colorMode = normal`) replaces it (`commitTone` / `monoPalette` / `clashPalette` by `plan.tone`), then the idea's Itten contrast, then palette-fit repair. The user's choice is silently discarded; nothing tells them. | `bgPref` L0 N0 → legacy L2 N6; `soft` L0 N0 → legacy L3 N6 |
| 3 | **Moving a slider re-rolls the poster** (composition/grid/palette jump) instead of adjusting it. | `regen(false)` only pins attempt/salt/comp/idea, and the re-render result drops `picked.salt`, so from the **second** slider move on (and always after ←/→ history restore) `forceComp` is gone and the poster is re-planned. After restore + a no-op re-render, 7/8 posters changed composition (e.g. window→vertical, quote→ring). | `.drift.mjs`; audit control step changed 3/3 bases |
| 4 | **Every 换X button changes the layout.** 换文字/换色调/换图片/换图形 changed the composition 6/6 times. | `variant()` calls `regen(true, …)`; `push = true` turns `keepAttempt` off, so the selector picks a fresh composition from 8 new candidates. Only `keepTexts/Palette/Images` are kept, not the layout. | `.dock-audit.mjs` |
| 5 | **换倾向 silently wipes your tweaks.** | `variant('tendency')` switches to a random *other style* and resets all params to that style (6/6). Same for picking a style card (expected, but unannounced). | `.dock-audit.mjs` |
| 6 | **“Adjust this poster” can't change its colours or copy.** Colour, `englishBias`, `idea`, `planV2`, `imageCount`, type-only share: P = 0. | Pinned re-render keeps the poster's picked palette/texts/images, so these params only act by re-picking — which is #3's re-roll. The UI doesn't distinguish “re-render” from “re-pick”. | P column |
| 7 | **No scope, no feedback.** A changed value applies to the current poster *and* silently to all future draws; there is no indication of which values are constraining draws, no note when the engine overrode a choice, no “nothing changed” feedback. | UI design (single implicit scope); engine returns `scene.info.paletteFit` / `gates` / `plan` but the UI shows none of it. | — |
| 8 | **Params are lost on reload** and history isn't saved; only favourites and saved styles persist. | `store.ts` persists `rea.favs.v1`, styles, texts, comps, sidebar sizes — not params or history. | code |
| 9 | **Non-poster settings mixed into the 101.** 导出倍率, SVG 内嵌字体, 回放间隔, 拖动吸附 sit next to layout params (and inflate the count). `fontCount`/`shakeOnDraw` only act on 摇字体 / 抽一张. | IA maps every `PARAMS` entry into Advanced. | ➖ rows |
| 10 | **Multi-image lock (锁定多图) barely holds**: kept the image set 1/4 draws (single image, text, colour locks: 4/4). | lock passes `lockedImages`, but the new compositions choose their own image count, so the set changes. | `.dock-audit.mjs` |
| 11 | Presets lean on dead params: 版式 安静/满载 = `whitespace`+`symmetry` (dead) + density/margin; 色彩 柔和 = `soft` (overridden); 图像 拼贴 = `maskKind`/`sliceCount` (dead). | presets in `ui/shell/ia.ts` predate phases 4–12. | — |

What works well: ratio, locks for text/colour/single image, history, favourites, undo/redo, export (PNG/JPG/SVG/JSON), ⌘K, deck, palette page
(all covered by the e2e QA); and these params, which act live and on draws: grid type/density/composition/cols/rows/margin, 对比/饱和/明暗,
纹理, 标题/小字大小, 大小写, 主字呼吸, 字号模数比, 视觉字距, 版面导演, 文字块上限, 图片缩放/饱和/对比, 配色模式.

## Per-control table

### Advanced parameters (101)

L = live UI path (posters changed /3) · P = live pinned (/3) · N = next draws (/8) · legacy = with plan v2/idea/art direction off (L/3 · N/6).

| Section · card | Param | L | P | N | legacy | Status | Root cause / note |
|---|---|---|---|---|---|---|---|
| global · grid | `gridType` 网格类型 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ | 会切换构图（含义大，属结构参数） |
| global · grid | `density` 网格密度 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ | 会切换构图（含义大，属结构参数） |
| global · grid | `composition` 构图 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ | 会切换构图（含义大，属结构参数） |
| global · grid | `gridStrength` 网格强度 | 3/3 | 2/3 | 7/8 | 3/3 · 6/6 | ✅ | 会切换构图（含义大，属结构参数） |
| global · grid | `cols` 列数 (0=自动) | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · grid | `rows` 行数 (0=自动) | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · grid | `margin` 页边距 | 3/3 | 3/3 | 8/8 | 2/3 · 6/6 | ✅ |  |
| global · grid | `gutter` 栏间距 | 3/3 | 1/3 | 3/8 | 0/3 · 0/6 | ⚠️ | 仅部分网格构图 |
| global · grid | `baseline` 基线网格 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| global · grid | `whitespace` 留白倾向 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| global · grid | `symmetry` 对称倾向 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| global · display | `gridOpacity` 网格透明度 | 0/3 | 0/3 | 0/8 | 1/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| global · display | `zoneStrength` 分区强度 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| global · display | `cornerRadius` 卡片圆角 | 1/3 | 1/3 | 1/8 | 1/3 · 0/6 | ⚠️ | 仅卡片类构图 |
| global · display | `cardGap` 卡片间距 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| global · tune | `tuneOn` 画面调色 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 只有 对比/饱和/明暗 ≠100 时才有区别 |
| global · tune | `contrast` 对比度 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · tune | `saturation` 饱和度 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · tune | `brightness` 明暗 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · tune | `texture` 纹理 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| global · tune | `textureAmount` 纹理强度 | 0/3 | 0/3 | 0/8 | 3/3 · 6/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读；只有画面有纹理时生效；默认纹理由 plan 的 grain 概率决定（多数为无） |
| title · groups | `bigGroups` 大标题组数量 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| title · groups | `smallGroups` 小标题组数量 | 0/3 | 0/3 | 0/8 | 2/3 · 4/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| title · groups | `smallRel` 小标题相对大小 | 3/3 | 3/3 | 8/8 | 3/3 · 5/6 | ✅ |  |
| title · groups | `titleScale` 标题整体大小 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| title · groups | `smallScale` 小字整体大小 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| title · groups | `tickText` 刻度字 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| title · groups | `align` 对齐倾向 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| title · groups | `case` 英文大小写 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| title · groups | `proseCount` 散文诗数量 | 0/3 | 0/3 | 1/8 | 0/3 · 1/6 | ⚠️ | 只对部分海报/构图有效 |
| title · groups | `proseSize` 散文诗大小 | 0/3 | 0/3 | 1/8 | 0/3 · 1/6 | ⚠️ | 只对部分海报/构图有效 |
| title · groups | `metaCount` 页眉小字数量 | 2/3 | 1/3 | 4/8 | 2/3 · 6/6 | ✅ |  |
| title · rhythm | `maxLineWidth` 最大行宽 | 2/3 | 1/3 | 3/8 | 1/3 · 3/6 | ⚠️ | 只对部分海报/构图有效 |
| title · rhythm | `mainBreath` 主字周围呼吸 | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| title · rhythm | `subBreath` 副字系统呼吸 | 3/3 | 2/3 | 6/8 | 1/3 · 3/6 | ✅ |  |
| title · rhythm | `ruleWeight` 短线粗细 | 2/3 | 1/3 | 2/8 | 0/3 · 2/6 | ⚠️ | 只对部分海报/构图有效 |
| title · rhythm | `groupGap` 组间距 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| title · fonts | `fontCount` 参与字体数 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | store：只在「摇字体」时使用 |
| title · fonts | `englishBias` 英文倾向 | 3/3 | 0/3 | 8/8 | 3/3 · 6/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| title · fonts | `shakeOnDraw` 抽卡时换字体 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | store：只在 抽一张 时换字体（测试未覆盖，逻辑正常） |
| band · band | `bandHeight` 通栏高度 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| band · band | `bandPos` 通栏位置 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| band · band | `bandKind` 通栏内容 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| band · band | `bandBleed` 通栏出血 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| band · sidebar | `sidebarTpl` 边栏模板 | 0/3 | 0/3 | 0/8 | 1/3 · 3/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| band · sidebar | `sidebarSide` 边栏位置 | 0/3 | 0/3 | 0/8 | 1/3 · 1/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| band · sidebar | `sidebarWidth` 边栏宽度 | 0/3 | 0/3 | 0/8 | 1/3 · 1/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| band · sidebar | `sidebarFont` 边栏字号 | 0/3 | 0/3 | 0/8 | 1/3 · 1/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| band · sidebar | `sidebarRule` 边栏分隔线 | 0/3 | 0/3 | 0/8 | 1/3 · 1/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| color · color | `colorMode` 配色模式 | 3/3 | 0/3 | 8/8 | 3/3 · 6/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| color · color | `paletteSource` 色源 | 3/3 | 0/3 | 4/8 | 3/3 · 6/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| color · color | `bgPref` 底色倾向 | 0/3 | 0/3 | 0/8 | 2/3 · 6/6 | ❌ | plan v2 的 tone（commitTone）覆盖底色倾向；idea 的色彩对比再覆盖 |
| color · color | `soft` 柔和 | 0/3 | 0/3 | 0/8 | 3/3 · 6/6 | ❌ | plan v2 配色策略（mono/clash/tone）覆盖 soft 的结果 |
| color · color | `minContrast` 最低对比度 | 0/3 | 0/3 | 1/8 | 1/3 · 0/6 | ⚠️ | 只在 legacy ctx 文字配色时用；新构图的对比由 gates 保证 |
| color · color | `zoneColors` 分区色数量 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| color · color | `accentUse` 强调色使用 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| image · image | `imageCount` 图片数量 | 3/3 | 0/3 | 7/8 | 3/3 · 6/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| image · image | `imageShare` 图片占比 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| image · image | `maskKind` 切割/蒙版 | 0/3 | 0/3 | 0/8 | 0/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| image · image | `sliceCount` 切片数 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 引擎从未读取（死参数） |
| image · image | `imageZoom` 图片缩放 | 3/3 | 2/3 | 7/8 | 3/3 · 6/6 | ✅ |  |
| image · treat | `legibility` 可读性处理 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| image · treat | `imgSat` 图片饱和 | 3/3 | 2/3 | 4/8 | 2/3 · 6/6 | ✅ |  |
| image · treat | `imgContrast` 图片对比 | 3/3 | 2/3 | 5/8 | 3/3 · 5/6 | ✅ |  |
| image · treat | `duotone` 双色调概率 | 0/3 | 0/3 | 0/8 | 2/3 · 6/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| image · treat | `tornRough` 撕边粗糙度 | 0/3 | 0/3 | 0/8 | 1/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · glyph | `bigGlyph` 装饰大字 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · glyph | `glyphKind` 大字内容 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · glyph | `glyphSize` 大字尺寸 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · glyph | `glyphOpacity` 大字透明度 | 0/3 | 0/3 | 0/8 | 1/3 · 0/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `ornaments` 图形装饰数量 | 0/3 | 0/3 | 0/8 | 1/3 · 3/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `ornamentSize` 图形尺寸 | 0/3 | 0/3 | 0/8 | 1/3 · 4/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `lineWeight` 线条粗细 | 0/3 | 0/3 | 0/8 | 0/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `nodeSize` 交点尺寸 | 0/3 | 0/3 | 0/8 | 0/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `zoneNumbers` 区域编号 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| decor · marks | `guides` 辅助线 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| decor · marks | `dashed` 虚线网格 | 0/3 | 0/3 | 0/8 | 0/3 · 2/6 | ❌ | 只在旧 12 种构图（gen/comps.ts / decor.ts）里读取；phase 4–12 的新构图与 plan v2 不读 |
| decor · marks | `curveCount` 曲线数量 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| decor · marks | `shapeCount` 几何图形数量 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| decor · marks | `noiseAmount` 杂点数量 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| more · quality | `qualityGate` 质量守门（自动重抽杂乱/重叠） | 0/3 | 0/3 | 1/8 | 0/3 · 0/6 | ⚠️ | 只影响重抽次数 |
| more · quality | `qualityMin` 最低版面分 | 0/3 | 0/3 | 3/8 | 0/3 · 3/6 | ⚠️ | 只影响重抽 |
| more · quality | `qualityTries` 最多重抽次数 | 0/3 | 0/3 | 1/8 | 0/3 · 0/6 | ⚠️ | 只影响重抽 |
| more · quality | `collisionFix` 文字避让 | 0/3 | 0/3 | 5/8 | 1/3 · 3/6 | ⚠️ | 只在出现碰撞时 |
| more · plan | `idea` 创意（先定一个主意） | 3/3 | 0/3 | 8/8 | 0/3 · 0/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| more · plan | `planV2` 一图一招（每次抽卡只用一种明确手法） | 3/3 | 0/3 | 8/8 | 0/3 · 0/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| more · plan | `typeOnlyShare` 纯排版比例 | 2/3 | 0/3 | 5/8 | 0/3 · 0/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| more · plan | `monoShare` 单色相配色比例 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| more · plan | `clashShare` 撞色比例 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| more · plan | `grainShare` 颗粒纹理比例 | 2/3 | 0/3 | 7/8 | 0/3 · 0/6 | ✅ | 实时生效但会重抽配色/文案（不是“只改这一项”） |
| more · plan | `scriptShare` 手写字纹理比例 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ❌ | 默认与 legacy 模式下都无可测效果 |
| more · direction | `artDirection` 版面导演（层级/留白/预算） | 3/3 | 3/3 | 8/8 | 0/3 · 0/6 | ✅ |  |
| more · direction | `typeRatio` 字号模数比 | 3/3 | 3/3 | 8/8 | 0/3 · 0/6 | ✅ |  |
| more · direction | `opticalTracking` 视觉字距（大紧小松） | 3/3 | 3/3 | 8/8 | 3/3 · 6/6 | ✅ |  |
| more · direction | `blockBudget` 文字块上限 | 3/3 | 2/3 | 7/8 | 0/3 · 0/6 | ✅ |  |
| more · direction | `decorBudget` 装饰上限 | 1/3 | 1/3 | 0/8 | 0/3 · 0/6 | ⚠️ | 只在装饰超额时 |
| more · direction | `busyScrim` 繁忙图像渐变遮罩 | 0/3 | 0/3 | 2/8 | 0/3 · 0/6 | ⚠️ | 只在繁忙图片上 |
| more · direction | `snapGrid` 拖动吸附网格 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | 交互设置（拖动吸附），非海报参数 |
| more · export | `exportScale` 导出倍率 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | 导出设置，非海报参数 |
| more · export | `embedFonts` SVG 内嵌字体 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | 导出设置，非海报参数 |
| more · replay | `replaySpeed` 回放间隔 | 0/3 | 0/3 | 0/8 | 0/3 · 0/6 | ➖ | 回放设置，非海报参数 |

Common to all params: (d) **persistence** — session only; kept by 抽一张, ←/→ restores each poster's own values, reset by picking a style and by
换倾向; saved only through 存为风格. (e) **feedback** — the dot marks “changed vs style”, but there is no indication that a value had no effect,
was overridden, or now constrains future draws.

### Layers & modes (图层与模式)

| Control | L (/3) | N (/8) | Status | Note |
|---|---|---|---|---|
| 图层 底色 / 文字 / 图片 off | 3 / 3 / 3 | 8 / 8 / 7 | ✅ | |
| 图层 分区 / 线条 / 纹理 / 装饰 off | 2 / 1 / 2 / 1 | 6 / 4 / 1 / 6 | ⚠️ | only on posters that draw them |
| 图层 曲线 / 几何 / 边栏 / 杂点 / 通栏 off | 0 / 0 / 0 / 1 / 1 | 0 / 0 / 0 / 0 / 0 | ❌ | legacy-composition layers; new compositions don't draw them |
| 模式 实验 / 随机 / 分层 | 3 | 8 / 8 / 7 | ✅ | |
| 模式 NICE / 和田 | 3 | 4 | ⚠️ | colour source, then re-toned by plan v2 (#2) |
| 模式 卡片 / 撞色 / 笔刷图 / 笔刷蒙版 / 横带蒙版 | 0–1 | 0–1 | ❌ | legacy-composition post-passes |

### Top bar, rails, dock, sheets

| Control | Live | Next draws | Status | Note |
|---|---|---|---|---|
| 海报 / 多页 / 配色 | — | — | ✅ | view switch |
| 画幅 3:4 … 21:9 (+ keys 1–6) | re-plans (new composition) | ✅ | ⚠️ | expected re-layout, but not announced |
| 锁定 文字 / 配色 / 单图 | no re-render (next draw only) | 4/4 kept | ✅ | tiny icon only; no visible “locked” state near 抽一张 |
| 锁定 多图 | — | 1/4 kept | ❌ | #10 |
| 撤销 / 重做 | ✅ | — | ✅ | snapshot undo includes params |
| ⌘K | ✅ | — | ✅ | jumps to params — including the dead ones |
| 中/EN, 明暗 | ✅ | — | ✅ | |
| 导出 sheet | ✅ | — | ✅ | |
| Left rail libraries (风格, 版式, 图片, 文字, 配色, 字体, 组件, 收藏, 设置) | ✅ | ✅ | ✅ | picking a style resets all params (unannounced) |
| Right rail 检查器 / 高级 / 图层 / 历史 / 快捷键 | ✅ | — | ✅ | inspector “感觉” sliders inherit #1/#3 |
| Dock ← n/N → | ✅ | — | ⚠️ | a slider move after ← re-plans the restored poster (#3) |
| Dock 文字 / 配色 / 图片 / 图形 / 结构 | changes 6/6 | — | ⚠️ | all re-pick the composition (#4); 图形 = decor salt, mostly legacy decor |
| Dock 倾向 | changes 6/6 | — | ⚠️ | switches style and wipes params (#5); label doesn't say so |
| 抽一张 | — | keeps params ✅ | ⚠️ | params silently constrain draws; plan v2/ideas override many (#1, #2) |
| ♥ / history strip | ✅ | — | ✅ | |
| Selection toolbar + inspector edits | ✅ | — | ✅ | per-node edits are stable |

---

## Proposed interaction model

**Principle: two explicit scopes, and the engine must never silently ignore the user.**

1. **调这一张 (Adjust this poster)** — default for every slider. Re-render the *same* poster: same plan, composition, salt, copy, image,
   palette; only the touched value changes. Instant (≤ 50 ms, no selector). Structural values that can't be applied without re-planning
   (构图, 网格类型, 画幅, 纯排版) say so: “会重新排版 · Re-layouts this poster”.
2. **锁定到之后的抽卡 (Pin for future draws)** — a pin icon on each control. Pinned values constrain 抽一张; **unpinned values are
   randomised by the engine as today** (plan v2, ideas, light selector stay in charge of everything you didn't pin). Pinning a value the
   engine would override sets the matching override flag (e.g. pin 底色明暗 = 深 → plan tone forced to dark).

### Flow

* Draw → like it → drag 标题大小: the poster grows its title, nothing else moves. Toast-free; the value pill shows “本张 · 120%”.
* Want every draw to be dark? Hover 底色明暗 → click 📌 → chip `📌 深底` appears next to 抽一张. Next draws are all dark;
  the rest still varies.
* 换文字 / 换色 / 换图: keep the layout (same composition + salt), re-pick only that dimension. 换结构 is the one that re-lays out.
  换倾向 renamed **换风格**, shows “风格：X · 你的 2 项锁定保留”; pinned values survive a style change.
* Engine override: when palette fit / gates change a pinned or adjusted value, a quiet note on the control:
  “已为可读性调整 · Adjusted for legibility — [仍用我的]” (one click forces the user's value, sets `fitOverride`).
* Nothing changed? The control flashes “本张不受影响 · No effect on this layout” and shows which compositions it applies to.
* Undo covers both scopes; **重置** per control (double-click), per group, and “全部还原为风格”.

### Wireframe notes

```
┌ top bar ─────────────────────────────────────────────────────────────┐
│ Poster Printer | 海报 多页 配色 │ 3:4 9:16 … │ 🔒文字 🔒配色 🔒图 │ ↶ ↷ │
└──────────────────────────────────────────────────────────────────────┘
                     ┌──────── poster ────────┐   ┌ 调整 ───────────────┐
                     │                         │   │ [本张] [之后的抽卡]  │ ← scope tabs (filter)
                     │                         │   │ 版式  ▸ 留白   ●──── 📌│
                     │                         │   │       ▸ 边距   ──●── 📌│
                     │                         │   │ 色彩  ▸ 底色 浅 深 彩 📌│
                     │                         │   │        ⓘ 已为可读性调整 [仍用我的]
                     └─────────────────────────┘   │ ▸ 更多（12）          │
   ┌ dock ───────────────────────────────────────────────────────────────┐
   │ ‹ 12/40 › │ 换文字 换色 换图 │ ● 抽一张 │ 换结构 换风格 │ ♥ │
   │            📌 深底  📌 标题 120%  📌 瑞士网格   ✕ 全部解除            │ ← pinned chips
   └─────────────────────────────────────────────────────────────────────┘
```

* Each control: label · value · `?` (what it does, which compositions use it, a small before/after) · 📌 · modified dot · reset on double-click.
* Pinned chips sit under 抽一张; click a chip to jump to its control, ✕ to unpin. The draw button tooltip says “抽一张 · 3 项锁定”.

### Reduce 101 → tiered essentials

* **Tier 1 (always visible, ~16), all verified ✅:** 构图, 网格类型, 网格密度, 页边距 · 标题大小, 小字大小, 大小写, 字号模数比 ·
  配色模式, 颜色来自, 底色明暗*, 对比/饱和/明暗 · 图片数量, 图片缩放 · 纹理. (*after it's made to work through the plan tone.)
* **Tier 2 (更多, ~25):** remaining ✅/⚠️ params; probabilistic plan weights grouped as “抽卡倾向” sliders (纯排版 / 单色 / 撞色 / 颗粒).
* **Tier 3 (经典构图 only):** legacy-composition params (通栏, 边栏, 装饰大字, 图形/网格标记, 切片/蒙版/撕边…) shown only when the current
  poster uses a classic composition, or behind “经典构图参数”; or wired into the new compositions in phase B.
* **Remove or fix:** the 7 never-read params; presets rebuilt from working params only.
* **Move out of Advanced:** 导出倍率 / 内嵌字体 → export sheet; 回放间隔 → history; 拖动吸附 → settings; 抽卡时换字体 / 参与字体数 → 字体 library.

### Implementation sketch (phase B)

* Store: `adjust(k, v)` = re-render with `keepPicked` (+ new `keepPlan`), carry `salt` through re-renders (fixes #3);
  `variant()` passes `keepAttempt` for everything except 换结构 (fixes #4); `pins: Record<string, value>` merged into draw params, and
  unpinned params use style defaults on draw (instead of silently persisting).
* Engine contract (needs the generator owner): honour explicit user overrides — `inp.userPins` → plan tone/palette strategy respect
  `bgPref`/`soft`/`paletteSource`; report `scene.info.overrides[]` when palette fit / gates change a pinned value, plus a `fitOverride` escape hatch.
* QA: the audit harness becomes a regression test — every Tier 1/2 control must change the pinned poster (P > 0) or declare
  “re-layouts”, and every pinned value must change draws (N > 0).
