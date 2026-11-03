"use client";

import clsx from "clsx";
import Link from "next/link";
import type { SectionPage } from "@/lib/domain/design/sections";

/** RENUABL Marketplace's mark: two roofs joined, the businesses of the network side by side. */
export function MarketplaceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 12 8 7l5.5 5" />
      <path d="M10.5 12 16 7l5.5 5" />
      <path d="M4.5 12v6h15v-6" />
    </svg>
  );
}

/**
 * The Marketplace's own menu (3 Nov 2026, Martin: the blue home somewhere, so you feel you are inside the Marketplace,
 * and the menus it will have once you're in, given your access). It starts at the Marketplace's home, its mark white
 * in the blue round, then its pages as quiet toggles. `preview` draws the pages as they will be at launch, not yet
 * links. `count` puts the waiting count on a page.
 */
export function MarketplaceMenu({
  pages,
  lit,
  count = () => 0,
  preview = false,
  className,
}: {
  pages: readonly SectionPage[];
  lit?: string;
  count?: (id: string) => number;
  preview?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label="RENUABL Marketplace" className={clsx("flex items-center justify-center gap-5 overflow-x-auto", className)}>
      <Link
        href="/design/marketplace"
        aria-label="Marketplace home"
        title="Marketplace home"
        className="flex shrink-0 items-center gap-2 pb-1 text-[13px] font-semibold text-market"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-market text-white shadow-[0_3px_10px_rgba(24,73,169,0.28)]">
          <MarketplaceMark className="size-4" />
        </span>
        <span className="hidden sm:inline">Marketplace</span>
      </Link>
      <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
      {pages.map((p) => {
        if (preview)
          return (
            <span
              key={p.id}
              title="Opens at launch"
              aria-disabled="true"
              className="shrink-0 cursor-default border-b-2 border-transparent pb-1 text-[13px] text-muted/70"
            >
              {p.label}
            </span>
          );
        const on = lit === p.id;
        const n = count(p.id);
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 border-b-2 pb-1 text-[13px] transition-colors",
              on ? "border-market text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {p.label}
            {n > 0 && (
              <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold leading-4 text-white">
                {n}
              </span>
            )}
          </Link>
        );
      })}
      {preview && (
        <span className="mb-1 shrink-0 rounded-full bg-market/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-market">
          At launch
        </span>
      )}
    </nav>
  );
}
