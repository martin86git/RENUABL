"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Brain, Check, Clock, LifeBuoy, PencilRuler, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/ui/primitives";
import { ENTERPRISE_FROM, TOKEN_PACKS, dollars, packPriceCents, type BillingInterval } from "@/lib/domain/design/plans";
import {
  CLOSING,
  COMING_SOON,
  COMING_SOON_LABEL,
  EVERYTHING,
  FAQ,
  JOURNEY,
  MARKETPLACE,
  ASK_ANYTHING,
  ASK_DEMO,
  BIG_THREE,
  PRICING,
  SALES_HERO,
  CRM_SHOT,
  SERVICE_SHOT,
  SOL,
  UPGRADE,
  type Visual,
} from "@/lib/domain/design/sales-page";
import { askSales, registerInterest, startPlan } from "@/lib/services/billing";
import { TryDemoButton } from "./business-demo";
import {
  AfterSigningDemo,
  AskDesignDemo,
  AutomationDemo,
  ConversationDemo,
  ListingRoofExample,
  SolAskDemo,
  ThreeDesignsDemo,
} from "./designer-showcase";
import { Reveal } from "./front-hero";
import { SolBadge, SolIcon } from "./sol-icon";
import { MarketplaceMark } from "./marketplace-bar";

/**
 * The sign-up page for solar businesses (`/design` signed out; copy in `domain/design/sales-page.ts`, prices in
 * `plans.ts`). It sells: one deal from enquiry to service shown on real screens (made-up
 * example data) and the product drawn at work, Sol, everything else in the box, what's coming, and the pricing. Starting
 * the plan is an email here, then Stripe's own secure page for the card, then straight back.
 */
export function SalesPage({ notice, signedIn = false }: { notice?: string | null; signedIn?: boolean }) {
  useFoldScroll();
  return (
    <div className="theme-studio min-h-dvh bg-canvas text-ink">
      <Header signedIn={signedIn} />
      {notice && <p className="mx-auto max-w-3xl px-5 pt-4 text-center text-sm text-danger">{notice}</p>}
      <Hero signedIn={signedIn} />
      <Upgrade />
      <BigThree />
      <Journey />
      <SolSection />
      <Everything />
      <Soon />
      <Marketplace />
      <Pricing />
      <Faq />
      <Closing />
      <StickySignUp />
      <footer className="snap-end border-t border-line px-5 py-10 text-center text-xs text-muted">
        <p>RENUABL · Reburthed Pty Ltd · ABN 96 662 374 905</p>
        <p className="mt-2 space-x-4">
          <Link href="/design/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/" className="hover:text-ink">
            For homeowners
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/design/sign-in" className="hover:text-ink">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}

/**
 * One scroll, one fold (3 Nov 2026, Martin: "a scroll should push me into the next fold", the way Apple's pages move).
 * On a screen at least 1024px wide, a turn of the wheel or a swipe on the trackpad glides the page to the next section
 * (`.snap-start`, each a fold tall where it can be), clear of the 4rem top bar, and the rest of that gesture's
 * momentum is swallowed so it moves one fold, not three. A section taller than the screen scrolls as usual until its
 * end is in view. A box that scrolls inside the page keeps its own scrolling; keys, phones and pinch zoom are left
 * alone. CSS snapping alone didn't do it: it pulls back to the fold you were on after a small scroll.
 */
function useFoldScroll() {
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const TOP = 64;
    const QUIET_MS = 220;
    let gliding = false;
    let lastWheel = 0;
    let glideEnds = 0;

    const tops = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".snap-start"))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - TOP))
        .sort((a, b) => a - b);

    const scrollsInside = (target: EventTarget | null, down: boolean) => {
      for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          if (down ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
        }
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!wide.matches || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const now = performance.now();
      const quiet = now - lastWheel > QUIET_MS;
      lastWheel = now;
      // The tail of the gesture that moved the page: swallowed until the glide is done and the wheel goes quiet.
      if (gliding) {
        if (now < glideEnds || !quiet) {
          e.preventDefault();
          return;
        }
        gliding = false;
      }
      const down = e.deltaY > 0;
      if (scrollsInside(e.target, down)) return;
      const y = window.scrollY;
      const fold = window.innerHeight - TOP;
      const all = tops();
      const target = down ? all.find((t) => t > y + 2) : [...all].reverse().find((t) => t < y - 2);
      if (target === undefined) return;
      // Still inside a section well over a screen tall: let it scroll until its edge is within about a fold. A slide a
      // little taller than the screen (its content a few pixels over) still moves as one.
      if (Math.abs(target - y) > fold * 1.2) return;
      e.preventDefault();
      gliding = true;
      glideEnds = now + (still.matches ? 150 : 700);
      window.scrollTo({ top: target, behavior: still.matches ? "auto" : "smooth" });
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
}

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        {/* RENUABL Business: the network's side for retailers and installers (RENUABL Home, for homeowners, is at /). */}
        <Link href="/business" aria-label="RENUABL Business" className="flex items-baseline gap-2">
          <Wordmark />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-line sm:tracking-[0.2em]">Business</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-ink-2 md:flex">
          <a href="#designer" className="hover:text-ink">
            Designer
          </a>
          <a href="#sol" className="hover:text-ink">
            Sol
          </a>
          <a href="#network" className="hover:text-ink">
            Marketplace
          </a>
          <a href="#journey" className="hover:text-ink">
            How it works
          </a>
          <a href="#pricing" className="hover:text-ink">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden text-[14px] text-ink-2 hover:text-ink lg:inline">
            For homeowners
          </Link>
          {signedIn ? (
            <Link href="/design" className="whitespace-nowrap text-[14px] font-medium text-ink hover:text-sun-line">
              Open RENUABL
            </Link>
          ) : (
            <Link href="/design/sign-in" className="whitespace-nowrap text-[14px] text-ink-2 hover:text-ink">
              Sign in
            </Link>
          )}
          {!signedIn && (
            <span className="hidden sm:inline-flex">
              <TryDemoButton look="bar" />
            </span>
          )}
          <a
            href="#pricing"
            className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-sun-line px-3.5 text-[13px] font-semibold text-white shadow-sm hover:brightness-105 sm:px-4"
          >
            {SALES_HERO.cta}
          </a>
        </div>
      </div>
    </header>
  );
}

