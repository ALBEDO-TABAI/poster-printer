import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Card, Seg, Toggle, Chip, Switch } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { wcag, apca } from '../../engine/color/contrast';
import { hexToLch, lchToHex } from '../../engine/color/convert';
import type { Palette, RoleKey } from '../../engine/color/palette';
import { ColorPicker } from '../ColorPicker';
import { useUI, pushUndo } from '../shell/ui';

// phase 19: every colour of the poster can be set by hand. The five roles and the block fills belong to this poster
// (a pin keeps one for future draws); the source colours are the set the roles are drawn from (this poster re-colours
// from them, and so do future draws).
export const PAL_ROLES: [RoleKey, string, string][] = [['bg', '底色', 'Ground'], ['ink', '主文字', 'Ink'], ['inkSoft', '次文字', 'Ink soft'], ['accent', '强调', 'Accent'], ['alt', '辅色', 'Alt']];
export const palTargetName = (k: string, t: (zh: string, en: string) => string) => {
  if (/^s\d$/.test(k)) return t(`色源 ${+k.slice(1) + 1}`, `Source ${+k.slice(1) + 1}`);
  if (/^f\d$/.test(k)) return t(`色块 ${+k.slice(1) + 1}`, `Block ${+k.slice(1) + 1}`);
  const r = PAL_ROLES.find((x) => x[0] === k);
  return r ? t(r[1], r[2]) : k;
};
const RECENT = 'rea.recentColors.v1';
const recentColors = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT) || '[]'); return Array.isArray(v) ? v.slice(0, 12) : []; } catch { return []; } };
const remember = (hex: string) => { try { localStorage.setItem(RECENT, JSON.stringify([hex, ...recentColors().filter((c) => c !== hex)].slice(0, 12))); } catch { /* storage off */ } };
const grade = (c: number) => (c >= 7 ? ['AAA', 'ok'] : c >= 4.5 ? ['AA', 'ok'] : c >= 3 ? ['AA Large', 'mid'] : ['—', 'bad']);
/** the source colours a poster's roles come from right now (a pinned set while it is being edited) */
const sourceNow = (pal: Palette) => (pal.source === 'pinned' && useStore.getState().pinnedPalette) || pal.sourceColors;
const valueOf = (pal: Palette, k: string) => (/^s\d$/.test(k) ? sourceNow(pal)[+k.slice(1)] : /^f\d$/.test(k) ? pal.fills[+k.slice(1)] : pal[k as RoleKey]);

function srcName(source0: string, t: (zh: string, en: string) => string) {
  const source = source0.split('+')[0]; // a committed tone ('image+light') keeps its source
  if (source === 'pinned') return t('指定', 'pinned');
  if (source === 'mono') return t('单色调', 'single hue');
  if (source === 'clash') return t('撞色', 'clash');
  if (source.startsWith('itten')) return t('色彩对比', 'Itten contrast');
  if (source === 'image') return t('图片提取', 'from image');
  if (source === 'base') return t('底色', 'base colour');
  if (source.startsWith('wada')) return t('和田配色', 'Wada');
  if (source.startsWith('nice')) return 'NICE';
  return source;
}

function Quick({ label, colors, onPick }: { label: string; colors: string[]; onPick: (hex: string) => void }) {
  const list = colors.filter((c, i, a) => c && a.indexOf(c) === i);
  if (!list.length) return null;
  return (
    <div className="cq-row"><span className="mini-label">{label}</span>
      <div className="cq">{list.map((c) => <button key={c} className="press" style={{ background: c }} title={c} aria-label={c} onClick={() => onPick(c)} />)}</div></div>
  );
}

