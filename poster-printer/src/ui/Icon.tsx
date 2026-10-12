// Icons: Lucide (ISC) via ./lucide where a match exists, else the original minimal line set (24px grid, 1.6 stroke).
import { ICONS } from './lucide';
const ALIAS: Record<string, string> = { dice: 'dice-5', sliders: 'sliders-horizontal', text: 'type', font: 'a-large-small', layout: 'layout-grid', export: 'download', unlock: 'lock-open', left: 'chevron-left', right: 'chevron-right', sparkle: 'sparkles', record: 'circle-dot', stop: 'square', trash: 'trash-2', ornament: 'shapes', grid: 'grid-3x3', globe: 'languages' };
const P: Record<string, string> = {
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  font: 'M4 20 10 4h1l6 16M6.5 14h8M17 12c0-2 4-2 4 0v8M21 16c-3 0-4 .7-4 2s1.5 2 4 0',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.8 1.6-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4c0-4.5-4-8.4-9-8.4zM7.5 11h.01M10 7h.01M15 7.5h.01',
  layout: 'M4 4h16v16H4zM4 10h16M10 10v10',
  star: 'M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z',
  history: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4l3 2',
  export: 'M12 4v11M7 9l5-5 5 5M5 15v4h14v-4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v9H5z',
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  ornament: 'M12 3v18M3 12h18M6 6l12 12M18 6 6 18',
  record: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  play: 'M7 5l12 7-12 7z', stop: 'M6 6h12v12H6z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6 6 18', plus: 'M12 5v14M5 12h14',
  shuffle: 'M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M13 9.5C14 8 15 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3',
  scissors: 'M6 7a2.5 2.5 0 1 0 0 .01M6 17a2.5 2.5 0 1 0 0 .01M8 8l12 10M8 16 20 6',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  grid: 'M4 4h16v16H4zM9.33 4v16M14.66 4v16M4 9.33h16M4 14.66h16',
};
export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  const lu = ICONS[ALIAS[name] ?? name];
  if (lu) return <svg className={'ic ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: lu }} />;
  return (
    <svg className={'ic ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] || P.info} />
    </svg>
  );
}
