import { useStore } from '../../store';
import { PARAMS, SECTIONS, SECTION_LABELS, CARD_LABELS, type Section } from '../../engine/params';
import { LAYERS, MODES, type LayerKey, type ModeKey } from '../../engine/types';
import { Card, ParamControl, Chip } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { APP_SHORT, APP_SLOGAN } from '../../config';
import { PaletteSwatches } from './PalettePanel';

export const LAYER_LABELS: Record<LayerKey, [string, string]> = {
  bg: ['底色', 'Ground'], zones: ['分区', 'Zones'], lines: ['线条', 'Lines'], curves: ['曲线', 'Curves'], noise: ['杂点', 'Specks'], texture: ['纹理', 'Texture'],
  text: ['文本', 'Text'], ornament: ['装饰', 'Ornament'], shapes: ['图形', 'Shapes'], images: ['图片', 'Images'], sidebar: ['边栏', 'Sidebar'], band: ['通栏', 'Band'],
};
export const MODE_LABELS: Record<ModeKey, [string, string, string, string]> = {
  experimental: ['实验', 'Experimental', '大胆跳跃的配色与构图', 'Bold colour leaps & compositions'],
  card: ['卡片', 'Cards', '巨字与圆角卡片', 'Giant type with rounded cards'],
  clash: ['撞色', 'Clash', '高对比色块分区', 'High-contrast colour partitions'],
  random: ['随机', 'Random', '切片拼贴与随机配色', 'Sliced collage, random colour'],
  layered: ['分层', 'Layered', '主体抠图压在标题之上', 'Cut-out subject over the headline'],
  nice: ['NICE', 'NICE', '使用 nice-color-palettes 色库', 'Use the nice-color-palettes library'],
  wada: ['和田', 'Wada', '使用和田三造配色辞典', "Use Sanzo Wada's colour dictionary"],
  brushImage: ['笔刷图', 'Brush img', '笔刷形状裁切图片', 'Brush-shaped image crops'],
  brushMask: ['笔刷蒙', 'Brush mask', '色层上刷出图片', 'Brush strokes reveal the image'],
  bandMask: ['通栏蒙', 'Band mask', '横向通栏蒙版', 'Horizontal band masks'],
};

export function StyleLibrary() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const styles = useStore((s) => s.styles);
  const styleId = useStore((s) => s.styleId);
  const tab = useStore((s) => s.styleTab);
  const dirty = useStore((s) => s.dirty);
  const s = useStore.getState();
  const list = styles.filter((x) => (tab === 'mine' ? !x.builtIn : x.builtIn && x.lib === tab));
  return (
    <div className="style-lib">
      <div className="style-tabs">
        {(['zh', 'en', 'mine'] as const).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => s.set('styleTab', k)}>{k === 'zh' ? t('中文风格', 'CJK styles') : k === 'en' ? t('英文风格', 'Latin styles') : t('我的', 'Mine')}</button>
        ))}
        <span className="grow" />
        {dirty && <button className="mini" onClick={() => s.updateStyle()} title={t('保存当前调整到风格', 'Save tweaks to style')}>{t('更新风格', 'Update')}</button>}
        <button className="mini" onClick={() => { const n = prompt(t('风格名称', 'Style name'), (styles.find((x) => x.id === styleId)?.name[lang] ?? '') + ' 2'); if (n) s.saveStyleAs(n); }}>{t('另存', 'Save as')}</button>
      </div>
      <div className="style-chips">
        {list.length === 0 && <div className="empty">{t('还没有自定义风格。调整后点「另存」。', 'No custom styles yet — tweak and “Save as”.')}</div>}
        {list.map((x) => (
          <Chip key={x.id} on={x.id === styleId} onClick={() => s.pickStyle(x.id)}>{x.name[lang]}{x.id === styleId && dirty ? ' *' : ''}</Chip>
        ))}
      </div>
    </div>
  );
}

export function DrawBlock() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const hIndex = useStore((s) => s.hIndex);
  const hLen = useStore((s) => s.history.length);
  const s = useStore.getState();
  return (
    <div className="draw-block">
      <button className="draw-btn" onClick={() => s.draw()} title={t('空格键', 'Space')}>
        <span className="draw-mark">{APP_SHORT}</span>
        <span className="draw-sub">{t('抽一张', 'Draw')}</span>
      </button>
      <div className="slogan-row">
        <button className="icon-btn" disabled={hIndex <= 0} onClick={() => s.go(-1)} title={t('上一张', 'Previous')}><Icon name="left" /></button>
        <span className="slogan">{APP_SLOGAN[lang]}<em>{hLen ? `${hIndex + 1}/${hLen}` : ''}</em></span>
        <button className="icon-btn" disabled={hIndex >= hLen - 1} onClick={() => s.go(1)} title={t('下一张', 'Next')}><Icon name="right" /></button>
      </div>
      <div className="variants">
        {([['text', '换文字', 'Text'], ['decor', '换图形', 'Graphics'], ['color', '换色调', 'Colour'], ['image', '换图片', 'Image'], ['tendency', '换风格', 'Style'], ['structure', '换结构', 'Structure']] as const).map(([k, zh, en]) => (
          <button key={k} onClick={() => s.variant(k)}>{t(zh, en)}</button>
        ))}
      </div>
    </div>
  );
}

export function ModuleToggles() {
  const t = useT();
  const modules = useStore((s) => s.modules);
  const modes = useStore((s) => s.modes);
  const lang = useStore((s) => s.lang);
  const s = useStore.getState();
  return (
    <div className="modules">
      <div className="mod-grid">
        {LAYERS.map((k) => (
          <button key={k} className={'mod' + (modules[k] ? ' on' : '')} onClick={() => s.toggleModule(k)}>{LAYER_LABELS[k][lang === 'zh' ? 0 : 1]}</button>
        ))}
      </div>
      <div className="mode-row">
        <span className="mini-label">{t('模式', 'Modes')}</span>
        {MODES.map((k) => (
          <Chip key={k} on={modes.includes(k)} onClick={() => s.toggleMode(k)} title={MODE_LABELS[k][lang === 'zh' ? 2 : 3]}>{MODE_LABELS[k][lang === 'zh' ? 0 : 1]}</Chip>
        ))}
      </div>
    </div>
  );
}

export function ParamsPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const section = useStore((s) => s.section) as Section;
  const s = useStore.getState();
  const defs = PARAMS.filter((p) => p.section === section);
  const cards = [...new Set(defs.map((d) => d.card))];
  return (
    <div className="panel-scroll">
      <StyleLibrary />
      <DrawBlock />
      <ModuleToggles />
      <nav className="sec-nav">
        {SECTIONS.map((k) => (
          <button key={k} className={k === section ? 'on' : ''} onClick={() => s.set('section', k)}>{SECTION_LABELS[k][lang === 'zh' ? 0 : 1]}</button>
        ))}
      </nav>
      {section === 'color' && (
        <Card title={t('当前色板', 'Current palette')}>
          <PaletteSwatches />
        </Card>
      )}
      {cards.map((c) => (
        <Card key={section + c} title={CARD_LABELS[c]?.[lang === 'zh' ? 0 : 1] ?? c}>
          {defs.filter((d) => d.card === c).map((d) => <ParamControl key={d.key} def={d} />)}
        </Card>
      ))}
      <div className="panel-foot">{t('参数改动即时重排，种子不变；双击滑杆复位。', 'Changes re-layout instantly with the same seed; double-click a slider to reset.')}</div>
    </div>
  );
}
