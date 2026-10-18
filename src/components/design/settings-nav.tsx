"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ui } from "./design-shell";
import { SETTINGS, settingsPath } from "./settings-list";

/**
 * The frame every settings page sits in: the settings' own nav down the left
 * (a second column beside the product's sections; a row across the top on a
 * phone), and the page beside it.
 */
export function SettingsFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav
        aria-label="Settings"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5"
      >
        <p className="hidden px-3 text-[17px] tracking-tight text-ink lg:block">Settings</p>
        {SETTINGS.map((group) => (
          <div key={group.title} className="contents lg:mt-6 lg:block lg:first-of-type:mt-4">
            {/* Each section's name on a light band, its pages indented under a rule, so one section reads apart from the next. */}
            <p className="hidden rounded-md bg-surface-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink lg:block">
              {group.title}
            </p>
            <div className="contents lg:ml-4 lg:mt-1.5 lg:block lg:border-l lg:border-line lg:pl-2">
              {group.items.map((item) => {
                const on = path === settingsPath(item.slug);
                return (
                  <Link
                    key={item.slug}
                    href={settingsPath(item.slug)}
                    aria-current={on ? "page" : undefined}
                    className={clsx(
                      "flex h-9 shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium lg:h-8 lg:px-2.5 lg:text-[12px] lg:whitespace-normal",
                      on ? "bg-primary text-primary-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.soon && (
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                          on ? "bg-white/15" : "bg-surface-2 text-muted",
                        )}
                      >
                        Soon
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A settings page that has its place and isn't built yet: what it will hold, said plainly. */
export function SettingSoon({ label, soon }: { label: string; soon: string }) {
  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{label}</h1>
      <div className={clsx(ui.card, "mt-6 p-5 sm:p-6")}>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sun-ink">Not built yet</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{soon}</p>
        <p className="mt-3 text-sm text-ink-2">Nothing here affects your quotes or proposals until it is.</p>
      </div>
    </div>
  );
}
