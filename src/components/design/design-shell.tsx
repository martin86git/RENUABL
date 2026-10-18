"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FileSignature,
  MessageSquare,
  ReceiptText,
  Send,
  Truck,
  HardHat,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  PenTool,
  SlidersHorizontal,
  SquareKanban,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { loadWeather } from "@/lib/services/crm";
import { useUnreadMessages } from "./chat-panel";
import { DesignAccountGate, SignOut, useDesignAccount } from "./design-account";

/** Where everything in the product lives. */
export const PATHS = {
  home: "/design",
  sales: "/design/sales",
  pipelines: "/design/sales/pipelines",
  deals: "/design/deals",
  installations: "/design/installations",
  customers: "/design/customers",
  designer: "/design/roof",
  messages: "/design/messages",
  proposalsSent: "/design/sales/proposals",
  proposalsSigned: "/design/sales/signed",
  scheduler: "/design/installations/scheduler",
  orders: "/design/installations/orders",
  invoices: "/design/installations/invoices",
  settings: "/design/settings",
  brand: "/design/settings/company",
  account: "/design/account",
  signIn: "/design/sign-in",
} as const;

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other places that belong to this section: a deal's own page is part of Sales. */
  also?: string[];
  /** The main tool: marked in the signal colour so it stands out from the sections. */
  main?: boolean;
  /** Its subsections, listed under it. */
  under?: { href: string; label: string; icon: LucideIcon; also?: string[] }[];
}

const NAV: NavItem[] = [
  { href: PATHS.home, label: "Overview", icon: LayoutDashboard },
  { href: PATHS.customers, label: "Customers", icon: Users },
  {
    href: PATHS.pipelines,
    label: "Sales",
    icon: TrendingUp,
    also: [PATHS.sales, PATHS.deals],
    under: [
      { href: PATHS.pipelines, label: "Pipelines", icon: SquareKanban, also: [PATHS.deals] },
      { href: PATHS.proposalsSent, label: "Proposals sent", icon: Send },
      { href: PATHS.proposalsSigned, label: "Signed proposals", icon: FileSignature },
    ],
  },
  {
    href: PATHS.installations,
    label: "Installations",
    icon: HardHat,
    under: [
      { href: PATHS.installations, label: "In the works", icon: HardHat },
      { href: PATHS.scheduler, label: "Install Scheduler", icon: CalendarDays },
      { href: PATHS.orders, label: "Ordering Station", icon: Truck },
      { href: PATHS.invoices, label: "Installer Invoices", icon: ReceiptText },
    ],
  },
  { href: PATHS.messages, label: "Messages", icon: MessageSquare },
  { href: PATHS.designer, label: "Design tool", icon: PenTool, main: true },
];

/**
 * The frame every signed-in screen sits in: the product's sections down the
 * left (Overview, Customers, Sales with its Pipelines, Installations, and the
 * Design tool in orange, as the main tool), with the business's settings
 * and account at its foot. The sections can be folded down to icons and opened
 * out again (kept on the device). `compact` keeps only the icons, for the design
 * tool, where the roof needs the room. On a phone the sections run across the
 * top instead. Signed out, a screen that needs an account (`needsAccount`)
 * asks for one; the others (the design tool, its settings) are shown bare, as
 * they work on the device without one.
 */
export function DesignShell(props: { children: React.ReactNode; compact?: boolean; needsAccount?: boolean }) {
  return (
    <DesignAccountGate>
      <Shell {...props} />
    </DesignAccountGate>
  );
}

/** Whether this person keeps the sections folded down to icons, on their device. */
const FOLDED = "renuabl.design.nav-folded";

