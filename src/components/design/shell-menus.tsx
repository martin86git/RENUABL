"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  LogOut,
  MessageSquarePlus,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UserRound,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Sky } from "@/lib/domain/weather";
import clsx from "clsx";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import type { Notification } from "@/lib/server/design-notifications-repo";
import type { ChatThread } from "@/lib/domain/design/chat";
import { loadNotifications, loadWeather, markNotificationsRead, shortDate } from "@/lib/services/crm";
import { lineTime, loadMessages } from "@/lib/services/chat";
import { SignOut } from "./design-account";
import { MyCalendar } from "./my-calendar";
import { CONNECT_RESULTS } from "@/lib/domain/design/my-calendar";

/**
 * The menus round the edges of every screen (31 Oct 2026, as Primero's; 3 Nov 2026, Martin: a quieter top right). Top
 * right, one small card: the date and the weather as a tile, and the profile round whose menu holds Settings and the
 * account. Notifications (the customers' messages and mentions together) and email sit on the rail down the right. Each
 * is a window over the page rather than a page of its own. Black when open, a count in the signal orange while something waits.
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

/** The rail's rounds are a touch larger than the top card's. */
const RAIL_ICON = "relative flex size-10 items-center justify-center rounded-full transition-colors";
const railLook = (on: boolean) => (on ? "bg-ink text-sun-line" : "text-ink-2 hover:bg-canvas hover:text-ink");

/** A round on the rail down the right that is a link (email). */
export function RailIcon(props: { href: string; label: string; icon: LucideIcon; on?: boolean; badge?: number }) {
  return (
    <Link
      href={props.href}
      title={props.label}
      aria-label={props.badge ? `${props.label}: ${props.badge} unread` : props.label}
      aria-current={props.on ? "page" : undefined}
      className={clsx(RAIL_ICON, railLook(Boolean(props.on)))}
    >
      <props.icon className="size-[18px]" aria-hidden />
      <Count n={props.badge ?? 0} />
    </Link>
  );
}

/** Each kind of sky as its icon, its words and its colour (the sun in the signal orange, rain in the Marketplace blue). */
const SKY: Record<Sky, { icon: LucideIcon; words: string; tone: string }> = {
  clear: { icon: Sun, words: "Sunny", tone: "text-sun-line" },
  "clear-night": { icon: Moon, words: "Clear", tone: "text-ink-2" },
  partly: { icon: CloudSun, words: "Partly cloudy", tone: "text-sun-line" },
  "partly-night": { icon: CloudMoon, words: "Partly cloudy", tone: "text-ink-2" },
  cloudy: { icon: Cloud, words: "Overcast", tone: "text-muted" },
  rain: { icon: CloudRain, words: "Rain", tone: "text-market" },
  storm: { icon: CloudLightning, words: "Storms", tone: "text-market" },
  snow: { icon: CloudSnow, words: "Snow or hail", tone: "text-muted" },
  fog: { icon: CloudFog, words: "Fog", tone: "text-muted" },
  wind: { icon: Wind, words: "Windy", tone: "text-muted" },
};

/**
 * The date and the weather as one small tile (3 Nov 2026, Martin: less room, no time): a calendar leaf with the
 * weekday over the day of the month, and the temperature beside it with an icon for the sky (sun, cloud, rain…).
 * The full date, the sky and the place are in its title. Pressed, it opens the member's own calendar over the page
 * (5 Nov 2026, Martin; `MyCalendar`), or asks them to connect one.
 */
