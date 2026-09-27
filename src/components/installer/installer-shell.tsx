"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark, cn } from "@/components/ui/primitives";
import { INSTALLER_MOBILE_NAV, INSTALLER_NAV, isNavActive } from "./nav";

export function InstallerShell({ children, company, user }: { children: ReactNode; company: string; user: string }) {
  const pathname = usePathname();
  const pathMobile = pathname === "/installer/more" ? "/installer/more" : pathname;

  return (
    <div className="flex min-h-dvh">
      {/* Desktop left rail */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <Wordmark className="text-[14px]" />
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">Installer</span>
        </div>
        <nav aria-label="Installer" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {INSTALLER_NAV.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition",
                      active ? "bg-surface-2 font-medium text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-6 py-4">
          <p className="text-[14px] font-medium">{company}</p>
          <p className="text-[12px] text-muted">{user}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top utility bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-canvas/85 px-5 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Wordmark className="text-[13px]" />
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">Field</span>
          </div>
          <label className="hidden h-10 max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-muted lg:flex">
            <Search className="h-4 w-4" aria-hidden />
            <input
              placeholder="Search jobs, customers, addresses"
              aria-label="Search"
              className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-warning" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-[13px] font-semibold" aria-label={user}>
              {user
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Field" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden">
        <ul className="grid grid-cols-4">
          {INSTALLER_MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathMobile, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium",
                    active ? "text-ink" : "text-muted",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
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
