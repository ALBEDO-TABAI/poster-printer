// Parameter schema (95 engine controls after the phase 13 trim) grouped into panel sections.
export type Section = 'global' | 'title' | 'band' | 'color' | 'image' | 'decor' | 'more';
export const SECTIONS: Section[] = ['global', 'title', 'band', 'color', 'image', 'decor', 'more'];

export interface RangeDef { key: string; section: Section; card: string; type: 'range'; min: number; max: number; step: number; def: number; unit?: string; zh: string; en: string }
export interface SegDef { key: string; section: Section; card: string; type: 'seg'; options: { v: string; zh: string; en: string }[]; def: string; zh: string; en: string }
export interface BoolDef { key: string; section: Section; card: string; type: 'bool'; def: boolean; zh: string; en: string }
export type ParamDef = RangeDef | SegDef | BoolDef;

const R = (section: Section, card: string, key: string, zh: string, en: string, min: number, max: number, def: number, step = 1, unit = ''): RangeDef => ({ key, section, card, type: 'range', min, max, step, def, unit, zh, en });
const S = (section: Section, card: string, key: string, zh: string, en: string, opts: [string, string, string][], def?: string): SegDef => ({ key, section, card, type: 'seg', options: opts.map(([v, z, e]) => ({ v, zh: z, en: e })), def: def ?? opts[0][0], zh, en });
const B = (section: Section, card: string, key: string, zh: string, en: string, def = false): BoolDef => ({ key, section, card, type: 'bool', def, zh, en });

