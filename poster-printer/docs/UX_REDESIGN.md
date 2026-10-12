# Poster Printer — UI/UX 重设计方案

> 规则驱动的生成式海报「抽卡」排版工具。本文档对应可交互原型 `index.html`（纯 HTML/CSS/JS，无构建步骤），并给出把它移植回 `/workspace/rea-poster`（React + zustand）的计划。
> 品牌：**Poster Printer**（原 REA Poster）。日期：2026-10-12（JST）。

目录
1. 设计目标与原则
2. 功能盘点（Feature inventory）
3. 信息架构（IA）与渐进披露
4. 交互设计
5. 视觉设计系统（含 5.8 UI 布局网格）
6. Liquid Glass 材质实现、浏览器兼容、玻璃浮于内容之上、liquid-glass 评估
7. 旧控件 → 新位置映射表（100 个参数 + 全部面板功能）
8. 原型说明（文件、URL 状态、截图）
9. 移植计划（Porting plan）

---

## 1. 设计目标与原则

白的反馈：**选项很多但不直观，界面不够美**。目标：像 Apple 一样克制、极简，同时前卫、有科技感；材质采用 “liquid glass”。

| 原则 | 落地方式 |
|---|---|
| **画布即主角** | 默认界面只有：海报画布、底部「抽一张」主控件、顶部一条细工具胶囊（比例 / 锁定 / 撤销）。所有面板默认收起，画布占 ~80% 视口。 |
| **先结果，后参数** | 用户先抽卡、再选元素、最后才进「高级调校」。参数按**意图**（版式/文字/色彩/图像/质感/细节/生成）组织，而不是按引擎内部结构。 |
| **说人话** | 每个参数都有通俗名称 + 一句「这个参数做什么」+ 示意图（schematic）。例：`marginPct「边距」` → 「页边距 — 画面四周的安全留白」。 |
| **一个强调色** | 全局只用一个「打印信号橙」`#ff5a1f`：选中、锁定、LED、修改徽标、主 CTA。其余全部为中性墨色与玻璃。 |
| **材质有物理感** | 玻璃会折射背后的海报边缘、有随鼠标移动的高光边、按下时像液体一样鼓起回弹；分段控件的滑块会像水滴一样拉伸。 |
| **不丢功能** | 旧界面 100 个参数 + 9 个面板的全部功能都有新位置（见第 7 节）。每张参数卡片上标注「原位置」，方便老用户迁移。 |

---

## 2. 功能盘点（Feature inventory）

来源：`rea-poster/src/ui/*`（TopBar、Stage、9 个 panels）与 `src/engine/params.ts`（只读查阅，未修改）。

**生成核心**
- 抽一张（空格），按结构/文字/配色/图片/图形/倾向分别重抽（remix）
- 锁定：文字、配色、主图、全部图片
- 历史（←/→）、收藏（F）、回放历史、录制并导出 WebM
- 种子输入（结构 / 全部）、种子与详情（耗时、版面分、构图）
- 画幅比例：3:4 / 9:16 / 1:1 / 4:3 / 16:9 / 21:9
- 视图：单页 / 多页（Deck，共享风格、统一网格、页码、不重复图片）/ 配色视图

**画布编辑**
- 单击选择元素；拖动移动、吸附网格（⌥ 临时关闭）；双击编辑文字（Ctrl+Enter 完成）
- Delete 隐藏元素；还原画布手动修改
- 图片取景（拖动/滚轮缩放）、AI 抠图（rembg，本地服务）、替换图片
- 组件（Parts）放入空槽、自由拖动/缩放；显示空槽；把选中文字存为组件
- 字号按模板记忆（本地）

**素材库**
- 风格库：中文风格 / 英文风格 / 我的（保存、另存、更新、导入/导出风格 JSON）
- 图片库：分类、点选限定抽取范围、使用次数角标、上传（仅本地）
- 文字库：文字组、主标题/副标题/小标题/说明/信息标签/正文、自定义文字、AI 文案（离线模板或 OpenAI 兼容接口）、保存到文字库
- 配色库：和田配色辞典 / NICE 色源、筛选（色调/明度/彩度/对比）、指定色板、配色模式、颜色角色（底板/墨色/强调/辅色）
- 字体库：字体数量、字体角色（大·主 / 大·副 / 小·主 …）、每次抽卡换字体、摇字体
- 组件库 / 装饰库：组件尺寸、装饰数量、装饰尺寸
- 构图库：同一组文字/配色/图片在 26 种构图下的预览，点击锁定构图

**参数**（100 个，原分 7 个 section：全局、标题、通栏、色调、图片、装饰、更多）
- 网格与构图、留白与边距、标题层级与字号、通栏与边栏模板、色彩滤镜、图片处理、纹理、线条装饰、生成导演（预算、冒险度）、导出与回放

**输出**
- 导出 PNG / JPG / SVG（倍率 1–4×，SVG 内嵌字体）、海报 JSON、会话 JSON、导入 JSON、多页 PDF/ZIP、WebM 回放视频

**偏好**
- 中/英、明/暗、AI 设置（接口、密钥仅存本地）

---

## 3. 信息架构（IA）与渐进披露

### 3.1 四层结构

```
L0  画布层（默认）    Canvas + Dock(抽一张/重抽/历史) + 顶部工具胶囊(比例/锁定/撤销) + 搜索⌘K + 导出
L1  情境层            选中元素 → 浮动 ctxbar + 检查器（Inspector）：只显示与当前对象相关的 5–8 个控件
L2  素材层            左侧 Rail：风格 / 图片 / 文字 / 配色 / 字体 / 组件 / 收藏（抽屉）
L3  高级层            右侧「高级调校」：按意图分 7 类，tier-1 默认可见，tier-2 收在「更多 N」里
```

### 3.2 屏幕布局

```
┌ Brand · [海报|多页|配色] ┐   ┌ 3:4 9:16 1:1 4:3 16:9 21:9 │ 🔒T 🔒色 🔒图 🔒全 │ ↶ ↷ ┐   ┌⌘K┐ ┌EN ☾┐ [导出]
│                                                                                        │
L  ┌───────────────┐                        ┌─────────┐                               R
a  │ Library drawer │       Poster canvas     │Inspector│  / Advanced sheet (584px)     a
i  │   (360px)      │       (fit, shadow)     │ (324px) │                               i
l  └───────────────┘                        └─────────┘                               l
             [‹ 13/13 ›]  [T 色 图]  ( ● 抽一张 空格 )  [结构 图形 倾向]  [♥ ⟲]
                          filmstrip（H）在 Dock 上方展开
```

- **左 Rail = 素材（拿东西进来）**，**右 Rail = 调整（改当前这张）**：检查器 I、高级 A、图层 L、胶片 H、快捷键 ?
- 打开任一面板时，画布区域以 liquid 缓动让位（CSS 变量 `--cl/--cr/--cb`），海报外缘有意滑入面板玻璃下 32px（tuck），Dock 与胶片条跟随海报中心；所有尺寸来自 5.8 的 UI 网格。
- 窄屏（≤1480px）顶部胶囊改为流式布局；≤1380px 比例按钮去掉图形、搜索收为图标；面板之间剩余宽度 < 712px 时 Dock 进入 `dock-tight`（标签与首尾胶囊收起）。

### 3.3 检查器（Inspector）——两种情境
- **海报情境**（未选元素）：风格名 + 标签（构图/耗时/版面分）、配色条（可锁定/换一套，显示 WCAG/APCA 对比度）、字体搭配卡、「感觉」4 个宏滑杆（留白 / 标题尺度 / 图片占比 / 质感强度）、图层开关、种子。底部「高级调校」「另存风格」。
- **元素情境**（选中文字/图片）：内容编辑（AI 改写、换一句）、字体卡、字号/字距/行距、颜色角色分段、位置说明；图片则为取景、替换、AI 抠图、锁定此图。底部：隐藏 / 还原 / 存为组件。

### 3.4 高级调校（Advanced）——按意图重组 100 个参数

