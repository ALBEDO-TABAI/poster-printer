import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Card, Chip, Seg, Toggle, Range } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { TEXT_SETS, type CustomText } from '../../data/texts';
import { writeCopy } from '../../lib/ai';
import { newSeed } from '../../engine/rng';

const EMPTY: CustomText = { headline: '', sub: '', small: [], note: [], prose: '', meta: [] };

export function fromPicked(): CustomText {
  const p = useStore.getState().result?.picked.texts;
  if (!p) return EMPTY;
  return { headline: p.headline.t, sub: p.sub.t, small: p.groups.map((g) => g.main.t), note: [p.note.t, ...p.groups.map((g) => g.note.t)].filter(Boolean).slice(0, 3), prose: p.prose.map((x) => x.t).join('\n'), meta: p.meta.map((m) => m.t) };
}

export function TextPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const textSet = useStore((s) => s.textSet);
  const custom = useStore((s) => s.custom);
  const customOn = useStore((s) => s.customOn);
  const saved = useStore((s) => s.savedTexts);
  const locked = useStore((s) => s.locks.text);
  const bias = useStore((s) => Number(s.params.englishBias));
  const s = useStore.getState();
  const [draft, setDraft] = useState<CustomText>(custom ?? EMPTY);
  const [topic, setTopic] = useState('');
  const [aiLang, setAiLang] = useState<'zh' | 'en' | 'mix'>('mix');
  const [tone, setTone] = useState('calm');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (custom) setDraft(custom); }, [custom]);
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const upd = (k: keyof CustomText, v: string) => setDraft({ ...draft, [k]: k === 'small' || k === 'note' || k === 'meta' ? lines(v) : v });

  const ai = async () => {
    setBusy(true);
    const r = await writeCopy({ topic, lang: aiLang, tone, seed: newSeed(6) });
    setBusy(false);
    setDraft(r.text);
    s.setCustom(r.text, true);
    s.toast(r.provider === 'local' ? t('已用本地模板生成文案', 'Copy written by local templates') + (r.fallback ? ' (' + t('AI 接口失败', 'AI endpoint failed') + ')' : '') : t('AI 文案已生成', 'AI copy ready'), r.fallback ? 'warn' : 'ok');
  };

  return (
    <div className="panel-scroll">
      <Card title={t('文字库', 'Text library')}>
        <div className="chips">
          <Chip on={textSet === 'auto'} onClick={() => { s.set('textSet', 'auto'); s.setParam('textSet', ''); }}>{t('全部随机', 'Any')}</Chip>
          {TEXT_SETS.map((x) => <Chip key={x.id} on={textSet === x.id} onClick={() => { s.set('textSet', x.id); s.setParam('textSet', x.id); }}>{lang === 'zh' ? x.zh : x.en}</Chip>)}
        </div>
        <Range label={t('英文倾向', 'English bias')} value={bias} min={0} max={100} unit="%" onChange={(v) => s.setParam('englishBias', v)} />
        <button className={'pill' + (locked ? ' on' : '')} onClick={() => s.toggleLock('text')}><Icon name={locked ? 'lock' : 'unlock'} size={14} />{t('锁定文字', 'Lock text')}</button>
      </Card>
      <Card title={t('AI 文案', 'AI copy')}>
        <input className="inp" placeholder={t('主题，例如：城市夜跑 / 春日茶会', 'Topic, e.g. night running / spring tea')} value={topic} onChange={(e) => setTopic(e.target.value)} />
        <Seg value={aiLang} options={[{ v: 'mix', l: t('中英混排', 'Mixed') }, { v: 'zh', l: '中文' }, { v: 'en', l: 'English' }]} onChange={setAiLang} />
        <Seg value={tone} options={[{ v: 'calm', l: t('安静', 'Calm') }, { v: 'bold', l: t('有力', 'Bold') }, { v: 'poetic', l: t('诗意', 'Poetic') }, { v: 'playful', l: t('俏皮', 'Playful') }]} onChange={setTone} />
        <button className="primary wide" disabled={busy} onClick={ai}><Icon name="sparkle" size={15} />{busy ? '…' : t('生成文案', 'Write copy')}</button>
        <p className="hint">{t('默认使用离线模板；在「更多 → AI 设置」中可接入兼容 OpenAI 的接口。', 'Uses offline templates by default; connect an OpenAI-compatible endpoint in More → AI settings.')}</p>
      </Card>
      <Card title={t('自定义文字', 'Custom text')} right={<Toggle label="" value={customOn} onChange={(v) => s.setCustom(custom ?? draft, v)} />}>
        <div className="row gap"><button className="mini" onClick={() => setDraft(fromPicked())}>{t('载入当前文字', 'Load current')}</button><button className="mini" onClick={() => setDraft(EMPTY)}>{t('清空', 'Clear')}</button></div>
        <label className="field"><span>{t('主标题（可换行）', 'Headline (newline allowed)')}</span><textarea rows={2} value={draft.headline} onChange={(e) => upd('headline', e.target.value)} /></label>
        <label className="field"><span>{t('副标题', 'Subtitle')}</span><input className="inp" value={draft.sub} onChange={(e) => upd('sub', e.target.value)} /></label>
        <label className="field"><span>{t('小标题（每行一个）', 'Small titles (one per line)')}</span><textarea rows={3} value={draft.small.join('\n')} onChange={(e) => upd('small', e.target.value)} /></label>
        <label className="field"><span>{t('说明文字（每行一条）', 'Notes (one per line)')}</span><textarea rows={2} value={draft.note.join('\n')} onChange={(e) => upd('note', e.target.value)} /></label>
        <label className="field"><span>{t('正文段落', 'Prose')}</span><textarea rows={3} value={draft.prose} onChange={(e) => upd('prose', e.target.value)} /></label>
        <label className="field"><span>{t('信息标签（日期/编号…）', 'Meta labels (dates, numbers…)')}</span><textarea rows={2} value={draft.meta.join('\n')} onChange={(e) => upd('meta', e.target.value)} /></label>
        <div className="row gap">
          <button className="primary" onClick={() => s.setCustom(draft, true)}>{t('应用', 'Apply')}</button>
          <button className="mini" onClick={() => { s.setCustom(draft, true); const n = prompt(t('保存名称', 'Name'), draft.headline.slice(0, 16)); if (n) setTimeout(() => s.saveText(n), 0); }}>{t('保存到文字库', 'Save to library')}</button>
        </div>
      </Card>
      {saved.length > 0 && (
        <Card title={t('我的文字', 'My texts')}>
          {saved.map((x) => (
            <div key={x.id} className="list-row" onClick={() => { setDraft(x.text); s.setCustom(x.text, true); }}>
              <b>{x.name}</b><span>{x.text.sub}</span>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); const l = saved.filter((y) => y.id !== x.id); s.set('savedTexts', l); localStorage.setItem('rea.texts.v1', JSON.stringify(l)); }}><Icon name="trash" size={14} /></button>
            </div>
          ))}
        </Card>
      )}
      <div className="panel-foot">{t('双击画布上的文字可直接修改。', 'Double-click any text on the canvas to edit it in place.')}</div>
    </div>
  );
}