export const PARAMS: ParamDef[] = [
  // ---- global: grid & structure
  S('global', 'grid', 'gridType', '网格类型', 'Grid type', [['auto', '自动', 'Auto'], ['ortho', '正交', 'Orthogonal'], ['skew', '非正交', 'Non-ortho'], ['curve', '数学曲线', 'Math curve'], ['image', '图片友好', 'Image-friendly']]),
  S('global', 'grid', 'density', '网格密度', 'Density', [['auto', '自动', 'Auto'], ['simple', '简单', 'Simple'], ['stable', '稳定', 'Stable'], ['full', '满载', 'Full'], ['aggressive', '激进', 'Aggressive'], ['curve', '曲线', 'Curve'], ['curve2', '曲线2', 'Curve 2']]),
  S('global', 'grid', 'composition', '构图', 'Composition', [['auto', '自动', 'Auto'], ['split', '图文分割', 'Split'], ['checker', '切片棋盘', 'Checker'], ['fullbleed', '满版图', 'Full bleed'], ['giant', '巨字', 'Giant word'], ['partition', '色块分区', 'Partition'], ['cards', '卡片', 'Cards'], ['fan', '扇形', 'Fan'], ['typefill', '字中图', 'Type fill'], ['swiss', '结构网格', 'Swiss'], ['centered', '居中编排', 'Centered'], ['layered', '主体分层', 'Layered'], ['bands', '横带', 'Bands'], ['typo', '纯排版', 'Type only'], ['edge', '出血大字', 'Edge type'], ['ghost', '虚实同图', 'Ghost reveal'], ['bento', '便当卡片', 'Bento cards'], ['veil', '色片叠图', 'Veil panels'], ['mosaic', '单图拼格', 'Mosaic'], ['inset', '小图留白', 'Inset'], ['cover', '杂志封面', 'Cover'], ['index', '索引表', 'Index'], ['echo', '回声重复', 'Echo'], ['knockout', '镂空色块', 'Knockout'], ['vertical', '竖排', 'Vertical'], ['quote', '引语', 'Quote'], ['ring', '环形字', 'Ring'], ['object', '物件海报', 'Object'], ['panorama', '全景横幅', 'Panorama'], ['ma', '留白', 'Emptiness'], ['substitute', '替换', 'Substitution'], ['hanzi', '汉字即图', 'Hanzi'], ['anomaly', '重复例外', 'Anomaly'], ['calendar', '日历数据', 'Calendar'], ['window', '揭示窗', 'Window'], ['typeled', '字形主导', 'Type-led'], ['interleave', '图字穿插', 'Interleave'], ['programme', '节目单', 'Programme'], ['exhibit', '展览框', 'Exhibit'], ['modular', '模块网格', 'Modular grid'], ['bleedgrid', '满版拼图', 'Bleed grid']]),
  // phase 16: the Swiss layout type of the modular / bleed-grid compositions
  S('global', 'grid', 'gridLayout', '网格版式', 'Grid layout', [['auto', '自动', 'Auto'], ['hero', '主图卫星', 'Hero + satellites'], ['flow', '悬挂线', 'Flowline'], ['steps', '尺度递进', 'Scale steps'], ['strip', '图片横条', 'Strip'], ['blocks', '模块分区', 'Module blocks'], ['mosaic', '满版拼贴', 'Mosaic'], ['rows', '满版行列', 'Justified rows']]),
  R('global', 'grid', 'gridStrength', '网格强度', 'Grid strength', 0, 2, 1, 0.1, 'x'),
  R('global', 'grid', 'cols', '列数 (0=自动)', 'Columns (0=auto)', 0, 12, 0),
  R('global', 'grid', 'rows', '行数 (0=自动)', 'Rows (0=auto)', 0, 16, 0),
  R('global', 'grid', 'margin', '页边距', 'Margin', 0, 12, 3, 0.5, '%'), // phase 15: 4.5 → 3 (白 prefers fuller, closer-to-edge layouts; restraint compositions keep 4.5, gen/grid.ts RESTRAINT)
  R('global', 'grid', 'gutter', '栏间距', 'Gutter', 0, 48, 0, 1, 'px'),
  R('global', 'grid', 'baseline', '基线网格', 'Baseline', 4, 24, 8, 1, 'px'),
  R('global', 'display', 'gridOpacity', '网格透明度', 'Grid opacity', 0, 100, 100, 1, '%'),
  R('global', 'display', 'zoneStrength', '分区强度', 'Zone strength', 0, 100, 40, 1, '%'),
  R('global', 'display', 'cornerRadius', '卡片圆角', 'Card radius', 0, 80, 22, 1, 'px'),
  R('global', 'display', 'cardGap', '卡片间距', 'Card gap', 0, 60, 22, 1, 'px'),
  B('global', 'tune', 'tuneOn', '画面调色', 'Canvas tune', true),
  R('global', 'tune', 'contrast', '对比度', 'Contrast', 50, 150, 100, 1, '%'),
  R('global', 'tune', 'saturation', '饱和度', 'Saturation', 0, 200, 100, 1, '%'),
  R('global', 'tune', 'brightness', '明暗', 'Brightness', 50, 150, 100, 1, '%'),
  S('global', 'tune', 'texture', '纹理', 'Texture', [['auto', '自动', 'Auto'], ['none', '无', 'None'], ['grain', '颗粒', 'Grain'], ['paper', '纸张', 'Paper'], ['riso', '孔版', 'Riso'], ['halftone', '网点', 'Halftone'], ['lines', '斜线', 'Lines'], ['linen', '布纹', 'Linen']], 'auto'),
  R('global', 'tune', 'textureAmount', '纹理强度', 'Texture amount', 0, 100, 18, 1, '%'),
  // ---- title
  R('title', 'groups', 'smallGroups', '小标题组数量', 'Small groups', 0, 6, 3),
  R('title', 'groups', 'smallRel', '小标题相对大小', 'Small group size', 15, 70, 32, 1, '%'),
  R('title', 'groups', 'titleScale', '标题整体大小', 'Title scale', 40, 200, 100, 1, '%'),
  R('title', 'groups', 'smallScale', '小字整体大小', 'Small text scale', 50, 200, 100, 1, '%'),
  B('title', 'groups', 'tickText', '刻度字', 'Tick labels', true),
  S('title', 'groups', 'align', '对齐倾向', 'Alignment', [['lr', '左右', 'Left/right'], ['center', '居中', 'Center'], ['array', '阵列', 'Array'], ['random', '随机', 'Random']], 'random'),
  S('title', 'groups', 'case', '英文大小写', 'Latin case', [['auto', '自动', 'Auto'], ['upper', '大写', 'UPPER'], ['title', '首字母', 'Title'], ['lower', '小写', 'lower']]),
  R('title', 'groups', 'proseCount', '散文诗数量', 'Prose blocks', 0, 6, 2),
  R('title', 'groups', 'proseSize', '散文诗大小', 'Prose size', 10, 40, 22, 1, '%'),
  R('title', 'groups', 'metaCount', '页眉小字数量', 'Meta labels', 0, 8, 6),
  R('title', 'rhythm', 'maxLineWidth', '最大行宽', 'Max line width', 30, 100, 92, 1, '%'),
  R('title', 'rhythm', 'mainBreath', '主字周围呼吸', 'Main breathing', 0, 80, 18, 1, 'px'),
  R('title', 'rhythm', 'subBreath', '副字系统呼吸', 'Sub breathing', 0, 40, 6, 1, 'px'),
  R('title', 'rhythm', 'ruleWeight', '短线粗细', 'Rule weight', 0, 300, 100, 1, '%'),
  R('title', 'fonts', 'fontCount', '参与字体数', 'Fonts involved', 1, 3, 2),
  R('title', 'fonts', 'englishBias', '英文倾向', 'English bias', 0, 100, 60, 1, '%'),
  B('title', 'fonts', 'shakeOnDraw', '抽卡时换字体', 'New fonts each draw', false),
  // ---- band & sidebar
  R('band', 'band', 'bandHeight', '通栏高度', 'Band height', 8, 60, 24, 1, '%'),
  S('band', 'band', 'bandPos', '通栏位置', 'Band position', [['auto', '自动', 'Auto'], ['top', '上', 'Top'], ['middle', '中', 'Middle'], ['bottom', '下', 'Bottom']]),
  B('band', 'band', 'bandBleed', '通栏出血', 'Band bleed', true),
  S('band', 'sidebar', 'sidebarTpl', '边栏模板', 'Sidebar template', [['auto', '自动', 'Auto'], ['strip.3', '三竖条', 'Triple strip'], ['strip.2', '双竖条', 'Double strip'], ['strip.4', '四竖条', 'Quad strip'], ['data.rows', '多栏数据', 'Data rows'], ['data.header', '带表头数据', 'Data + header'], ['data.dense', '密集数据', 'Dense data'], ['paired.split', '成对包裹', 'Paired'], ['paired.top', '顶部成对', 'Paired top'], ['index.number', '编号页眉', 'Indexed'], ['index.letter', '字母页眉', 'Lettered'], ['center.vertical', '居中竖排', 'Center vertical'], ['center.stack', '居中堆叠', 'Center stack'], ['corners.2', '上下锚定', 'Top & bottom'], ['corners.4', '四角锚定', 'Four corners'], ['timeline', '时间线', 'Timeline'], ['colophon', '版权页', 'Colophon'], ['ruler', '刻度尺', 'Ruler'], ['tags', '标签堆', 'Tag stack']]),
  S('band', 'sidebar', 'sidebarSide', '边栏位置', 'Sidebar side', [['auto', '自动', 'Auto'], ['left', '左', 'Left'], ['right', '右', 'Right']]),
  R('band', 'sidebar', 'sidebarWidth', '边栏宽度', 'Sidebar width', 8, 30, 16, 1, '%'),
  R('band', 'sidebar', 'sidebarFont', '边栏字号', 'Sidebar type', 60, 160, 100, 1, '%'),
  B('band', 'sidebar', 'sidebarRule', '边栏分隔线', 'Sidebar rule', true),
  // ---- color
  S('color', 'color', 'colorMode', '配色模式', 'Color mode', [['normal', '普通', 'Normal'], ['random', '随机', 'Random'], ['experimental', '实验', 'Experimental']]),
  S('color', 'color', 'paletteSource', '色源', 'Palette source', [['image', '图片提取', 'From image'], ['wada', '和田配色', 'Wada'], ['nice', 'NICE配色', 'Nice'], ['base', '底色', 'Base color']]),
  S('color', 'color', 'bgPref', '底色倾向', 'Background', [['auto', '自动', 'Auto'], ['light', '浅', 'Light'], ['dark', '深', 'Dark'], ['color', '彩', 'Color']]),
  B('color', 'color', 'soft', '柔和', 'Soft', false),
  R('color', 'color', 'minContrast', '最低对比度', 'Min contrast', 3, 7, 4.5, 0.5, ':1'),
  R('color', 'color', 'zoneColors', '分区色数量', 'Zone colors', 1, 5, 3),
  // ---- image
  R('image', 'image', 'imageCount', '图片数量', 'Images', 0, 8, 1), // phase 16: 4 → 8 (the grid compositions lay out several pictures)
  R('image', 'image', 'imageShare', '图片占比', 'Image share', 0, 100, 55, 1, '%'),
  S('image', 'image', 'maskKind', '切割/蒙版', 'Cut / mask', [['auto', '自动', 'Auto'], ['rect', '矩形', 'Rect'], ['grid', '网格切割', 'Grid slice'], ['random', '随机切割', 'Random slice'], ['rounded', '圆角', 'Rounded'], ['torn', '撕纸', 'Torn'], ['fan', '扇形', 'Fan'], ['arch', '拱形', 'Arch'], ['circle', '圆', 'Circle'], ['brush', '笔触', 'Brush'], ['wave', '波浪', 'Wave']]),
  R('image', 'image', 'imageZoom', '图片缩放', 'Image zoom', 100, 250, 100, 1, '%'),
  R('image', 'treat', 'legibility', '可读性处理', 'Legibility', 0, 100, 70, 1, '%'),
  R('image', 'treat', 'imgSat', '图片饱和', 'Image saturation', 0, 200, 100, 1, '%'),
  R('image', 'treat', 'imgContrast', '图片对比', 'Image contrast', 50, 150, 100, 1, '%'),
  R('image', 'treat', 'duotone', '双色调概率', 'Duotone chance', 0, 100, 15, 1, '%'),
  R('image', 'treat', 'tornRough', '撕边粗糙度', 'Torn roughness', 0, 100, 50, 1, '%'),
  // ---- decor
  B('decor', 'glyph', 'bigGlyph', '装饰大字', 'Decorative glyph', true),
  S('decor', 'glyph', 'glyphKind', '大字内容', 'Glyph content', [['auto', '自动', 'Auto'], ['letter', '字母', 'Letter'], ['number', '数字', 'Number'], ['cjk', '汉字', 'Hanzi'], ['word', '单词', 'Word']]),
  R('decor', 'glyph', 'glyphSize', '大字尺寸', 'Glyph size', 30, 160, 90, 1, '%'),
  R('decor', 'glyph', 'glyphOpacity', '大字透明度', 'Glyph opacity', 5, 100, 100, 1, '%'),
  R('decor', 'marks', 'ornaments', '图形装饰数量', 'Ornaments', 0, 4, 2),
  R('decor', 'marks', 'ornamentSize', '图形尺寸', 'Ornament size', 50, 200, 100, 1, '%'),
  R('decor', 'marks', 'lineWeight', '线条粗细', 'Line weight', 0.25, 4, 1, 0.25, 'px'),
  R('decor', 'marks', 'nodeSize', '交点尺寸', 'Node size', 0, 10, 3, 0.5, 'px'),
  B('decor', 'marks', 'zoneNumbers', '区域编号', 'Zone numbers', true),
  B('decor', 'marks', 'guides', '辅助线', 'Guides', false),
  B('decor', 'marks', 'dashed', '虚线网格', 'Dashed grid', false),
  R('decor', 'marks', 'curveCount', '曲线数量', 'Curves', 0, 6, 2),
  R('decor', 'marks', 'shapeCount', '几何图形数量', 'Shapes', 0, 6, 1),
  R('decor', 'marks', 'noiseAmount', '杂点数量', 'Noise marks', 0, 100, 30, 1, '%'),
  // ---- more
  B('more', 'quality', 'qualityGate', '质量守门（自动重抽杂乱/重叠）', 'Quality gate (redraw cluttered draws)', true),
  R('more', 'quality', 'qualityMin', '最低版面分', 'Minimum layout score', 40, 95, 78, 1),
  R('more', 'quality', 'qualityTries', '最多重抽次数', 'Max redraws', 0, 8, 5, 1),
  B('more', 'quality', 'collisionFix', '文字避让', 'Text collision avoidance', true),
  S('more', 'plan', 'idea', '创意（先定一个主意）', 'Idea (one per draw)', [['auto', '自动', 'Auto'], ['off', '关闭', 'Off'], ['scale', '尺度冲击', 'Scale shock'], ['substitution', '替换', 'Substitution'], ['occlusion', '遮挡', 'Occlusion'], ['anomaly', '重复与例外', 'Repetition + anomaly'], ['reveal', '揭示', 'Reveal'], ['tension', '边缘张力', 'Tension edge'], ['emptiness', '留白', 'Emptiness'], ['data', '数据成形', 'Data as form'], ['hanzi', '汉字即图', 'Hanzi as image'], ['split', '对立分割', 'Split meaning'], ['orbit', '环绕', 'Orbit'], ['voice', '声音', 'Voice'], ['specimen', '标本', 'Specimen'], ['immersion', '沉浸', 'Immersion'], ['grid', '网格秩序', 'Grid order']]),
  B('more', 'plan', 'planV2', '一图一招（每次抽卡只用一种明确手法）', 'One idea per draw (art direction v2)', true),
  R('more', 'plan', 'typeOnlyShare', '纯排版比例', 'Type-only share', 0, 60, 28, 1, '%'),
  R('more', 'plan', 'monoShare', '单色相配色比例', 'Single-hue palette share', 0, 60, 30, 1, '%'),
  R('more', 'plan', 'clashShare', '撞色比例', 'Clash palette share', 0, 30, 6, 1, '%'),
  R('more', 'plan', 'grainShare', '颗粒纹理比例', 'Grain share', 0, 100, 12, 1, '%'),
  R('more', 'plan', 'scriptShare', '手写字纹理比例', 'Script texture share', 0, 50, 12, 1, '%'),
  B('more', 'direction', 'artDirection', '版面导演（层级/留白/预算）', 'Art direction (hierarchy, whitespace, budgets)', true),
  S('more', 'direction', 'typeRatio', '字号模数比', 'Type scale ratio', [['auto', '自动', 'Auto'], ['1.25', '大三度 1.25', 'Major third 1.25'], ['1.333', '纯四度 1.333', 'Fourth 1.333'], ['1.414', '增四度 1.414', 'Aug. fourth 1.414'], ['1.5', '纯五度 1.5', 'Fifth 1.5'], ['1.618', '黄金比 1.618', 'Golden 1.618']]),
  B('more', 'direction', 'opticalTracking', '视觉字距（大紧小松）', 'Optical tracking (tight display, open labels)', true),
  R('more', 'direction', 'blockBudget', '文字块上限', 'Text block budget', 4, 14, 10, 1), // phase 15: 8 → 10 (restraint compositions stay at 8)
  R('more', 'direction', 'decorBudget', '装饰上限', 'Decoration budget', 0, 6, 3, 1),
  B('more', 'direction', 'busyScrim', '繁忙图像渐变遮罩', 'Gradient scrim on busy image areas', true),
  B('more', 'direction', 'fitOverride', '仍用我的颜色（跳过可读性修正）', 'Keep my colours (skip legibility repair)', false),
  B('more', 'direction', 'snapGrid', '拖动吸附网格', 'Snap drags to grid', true),
  R('more', 'export', 'exportScale', '导出倍率', 'Export scale', 1, 4, 2, 1, 'x'),
  B('more', 'export', 'embedFonts', 'SVG 内嵌字体', 'Embed fonts in SVG', true),
  R('more', 'replay', 'replaySpeed', '回放间隔', 'Replay interval', 200, 3000, 900, 50, 'ms'),
];