| 意图 | 中文 | 参数数 | 预设（一键） | 内容 |
|---|---|---|---|---|
| layout | 版式 | 24 | 安静 / 平衡 / 满载 / 瑞士 | 网格形态、密度、构图手法（26 种缩略图）、列/行/栏距、边距、留白、对称、通栏、边栏 |
| type | 文字 | 22 | 克制 / 标准 / 宣言 / 编辑 | 层级、对齐、标题尺度、主次对比、文字块、节奏、视觉字距、字体数 |
| color | 色彩 | 11 | 柔和 / 标准 / 高反差 / 实验 | 色源、配色模式、对比/饱和/明度滤镜 |
| image | 图像 | 11 | 纯排版 / 图文 / 满版 / 拼贴 | 图片占比、裁切、圆角、处理、繁忙区遮罩 |
| texture | 质感 | 5 | 洁净 / 纸感 / 孔版 / 颗粒 | 纹理类型与强度 |
| details | 细节 | 15 | 极简 / 标准 / 丰富 | 线条、装饰、页眉页脚小字、角标 |
| engine | 生成 | 9 | 稳妥 / 默认 / 冒险 | 版面导演、预算、冒险度、评分阈值 |
| + | 图层与模式 / 导出与录制 | 22 / 3 | — | 图层开关、模式；导出倍率、SVG 内嵌字体、回放间隔 |

每个意图页结构固定：**标题 + 一句说明 → 一键预设（液态分段）→「这个参数做什么」预览卡（示意图 + 原位置 + 默认值）→ 分组参数（tier-1）→「更多 N」展开 tier-2**。左侧导航显示每类「已修改」数量徽标；顶部搜索框支持中文、英文与旧参数名（如 `margin`）。

---

## 4. 交互设计

### 4.1 快捷键

| 键 | 动作 | 键 | 动作 |
|---|---|---|---|
| Space | 抽一张 | ←/→ | 历史上一张/下一张 |
| ⌘K / Ctrl+K | 命令面板 | ⌘Z / ⇧⌘Z | 撤销 / 重做 |
| F | 收藏 | E | 导出面板 |
| S | 快速导出 PNG | 1–6 | 切换比例 |
| ⇧1–⇧4 | 锁定 文字/配色/主图/全部图 | I / A / L / H | 检查器 / 高级 / 图层 / 胶片条 |
| G | UI 布局网格叠加层（亦 `?grid=1`） | ⇧G | 海报瑞士网格 |
| ⇧D / ⇧L | 明暗 / 中英 | | |
| Delete | 隐藏选中元素 | Esc | 逐层关闭（sheet → 选择 → 面板） |
| ? | 快捷键表 | | |

### 4.2 命令面板（⌘K）
一个入口搜索一切：动作（抽一张、导出…）、视图、**100 个参数**（中文/英文/旧 key/说明全文匹配，回车直接跳到高级面板并高亮该参数）、62 个风格、偏好、比例、锁定。结果分组、关键字高亮橙色，底部显示「100 参数 · 62 风格 · 30 命令」。

### 4.3 拖动 / Scrub 滑杆
- 整个滑杆条都是拖动区（不需要瞄准小圆点）；数值右对齐等宽字体。
- ⇧ 拖动 = 相对微调；⌥ = 精细（×0.1）；双击 = 复位默认；聚焦后 ←/→ 步进。
- 调整网格类参数时，画布叠加橙色网格线（1.4s 后淡出）；对比/饱和/明度实时映射为画布滤镜，纹理映射为颗粒层——**参数即时可见**。

### 4.4 胶片条（Filmstrip）、收藏、撤销
- H 或 Dock 右侧按钮展开：历史 / 收藏两个标签，缩略图保持各自比例，当前项橙框；点击回到任意一张，←/→ 逐张，滚轮横向滚动；收藏项带心形角标。
- 「回放」按回放间隔自动播放历史；「录制」录制回放为 WebM。
- 撤销栈记录：抽卡、重抽、参数修改、锁定、比例、元素编辑（⌘Z / ⇧⌘Z）。

### 4.5 抽卡转场（Draw）
按下：按钮液态鼓起 + 涟漪；LED 呼吸；旧海报 printOut（轻微下沉淡出），新海报 printIn（从上方“出纸”），叠加一条橙色扫描线；新图上 feTurbulence 位移从 70 → 0 衰减（像液体沉静下来）；背景 aura 交叉淡入新海报的主色。总时长 ~640ms，减少动态时直接切换。

### 4.6 锁定
4 个锁定按钮使用各自对象图标（T / 调色板 / 图片 / 多图）+ 右下角小锁徽标；锁定时胶囊填充、图标变橙、标签液态展开显示文字。

---
## 5. 视觉设计系统

全部 token 定义在 `css/tokens.css`（CSS 自定义属性，`[data-theme='dark']` 覆盖）。

### 5.1 字体（全部 SIL OFL，来自 `/workspace/fonts`，已子集化为 woff2）
| 角色 | 字体 | 用途 |
|---|---|---|
| UI | **Inter** + Noto Sans SC（UI 子集，692 字）| 所有界面文字 |
| Display | **Inter Tight** 600 | 面板标题、Draw 按钮、wordmark「Poster」 |
| Serif accent | **Instrument Serif** Italic | wordmark「*Printer*」、意图页英文副标题（如「版式 *Layout*」） |
| Mono | **Geist Mono** | 数值、比例、计数、种子、快捷键 |

不使用 SF Pro / SF Symbols / 任何 Apple 资产。图标为 **Lucide**（ISC，`assets/LICENSE-lucide.txt`）108 个，统一 1.6 描边；logo 为原创 SVG。

### 5.2 字号阶梯
`10 / 11 / 12 / 13（正文）/ 15 / 17 / 22 / 28 / 40` px，行高 1.15（标题）/ 1.45（正文），标题字距 −0.02em，小号大写标签 +0.06em。

### 5.3 间距与圆角
- 8pt 节奏（4px 只作子基线）：`8 16 24 32 40 48 56 64`；完整规范见 5.8
- 圆角：`6 / 9 / 12 / 16 / 22 / 28 / pill`，遵循**同心圆角**：内层 = 外层 − 内边距（例：面板 28 → 卡片 16 → 控件 12 → 芯片 9）。

### 5.4 颜色
| Token | Light | Dark |
|---|---|---|
| stage（舞台背景） | `#ebebee` | `#0b0b0d` |
| ink / ink-2 / ink-3 / ink-4 | `#0b0b0e` @100/64/42/22% | `#f4f4f6` 同比例 |
| hair / fill | 墨色 8% / 4.5% | 白 8–10% / 5% |
| **accent（打印信号）** | `#ff5a1f` | `#ff6a2c` |
| ok / warn / bad | `#1fae6b` / `#e2a400` / `#e5484d` | 同 |
| glass tint | `rgb(252 252 253 / .52)` | `rgb(28 28 32)` 半透明 |

舞台背景 = 中性色 + 极淡点阵 + 由当前海报主色生成的模糊 aura + 暗角，使玻璃有可折射的内容。

### 5.5 层级（Elevation）
`shadow-1`（芯片）→ `shadow-2`（玻璃胶囊）→ `shadow-3`（面板）→ `shadow-4`（sheet / 命令面板），均为「近处小阴影 + 远处大柔影」双层；海报使用独立 `--poster-shadow`，像纸放在桌面上。

### 5.6 动效
| Token | 值 | 用途 |
|---|---|---|
| ease-out | `cubic-bezier(.22,1,.36,1)` | 淡入、颜色 |
| ease-in-out | `cubic-bezier(.65,0,.35,1)` | LED 呼吸 |
| ease-spring | `cubic-bezier(.34,1.56,.64,1)` + `linear()` 弹簧 | 按压回弹、弹出 |
| ease-liquid | `cubic-bezier(.3,.7,.2,1)` | 面板让位、标签展开 |
| 时长 | 120 / 200 / 320 / 480 / 640 ms | 微交互 → 转场 |

动效只用 `transform / opacity / filter`，避免触发布局；`prefers-reduced-motion` 或 `?rm=1` 下动画即时完成。

### 5.7 图标与 Logo
- Lucide 1.6 描边，16/17/19px 三档；激活态不换图标，只换颜色/填充。
- **Logo mark**：墨色打印机机身 + 出纸口，下方吐出一张纸（带橙色色块与两行文字线），右上角橙色 LED。Wordmark：「Poster」Inter Tight 600 +「*Printer*」Instrument Serif Italic——理性与手作的对照，也呼应海报排版里无衬线 × 衬线斜体的经典搭配。favicon：`assets/favicon.svg`。

