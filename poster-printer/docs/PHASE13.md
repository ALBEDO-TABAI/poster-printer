# Phase 13 (UI audit, phase B): two scopes, honest controls

The approved model from `docs/UI_AUDIT.md`, implemented.

## Scopes
- **Adjust this poster** is the default for every control. A tweak re-renders the same poster with its plan, composition, idea, layout salt and attempt, and with its copy, pictures and palette. Only the touched value changes.
  - Fixed: the layout drift. The selector's salt is now carried from one tweak to the next, so the 2nd slider move and history restores no longer re-plan. Measured drift after slider moves and after restores: 0/6.
  - Controls that must re-plan are tagged **会重新排版**: composition, grid type, density, columns, rows, image count, idea, one-idea-per-draw.
  - Colour controls are tagged **只换配色**: colour mode, palette source, ground, soften. They re-pick only this poster's palette.
  - 英文倾向 is tagged **只换文字**: it re-picks only the copy.
- **Pin for future draws.** Each control has a pin. Pins show as chips under 抽一张, with ✕ per chip and **全部解除**.
  - A draw starts from the style, the settings and the pins. Unpinned tweaks stay with the poster they were made on.
  - Draw-only controls (type-only, mono, clash, grain and script share, quality gate) are tagged **下次抽卡** and are pinned automatically.

## Engine (`generate.ts`, opt-in through `GenInput.honor`)
- An explicit ground, soften or palette source wins over the plan's tone strategy, mono/clash and the idea's Itten contrast.
- A pinned mono/clash share wins over Itten.
- Palette fit only *warns* for an honoured colour choice. The exception is a hard legibility failure (muddy low contrast, or WCAG < 3), which is repaired.
  - Either way it is reported in `scene.info.overrides`. The UI then shows **已为可读性调整 · 仍用我的**, which sets `fitOverride`.
- Honoured treatments now reach every composition: duotone chance, cut shape, corner radius, line weight, texture amount.
- Without `honor` the engine is byte-identical to phase 12, so CLI entries, old projects and tests are unchanged. Entries store their `honor` list, and replays pass it.
- 锁定多图 on a type-only poster now keeps it type-only. All four locks hold 4/4.

## Dock and styles
- 换文字, 换色, 换图 and 换图形 keep the layout (composition kept 6/6). Only 换结构 re-lays out.
- 换倾向 is now **换风格** and keeps pins.
- Picking a style card keeps pins and says how many unpinned tweaks it reset.

## Feedback
- **本张不受影响** when a change did not alter the poster.
- **?** explainer per control.
- Double-click reset, group reset, and **全部还原为风格**.
- ⌘Z undoes both scopes exactly, using the poster's own picks.

## Trim
- 16 essentials are visible, 27 more sit under 更多, and the 抽卡倾向 intent replaces 生成.
- Controls read only by the 12 classic compositions sit in a collapsed **仅经典构图** group. They are tagged *本张生效* when the current poster uses a classic composition.
- Deleted (never read): whitespace, symmetry, bigGroups, groupGap, accentUse, sliceCount, bandKind.
  - Old projects and CLI calls that set them are accepted and ignored.
- Hidden: baseline, bandBleed, zoneColors, glyphOpacity. They had no measurable effect even on the 12 classic compositions; they are kept in the schema for compatibility.
- Presets are rebuilt from working params only.
- Export scale and embedded fonts stay in the export sheet. Replay interval, snap, fonts-per-shake and new-fonts-each-draw moved to the sheet's 偏好 block.
- Params, pins and history (last 60) persist across reloads (`rea.session.v1`; `?fresh` skips it).

## Regression
- `node scripts/qa/controls.mjs` checks every visible control. It must:
  - change the current poster (4 fixed posters, against a no-op control), or
  - change future draws (6 fixed-seed draws, pinned against unpinned), or
  - for classic-only controls, change at least one of the 12 classic compositions.
- It also checks drift, 换X layout keeping, 换风格 pins, the four locks and reload persistence.
- The JSON report goes to `test-results/controls.json`.
- `scripts/qa/phaseB-shots.mjs` writes the key-state screenshots to `test-results/ui/phaseB_*.png`.
