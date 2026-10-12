import { useRef, useState } from 'react';
import { useStore, entryScene, type Entry } from '../../store';
import { Card, Seg, Toggle, Range } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { exportSVG, rasterize, download } from '../../lib/exporter';
import { sessionJson, parseSession, recordWebM } from '../../lib/session';
import { loadAiSettings, saveAiSettings, type AiSettings } from '../../lib/ai';
import { APP_NAME, APP_SLUG, APP_VERSION } from '../../config';
import type { Style } from '../../data/styles';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export async function doExport(kind: 'png' | 'svg' | 'jpg', scale = 2) {
  const s = useStore.getState();
  if (!s.scene) return;
  const name = `poster-printer-${s.seeds.layout.slice(0, 6)}-${s.ratio.replace(':', 'x')}-${stamp()}`;
  if (kind === 'svg') download(await exportSVG(s.scene, Boolean(s.params.embedFonts)), name + '.svg');
  else download(await rasterize(s.scene, scale, kind === 'png' ? 'image/png' : 'image/jpeg'), `${name}@${scale}x.${kind}`);
  s.toast(s.lang === 'zh' ? '已导出' : 'Exported');
}

export function MorePanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const params = useStore((s) => s.params);
  const result = useStore((s) => s.result);
  const seeds = useStore((s) => s.seeds);
  const recording = useStore((s) => s.recording);
  const recorded = useStore((s) => s.recorded);
  const replaying = useStore((s) => s.replaying);
  const styles = useStore((s) => s.styles);
  const history = useStore((s) => s.history);
  const images = useStore((s) => s.presetImages);
  const userImages = useStore((s) => s.userImages);
  const fonts = useStore((s) => s.fonts);
  const s = useStore.getState();
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState('');
  const [ai, setAi] = useState<AiSettings>(loadAiSettings());
  const [seedIn, setSeedIn] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const styleRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);

  const replay = async (list: Entry[]) => {
    if (!list.length) return;
    stopRef.current = false;
    s.set('replaying', true);
    const keep = useStore.getState().scene;
    for (const e of list) {
      if (stopRef.current) break;
      const sc = entryScene(e);
      if (sc) useStore.setState({ scene: sc });
      await new Promise((r) => setTimeout(r, Number(useStore.getState().params.replaySpeed)));
    }
    useStore.setState({ scene: keep, replaying: false });
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const list = parseSession(await f.text());
      useStore.setState({ recorded: list });
      s.toast(t(`载入 ${list.length} 条记录`, `Loaded ${list.length} entries`));
      if (list.length === 1) s.restore(list[0], true);
    } catch (e) { s.toast(String(e), 'warn'); }
  };
  const used = (result?.picked.imageIds ?? []).map((id) => [...images, ...userImages].find((a) => a.id === id)).filter(Boolean);
  const cur = history[useStore.getState().hIndex];

  return (
    <div className="panel-scroll">
      <Card title={t('导出', 'Export')}>
        <Seg label={t('倍率', 'Scale')} value={String(scale)} options={[{ v: '1', l: '1x' }, { v: '2', l: '2x' }, { v: '4', l: '4x' }]} onChange={(v) => setScale(Number(v))} />
        <div className="info-line">{result ? `${result.scene.w * scale} × ${result.scene.h * scale}px` : ''}</div>
        <div className="btn-row">
          <button className="primary" onClick={() => doExport('png', scale)}><Icon name="export" size={15} />PNG</button>
          <button onClick={() => doExport('jpg', scale)}>JPG</button>
          <button onClick={() => doExport('svg')}>SVG</button>
        </div>
        <Toggle label={t('SVG 内嵌字体（文字保持可编辑）', 'Embed fonts in SVG (text stays editable)')} value={Boolean(params.embedFonts)} onChange={(v) => s.setParam('embedFonts', v)} />
        <div className="btn-row">
          <button onClick={() => cur && download(JSON.stringify({ app: APP_SLUG, kind: 'poster', version: 1, entry: { ...cur, edits: s.edits } }, null, 1), `${APP_SLUG}-${stamp()}.json`)}>{t('导出海报 JSON', 'Poster JSON')}</button>
          <button onClick={() => fileRef.current?.click()}>{t('导入 JSON', 'Import JSON')}</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
      </Card>

      <Card title={t('录制与回放', 'Record & replay')}>
        <div className="btn-row">
          {!recording ? <button onClick={() => useStore.setState({ recording: true, recorded: [] })}><Icon name="record" size={14} className="rec" />{t('开始录制', 'Record')}</button>
            : <button className="on" onClick={() => useStore.setState({ recording: false })}><Icon name="stop" size={14} />{t('停止', 'Stop')} · {recorded.length}</button>}
          {!replaying ? <button disabled={!recorded.length && !history.length} onClick={() => replay(recorded.length ? recorded : history)}><Icon name="play" size={14} />{t('回放', 'Replay')}</button>
            : <button className="on" onClick={() => (stopRef.current = true)}><Icon name="stop" size={14} />{t('停止回放', 'Stop')}</button>}
        </div>
        <Range label={t('回放间隔', 'Interval')} value={Number(params.replaySpeed)} min={200} max={3000} step={50} unit="ms" onChange={(v) => s.setParam('replaySpeed', v)} />
        <p className="hint">{recorded.length ? t(`已录制 ${recorded.length} 张，可回放或导出。`, `${recorded.length} recorded — replay or export.`) : t('未录制时回放本次历史。', 'Without a recording, replay plays this session’s history.')}</p>
        <div className="btn-row">
          <button disabled={!recorded.length && !history.length} onClick={() => download(sessionJson(recorded.length ? recorded : history), `poster-printer-session-${stamp()}.json`)}>{t('导出会话', 'Session JSON')}</button>
          <button disabled={!!busy || (!recorded.length && !history.length)} onClick={async () => {
            const list = (recorded.length ? recorded : history).slice(-40);
            setBusy('0/' + list.length);
            const b = await recordWebM(list, Number(params.replaySpeed), (i) => setBusy(`${i}/${list.length}`));
            setBusy('');
            if (b) download(b, `poster-printer-replay-${stamp()}.webm`); else s.toast(t('浏览器不支持录屏', 'Video capture unsupported'), 'warn');
          }}>{busy ? t('渲染 ', 'Rendering ') + busy : t('导出 WebM 视频', 'WebM video')}</button>
        </div>
      </Card>

      <Card title={t('种子与详情', 'Seed & details')} open={false}>
        <div className="seed-box">
          {(['layout', 'text', 'color', 'image'] as const).map((k) => <div key={k}><span>{{ layout: t('结构', 'Layout'), text: t('文字', 'Text'), color: t('色调', 'Colour'), image: t('图片', 'Image') }[k]}</span><code onClick={() => navigator.clipboard?.writeText(seeds[k])}>{seeds[k]}</code></div>)}
        </div>
        <div className="row gap">
          <input className="inp" placeholder={t('输入种子（结构/全部）', 'Seed (layout or all)')} value={seedIn} onChange={(e) => setSeedIn(e.target.value.toUpperCase())} />
          <button className="mini" onClick={() => { if (!seedIn) return; const p = seedIn.split(/[-\s,]+/); useStore.setState({ seeds: { layout: p[0], text: p[1] || p[0] + 'T', color: p[2] || p[0] + 'C', image: p[3] || p[0] + 'I' }, edits: {} }); s.regen(true); }}>{t('应用', 'Apply')}</button>
        </div>
        {result && (
          <dl className="details">
            <dt>{t('构图', 'Composition')}</dt><dd>{result.picked.comp}{result.picked.sidebar ? ' + sidebar/' + result.picked.sidebar : ''}</dd>
            <dt>{t('网格', 'Grid')}</dt><dd>{result.picked.grid.type} / {result.picked.grid.density} · {result.picked.grid.nc}×{result.picked.grid.nr}</dd>
            <dt>{t('色源', 'Palette')}</dt><dd>{result.picked.palette.source}</dd>
            <dt>{t('文字组', 'Text set')}</dt><dd>{result.picked.texts.set}</dd>
            <dt>{t('字体', 'Fonts')}</dt><dd>{[...new Set([fonts.en['big.main'].family, fonts.en['big.sub'].family, fonts.en['big.note'].family, fonts.zh['big.main'].family, fonts.zh['big.sub'].family])].join(' · ')}</dd>
            <dt>{t('图片', 'Images')}</dt><dd>{used.map((a) => <div key={a!.id}>{a!.title || a!.id} <small>{(a!.credit as { license?: string })?.license}</small></div>)}</dd>
            <dt>{t('耗时', 'Time')}</dt><dd>{result.ms.toFixed(1)} ms · {result.scene.nodes.length} nodes</dd>
          </dl>
        )}
      </Card>

      <Card title={t('风格管理', 'Style manager')} open={false}>
        <div className="btn-row">
          <button onClick={() => download(JSON.stringify({ app: APP_SLUG, kind: 'styles', styles: styles.filter((x) => !x.builtIn) }, null, 1), `${APP_SLUG}-styles-${stamp()}.json`)}>{t('导出我的风格', 'Export my styles')}</button>
          <button onClick={() => download(JSON.stringify({ app: APP_SLUG, kind: 'styles', styles: [styles.find((x) => x.id === s.styleId)] }, null, 1), `${APP_SLUG}-style-${s.styleId}.json`)}>{t('导出当前风格', 'Export current')}</button>
          <button onClick={() => styleRef.current?.click()}>{t('导入风格', 'Import styles')}</button>
        </div>
        <input ref={styleRef} type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const j = JSON.parse(await f.text()); s.importStyles((j.styles ?? (Array.isArray(j) ? j : [j])) as Style[]); } catch (er) { s.toast(String(er), 'warn'); } e.target.value = ''; }} />
        {styles.filter((x) => !x.builtIn).map((x) => (
          <div key={x.id} className="list-row" onClick={() => s.pickStyle(x.id)}><b>{x.name[lang]}</b><span>{x.fonts.en['big.main'].family}</span><button className="icon-btn" onClick={(e) => { e.stopPropagation(); s.deleteStyle(x.id); }}><Icon name="trash" size={14} /></button></div>
        ))}
      </Card>

      <Card title={t('AI 设置', 'AI settings')} open={false}>
        <Seg value={ai.provider} options={[{ v: 'local', l: t('本地模板', 'Local templates') }, { v: 'openai', l: t('OpenAI 兼容接口', 'OpenAI-compatible') }]} onChange={(v) => setAi({ ...ai, provider: v })} />
        {ai.provider === 'openai' && (<>
          <label className="field"><span>Endpoint</span><input className="inp" value={ai.endpoint} onChange={(e) => setAi({ ...ai, endpoint: e.target.value })} /></label>
          <label className="field"><span>Model</span><input className="inp" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} /></label>
          <label className="field"><span>API key</span><input className="inp" type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} /></label>
        </>)}
        <button className="primary" onClick={() => { saveAiSettings(ai); s.toast(t('已保存（仅存于本浏览器）', 'Saved (this browser only)')); }}>{t('保存', 'Save')}</button>
        <p className="hint">{t('密钥只保存在本机浏览器 localStorage，不会上传到任何服务器（除你填写的接口外）。抠图使用本地 rembg 服务。', 'Keys stay in this browser’s localStorage and are only sent to the endpoint you enter. Cut-outs use the local rembg server.')}</p>
      </Card>
      <div className="panel-foot">{APP_NAME} {APP_VERSION} · {t('快捷键：空格 抽卡 · ←/→ 历史 · F 收藏 · S 导出 PNG · Delete 隐藏元素', 'Keys: Space draw · ←/→ history · F favourite · S export PNG · Delete hide element')}</div>
    </div>
  );
}
