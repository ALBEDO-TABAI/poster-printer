// Pluggable copywriting provider. Default: local template generator (offline, deterministic).
// Optional: any OpenAI-compatible chat endpoint configured by the user (key stays in this browser's localStorage).
import { Rng } from '../engine/rng';
import type { CustomText } from '../data/texts';

export interface CopyRequest { topic: string; lang: 'zh' | 'en' | 'mix'; tone: string; seed: string }
export interface CopyProvider { id: string; name: string; write(req: CopyRequest): Promise<CustomText> }
export interface AiSettings { provider: 'local' | 'openai'; endpoint: string; model: string; apiKey: string }
const KEY = 'rea.ai.v1';
export const loadAiSettings = (): AiSettings => ({ provider: 'local', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', apiKey: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') });
export const saveAiSettings = (s: AiSettings) => localStorage.setItem(KEY, JSON.stringify(s));

const ZH = {
  head: ['{t}之夜', '{t}计划', '关于{t}', '{t}研究所', '{t}与日常', '一起{t}', '{t}季', '重新{t}', '{t}现场', '{t}手册'],
  sub: ['在{t}里，慢一点也没关系', '把{t}留给值得的时刻', '一场关于{t}的小型实验', '{t}，从这里开始', '给{t}一点留白'],
  small: ['开幕', '讲座', '工作坊', '放映', '市集', '导览', '夜谈', '展览', '对谈', '分享'],
  note: ['地点待定 · 欢迎来访', '免费入场 · 名额有限', '每周六 14:00', '全年开放', '请提前预约'],
};
const EN = {
  head: ['The {T} Issue', '{T} Season', 'Notes on {T}', 'After {T}', '{T} Club', 'A Study of {T}', 'Slow {T}', '{T} Weekend', 'Inside {T}', 'Field Guide to {T}'],
  sub: ['A small festival of {t}', 'Everything you wanted to know about {t}', 'An evening dedicated to {t}', 'Make room for {t}', 'Where {t} meets the everyday'],
  small: ['Opening', 'Talk', 'Workshop', 'Screening', 'Market', 'Tour', 'Panel', 'Exhibition', 'Listening', 'Archive'],
  note: ['Free entry · All welcome', 'Doors at 7 PM', 'Limited seats', 'Every Saturday', 'Booking advised'],
};
const fill = (s: string, t: string) => s.replace('{t}', t).replace('{T}', t.replace(/\b\w/g, (m) => m.toUpperCase()));

export const localProvider: CopyProvider = {
  id: 'local', name: 'Local templates',
  async write({ topic, lang, seed }) {
    const r = new Rng('copy|' + seed + topic);
    const t = topic.trim() || (lang === 'en' ? 'quiet things' : '安静的事');
    const L = lang === 'en' ? EN : lang === 'zh' ? ZH : r.chance(0.5) ? EN : ZH;
    const year = 2026 + r.int(0, 1);
    const month = r.int(1, 12);
    return {
      headline: fill(r.pick(L.head), t), sub: fill(r.pick(L.sub), t),
      small: r.sample(L.small, 4), note: r.sample(L.note, 2),
      prose: lang === 'en' ? `${fill(r.pick(EN.sub), t)}. ${fill(r.pick(EN.sub), t)}.` : `${fill(r.pick(ZH.sub), t)}。${fill(r.pick(ZH.sub), t)}。`,
      meta: [`${year}.${String(month).padStart(2, '0')}`, `No.${r.int(1, 99).toString().padStart(2, '0')}`, lang === 'en' ? 'Vol. ' + r.int(1, 9) : '第' + '一二三四五六七八九'[r.int(0, 8)] + '期'],
    };
  },
};

export const openaiProvider = (s: AiSettings): CopyProvider => ({
  id: 'openai', name: 'OpenAI-compatible',
  async write({ topic, lang, tone }) {
    const sys = 'You write short poster copy. Reply with JSON only: {"headline":"","sub":"","small":["","","",""],"note":["",""],"prose":"","meta":["","",""]}. Headline ≤ 6 words (or ≤ 8 Chinese characters).';
    const user = `Topic: ${topic}\nLanguage: ${lang === 'mix' ? 'Chinese headline with English supporting lines' : lang}\nTone: ${tone}`;
    const r = await fetch(s.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
      body: JSON.stringify({ model: s.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.9 }),
    });
    if (!r.ok) throw new Error('AI endpoint error ' + r.status);
    const j = await r.json();
    const txt: string = j.choices?.[0]?.message?.content ?? '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI returned no JSON');
    const o = JSON.parse(m[0]);
    return { headline: String(o.headline || ''), sub: String(o.sub || ''), small: (o.small || []).map(String), note: (o.note || []).map(String), prose: String(o.prose || ''), meta: (o.meta || []).map(String) };
  },
});

export async function writeCopy(req: CopyRequest): Promise<{ text: CustomText; provider: string; fallback?: string }> {
  const s = loadAiSettings();
  if (s.provider === 'openai' && s.apiKey) {
    try { return { text: await openaiProvider(s).write(req), provider: 'openai' }; }
    catch (e) { return { text: await localProvider.write(req), provider: 'local', fallback: String(e) }; }
  }
  return { text: await localProvider.write(req), provider: 'local' };
}