/** phase 13: removed in the UI audit (never read by the engine). Old projects / CLI calls that set them are accepted and ignored. */
export const REMOVED_PARAMS = ['whitespace', 'symmetry', 'bigGroups', 'groupGap', 'accentUse', 'sliceCount', 'bandKind'];
/** app / export preferences that live in params for backward compatibility; never reset by a draw, never poster params */
export const SETTINGS_KEYS = ['exportScale', 'embedFonts', 'replaySpeed', 'snapGrid', 'shakeOnDraw', 'fontCount'];
/** read only when a draw is planned: changing them cannot alter the poster on screen, so they always act as pins */
export const DRAW_ONLY = ['typeOnlyShare', 'monoShare', 'clashShare', 'grainShare', 'scriptShare', 'qualityGate', 'qualityMin', 'qualityTries'];
/** these change the plan or the skeleton: the poster is re-laid out (labelled 会重新排版) */
export const RELAYOUT = ['composition', 'gridType', 'density', 'cols', 'rows', 'imageCount', 'idea', 'planV2', 'gridLayout'];
/** adjusting these re-picks only the palette of this poster (layout, copy and pictures stay) */
export const REPICK_PALETTE = ['colorMode', 'paletteSource', 'bgPref', 'soft', 'fitOverride'];
/** adjusting these re-picks only the copy of this poster */
export const REPICK_TEXT = ['englishBias'];

