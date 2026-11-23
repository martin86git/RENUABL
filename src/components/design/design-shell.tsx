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
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Package,
  LayoutDashboard,
  Menu,
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
import { withMarketing } from "@/lib/domain/marketing/access";
import { MarketplaceMark, MarketplaceMenu } from "./marketplace-bar";
import { BUSINESS_KINDS, cleanKind, pageAllowed, type BusinessKind } from "@/lib/domain/design/business-kind";
import { DemoBar, DemoDetailsPrompt } from "./demo-details";
import { staffView } from "./staff-view-as";
import { notificationCount, serviceCount, approvalCounts, updatesUnseen } from "@/lib/services/crm";
import { useUnreadMessages } from "./chat-panel";
import { DesignAccountGate, SignOut, useDesignAccount } from "./design-account";
import { PageSearch } from "./page-search";
import { SolDock, SolNavButton, SolRail, useSolOpen } from "./sol-dock";
import { PhoneVoiceTab } from "./phone-voice";
import { PhoneTop } from "./phone-top";
import { toggleSolHere } from "@/lib/services/sol";
import { DrawerFrameLinks, ShellDesignDrawer, useInDrawer } from "./design-drawer";
import { ComputerCallBar } from "./computer-call";
import { AssistantCallWindow } from "./assistant-call";
import { LiveCallsTray } from "./live-calls";
import { CoachWindow } from "./coach-chat";
import { ColleagueWindow } from "./colleague";
import { RailAgents } from "./rail-agents";
import { RoutinesRound } from "./routines-round";
import { AgentsWindow } from "./agents-window";
import { SetupWizard } from "./setup-wizard";
import { openSetup } from "@/lib/services/setup";
import { TeamChatButton, useTeamUnread } from "./team-chat";
import { DayWeather, ProfileMenu, TopIcon } from "./shell-menus";
import { RenuablMark } from "./business-loading";
import { QuickCalc } from "./quick-calc";
import { BackToTop } from "./back-to-top";
import { setDockSet, useDockSet } from "@/lib/services/dock-set";
import { DOCK_SET_WORDS, otherDockSet } from "@/lib/domain/design/dock-set";

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
  scheduler: "/design/installations",
  orders: "/design/procurement/orders",
  jobMap: "/design/procurement/map",
  invoices: "/design/installations/invoices",
  underway: "/design/installations?view=list",
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

