import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Card, Seg, Toggle, Chip } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { wcag, apca } from '../../engine/color/contrast';

export function PaletteSwatches() {
  const t = useT();
  const pal = useStore((s) => s.result?.picked.palette);
  const locks = useStore((s) => s.locks);
  const params = useStore((s) => s.params);
  const pinned = useStore((s) => s.pinnedPalette);
  const baseColor = useStore((s) => s.baseColor);
  const s = useStore.getState();
  if (!pal) return null;
  const roles: [string, string, string][] = [['bg', t('底色', 'Ground'), pal.bg], ['ink', t('主文字', 'Ink'), pal.ink], ['inkSoft', t('次文字', 'Ink soft'), pal.inkSoft], ['accent', t('强调', 'Accent'), pal.accent], ['alt', t('辅色', 'Alt'), pal.alt]];
  const c = wcag(pal.ink, pal.bg), a = Math.abs(apca(pal.ink, pal.bg));
  return (
    <div className="pal-swatches">
      <div className="roles">
        {roles.map(([k, l, hex]) => (
          <div key={k} className="role" title={hex} onClick={() => navigator.clipboard?.writeText(hex)}>
            <i style={{ background: hex }} />
            <span>{l}</span>
            <code>{hex}</code>
          </div>
        ))}
      </div>
      <div className="fills">{pal.fills.map((f, i) => <i key={i} style={{ background: f }} title={f} />)}</div>
      <div className="contrast-row">
        <span>WCAG <b>{c.toFixed(1)}:1</b> <em className={c >= 4.5 ? 'ok' : c >= 3 ? 'mid' : 'bad'}>{c >= 7 ? 'AAA' : c >= 4.5 ? 'AA' : c >= 3 ? 'AA Large' : '—'}</em></span>
        <span>APCA <b>Lc {a.toFixed(0)}</b></span>
      </div>
      {pal.sourceColors?.length > 0 && (
        <div className="src-colors"><span className="mini-label">{t('色源', 'Source')} · {pal.source}</span><div>{pal.sourceColors.map((h, i) => <i key={i} style={{ background: h }} title={h} />)}</div></div>
      )}
      <div className="row gap">
        <button className={'pill' + (locks.color ? ' on' : '')} onClick={() => s.toggleLock('color')}><Icon name={locks.color ? 'lock' : 'unlock'} size={14} />{t('锁定配色', 'Lock colours')}</button>
        {pinned && <button className="pill on" onClick={() => { s.set('pinnedPalette', null); s.regen(false); }}><Icon name="x" size={14} />{t('取消指定色板', 'Unpin palette')}</button>}
      </div>
      <Seg label={t('配色模式', 'Colour mode')} value={String(params.colorMode)} options={[{ v: 'normal', l: t('普通', 'Normal') }, { v: 'random', l: t('随机', 'Random') }, { v: 'experimental', l: t('实验', 'Experimental') }]} onChange={(v) => s.setParam('colorMode', v)} />
      <Toggle label={t('柔和', 'Soft')} value={Boolean(params.soft)} onChange={(v) => s.setParam('soft', v)} />
      {params.paletteSource === 'base' && (
        <label className="ctl"><span className="ctl-label">{t('底色', 'Base colour')}</span><input type="color" value={baseColor} onChange={(e) => { s.set('baseColor', e.target.value); s.regen(false); }} /></label>
      )}
    </div>
  );
}

const FILTERS = {
  light: [['any', '全部', 'Any'], ['dark', '暗', 'Dark'], ['calm', '沉静', 'Calm'], ['bright', '明亮', 'Bright'], ['luminous', '浅亮', 'Luminous']],
  chroma: [['any', '全部', 'Any'], ['soft', '低饱和', 'Soft'], ['mid', '中', 'Mid'], ['rich', '浓郁', 'Rich']],
  contrast: [['any', '全部', 'Any'], ['gentle', '温和', 'Gentle'], ['clear', '清晰', 'Clear'], ['strong', '强烈', 'Strong']],
  tag: [['any', '全部', 'Any'], ['noir', '暗调', 'Noir'], ['muted', '灰调', 'Muted'], ['pastel', '粉彩', 'Pastel'], ['vintage', '复古', 'Vintage'], ['pop', '波普', 'Pop']],
} as const;

export function PalettePanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const palettes = useStore((s) => s.palettes);
  const f = useStore((s) => s.palFilter);
  const pinned = useStore((s) => s.pinnedPalette);
  const s = useStore.getState();
  const [limit, setLimit] = useState(120);
  const list = useMemo(() => palettes.filter((p) => (f.src === 'all' || p.src === f.src) && (f.light === 'any' || p.light === f.light) && (f.chroma === 'any' || p.chroma === f.chroma) && (f.contrast === 'any' || p.contrast === f.contrast) && (f.tag === 'any' || p.tags.includes(f.tag))), [palettes, f]);
  const setF = (k: keyof typeof f, v: string) => { s.set('palFilter', { ...f, [k]: v } as typeof f); setLimit(120); setTimeout(() => s.regen(false), 0); };
  return (
    <div className="panel-scroll">
      <Card title={t('当前色板', 'Current palette')}><PaletteSwatches /></Card>
      <Card title={t('色板库', 'Palette library') + ` · ${list.length}`}>
        <Seg value={f.src} options={[{ v: 'all', l: t('全部', 'All') }, { v: 'wada', l: t('和田配色', 'Wada') }, { v: 'nice', l: 'NICE' }]} onChange={(v) => setF('src', v)} />
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => (
          <div className="filter-row" key={k}>
            <span className="mini-label">{{ light: t('明度', 'Lightness'), chroma: t('彩度', 'Chroma'), contrast: t('对比', 'Contrast'), tag: t('气质', 'Mood') }[k]}</span>
            <div className="chips">{FILTERS[k].map(([v, zh, en]) => <Chip key={v} on={f[k] === v} onClick={() => setF(k, v)}>{lang === 'zh' ? zh : en}</Chip>)}</div>
          </div>
        ))}
        <p className="hint">{t('筛选会约束「和田 / NICE」色源的抽取；点击色板可直接指定。', 'Filters constrain Wada / NICE draws; click a palette to pin it.')}</p>
        <div className="pal-list">
          {list.slice(0, limit).map((p) => {
            const on = pinned && pinned.join() === p.colors.join();
            return (
              <button key={p.id} className={'pal-item' + (on ? ' on' : '')} title={(p.names || []).join(' · ') || p.id} onClick={() => { s.set('pinnedPalette', p.colors); s.regen(false); }}>
                <span className="pal-strip">{p.colors.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                <span className="pal-id">{p.id}</span>
              </button>
            );
          })}
        </div>
        {limit < list.length && <button className="more-btn" onClick={() => setLimit(limit + 200)}>{t('更多', 'More')} ({list.length - limit})</button>}
      </Card>
      <div className="panel-foot">{t('色板数据：Sanzo Wada《配色辞典》数字化（MIT）与 nice-color-palettes（MIT）。', 'Palette data: dictionary-of-colour-combinations (MIT) and nice-color-palettes (MIT).')}</div>
    </div>
  );
}
