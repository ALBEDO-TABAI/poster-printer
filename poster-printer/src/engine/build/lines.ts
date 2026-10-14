// Phase 18: how a title breaks into lines (findings/titles.md, rule E1–E2; findings/wangzhihong.md B9).
// Han titles of 5–12 characters break into 2 lines: 短长 (p 0.6), 长短 (0.25) or equal (0.15); a break before 的 / 之 /
// 与 / 和 / & within ±1 character of the target is preferred; no line is a single character. 13+ characters (or when
// three lines are asked) put the longest line in the middle (中长短 / 短长中). Latin titles break short-then-long (the
// long line is the one that gets justified) or balanced.
import type { Rng } from '../rng';
import { semanticBreak } from '../p8/typeset';

export type BreakShape = 'one' | 'short-long' | 'long-short' | 'equal' | 'mid-long' | 'balanced';

const han = (s: string) => /[㐀-鿿]/.test(s);

/** common two-character words a line break must not split (the shared phrase breaker assumes words start at even
 *  offsets, so a leading one-character word — 用 / 在 / 把 + noun — throws it off: 用影 | 子丈量季节) */
const WORDS = new Set(`影子 季节 时间 时刻 时候 时光 城市 生活 世界 夜晚 晚上 早晨 清晨 黄昏 记忆 故事 声音 风景 日子 自己 我们 你们
他们 什么 一个 没有 现在 以后 未来 过去 远方 森林 海边 海洋 山谷 山色 天空 星空 月亮 太阳 雨季 夏天 冬天 春天 秋天 季风 风声
雨声 河流 街道 街区 房间 窗户 窗口 门口 屋顶 天台 花园 咖啡 茶叶 早餐 晚餐 午后 周末 假日 节日 展览 展厅 现场 剧场 电影 音乐
声音 书店 图书 文字 设计 排版 海报 摄影 画面 颜色 色彩 光线 阴影 影像 物件 作品 艺术 手工 植物 动物 鸟类 树木 花朵 叶子 石头
城市 乡村 旅行 旅程 路上 远处 附近 地图 边缘 中心 角落 尽头 开始 结束 回家 出发 等待 相遇 告别 安静 温柔 自由 孤独 梦想 希望
心情 情绪 呼吸 身体 眼睛 耳朵 双手 脚步 步行 散步 慢慢 一起 一切 一天 一夜 一年 每天 每日 今天 明天 昨天 今晚 今夜 午夜 凌晨
失眠 观测 观察 记录 笔记 日记 手册 指南 报告 清单 计划 实验 研究 方法 规则 秩序 结构 网格 空间 留白 距离 尺度 比例 节奏 层级
信号 频率 低频 高频 噪音 回声 现场 录音 唱片 乐队 舞台 灯光 夜行 夜里 夜色 月光 星光 晨光 暮色 天气 气候 温度 季候 丈量 测量
寂静 沉默 平静 宁静 喧嚣 热闹 热气 升起 落下 消失 出现 发生 存在 生长 成长 变化 流动 漂流 游戏 玩具 礼物 味道 食物 厨房 餐桌
面包 果酱 牛奶 咖啡 红茶 绿茶 清水 耐心 小事 大事 事情 东西 地方 时代 历史 文化 传统 现代 当代 未来 宇宙 星球 地球 世纪 年代`.split(/\s+/).filter(Boolean));
/** does a break between a and b split a common word? */
const splits = (a: string, b: string) => !!a && !!b && WORDS.has(Array.from(a).slice(-1)[0] + Array.from(b)[0]);
/** move breaks that split a word by one character (the shape check runs after) */
function mendBreaks(L: string[]): string[] {
  const out = L.slice();
  for (let i = 0; i < out.length - 1; i++) {
    if (!splits(out[i], out[i + 1])) continue;
    const a = Array.from(out[i]), b = Array.from(out[i + 1]);
    // pull the next line's first character up (用影 | 子丈量 → 用影子 | 丈量), or push the last one down
    const up = [a.concat(b[0]).join(''), b.slice(1).join('')];
    const down = [a.slice(0, -1).join(''), [a[a.length - 1], ...b].join('')];
    const ok = (p: string[]) => Array.from(p[0]).length >= 2 && Array.from(p[1]).length >= 2 && !splits(p[0], p[1]);
    if (ok(up)) { out[i] = up[0]; out[i + 1] = up[1]; } else if (ok(down)) { out[i] = down[0]; out[i + 1] = down[1]; }
  }
  return out;
}

