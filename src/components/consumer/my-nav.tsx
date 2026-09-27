"use client";

import { ChartColumn, HeartPulse, LifeBuoy, Lightbulb, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/primitives";

export const MY_SECTIONS = [
  { href: "/my", label: "Today", icon: Sun, mobile: true },
  { href: "/my/energy", label: "Energy", icon: ChartColumn, mobile: true },
  { href: "/my/insights", label: "Insights", icon: Lightbulb, mobile: true },
  { href: "/my/health", label: "System health", short: "System", icon: HeartPulse, mobile: true },
  { href: "/my/upgrade", label: "Upgrade", icon: Sparkles, mobile: false },
  { href: "/my/support", label: "Support", icon: LifeBuoy, mobile: true },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/my" ? pathname === "/my" : pathname.startsWith(href);
}

export function MyDesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="My RENUABL" className="hidden md:block">
      <ul className="flex gap-1 rounded-full bg-surface-2 p-1">
        {MY_SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={isActive(pathname, s.href) ? "page" : undefined}
              className={cn(
                "block rounded-full px-4 py-2 text-[14px] transition",
                isActive(pathname, s.href) ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MyBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="My RENUABL"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 backdrop-blur-md pb-safe md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MY_SECTIONS.filter((s) => s.mobile).map((s) => {
          const Icon = s.icon;
          const active = isActive(pathname, s.href);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 pt-2.5 text-[11px]", active ? "text-ink" : "text-muted")}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {"short" in s ? s.short : s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