/** The email box that starts the plan: Stripe's page next, then back. */
function TrialForm({
  seats = 1,
  interval = "month",
  dark = false,
  label = SALES_HERO.cta,
  id = "plan",
}: {
  seats?: number;
  interval?: BillingInterval;
  dark?: boolean;
  label?: string;
  id?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const a = await startPlan({ email, seats, interval });
    if (a.ok && a.url) window.location.assign(a.url);
    else {
      setBusy(false);
      setProblem(a.message ?? "That didn't go through.");
    }
  };
  return (
    <form onSubmit={(e) => void go(e)} className="w-full">
      <div
        className={clsx(
          "flex flex-col gap-2 rounded-2xl p-1.5 sm:flex-row",
          dark ? "bg-white/10 ring-1 ring-white/15" : "bg-surface shadow-lift ring-1 ring-line",
        )}
      >
        <label className="sr-only" htmlFor={`trial-email-${id}`}>
          Work email
        </label>
        <input
          id={`trial-email-${id}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your work email"
          className={clsx(
            "h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-[16px] outline-none",
            dark ? "text-white placeholder:text-white/50" : "text-ink placeholder:text-muted",
          )}
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sun-line px-5 text-[15px] font-semibold text-white hover:brightness-105 disabled:opacity-80"
        >
          {busy ? "Opening secure checkout…" : label}
          {!busy && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </div>
      {problem && <p className={clsx("mt-2 text-sm", dark ? "text-sun-bright" : "text-danger")}>{problem}</p>}
    </form>
  );
}

function Screen({
  src,
  alt,
  priority,
  width = 2880,
  height = 1800,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl bg-surface shadow-[0_30px_80px_-30px_rgba(11,11,12,0.35)] ring-1 ring-line">
      <div className="flex h-7 items-center gap-1.5 border-b border-line bg-surface-2 px-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(min-width: 1024px) 760px, 100vw"
        priority={priority}
        className="h-auto w-full"
      />
    </figure>
  );
}

/** "Sign up": every one on the page goes to the pricing, where the plan is chosen (3 Nov 2026, Martin). */
function SignUpLink({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href="#pricing"
      className={clsx(
        "inline-flex h-12 items-center gap-2 rounded-full px-7 text-[16px] font-semibold hover:brightness-105",
        dark ? "bg-white text-ink" : "bg-sun-line text-white shadow-lift",
      )}
    >
      {SALES_HERO.cta}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  );
}

function VisualOf({ visual }: { visual: Visual }) {
  if (visual.kind === "shot") return <Screen src={visual.src} alt={visual.alt} />;
  return (
    <div className="overflow-hidden rounded-2xl">
      {visual.demo === "automation" ? (
        <AutomationDemo />
      ) : visual.demo === "three" ? (
        <ThreeDesignsDemo />
      ) : visual.demo === "conversation" ? (
        <ConversationDemo />
      ) : (
        <AfterSigningDemo />
      )}
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      id="start"
      className="relative isolate overflow-x-clip snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center"
      aria-labelledby="hero"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[80vh]"
        style={{ background: "radial-gradient(55% 50% at 30% 30%, rgba(255,90,31,0.12), rgba(255,90,31,0) 70%)" }}
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">{SALES_HERO.eyebrow}</p>
          <h1 id="hero" className="mt-5 text-[clamp(52px,8vw,104px)] font-semibold leading-[0.92] tracking-[-0.045em]">
            {SALES_HERO.headline.map((part, i, all) => (
              <span key={part} className={clsx("block", i === all.length - 1 && "text-sun-line")}>
                {part}
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-ink-2">{SALES_HERO.sub}</p>
          <div className="mt-8 max-w-xl">
            <div className="flex flex-wrap items-center gap-3">
              <SignUpLink />
              {/* Try the demo (demo.ts): one press into a demo account, no form. Not for someone already signed in. */}
              {!signedIn && <TryDemoButton look="quiet" />}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
              {SALES_HERO.small.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-sun-line" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="lg:-mr-24">
          <SolAskDemo label={ASK_ANYTHING.label} prompts={ASK_ANYTHING.prompts} />
          <p className="mt-3 text-center text-xs text-muted">{ASK_ANYTHING.caption}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * The three things RENUABL is known by, a band each under the hero (3 Nov 2026, Martin: the designer, Sol and the
 * Marketplace are huge features and must feel it): the design tool with AI over it, Sol, and the Marketplace.
 */
function BigThree() {
  return (
    <div aria-label="The design tool, Sol and RENUABL Marketplace">
      {BIG_THREE.map((p, i) => {
        const look =
          p.id === "designer"
            ? {
                band: "bg-canvas text-ink",
                eyebrow: "text-ink-2",
                body: "text-ink-2",
                tick: "text-sun-line",
                link: "text-sun-line hover:brightness-110",
              }
            : p.id === "crm" || p.id === "service"
              ? {
                  band: p.id === "crm" ? "bg-surface text-ink" : "bg-canvas text-ink",
                  eyebrow: "text-ink-2",
                  body: "text-ink-2",
                  tick: "text-sun-line",
                  link: "text-sun-line hover:brightness-110",
                }
              : p.id === "sol"
                ? {
                    band: "bg-primary text-white",
                    eyebrow: "text-sun-bright",
                    body: "text-white/75",
                    tick: "text-sun-bright",
                    link: "text-white hover:text-white/80",
                  }
                : {
                    band: "bg-market text-white",
                    eyebrow: "text-market-ink",
                    body: "text-white/80",
                    tick: "text-market-ink",
                    link: "text-white hover:text-white/80",
                  };
        const linkClass = clsx("mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold", look.link);
        const mark =
          p.id === "designer" ? (
            <span className="grid size-12 place-items-center rounded-full bg-sun-line text-white">
              <PencilRuler className="size-6" />
            </span>
          ) : p.id === "crm" ? (
            <span className="grid size-12 place-items-center rounded-full bg-primary text-white">
              <Brain className="size-6" />
            </span>
          ) : p.id === "service" ? (
            <span className="grid size-12 place-items-center rounded-full bg-primary text-white">
              <LifeBuoy className="size-6" />
            </span>
          ) : p.id === "sol" ? (
            <span className="grid size-12 place-items-center rounded-full bg-white/10">
              <SolBadge className="size-7" />
            </span>
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-white text-market">
              <MarketplaceMark className="size-6" />
            </span>
          );
        const visual =
          p.id === "designer" ? (
            <div>
              <AskDesignDemo label={ASK_DEMO.label} request={ASK_DEMO.request} reply={ASK_DEMO.reply} />
              <p className="mt-3 text-center text-xs text-muted">{ASK_DEMO.caption}</p>
            </div>
          ) : p.id === "crm" ? (
            <Screen src={CRM_SHOT.src} alt={CRM_SHOT.alt} />
          ) : p.id === "service" ? (
            <Screen src={SERVICE_SHOT.src} alt={SERVICE_SHOT.alt} />
          ) : p.id === "sol" ? (
            <Screen
              src="/design/landing/today-sol.webp"
              alt="RENUABL's Today screen: Sol writes up the day, the most pressing thing at the top (example data)"
            />
          ) : (
            <div className="overflow-hidden rounded-2xl ring-1 ring-white/15">
              <ListingRoofExample className="block h-auto w-full" />
            </div>
          );
        return (
          <section
            key={p.id}
            id={p.id === "marketplace" ? "network" : p.id === "designer" || p.id === "crm" || p.id === "service" ? p.id : undefined}
            className={clsx(
              "scroll-mt-16 px-5 py-20 lg:px-8 lg:py-24 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center",
              look.band,
            )}
            aria-labelledby={`big-${p.id}`}
          >
            {/* One fold (Martin): the words beside the picture, the picture given the larger share. */}
            <Reveal className="mx-auto grid w-full max-w-[88rem] items-center gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]">
              <div className={clsx(i % 2 === 1 && "lg:order-2")}>
                <div className="flex items-center gap-4" aria-hidden>
                  {mark}
                  <span className={clsx("font-mono text-[13px]", look.eyebrow)}>0{i + 1}</span>
                </div>
                <p className={clsx("mt-6 text-[13px] font-medium uppercase tracking-[0.18em]", look.eyebrow)}>{p.eyebrow}</p>
                <h2 id={`big-${p.id}`} className="mt-3 text-[clamp(32px,3.6vw,52px)] font-semibold leading-[1] tracking-[-0.04em]">
                  {p.title}
                </h2>
                <p className={clsx("mt-5 text-[16px] leading-relaxed", look.body)}>{p.body}</p>
                <ul className="mt-5 grid gap-2 text-[14px]">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5">
                      <Check className={clsx("mt-0.5 size-4 shrink-0", look.tick)} aria-hidden />
                      {pt}
                    </li>
                  ))}
                </ul>
                {p.link.href.startsWith("#") ? (
                  <a href={p.link.href} className={linkClass}>
                    {p.link.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                ) : (
                  <Link href={p.link.href} className={linkClass}>
                    {p.link.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
              <div className={clsx("min-w-0", i % 2 === 1 && "lg:order-1")}>{visual}</div>
            </Reveal>
          </section>
        );
      })}
    </div>
  );
}

/** How long each card of the upgrade stays on top before the next is dealt, ms. */
const DECK_MS = 4500;

/** What each card of the upgrade shows: a real screen where there is one, else the product drawn (made-up data). */
function UpgradeVisual({ k }: { k: (typeof UPGRADE.items)[number]["key"] }) {
  const shot = (src: string, alt: string, position = "object-top") => (
    <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 720px, 100vw" className={clsx("object-cover", position)} />
  );
  switch (k) {
    case "crm":
      return shot("/design/landing/deals.webp", "The smart CRM's pipeline, with each deal's temperature and who to call first");
    case "sol":
      return shot("/design/landing/today-sol.webp", "Sol writing up the day, the most pressing thing at the top");
    case "design":
      return (
        <div className="absolute inset-0 overflow-hidden bg-canvas p-3">
          <AskDesignDemo label={ASK_DEMO.label} request={ASK_DEMO.request} reply={ASK_DEMO.reply} />
        </div>
      );
    case "proposals":
      return <ProposalCardExample />;
    case "service":
      return shot("/design/landing/service-sol.webp", "A service case with Sol's summary and recommended next steps");
    case "installs":
      return shot("/design/landing/calendar.webp", "The install calendar with each week's capacity");
    case "team":
      return shot("/design/landing/sol-garage-wall.webp", "Team chat with Sol answering in the Installations channel");
    case "market":
      return (
        <div className="absolute inset-0 grid place-items-center bg-market p-6">
          <ListingRoofExample className="h-full w-auto max-w-full rounded-xl" />
        </div>
      );
  }
}

/** A proposal as a customer opens it, drawn small: the business's own name and colour (a made-up business). */
function ProposalCardExample() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#f4efe8] p-5 sm:p-7">
      <div className="mx-auto h-full max-w-md overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-black/5">
        <div className="flex items-center justify-between bg-[#1f4d3a] px-5 py-4 text-white">
          <span className="text-[14px] font-semibold">Sunrise Solar (example)</span>
          <span className="text-[11px] text-white/70">Proposal for Olivia</span>
        </div>
        <div className="space-y-3 p-5 text-[13px] text-ink">
          <p className="text-[18px] font-semibold tracking-tight">Solar and a battery for your home</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["8.07 kW", "solar"],
              ["16 kWh", "battery"],
              ["3", "systems to choose"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-[#1f4d3a]/5 px-2 py-2">
                <p className="text-[15px] font-semibold tabular-nums">{v}</p>
                <p className="text-[11px] text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-muted">You pay, after the rebate</span>
            <span className="text-[18px] font-semibold tabular-nums">$14,980</span>
          </div>
          <span className="block rounded-lg bg-[#1f4d3a] py-2.5 text-center text-[13px] font-semibold text-white">
            I&apos;d like to go ahead
          </span>
          <p className="text-[11px] text-muted">Example business and figures.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Everything a business gets, straight after the hero (`UPGRADE`; 3 Nov 2026, Martin: a list or cards on a page
 * didn't show it, he wanted overlaid cards that show what each thing looks like). A deck of cards, each a real screen
 * (or the product drawn), dealt one after another with the next two peeking behind; the list beside it says which is
 * on top and jumps to any. Stops dealing while hovered, and doesn't move with reduced motion.
 */
function Upgrade() {
  const items = UPGRADE.items;
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (paused || still) return;
    const t = window.setTimeout(() => setAt((n) => (n + 1) % items.length), DECK_MS);
    return () => window.clearTimeout(t);
  }, [at, paused, still, items.length]);
  const now = items[at];
  return (
    <section
      className="relative isolate overflow-hidden bg-primary px-5 py-20 text-white lg:px-8 lg:py-24 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center"
      aria-labelledby="upgrade"
    >
      {/* The bar under the card on top fills as it waits to be dealt. */}
      <style>{"@keyframes upgrade-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>
      <div
        aria-hidden
        className="absolute -right-40 top-10 -z-10 size-[40rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,90,31,0.22), rgba(255,90,31,0))" }}
      />
      <div
        className="mx-auto grid w-full max-w-[88rem] items-center gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-sun-bright">{UPGRADE.eyebrow}</p>
          <h2 id="upgrade" className="mt-3 text-[clamp(36px,4.4vw,64px)] font-semibold leading-[0.95] tracking-[-0.045em]">
            {UPGRADE.headline}
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-white/70">{UPGRADE.sub}</p>
          <ol className="mt-7 grid gap-1">
            {items.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setAt(i)}
                  aria-current={i === at}
                  className={clsx(
                    "relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-[15px] transition-colors",
                    i === at ? "bg-white/10 text-white" : "text-white/55 hover:text-white",
                  )}
                >
                  <span className={clsx("font-mono text-[12px]", i === at ? "text-sun-bright" : "text-white/35")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{item.title}</span>
                  {"soon" in item && item.soon && <span className="text-[11px] text-sun-bright">{COMING_SOON_LABEL}</span>}
                  {i === at && !still && (
                    <span
                      key={`${at}-${paused}`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-sun-line"
                      style={{
                        animation: `upgrade-fill ${DECK_MS}ms linear forwards`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
        {/* The deck: the card on top, the next two peeking up behind it. */}
        <div className="relative min-w-0 pt-10">
          <div className="relative aspect-[16/11] w-full">
            {items.map((item, i) => {
              const place = (i - at + items.length) % items.length;
              const shown = place < 3;
              return (
                <div
                  key={item.key}
                  aria-hidden={place !== 0}
                  className="absolute inset-0 transition-all duration-700 ease-out motion-reduce:transition-none"
                  style={{
                    transform: `translateY(${-place * 20}px) scale(${1 - place * 0.05})`,
                    opacity: shown ? 1 - place * 0.25 : 0,
                    zIndex: items.length - place,
                    pointerEvents: place === 0 ? "auto" : "none",
                  }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-2xl bg-surface shadow-[0_30px_80px_-25px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                    {shown && <UpgradeVisual k={item.key} />}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-5 pb-4 pt-14 text-white sm:px-6">
                      <p className="text-[12px] text-white/60 line-through decoration-sun-line">{item.was}</p>
                      <p className="mt-1 text-[20px] font-semibold tracking-tight sm:text-[24px]">{item.title}</p>
                      <p className="mt-0.5 max-w-xl text-[13px] text-white/80 sm:text-[14px]">{item.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="sr-only" aria-live="polite">
            {now.title}: {now.body}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * A sign-up that follows the reader down the page (3 Nov 2026, Martin: there are a lot of slides, so every one is a
 * chance to sign up): once the hero's box has scrolled away, a bar at the foot of the screen with the email box and
 * Get started; it goes again over the closing box, and can be put away for the visit.
 */
function StickySignUp() {
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("start");
    const pricing = document.getElementById("pricing");
    const closing = document.getElementById("closing");
    if (!hero || !("IntersectionObserver" in window)) return;
    const on = new Map<Element, boolean>([[hero, true]]);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) on.set(e.target, e.isIntersecting);
      setShow(![...on.values()].some(Boolean));
    });
    for (const el of [hero, pricing, closing]) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  if (closed) return null;
  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-all duration-300 sm:px-5 sm:pb-5",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
      aria-hidden={!show}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl bg-primary p-2 pl-5 text-white shadow-[0_20px_60px_-15px_rgba(11,11,12,0.6)] ring-1 ring-white/10">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold">
          <Sparkles className="size-4 shrink-0 text-sun-bright" aria-hidden />
          <span className="truncate">Your whole solar business, in one platform.</span>
        </span>
        <a
          href="#pricing"
          tabIndex={show ? 0 : -1}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-sun-line px-5 text-[15px] font-semibold text-white hover:brightness-105"
        >
          {SALES_HERO.cta}
          <ArrowRight className="size-4" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => setClosed(true)}
          tabIndex={show ? 0 : -1}
          className="hidden size-9 shrink-0 place-items-center rounded-full text-white/60 hover:text-white sm:grid"
          aria-label="Put the sign-up bar away"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function Journey() {
  return (
    <section id="journey" className="snap-start px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="journey-title">
      <Reveal className="mx-auto w-full max-w-4xl text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">How it works</p>
        <h2 id="journey-title" className="mt-5 text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1] tracking-[-0.035em]">
          One deal. Start to finish. One place.
        </h2>
        <p className="mt-6 text-[18px] leading-relaxed text-ink-2">
          From the enquiry to the grid connection, every step of a solar job runs here. No exports, no double entry, no chasing.
        </p>
        <ol className="mx-auto mt-10 flex flex-wrap justify-center gap-2 text-[13px]">
          {JOURNEY.map((j, i) => (
            <li key={j.key}>
              <a
                href={`#step-${j.key}`}
                className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 ring-1 ring-line hover:ring-ink-2"
              >
                <span className="tabular-nums text-sun-line">{String(i + 1).padStart(2, "0")}</span>
                {j.step}
              </a>
            </li>
          ))}
        </ol>
      </Reveal>
      <div className="mx-auto mt-20 w-full max-w-7xl space-y-24 lg:mt-0 lg:space-y-0">
        {JOURNEY.map((j, i) => {
          const label = (
            <p className="text-[13px] font-medium tabular-nums tracking-[0.18em] text-sun-line">
              {String(i + 1).padStart(2, "0")} · {j.step.toUpperCase()}
            </p>
          );
          // The product drawn at work needs the whole width: its words go above it. A screenshot sits beside its words.
          if (j.visual.kind === "demo")
            return (
              <article
                key={j.key}
                id={`step-${j.key}`}
                className="snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center"
              >
                <Reveal className="mx-auto max-w-3xl text-center">
                  {label}
                  <h3 className="mt-4 text-[clamp(28px,3.6vw,46px)] font-semibold leading-[1.05] tracking-[-0.03em]">{j.title}</h3>
                  <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{j.body}</p>
                </Reveal>
                <Reveal className="mt-12">
                  <VisualOf visual={j.visual} />
                </Reveal>
              </article>
            );
          const flip = JOURNEY.slice(0, i).filter((x) => x.visual.kind === "shot").length % 2 === 1;
          return (
            <article
              key={j.key}
              id={`step-${j.key}`}
              className="snap-start grid items-center gap-10 lg:min-h-[calc(100dvh-4rem)] lg:content-center lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
            >
              <Reveal className={clsx(flip && "lg:order-2")}>
                {label}
                <h3 className="mt-4 text-[clamp(28px,3.6vw,46px)] font-semibold leading-[1.05] tracking-[-0.03em]">{j.title}</h3>
                <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{j.body}</p>
              </Reveal>
              <Reveal className={clsx(flip && "lg:order-1")}>
                <VisualOf visual={j.visual} />
              </Reveal>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SolSection() {
  return (
    <section id="sol" className="snap-start relative isolate overflow-x-clip px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="sol-title">
      <div aria-hidden className="absolute inset-0 -z-10 bg-sun/60" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-sun-ink">
            <SolIcon className="size-4" aria-hidden />
            {SOL.eyebrow}
          </p>
          <h2 id="sol-title" className="mt-5 text-[clamp(32px,4.4vw,56px)] font-semibold leading-[1.04] tracking-[-0.03em]">
            {SOL.headline}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{SOL.sub}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {SOL.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-muted">{SOL.footnote}</p>
        </Reveal>
        <Reveal>
          <Screen src={SOL.shot.src} alt={SOL.shot.alt} />
        </Reveal>
      </div>
      <div className="mx-auto mt-20 grid w-full max-w-7xl items-center gap-12 lg:mt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Reveal className="lg:order-2">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-sun-ink">{SOL.example.eyebrow}</p>
          <h3 className="mt-4 text-[clamp(26px,3.2vw,40px)] font-semibold leading-[1.08] tracking-[-0.025em]">{SOL.example.title}</h3>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{SOL.example.body}</p>
          <p className="mt-6 text-xs text-muted">{SOL.example.fine}</p>
        </Reveal>
        <Reveal className="mx-auto w-full max-w-[620px] lg:order-1">
          <Screen {...SOL.example.shot} />
        </Reveal>
      </div>
    </section>
  );
}

function Everything() {
  return (
    <section className="snap-start px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="everything">
      <Reveal className="mx-auto w-full max-w-6xl">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">And all of this, included</p>
        <h2 id="everything" className="mt-5 max-w-3xl text-[clamp(32px,4.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.035em]">
          The rest of the toolbox. No add-ons.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-3">
          {EVERYTHING.map((f) => (
            <div key={f.title} className="bg-surface p-6">
              <h3 className="text-[16px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["customers", "service"] as const).map((s) => (
            <Screen
              key={s}
              src={`/design/landing/${s}.webp`}
              alt={s === "customers" ? "RENUABL's customers list, with example data" : "RENUABL's service pipeline"}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Soon() {
  return (
    <section className="snap-start px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="soon">
      <Reveal className="mx-auto w-full max-w-6xl">
        <h2 id="soon" className="text-[clamp(26px,3.4vw,40px)] font-semibold tracking-[-0.03em]">
          On the way
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON.map((f) => (
            <div key={f.title} className="rounded-2xl bg-surface p-6 ring-1 ring-line">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sun-ink">
                <Clock className="size-3" aria-hidden />
                {COMING_SOON_LABEL}
              </span>
              <h3 className="mt-4 text-[16px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{f.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Marketplace() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const a = await registerInterest(email);
    setBusy(false);
    setState({ ok: a.ok, message: a.message ?? "" });
  };
  return (
    <section
      id="marketplace"
      className="snap-start scroll-mt-16 bg-surface px-5 py-24 lg:px-8 lg:py-32"
      aria-labelledby="marketplace-title"
    >
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <p className="flex items-center gap-4" aria-label="RENUABL Marketplace">
            <span
              className="grid size-16 place-items-center rounded-full bg-market text-white shadow-[0_8px_24px_rgba(24,73,169,0.3)]"
              aria-hidden
            >
              <MarketplaceMark className="size-8" />
            </span>
            <span className="flex flex-col leading-none" aria-hidden>
              <span className="text-[13px] font-medium uppercase tracking-[0.26em] text-ink">RENUABL</span>
              <span className="mt-1.5 text-[36px] font-semibold tracking-[-0.02em] text-sun-line">Marketplace</span>
            </span>
          </p>
          <span className="rounded-full bg-canvas px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted ring-1 ring-line">
            {COMING_SOON_LABEL}
          </span>
        </div>
        <h2
          id="marketplace-title"
          className="mt-5 max-w-3xl text-[clamp(32px,4.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.035em]"
        >
          {MARKETPLACE.headline}
        </h2>
        <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-ink-2">{MARKETPLACE.sub}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {MARKETPLACE.sides.map((s) => (
            <div key={s.title} className="rounded-2xl bg-canvas p-7 ring-1 ring-line">
              <h3 className="text-[20px] font-semibold">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <Link
          href="/design/marketplace"
          className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-market hover:underline"
        >
          {MARKETPLACE.look}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        {state?.ok ? (
          <p className="mt-10 text-[16px] text-market">{state.message}</p>
        ) : (
          <form
            onSubmit={(e) => void go(e)}
            className="mt-10 flex max-w-lg flex-col gap-2 rounded-2xl bg-canvas p-1.5 ring-1 ring-line sm:flex-row"
          >
            <label className="sr-only" htmlFor="interest-email">
              Email
            </label>
            <input
              id="interest-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your work email"
              className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-[16px] text-ink outline-none placeholder:text-muted"
            />
            <button disabled={busy} className="h-12 rounded-xl bg-market px-5 text-[15px] font-semibold text-white hover:brightness-110">
              {busy ? "Adding you…" : MARKETPLACE.cta}
            </button>
          </form>
        )}
        {state && !state.ok && <p className="mt-2 text-sm text-danger">{state.message}</p>}
      </Reveal>
    </section>
  );
}

/**
 * The pricing, as a software pricing page (3 Nov 2026, Martin): Monthly and the 12-month plan side by side with
 * Enterprise, nothing crossed out. Each plan's Sign up opens the email box under it and goes to Stripe's checkout; the
 * 12-month plan is then chosen in Billing (it can't be bought at sign-up). Figures from `plans.ts` through `PRICING`.
 */
function Pricing() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section id="pricing" className="snap-start scroll-mt-16 px-5 py-24 lg:px-8 lg:py-28" aria-labelledby="pricing-title">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">{PRICING.eyebrow}</p>
          <h2 id="pricing-title" className="mt-5 text-[clamp(36px,5vw,64px)] font-semibold leading-[1] tracking-[-0.035em]">
            {PRICING.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[18px] text-ink-2">{PRICING.sub}</p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PRICING.plans.map((p) => (
            <div
              key={p.key}
              className={clsx(
                "flex flex-col rounded-3xl bg-surface p-7 shadow-lift sm:p-8",
                p.featured ? "ring-2 ring-sun-line" : "ring-1 ring-line",
              )}
            >
              <p className="text-[15px] font-semibold">{p.name}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-[56px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{p.price}</span>
                <span className="text-[15px] text-ink-2">{p.per}</span>
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{p.note}</p>
              <div className="mt-auto pt-8">
                {open === p.key ? (
                  <TrialForm id={p.key} label="Continue" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(p.key)}
                    className={clsx(
                      "h-12 w-full rounded-xl text-[15px] font-semibold",
                      p.featured ? "bg-sun-line text-white hover:brightness-105" : "bg-primary text-white hover:brightness-110",
                    )}
                  >
                    {SALES_HERO.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
          <Enterprise />
        </div>

        <p className="mt-5 text-center text-[14px] text-ink-2">{PRICING.firstMonth}</p>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-3xl bg-surface p-7 ring-1 ring-line sm:p-8">
            <p className="text-[15px] font-semibold">{PRICING.includesTitle}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {PRICING.includes.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-surface p-7 ring-1 ring-line sm:p-8">
            <p className="text-[15px] font-semibold">{PRICING.tokensTitle}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{PRICING.tokens}</p>
            <p className="mt-4 flex flex-wrap gap-2 text-[13px]">
              {TOKEN_PACKS.map((p) => (
                <span key={p} className="rounded-full bg-canvas px-3 py-1 tabular-nums ring-1 ring-line">
                  {p} jobs · {dollars(packPriceCents(p))}
                </span>
              ))}
            </p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-muted">{PRICING.start}</p>
      </Reveal>
    </section>
  );
}

function Enterprise() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", business: "", email: "", mobile: "", users: String(ENTERPRISE_FROM), note: "" });
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const a = await askSales(form);
    setBusy(false);
    setState({ ok: a.ok, message: a.message ?? "" });
  };
  const input = "block h-11 w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-ink-2";
  return (
    <div className="flex flex-col rounded-3xl bg-primary p-7 text-white sm:p-10">
      <p className="text-[14px] font-medium text-white/70">{PRICING.enterprise.title}</p>
      <p className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">{PRICING.enterprise.lead}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-white/70">{PRICING.enterprise.body}</p>
      {state?.ok ? (
        <p className="mt-8 text-[15px] text-sun-bright">{state.message}</p>
      ) : open ? (
        <form onSubmit={(e) => void go(e)} className="mt-6 space-y-2.5 text-ink">
          <input className={input} placeholder="Your name" required value={form.name} onChange={set("name")} />
          <input className={input} placeholder="Business" required value={form.business} onChange={set("business")} />
          <input className={input} placeholder="Work email" type="email" required value={form.email} onChange={set("email")} />
          <input className={input} placeholder="Mobile" type="tel" value={form.mobile} onChange={set("mobile")} />
          <label className="block text-[13px] text-white/70">
            How many users?
            <input className={clsx(input, "mt-1")} type="number" min={1} value={form.users} onChange={set("users")} />
          </label>
          <textarea
            className={clsx(input, "h-20 py-2")}
            placeholder="Anything we should know (optional)"
            value={form.note}
            onChange={set("note")}
          />
          <button disabled={busy} className="h-11 w-full rounded-xl bg-white text-[15px] font-semibold text-ink hover:bg-white/90">
            {busy ? "Sending…" : PRICING.enterprise.cta}
          </button>
          {state && !state.ok && <p className="text-sm text-sun-bright">{state.message}</p>}
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-auto h-12 rounded-xl bg-white text-[15px] font-semibold text-ink hover:bg-white/90 lg:mt-10"
        >
          {PRICING.enterprise.cta}
        </button>
      )}
    </div>
  );
}

function Faq() {
  return (
    <section className="snap-start px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="faq">
      <Reveal className="mx-auto w-full max-w-3xl">
        <h2 id="faq" className="text-[clamp(26px,3.4vw,40px)] font-semibold tracking-[-0.03em]">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="cursor-pointer list-none text-[16px] font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="snap-start bg-primary px-5 py-24 text-white lg:px-8 lg:py-32" aria-labelledby="closing">
      <Reveal className="mx-auto w-full max-w-3xl text-center">
        <h2 id="closing" className="text-[clamp(40px,6.5vw,84px)] font-semibold leading-[0.98] tracking-[-0.04em]">
          {CLOSING.headline}
        </h2>
        <p className="mt-6 text-[18px] text-white/70">{CLOSING.sub}</p>
        <div className="mt-10">
          <SignUpLink dark />
        </div>
      </Reveal>
    </section>
  );
}
