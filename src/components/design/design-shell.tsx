"use client";

import { tradeUnreadCount } from "@/lib/services/trade";
import { incomingRequests } from "@/lib/services/connections";
import { waitingJobs } from "@/lib/services/job-shares";
import { nominatedInspections } from "@/lib/services/inspections";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { inboxUnread } from "@/lib/services/inbox";
import { stopViewing } from "@/lib/services/design-account";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessagesSquare,
  PenTool,
  Search,
  SquareKanban,
  Store,
  Users,
  Wrench,
  type LucideIcon,
  Mail,
} from "lucide-react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { KIND_SECTIONS, designsRoofs, pageAt, sectionAt } from "@/lib/domain/design/sections";
import { MarketplaceMark, MarketplaceMenu } from "./marketplace-bar";
import { BUSINESS_KINDS, cleanKind, pageAllowed, type BusinessKind } from "@/lib/domain/design/business-kind";
import { staffView } from "./staff-view-as";
import { notificationCount, serviceCount, approvalCounts, updatesUnseen } from "@/lib/services/crm";
import { useUnreadMessages } from "./chat-panel";
import { DesignAccountGate, SignOut, useDesignAccount } from "./design-account";
import { PageSearch } from "./page-search";
import { SolDock, SolNavButton, SolRail } from "./sol-dock";
import { DrawerFrameLinks, ShellDesignDrawer, useInDrawer } from "./design-drawer";
import { TeamChatButton } from "./team-chat";
import { DayWeather, NotificationsMenu, ProfileMenu, RailIcon, TopIcon } from "./shell-menus";

export { MarketplaceMark };

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
  service: "/design/service",
  notifications: "/design/notifications",
  sol: "/design/sol",
  team: "/design/team",
  updates: "/design/updates",
  inbox: "/design/inbox",
  marketplace: "/design/marketplace",
  feedback: "/design/feedback",
  proposalsSent: "/design/sales/proposals",
  proposalsSigned: "/design/sales/signed",
  scheduler: "/design/procurement/scheduler",
  orders: "/design/procurement/orders",
  jobMap: "/design/procurement/map",
  invoices: "/design/installations/invoices",
  underway: "/design/installations/underway",
  completed: "/design/installations/completed",
  settings: "/design/settings",
  brand: "/design/settings/company",
  account: "/design/account",
  signIn: "/design/sign-in",
} as const;

type PhoneTab = { label: string; href: string; icon: LucideIcon; match: (path: string) => boolean };

/**
 * The phone's foot bar: the places used most, under the thumb, with Sol raised in the middle (1 Nov 2026, Martin: Sol
 * was buried under More); everything else, the design tool first, is under More.
 */
/** An installer's and an inspector's foot bar: their sections, then More (no Sol: his answers read the CRM). */
const KIND_TABS: Record<Exclude<BusinessKind, "retailer">, PhoneTab[]> = {
  installer: [
    { label: "My Jobs", href: "/design", icon: Wrench, match: (p) => p === "/design" || p.startsWith("/design/jobs") },
    { label: "Designer", href: PATHS.designer, icon: PenTool, match: (p) => p.startsWith(PATHS.designer) },
    { label: "Marketplace", href: "/design/marketplace", icon: Store, match: (p) => p.startsWith("/design/marketplace") },
    { label: "Connections", href: "/design/connections", icon: Users, match: (p) => p.startsWith("/design/connections") },
  ],
  inspector: [
    { label: "Today", href: "/design", icon: LayoutDashboard, match: (p) => p === "/design" },
    { label: "Inspections", href: "/design/inspections", icon: ClipboardCheck, match: (p) => p.startsWith("/design/inspections") },
    {
      label: "Marketplace",
      href: marketplaceOpen() ? "/design/marketplace/equipment" : "/design/marketplace",
      icon: Store,
      match: (p) => p.startsWith("/design/marketplace"),
    },
    { label: "Connections", href: "/design/connections", icon: Users, match: (p) => p.startsWith("/design/connections") },
    { label: "Team", href: "/design/team", icon: MessagesSquare, match: (p) => p.startsWith("/design/team") },
  ],
};