### 5.8 UI 布局网格（UI layout grid）

海报用瑞士网格，界面本身也用同一种纪律。所有尺寸都来自 `css/grid.css` 的一组变量，JS 只读这些变量（`placeDock`、`fitFrame`、网格叠加层），不另写魔法数。

**横向（列）**

```
| M 24 | RAIL 48 | G 24 |  col × 12（gutter 24，流式） | G 24 | RAIL 48 | M 24 |
         ↑ 左 rail       ↑ field 起点 fl = 96px            field 终点 ↑    右 rail ↑
```

| Token | 值 | 说明 |
|---|---|---|
| `--u` | 8px | 基本单位；所有高度、内边距、间距都是 8 的倍数（4px 只作子基线：徽标、发丝偏移） |
| `--m` | 24px | 屏幕外边距（四边相同） |
| `--rail` | 48px | 左右工具 rail 宽度 = 一个按钮 40 + 2×4 内边距 |
| `--g` | 24px | 栏距；rail ↔ field、面板 ↔ 画布之间也用它 |
| `--fl` | `m + rail + g` = 96px | field 左右边界 |
| `--col` | `(100vw − 2·fl − 11·g) / 12` | 1440 → 82px，1280 → 68.7px |
| `--span2/4/6` | `n·col + (n−1)·g` | 1440 下 188 / 400 / 612px |

**纵向（行与基线）**

| Token | 值 | 说明 |
|---|---|---|
| `--bar` | 48px | 顶栏胶囊高度（内部按钮 40，分段控件按钮 32，均居中 → 上下各 4px） |
| `--top` | `m + bar + g` = 96px | rail、面板、画布区的顶边 |
| `--dock` | 64px | Dock 带高度（抽一张按钮 64，其它胶囊 48，中心对齐） |
| 基线 | 8px | 文字行高取 16/24/32；面板内：头/体/脚 16 内边距，分组 16/8，滑杆 32 高 + 8 间距，按钮与输入 40，标签 24，色板 48 |

**元素如何落到网格上**

- **顶栏**：品牌胶囊左缘 = M，导出按钮右缘 = 100vw − M；比例/锁定工具胶囊是内容宽度，**光学居中于 field 中轴**（它放不进整数栏，强行拉伸 6 栏会出现大段空白，所以对齐中轴而不是栏线——这是网格中唯一刻意的例外，叠加层里中轴线可验证）。
- **Rail**：`top: var(--top)`，占据 M 与 G 之间的 48px 轨道。
- **面板只占整数栏**：检查器、素材库 = 4 栏，高级调校 = 6 栏，多页侧栏 = 2 栏；上缘 = TOP，下缘 = 100vh − M，圆角 24。面板内部元素同样落在 16px 内边距 + 8pt 节奏上。
- **画布区**：`left: var(--cl)`、`right: var(--cr)`、`top: var(--top)`、`bottom: var(--cb)`，四个变量由面板开合（body class）驱动；海报在这个区域里按比例 fit，再贴向面板一侧（`justify-items: end/start`）。
- **Tuck（压边）**：`--tuck: 56px` = 一个栏距 24 + 32px 伸入面板玻璃边缘下方（正好是面板 bevel 的折射带）。所以打开面板时，海报的外缘真的位于玻璃之下，能看到被折射、被磨砂的海报边——而面板正文离边至少 16px，坐落在 ≥70% 不透明度的区域里。
- **Dock**：`bottom: M`，水平中心 = 海报中心（`--pcx`），并钳制在两侧面板之间；Dock 带高 64，海报底边落在 Dock 中线之上 8px 处（`--cb = M + DOCK/2 + 8`），因此胶囊上半部压住海报下缘 16–24px，玻璃能折射到真实内容。剩余空间 < 712px 时（多页 + 检查器、或 1280 下的高级调校）Dock 自动进入 `dock-tight`：标签与首尾胶囊收起。
- **胶片条**：中心同为 `--pcx`，`bottom = M + DOCK + 16`；宽度 ≤ 864 且不超过画布区 + 两侧 tuck。
- **Sheet**：导出宽 768（8pt 倍数），居中于 field 中轴，⌘K 顶边 = TOP + 48，行高 40。
- **Toast / ctxbar**：ctxbar 48 高（按钮 40），优先放在选区下方 12px，碰到 Dock 带时翻到上方。

**叠加层（验证用）**：按 **G**（或 URL `?grid=1`）在整个界面上画出：8px 基线（每 24px 加深）、12 栏（品红，带编号）、左右 rail 轨道（蓝）、M / BAR / TOP / DOCK / ½ / M 横线（虚线）、field 中轴，以及左下角图例 `UI GRID · M 24 · RAIL 48 · G 24 · 12 COL × 82.0 · BAR 48 · DOCK 64 · 8PT`。窗口尺寸变化时实时重画。海报自身的瑞士网格改为 **⇧G**。截图：`shots/grid-overlay-1440x900.png`（默认）、`grid-overlay-dark-*.png`（检查器 4 栏）、`grid-overlay-adv-*.png`（高级 6 栏），各有 1280 版本。

---

## 6. Liquid Glass 材质实现

### 6.1 图层配方（`.lg`，见 `css/glass.css`）
1. **背景折射（Chromium）**：`backdrop-filter: url(#lgfN)`。整条 SVG 滤镜图包含：位移 → 色散（可选）→ 磨砂模糊 → 饱和度（见 6.2）
2. **体色**：玻璃白/黑 tint + 当前海报平均色 `--amb` 叠加 → **自适应染色**；材质 `data-mat` 决定透明度：`clear`（顶栏、rail、Dock，tint .30，blur 3）/ `regular`（blur 12）/ `thick`（blur 22）；`.strong` 面板 tint .62/.64
3. **面板「边缘窗口」**：侧面板朝向画布的那条边 tint 降到 42%，48px 内渐变到满值——海报压在玻璃下的那 32px 能看清折射与磨砂，正文区仍然稳定
4. **`::after` 光学叠加层**：由 glass.js 生成的 overlay 贴图（`--lg-ov`）——0.9px 镜面高光描边（按法线 |n.y| 受光）、柔和内发光、按 n.x 的侧向暗部，外加顶部 caustic 径向光；**所有浏览器都生效**（只是普通 background-image）
5. **`::before` 高光边**：1px 渐变边框，角度 `--la` 跟随鼠标位置旋转，像光源在移动
6. 变体：`.strong`、`.thin`、`.flat`、`.ink`（反色玻璃：Draw 与导出按钮）、`.adaptive`（Dock / ctxbar 根据身后亮度切换 `.on-dark/.on-light`）

### 6.2 边缘折射 v2（SVG 位移贴图，算法移植自 liquid-glass，见 6.7）
`js/glass.js` 为每个玻璃元素按其尺寸生成两张贴图（同尺寸共用，按 key 缓存）：
- **field 贴图**（半分辨率，送入 `<feImage>` → `<feDisplacementMap>`）：圆角矩形 SDF，`depth = sat(−d / bevel)`，`edge = 1 − √((2 − depth)·depth)`（圆形倒角截面），`R,G = 0.5 − n·edge·0.5`。相比 v1 的 smoothstep 法线，这个截面在最外缘最陡、向内迅速归零，像真实的厚玻璃边：边上弯得明显，中心完全不动。
- **overlay 贴图**（DPR 分辨率，CSS 背景）：镜面描边 + 内发光 + 侧暗部，见 6.1-4。
- **色散**：`data-ca` > 0 时跑三次位移——R 用 `scale×(1+ca)`、G 用 `scale`、B 用 `scale×(1−ca)`，用 feColorMatrix 拆通道、arithmetic feComposite 合并。只在边缘可见（中心位移为 0），ca 取 .05–.1，克制。
- **磨砂在滤镜图内部**：`feGaussianBlur` + `feFuncA slope=4`。原因：Chromium 在 DPR 2 下会丢掉 `url()` 之后串接的 CSS `blur()`；而 SVG 模糊读到元素外的透明像素会让边缘发虚，SVG 滤镜在预乘空间运算、组件传输在非预乘空间运算，所以把 alpha 拉回 1 恰好得到「只取内部像素平均」的边缘夹取模糊——不依赖 `edgeMode`。
- **贴图解码竞态**：`feImage` 的 data-URL 是异步解码的，Chromium 若在解码完成前解析滤镜会当作空操作且之后不再失效重算。glass.js 记录每张贴图的 `decode()` Promise，完成后重新断言一次 `backdrop-filter`。
- 元素声明：`data-refract`（位移强度，Dock 36、ctxbar 40、胶片 44、Draw 48、面板 64、sheet 60）、`data-bevel`、`data-blur`、`data-ca`、`data-mat`。