function ColorEditor({ k, pal }: { k: string; pal: Palette }) {
  const t = useT();
  const palEdits = useStore((s) => s.palEdits);
  const palPins = useStore((s) => s.palPins);
  const fitOverride = useStore((s) => Boolean(s.params.fitOverride));
  const overrides = useStore((s) => s.result?.scene.info.overrides) as { keys: string[]; kind: string }[] | undefined;
  const imgPal = useStore((s) => { const id = s.result?.picked.imageIds[0]; return id ? [...s.presetImages, ...s.userImages].find((a) => a.id === id)?.palette : undefined; });
  const s = useStore.getState();
  const isSrc = /^s\d$/.test(k), isFill = /^f\d$/.test(k);
  const idx = isSrc || isFill ? +k.slice(1) : -1;
  const value = valueOf(pal, k);
  if (!value) return null;
  const name = palTargetName(k, t);
  const edited = !isSrc && !!palEdits[k as keyof typeof palEdits];
  const pinned = !isSrc && !!palPins[k as keyof typeof palPins];
  const srcWith = (hex: string) => sourceNow(pal).map((c, i) => (i === idx ? hex : c));
  const live = (hex: string) => (isSrc ? void s.setSourceColors(srcWith(hex), true) : s.setPalEdits({ [k]: hex }, true));
  const commit = (hex: string) => { remember(hex); if (isSrc) void s.setSourceColors(srcWith(hex)); else s.setPalEdits({ [k]: hex }); };
  const start = () => pushUndo(t('改颜色 · ', 'Colour · ') + name);
  const pickQuick = (hex: string) => { start(); commit(hex); };
  const reset = () => { pushUndo(t('还原 ', 'Reset ') + name); s.setPalEdits({ [k]: '' }); };
  const pin = () => { pushUndo((pinned ? t('解除锁定 ', 'Unpin ') : t('锁定 ', 'Pin ')) + name); s.togglePalPin(k as keyof typeof palPins); s.toast(pinned ? t(`之后的抽卡不再固定${name}`, `${name} is no longer kept`) : t(`之后的抽卡都用这个${name}`, `Future draws keep this ${name.toLowerCase()}`), 'ok', 'palpin'); };
  const remove = () => { pushUndo(t('删除 ', 'Remove ') + name); useUI.setState({ palSel: null }); void s.setSourceColors(sourceNow(pal).filter((_, i) => i !== idx)); };
  const keepMine = (on: boolean) => { pushUndo(t('仍用我的颜色', 'Keep my colours')); useStore.setState((st) => ({ params: { ...st.params, fitOverride: on }, dirty: true })); void useStore.getState().regen(false); };
  // contrast that matters for this colour
  const pairs: [string, number][] = k === 'bg' ? [[t('主文字在上面', 'Ink on it'), wcag(pal.ink, value)], [t('强调色在上面', 'Accent on it'), wcag(pal.accent, value)]]
    : k === 'ink' || k === 'inkSoft' ? [[t('在底色上', 'On the ground'), wcag(value, pal.bg)]]
      : [[t('与底色', 'Against the ground'), wcag(value, pal.bg)]];
  const textRole = k === 'bg' || k === 'ink' || k === 'inkSoft';
  const low = textRole && wcag(pal.ink, pal.bg) < 3;
  // the layouts set text that would not read in a readable stand-in (the palette's dark / light): name it, offer it
  const standIn = [pal.dark, pal.light, '#111111', '#f7f5f0'].reduce((a, c) => (wcag(c, pal.bg) > wcag(a, pal.bg) ? c : a), pal.dark);
  const useStandIn = () => { pushUndo(t('改颜色 · ', 'Colour · ') + palTargetName('ink', t)); s.setPalEdits({ ink: standIn }); };
  // the final legibility pass changed (or, with "keep my colours", left) text in the user's own colours
  const ov = overrides?.find((o) => o.keys.includes('palette'));
  return (
    <div className="ced" data-target={k}>
      <div className="ced-head">
        <i className="ced-sw" style={{ background: value }} />
        <b>{name}</b>
        {edited && <span className="ced-tag">{t('已自定义', 'Custom')}</span>}
        <span className="grow" />
        {!isSrc && <button className={'icon-btn press' + (pinned ? ' on' : '')} data-act="palpin" title={pinned ? t('解除锁定（之后的抽卡不再沿用）', 'Unpin (future draws stop using it)') : t('锁定到之后的抽卡', 'Pin for future draws')} onClick={pin}><Icon name="pin" size={15} /></button>}
        {edited && <button className="icon-btn press" data-act="reset" title={t('还原为抽到的颜色', 'Back to the drawn colour')} onClick={reset}><Icon name="rotate-ccw" size={15} /></button>}
        {isSrc && sourceNow(pal).length > 1 && <button className="icon-btn press" data-act="remove" title={t('删除这个色源', 'Remove this source colour')} onClick={remove}><Icon name="trash-2" size={15} /></button>}
        <button className="icon-btn press" title={t('收起', 'Close')} onClick={() => useUI.setState({ palSel: null })}><Icon name="x" size={15} /></button>
      </div>
      <ColorPicker value={value} onInput={live} onCommit={commit} onStart={start} />
      <div className="cq-wrap">
        <Quick label={t('色源', 'Source')} colors={sourceNow(pal)} onPick={pickQuick} />
        {imgPal && <Quick label={t('图片', 'Photo')} colors={imgPal} onPick={pickQuick} />}
        {!isSrc && <Quick label={t('本张', 'Poster')} colors={[pal.bg, pal.ink, pal.accent, pal.alt, ...pal.fills].filter((c) => c !== value)} onPick={pickQuick} />}
        <Quick label={t('最近', 'Recent')} colors={recentColors()} onPick={pickQuick} />
      </div>
      <div className="contrast-row">{pairs.map(([l, c]) => { const [g, cls] = grade(c); return <span key={l}>{l} <b>{c.toFixed(1)}:1</b> <em className={cls}>{g}</em></span>; })}
        {k === 'ink' && <span>APCA <b>Lc {Math.abs(apca(value, pal.bg)).toFixed(0)}</b></span>}</div>
      {isSrc && <p className="hint">{t('色源用来自动分配底色、文字和强调色。改动会让这张海报按新色源重新配色，之后的抽卡也沿用这组颜色。', 'Source colours are what the ground, text and accent are drawn from. A change re-colours this poster from them, and future draws use the same set.')}</p>}
      {low && (
        <div className="ced-warn" data-note="low">
          <Icon name="info" size={13} />
          <span>{t('主文字和底色太接近，读不清。为了能读，海报上的文字会先用', 'Ink and ground are too close to read. To keep the text readable, the poster sets it in')} <i className="ced-dot" style={{ background: standIn }} /> <code>{standIn}</code>{t('显示。', ' for now.')}</span>
          <button className="mini press" data-act="stand-in" onClick={useStandIn}>{t('就用它作主文字', 'Make it the ink')}</button>
        </div>
      )}
      {ov && !low && (
        <div className={'ced-warn' + (fitOverride ? ' kept' : '')} data-note={ov.kind}>
          <Icon name="info" size={13} />
          <span>{fitOverride ? t('已按你的颜色保留，部分文字可能看不清。', 'Kept as you chose — some text may be hard to read.') : t('有几处文字落在照片或色块上读不清，已自动换色。', 'A few lines over a photo or a block could not be read and were re-coloured.')}</span>
          <label className="ced-keep"><span>{t('仍用我的颜色', 'Keep my colours')}</span><Switch on={fitOverride} label="keep" onChange={keepMine} /></label>
        </div>
      )}
    </div>
  );
}

