import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/glass.css';
import './styles/shell.css';
import './styles/grid.css';
import './styles/legacy.css';
import './styles/port.css';
import './styles/motion.css';
import App from './App';
import { useStore } from './store';
import { rasterize, exportSVG } from './lib/exporter';
import { designAudit } from './engine/gen/audit';

// Automation hooks (used by the QA / showcase scripts; harmless for users).
const w = window as unknown as Record<string, unknown>;
w.__reaRaster = async (scale = 1, type = 'image/png') => {
  const sc = useStore.getState().scene;
  if (!sc) return null;
  const blob = await rasterize(sc, scale, type);
  return await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });
};
w.__reaSVG = async () => { const sc = useStore.getState().scene; return sc ? exportSVG(sc, false) : null; };

// re-score a stored scene (JSON) with the current design audit (used to compare old renders with new ones)
w.__reaAudit = (json: string) => {
  const d = JSON.parse(json);
  const st = useStore.getState();
  const sc = d.scene;
  return designAudit({ nodes: sc.nodes, W: sc.w, H: sc.h, palette: sc.palette, images: [...st.presetImages, ...st.userImages], comp: String(sc.info?.comp ?? '') });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
