export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" className="logo-mark" aria-hidden>
      <rect x="1" y="1" width="24" height="24" rx="5" fill="currentColor" />
      <rect x="5" y="5" width="7" height="16" rx="1" fill="var(--logo-ink)" />
      <circle cx="17.5" cy="8.5" r="3.5" fill="var(--accent)" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="var(--logo-ink)" opacity=".55" />
    </svg>
  );
}