export function PaletteSwatches() {
  const t = useT();
  const pal = useStore((s) => s.result?.picked.palette);
  const palEdits = useStore((s) => s.palEdits);
  const palPins = useStore((s) => s.palPins);
  const locks = useStore((s) => s.locks);
  const params = useStore((s) => s.params);
  const pinned = useStore((s) => s.pinnedPalette);
  const baseColor = useStore((s) => s.baseColor);
  const sel = useUI((u) => u.palSel);
  const s = useStore.getState();
  if (!pal) return null;
  const c = wcag(pal.ink, pal.bg), a = Math.abs(apca(pal.ink, pal.bg));
  const pick = (k: string) => useUI.setState({ palSel: sel === k ? null : k });
  const edited = Object.keys(palEdits).length > 0;
  const src = sourceNow(pal);
  const swap = () => { pushUndo(t('明暗互换', 'Swap ground / ink')); s.setPalEdits({ bg: pal.ink, ink: pal.bg, inkSoft: '' }); };
  const resetAll = () => { pushUndo(t('还原全部颜色', 'Reset all colours')); s.setPalEdits(null); useUI.setState({ palSel: null }); };
  const save = () => { const mp = s.savePalette(); if (mp) s.toast(t(`已存入我的配色 · ${mp.name}`, `Saved to My palettes · ${mp.name}`)); };
  const addSource = () => {
    // a new source colour starts opposite the accent (a complementary hit), then the user tunes it
    const [, , H] = hexToLch(pal.accent);
    const next = lchToHex(62, 48, (H + 180) % 360);
    pushUndo(t('添加色源', 'Add source colour'));
    useUI.setState({ palSel: 's' + src.length });
    void s.setSourceColors([...src, next]);
  };
  const sel0 = sel && valueOf(pal, sel) ? sel : null;
  return (
    <div className="pal-swatches">
      <div className="roles">
        {PAL_ROLES.map(([k, zh, en]) => (
          <button key={k} className={'role press' + (sel0 === k ? ' psel' : '') + (palEdits[k] ? ' ed' : '')} data-role={k} aria-pressed={sel0 === k}
            title={t('点按修改', 'Click to edit') + ' · ' + pal[k]} onClick={() => pick(k)}>
            <i style={{ background: pal[k] }}>{palPins[k] && <Icon name="pin" size={11} />}</i>
            <span>{t(zh, en)}{palEdits[k] && <em className="dot" aria-label={t('已自定义', 'custom')} />}</span>
            <code>{pal[k]}</code>
          </button>
        ))}
      </div>
      <div className="fills-row">
        <span className="mini-label">{t('色块', 'Blocks')}</span>
        <div className="fills">{pal.fills.map((f, i) => {
          const k = `f${i}` as const;
          return <button key={i} className={'press' + (sel0 === k ? ' psel' : '') + (palEdits[k] ? ' ed' : '')} data-fill={i} style={{ background: f }} title={t('点按修改 · ', 'Click to edit · ') + f} aria-label={palTargetName(k, t)} onClick={() => pick(k)}>{palPins[k] && <Icon name="pin" size={10} />}</button>;
        })}</div>
      </div>
      {sel0 ? <ColorEditor k={sel0} pal={pal} /> : <p className="hint pal-tip">{t('点任意一个颜色就能改，海报会实时跟着变。', 'Click any colour to change it; the poster follows live.')}</p>}
      <div className="contrast-row">
        <span>WCAG <b>{c.toFixed(1)}:1</b> <em className={grade(c)[1]}>{grade(c)[0]}</em></span>
        <span>APCA <b>Lc {a.toFixed(0)}</b></span>
      </div>
      <div className="pal-acts">
        <button className="mini press" data-act="swap" onClick={swap}><Icon name="arrow-left-right" size={13} />{t('明暗互换', 'Swap ground / ink')}</button>
        {edited && <button className="mini press" data-act="reset-all" onClick={resetAll}><Icon name="rotate-ccw" size={13} />{t('还原全部', 'Reset all')}</button>}
        <button className="mini press" data-act="save" onClick={save}><Icon name="bookmark" size={13} />{t('保存配色', 'Save palette')}</button>
      </div>
      <div className="src-colors">
        <span className="mini-label">{t('色源', 'Source')} · {srcName(pal.source, t)}</span>
        <div className="src-chips">
          {src.map((h, i) => <button key={i} className={'press' + (sel0 === `s${i}` ? ' psel' : '')} data-src={i} style={{ background: h }} title={t('点按修改 · ', 'Click to edit · ') + h} aria-label={palTargetName(`s${i}`, t)} onClick={() => pick(`s${i}`)} />)}
          {src.length < 6 && <button className="src-add press" data-act="add-src" title={t('加一个自己的颜色', 'Add your own colour')} onClick={addSource}><Icon name="plus" size={13} /></button>}
        </div>
      </div>
      <div className="row gap">
        <button className={'pill' + (locks.color ? ' on' : '')} onClick={() => s.toggleLock('color')}><Icon name={locks.color ? 'lock' : 'unlock'} size={14} />{t('锁定配色', 'Lock colours')}</button>
        {pinned && <button className="pill on" data-act="unpin-src" onClick={() => { pushUndo(t('取消指定色板', 'Unpin palette')); void s.setSourceColors(null, false, true); }}><Icon name="x" size={14} />{t('取消指定色板', 'Unpin palette')}</button>}
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
  const mine = useStore((s) => s.myPalettes);
  const f = useStore((s) => s.palFilter);
  const pinned = useStore((s) => s.pinnedPalette);
  const s = useStore.getState();
  const [limit, setLimit] = useState(120);
  const list = useMemo(() => palettes.filter((p) => (f.src === 'all' || p.src === f.src) && (f.light === 'any' || p.light === f.light) && (f.chroma === 'any' || p.chroma === f.chroma) && (f.contrast === 'any' || p.contrast === f.contrast) && (f.tag === 'any' || p.tags.includes(f.tag))), [palettes, f]);
  const setF = (k: keyof typeof f, v: string) => { s.set('palFilter', { ...f, [k]: v } as typeof f); setLimit(120); };
  const pin = (colors: string[]) => { pushUndo(t('指定色板', 'Pin palette')); useUI.setState({ palSel: null }); void s.setSourceColors(colors, false, true); };
  return (
    <div className="panel-scroll">
      <Card title={t('当前色板', 'Current palette')}><PaletteSwatches /></Card>
      <Card title={t('我的配色', 'My palettes') + (mine.length ? ` · ${mine.length}` : '')}>
        {mine.length ? (
          <div className="pal-list">
            {mine.map((p) => (
              <div key={p.id} className="pal-mine">
                <button className="pal-item press" data-mine={p.id} title={t('用在这张海报上', 'Use on this poster')} onClick={() => { pushUndo(t('我的配色', 'My palette')); useUI.setState({ palSel: null }); void s.applyPalette(p); }}>
                  <span className="pal-strip">{[p.roles.bg, p.roles.ink, p.roles.accent, p.roles.alt, ...p.colors].filter((c, i, a) => c && a.indexOf(c) === i).slice(0, 6).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                  <span className="pal-id">{p.name}</span>
                </button>
                <button className="pal-del press" title={t('删除', 'Delete')} aria-label={t('删除', 'Delete')} onClick={() => s.deletePalette(p.id)}><Icon name="x" size={11} /></button>
              </div>
            ))}
          </div>
        ) : <p className="hint">{t('调出喜欢的颜色后，点上面的「保存配色」，就能在这里一键再用。', 'Found colours you like? Press Save palette above to keep them here for one-click reuse.')}</p>}
      </Card>
      <Card title={t('色板库', 'Palette library') + ` · ${list.length}`}>
        <Seg value={f.src} options={[{ v: 'all', l: t('全部', 'All') }, { v: 'wada', l: t('和田配色', 'Wada') }, { v: 'nice', l: 'NICE' }]} onChange={(v) => setF('src', v)} />
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => (
          <div className="filter-row" key={k}>
            <span className="mini-label">{{ light: t('明度', 'Lightness'), chroma: t('彩度', 'Chroma'), contrast: t('对比', 'Contrast'), tag: t('气质', 'Mood') }[k]}</span>
            <div className="chips">{FILTERS[k].map(([v, zh, en]) => <Chip key={v} on={f[k] === v} onClick={() => setF(k, v)}>{lang === 'zh' ? zh : en}</Chip>)}</div>
          </div>
        ))}
        <p className="hint">{t('筛选会约束之后抽卡时「和田 / NICE」色源的抽取；点击色板会用在这张海报上，之后的抽卡也沿用。', 'Filters constrain later Wada / NICE draws; click a palette to use it on this poster and keep it for future draws.')}</p>
        <div className="pal-list">
          {list.slice(0, limit).map((p) => {
            const on = pinned && pinned.join() === p.colors.join();
            return (
              <button key={p.id} className={'pal-item' + (on ? ' on' : '')} title={(p.names || []).join(' · ') || p.id} onClick={() => pin(p.colors)}>
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