### 6.3 液态动效
- **分段控件滑块**：WAAPI 关键帧——前沿先伸向目标、尾部随后跟上，中途 scaleY 轻微压扁，像一滴水被拉过去；滑块可直接拖动，松手吸附最近选项。
- **按压鼓起**：`.press` 按下 scale .96 → 松开用弹簧 `linear()` 曲线回弹到 1.04 再回落（jelly）；`.hl` 指针跟随光斑。
- **Draw 按钮**：hover 时圆角做不对称呼吸（液滴感），按下涟漪 + LED 脉冲。
- **抽卡**：新海报 feTurbulence 位移 70→0 衰减 + 扫描线。

### 6.4 降级与无障碍
| 条件 | 行为 |
|---|---|
| `prefers-reduced-transparency` / `?rt=1` | 去掉 backdrop、折射、overlay、镜像透镜与 ambient field，面板改为 100% 实色 + 发丝边（截图 `reduced-transparency-*.png`） |
| `prefers-reduced-motion` / `?rm=1` | 所有 animation/transition 时长压到 1ms，状态直接切换 |
| `@supports not (backdrop-filter)` | 高不透明度实色玻璃 |
| 文字对比 | 玻璃上的正文保持 ≥ 4.5:1；Dock / ctxbar 自适应明暗；面板正文不进入边缘窗口的低 tint 区 |
| 海报可读性 | 玻璃只压海报外缘（面板 32px、Dock 16–24px）；指针移到海报下部或选区靠近 Dock 时 Dock 退到 28% 不透明度并下沉（`.recede`），指针接近 Dock 16px 内恢复；ctxbar 优先放在选区下方，不挡标题 |

### 6.5 浏览器兼容（三种模式，`html[data-glass]`，可用 `?glass=backdrop|mirror|none` 强制）
| 能力 | Chrome/Edge — `backdrop` | Firefox — `mirror` | Safari — `none`（原生） |
|---|---|---|---|
| 磨砂 + 饱和 | ✅ 在 SVG 图内 | ✅ 在透镜滤镜内 | ✅ `-webkit-backdrop-filter` |
| overlay 镜面描边 / 内发光 / caustic | ✅ | ✅ | ✅ |
| 边缘位移折射 + 色散 | ✅ `backdrop-filter:url()` | ✅ 镜像透镜（见下） | —（只有高光，无位移） |
| ambient field | ✅ | ✅ | ✅ |
| 抽卡 warp | ✅ | ✅ | 跳过 |

**镜像透镜（mirror lens）**：`backdrop-filter:url()` 只有 Chromium 支持，但所有引擎都能对元素**自身像素**施加 SVG 滤镜——liquid-glass 正是这样做的（它过滤的是一层实时内容，Gecko 下额外用 `-moz-element()` 画副本）。我们清楚玻璃下面是什么：ambient field、点阵、海报本身。所以每个玻璃元素插入一个 `.lg-lens > i`（四周外扩 24px），把这三层按它们在屏幕上的真实位置画成背景，再用同一条滤镜图（位移 + 色散 + 磨砂 + 饱和）处理；tint 移到 `.lg-lens::after`。位置只在有东西移动时（transitionrun / animationstart / resize / 内容重渲染）用一小段 rAF 同步（`G.kick`），平时不跑。宿主用 innerHTML 重渲染时，MutationObserver 会把透镜放回去。
**Safari**：WebKit 对 HTML 元素上的 `url()` 滤镜（feImage 位移图）表现不稳定（liquid-glass README 也把 Safari 列为已知问题），因此 Safari 默认走原生 `-webkit-backdrop-filter` + overlay 高光；`?glass=mirror` 可手动开启镜像透镜做对比。注：本机 Playwright WebKit（Linux 版）不渲染任何 backdrop-filter，无法代表真机 Safari，所以没有放 WebKit 截图——上线前需在真机 Safari 手测。

**性能**：贴图每个尺寸只算一次（Canvas2D ImageData），按尺寸缓存；色散把位移从 1 次变 3 次，所以只给边缘可见的元素开（Dock、ctxbar、面板、sheet）。ambient field 是 192px 宽的 JPEG，换海报时 30ms 防抖重建并交叉淡入。动画只改 transform/opacity。无头浏览器（SwiftShader 软件渲染）下抽卡期间约 17fps，不代表真机。生产建议：同屏折射元素 ≤ 12、低端设备自动降到 `none` 模式。

### 6.6 玻璃浮在内容之上（Glass over content）
玻璃下面没东西时，折射是看不见的。这一轮把组件主动放到真实内容上方：
- **Dock 压住海报下缘**：海报底边在 Dock 中线上方 8px，胶囊上半部 16–24px 叠在海报上，边缘能看到海报边线被弯折、高光沿边游走；Dock 水平跟随海报中心。
- **ctxbar（元素浮动工具条）**：浮在海报正文上方（clear 材质、色散 .1），自适应明暗。
- **侧面板压边**：面板打开时海报滑入面板玻璃下 32px（tuck），配合「边缘窗口」，面板边缘清楚地折射出海报（如花瓶的蓝色纹样）。
- **⌘K / 导出 sheet**：去掉了全屏模糊 scrim（只留 10% 暗化），sheet 直接压在清晰的海报上，60px 位移 + 色散，玻璃里能看到海报被拉伸、磨砂的样子。
- **Ambient field**：整个舞台背后是一张由当前海报生成的大幅模糊色场（以海报中心放大 1.9×、blur 9px、饱和 1.5），所以 rail、顶栏这些远离海报的玻璃底下也有颜色可折射；点阵只铺在画布区，侧面板下面淡出，磨砂读起来更干净。
- **可读性**：见 6.4 最后一行（recede、ctxbar 位置）。

### 6.7 对 Glass-HQ/liquid-glass 的评估
- **仓库**：https://github.com/Glass-HQ/liquid-glass ，克隆到 `/workspace/vendor/liquid-glass`（commit `9f5bfc7`，2026-10-10 16:39 JST）。
- **许可证：MIT，© 2026 Glass HQ**——允许复用代码，需保留版权与许可声明。全文复制到 `assets/LICENSE-liquid-glass.txt`，`js/glass.js` 文件头注明出处。
- **技术**：用 vgpu/WGSL 在 **WebGPU** 上渲染材质贴图（`gpu/maps.wgsl`：field 平面存位移法线，overlay 平面存镜面/阴影），编码成 PNG 交给 SVG 滤镜（`feImage` + `feDisplacementMap` 等，`dom/material-graph.ts`），作用在一层实时 DOM 内容上而不是 backdrop-filter；Firefox 下每个表面用 `-moz-element()` 画一层副本（`dom/lens-layers.ts`）。材质预设（`core/materials.ts`）：clear = blur 0 / 折射 60，regular = blur 7.33、填充 sigma 与不透明度、色调曲线。要求：WebGPU 适配器、React 19+、HTTPS/localhost；Safari 有已知问题；刻意不用 WebGL；默认最多 16 个表面。
- **Demo**：在本机 Chromium 上开启 WebGPU（SwiftShader 软件适配器）跑通了官方 demo 站点，截图对比边缘形态（`tools/lgdemo.mjs`、`tools/lgzoom.mjs`；截图存于 `/workspace/vendor/liquid-glass-demo-*.png`）。它的边缘是「窄而陡的倒角 + 细亮描边」，这正是我们移植 field/overlay 公式想得到的观感。
- **我们拿了什么、为什么**
  1. **field 截面公式**（`edge = 1 − √((2−depth)·depth)`，`R,G = 0.5 − n·edge·0.5`）——比 v1 的 smoothstep 更像真实倒角，边缘更锐、中心更稳。移植为 Canvas2D（`fieldMap`），不需要 GPU。
  2. **overlay 平面**（0.9px 镜面描边按 |n.y| 受光、0.18 柔光、按 n.x 的 0.48/0.60 侧暗部）——移植为 `overlayMap`，作为 CSS 背景，**在所有浏览器都生效**。
  3. **「过滤自己的内容层」的思路** → 我们的镜像透镜，让 Firefox 也有真实位移折射。
  4. **低模糊 clear 材质**：顶栏、rail、Dock 用 blur 3，让折射可见而不是被磨砂吃掉。