const PHONE_TABS: [PhoneTab, PhoneTab, PhoneTab] = [
  { label: "Today", href: PATHS.home, icon: LayoutDashboard, match: (p) => p === PATHS.home },
  { label: "Deals", href: PATHS.pipelines, icon: SquareKanban, match: (p) => p.startsWith(PATHS.sales) || p.startsWith(PATHS.deals) },
  { label: "Messages", href: PATHS.messages, icon: MessageCircle, match: (p) => p.startsWith(PATHS.messages) },
];

/**
 * The frame every signed-in screen sits in (31 Oct 2026, Martin: Primero's layout, in RENUABL's own colours and type).
 * No bar down the left: across the top, the logo and Search on the left, the sections in one pill in the middle
 * (`SECTIONS` in domain/design/sections.ts) with the section on show's own pages as quiet toggles under it, and on the
 * right one floating card of round icons, each a window over the page (the day and weather, messages, notifications,
 * the design tool, the gear). Every page sits on the soft rounded pad. On a phone, the places used most along the foot
 * and the rest under More. `compact` is the design tool: the same top, no pad, so the roof has the room. `bare` drops
 * the frame (a page shown inside another). Signed out, a screen that needs an account (`needsAccount`) asks for one;
 * the others (the design tool, its settings) are shown bare, as they work on the device without one.
 */
/**
 * RENUABL Marketplace beside the sections (3 Nov 2026, Martin: the add-on network should read as a sub-brand, apart
 * from the business's own work): its mark white in a blue round, beside it RENUABL in small black capitals over
 * Marketplace in the signal orange, no pill behind them, and "Soon" while it is closed.
 */
function MarketplaceButton({ href, lit, waiting }: { href: string; lit: boolean; waiting: number }) {
  return (
    <Link
      href={href}
      aria-current={lit ? "true" : undefined}
      aria-label={`RENUABL Marketplace${marketplaceOpen() ? "" : ", coming soon"}`}
      className="group flex shrink-0 items-center gap-2.5 rounded-full pr-1"
    >
      <span
        className={clsx(
          "relative flex size-10 items-center justify-center rounded-full bg-market text-white shadow-[0_4px_14px_rgba(24,73,169,0.3)] transition group-hover:brightness-110",
          lit && "ring-2 ring-market/40 ring-offset-2 ring-offset-canvas",
        )}
      >
        <MarketplaceMark className="size-5" />
        {waiting > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-sun-line ring-2 ring-canvas"
            aria-label={`${waiting} waiting`}
          />
        )}
      </span>
      <span className="studio-market-words flex-col text-left leading-none">
        <span className="text-[9px] font-medium uppercase tracking-[0.26em] text-ink">RENUABL</span>
        <span className="mt-1 flex items-baseline gap-1.5 text-[15px] font-semibold tracking-[-0.01em] text-sun-line">
          Marketplace
          {!marketplaceOpen() && <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Soon</span>}
        </span>
      </span>
    </Link>
  );
}

export function DesignShell(props: { children: React.ReactNode; compact?: boolean; needsAccount?: boolean; bare?: boolean }) {
  return (
    <DesignAccountGate>
      <Shell {...props} />
    </DesignAccountGate>
  );
}

/** The pad every page sits on (Primero's `PAGE_PAD`): a soft grey ground with rounded corners, white cards on it. */
const PAD = "studio-pad min-h-[calc(100dvh-10rem)] rounded-[28px] bg-canvas p-4 sm:p-6";