export function DayWeather() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<{ place: string; degrees: number | null; sky: Sky | null } | null>(null);
  const [open, setOpen, box] = useWindow();
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    // The day is only known once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 10 * 60_000);
    let gone = false;
    void loadWeather().then((res) => !gone && res.ok && setWeather({ place: res.place, degrees: res.degrees, sky: res.sky ?? null }));
    // Back from connecting a calendar with Google: open it, say how it went, and tidy the address.
    const url = new URL(window.location.href);
    const came = url.searchParams.get("calendar");
    if (came && came in CONNECT_RESULTS) {
      setNote(CONNECT_RESULTS[came]);
      setOpen(true);
      url.searchParams.delete("calendar");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return () => {
      gone = true;
      window.clearInterval(tick);
    };
  }, [setOpen]);
  const part = (o: Intl.DateTimeFormatOptions) =>
    now ? new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, ...o }).format(now) : "";
  const degrees = weather?.degrees ?? null;
  const sky = weather?.sky ? SKY[weather.sky] : null;
  const title = [
    part({ weekday: "long", day: "numeric", month: "long" }),
    degrees !== null ? `${sky ? `${sky.words}, ` : ""}${degrees}° in ${weather?.place}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${title || "Today"}. Open your calendar`}
        title={title || undefined}
        className={clsx(
          "flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-1.5 transition-colors",
          open ? "bg-canvas" : "hover:bg-canvas",
        )}
      >
        <span className="flex w-8 flex-col items-center overflow-hidden rounded-md bg-surface ring-1 ring-line" aria-hidden>
          <span className="w-full bg-sun-line text-center text-[8px] font-semibold uppercase leading-[11px] tracking-wider text-white">
            {part({ weekday: "short" }) || " "}
          </span>
          <span className="text-[13px] font-semibold leading-[19px] tabular-nums text-ink">{part({ day: "numeric" })}</span>
        </span>
        {degrees !== null && (
          <span className="flex items-center gap-1 text-[13px] tabular-nums text-ink-2" aria-hidden>
            {sky && <sky.icon className={clsx("size-4", sky.tone)} strokeWidth={2} />}
            {degrees}°
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 rounded-3xl bg-surface p-4 shadow-2xl ring-1 ring-line">
          <MyCalendar note={note} />
        </div>
      )}
    </div>
  );
}

/**
 * Notifications on the rail (3 Nov 2026, Martin: the customers' chat folds in here): what customers have written from
 * their proposals, those waiting first, then this member's mentions. Asked for each time it opens, each opening its
 * deal. It opens to the left of the rail.
 */