- **没拿什么、为什么**：WebGPU 运行时（Safari/Firefox 覆盖不足，且贴图只在尺寸变化时算一次，Canvas2D 足够快）；React 19 / Base UI 组件层（原型是无构建原生 JS，移植目标 rea-poster 也不在 React 19）；有界 GlassScene 架构与表面数上限（我们的场景已知：海报 + 点阵 + 色场）；WebGL 回退（上游也明确不用 WebGL，Canvas2D 贴图 + SVG 滤镜已覆盖 Chromium/Firefox）。

---

## 7. 旧控件 → 新位置映射表

### 7.1 100 个参数（由 `tools/gen_mapping.js` 从 `js/params.js` 自动生成，保证与原型一致）

- **旧位置** = 旧 ParamsPanel 的 section › card › 标签（`rea-poster/src/engine/params.ts` 原样移植，key/范围/默认值不变）
- **新位置** = 高级调校 › 意图 › 分组；T1 = 默认显示，T2 = 收在「更多 N」里
- 另外：所有参数都可通过 ⌘K 搜索直达；检查器「感觉」4 个宏滑杆直接驱动 `whitespace`、标题尺度、图片占比、纹理强度。

| # | key | 旧位置 (section › card › label) | 类型 | 新位置 (intent › group) | 新标签 zh / en | 层级 |
|---|---|---|---|---|---|---|
| 1 | `gridType` | 全局 › grid › 网格类型 | seg (5) | 版式 / Layout › 网格 / Grid | 网格形态 / Grid shape | T1 默认显示 |
| 2 | `density` | 全局 › grid › 网格密度 | seg (7) | 版式 / Layout › 网格 / Grid | 信息密度 / Density | T1 默认显示 |
| 3 | `composition` | 全局 › grid › 构图 | seg (27) | 版式 / Layout › 构图 / Composition | 构图手法 / Composition | T1 默认显示 |
| 4 | `gridStrength` | 全局 › grid › 网格强度 | range 0–2x | 版式 / Layout › 网格 / Grid | 对齐严格度 / Grid adherence | T2 “更多” |
| 5 | `cols` | 全局 › grid › 列数 (0=自动) | range 0–12 | 版式 / Layout › 网格 / Grid | 列数 / Columns | T2 “更多” |
| 6 | `rows` | 全局 › grid › 行数 (0=自动) | range 0–16 | 版式 / Layout › 网格 / Grid | 行数 / Rows | T2 “更多” |
| 7 | `margin` | 全局 › grid › 页边距 | range 0–12% | 版式 / Layout › 空间 / Space | 页边距 / Margins | T1 默认显示 |
| 8 | `gutter` | 全局 › grid › 栏间距 | range 0–48px | 版式 / Layout › 空间 / Space | 栏间距 / Gutters | T2 “更多” |
| 9 | `baseline` | 全局 › grid › 基线网格 | range 4–24px | 版式 / Layout › 空间 / Space | 基线步长 / Baseline step | T2 “更多” |
| 10 | `whitespace` | 全局 › grid › 留白倾向 | range 0–100% | 版式 / Layout › 空间 / Space | 留白 / Whitespace | T1 默认显示 |
| 11 | `symmetry` | 全局 › grid › 对称倾向 | range 0–100% | 版式 / Layout › 空间 / Space | 对称感 / Symmetry | T1 默认显示 |
| 12 | `gridOpacity` | 全局 › display › 网格透明度 | range 0–100% | 细节 / Details › 线与网格 / Lines & grid | 网格线可见度 / Grid visibility | T1 默认显示 |
| 13 | `zoneStrength` | 全局 › display › 分区强度 | range 0–100% | 版式 / Layout › 卡片与分区 / Cards & zones | 色块分区强度 / Zone fill | T2 “更多” |
| 14 | `cornerRadius` | 全局 › display › 卡片圆角 | range 0–80px | 版式 / Layout › 卡片与分区 / Cards & zones | 卡片圆角 / Card corners | T2 “更多” |
| 15 | `cardGap` | 全局 › display › 卡片间距 | range 0–60px | 版式 / Layout › 卡片与分区 / Cards & zones | 卡片间距 / Card spacing | T2 “更多” |
| 16 | `tuneOn` | 全局 › tune › 画面调色 | bool | 色彩 / Color › 画面调色 / Grading | 启用调色 / Grading on | T2 “更多” |
| 17 | `contrast` | 全局 › tune › 对比度 | range 50–150% | 色彩 / Color › 画面调色 / Grading | 对比度 / Contrast | T1 默认显示 |
| 18 | `saturation` | 全局 › tune › 饱和度 | range 0–200% | 色彩 / Color › 画面调色 / Grading | 饱和度 / Saturation | T1 默认显示 |
| 19 | `brightness` | 全局 › tune › 明暗 | range 50–150% | 色彩 / Color › 画面调色 / Grading | 明暗 / Brightness | T1 默认显示 |
| 20 | `texture` | 全局 › tune › 纹理 | seg (8) | 质感 / Texture › 表面 / Surface | 纸面 / Surface | T1 默认显示 |
| 21 | `textureAmount` | 全局 › tune › 纹理强度 | range 0–100% | 质感 / Texture › 表面 / Surface | 质感强度 / Amount | T1 默认显示 |
| 22 | `bigGroups` | 标题 › groups › 大标题组数量 | range 1–3 | 文字 / Type › 层级 / Hierarchy | 主标题组 / Headline groups | T2 “更多” |
| 23 | `smallGroups` | 标题 › groups › 小标题组数量 | range 0–6 | 文字 / Type › 层级 / Hierarchy | 小标题组 / Sub-groups | T1 默认显示 |
| 24 | `smallRel` | 标题 › groups › 小标题相对大小 | range 15–70% | 文字 / Type › 层级 / Hierarchy | 主次对比 / Size contrast | T1 默认显示 |
| 25 | `titleScale` | 标题 › groups › 标题整体大小 | range 40–200% | 文字 / Type › 层级 / Hierarchy | 标题尺度 / Headline scale | T1 默认显示 |
| 26 | `smallScale` | 标题 › groups › 小字整体大小 | range 50–200% | 文字 / Type › 层级 / Hierarchy | 小字尺度 / Small text scale | T2 “更多” |
| 27 | `tickText` | 标题 › groups › 刻度字 | bool | 文字 / Type › 文字块 / Text blocks | 刻度字 / Tick labels | T2 “更多” |
| 28 | `align` | 标题 › groups › 对齐倾向 | seg (4) | 文字 / Type › 层级 / Hierarchy | 对齐方式 / Alignment | T1 默认显示 |
| 29 | `case` | 标题 › groups › 英文大小写 | seg (4) | 文字 / Type › 层级 / Hierarchy | 英文大小写 / Latin case | T2 “更多” |
| 30 | `proseCount` | 标题 › groups › 散文诗数量 | range 0–6 | 文字 / Type › 文字块 / Text blocks | 正文段落 / Prose blocks | T1 默认显示 |
| 31 | `proseSize` | 标题 › groups › 散文诗大小 | range 10–40% | 文字 / Type › 文字块 / Text blocks | 正文大小 / Prose size | T2 “更多” |
| 32 | `metaCount` | 标题 › groups › 页眉小字数量 | range 0–8 | 文字 / Type › 文字块 / Text blocks | 页眉小字 / Meta labels | T1 默认显示 |
| 33 | `maxLineWidth` | 标题 › rhythm › 最大行宽 | range 30–100% | 文字 / Type › 节奏 / Rhythm | 最大行宽 / Line length | T2 “更多” |
| 34 | `mainBreath` | 标题 › rhythm › 主字周围呼吸 | range 0–80px | 文字 / Type › 节奏 / Rhythm | 标题呼吸 / Headline air | T1 默认显示 |
| 35 | `subBreath` | 标题 › rhythm › 副字系统呼吸 | range 0–40px | 文字 / Type › 节奏 / Rhythm | 小字呼吸 / Small text air | T2 “更多” |
| 36 | `ruleWeight` | 标题 › rhythm › 短线粗细 | range 0–300% | 文字 / Type › 节奏 / Rhythm | 短线粗细 / Rule weight | T2 “更多” |
| 37 | `groupGap` | 标题 › rhythm › 组间距 | range 0–120px | 文字 / Type › 节奏 / Rhythm | 组间距 / Group spacing | T2 “更多” |
| 38 | `fontCount` | 标题 › fonts › 参与字体数 | range 1–3 | 文字 / Type › 字体 / Fonts | 字体数量 / Typefaces | T1 默认显示 |
| 39 | `englishBias` | 标题 › fonts › 英文倾向 | range 0–100% | 文字 / Type › 字体 / Fonts | 中英比例 / Latin ↔ CJK | T1 默认显示 |
| 40 | `shakeOnDraw` | 标题 › fonts › 抽卡时换字体 | bool | 文字 / Type › 字体 / Fonts | 每次抽卡换字体 / New fonts each draw | T2 “更多” |
| 41 | `bandHeight` | 通栏 › band › 通栏高度 | range 8–60% | 版式 / Layout › 通栏 / Band | 通栏高度 / Band height | T1 默认显示 |
| 42 | `bandPos` | 通栏 › band › 通栏位置 | seg (4) | 版式 / Layout › 通栏 / Band | 通栏位置 / Band position | T1 默认显示 |
| 43 | `bandKind` | 通栏 › band › 通栏内容 | seg (4) | 版式 / Layout › 通栏 / Band | 通栏内容 / Band content | T2 “更多” |
| 44 | `bandBleed` | 通栏 › band › 通栏出血 | bool | 版式 / Layout › 通栏 / Band | 通栏出血 / Band bleeds | T2 “更多” |
| 45 | `sidebarTpl` | 通栏 › sidebar › 边栏模板 | seg (19) | 版式 / Layout › 边栏 / Sidebar | 边栏样式 / Sidebar style | T1 默认显示 |
| 46 | `sidebarSide` | 通栏 › sidebar › 边栏位置 | seg (3) | 版式 / Layout › 边栏 / Sidebar | 边栏位置 / Sidebar side | T1 默认显示 |
| 47 | `sidebarWidth` | 通栏 › sidebar › 边栏宽度 | range 8–30% | 版式 / Layout › 边栏 / Sidebar | 边栏宽度 / Sidebar width | T2 “更多” |
| 48 | `sidebarFont` | 通栏 › sidebar › 边栏字号 | range 60–160% | 版式 / Layout › 边栏 / Sidebar | 边栏字号 / Sidebar text size | T2 “更多” |
| 49 | `sidebarRule` | 通栏 › sidebar › 边栏分隔线 | bool | 版式 / Layout › 边栏 / Sidebar | 边栏分隔线 / Sidebar rule | T2 “更多” |
| 50 | `colorMode` | 色调 › color › 配色模式 | seg (3) | 色彩 / Color › 配色 / Palette | 配色性格 / Colour character | T1 默认显示 |
| 51 | `paletteSource` | 色调 › color › 色源 | seg (4) | 色彩 / Color › 配色 / Palette | 颜色来自 / Palette from | T1 默认显示 |
| 52 | `bgPref` | 色调 › color › 底色倾向 | seg (4) | 色彩 / Color › 配色 / Palette | 底色明暗 / Ground | T1 默认显示 |
| 53 | `soft` | 色调 › color › 柔和 | bool | 色彩 / Color › 配色 / Palette | 柔和 / Soften | T1 默认显示 |
| 54 | `minContrast` | 色调 › color › 最低对比度 | range 3–7:1 | 色彩 / Color › 配色 / Palette | 最低对比度 / Min contrast | T2 “更多” |
| 55 | `zoneColors` | 色调 › color › 分区色数量 | range 1–5 | 色彩 / Color › 配色 / Palette | 分区色数 / Zone colours | T2 “更多” |
| 56 | `accentUse` | 色调 › color › 强调色使用 | range 0–100% | 色彩 / Color › 配色 / Palette | 强调色用量 / Accent amount | T2 “更多” |
| 57 | `imageCount` | 图片 › image › 图片数量 | range 0–4 | 图像 / Image › 数量与占比 / Amount | 图片数量 / Images | T1 默认显示 |
| 58 | `imageShare` | 图片 › image › 图片占比 | range 0–100% | 图像 / Image › 数量与占比 / Amount | 图片占比 / Image area | T1 默认显示 |
| 59 | `maskKind` | 图片 › image › 切割/蒙版 | seg (11) | 图像 / Image › 裁切 / Cut & mask | 裁切形状 / Cut shape | T1 默认显示 |
| 60 | `sliceCount` | 图片 › image › 切片数 | range 2–12 | 图像 / Image › 裁切 / Cut & mask | 切片数 / Slices | T2 “更多” |
| 61 | `imageZoom` | 图片 › image › 图片缩放 | range 100–250% | 图像 / Image › 裁切 / Cut & mask | 图片缩放 / Zoom | T2 “更多” |
| 62 | `legibility` | 图片 › treat › 可读性处理 | range 0–100% | 图像 / Image › 处理 / Treatment | 文字可读性保护 / Text protection | T1 默认显示 |
| 63 | `imgSat` | 图片 › treat › 图片饱和 | range 0–200% | 图像 / Image › 处理 / Treatment | 图片饱和 / Image saturation | T2 “更多” |
| 64 | `imgContrast` | 图片 › treat › 图片对比 | range 50–150% | 图像 / Image › 处理 / Treatment | 图片对比 / Image contrast | T2 “更多” |
| 65 | `duotone` | 图片 › treat › 双色调概率 | range 0–100% | 图像 / Image › 处理 / Treatment | 双色调概率 / Duotone chance | T1 默认显示 |
| 66 | `tornRough` | 图片 › treat › 撕边粗糙度 | range 0–100% | 图像 / Image › 裁切 / Cut & mask | 撕边粗糙度 / Torn edge | T2 “更多” |
| 67 | `bigGlyph` | 装饰 › glyph › 装饰大字 | bool | 细节 / Details › 装饰大字 / Big glyph | 装饰大字 / Big glyph | T1 默认显示 |
| 68 | `glyphKind` | 装饰 › glyph › 大字内容 | seg (5) | 细节 / Details › 装饰大字 / Big glyph | 大字内容 / Glyph content | T2 “更多” |
| 69 | `glyphSize` | 装饰 › glyph › 大字尺寸 | range 30–160% | 细节 / Details › 装饰大字 / Big glyph | 大字尺寸 / Glyph size | T1 默认显示 |
| 70 | `glyphOpacity` | 装饰 › glyph › 大字透明度 | range 5–100% | 细节 / Details › 装饰大字 / Big glyph | 大字透明度 / Glyph opacity | T2 “更多” |
| 71 | `ornaments` | 装饰 › marks › 图形装饰数量 | range 0–4 | 细节 / Details › 图形装饰 / Ornaments | 图形装饰 / Ornaments | T1 默认显示 |
| 72 | `ornamentSize` | 装饰 › marks › 图形尺寸 | range 50–200% | 细节 / Details › 图形装饰 / Ornaments | 图形尺寸 / Ornament size | T2 “更多” |
| 73 | `lineWeight` | 装饰 › marks › 线条粗细 | range 0.25–4px | 细节 / Details › 线与网格 / Lines & grid | 线条粗细 / Line weight | T1 默认显示 |
| 74 | `nodeSize` | 装饰 › marks › 交点尺寸 | range 0–10px | 细节 / Details › 线与网格 / Lines & grid | 交点尺寸 / Node size | T2 “更多” |
| 75 | `zoneNumbers` | 装饰 › marks › 区域编号 | bool | 细节 / Details › 线与网格 / Lines & grid | 区域编号 / Zone numbers | T2 “更多” |
| 76 | `guides` | 装饰 › marks › 辅助线 | bool | 细节 / Details › 线与网格 / Lines & grid | 辅助线 / Guides | T2 “更多” |
| 77 | `dashed` | 装饰 › marks › 虚线网格 | bool | 细节 / Details › 线与网格 / Lines & grid | 虚线网格 / Dashed grid | T2 “更多” |
| 78 | `curveCount` | 装饰 › marks › 曲线数量 | range 0–6 | 细节 / Details › 线与网格 / Lines & grid | 曲线 / Curves | T2 “更多” |
| 79 | `shapeCount` | 装饰 › marks › 几何图形数量 | range 0–6 | 细节 / Details › 图形装饰 / Ornaments | 几何图形 / Shapes | T2 “更多” |
| 80 | `noiseAmount` | 装饰 › marks › 杂点数量 | range 0–100% | 质感 / Texture › 杂点 / Specks | 杂点 / Specks | T1 默认显示 |
| 81 | `qualityGate` | 更多 › quality › 质量守门（自动重抽杂乱/重叠） | bool | 生成 / Engine › 质量守门 / Quality gate | 质量守门 / Quality gate | T1 默认显示 |
| 82 | `qualityMin` | 更多 › quality › 最低版面分 | range 40–95 | 生成 / Engine › 质量守门 / Quality gate | 最低版面分 / Minimum score | T1 默认显示 |
| 83 | `qualityTries` | 更多 › quality › 最多重抽次数 | range 0–8 | 生成 / Engine › 质量守门 / Quality gate | 最多重抽 / Max redraws | T2 “更多” |
| 84 | `collisionFix` | 更多 › quality › 文字避让 | bool | 生成 / Engine › 质量守门 / Quality gate | 文字避让 / Collision avoidance | T2 “更多” |
| 85 | `planV2` | 更多 › plan › 一图一招（每次抽卡只用一种明确手法） | bool | 生成 / Engine › 抽卡方向 / Draw direction | 一图一招 / One idea per draw | T1 默认显示 |
| 86 | `typeOnlyShare` | 更多 › plan › 纯排版比例 | range 0–60% | 生成 / Engine › 抽卡方向 / Draw direction | 纯排版比例 / Type-only draws | T1 默认显示 |
| 87 | `monoShare` | 更多 › plan › 单色相配色比例 | range 0–60% | 生成 / Engine › 抽卡方向 / Draw direction | 单色相比例 / Mono-hue draws | T1 默认显示 |
| 88 | `clashShare` | 更多 › plan › 撞色比例 | range 0–30% | 生成 / Engine › 抽卡方向 / Draw direction | 撞色比例 / Clash draws | T1 默认显示 |
| 89 | `grainShare` | 更多 › plan › 颗粒纹理比例 | range 0–100% | 质感 / Texture › 表面 / Surface | 颗粒出现率 / Grain frequency | T2 “更多” |
| 90 | `scriptShare` | 更多 › plan › 手写字纹理比例 | range 0–50% | 质感 / Texture › 表面 / Surface | 手写纹理出现率 / Script frequency | T2 “更多” |
| 91 | `artDirection` | 更多 › direction › 版面导演（层级/留白/预算） | bool | 生成 / Engine › 版面导演 / Art direction | 版面导演 / Art direction | T1 默认显示 |
| 92 | `typeRatio` | 更多 › direction › 字号模数比 | seg (6) | 文字 / Type › 层级 / Hierarchy | 字号模数比 / Type scale ratio | T2 “更多” |
| 93 | `opticalTracking` | 更多 › direction › 视觉字距（大紧小松） | bool | 文字 / Type › 节奏 / Rhythm | 视觉字距 / Optical tracking | T2 “更多” |
| 94 | `blockBudget` | 更多 › direction › 文字块上限 | range 4–14 | 文字 / Type › 文字块 / Text blocks | 文字块上限 / Text block budget | T2 “更多” |
| 95 | `decorBudget` | 更多 › direction › 装饰上限 | range 0–6 | 细节 / Details › 图形装饰 / Ornaments | 装饰上限 / Decor budget | T2 “更多” |
| 96 | `busyScrim` | 更多 › direction › 繁忙图像渐变遮罩 | bool | 图像 / Image › 处理 / Treatment | 繁忙区渐变遮罩 / Busy-area scrim | T2 “更多” |
| 97 | `snapGrid` | 更多 › direction › 拖动吸附网格 | bool | 版式 / Layout › 网格 / Grid | 拖动吸附网格 / Snap to grid | T2 “更多” |
| 98 | `exportScale` | 更多 › export › 导出倍率 | range 1–4x | 导出与录制 / Output › 导出 / Export | 导出倍率 / Export scale | T1 默认显示 |
| 99 | `embedFonts` | 更多 › export › SVG 内嵌字体 | bool | 导出与录制 / Output › 导出 / Export | SVG 内嵌字体 / Embed fonts | T1 默认显示 |
| 100 | `replaySpeed` | 更多 › replay › 回放间隔 | range 200–3000ms | 导出与录制 / Output › 录制 / Recording | 回放间隔 / Replay interval | T1 默认显示 |

