# Poster Printer

在浏览器里抽取、编辑和导出海报的本地设计工具。支持多页文档、配色探索，以及供脚本和 AI 助手使用的命令行版。

A local generative poster tool with a browser editor and a companion CLI.

![Poster examples](poster-printer/showcase/contact_sheet.jpg)

## 启动网页版

需要 Node.js 22.12 或更新版本。字体、预设图片和配色数据已包含在仓库中。

```bash
git clone https://github.com/ALBEDO-TABAI/poster-printer.git
cd poster-printer/poster-printer
npm ci
npm run dev
```

打开终端显示的本地地址。海报、配色和文档编辑可在本地完成；AI 抠图和 AI 文案为可选功能。

```bash
npm test
npm run build
npm run preview
```

完整用法见 [网页版说明](poster-printer/README.md)。生成无需 Node.js 的本地运行包可执行 `npm run dist`，输出为 `poster-printer/release/poster-printer-dist.zip`，运行包需要 Python 3.9+。

## 命令行版

先完成网页版的 `npm ci`，再从仓库根目录执行：

```bash
cd poster-printer-cli/engine
npm ci
npm run build
cd ../agent-harness
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/poster-printer --help
```

命令行版需要 Python 3.10+。Windows 使用 `.venv\Scripts\python.exe` 和 `.venv\Scripts\poster-printer.exe`。
浏览器渲染需要 Chrome/Chromium，可通过 `POSTER_PRINTER_CHROME` 指定浏览器路径；也可使用 `--backend node`。
详见 [命令行说明](poster-printer-cli/agent-harness/cli_anything/poster_printer/README.md)。

## 许可证

本项目原创程序代码采用 **GNU AGPL v3.0 only（AGPL-3.0-only）**，完整条款见 [LICENSE](LICENSE)。
字体、图片、配色数据及第三方代码保留各自的许可证和署名，详见 [第三方授权说明](poster-printer/licenses/)。
