"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import { MARKETING_OFF } from "@/lib/domain/marketing/access";
import { AddOnOffer } from "../add-on-offer";
import { useDesignAccount } from "../design-account";

const TABS = [
  { href: "/design/marketing", label: "Contacts" },
  { href: "/design/marketing/campaigns", label: "Campaigns" },
  { href: "/design/marketing/sequences", label: "Sequences" },
  { href: "/design/marketing/settings", label: "Settings" },
] as const;

/** The tabs over every Marketing page; the closest address is lit. */
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

/** Every Marketing page: the tabs and the page, or, for a business without the add-on, the add-on offered (the routes refuse too). */
export function MarketingFrame({ children }: { children: ReactNode }) {
  const [account] = useDesignAccount();
  if (!account) return null;
  if (!account.signedIn) return <p className="px-1 py-10 text-center text-[14px] text-muted">{MARKETING_OFF}</p>;
  if (!account.marketing)
    return (
      <div className="mx-auto max-w-2xl px-1 py-8">
        <AddOnOffer addOn="marketing" />
      </div>
    );
  return (
    <div className="px-1 pb-10">
      <MarketingNav />
      {children}
    </div>
  );
}
