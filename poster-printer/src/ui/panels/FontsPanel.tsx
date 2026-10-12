import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Card, Seg, Toggle, Range, Chip } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { fontList, ensureFont, type FontEntry } from '../../lib/fonts';
import type { Lang, RoleKey, RoleFont } from '../../engine/typo';

const GROUPS: [string, string, string][] = [
  ['swiss-sans', '瑞士无衬线', 'Swiss sans'], ['geometric-sans', '几何无衬线', 'Geometric sans'], ['condensed-display', '窄体展示', 'Condensed display'],
  ['classic-serif', '经典衬线', 'Classic serif'], ['display-serif', '展示衬线', 'Display serif'], ['monospace', '等宽', 'Monospace'],
  ['script', '手写', 'Script'], ['experimental', '实验', 'Experimental'], ['cjk', '中文', 'CJK'],
];

function FontPreview({ f, onPick, on }: { f: FontEntry; onPick: () => void; on: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { ensureFont(f.family).then(() => setOk(true)); io.disconnect(); } });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [f.family]);
  return (
    <button ref={ref} className={'font-item' + (on ? ' on' : '')} onClick={onPick} title={`${f.family} · ${f.license}`}>
      <span className="font-sample" style={{ fontFamily: ok ? `"${f.family}"` : 'inherit', fontWeight: Math.min(f.wmax, Math.max(f.wmin, 500)) }}>{f.cjk ? '永字八法 Ag' : 'Aa Gg Rr 26'}</span>
      <span className="font-name">{f.family}</span>
    </button>
  );
}

export function RoleEditor({ lang, role }: { lang: Lang; role: RoleKey }) {
  const t = useT();
  const rf = useStore((s) => s.fonts[lang][role]);
  const s = useStore.getState();
  const fams = fontList().filter((f) => (lang === 'zh' ? f.cjk || f.group === 'script' : !f.cjk));
  const ent = fontList().find((f) => f.family === rf.family);
  const set = (p: Partial<RoleFont>) => s.setRole(lang, role, p);
  const roleName: Record<string, string> = { main: t('主', 'Main'), sub: t('副', 'Sub'), note: t('说明', 'Caption') };
  return (
    <div className="role-ed">
      <div className="role-head"><b>{roleName[role.split('.')[1]]}</b>
        <select value={rf.family} onChange={async (e) => { await ensureFont(e.target.value); const en = fontList().find((f) => f.family === e.target.value); set({ family: e.target.value, weight: en ? Math.min(en.wmax, Math.max(en.wmin, rf.weight)) : rf.weight }); }}>
          {GROUPS.map(([g, zh, en]) => {
            const l = fams.filter((f) => f.group === g);
            return l.length ? <optgroup key={g} label={t(zh, en)}>{l.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}</optgroup> : null;
          })}
        </select>
      </div>
      {ent && ent.wmax > ent.wmin && <Range label={t('字重', 'Weight')} value={rf.weight} min={ent.wmin} max={ent.wmax} step={ent.variable ? 10 : 100} onChange={(v) => set({ weight: v })} />}
      <Range label={t('字号', 'Size')} value={rf.size} min={40} max={180} unit="%" def={100} onChange={(v) => set({ size: v })} />
      <Range label={t('字距', 'Tracking')} value={rf.tracking * 1000} min={-80} max={300} step={5} def={0} onChange={(v) => set({ tracking: v / 1000 })} />
      <Range label={t('行距', 'Leading')} value={rf.leading} min={0.75} max={2.2} step={0.01} onChange={(v) => set({ leading: v })} />
      {lang === 'en' && <Seg value={rf.case ?? 'none'} options={[{ v: 'none', l: 'Aa' }, { v: 'upper', l: 'AA' }, { v: 'title', l: 'Title' }, { v: 'lower', l: 'aa' }]} onChange={(v) => set({ case: v })} />}
      {ent?.files.some((f) => f.style === 'italic') && <Toggle label={t('斜体', 'Italic')} value={!!rf.italic} onChange={(v) => set({ italic: v })} />}
    </div>
  );
}

