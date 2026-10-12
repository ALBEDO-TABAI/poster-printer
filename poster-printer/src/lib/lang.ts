// Tiny language/theme hook for the standalone pages (shares the editor's localStorage keys).
import { useEffect, useState } from 'react';
export type Lang = 'zh' | 'en';
export function useLocalLang(): [Lang, (l: Lang) => void, (zh: string, en: string) => string] {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('rea.lang')?.replace(/"/g, '') as Lang) || 'zh');
  useEffect(() => { localStorage.setItem('rea.lang', JSON.stringify(lang)); document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);
  return [lang, setLang, (zh, en) => (lang === 'zh' ? zh : en)];
}
export function useLocalTheme(): ['light' | 'dark', (t: 'light' | 'dark') => void] {
  const [t, setT] = useState<'light' | 'dark'>(() => (localStorage.getItem('rea.theme')?.replace(/"/g, '') as 'light' | 'dark') || 'light');
  useEffect(() => { localStorage.setItem('rea.theme', JSON.stringify(t)); document.documentElement.dataset.theme = t; }, [t]);
  return [t, setT];
}