export function NotificationsMenu(props: {
  /** Customers' lines nobody has read, and this member's unread mentions. */
  messages: number;
  mentions: number;
  full: string;
  messagesFull: string;
  /** On the rail it opens to its left; in the top card (the design tool, where the rail is put away) it opens below. */
  place?: "rail" | "top";
  deal: (id: string) => string;
}) {
  const [open, setOpen, box] = useWindow();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const told = () => window.dispatchEvent(new Event("renuabl:notifications"));
  const show = (to: boolean) => {
    setOpen(to);
    if (!to) return;
    setProblem(null);
    void loadNotifications().then((res) => (res.ok ? setItems(res.notifications) : setProblem(res.message)));
    void loadMessages().then((res) => setThreads(res.ok ? res.threads : []));
  };
  const read = async (which: { ids?: string[]; all?: boolean }) => {
    const res = await markNotificationsRead(which);
    if (!res.ok) return setProblem(res.message);
    setItems((all) => (all ?? []).map((n) => (which.all || which.ids?.includes(n.id) ? { ...n, read: true } : n)));
    told();
  };
  const unread = (items ?? []).filter((n) => !n.read).length;
  const badge = props.messages + props.mentions;
  // Those waiting on a reply first, then the latest few, so the window stays short.
  const recent = threads ? [...threads.filter((t) => t.unread > 0), ...threads.filter((t) => !t.unread)].slice(0, 5) : null;
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => show(!open)}
        title="Notifications"
        aria-label={badge ? `Notifications: ${badge} unread` : "Notifications"}
        aria-expanded={open}
        className={props.place === "top" ? clsx(ICON, iconLook(open)) : clsx(RAIL_ICON, railLook(open))}
      >
        <Bell className="size-[18px]" aria-hidden />
        <Count n={badge} />
      </button>
      {open && (
        <div
          className={clsx(
            "absolute z-50 flex max-h-[76vh] w-[26rem] max-w-[calc(100vw-6rem)] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line",
            props.place === "top" ? "right-0 top-11" : "right-full top-1/2 mr-3 -translate-y-1/2",
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void read({ all: true })}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 hover:bg-canvas hover:text-ink"
              >
                <CheckCheck className="size-3.5" aria-hidden /> Mark mentions read
              </button>
            )}
          </div>
          <div className="staff-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {problem && <p className="px-3 py-4 text-sm text-warning">{problem}</p>}
            <Heading label="From customers" href={props.messagesFull} more="All messages" />
            {!recent && <p className="animate-pulse px-3 py-3 text-sm text-muted">Looking…</p>}
            {recent?.length === 0 && <p className="px-3 pb-3 pt-1 text-[13px] text-muted">No messages from customers yet.</p>}
            {recent?.map((t) => (
              <Link
                key={t.jobId}
                href={`${props.deal(t.jobId)}?tab=chat`}
                className={clsx("block rounded-xl px-3 py-2.5 hover:bg-canvas", t.unread > 0 && "bg-sun/60")}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className={clsx("truncate text-[13px] text-ink", t.unread > 0 && "font-semibold")}>
                    {t.customerName}
                    {t.unread > 0 && <span className="ml-1.5 text-[11px] font-semibold text-sun-ink">{t.unread} new</span>}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{lineTime(t.at)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-ink-2">{t.last}</span>
              </Link>
            ))}
            <Heading label="Mentions" href={props.full} more="All mentions" />
            {!items && !problem && <p className="animate-pulse px-3 py-3 text-sm text-muted">Looking…</p>}
            {items?.length === 0 && <p className="px-3 pb-3 pt-1 text-[13px] text-muted">No one has mentioned you.</p>}
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
                  <Link href={props.deal(n.jobId)} className="text-ink underline underline-offset-4">
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

function Heading({ label, href, more }: { label: string; href: string; more: string }) {
  return (
    <p className="flex items-baseline justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted first:pt-1">
      {label}
      <Link href={href} className="text-[11px] font-medium normal-case tracking-normal text-ink-2 hover:text-ink">
        {more}
      </Link>
    </p>
  );
}

/** The two letters a profile round shows: the first of each part of the email's name, else its first two. */
function initialsOf(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase() || "?";
}

/** The profile round (3 Nov 2026, Martin: it replaced the gear): who is signed in, Settings, the account, and signing out. */
export function ProfileMenu(props: {
  email: string;
  settings: string;
  account: string;
  updates: string;
  feedback: string;
  /** For an installer: its connections, with how many ask to connect. */
  connections?: { href: string; waiting: number };
  /** Updates since this member last opened them. */
  unseen: number;
  on: boolean;
}) {
  const [open, setOpen, box] = useWindow();
  const row = (label: string, href: string, Icon: LucideIcon, n = 0) => (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-canvas">
      <Icon className="size-4" aria-hidden /> <span className="flex-1">{label}</span>
      {n > 0 && <span className="rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white">{n}</span>}
    </Link>
  );
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Your profile, settings and account"
        title={props.email}
        className={clsx(
          "relative flex size-9 items-center justify-center rounded-full text-[12px] font-semibold tracking-wide transition-colors",
          open || props.on ? "bg-ink text-white" : "bg-surface-2 text-ink hover:bg-line",
        )}
      >
        {initialsOf(props.email)}
        {props.unseen > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-sun-line ring-2 ring-surface"
            aria-label={`${props.unseen} new updates`}
          />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl bg-surface p-2 shadow-2xl ring-1 ring-line">
          <p className="truncate px-3 pb-2 pt-1 text-xs text-muted">{props.email}</p>
          {row("Settings", props.settings, SlidersHorizontal)}
          {row("Your account", props.account, UserRound)}
          {props.connections && row("Connections", props.connections.href, Users, props.connections.waiting)}
          <div className="my-1 border-t border-line" />
          {row("Updates", props.updates, Sparkles, props.unseen)}
          {row("Feedback", props.feedback, MessageSquarePlus)}
          <div className="mt-2 flex items-center gap-3 border-t border-line px-3 pt-3 text-sm">
            <LogOut className="size-4 text-muted" aria-hidden />
            <SignOut className="font-medium text-ink-2 hover:text-ink" />
          </div>
        </div>
      )}
    </div>
  );
}