// The designer beside Sol (22 Nov 2026, Martin: "we need the designer icon in the bottom menu bar… rapid lookup of
// existing deal or new address to design on the spot"): it opens the design tool's home, with its one search for a
// deal or an address, over the page. Messages left the bar (22 Nov 2026, Martin: "remove the chat icon from the tool
// bar in mobile view. this will allow all icons to be a little larger"); it is under More.
// A retailer's foot bar (22 Nov 2026, Martin: "replace the today icon out with voice agent… Deals will shift into
// today's position, designer will shift into deals position and voice will shift into designers position"): Deals,
// Designer, Sol raised in the middle (he goes to Today), Voice, More. Voice is a button (`PhoneVoiceTab`), not a link.
const VOICE_TAB = "Voice";
const PHONE_TABS: PhoneTab[] = [
  { label: "Deals", href: PATHS.pipelines, icon: SquareKanban, match: (p) => p.startsWith(PATHS.sales) || p.startsWith(PATHS.deals) },
  { label: "Designer", href: PATHS.designer, icon: PenTool, match: (p) => p.startsWith(PATHS.designer) },
  { label: VOICE_TAB, href: PATHS.home, icon: PenTool, match: () => false },
  // Team chat in the foot bar (22 Nov 2026, Martin: "we need to introduce the team chat into the bottom nav"): its own
  // page on a phone, with this member's unread team lines on it.
  { label: "Team", href: PATHS.team, icon: MessagesSquare, match: (p) => p.startsWith(PATHS.team) },
];
// The dock's post-sale tools (23 Nov 2026, Martin: the owner wears every hat; the ball in the dock's lip turns it like a
// slot machine to these, on navy, and back). Each sits on the same reel as the sales tool in its place: Deals and the
// Calendar, Designer and Orders, Voice and Paperwork, Team and Service. Sol stays in the middle and never turns.
const POST_TABS: PhoneTab[] = [
  {
    label: "Calendar",
    href: PATHS.installations,
    icon: CalendarDays,
    match: (p) => p.startsWith(PATHS.installations) && !p.startsWith(PATHS.completed) && !p.startsWith(PATHS.invoices),
  },
  { label: "Orders", href: PATHS.orders, icon: Package, match: (p) => p.startsWith(PATHS.orders) },
  { label: "Paperwork", href: PATHS.completed, icon: FileCheck2, match: (p) => p.startsWith(PATHS.completed) },
  { label: "Service", href: PATHS.service, icon: Wrench, match: (p) => p.startsWith(PATHS.service) },
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
 * RENUABL Marketplace as the blue round at the far end of the sections menu (20 Nov 2026, Martin: Sol moved to the
 * floating bar, "so to replace sols position i want to move the Renuabl market palce into it… the blue marketplace icon
 * needs to be the same size as what the Sol icon was"): the size of the designer's orange round at the other end, so the
 * two frame the sections. Its name, and "coming soon" while it is closed, are its hover title.
 */
function MarketplaceButton({ href, lit, waiting }: { href: string; lit: boolean; waiting: number }) {
  const name = `RENUABL Marketplace${marketplaceOpen() ? "" : ", coming soon"}`;
  return (
    <Link
      href={href}
      aria-current={lit ? "true" : undefined}
      aria-label={name}
      title={name}
      className={clsx(
        "glass-orb-market relative -my-2 mx-0.5 flex size-12 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-110",
        lit && "ring-2 ring-market/40 ring-offset-2 ring-offset-surface",
      )}
    >
      <MarketplaceMark className="size-[22px]" />
      {waiting > 0 && (
        <span className="absolute right-0 top-0 size-2.5 rounded-full bg-sun-line ring-2 ring-surface" aria-label={`${waiting} waiting`} />
      )}
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
const PAD = "studio-pad min-h-[calc(100dvh-10rem)] max-sm:min-h-[calc(100dvh-15rem)] rounded-[28px] bg-canvas p-4 sm:p-6 lg:pt-10";

/**
 * How far the sections menu drops below the top bar on a wide screen, so it sits half over the pad's top edge (14 Nov
 * 2026, Martin: not in line with the wordmark and the cards at the sides). Kept in step with the pad's gap below the
 * bar (`lg:pt-9`): the menu's middle lands on the pad's edge.
 */
const MENU_DROP_PX = 56;
/**
 * Scrolled down, the menu rises into the bar's own row, level with the wordmark and the cards at the sides, and what
 * sticks moves up with it (21 Nov 2026, Martin: Today's Business | Feed switch ran into the lowered menu; "when
 * scrolling the top banner menu compresses allowing more space on the page"). What sticks then sits this far under the
 * bar, room for the pad's rounded top edge (.pad-cap), which sticks 20px above --studio-head.
 */
const RAISED_GAP_PX = 20;
/** How far down the page the menu rises, and how near the top it drops again (apart, so it never flickers between). */
const RAISE_AT_PX = 24;
const DROP_AT_PX = 4;

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
  // On a phone Sol's panel covers the page with the foot bar under it (22 Nov 2026, Martin): a tab pressed there puts
  // the panel away so the page it opens is seen.
  const solOpen = useSolOpen();
  const leaveSol = () => {
    if (solOpen && !window.matchMedia("(min-width: 1024px)").matches) toggleSolHere(false);
  };
  const on = Boolean(account?.signedIn && account.business);
  // What kind of business this login is (business-kind.ts): an installer or inspector has part of the product, and
  // nothing of the CRM is asked for.
  const kind: BusinessKind = cleanKind(account?.signedIn ? account.business?.kind : undefined);
  const retail = on && kind === "retailer";
  // Marketing beside Customers only where the business has it (domain/marketing/access.ts).
  const sections = withMarketing(KIND_SECTIONS[kind], Boolean(account?.signedIn && account.business));
  // How many of the customers' messages nobody has seen, the service cases to put right, and this member's unread mentions.
  const unread = useUnreadMessages(retail);
  // This member's unread team chat lines, for the Team tab on a phone's foot bar.
  const teamUnread = useTeamUnread();
  // The dock's set, and how many times its ball has been pulled (to play the pull again on each tap).
  const dock = useDockSet();
  const post = dock === "post";
  const [pulls, setPulls] = useState(0);
  const service = useServiceCount(retail);
  const mentions = useCount(retail, "renuabl:notifications", async () => {
    const res = await notificationCount();
    return res.ok ? res.unread : null;
  });
  // The top bar's height as --studio-head, so what sticks on a page (a deal's rails) sits just under it, not behind it.
  // A callback ref: the header is only drawn once the account has loaded, after the shell first mounts.
  const watchHead = useRef<ResizeObserver | null>(null);
  const headRef = (el: HTMLElement | null) => {
    watchHead.current?.disconnect();
    watchHead.current = null;
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty("--studio-head");
      return;
    }
    // The sections menu hangs below the bar on a page with a pad: what sticks clears it too.
    // Raised, it clears the bar and leaves room for the pad's top edge. (A fresh ref each render, so this reads `raised`.)
    const set = () => root.style.setProperty("--studio-head", `${el.offsetHeight + (tool ? 0 : raised ? RAISED_GAP_PX : MENU_DROP_PX)}px`);
    set();
    watchHead.current = new ResizeObserver(set);
    watchHead.current.observe(el);
  };
  // iPhone and iPad only (22 Nov 2026, Martin: compact email fields on the deal): Safari zooms into any field under 16px
  // when it is tapped and stays zoomed. maximum-scale=1 stops that, and iOS still lets people pinch to zoom. Not set
  // elsewhere, since Android's Chrome would stop pinch zoom with it.
  useEffect(() => {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!ios || !meta || meta.content.includes("maximum-scale")) return;
    meta.content = `${meta.content}, maximum-scale=1`;
  }, []);
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
  // Once the pad's top has scrolled under the top bar, the gap behind the lowered menu is filled with the pad's own
  // ground, so the page never shows through around it (14 Nov 2026, Martin).
  const [underBar, setUnderBar] = useState(false);
  // Scrolled down, the lowered menu rises into the bar (RAISED_GAP_PX); back near the top it drops again.
  const [raised, setRaised] = useState(false);
  useEffect(() => {
    const look = () => {
      setUnderBar(window.scrollY > 0);
      setRaised((r) => (r ? window.scrollY > DROP_AT_PX : window.scrollY > RAISE_AT_PX));
    };
    look();
    window.addEventListener("scroll", look, { passive: true });
    return () => window.removeEventListener("scroll", look);
  }, []);
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
        <DemoDetailsPrompt account={account} />
        {children}
      </div>
    );

  if (away) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  const here = pageAt(path, kind);
  const at = sectionAt(path, kind);
  // As this business's menu has it (Marketing only where it is on).
  const current = sections.find((s) => s.id === at.id) ?? at;
  const count = (pageId: string) => counts[pageId] ?? 0;
  const settingsOn = path.startsWith(PATHS.settings) || path.startsWith(PATHS.account);

  // The section's own pages, quiet: only the one you are on stands out. Today has none over it. Since the sections menu
  // sits on the pad's edge (14 Nov 2026, Martin), they head the pad under it, so the top bar is one height on every page.
  const sectionPages =
    current.id !== "marketplace" && current.pages.length > 1 ? (
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
                  {!lit && <span className="absolute inset-0 animate-ping rounded-full bg-sun-line/50 motion-reduce:hidden" aria-hidden />}
                  <span className="relative">{n}</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    ) : null;
  /** One place on the phone's foot bar. `dark`: a post-sale tool, drawn for the navy dock. */
  const tabFor = (t: PhoneTab, dark: boolean) => {
    if (retail && t.label === VOICE_TAB)
      return (
        <PhoneVoiceTab
          key={t.label}
          onOpen={() => {
            setMore(false);
            leaveSol();
          }}
        />
      );
    const lit = !more && t.match(path);
    const n = t.href === PATHS.messages ? unread : t.href === PATHS.team ? teamUnread : 0;
    // The designer is the orange round it is in the top menu; Orders is the post-sale tools' round, in steel blue.
    const round = t.href === PATHS.designer || (dark && t.href === PATHS.orders);
    return (
      <Link
        key={t.label}
        href={t.href}
        onClick={() => {
          setMore(false);
          leaveSol();
        }}
        aria-current={lit ? "page" : undefined}
        className={clsx(
          "flex flex-col items-center justify-center gap-1 font-medium",
          retail ? "h-16 text-[11px]" : "min-h-14 text-[10px]",
          dark ? (lit ? "text-white" : "text-[#b7c6da]") : lit ? "text-ink" : "text-muted",
        )}
      >
        <span
          className={clsx(
            "relative flex items-center justify-center rounded-full",
            round
              ? clsx(
                  retail ? "size-9" : "size-7",
                  "shadow-sm",
                  dark ? "bg-[#8fb3d9] text-[#0f1a2b]" : "bg-sun-line text-white",
                  lit && (dark ? "ring-2 ring-white/30 ring-offset-1 ring-offset-[#15233a]" : "ring-2 ring-sun-line/30 ring-offset-1"),
                )
              : clsx(retail ? "h-9 w-14" : "h-7 w-12", lit && (dark ? "bg-white/10" : "bg-sun")),
          )}
        >
          <t.icon className={retail ? "size-[22px]" : "size-[18px]"} aria-hidden />
          {n > 0 && (
            <span className="absolute -top-0.5 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[9px] font-semibold text-white">
              {n}
            </span>
          )}
        </span>
        {t.label}
      </Link>
    );
  };
  return (
    <div className="theme-studio studio-frame min-h-dvh pb-24 lg:pb-0">
      {/* The design tool slides over whatever page this is, never a page of its own. */}
      <ShellDesignDrawer />
      {/* A call made from the computer: who, how long, Mute and Hang up, over every page while it lasts. */}
      <ComputerCallBar />
      {/* The phone assistant's call as it happens, once a call is handed to it. */}
      <AssistantCallWindow />
      {/* Every call it has under way: a pill while any is ringing or on, opening one, or all of them side by side. */}
      {retail && <LiveCallsTray />}
      {/* Talking to the phone assistant to coach it, opened from its face on the rail, Settings or a call. */}
      <CoachWindow />
      <ColleagueWindow />
      {retail && <AgentsWindow />}
      {/* Sol's setup wizard: what a new business still has to set up (setup.ts). */}
      {retail && !account.demo && <SetupWizard />}
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
      {/* A demo account (demo.ts): says so on every page, with the way to what RENUABL is. */}
      <DemoBar account={account} />
      <DemoDetailsPrompt account={account} />
      {/* Across the top on a wide screen: the logo, the sections (with the design tool in orange and Sol at the end), and on
          the right the search, the Marketplace and a small card with the date and weather and the profile round. */}
      <header
        ref={headRef}
        className={clsx("studio-top z-[35] hidden bg-canvas/90 backdrop-blur print:hidden lg:block lg:px-14", !tool && "sticky top-0")}
      >
        {/* The sections sit in the middle of the screen (3 Nov 2026, Martin: on a laptop they didn't): two equal sides round
            them, everything else at the sides, and the icons moved to the rail down the right. */}
        {/* Each side is at least as wide as what it holds (5 Nov 2026, from Primero's), so on a narrower window nothing
            runs under anything else: the wordmark shrinks to its small mark and the day and weather give way first
            (`.studio-mark-*`, `.studio-day*` in globals.css). */}
        <div className="grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-start gap-4 px-2 pt-4">
          <div className="flex min-w-0 items-start gap-5">
            <Link href={PATHS.home} aria-label="RENUABL, today" className="shrink-0">
              <span className="studio-mark-full mt-[1.45rem]">
                <Wordmark className="text-[17px]" />
              </span>
              <RenuablMark className="studio-mark-short mt-[1.25rem]" />
            </Link>
            {/* Search sits by the wordmark (8 Nov 2026, Martin: lost on the right among the icons): where people look
                for it, and the left had room for the word. */}
            {retail && (
              <button
                type="button"
                onClick={() => setSearching(true)}
                aria-label="Search, or ask Sol"
                title="Search, or ask Sol (Ctrl K)"
                className="studio-search mt-[1.25rem] flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface pl-3 pr-2 text-[13px] text-muted ring-1 ring-line transition-colors hover:text-ink"
              >
                <Search className="size-4 text-ink-2" aria-hidden />
                <span className="studio-search-words">Search</span>
              </button>
            )}
          </div>
          <div
            className="mt-4 flex min-w-0 items-center justify-center transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={tool ? undefined : { transform: `translateY(${raised ? 0 : MENU_DROP_PX}px)` }}
          >
            {/* One pill in liquid glass (19 Nov 2026, Martin: .glass-bar in globals.css; it was flat white). Every
                round sits inside it at the same height, nothing standing out of it, and the section you're in is lit as the
                rail's are, black with its word in orange. */}
            <nav aria-label="Sections" className="studio-sections glass-bar relative flex items-center gap-0.5 rounded-full p-1">
              {(() => {
                // The business's own sections (CRM, Procurement, Installation, Service) fold behind one layers icon
                // (section-fold.tsx, 8 Nov 2026, Martin): Today, the designer and Sol are the surface; the sections are
                // the engine, opened on hover, kept open inside one of them, or pinned. Only where there are enough of
                // them to be worth folding (a retailer's); an installer's or inspector's few stay as they are.
                const foldable = sections.filter((s, i) => i > 0 && s.id !== "marketplace");
                if (foldable.length < 3) return null;
                const link = (sec: (typeof sections)[number]) => {
                  const lit = sec.id === current.id;
                  const waiting = sec.pages.reduce((n, p) => n + count(p.id), 0);
                  return (
                    <Link
                      key={sec.id}
                      href={sec.pages[0].href}
                      data-tour={`section-${sec.id}`}
                      aria-current={lit ? "true" : undefined}
                      className={clsx(
                        "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                        lit ? "glass-lit bg-primary font-medium text-primary-ink" : "glass-item text-ink-2 hover:text-ink",
                      )}
                    >
                      {sec.label}
                      {waiting > 0 && <span className="size-1.5 rounded-full bg-sun-line" aria-label={`${waiting} waiting`} />}
                    </Link>
                  );
                };
                return (
                  <>
                    {link(sections[0])}
                    {/* The two tools as two discs (13 Nov 2026, Martin): the proposal's half tucked under the
                        designer's, sliding out from under it while the pointer is on them (or a key is on one, or a
                        proposal page is open). */}
                    <span className="group/tools flex shrink-0 items-center">
                      {designsRoofs(kind) && (
                        <Link
                          href={PATHS.designer}
                          aria-label="Design tool"
                          title="Design tool"
                          aria-current={path.startsWith(PATHS.designer) ? "page" : undefined}
                          className={clsx(
                            "relative z-10 -my-2 mx-0.5 flex size-12 shrink-0 items-center justify-center glass-orb rounded-full text-white transition hover:brightness-105",
                            path.startsWith(PATHS.designer) && "ring-2 ring-sun-line/40 ring-offset-2 ring-offset-surface",
                          )}
                        >
                          <PenTool className="size-5" aria-hidden />
                        </Link>
                      )}
                      {/* The proposal, the other tool (8 Nov 2026, Martin): its round beside the designer's, opening the
                        proposals; a deal's own proposal opens over the page like the designer. */}
                      {retail && (
                        <Link
                          href={PATHS.proposalsSent}
                          aria-label="Proposals"
                          title="Proposals"
                          aria-current={current.id === "proposals" ? "page" : undefined}
                          className={clsx(
                            "-my-2 mr-0.5 flex size-12 shrink-0 items-center justify-center glass-bead rounded-full text-sun-line transition-[margin,color,box-shadow] duration-300 ease-out hover:text-ink motion-reduce:transition-none",
                            current.id === "proposals"
                              ? "ml-1 ring-2 ring-sun-line/40 ring-offset-2 ring-offset-surface"
                              : "-ml-7 group-focus-within/tools:ml-1 group-hover/tools:ml-1",
                          )}
                        >
                          <FileText className="size-5" aria-hidden />
                        </Link>
                      )}
                    </span>
                    {/* Every section in view again (10 Nov 2026, Martin: reveal the rest of the menu), CRM first. The
                        layers fold (section-fold.tsx) is no longer used here. */}
                    {foldable.map(link)}
                  </>
                );
              })()}
              {sections.filter((s, i) => i > 0 && s.id !== "marketplace").length < 3 &&
                sections.map((sec, i) => {
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
                          "-my-2 mx-0.5 flex size-12 shrink-0 items-center justify-center glass-orb rounded-full text-white transition hover:brightness-105",
                          path.startsWith(PATHS.designer) && "ring-2 ring-sun-line/40 ring-offset-2 ring-offset-surface",
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
                        "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                        lit ? "glass-lit bg-primary font-medium text-primary-ink" : "glass-item text-ink-2 hover:text-ink",
                      )}
                    >
                      {sec.label}
                      {waiting > 0 && <span className="size-1.5 rounded-full bg-sun-line" aria-label={`${waiting} waiting`} />}
                    </Link>,
                  ];
                })}
              {/* The Marketplace as the blue round at the far end, where Sol was (20 Nov 2026, Martin): the two
                  rounds frame the sections. Sol heads the floating bar on the right. */}
              {(() => {
                const market = sections.find((s) => s.id === "marketplace");
                if (!market) return null;
                const waiting = market.pages.reduce((n, p) => n + count(p.id), 0);
                return <MarketplaceButton href={market.pages[0].href} lit={market.id === current.id} waiting={waiting} />;
              })()}
            </nav>
          </div>
          <div className="mt-3 flex min-w-0 items-center gap-2.5">
            {/* The room between the sections and the card (the Marketplace was here until it joined the menu). */}
            <div className="min-w-0 flex-1" />
            {/* The calculator, beside the top card on every page (14 Nov 2026, Martin: no bar of tools down the right). */}
            {designsRoofs(kind) && <QuickCalc />}
            <div data-tour="icons" className="glass-bar relative flex shrink-0 items-center gap-0.5 rounded-full p-1">
              <DayWeather />
              {/* On the design tool the floating rounds are put away for the roof, so team chat comes up here. */}
              {retail && tool && <SolNavButton small />}
              {retail && tool && <TeamChatButton me={account.email} customers={unread + mentions} />}
              {/* Email, with its unread count, on every page. */}
              {retail && <TopIcon href={PATHS.inbox} label="Email" icon={Mail} on={path.startsWith(PATHS.inbox)} badge={mail} />}
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
                onSetup={retail && !account.demo ? openSetup : undefined}
                usage={kind !== "inspector" ? `${PATHS.settings}/usage` : undefined}
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
        {/* Once the page scrolls, the bar's frosted ground reaches down behind the lowered menu, so nothing shows round it. */}
        {!tool && (
          <div
            aria-hidden
            className={clsx("pad-under pointer-events-none absolute inset-x-0 top-full -z-10 bg-canvas", (!underBar || raised) && "hidden")}
            style={{ height: MENU_DROP_PX + 48 }}
          />
        )}
        {/* The section's own pages sit in the bar only on the designer, which has no pad; elsewhere they head the pad. */}
        {tool && sectionPages}
      </header>

      {/* On a phone: the wordmark, Search and the day across the top; once scrolled away, the wordmark small at the top. */}
      <PhoneTop
        home={PATHS.home}
        back={/^\/design\/deals\/[^/]+$/.test(path) ? { href: PATHS.pipelines, label: "Deals" } : undefined}
        onSearch={retail ? () => setSearching(true) : undefined}
        more={
          retail
            ? {
                open: more,
                count: unread,
                toggle: () => {
                  if (!more) leaveSol();
                  setMore(!more);
                },
              }
            : undefined
        }
      />

      {tool ? (
        <div data-sol-page className="relative min-w-0 lg:pt-5">
          {children}
        </div>
      ) : (
        <div className="px-3 pb-4 pt-2 lg:pb-20 sm:px-6 lg:px-14 lg:pt-9">
          <div data-tour="pad" data-sol-page className={PAD}>
            {/* The pad's top edge stays put while the page scrolls under it (15 Nov 2026, Martin: the top of the grey pad
                disappeared): its own grey with its rounded corners, drawn on a wide screen only (globals.css .pad-cap). */}
            <div aria-hidden className="pad-cap">
              <div />
            </div>
            {/* Inside the Marketplace, its own menu at the top of the pad, from its blue home, once it is open; until then
                the launch page's demo carries it. */}
            {sectionPages && <div className="studio-pages -mt-2 mb-5 hidden lg:block">{sectionPages}</div>}
            {current.id === "marketplace" && marketplaceOpen() && (
              <MarketplaceMenu className="-mt-1 mb-6 border-b border-line pb-3" pages={current.pages} lit={here?.page.id} count={count} />
            )}
            {children}
          </div>
        </div>
      )}

      {!tool && <BackToTop />}

      {/* On a phone: the places used most along the foot, and the rest in a sheet that comes up from More. */}
      <nav
        aria-label="Sections, on a phone"
        data-dock={retail ? dock : undefined}
        className={clsx(
          "phone-tabbar fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden",
          // A retailer's More is in the top right (23 Nov 2026, Martin), so five across with Sol in the middle.
          kind === "inspector" ? "grid-cols-6" : "grid-cols-5",
        )}
      >
        {retail && (
          // The dock's lip with its ball (23 Nov 2026, Martin): a tap turns the reels to the other set of tools. The ball
          // is the colour of the set it turns to.
          <span
            aria-hidden={false}
            className="dock-lip absolute -top-[21px] right-3 flex h-[21px] w-12 justify-center rounded-t-full border border-b-0"
          >
            <button
              key={pulls}
              type="button"
              aria-label={DOCK_SET_WORDS[otherDockSet(dock)].turnTo}
              title={DOCK_SET_WORDS[otherDockSet(dock)].turnTo}
              onClick={() => {
                setPulls((n) => n + 1);
                setDockSet(otherDockSet(dock));
              }}
              className={clsx(
                "dock-ball mt-1 size-[22px] rounded-full",
                pulls > 0 && "dock-ball-pull",
                post ? "dock-ball-sales" : "dock-ball-post",
              )}
            />
          </span>
        )}
        {retail
          ? [0, 1, 2, 3].map((i) => [
              i === 2 ? (
                <div
                  key="sol"
                  className="dock-sol flex min-h-16 flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-medium text-ink"
                >
                  <span className="-mt-6">
                    <SolNavButton phone />
                  </span>
                  Sol
                </div>
              ) : null,
              <div key={`reel-${i}`} className="relative h-16 self-end overflow-hidden">
                <div className="dock-reel" style={{ transform: post ? "translateY(-50%)" : undefined, transitionDelay: `${i * 80}ms` }}>
                  <div className="h-16" inert={post}>
                    {tabFor(PHONE_TABS[i], false)}
                  </div>
                  <div className="h-16" inert={!post}>
                    {tabFor(POST_TABS[i], true)}
                  </div>
                </div>
              </div>,
            ])
          : KIND_TABS[kind as Exclude<BusinessKind, "retailer">].map((t) => tabFor(t, false))}
        {!retail && (
          <button
            type="button"
            onClick={() => {
              if (!more) leaveSol();
              setMore(!more);
            }}
            aria-expanded={more}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 font-medium",
              retail ? "min-h-16 text-[11px]" : "min-h-14 text-[10px]",
              more ? "text-ink" : "text-muted",
            )}
          >
            <span
              className={clsx("relative flex items-center justify-center rounded-full", retail ? "h-9 w-14" : "h-7 w-12", more && "bg-sun")}
            >
              <Menu className={retail ? "size-[22px]" : "size-[18px]"} aria-hidden />
              {retail && unread > 0 && (
                <span className="absolute -top-0.5 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[9px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </span>
            More
          </button>
        )}
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
                      { label: "Messages", href: PATHS.messages, n: unread },
                      { label: "Notifications", href: PATHS.notifications, n: mentions },
                      { label: "Email", href: PATHS.inbox, n: mail },
                    ]
                  : []),
                { label: "Updates", href: PATHS.updates, n: updates },
                { label: "Feedback", href: PATHS.feedback, n: 0 },
                ...(kind !== "inspector" ? [{ label: "Usage", href: `${PATHS.settings}/usage`, n: 0 }] : []),
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
      {/* Who you talk to, floating on the right (Sol, the agents, and team chat under them; not over the design
          tool, which needs the room) and Sol's panel. */}
      {retail && !tool && (
        <SolRail
          team={<TeamChatButton me={account.email} customers={unread + mentions} />}
          assistant={kind === "retailer" ? <RailAgents /> : undefined}
          routines={kind === "retailer" ? <RoutinesRound /> : undefined}
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
