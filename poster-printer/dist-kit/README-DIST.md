# Ready Poster Printer — 本地运行包 / Local package

一个在浏览器里运行的生成式海报工具：单页海报、多页文档（PDF / PNG 压缩包导出）、配色抽卡页。
多数抽卡使用「构成编排」：文字组按设计构成来排（34 种：两端对齐砖、等高侧栏、双线夹心、票据框、阶梯……），配 19 种页面原型（图带、满版、开放侧、刊头、居中框、图条、主次拼图……）。高级面板的「页面原型」「文字组构成」可以指定其中一种。
多张图片可以排进瑞士网格：构图选「模块网格」（主图卫星、悬挂线、尺度递进、图片横条、模块分区）或「满版拼图」（满版拼贴、满版行列），在图片面板挑选或上传图片即可。
底部「结构」按钮右侧的 ▾ 可以只换结构的一层：网格（R）、图位（P）、排字（T）。只想换文字排法时按 T，图片的位置完全不动；按 P 换一种页面原型，按 R 换一套网格。
配色面板里的每个颜色（底色、文字、强调、色块、色源）都可以点开自己改：拖动取色、输入色号或用吸管取色，海报实时跟着变、版式基本不动；点图钉让之后的抽卡沿用，喜欢的配色可以存进「我的配色」。
用你自己的文字时，建议在「版式」面板的版式库里锁定「构成编排」：较早的版式可能补上几个示例词，或省掉一行次要信息。发出去前请看一眼。
全部在你自己的电脑上运行，不需要联网（AI 抠图为可选项）。

A generative poster tool that runs in your browser: single posters, multi-page decks (PDF / PNG-zip export)
and a palette-drawing page. Most draws use the **Construction** composition: the copy is set as a designed text
group (34 constructions: justified brick, cap-locked side stack, rule sandwich, ticket frame, staircase…) on one of
19 page archetypes (photo band, full bleed, open side, masthead, centre frame, picture strip, mosaic…). Advanced ›
Page archetype / Text construction pins one. Several pictures can be laid out on a Swiss grid. Pick the composition **Modular grid**
(hero, flowline, scale steps, strip, modules) or **Bleed grid** (edge-to-edge mosaic or rows), then pick or upload
pictures in the Images panel. The ▾ next to **Structure** in the dock re-rolls one layer of the layout: grid (R),
placement (P) or type (T). Press T to re-set only the type; the pictures stay exactly where they are. P moves to
another page archetype, R onto another grid.
Every colour in the palette panel (ground, text, accent, block fills, source colours) can be set by hand: drag, type a hex
code or use the eyedropper. The poster follows live and basically keeps its layout; pin a colour to keep it for future draws, and
save palettes you like under My palettes.
With your own copy, lock **Construction** in the Layout library: the older layouts can fill in a few sample words or leave
out a minor line. Check the poster before you post it.
Everything runs locally on your machine; no internet needed (AI cut-out is optional).

## 1. 需要 / Requirements

- **Python 3.9 或更新** / **Python 3.9+** — macOS 13+ usually has `python3` (if not: https://www.python.org/downloads/ ,
  or run `xcode-select --install`). Windows: install from python.org and tick **“Add python.exe to PATH”**.
- 一个现代浏览器（Chrome / Edge / Safari / Firefox 最新版）/ a current browser.

## 2. 启动 / Start (one command)

| 系统 / OS | 操作 / Do this |
|---|---|
| **macOS** | 双击 `start.command`。第一次如被拦截：打开「系统设置 → 隐私与安全性」，往下找到这条提示，点「仍要打开」；或者右键 → 打开 → 打开。<br>Double-click `start.command`. If macOS blocks it the first time: System Settings → Privacy & Security, scroll down to the message and click **Open Anyway**; or right-click → Open → Open. <br>或在终端 / or in Terminal: `bash start.sh` |
| **Windows** | 先把 zip 整个解压（右键 →「全部解压缩」），再双击解压出来的 `start.bat`。如弹出「Windows 已保护你的电脑」：点「更多信息」→「仍要运行」。<br>Extract the whole zip first (right-click → **Extract All**), then double-click `start.bat` in the extracted folder. If “Windows protected your PC” appears: **More info** → **Run anyway**. |
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
- **Windows 双击 `start.bat` 后窗口一闪就没了 / the window flashes and closes** → 这是旧版启动脚本的问题，新版出错时会停下来显示原因。
  两个常见原因：没解压就在压缩包里双击（先「全部解压缩」）；没装 Python，Windows 自带的 `python` 只是应用商店的快捷方式（去 python.org 安装）。
  The old launcher closed on any error; this one stops and shows the reason. Usually: run from inside the zip (extract it first), or
  no real Python installed (Windows' own `python` is only a Microsoft Store shortcut; install from python.org).
- **macOS “cannot be opened” / 无法打开** → System Settings → Privacy & Security → **Open Anyway** (系统设置 → 隐私与安全性 →
  仍要打开), or right-click `start.command` → Open, or run `xattr -dr com.apple.quarantine .` inside this folder once.
- **页面空白 / blank page** → use the address printed in the terminal (not `file://…`), and a current browser.
- **AI 抠图提示不可用 / cut-out unavailable** → run setup-ai, then restart with the start script.

## 快捷键 · Shortcuts

空格 抽一张 · ←/→ 历史 · 1–7 画幅 · ⇧1–4 锁定 · ⌘K / Ctrl+K 命令面板 · I 检查器 · A 高级调校 · E 导出 · ? 全部快捷键。
Space draw · ←/→ history · 1–7 ratio · ⇧1–4 locks · ⌘K / Ctrl+K command palette · I inspector · A advanced · E export · ? all shortcuts.

打分页（用于训练你自己的审美选择器）：`http://localhost:5180/rate.html`，按 1–9 打分，E 导出 JSON。
Rating page (to train the taste selector on your own taste): `http://localhost:5180/rate.html` — press 1–9 to rate, E to export JSON.

## 许可证 / License

本项目的原创程序代码采用 **GNU Affero General Public License v3.0（AGPL-3.0-only）**，完整条款见 [LICENSE](LICENSE)。
第三方代码、字体、图片和配色数据保留各自的许可证与署名，详见 [licenses/](licenses/)。
微软的 Michelangelus 字体不随应用分发：从 https://www.microsoft.com/en-us/download/details.aspx?id=108856 下载安装后重启应用，字体库「经典衬线」里就会出现它。

Original program code is licensed under **GNU AGPL v3.0 only**; see [LICENSE](LICENSE).
Third-party code, fonts, images and palette data retain their respective licenses and credits in [licenses/](licenses/).
Microsoft's Michelangelus font is not bundled: install it from https://www.microsoft.com/en-us/download/details.aspx?id=108856 and restart the app, and it appears under Classic serif in the font library.
Source: https://github.com/ALBEDO-TABAI/ready-poster-printer
