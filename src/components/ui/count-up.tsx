"use client";

import { useEffect, useState } from "react";

/** Counts up from 0 on mount (straight to the figure for people who prefer less motion). */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = instant ? 1 : Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** A number that counts up from 0, formatted for display. Screen readers get the final figure. */
export function CountUp({ value, format, ms }: { value: number; format: (n: number) => string; ms?: number }) {
  const shown = useCountUp(value, ms);
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
