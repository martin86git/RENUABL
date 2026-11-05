/**
 * The small RENUABL mark and the loading screen of RENUABL Business (5 Nov 2026, Martin, after Primero's redrawn
 * loading screen, in RENUABL's own idiom).
 *
 * The mark: the wordmark's first letter in a hairline round, for the top bar when a narrower window has no room for
 * the whole wordmark.
 *
 * The loading screen: Sol's sun held still in the middle, a hairline ring round it, and a short arc of the signal
 * orange travelling round the ring, as the sun's light goes round the day. Drawn in CSS only (`.biz-loading-*` in
 * globals.css), so it needs no script and stays still with reduced motion. Server-safe (fixed ids: one on a page).
 */
import clsx from "clsx";

export function RenuablMark({ className }: { className?: string }) {
  return (
    <span
      aria-label="RENUABL"
      className={clsx(
        "items-center justify-center rounded-full bg-surface text-[15px] font-normal tracking-normal text-ink ring-1 ring-line",
        "size-9 select-none",
        className,
      )}
    >
      R
    </span>
  );
}

export function BusinessLoading({ label = "Loading", bare }: { label?: string; bare?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx("flex flex-col items-center justify-center gap-5 text-ink", !bare && "theme-studio min-h-[70vh] bg-canvas")}
    >
      <div className="relative size-24">
        <span aria-hidden className="biz-loading-glow absolute inset-[-25%] rounded-full" />
        <svg viewBox="0 0 100 100" className="relative size-full" aria-hidden>
          <defs>
            <linearGradient id="biz-loading-sun" x1="50" y1="32" x2="50" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFD27A" />
              <stop offset="0.55" stopColor="#FF8A3D" />
              <stop offset="1" stopColor="#FF5A1F" />
            </linearGradient>
          </defs>
          {/* The ring the light goes round: a hairline track. */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
          {/* The light: a short arc with a soft tail, turned round the ring. */}
          <g className="biz-loading-sweep">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--sun-line)"
              strokeOpacity="0.25"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="44 207.3"
              transform="rotate(-153 50 50)"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--sun-line)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="18 233.3"
              transform="rotate(-116 50 50)"
            />
            <circle cx="50" cy="10" r="2.6" fill="var(--sun-line)" />
          </g>
          {/* Sol's sun, still. */}
          <circle cx="50" cy="50" r="17" fill="url(#biz-loading-sun)" />
        </svg>
      </div>
      <span className="text-[12px] font-medium tracking-[0.18em] text-muted uppercase">{label}</span>
    </div>
  );
}