### 7.2 面板与功能（非参数）

| 旧位置 | 旧功能 | 新位置 |
|---|---|---|
| TopBar | 抽一张 / 空格 | Dock 中央 ink 玻璃主按钮「抽一张」（Space） |
| TopBar | 上一张 / 下一张 | Dock 左侧 ‹ 13/13 ›；←/→；胶片条 |
| TopBar | 换文案/细节、摇一组搭配、摇字体 | Dock 重抽按钮：文字 / 配色 / 图片 / 结构 / 图形 / 倾向；摇字体：字体库「摇一组搭配」与「每次抽卡换字体」开关 |
| TopBar | 锁定文字/配色/主图/全部图片 | 顶部工具胶囊 4 个锁（⇧1–⇧4）；检查器配色条锁；图片 ctxbar「锁定此图」 |
| TopBar | 比例 | 顶部工具胶囊液态分段（1–6） |
| TopBar | 单页 / 多页 | 品牌胶囊视图分段：海报 / 多页 / 配色 |
| TopBar | 中英文、明暗 | 顶部右侧胶囊（⇧L / ⇧D），⌘K › 偏好 |
| TopBar | 导出（PNG/JPG/SVG/倍率） | 右上「导出」→ 导出 sheet（E）；S 快速 PNG |
| TopBar | 收藏 (F) | Dock 右侧 ♥（F），胶片条「收藏」标签，左 Rail ♥ |
| Stage | 单击选择 / 拖动 / 双击编辑 / Delete 隐藏 / Esc | 不变；选中后出现浮动自适应玻璃 ctxbar + 检查器元素情境 |
| Stage | 取景（拖动/滚轮） | 图片 ctxbar「取景」 |
| Stage | 显示空槽、放入空槽 | 组件库「显示空槽」开关；在画布空槽点击放入 |
| Stage | 撤销画布手动修改 / 还原修改 | ⌘Z 全局撤销栈；检查器底部「还原」 |
| LayoutPanel | 版式库、构图、网格 | 高级 › 版式（预设 + 构图缩略图 + 网格组）；G 显示网格叠加 |
| CompPanel | 同一组内容在不同构图下的预览、点击锁定构图 | 高级 › 版式 › 构图手法（26 种，r3 实拍缩略图）；多页面板「本页构图」 |
| TextPanel | 文字组、主/副/小标题、说明、信息标签、正文 | 左 Rail › 文字库；元素检查器内容编辑 |
| TextPanel | AI 文案 / 生成文案 / 本地模板、保存到文字库、我的文字 | 文字库顶部 AI 生成卡；检查器「AI 改写」「换一句」；文字库「我的」 |
| ImagesPanel | 图片库、分类、限定范围、使用次数、上传、AI 抠图 | 左 Rail › 图片库（分类分段、选中限定、角标计数、上传卡）；图片 ctxbar「AI 抠图」 |
| PalettePanel | 色板库、和田/NICE 色源、筛选、指定色板、配色模式、颜色角色 | 左 Rail › 配色库（筛选芯片 + 色板网格）；顶部视图「配色」大视图；高级 › 色彩；元素检查器「颜色角色」 |
| FontsPanel | 字体库、字体数量、字体角色、每次换字体、字号记忆 | 左 Rail › 字体库；检查器字体卡；高级 › 文字（字体数 `fontCount`） |
| MorePanel | 组件库、装饰库、组件尺寸、装饰数量/尺寸 | 左 Rail › 组件；高级 › 细节 › 图形装饰 |
| MorePanel | 边栏模板、启用/删除边栏 | 高级 › 版式 › 边栏（`sidebarTpl/Side/Width`）；选中边栏 → 检查器「隐藏」 |
| MorePanel | 风格管理：保存/另存/更新/导入/导出风格 | 检查器底部「另存风格」；左 Rail › 风格库「我的」+ 「…」菜单（导入/导出 JSON） |
| MorePanel | 种子与详情、输入种子 | 检查器海报情境底部「种子」（可复制/输入）；画布下方 caption（No./风格/构图/耗时/版面分） |
| MorePanel | AI 设置（OpenAI 兼容接口、本地密钥） | ⌘K › 偏好 › AI 设置 |
| HistoryPanel | 收藏与历史、回放、录制、导出 WebM、会话导出/导入 | 胶片条（H）：历史/收藏、回放、录制；导出 sheet「更多输出」：海报 JSON、会话 JSON、WebM、多页 PDF/ZIP、导入 JSON |
| ParamsPanel | 100 个参数（7 section） | 高级调校（7 意图 + 图层与模式 + 导出与录制），见 7.1 |
| Deck | 多页：共享风格、统一网格、页码、不重复图片、重抽本页/内页 | 视图「多页」：左侧页面列表 + 右侧多页面板 |
| Panel | 「参数改动即时重排，种子不变；双击滑杆复位」 | 保留为 scrub 滑杆规范 + 画布即时反馈 |

