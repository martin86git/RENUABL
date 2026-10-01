"use client";

import { cn } from "@/components/ui/primitives";

const COLOURS = ["bg-sun", "bg-sage", "bg-forest", "bg-sun-bright", "bg-positive"];

/** A one-off burst of confetti from the centre (decorative; hidden for people who prefer less motion). */
export function Confetti({ pieces = 28, className }: { pieces?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-visible motion-reduce:hidden", className)}>
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2;
        const reach = 90 + ((i * 37) % 70);
        return (
          <span
            key={i}
            className={cn("confetti absolute left-1/2 top-1/2 h-2 w-1.5 rounded-[1px]", COLOURS[i % COLOURS.length])}
            style={
              {
                "--cx": `${Math.cos(angle) * reach}px`,
                "--cy": `${Math.sin(angle) * reach - 40}px`,
                "--cr": `${(i * 53) % 360}deg`,
                animationDelay: `${(i % 5) * 30}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
