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
  return (
    <span className="-mt-3 flex flex-col items-center print:hidden">
      {/* The bridge: two fine rails with a rung between them, from the bar down to the round. */}
      <span className="relative flex h-5 w-3 justify-between" aria-hidden>
        <span className="w-px bg-ink/25" />
        <span className="absolute inset-x-0 top-1/2 h-px bg-ink/25" />
        <span className="w-px bg-ink/25" />
      </span>
      <Link
        href="/design/routines"
        title="Routines: what each agent does by itself"
        aria-label="Routines: what each agent does by itself"
        aria-current={here ? "page" : undefined}
        className="group glass-bar flex flex-col items-center rounded-[1.5rem] px-2 pb-1.5 pt-2 outline-none"
      >
        <span
          className={clsx(
            "grid size-11 place-items-center rounded-full shadow-[0_2px_8px_rgba(20,22,26,0.14)] ring-2 transition group-hover:-translate-y-0.5 group-hover:ring-sun-line group-focus-visible:ring-sun-line motion-reduce:transform-none",
            here ? "bg-ink text-canvas ring-sun-line" : "bg-surface text-ink ring-transparent",
          )}
        >
          <Workflow className="size-5" aria-hidden />
        </span>
        <span className="mt-1 text-[11px] font-medium leading-tight text-ink-2 group-hover:text-ink">Routines</span>
      </Link>
    </span>
  );
}