export function FontsPanel() {
  const t = useT();
  const fontCount = useStore((s) => s.fontCount);
  const shakeOnDraw = useStore((s) => Boolean(s.params.shakeOnDraw));
  const fonts = useStore((s) => s.fonts);
  const s = useStore.getState();
  const [lang, setLang] = useState<Lang>('en');
  const [grp, setGrp] = useState<'big' | 'small'>('big');
  const [libGroup, setLibGroup] = useState('swiss-sans');
  const [target, setTarget] = useState<RoleKey>('big.main');
  const lib = fontList().filter((f) => f.group === libGroup);
  return (
    <div className="panel-scroll">
      <Card title={t('摇字体', 'Shake fonts')}>
        <Seg label={t('字体数量', 'Font count')} value={String(fontCount)} options={[{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }]} onChange={(v) => s.set('fontCount', Number(v))} />
        <Toggle label={t('每次抽卡时换字体', 'New fonts on every draw')} value={shakeOnDraw} onChange={(v) => s.setParam('shakeOnDraw', v)} />
        <button className="primary wide" onClick={() => s.shake()}><Icon name="shuffle" size={15} />{t('摇一组搭配', 'Shake a pairing')}</button>
        <div className="font-summary">
          {(['big.main', 'big.sub', 'big.note'] as RoleKey[]).map((r) => <span key={r} style={{ fontFamily: `"${fonts.en[r].family}"`, fontWeight: fonts.en[r].weight }}>{fonts.en[r].family}</span>)}
          <span style={{ fontFamily: `"${fonts.zh['big.main'].family}"`, fontWeight: fonts.zh['big.main'].weight }}>{fonts.zh['big.main'].family}</span>
        </div>
      </Card>
      <Card title={t('字体角色', 'Type roles')}>
        <div className="row gap">
          <Seg value={lang} options={[{ v: 'en', l: t('英文', 'Latin') }, { v: 'zh', l: t('中文', 'CJK') }]} onChange={setLang} />
          <Seg value={grp} options={[{ v: 'big', l: t('大标题组', 'Large group') }, { v: 'small', l: t('小标题组', 'Small group') }]} onChange={setGrp} />
        </div>
        {(['main', 'sub', 'note'] as const).map((r) => <RoleEditor key={lang + grp + r} lang={lang} role={`${grp}.${r}` as RoleKey} />)}
        <button className="mini" onClick={() => s.copyBigToSmall(lang)}><Icon name="copy" size={13} />{t('大标题组 → 小标题组', 'Copy large → small')}</button>
      </Card>
      <Card title={t('字体库', 'Font library') + ` · ${fontList().length}`} open={false}>
        <div className="chips">{GROUPS.map(([g, zh, en]) => <Chip key={g} on={g === libGroup} onClick={() => setLibGroup(g)}>{t(zh, en)}</Chip>)}</div>
        <Seg label={t('点击应用到', 'Apply to')} value={target} options={[{ v: 'big.main', l: t('大·主', 'L·main') }, { v: 'big.sub', l: t('大·副', 'L·sub') }, { v: 'big.note', l: t('大·说明', 'L·cap') }, { v: 'small.main', l: t('小·主', 'S·main') }, { v: 'small.sub', l: t('小·副', 'S·sub') }]} onChange={setTarget} />
        <div className="font-grid">
          {lib.map((f) => <FontPreview key={f.family} f={f} on={fonts[f.cjk ? 'zh' : 'en'][target].family === f.family} onPick={async () => { await ensureFont(f.family); s.setRole(f.cjk ? 'zh' : 'en', target, { family: f.family, weight: Math.min(f.wmax, Math.max(f.wmin, fonts[f.cjk ? 'zh' : 'en'][target].weight)) }); }} />)}
        </div>
      </Card>
      <div className="panel-foot">{t('所有字体均为开源授权（SIL OFL / Apache 2.0），已子集化。商用前请自行核实各字体许可。', 'All fonts are open-source (SIL OFL / Apache 2.0), subset for the web. Verify each licence before commercial use.')}</div>
    </div>
  );
}
