"use client";

import { ChevronDown, Home, LifeBuoy, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark, cn } from "@/components/ui/primitives";

/** Desktop navigation, matching the design's top bar. */
export const MY_NAV = [
  { href: "/my", label: "Home" },
  { href: "/my/energy", label: "Energy" },
  { href: "/my/savings", label: "Savings" },
  { href: "/my/upgrades", label: "Upgrades" },
  { href: "/my/support", label: "Support" },
] as const;

/** Mobile bottom navigation, matching the design: Home · Energy · Support · Profile. */
export const MY_TABS = [
  { href: "/my", label: "Home", icon: Home },
  { href: "/my/energy", label: "Energy", icon: Zap },
  { href: "/my/support", label: "Support", icon: LifeBuoy },
  { href: "/my/profile", label: "Profile", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/my" ? pathname === "/my" : pathname.startsWith(href);
}

export function MyTopBar({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="mx-auto hidden h-[76px] w-full max-w-[1440px] items-center gap-12 border-b border-line px-10 lg:flex">
      <Link href="/" aria-label="RENUABL home">
        <Wordmark className="text-[22px]" />
      </Link>
      <nav aria-label="My RENUABL" className="flex items-center gap-9 text-[13px]">
        {MY_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(pathname, n.href) ? "page" : undefined}
            className={cn("relative py-2", isActive(pathname, n.href) ? "text-ink" : "text-ink-2 hover:text-ink")}
          >
            {n.label}
            {isActive(pathname, n.href) && <span className="absolute inset-x-0 -bottom-[18px] h-0.5 rounded-full bg-ink" />}
          </Link>
        ))}
      </nav>
      <Link href="/my/profile" className="ml-auto flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2">
          <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        {name}
        <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
      </Link>
    </header>
  );
}

export function MyBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="My RENUABL"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-md pb-safe lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {MY_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 pt-2.5 text-[11px]", active ? "text-ink" : "text-muted")}
              >
                <Icon className={cn("h-6 w-6", active && "fill-ink")} strokeWidth={1.5} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
