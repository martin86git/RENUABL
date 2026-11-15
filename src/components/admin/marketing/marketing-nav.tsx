"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/primitives";

const TABS = [
  { href: "/admin/marketing", label: "Contacts" },
  { href: "/admin/marketing/campaigns", label: "Campaigns" },
  { href: "/admin/marketing/sequences", label: "Sequences" },
  { href: "/admin/marketing/settings", label: "Settings" },
] as const;

/** The tabs over every marketing page; the closest address is lit. */
export function MarketingNav() {
  const path = usePathname() ?? "";
  const here = [...TABS].sort((a, b) => b.href.length - a.href.length).find((t) => path === t.href || path.startsWith(`${t.href}/`))?.href;
  return (
    <nav
      aria-label="Marketing"
      className="mb-6 flex flex-wrap items-center gap-1 rounded-full bg-surface p-1 shadow-[var(--shadow-soft)] sm:w-fit"
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={here === t.href ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
            here === t.href ? "bg-ink text-canvas" : "text-ink-2 hover:bg-canvas",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
