import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Card, Chip } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { IMAGE_CATEGORIES } from '../../lib/assets';
import { analyseImage, requestCutout } from '../../lib/userImages';
import type { ImageAsset } from '../../engine/gen/ctx';

const creditOf = (a: ImageAsset) => {
  const c = a.credit as { title?: string; artist?: string; date?: string; license?: string } | undefined;
  return [a.title || c?.title, c?.artist, c?.date, c?.license].filter(Boolean).join(' · ');
};

export function ImagesPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const preset = useStore((s) => s.presetImages);
  const user = useStore((s) => s.userImages);
  const cat = useStore((s) => s.imgCat);
  const pick = useStore((s) => s.imgPick);
  const used = useStore((s) => s.result?.picked.imageIds ?? []);
  const locks = useStore((s) => s.locks);
  const history = useStore((s) => s.history);
  const favorites = useStore((s) => s.favorites);
  // usage counts across this session's history and saved favourites
  const uses = useMemo(() => {
    const m = new Map<string, number>();
    const seen = new Set<string>();
    for (const e of [...history, ...favorites]) { if (seen.has(e.id)) continue; seen.add(e.id); for (const id of e.picked.imageIds ?? []) m.set(id, (m.get(id) ?? 0) + 1); }
    return m;
  }, [history, favorites]);
  const s = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const all = [...preset, ...user];
  const list = cat === 'all' ? all : all.filter((a) => a.category === cat);
  const counts = (id: string) => (id === 'all' ? all.length : all.filter((a) => a.category === id).length);

  const togglePick = (id: string) => { const p = pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]; s.set('imgPick', p); };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(t('分析图片…', 'Analysing…'));
    const out: ImageAsset[] = [];
    for (const f of Array.from(files)) { try { out.push({ ...(await analyseImage(f, 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))), user: true }); } catch { s.toast(t('无法读取 ', 'Cannot read ') + f.name, 'warn'); } }
    await s.addUserImages(out);
    s.set('imgCat', 'mine');
    setBusy(null);
    s.toast(t(`已添加 ${out.length} 张图片`, `Added ${out.length} image(s)`));
  };
  const cut = async (a: ImageAsset) => {
    setBusy(t('AI 抠图中…', 'Cutting out…'));
    const r = await requestCutout(a);
    setBusy(null);
    if (!r) return s.toast(t('抠图服务不可用（启动 server/cutout_server.py）', 'Cut-out server unavailable (run server/cutout_server.py)'), 'warn');
    await s.updateUserImage(a.id, { cutout: r.cutout, focus: r.focus, subject: r.subject });
    s.toast(t('抠图完成，可用于「分层」模式', 'Cut-out ready — try Layered mode'));
  };

  return (
    <div className="panel-scroll">
      <Card title={t('图片库', 'Image library')} right={<button className="mini" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} />{t('上传', 'Upload')}</button>}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        <div className="chips">
          {IMAGE_CATEGORIES.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => { s.set('imgCat', c.id); s.regen(false); }}>{lang === 'zh' ? c.zh : c.en} <small>{counts(c.id)}</small></Chip>)}
        </div>
        <div className="row gap">
          <button className={'pill' + (locks.image ? ' on' : '')} onClick={() => s.toggleLock('image')}><Icon name={locks.image ? 'lock' : 'unlock'} size={14} />{t('锁定主图', 'Lock main image')}</button>
          <button className={'pill' + (locks.images ? ' on' : '')} onClick={() => s.toggleLock('images')}><Icon name={locks.images ? 'lock' : 'unlock'} size={14} />{t('锁定全部图片', 'Lock all images')}</button>
        </div>
        {pick.length > 0 && (
          <div className="pick-bar">{t(`仅从已选 ${pick.length} 张中抽取`, `Drawing only from ${pick.length} selected`)}<button className="mini" onClick={() => s.set('imgPick', [])}>{t('清除', 'Clear')}</button></div>
        )}
        {busy && <div className="busy">{busy}</div>}
        <div className="img-grid">
          {list.map((a) => (
            <div key={a.id} className={'img-item' + (pick.includes(a.id) ? ' picked' : '') + (used.includes(a.id) ? ' used' : '')} title={creditOf(a)} onClick={() => togglePick(a.id)}>
              <img src={a.thumb || a.src} loading="lazy" alt="" />
              {a.cutout && <span className="badge" title={t('含抠图主体', 'Has cut-out')}><Icon name="scissors" size={12} /></span>}
              {(uses.get(a.id) ?? 0) > 0 && <span className="uses" title={t(`已用于 ${uses.get(a.id)} 张海报（历史+收藏）`, `Used in ${uses.get(a.id)} poster(s) (history + favourites)`)}>{uses.get(a.id)}</span>}
              {pick.includes(a.id) && <span className="tick"><Icon name="check" size={12} /></span>}
              {a.user && (
                <span className="img-tools" onClick={(e) => e.stopPropagation()}>
                  {!a.cutout && <button title={t('AI 抠图', 'AI cut-out')} onClick={() => cut(a)}><Icon name="scissors" size={13} /></button>}
                  <button title={t('删除', 'Delete')} onClick={() => s.removeUserImage(a.id)}><Icon name="trash" size={13} /></button>
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="hint">{t('点选图片可限定抽取范围；蓝框为当前海报使用的图片，角标数字为使用次数。上传的图片只保存在本浏览器。', 'Click images to restrict the draw pool; blue outline = used in the current poster, the corner number = times used. Uploads stay in this browser.')}</p>
      </Card>
      <div className="panel-foot">{t('预置图片：大都会艺术博物馆开放获取（CC0）与本项目程序生成作品（CC0）。抠图：BiRefNet / IS-Net via rembg。', 'Preset images: The Met Open Access (CC0) and procedurally generated art (CC0). Cut-outs: BiRefNet / IS-Net via rembg.')}</div>
    </div>
  );
}