---

## 8. 原型说明

**运行**：`cd /workspace/rea-poster-ui-proto && python3 -m http.server 5190 --bind 0.0.0.0` → http://<box>:5190/

**文件**
| 路径 | 内容 |
|---|---|
| `index.html` | 外壳、共享 warp SVG filter、脚本顺序 |
| `css/tokens.css` | 设计 token（light/dark）、@font-face |
| `css/glass.css` | liquid glass 材质、按压/光斑、降级 |
| `css/app.css` | 布局与组件 |
| `css/grid.css` | UI 布局网格变量、各区域对齐、面板内 8pt 归一、网格叠加层样式 |
| `js/glass.js` | 折射贴图 v2（field/overlay，移植自 liquid-glass，MIT）、色散、镜像透镜、ambient field、自适应染色、液态分段、warp |
| `js/params.js` | 100 参数（原样移植）+ 意图 IA + 预设 |
| `js/schematic.js` | 「这个参数做什么」示意图 |
| `js/data.js` | 风格 62、图层、模式、文字组、构图 |
| `js/app.js` | 状态、渲染、交互、⌘K、快捷键、`window.PP` 调试 API |
| `assets/` | 168 张真实生成海报（来自 rea-poster 产出）+ 缩略图、素材库图片、字体子集、favicon、许可证 |
| `tools/shoot.mjs` | Playwright 截图（全部状态 × 2 尺寸）；`quick.mjs`（单张，可选 chromium/firefox/webkit）、`crop.mjs`（2× 局部）、`probe.mjs`（检查每个玻璃元素的滤镜）、`overview.py`（总览图）、`gen_mapping.js`（映射表） |
| `assets/LICENSE-liquid-glass.txt` | liquid-glass 的 MIT 许可证全文（署名） |

