"use client";

import { clsx } from "clsx";
import { Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Routines on the floating bar (20 Nov 2026, Martin: "an icon that is representative of routines… below the agent icons
 * and below the + add agent icon… independently floating, but… joined by a line like a bridge… to show that the
 * routines are linked"). A round of its own under the bar, held to it by a short bridge, opening the Routines page:
 * what each agent does by itself, as a flow.
 */
export function RoutinesRound() {
  const here = usePathname()?.startsWith("/design/routines") ?? false;
  // In the floating bar's own graphite, with no name under it (20 Nov 2026, Martin chose the slim graphite bar with the
  // names on hover): a pill the bar's width under it, held to it by the bridge.
  return (
    <span className="-mt-3 flex w-full flex-col items-center print:hidden">
      {/* The bridge: two fine graphite rails with a rung between them, from the bar down to the round. */}
      <span className="relative flex h-5 w-3 justify-between" aria-hidden>
        <span className="w-px bg-primary/60" />
        <span className="absolute inset-x-0 top-1/2 h-px bg-primary/60" />
        <span className="w-px bg-primary/60" />
      </span>
      <Link
        href="/design/routines"
        title="Routines: what each agent does by itself"
        aria-label="Routines: what each agent does by itself"
        aria-current={here ? "page" : undefined}
        className="glass-rail group relative flex w-full items-center justify-center rounded-full p-1.5 outline-none"
      >
        <span
          className={clsx(
            "grid size-10 place-items-center rounded-full bg-[#45484f] text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-2 transition group-hover:-translate-y-0.5 group-hover:ring-sun-line group-focus-visible:ring-sun-line motion-reduce:transform-none",
            here ? "ring-sun-line" : "ring-transparent",
          )}
        >
          <Workflow className="size-[18px]" aria-hidden />
        </span>
      </Link>
    </span>
  );
}