/** break a title into lines for a shape; null when the shape does not suit the text */
export function breakTitle(s: string, shape: BreakShape): string[] | null {
  const t = s.trim();
  if (shape === 'one' || t.includes('\n')) return t.includes('\n') ? t.split('\n') : [t];
  if (han(t)) {
    // phrase-aware breaking (p8/typeset: closing / opening particles, two-character words, no orphans), then the shape
    const n = Array.from(t.replace(/\s/g, '')).length;
    if (n < 4) return null;
    const len = (x: string) => Array.from(x.replace(/\s/g, '')).length;
    if (shape === 'mid-long') {
      if (n < 7) return null;
      const L0 = semanticBreak(t, { k: 3, profile: 'any' });
      const L = L0 && mendBreaks(L0);
      return L && L.length === 3 && len(L[1]) >= Math.max(len(L[0]), len(L[2])) && L.every((x) => len(x) >= 2) ? L : null;
    }
    const L0 = semanticBreak(t, { k: 2, profile: shape === 'short-long' ? 'ascending' : shape === 'long-short' ? 'descending' : 'balanced' });
    const L = L0 && mendBreaks(L0);
    if (!L || L.length !== 2 || L.some((x) => len(x) < 2)) return null;
    const [a, b] = L.map(len);
    if (shape === 'short-long' && a >= b) return null;
    if (shape === 'long-short' && a <= b) return null;
    if (shape === 'equal' && Math.abs(a - b) > 1) return null;
    return L;
  }
  const words = t.split(/\s+/);
  if (words.length < 2) return null;
  if (shape === 'mid-long') {
    if (words.length < 3) return null;
    const i = Math.max(1, Math.floor(words.length * 0.25)), j = Math.max(i + 1, Math.ceil(words.length * 0.75));
    return [words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')].filter(Boolean);
  }
  if (shape === 'short-long') {
    // the shorter first line (eric / hobsbawm): the first word(s) up to ≤ 45 % of the characters
    let i = 1;
    while (i < words.length - 1 && words.slice(0, i + 1).join(' ').length < t.length * 0.45) i++;
    return [words.slice(0, i).join(' '), words.slice(i).join(' ')];
  }
  if (shape === 'long-short') {
    let i = words.length - 1;
    while (i > 1 && words.slice(i - 1).join(' ').length < t.length * 0.45) i--;
    return [words.slice(0, i).join(' '), words.slice(i).join(' ')];
  }
  // balanced / equal
  let best = 1, bd = Infinity;
  for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/** the type layer picks a break shape the text supports, with the reference shares */
export function pickBreak(r: Rng, s: string, allow: BreakShape[] = ['one', 'short-long', 'long-short', 'equal', 'mid-long']): { shape: BreakShape; lines: string[] } {
  const n = han(s) ? Array.from(s.replace(/\s/g, '')).length : s.split(/\s+/).length;
  const W: Record<BreakShape, number> = han(s)
    ? { one: n <= 4 ? 3 : n <= 6 ? 0.8 : 0.15, 'short-long': n >= 5 ? 0.6 : 0.2, 'long-short': n >= 5 ? 0.25 : 0.1, equal: n >= 4 ? 0.15 : 0, 'mid-long': n >= 13 ? 0.8 : n >= 9 ? 0.2 : 0, balanced: 0 }
    : { one: n <= 2 ? 3 : n <= 3 ? 0.8 : 0.2, 'short-long': n >= 2 ? 0.7 : 0, 'long-short': n >= 3 ? 0.2 : 0, equal: 0, 'mid-long': n >= 5 ? 0.4 : 0, balanced: n >= 2 ? 0.5 : 0 };
  const opts = allow.filter((k) => W[k] > 0);
  for (let i = 0; i < 4 && opts.length; i++) {
    const k = r.weighted(opts.map((o) => [o, W[o]] as [string, number])) as BreakShape;
    const lines = breakTitle(s, k);
    if (lines) return { shape: k, lines };
    opts.splice(opts.indexOf(k), 1);
  }
  return { shape: 'one', lines: [s.trim()] };
}
