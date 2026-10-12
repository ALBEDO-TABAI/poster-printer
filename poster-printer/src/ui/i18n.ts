import { useStore } from '../store';
export const useT = () => {
  const lang = useStore((s) => s.lang);
  return (zh: string, en: string) => (lang === 'zh' ? zh : en);
};
export const useLang = () => useStore((s) => s.lang);
