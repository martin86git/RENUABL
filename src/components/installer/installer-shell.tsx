"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark, cn } from "@/components/ui/primitives";
import { INSTALLER_MOBILE_NAV, INSTALLER_NAV, isNavActive } from "./nav";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

/** Installer portal frame: top utility bar, left rail on desktop, bottom tabs in the field. */
export function InstallerShell({ children, company, user }: { children: ReactNode; company: string; user: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-6 bg-canvas/90 px-5 backdrop-blur-md lg:h-[88px] lg:px-8">
        <Link href="/installer" className="flex items-baseline gap-5" aria-label="Installer portal home">
          <Wordmark tone="light" className="h-[19px] lg:h-[21px]" />
          <span className="hidden text-[17px] text-ink lg:inline">Installer Portal</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted lg:hidden">Field</span>
        </Link>
        <div className="ml-auto flex items-center gap-2 lg:ml-24 lg:gap-4">
          <button type="button" className="hidden h-10 w-10 place-items-center rounded-full hover:bg-surface-2 lg:grid" aria-label="Search">
            <Search className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={1.6} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-warning" />
          </button>
          <span
            className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-[13px] lg:h-11 lg:w-11"
            title={`${user} · ${company}`}
          >
            {initials(user)}
          </span>
        </div>
        <p className="ml-auto hidden text-[13px] text-ink-2 xl:block">Together for a cleaner, brighter Australia.</p>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-[88px] hidden h-[calc(100dvh-88px)] w-60 shrink-0 flex-col px-4 pb-6 lg:flex">
          <nav aria-label="Installer" className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {INSTALLER_NAV.map(({ href, label, icon: Icon }) => {
                const active = isNavActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3.5 rounded-xl px-4 py-3 text-[14px] transition",
                        active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="px-4 pt-4 text-[12px] text-muted">
            <p className="text-ink-2">{company}</p>
            <p>{user}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-2 sm:px-6 lg:pb-10 lg:pl-2 lg:pr-8 lg:pt-0">{children}</main>
      </div>

      {/* Field app bottom navigation */}
      <nav aria-label="Field" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden">
        <ul className="grid grid-cols-4">
          {INSTALLER_MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[12px]", active ? "text-ink" : "text-muted")}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.6} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
