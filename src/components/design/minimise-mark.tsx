/**
 * RENUABL's minimise mark (26 Nov 2026, Martin: a minimise icon of its own): a window's corner, an arrow folding down
 * into the small orange tab it is kept as. Used for Today's chat and every page's minimise.
 */
export function FoldToTab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M8 3.5h7.5a1.5 1.5 0 0 1 1.5 1.5v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M14 6 6.5 13.5M6.5 13.5V9.5M6.5 13.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2.5" y="15.25" width="7" height="2.5" rx="1.25" fill="#ff5a1f" />
    </svg>
  );
}
