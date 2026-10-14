# Ready Poster Printer — 本地运行包 / Local package

一个在浏览器里运行的生成式海报工具：单页海报、多页文档（PDF / PNG 压缩包导出）、配色抽卡页。
多数抽卡使用「构成编排」：文字组按设计构成来排（34 种：两端对齐砖、等高侧栏、双线夹心、票据框、阶梯……），配 19 种页面原型（图带、满版、开放侧、刊头、居中框、图条、主次拼图……）。高级面板的「页面原型」「文字组构成」可以指定其中一种。
多张图片可以排进瑞士网格：构图选「模块网格」（主图卫星、悬挂线、尺度递进、图片横条、模块分区）或「满版拼图」（满版拼贴、满版行列），在图片面板挑选或上传图片即可。
底部「结构」按钮右侧的 ▾ 可以只换结构的一层：网格（R）、图位（P）、排字（T）。只想换文字排法时按 T，图片的位置完全不动；按 P 换一种页面原型，按 R 换一套网格。
全部在你自己的电脑上运行，不需要联网（AI 抠图为可选项）。（原名 Poster Printer。）

A generative poster tool that runs in your browser: single posters, multi-page decks (PDF / PNG-zip export)
and a palette-drawing page. Most draws use the **Construction** composition: the copy is set as a designed text
group (34 constructions: justified brick, cap-locked side stack, rule sandwich, ticket frame, staircase…) on one of
19 page archetypes (photo band, full bleed, open side, masthead, centre frame, picture strip, mosaic…). Advanced ›
Page archetype / Text construction pins one. Several pictures can be laid out on a Swiss grid. Pick the composition **Modular grid**
(hero, flowline, scale steps, strip, modules) or **Bleed grid** (edge-to-edge mosaic or rows), then pick or upload
pictures in the Images panel. The ▾ next to **Structure** in the dock re-rolls one layer of the layout: grid (R),
placement (P) or type (T). Press T to re-set only the type; the pictures stay exactly where they are. P moves to
another page archetype, R onto another grid.
Everything runs locally on your machine; no internet needed (AI cut-out is optional).
(Formerly Poster Printer.)

## 1. 需要 / Requirements

- **Python 3.9 或更新** / **Python 3.9+** — macOS 13+ usually has `python3` (if not: https://www.python.org/downloads/ ,
  or run `xcode-select --install`). Windows: install from python.org and tick **“Add python.exe to PATH”**.
- 一个现代浏览器（Chrome / Edge / Safari / Firefox 最新版）/ a current browser.

## 2. 启动 / Start (one command)

| 系统 / OS | 操作 / Do this |
|---|---|
| **macOS** | 双击 `start.command`。第一次如被拦截：右键 → 打开 → 打开。<br>Double-click `start.command`. If macOS blocks it the first time: right-click → Open → Open. <br>或在终端 / or in Terminal: `bash start.sh` |
| **Windows** | 双击 `start.bat` / double-click `start.bat` |
| **Linux** | `./start.sh` |

浏览器会自动打开 **http://localhost:5180/**（端口被占用时自动换下一个，终端会显示实际地址）。
关闭终端窗口或按 `Ctrl+C` 即停止。

Your browser opens **http://localhost:5180/** (if the port is busy the next free one is used — the terminal shows the
address). Close the terminal window or press `Ctrl+C` to stop.

- 海报 / Poster: `http://localhost:5180/`
- 多页 / Deck: `http://localhost:5180/?view=deck`
- 配色 / Palettes: `http://localhost:5180/color.html`

选项 / options: `start.sh --port 8080`, `--no-open`, `--host 0.0.0.0` (to open it from another device on your LAN).

## 3. 可选：AI 抠图 / Optional: AI background removal

图片面板里的「AI 抠图」使用开源模型（IS-Net via rembg，Apache-2.0 / MIT）。需要一次性安装（约 300 MB，含模型）：

The “AI cut-out” button in the Images panel uses an open-source model (IS-Net via rembg). One-time install (~300 MB incl. model):

- macOS / Linux: `bash setup-ai.sh`
- Windows: double-click `setup-ai.bat`

之后照常用 start 脚本启动即可，终端会显示 `AI cut-out: on`。模型在第一次抠图时下载到 `~/.u2net/`。
Then start as usual; the terminal shows `AI cut-out: on`. The model downloads to `~/.u2net/` on first use.

## 4. 数据保存在哪 / Where your data lives

收藏、自定义风格、上传的图片、组件库、配色收藏都保存在**浏览器本地**（localStorage / IndexedDB），不会上传。
换浏览器或清除网站数据会丢失——重要的设计请用「导出」保存（PNG / SVG / PDF / 风格 JSON / 组件库 JSON）。

Favourites, custom styles, uploaded images, the component library and saved palettes stay **in your browser**
(localStorage / IndexedDB) and are never uploaded. Use the export buttons to keep important work.

## 5. 包内容 / Contents

```
app/            built web app (HTML/JS/CSS, fonts, CC0 images, palette data)
server/         serve.py (static server + optional /api/cutout), cutout_server.py, requirements.txt
start.*         one-command start scripts      setup-ai.*  optional AI extras
licenses/       fonts (OFL etc.), images (CC0), palettes (MIT), models
```

## 6. 常见问题 / Troubleshooting

- **“python3: command not found” / 找不到 Python** → install Python 3.9+ (see §1).
- **macOS “cannot be opened because it is from an unidentified developer”** → right-click `start.command` → Open,
  or run `xattr -dr com.apple.quarantine .` inside this folder once.
- **页面空白 / blank page** → use the address printed in the terminal (not `file://…`), and a current browser.
- **AI 抠图提示不可用 / cut-out unavailable** → run setup-ai, then restart with the start script.

## 快捷键 · Shortcuts

空格 抽一张 · ←/→ 历史 · 1–6 画幅 · ⇧1–4 锁定 · ⌘K / Ctrl+K 命令面板 · I 检查器 · A 高级调校 · E 导出 · ? 全部快捷键。
Space draw · ←/→ history · 1–6 ratio · ⇧1–4 locks · ⌘K / Ctrl+K command palette · I inspector · A advanced · E export · ? all shortcuts.

打分页（用于训练你自己的审美选择器）：`http://localhost:5180/rate.html`，按 1–9 打分，E 导出 JSON。
Rating page (to train the taste selector on your own taste): `http://localhost:5180/rate.html` — press 1–9 to rate, E to export JSON.

## 许可证 / License

本项目的原创程序代码采用 **GNU Affero General Public License v3.0（AGPL-3.0-only）**，完整条款见 [LICENSE](LICENSE)。
第三方代码、字体、图片和配色数据保留各自的许可证与署名，详见 [licenses/](licenses/)。

Original program code is licensed under **GNU AGPL v3.0 only**; see [LICENSE](LICENSE).
Third-party code, fonts, images and palette data retain their respective licenses and credits in [licenses/](licenses/).
Source: https://github.com/ALBEDO-TABAI/poster-printer