export type Params = Record<string, number | string | boolean>;
export const DEFAULT_PARAMS: Params = Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));
export const num = (p: Params, k: string) => Number(p[k] ?? DEFAULT_PARAMS[k]);
export const str = (p: Params, k: string) => String(p[k] ?? DEFAULT_PARAMS[k]);
export const bool = (p: Params, k: string) => Boolean(p[k] ?? DEFAULT_PARAMS[k]);

export const CARD_LABELS: Record<string, [string, string]> = {
  grid: ['网格与结构', 'Grid & structure'], display: ['网格显示', 'Grid display'], tune: ['画面调色', 'Canvas tune'],
  groups: ['标题组', 'Title groups'], rhythm: ['节奏与呼吸', 'Rhythm'], fonts: ['字体风格', 'Font style'],
  band: ['通栏', 'Band'], sidebar: ['边栏', 'Sidebar'], color: ['色调', 'Color'], image: ['图片', 'Image'], treat: ['图像处理', 'Image treatment'],
  glyph: ['装饰大字', 'Decorative glyph'], marks: ['装饰元素', 'Marks & ornaments'], quality: ['版面质量', 'Layout quality'], direction: ['版面导演', 'Art direction'], plan: ['抽卡方向', 'Draw plan'], export: ['导出', 'Export'], replay: ['录制与播放', 'Record & replay'],
};
export const SECTION_LABELS: Record<Section, [string, string]> = {
  global: ['全局', 'Global'], title: ['标题', 'Title'], band: ['通栏', 'Band'], color: ['色调', 'Color'], image: ['图片', 'Image'], decor: ['装饰', 'Decor'], more: ['更多', 'More'],
};
