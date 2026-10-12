// Interactive poster surface (selection, drag with grid snapping, text editing, image reframing, component slots).
// Rendered inside the glass shell's frame at W×H CSS px.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { renderSVG } from '../engine/render/svg';
import { findNode, nodeBox } from '../lib/edits';
import { useT } from './i18n';
import { compSize, freeSlots } from '../engine/components';
import { snapMove, type SnapLines } from '../lib/snap';
import { useUI, pushUndo } from './shell/ui';
import { Icon } from './Icon';

export const ROLE_LABEL: Record<string, [string, string]> = {
  headline: ['主标题', 'Headline'], title: ['主标题', 'Headline'], big: ['主标题', 'Headline'], sub: ['副标题', 'Subtitle'], subtitle: ['副标题', 'Subtitle'], note: ['说明文字', 'Caption'], small: ['小标题', 'Small title'],
  meta: ['信息标签', 'Meta label'], prose: ['正文', 'Prose'], tick: ['刻度字', 'Tick label'], glyph: ['装饰大字', 'Big glyph'], sidebar: ['边栏', 'Sidebar'], image: ['图片', 'Image'], part: ['组件', 'Part'],
};
export const roleOf = (id: string | null) => {
  if (!id) return null;
  if (id.startsWith('pc-')) return 'part';
  const sc = useStore.getState().result?.scene; const nd = sc && findNode(sc, id);
  if (!nd) return null;
  if (nd.kind === 'image') return 'image';
  if (nd.kind === 'text') { const r = String(nd.role || '').toLowerCase(); const k = Object.keys(ROLE_LABEL).find((x) => r.startsWith(x)); return k ?? 'text'; }
  return 'shape';
};