**URL 状态**（演示/截图用）：`?theme=dark&lang=en&open=adv,insp,lib:styles,film,cmdk,export,keys,sel,grid&sel=h1&q=留&intent=type&focus=titleScale&locks=text,color&view=deck&rt=1&rm=1&grid=1&glass=backdrop|mirror|none`（`grid=1` = UI 网格叠加层；`open=grid` = 海报网格）

**截图**：`shots/*-1440x900.png`、`shots/*-1280x800.png`——默认亮/暗、检查器（元素/海报·深色）、高级（亮/暗）、命令面板（亮/暗）、导出、胶片条（亮/暗）、素材库、多页、海报网格+英文（`poster-grid-en`）、降低透明度、**UI 网格叠加层**（`grid-overlay`、`grid-overlay-dark`、`grid-overlay-adv`）；Firefox 镜像透镜：`firefox-mirror-inspector-1440x900.png`、`firefox-mirror-export-dark-1440x900.png`；`draw-transition-1440x900.png` 为上一轮的抽卡转场截图。总览 `shots/overview.jpg`。

**模拟范围**：生成为模拟（从同比例真实海报中挑选），所有 UI 状态与交互均可操作；导出/AI/录制为 toast 演示。

---

## 9. 移植计划（→ `rea-poster`，React + zustand）

1. **Token、网格与材质（0.5 天）**：`tokens.css`、`grid.css`、`glass.css` 原样放入 `src/styles/`，在 `index.css` 引入；字体子集与 OFL 文本放 `public/fonts/`。替换旧颜色变量。
2. **Glass 基础设施（1 天）**：`glass.js` → `src/ui/glass/`：`useRefraction(ref, {scale, bevel})` hook（ResizeObserver + 尺寸缓存 + 单例 `<svg><defs>` portal）、`useAmbient(posterCanvas)`、`<LiquidSegmented>`（WAAPI 拉伸 + 拖动吸附）、`<Press>`。Chromium UA 判定与降级保持不变。
3. **外壳组件（2 天）**：`<TopCaps>`（Brand/ViewSeg、ToolCap: RatioSeg+Locks+Undo、SearchButton、Prefs、ExportButton）、`<Rails>`、`<Dock>`、`<Filmstrip>`、`<Caption>`、`<CtxBar>`；布局让位用 CSS 变量 `--cl/--cr` 由面板开合状态驱动。
4. **Store 对接（1–2 天）**：沿用现有 zustand store（`hIndex`、`panel`、`selected`、`theme`、`lang`、`view`、`pinnedPalette`、锁定、历史/收藏、`replaying` 等）。新增 UI slice：`insp`、`adv`、`advIntent`、`lib`、`film`、`sheet`、`cmdQ`、`focusParam`；新增 undo 中间件（快照 params/locks/ratio/元素编辑）。生成调用仍走现有 engine，不改 generator。
5. **参数 IA（1 天）**：把 `IA` 映射与 `PRESETS` 放到 `src/ui/ia.ts`，引用 `engine/params.ts` 的 schema（key 不变，避免 drift）；`<AdvancedSheet>` 按意图渲染，`<Scrub>/<Seg>/<Switch>/<OptGrid>/<CompPicker>` 共用；`schematic.ts` 移植为 SVG 组件。
6. **检查器（1.5 天）**：`<Inspector>` 海报/元素两种情境；接 Stage 现有选择与编辑逻辑（双击编辑、取景、抠图、存为组件）。
7. **素材库抽屉（1.5 天）**：把 9 个旧 panels 的业务逻辑搬进 `<LibraryDrawer>` 的 6 个标签（风格/图片/文字/配色/字体/组件）+ 收藏，旧 panel 组件可先包一层复用，再逐步换皮。
8. **⌘K 与快捷键（1 天）**：`<CommandPalette>`（索引：动作、视图、params IA、风格、偏好）；统一 `useHotkeys` 表（见 4.1），替换旧散落的 keydown。
9. **导出 sheet / 多页 / 配色视图（1 天）**：接现有导出、WebM 录制、会话 JSON、deck 逻辑。
10. **验收（1 天）**：对照第 7 节映射表逐项打勾；Playwright 截图回归（复用 `tools/shoot.mjs`）；Safari/Firefox 手测降级；Lighthouse/Performance 面板确认抽卡转场 60fps；reduced-motion/transparency 检查。

预计 ~12 人日。建议分支 `ui/poster-printer-glass`，按 1→3→4→5 顺序先上线外壳 + 高级面板（功能可用），再替换素材库。
