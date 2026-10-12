import { useEffect } from 'react';
import { useStore } from './store';
import { APP_NAME, APP_SLOGAN } from './config';
import { Shell } from './ui/shell/Shell';
import { BrandMark } from './ui/shell/Chrome';

export default function App() {
  const ready = useStore((s) => s.ready);
  const loadMsg = useStore((s) => s.loadMsg);
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  useEffect(() => { const f = () => useStore.setState({ view: new URLSearchParams(location.search).get('view') === 'deck' ? 'deck' : 'poster' }); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  useEffect(() => { useStore.getState().init().catch((e) => { console.error(e); useStore.setState({ loadMsg: 'error: ' + e }); }); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; document.title = APP_NAME; }, [theme, lang]);

  return (
    <>
      <Shell />
      {!ready && (
        <div className="splash">
          <BrandMark s={52} />
          <h1>Poster <i>Printer</i></h1>
          <p>{APP_SLOGAN[lang]}</p>
          <div className="load-bar"><i /></div>
          <small>{loadMsg}</small>
        </div>
      )}
    </>
  );
}