export function Stage({ W, H }: { W: number; H: number }) {
  const scene = useStore((s) => s.scene);
  const selected = useStore((s) => s.selected);
  const edits = useStore((s) => s.edits);
  const editingText = useStore((s) => s.editingText);
  const replaying = useStore((s) => s.replaying);
  const showSlots = useStore((s) => s.showSlots);
  const armed = useStore((s) => s.armed);
  const entryId = useStore((s) => s.history[s.hIndex]?.id ?? '');
  const lang = useStore((s) => s.lang);
  useStore((s) => s.placed);
  const imgEdit = useUI((u) => u.imgEdit);
  const setImgEdit = (v: string | null) => useUI.setState({ imgEdit: v });
  const st = useStore.getState;
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ gx?: number; gy?: number }>({});
  const drag = useRef<null | { id: string; x: number; y: number; dx: number; dy: number; fx: number; fy: number; moved: boolean; img: boolean; undo: boolean }>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && (useUI.getState().imgEdit || useStore.getState().editingText)) { setImgEdit(null); useStore.setState({ editingText: null }); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const svg = useMemo(() => (scene ? renderSVG(scene, { interactive: true }).replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%"') : ''), [scene]);
  if (!scene || W < 4) return null;
  const scale = W / scene.w;

  const baseId = (el: Element | null) => {
    for (let e = el as HTMLElement | null; e && e !== wrap.current; e = e.parentElement) { const id = e.dataset?.id; if (id && /^pc-[^-]+$/.test(id)) return id; }
    const n = el?.closest('[data-id]') as HTMLElement | null;
    if (!n) return null;
    const layer = n.dataset.layer;
    if (layer === 'bg' || layer === 'texture') return null;
    return n.dataset.id!.replace(/~mv$/, '');
  };

  const onDown = (e: React.PointerEvent) => {
    if (replaying || editingText) return;
    const id = baseId(e.target as Element);
    if (imgEdit && id !== imgEdit) setImgEdit(null);
    if (!id) { useStore.setState({ selected: null }); return; }
    const nd = findNode(st().result!.scene, id);
    useStore.setState({ selected: id });
    const ed = st().edits[id] || {};
    const isImg = imgEdit === id && nd?.kind === 'image';
    drag.current = { id, x: e.clientX, y: e.clientY, dx: ed.dx || 0, dy: ed.dy || 0, fx: ed.fx ?? (nd?.kind === 'image' ? nd.fx : 0.5), fy: ed.fy ?? (nd?.kind === 'image' ? nd.fy : 0.5), moved: false, img: isImg, undo: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = (e.clientX - d.x) / scale, my = (e.clientY - d.y) / scale;
    if (!d.moved && Math.hypot(mx, my) * scale < 3) return;
    d.moved = true;
    if (!d.undo) { d.undo = true; pushUndo(lang === 'zh' ? (d.img ? '取景' : '移动') : d.img ? 'Reframe' : 'Move'); }
    if (d.img) {
      const nd = findNode(st().result!.scene, d.id);
      if (nd?.kind !== 'image') return;
      const k = Math.max(nd.w / nd.iw, nd.h / nd.ih) * (st().edits[d.id]?.zoom ?? nd.zoom);
      const ox = nd.w - nd.iw * k, oy = nd.h - nd.ih * k;
      st().edit(d.id, { fx: Math.max(0, Math.min(1, d.fx + (ox ? mx / ox : 0))), fy: Math.max(0, Math.min(1, d.fy + (oy ? my / oy : 0))) }, false);
    } else {
      const lines = st().result?.scene.info.snap as SnapLines | undefined;
      const nd = findNode(st().result!.scene, d.id);
      const b = nd ? nodeBox(nd) : null;
      if (lines && b && !e.altKey && st().params.snapGrid !== false) {
        const r = snapMove(b, d.dx + mx, d.dy + my, lines, 7 / scale);
        setGuides({ gx: r.gx, gy: r.gy });
        st().edit(d.id, { dx: r.dx, dy: r.dy }, false);
      } else { setGuides({}); st().edit(d.id, { dx: d.dx + mx, dy: d.dy + my }, false); }
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides({});
    if (d?.moved && d.id.startsWith('pc-')) {
      const pid = d.id.slice(3);
      const pc = st().placed.find((p) => p.id === pid);
      const ed = st().edits[d.id] || {};
      const edits = { ...st().edits }; delete edits[d.id];
      useStore.setState({ edits });
      if (pc) st().updatePlaced(pid, { x: pc.x + (ed.dx || 0) / scene.w, y: pc.y + (ed.dy || 0) / scene.h });
      return;
    }
    if (d?.moved) st().edit(d.id, {}, true);
  };
  const onDbl = (e: React.MouseEvent) => {
    const id = baseId(e.target as Element);
    if (!id) return;
    const nd = findNode(st().result!.scene, id);
    if (nd?.kind === 'text') useStore.setState({ editingText: id, selected: id });
    else if (nd?.kind === 'image') { setImgEdit(id); useStore.setState({ selected: id }); }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!imgEdit && selected?.startsWith('pc-')) {
      const pc = st().placed.find((p) => 'pc-' + p.id === selected);
      if (pc) st().updatePlaced(pc.id, { scale: Math.max(0.4, Math.min(3, pc.scale * (e.deltaY < 0 ? 1.06 : 1 / 1.06))) });
      return;
    }
    if (!imgEdit) return;
    const nd = findNode(st().result!.scene, imgEdit);
    if (nd?.kind !== 'image') return;
    const z = st().edits[imgEdit]?.zoom ?? nd.zoom;
    st().edit(imgEdit, { zoom: Math.max(1, Math.min(4, z * (e.deltaY < 0 ? 1.06 : 1 / 1.06))) }, true);
  };

  let selRect: { x: number; y: number; w: number; h: number } | null = null;
  const selNode = selected ? findNode(st().result?.scene ?? scene, selected) : null;
  if (selNode) {
    const b = nodeBox(selNode);
    const ed = edits[selected!] || {};
    if (b) selRect = { x: (b.x + (ed.dx || 0)) * scale, y: (b.y + (ed.dy || 0)) * scale, w: b.w * scale * (ed.scale || 1), h: b.h * scale * (ed.scale || 1) };
  }
  const role = roleOf(selected);
  const rl = role && ROLE_LABEL[role] ? ROLE_LABEL[role][lang === 'zh' ? 0 : 1] : role === 'text' ? t('文字', 'Text') : t('图形', 'Shape');
  const txt = editingText ? findNode(scene, editingText) : null;
  const armedSize = armed ? compSize(armed.type, armed.scale ?? 1, scene.w, scene.h) : compSize('tag', 1.4, scene.w, scene.h);
  const slots = showSlots ? freeSlots(st().result?.scene ?? scene, armedSize.w, armedSize.h, [], 6) : [];

  return (
    <div className="stage-host" ref={wrap} onWheel={onWheel} style={{ width: W, height: H }}>
      <div key={entryId} className={'paper poster layer-in' + (imgEdit ? ' img-editing' : '')} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDbl} dangerouslySetInnerHTML={{ __html: svg }} />
      <div key={'s' + entryId} className="scan run" />
      {guides.gx !== undefined && <div className="snap-guide v" style={{ left: guides.gx * scale, top: 0, height: H }} />}
      {guides.gy !== undefined && <div className="snap-guide h" style={{ top: guides.gy * scale, left: 0, width: W }} />}
      {slots.map((b, i) => (
        <button key={i} className={'slot-box' + (armed ? ' armed' : '')} style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
          title={armed ? t('放入此空槽', 'Drop here') : t('空槽（先在组件库选择组件）', 'Free slot (pick a part first)')}
          onClick={() => { if (armed) { pushUndo(t('放置组件', 'Place part')); st().addComponent(armed, { x: b.x + b.w / 2, y: b.y + b.h / 2 }); } }}>
          <span>{i + 1}</span>
        </button>
      ))}
      {selRect && !editingText && (
        <div className={'sel' + (imgEdit ? ' img' : '')} id="sel" style={{ left: selRect.x - 3, top: selRect.y - 3, width: selRect.w + 6, height: selRect.h + 6 }}>
          <i /><i /><i /><i /><span className="sel-tag"><Icon name={role === 'image' ? 'image' : role === 'part' ? 'sticker' : 'type'} size={11} />{rl}</span>
        </div>
      )}
      {txt && txt.kind === 'text' && (
        <textarea
          className="text-editor" autoFocus defaultValue={edits[txt.id]?.raw ?? txt.raw}
          style={{ left: txt.box.x * scale - 6, top: txt.box.y * scale - 6, width: Math.max(160, txt.box.w * scale + 12), minHeight: Math.max(40, txt.box.h * scale + 12), fontFamily: `"${txt.family}", "Noto Sans SC"`, fontSize: Math.max(12, Math.min(40, txt.size * scale)), fontWeight: txt.weight }}
          onKeyDown={(e) => { const ta = e.target as HTMLTextAreaElement; if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ta.blur(); if (e.key === 'Escape') { ta.value = edits[txt.id]?.raw ?? txt.raw; ta.blur(); } e.stopPropagation(); }}
          onBlur={(e) => { if (e.target.value !== (edits[txt.id]?.raw ?? txt.raw)) { pushUndo(t('改字', 'Edit text')); st().edit(txt.id, { raw: e.target.value }, true); } useStore.setState({ editingText: null }); }}
        />
      )}
    </div>
  );
}
