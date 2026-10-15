import { useEffect, useState } from 'react';
import { useStore } from './store';
import { APP_NAME } from './config';
import { Shell } from './ui/shell/Shell';
import { Splash } from './ui/Splash';

export default function App() {
  const ready = useStore((s) => s.ready);
  const loadMsg = useStore((s) => s.loadMsg);
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  const [splash, setSplash] = useState(true);
  useEffect(() => { const f = () => useStore.setState({ view: new URLSearchParams(location.search).get('view') === 'deck' ? 'deck' : 'poster' }); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  useEffect(() => { useStore.getState().init().catch((e) => { console.error(e); useStore.setState({ loadMsg: 'error: ' + e }); }); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; document.title = APP_NAME; }, [theme, lang]);

  return (
    <>
      <Shell />
      {splash && <Splash msg={loadMsg} ready={ready} onDone={() => setSplash(false)} />}
    </>
  );
}
