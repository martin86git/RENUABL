"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  LogOut,
  MessageCircle,
  Settings,
  SlidersHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import type { Notification } from "@/lib/server/design-notifications-repo";
import { loadNotifications, loadWeather, markNotificationsRead, shortDate } from "@/lib/services/crm";
import { MessagesPage } from "./chat-panel";
import { SignOut } from "./design-account";

/**
 * The menus top right of every screen (31 Oct 2026, as Primero's): one floating white card of round icons, each a
 * window over the page rather than a page of its own. Black when open, a count in the signal orange while something waits.
 */

/** Closes a window when the pointer goes down outside it, on Escape, and when the page changes. */
function useWindow(): [boolean, (open: boolean) => void, React.RefObject<HTMLDivElement | null>] {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [was, setWas] = useState(path);
  if (was !== path) {
    setWas(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return [open, setOpen, box];
}

const ICON = "relative flex size-9 items-center justify-center rounded-full transition-colors";
const iconLook = (on: boolean) => (on ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas hover:text-ink");

/** A count on an icon: the signal orange, ringed off the card. */
export function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-surface">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** A round icon that is a link (the design tool). */
export function TopIcon(props: { href: string; label: string; icon: LucideIcon; on?: boolean; badge?: number }) {
  return (
    <Link
      href={props.href}
      title={props.label}
      aria-label={props.label}
      aria-current={props.on ? "page" : undefined}
      className={clsx(ICON, iconLook(Boolean(props.on)))}
    >
      <props.icon className="size-[18px]" aria-hidden />
      <Count n={props.badge ?? 0} />
    </Link>
  );
}

/** The day and the temperature, as one short line at the start of the card, with a hairline after it. */
export function DayPill() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<{ place: string; degrees: number | null } | null>(null);
  useEffect(() => {
    // The day is only known once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    let gone = false;
    void loadWeather().then((res) => !gone && res.ok && setWeather({ place: res.place, degrees: res.degrees }));
    return () => {
      gone = true;
      window.clearInterval(tick);
    };
  }, []);
  const day = now
    ? new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, weekday: "short", day: "numeric", month: "short" }).format(now)
    : " ";
  const time = now ? now.toLocaleTimeString("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "2-digit" }) : "";
  return (
    <span className="flex items-center gap-2 pl-3 pr-1 text-[13px] text-ink-2" title={weather ? `${weather.place}, now` : undefined}>
      <span className="whitespace-nowrap">{day}</span>
      {time && <span className="hidden whitespace-nowrap tabular-nums text-muted xl:inline">{time}</span>}
      {weather?.degrees !== null && weather?.degrees !== undefined && (
        <span className="whitespace-nowrap tabular-nums text-sun-ink">{weather.degrees}°</span>
      )}
      <span className="ml-1 h-5 w-px bg-line" aria-hidden />
    </span>
  );
}

/**
 * Messages: the customers' conversations about their proposals in a window over the page, the same list as the page of
 * its own, answered there. "Full page" opens it alone.
 */
export function MessagesMenu({ badge, href }: { badge: number; href: string }) {
  const [open, setOpen, box] = useWindow();
  const label = badge ? `Messages: ${badge} unread` : "Messages";
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={clsx(ICON, iconLook(open))}
      >
        <MessageCircle className="size-[18px]" aria-hidden />
        <Count n={badge} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Messages"
          className="absolute right-0 top-11 z-50 flex h-[78vh] w-[min(64rem,94vw)] flex-col overflow-hidden rounded-2xl bg-canvas text-ink shadow-2xl ring-1 ring-line"
        >
          <WindowHead title="Messages" full={href} onClose={() => setOpen(false)} />
          <div className="staff-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <MessagesPage />
          </div>
        </div>
      )}
    </div>
  );
}

function WindowHead(props: { title: string; full: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
      <p className="text-sm font-semibold">{props.title}</p>
      <div className="flex items-center gap-1">
        <Link
          href={props.full}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 hover:bg-canvas hover:text-ink"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Full page
        </Link>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={`Close ${props.title.toLowerCase()}`}
          className="flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Notifications under the bell: this member's mentions, asked for each time it opens, each opening its deal. */
export function NotificationsMenu({ badge, full, deal }: { badge: number; full: string; deal: (id: string) => string }) {
  const [open, setOpen, box] = useWindow();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const told = () => window.dispatchEvent(new Event("renuabl:notifications"));
  const show = (to: boolean) => {
    setOpen(to);
    if (!to) return;
    setProblem(null);
    void loadNotifications().then((res) => (res.ok ? setItems(res.notifications) : setProblem(res.message)));
  };
  const read = async (which: { ids?: string[]; all?: boolean }) => {
    const res = await markNotificationsRead(which);
    if (!res.ok) return setProblem(res.message);
    setItems((all) => (all ?? []).map((n) => (which.all || which.ids?.includes(n.id) ? { ...n, read: true } : n)));
    told();
  };
  const unread = (items ?? []).filter((n) => !n.read).length;
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => show(!open)}
        title="Notifications"
        aria-label={badge ? `Notifications: ${badge} unread` : "Notifications"}
        aria-expanded={open}
        className={clsx(ICON, iconLook(open))}
      >
        <Bell className="size-[18px]" aria-hidden />
        <Count n={badge} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 flex max-h-[70vh] w-[26rem] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void read({ all: true })}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 hover:bg-canvas hover:text-ink"
                >
                  <CheckCheck className="size-3.5" aria-hidden /> Mark all read
                </button>
              )}
              <Link
                href={full}
                className="inline-flex h-7 items-center rounded-full px-2.5 text-xs text-ink-2 hover:bg-canvas hover:text-ink"
              >
                All
              </Link>
            </div>
          </div>
          <div className="staff-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {problem && <p className="px-3 py-4 text-sm text-warning">{problem}</p>}
            {!items && !problem && <p className="animate-pulse px-3 py-6 text-center text-sm text-muted">Looking…</p>}
            {items?.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nothing yet. No one has mentioned you.</p>}
            {items?.map((n) => (
              <div key={n.id} className={clsx("rounded-xl px-3 py-2.5", !n.read && "bg-sun/60")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {n.by.split("@")[0]} mentioned you · {n.customer}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted">{shortDate(n.at)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{n.text}</p>
                <div className="mt-1.5 flex gap-3 text-xs font-medium">
                  <Link href={deal(n.jobId)} className="text-ink underline underline-offset-4">
                    Open deal
                  </Link>
                  {!n.read && (
                    <button type="button" onClick={() => void read({ ids: [n.id] })} className="text-ink-2 hover:text-ink">
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The gear: who is signed in, Settings, the account, and signing out. */
export function GearMenu(props: { email: string; settings: string; account: string; on: boolean }) {
  const [open, setOpen, box] = useWindow();
  const row = (label: string, href: string, Icon: LucideIcon) => (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-canvas">
      <Icon className="size-4" aria-hidden /> {label}
    </Link>
  );
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Settings and your account"
        title="Settings and your account"
        className={clsx(ICON, iconLook(open || props.on))}
      >
        <Settings className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl bg-surface p-2 shadow-2xl ring-1 ring-line">
          <p className="truncate px-3 pb-2 pt-1 text-xs text-muted">{props.email}</p>
          {row("Settings", props.settings, SlidersHorizontal)}
          {row("Your account", props.account, UserRound)}
          <div className="mt-2 flex items-center gap-3 border-t border-line px-3 pt-3 text-sm">
            <LogOut className="size-4 text-muted" aria-hidden />
            <SignOut className="font-medium text-ink-2 hover:text-ink" />
          </div>
        </div>
      )}
    </div>
  );
}