function Shell({
  children,
  compact: tool,
  needsAccount,
  bare: bareAsked,
}: {
  children: React.ReactNode;
  compact?: boolean;
  needsAccount?: boolean;
  /** Without the frame: the page shown inside another, as the design tool is in a deal's drawer. */
  bare?: boolean;
}) {
  const [account] = useDesignAccount();
  // Inside the design drawer's frame every page is bare, wherever the designer goes within it.
  const bare = useInDrawer() || bareAsked;
  const on = Boolean(account?.signedIn && account.business);
  // What kind of business this login is (business-kind.ts): an installer or inspector has part of the product, and
  // nothing of the CRM is asked for.
  const kind: BusinessKind = cleanKind(account?.signedIn ? account.business?.kind : undefined);
  const retail = on && kind === "retailer";
  const sections = KIND_SECTIONS[kind];
  // How many of the customers' messages nobody has seen, the service cases to put right, and this member's unread mentions.
  const unread = useUnreadMessages(retail);
  const service = useServiceCount(retail);
  const mentions = useCount(retail, "renuabl:notifications", async () => {
    const res = await notificationCount();
    return res.ok ? res.unread : null;
  });
  // The approval gates' counts (Procurement), refreshed when a job is moved on from one.
  const [gates, setGates] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!retail) return;
    let gone = false;
    const look = () => void approvalCounts().then((res) => !gone && res.ok && setGates(res.counts));
    look();
    window.addEventListener("renuabl:approvals", look);
    return () => {
      gone = true;
      window.removeEventListener("renuabl:approvals", look);
    };
  }, [retail]);
  // Conversations about equipment with lines this business hasn't read (as seller or buyer).
  const trade = useCount(on && marketplaceOpen(), "renuabl:trade", async () => {
    const res = await tradeUnreadCount();
    return res.ok ? res.unread : null;
  });
  // Requests to connect waiting for this business's answer (connections.ts), every kind of business.
  const requests = useCount(on, "renuabl:connections", async () => {
    const res = await incomingRequests();
    return res.ok ? res.incoming : null;
  });
  // Jobs connected retailers have sent an installer, waiting for its answer (job-shares.ts).
  const sentJobs = useCount(on && kind === "installer", "renuabl:installer-jobs", async () => {
    const res = await waitingJobs();
    return res.ok ? res.waiting : null;
  });
  // Inspections installers have nominated an inspector for, not yet booked (inspections.ts).
  const toBook = useCount(on && kind === "inspector", "renuabl:inspections", async () => {
    const res = await nominatedInspections();
    return res.ok ? res.nominated : null;
  });
  const counts: Record<string, number> = {
    service,
    ...gates,
    // Unread Marketplace conversations: on Messages, and on My equipment for a retailer (whose toggles still show it).
    messages: trade,
    "my-equipment": kind === "retailer" ? trade : 0,
    connections: requests,
    jobs: sentJobs,
    inspections: toBook,
  };
  // Gmail's own unread count on the envelope, asked each minute while the page is in view (0 until Gmail is connected).
  const mail = useCount(retail, "renuabl:inbox", async () => {
    const res = await inboxUnread();
    return res.ok ? res.unread : null;
  });
  // Updates since this member last opened them: a count on the gear (wave 7).
  const updates = useCount(on, "renuabl:updates", async () => {
    const res = await updatesUnseen();
    return res.ok ? res.unseen : null;
  });
  const path = usePathname();
  const router = useRouter();
  // A page that isn't part of this login (an installer following a link to a deal) goes back to its Today.
  const away = on && !pageAllowed(kind, path);
  useEffect(() => {
    if (away) router.replace("/design");
  }, [away, router]);
  const [searching, setSearching] = useState(false);
  const [more, setMore] = useState(false);
  // Ctrl K or ⌘K opens the search from anywhere.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

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
  if (bare)
    return (
      <div className="theme-studio min-h-dvh">
        <DrawerFrameLinks />
        {children}
      </div>
    );

  if (away) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  const here = pageAt(path, kind);
  const current = sectionAt(path, kind);
  const count = (pageId: string) => counts[pageId] ?? 0;
  const settingsOn = path.startsWith(PATHS.settings) || path.startsWith(PATHS.account);

  return (
    <div className="theme-studio studio-frame min-h-dvh pb-24 lg:pb-0">
      {/* The design tool slides over whatever page this is, never a page of its own. */}
      <ShellDesignDrawer />
      {/* The owner viewing as someone else: whose view it is, that nothing can be changed, and the way back. */}
      {account.viewedBy && (
        <div className="sticky top-0 z-[45] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sun-line px-4 py-2 text-center text-sm text-white print:hidden">
          <span>
            Viewing as <strong className="font-semibold">{account.email}</strong>. Read only: nothing can be changed.
          </span>
          <button
            type="button"
            onClick={async () => {
              await stopViewing();
              window.location.replace(PATHS.account);
            }}
            className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-ink"
          >
            Back to my own view
          </button>
        </div>
      )}
      {/* RENUABL staff looking through a sample business (Settings → View as): which kind, and the way back to their own sign-in. */}
      {account.staffViewing && (
        <div className="sticky top-0 z-[45] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sun-line px-4 py-2 text-center text-sm text-white print:hidden">
          <span>
            Viewing as {account.staffViewing === "inspector" ? "an" : "a"}{" "}
            <strong className="font-semibold">
              {BUSINESS_KINDS.find((k) => k.kind === account.staffViewing)?.label.toLowerCase() ?? account.staffViewing}
            </strong>
            : {account.business?.name}, a sample business.
          </span>
          <Link href="/design/settings/view-as" className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
            Switch
          </Link>
          <button
            type="button"
            onClick={async () => {
              await staffView("own");
              window.location.replace("/design/settings/view-as");
            }}
            className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-ink"
          >
            Back to my account
          </button>
        </div>
      )}
      {/* Across the top on a wide screen: the logo, the sections (with the design tool in orange and Sol at the end), and on
          the right the search, the Marketplace and a small card with the date and weather and the profile round. */}
      <header
        className={clsx("studio-top z-[35] hidden bg-canvas/90 backdrop-blur print:hidden lg:block lg:px-14", !tool && "sticky top-0")}
      >
        {/* The sections sit in the middle of the screen (3 Nov 2026, Martin: on a laptop they didn't): two equal sides round
            them, everything else at the sides, and the icons moved to the rail down the right. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4 px-2 pt-4">
          <div className="flex min-w-0 items-start gap-5">
            <Link href={PATHS.home} aria-label="RENUABL, today" className="mt-[1.45rem] shrink-0">
              <Wordmark className="text-[17px]" />
            </Link>
          </div>
          <div className="mt-4 flex min-w-0 items-center justify-center">
            <nav aria-label="Sections" className="studio-sections flex items-center gap-0.5 rounded-full bg-surface-2 p-1">
              {sections.map((sec, i) => {
                const lit = sec.id === current.id;
                const waiting = sec.pages.reduce((n, p) => n + count(p.id), 0);
                const design =
                  i === 1 && designsRoofs(kind) ? (
                    // The design tool, the main tool, as an orange round between Today and CRM: larger than the pill (it
                    // stands out of it without making it taller), centred between Today's white pill and the word CRM.
                    <Link
                      key="design"
                      href={PATHS.designer}
                      aria-label="Design tool"
                      title="Design tool"
                      aria-current={path.startsWith(PATHS.designer) ? "page" : undefined}
                      className={clsx(
                        "-my-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-sun-line text-white shadow-[0_4px_14px_rgba(255,90,31,0.35)] transition hover:brightness-105",
                        current.id === sections[0].id ? "ml-3.5" : "mx-0",
                        path.startsWith(PATHS.designer) && "ring-2 ring-sun-line/40 ring-offset-2 ring-offset-surface-2",
                      )}
                    >
                      <PenTool className="size-5" aria-hidden />
                    </Link>
                  ) : null;
                // The Marketplace is the network, not the business's own work: it has its own button beside the pill.
                if (sec.id === "marketplace") return design;
                return [
                  design,
                  <Link
                    key={sec.id}
                    href={sec.pages[0].href}
                    aria-current={lit ? "true" : undefined}
                    className={clsx(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm transition-colors",
                      lit ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {sec.label}
                    {waiting > 0 && <span className="size-1.5 rounded-full bg-sun-line" aria-label={`${waiting} waiting`} />}
                  </Link>,
                ];
              })}
              {/* Sol, the other tool, as the graphite round at the far end: the two rounds frame the sections. */}
              {retail && (
                <span className="ml-1">
                  <SolNavButton />
                </span>
              )}
            </nav>
          </div>
          <div className="mt-3 flex min-w-0 items-center gap-2.5">
            {(() => {
              // The Marketplace is the network, not the business's own work: in the middle of the room between the
              // sections and the card (3 Nov 2026, Martin), its words beside its round where there is room
              // (`.studio-market-words`).
              const market = sections.find((s) => s.id === "marketplace");
              const waiting = market ? market.pages.reduce((n, p) => n + count(p.id), 0) : 0;
              return (
                <div className="flex min-w-0 flex-1 justify-center">
                  {market && <MarketplaceButton href={market.pages[0].href} lit={market.id === current.id} waiting={waiting} />}
                </div>
              );
            })()}
            {retail && (
              <button
                type="button"
                onClick={() => setSearching(true)}
                aria-label="Search, or ask Sol"
                title="Search, or ask Sol (Ctrl K)"
                className="studio-search flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
              >
                <Search className="size-4" aria-hidden />
              </button>
            )}
            <div
              data-tour="icons"
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface p-1 shadow-[0_8px_30px_rgba(11,11,12,0.08)] ring-1 ring-line"
            >
              <DayWeather />
              {/* On the design tool the rail is put away for the roof, so notifications and email come up here. */}
              {retail && tool && (
                <>
                  <NotificationsMenu
                    place="top"
                    messages={unread}
                    mentions={mentions}
                    full={PATHS.notifications}
                    messagesFull={PATHS.messages}
                    deal={(id) => `${PATHS.deals}/${id}`}
                  />
                  <TopIcon href={PATHS.inbox} label="Email" icon={Mail} on={path.startsWith(PATHS.inbox)} badge={mail} />
                </>
              )}
              {!retail && <TopIcon href={PATHS.team} label="Team chat" icon={MessagesSquare} on={path.startsWith(PATHS.team)} badge={0} />}
              <ProfileMenu
                email={account.email}
                settings={PATHS.settings}
                account={PATHS.account}
                updates={PATHS.updates}
                feedback={PATHS.feedback}
                // An installer's connections live here (its menu is My Jobs, the designer and the Marketplace).
                connections={kind === "installer" ? { href: "/design/connections", waiting: requests } : undefined}
                unseen={updates}
                on={
                  settingsOn ||
                  path.startsWith(PATHS.updates) ||
                  path.startsWith(PATHS.feedback) ||
                  (kind === "installer" && path.startsWith("/design/connections"))
                }
              />
            </div>
          </div>
        </div>
        {/* The section's own pages, quiet: only the one you are on stands out. Today has none over it. */}
        {current.id !== "marketplace" && current.pages.length > 1 && (
          <nav aria-label={current.label} className="flex justify-center gap-5 overflow-x-auto px-5 pb-2 pt-2.5">
            {current.pages.map((p) => {
              const lit = here?.page.id === p.id;
              const n = count(p.id);
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  aria-current={lit ? "page" : undefined}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 border-b-2 pb-1 text-[13px] transition-colors",
                    lit ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {p.label}
                  {n > 0 && (
                    <span className="relative inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold leading-4 text-white">
                      {!lit && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-sun-line/50 motion-reduce:hidden" aria-hidden />
                      )}
                      <span className="relative">{n}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* On a phone: the wordmark, Search and the day across the top. */}
      <div className="flex items-center gap-3 px-4 pb-1 pt-3 print:hidden lg:hidden">
        <Link href={PATHS.home} aria-label="RENUABL, today">
          <Wordmark className="text-[16px]" />
        </Link>
        {retail && (
          <button
            type="button"
            onClick={() => setSearching(true)}
            aria-label="Search, or ask Sol"
            className="ml-auto flex size-9 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line"
          >
            <Search className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {tool ? (
        <div data-sol-page className="relative min-w-0 lg:pt-5">
          {children}
        </div>
      ) : (
        <div className="px-3 pb-20 pt-2 sm:px-6 lg:px-14 lg:pt-9">
          <div data-tour="pad" data-sol-page className={PAD}>
            {/* Inside the Marketplace, its own menu at the top of the pad, from its blue home, once it is open; until then
                the launch page's demo carries it. */}
            {current.id === "marketplace" && marketplaceOpen() && (
              <MarketplaceMenu className="-mt-1 mb-6 border-b border-line pb-3" pages={current.pages} lit={here?.page.id} count={count} />
            )}
            {children}
          </div>
        </div>
      )}

      {/* On a phone: the places used most along the foot, and the rest in a sheet that comes up from More. */}
      <nav
        aria-label="Sections, on a phone"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden"
      >
        {(retail ? PHONE_TABS : KIND_TABS[kind as Exclude<BusinessKind, "retailer">]).map((t, i) => {
          const lit = !more && t.match(path);
          const sol =
            retail && i === 2 ? (
              <div key="sol" className="flex min-h-14 flex-col items-center justify-end gap-0.5 pb-1 text-[10px] font-medium text-ink">
                <span className="-mt-5">
                  <SolNavButton phone />
                </span>
                Sol
              </div>
            ) : null;
          const n = t.href === PATHS.messages ? unread : 0;
          return [
            sol,
            <Link
              key={t.label}
              href={t.href}
              onClick={() => setMore(false)}
              aria-current={lit ? "page" : undefined}
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium",
                lit ? "text-ink" : "text-muted",
              )}
            >
              <span className={clsx("relative flex h-7 w-12 items-center justify-center rounded-full", lit && "bg-sun")}>
                <t.icon className="size-[18px]" aria-hidden />
                {n > 0 && (
                  <span className="absolute -top-0.5 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[9px] font-semibold text-white">
                    {n}
                  </span>
                )}
              </span>
              {t.label}
            </Link>,
          ];
        })}
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className={clsx(
            "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium",
            more ? "text-ink" : "text-muted",
          )}
        >
          <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full", more && "bg-sun")}>
            <Menu className="size-[18px]" aria-hidden />
          </span>
          More
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-label="Everything in RENUABL">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[2rem] bg-surface px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3">
            <span className="mx-auto block h-1 w-10 rounded-full bg-line" aria-hidden />
            {retail && (
              <button
                type="button"
                onClick={() => {
                  setMore(false);
                  setSearching(true);
                }}
                className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-line px-3 text-base text-muted"
              >
                <Search className="size-5" aria-hidden /> Search, or ask Sol
              </button>
            )}
            {designsRoofs(kind) && (
              <Link
                href={PATHS.designer}
                onClick={() => setMore(false)}
                className="mt-2 flex min-h-12 items-center gap-3 rounded-xl bg-sun-line px-3 text-base font-medium text-white"
              >
                <PenTool className="size-5" aria-hidden /> Design tool
              </Link>
            )}
            {sections.map((sec) => (
              <div key={sec.id}>
                <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{sec.label}</p>
                {sec.pages.map((p) => (
                  <Link
                    key={p.id}
                    href={p.href}
                    onClick={() => setMore(false)}
                    className={clsx(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium",
                      here?.page.id === p.id ? "bg-ink text-white" : "text-ink",
                    )}
                  >
                    <span className="flex-1">{p.label}</span>
                    {count(p.id) > 0 && (
                      <span className="rounded-full bg-sun-line px-2 text-xs font-semibold text-white">{count(p.id)}</span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
            <div className="mt-4 border-t border-line pt-2">
              {[
                ...(retail ? [{ label: "Sol's page: reminders and preferences", href: PATHS.sol, n: 0 }] : []),
                { label: "Team chat", href: PATHS.team, n: 0 },
                ...(retail
                  ? [
                      { label: "Notifications", href: PATHS.notifications, n: mentions },
                      { label: "Email", href: PATHS.inbox, n: mail },
                    ]
                  : []),
                { label: "Updates", href: PATHS.updates, n: updates },
                { label: "Feedback", href: PATHS.feedback, n: 0 },
                { label: "Settings", href: PATHS.settings, n: 0 },
                { label: "Your account", href: PATHS.account, n: 0 },
              ].map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={() => setMore(false)}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium text-ink"
                >
                  <span className="flex-1">{r.label}</span>
                  {r.n > 0 && <span className="rounded-full bg-sun-line px-2 text-xs font-semibold text-white">{r.n}</span>}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-3 pt-4 text-sm text-muted">
              <span className="truncate">{account.email}</span>
              <SignOut className="font-medium text-ink-2" />
            </div>
          </div>
        </div>
      )}
      {retail && (
        <PageSearch
          open={searching}
          onClose={() => setSearching(false)}
          customer={(id) => `${PATHS.customers}/${id}`}
          deal={(id) => `${PATHS.deals}/${id}`}
        />
      )}
      {/* The rail down the right (team chat, notifications, email and the numbers; not over the design tool, which needs the
          room) and Sol's panel. */}
      {retail && !tool && (
        <SolRail
          team={<TeamChatButton me={account.email} />}
          tools={
            <>
              <NotificationsMenu
                messages={unread}
                mentions={mentions}
                full={PATHS.notifications}
                messagesFull={PATHS.messages}
                deal={(id) => `${PATHS.deals}/${id}`}
              />
              <RailIcon href={PATHS.inbox} label="Email" icon={Mail} on={path.startsWith(PATHS.inbox)} badge={mail} />
            </>
          }
        />
      )}
      {retail && <SolDock />}
    </div>
  );
}

/** The heading every page opens with inside the pad (20px, as Primero's), and room for its main action. */
export function PageHead({ title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Shared looks for the sections' screens. A page sits inside the pad, which gives it its room. */
export const ui = {
  page: "mx-auto w-full max-w-6xl",
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

/** How many service cases are still to put right, asked when the shell opens and whenever a case changes. */
function useServiceCount(on: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    let gone = false;
    const look = async () => {
      const res = await serviceCount();
      if (!gone && res.ok) setN(res.open);
    };
    void look();
    window.addEventListener("renuabl:service", look);
    return () => {
      gone = true;
      window.removeEventListener("renuabl:service", look);
    };
  }, [on]);
  return on ? n : 0;
}

/** A count for the nav, asked when the shell opens, each minute while the page is in view, and on `event`. */
function useCount(on: boolean, event: string, ask: () => Promise<number | null>): number {
  const [n, setN] = useState(0);
  const latest = useRef(ask);
  useEffect(() => {
    latest.current = ask;
  });
  useEffect(() => {
    if (!on) return;
    let gone = false;
    const look = async () => {
      const got = await latest.current();
      if (!gone && got !== null) setN(got);
    };
    void look();
    const timer = window.setInterval(() => void (document.visibilityState === "visible" && look()), 60_000);
    window.addEventListener(event, look);
    return () => {
      gone = true;
      window.clearInterval(timer);
      window.removeEventListener(event, look);
    };
  }, [on, event]);
  return on ? n : 0;
}