function Shell({ children, compact: tool, needsAccount }: { children: React.ReactNode; compact?: boolean; needsAccount?: boolean }) {
  // The sections can be folded down to their icons, as they always are on the design tool, and opened out again.
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      // What was chosen last time is only known once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFolded(window.localStorage.getItem(FOLDED) === "1");
    } catch {
      // Opened out, then.
    }
  }, []);
  const fold = (to: boolean) => {
    setFolded(to);
    try {
      window.localStorage.setItem(FOLDED, to ? "1" : "0");
    } catch {
      // It still holds for this visit.
    }
  };
  const compact = tool || folded;
  const [account] = useDesignAccount();
  // How many of the customers' messages nobody has seen: the number on Messages. Asked only for a signed-in business.
  const unread = useUnreadMessages(Boolean(account?.signedIn && account.business));
  const path = usePathname();
  if (!account) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  if (!account.signedIn) {
    if (!needsAccount) return <>{children}</>;
    return (
      <div className="theme-studio flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <Wordmark />
        <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink-2">
          {account.unreachable
            ? "We couldn't reach your account just now. Try again in a moment."
            : "Sign in to your business to see this."}
        </p>
        <Link
          href={PATHS.home}
          className="mt-5 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-ink hover:bg-forest"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // The overview and the settings have pages beneath them that are their own entries here, so each is lit only on its own page.
  const within = (href: string) => (href === PATHS.home ? path === href : path === href || path.startsWith(`${href}/`));
  const active = (href: string, also: string[] = []) => [href, ...also].some(within);
  /** The one subsection you are in: the most particular of those that hold this page (Installations' own list holds its others). */
  const here = (under: NonNullable<NavItem["under"]>) =>
    under.filter((u) => active(u.href, u.also)).sort((a, b) => b.href.length - a.href.length)[0];
  const item = (href: string, label: string, Icon: LucideIcon, also?: string[], main?: boolean) => (
    <Link
      key={href}
      href={href}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      aria-current={active(href, also) ? "page" : undefined}
      className={clsx(
        "flex h-10 shrink-0 items-center gap-3 rounded-md text-sm font-medium",
        compact ? "w-10 justify-center lg:w-10" : "px-3",
        main
          ? // The main tool keeps its orange whether or not it is where you are; there it is ringed too.
            clsx("bg-sun-line text-white hover:brightness-95", active(href, also) && "ring-2 ring-ink ring-offset-2 ring-offset-surface")
          : active(href, also)
            ? "bg-primary text-primary-ink"
            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <span className="relative shrink-0">
        <Icon className="size-[18px]" aria-hidden />
        {/* Folded down to icons, the count rides on the icon. */}
        {compact && href === PATHS.messages && unread > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-sun-line px-1 text-[10px] font-semibold leading-4 text-white">
            {unread}
          </span>
        )}
      </span>
      {!compact && <span className="truncate">{label}</span>}
      {!compact && href === PATHS.messages && unread > 0 && (
        <span
          className="ml-auto rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white"
          aria-label={`${unread} unread`}
        >
          {unread}
        </span>
      )}
    </Link>
  );

  return (
    <div className="theme-studio flex min-h-dvh flex-col lg:flex-row">
      <nav
        aria-label="Sections"
        className={clsx(
          "z-40 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 print:hidden",
          "lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:items-stretch lg:overflow-visible lg:border-b-0 lg:border-r lg:px-2.5 lg:py-4",
          compact ? "lg:w-[3.75rem]" : "lg:w-56",
        )}
      >
        <Link
          href={PATHS.home}
          aria-label="RENUABL"
          className={clsx("mr-3 shrink-0 lg:mb-5 lg:mr-0", compact ? "lg:text-center" : "lg:px-3")}
        >
          {compact ? (
            <span className="hidden text-[17px] font-normal tracking-[0.1em] text-ink lg:inline">R</span>
          ) : (
            <Wordmark className="text-[16px]" />
          )}
          {compact && <Wordmark className="text-[16px] lg:hidden" />}
        </Link>
        {/* The little arrow beside the wordmark, on the nav's edge: folds the sections down to icons, and opens them out. */}
        {!tool && (
          <button
            onClick={() => fold(!folded)}
            title={folded ? "Open out the sections" : "Fold the sections down to icons"}
            aria-label={folded ? "Open out the sections" : "Fold the sections down to icons"}
            aria-expanded={!folded}
            className="absolute -right-3 top-[1.05rem] hidden size-6 items-center justify-center rounded-full bg-surface text-ink-2 shadow-[var(--shadow-soft)] ring-1 ring-line hover:text-ink hover:ring-ink-2 lg:flex"
          >
            {folded ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronLeft className="size-3.5" aria-hidden />}
          </button>
        )}
        {NAV.map((n) =>
          // A section with subsections is a heading over them: the subsection carries the mark of where you are.
          n.under && !compact ? (
            <div key={n.label} className="contents lg:block">
              <Link
                href={n.href}
                className={clsx(
                  "hidden h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium lg:flex",
                  active(n.href, n.also) ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <n.icon className="size-[18px] shrink-0" aria-hidden />
                <span className="truncate">{n.label}</span>
              </Link>
              <div className="contents lg:ml-[1.3rem] lg:block lg:border-l lg:border-line lg:pl-2">
                {n.under.map((u) => (
                  <Link
                    key={u.label}
                    href={u.href}
                    aria-current={u === here(n.under!) ? "page" : undefined}
                    className={clsx(
                      "flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium lg:h-9 lg:gap-2.5 lg:text-[13px]",
                      u === here(n.under!) ? "bg-primary text-primary-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <u.icon className="size-[18px] shrink-0 lg:size-4" aria-hidden />
                    <span className="truncate">{u.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            item(n.href, n.label, n.icon, n.also, n.main)
          ),
        )}
        <span className="hidden flex-1 lg:block" aria-hidden />
        {item(PATHS.settings, "Settings", SlidersHorizontal, [PATHS.account])}
        {!compact && (
          <div className="hidden px-3 pt-2 lg:block">
            <p className="truncate text-[11px] text-muted">{account.email}</p>
            <SignOut className="mt-1 text-[12px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink" />
          </div>
        )}
      </nav>
      <div className="relative min-w-0 flex-1">
        {!tool && <NowWidget />}
        {children}
      </div>
    </div>
  );
}

/**
 * The time, the date and the temperature, in the top right corner of every
 * main screen (never the design tool, where the roof has the room). The clock
 * is the market's own time whatever the device is set to. The temperature is
 * the market capital's for now, named beside it, and simply isn't shown when
 * it can't be had.
 */
function NowWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<{ place: string; degrees: number | null } | null>(null);
  useEffect(() => {
    // The time is only known once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 15_000);
    let gone = false;
    const read = () =>
      void loadWeather().then((res) => {
        if (!gone && res.ok) setWeather({ place: res.place, degrees: res.degrees });
      });
    read();
    const again = window.setInterval(read, 900_000);
    return () => {
      gone = true;
      window.clearInterval(tick);
      window.clearInterval(again);
    };
  }, []);
  if (!now) return null;
  const zone = { timeZone: LAUNCH_MARKET.timeZone } as const;
  const time = now.toLocaleTimeString("en-AU", { ...zone, hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-AU", { ...zone, weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="flex justify-end px-5 pt-4 print:hidden lg:px-10" aria-label="Now">
      <div className="inline-flex h-10 items-center gap-3 rounded-full bg-surface px-4 text-[13px] shadow-[var(--shadow-soft)] ring-1 ring-line">
        {weather && weather.degrees !== null && (
          <>
            <span className="tabular-nums text-ink" title={`Temperature in ${weather.place} now`}>
              {weather.degrees}°C <span className="text-muted">{weather.place}</span>
            </span>
            <span className="h-4 w-px bg-line" aria-hidden />
          </>
        )}
        <time className="tabular-nums font-medium text-ink" dateTime={now.toISOString()}>
          {time}
        </time>
        <span className="h-4 w-px bg-line" aria-hidden />
        <span className="text-ink-2">{date}</span>
      </div>
    </div>
  );
}

/** The heading every section's page opens with, and room for its main action. */
export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
        <h1 className="mt-1.5 text-[28px] leading-tight tracking-tight text-ink">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Shared looks for the sections' screens. */
export const ui = {
  page: "mx-auto w-full max-w-6xl px-5 py-8 lg:px-10",
  card: "rounded-lg bg-surface shadow-[var(--shadow-soft)] ring-1 ring-line",
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted",
  quiet:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-forest disabled:bg-surface-2 disabled:text-muted",
  input:
    "block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-forest disabled:bg-surface-2 disabled:text-muted",
  label: "block text-[13px] font-medium text-ink-2",
  eyebrow: "text-[11px] font-medium uppercase tracking-[0.16em] text-muted",
  link: "font-medium text-ink underline underline-offset-4 hover:text-ink-2",
} as const;
