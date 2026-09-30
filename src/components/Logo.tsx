export default function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 10.5h6.5M9 21.5h6.5M17 10.5l6 5.5-6 5.5" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="9" cy="10.5" r="2.4" fill="var(--accent-ink)" />
      <circle cx="9" cy="21.5" r="2.4" fill="var(--accent-ink)" />
      <circle cx="23.5" cy="16" r="2.8" fill="var(--accent-ink)" opacity="0.7" />
    </svg>
  );
}
