"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, Menu, Sparkles, X } from "lucide-react";
import { BrandEyebrow, Sunrise } from "./business-brand";
import { LivingHero } from "./living-hero";
import { SalesLoop } from "./sales-loop";
import { Wordmark } from "@/components/ui/primitives";
import { ENTERPRISE_FROM, TOKEN_PACKS, packWords, type BillingInterval } from "@/lib/domain/design/plans";
import { CLOSING, COMING_SOON_LABEL, FAQ, PRICING, SALES_HERO, HERO_LIVE, UPGRADE } from "@/lib/domain/design/sales-page";
import { askSales, startPlan } from "@/lib/services/billing";
import { TryDemoButton } from "./business-demo";
import { ListingRoofExample } from "./designer-showcase";
import { Reveal } from "./front-hero";
import { ProductFilm } from "./product-film";
import { TeamScene, TEAM_SCENE_MS } from "./film-team-scene";

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
      {/* Six slides at most (17 Nov 2026, Martin: "there is just too much and the power of the features is being lost"):
          your sales team, how it sells, the film, the old way and the new, pricing with the questions, the close. */}
      <LivingHero signedIn={signedIn} />
      <SalesLoop />
      <FilmSection />
      <Upgrade />
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

/** The page's sections, behind the top bar's menu (17 Nov 2026, Martin: the titles across the bar go into a menu). */
const PAGE_LINKS = [
  { href: "#start", label: "Your sales team" },
  { href: "#sales", label: "How it sells" },
  { href: "#film", label: "See it work" },
  { href: "#upgrade", label: "What you get" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Questions" },
] as const;

/**
 * The top bar (17 Nov 2026, Martin): the menu on the left, RENUABL alone in the middle (the wordmark, no "Business"
 * beside it), Start demo and Sign up on the right.
 */
function Header({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      {/* RENUABL Business: the network's side for retailers and installers (RENUABL Home, for homeowners, is at /). */}
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 lg:px-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="page-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
            className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
          {open && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-0 cursor-default" onClick={() => setOpen(false)} />
              <nav id="page-menu" className="absolute left-0 top-12 z-10 w-60 rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line">
                {PAGE_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="my-1.5 h-px bg-line" />
                <Link
                  href={signedIn ? "/design" : "/design/sign-in"}
                  className="block rounded-xl px-3 py-2.5 text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {signedIn ? "Open RENUABL" : "Sign in"}
                </Link>
              </nav>
            </>
          )}
        </div>
        <Link href="/business" aria-label="RENUABL Business" className="justify-self-center">
          <Wordmark />
        </Link>
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex">
            <TryDemoButton look="bar" label="Start demo" />
          </span>
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

/**
 * The product film, under the living hero (17 Nov 2026, Martin: the agents are the marketing, so they lead; the film is
 * the proof, each screen narrated by the agent doing the work).
 */
function FilmSection() {
  return (
    <section className="snap-start scroll-mt-16 px-5 pb-20 pt-16 lg:px-8" aria-labelledby="film">
      <div className="mx-auto max-w-[64rem] text-center">
        <BrandEyebrow>{HERO_LIVE.film.eyebrow}</BrandEyebrow>
        <h2 id="film" className="mt-4 text-[clamp(30px,3.6vw,52px)] font-semibold leading-[1.02] tracking-[-0.04em]">
          {HERO_LIVE.film.headline}
        </h2>
        <div className="mt-10 text-left">
          <ProductFilm />
        </div>
      </div>
    </section>
  );
}

/**
 * The three things RENUABL is known by, a band each under the hero (3 Nov 2026, Martin: the designer, Sol and the
 * Marketplace are huge features and must feel it): the design tool with AI over it, Sol, and the Marketplace.
 */

/** How long each card of the upgrade stays on top before the next is dealt, ms. */
const DECK_MS = 4500;
/** The team card plays its conversation through before the next is dealt. */
const holdOf = (key: string) => (key === "team" ? TEAM_SCENE_MS + 800 : DECK_MS);

/** The team chat scene on its own clock, from the start each time its card comes to the top; still otherwise. */
function LiveTeam({ live }: { live?: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!live) return;
    const from = performance.now();
    const timer = window.setInterval(() => setMs(Math.min(TEAM_SCENE_MS, performance.now() - from)), 40);
    return () => {
      window.clearInterval(timer);
      setMs(0);
    };
  }, [live]);
  return <TeamScene ms={ms} still={!live} />;
}

/** What each card of the upgrade shows: a real screen where there is one, else the product drawn (made-up data). */
function UpgradeVisual({ k, live }: { k: (typeof UPGRADE.items)[number]["key"]; live?: boolean }) {
  const shot = (src: string, alt: string, position = "object-top") => (
    <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 720px, 100vw" className={clsx("object-cover", position)} />
  );
  switch (k) {
    case "crm":
      return shot("/design/landing/deals.webp", "The smart CRM's pipeline, with each deal's temperature and who to call first");
    case "sol":
      return shot("/design/landing/today-sol.webp", "Sol writing up the day, the most pressing thing at the top");
    case "design":
      return shot(
        "/design/landing/film/design-sol.webp",
        "Sol suggesting the system from the customer's bill in the designer",
        "object-center",
      );
    case "proposals":
      return <ProposalCardExample />;
    case "service":
      return shot("/design/landing/service-sol.webp", "A service case with Sol's summary and recommended next steps");
    case "installs":
      return shot("/design/landing/calendar.webp", "The install calendar with each week's capacity");
    case "team":
      return (
        <div
          className="absolute inset-0 [container-type:inline-size]"
          aria-label="Team chat: a colleague asks about a battery in a garage and Sol is asked in"
        >
          <LiveTeam live={live} />
        </div>
      );
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
    const t = window.setTimeout(() => setAt((n) => (n + 1) % items.length), holdOf(items[at].key));
    return () => window.clearTimeout(t);
  }, [at, paused, still, items]);
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
        className="mx-auto grid w-full max-w-[74rem] items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div>
          <BrandEyebrow dark>{UPGRADE.eyebrow}</BrandEyebrow>
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
                        animation: `upgrade-fill ${holdOf(item.key)}ms linear forwards`,
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
          <div className="relative aspect-[16/10] w-full">
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
                    {shown && <UpgradeVisual k={item.key} live={place === 0 && !still} />}
                  </div>
                </div>
              );
            })}
          </div>
          {/* The old way and the new, side by side under the screen (16 Nov 2026, Martin: a crossed-out line over the
              picture wasn't instantly read as the old way). */}
          <div
            key={now.key}
            className="film-pop mt-6 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)] sm:items-stretch"
            aria-live="polite"
          >
            <div className="rounded-2xl bg-white/[0.04] px-5 py-4 ring-1 ring-white/10">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <X className="size-3.5" aria-hidden />
                {UPGRADE.before}
              </p>
              <p className="mt-2 text-[16px] leading-snug text-white/55">{now.was}</p>
            </div>
            <ArrowRight className="hidden size-5 self-center text-sun-bright sm:block" aria-hidden />
            <div className="rounded-2xl bg-white px-5 py-4 text-ink">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sun-line">
                <Check className="size-3.5" aria-hidden />
                {UPGRADE.after}
              </p>
              <p className="mt-2 text-[18px] font-semibold leading-snug tracking-tight">{now.title}</p>
              <p className="mt-1 text-[14px] leading-snug text-ink-2">{now.body}</p>
            </div>
          </div>
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

/**
 * The pricing, as a software pricing page (3 Nov 2026, Martin): Monthly and the 12-month plan side by side with
 * Enterprise, nothing crossed out. Each plan's Sign up opens the email box under it and goes to Stripe's checkout; the
 * 12-month plan is then chosen in Billing (it can't be bought at sign-up). Figures from `plans.ts` through `PRICING`.
 */
function Pricing() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section id="pricing" className="snap-start scroll-mt-16 px-5 py-24 lg:px-8 lg:py-28" aria-labelledby="pricing-title">
      <Reveal className="mx-auto w-full max-w-7xl">
        <div className="text-center">
          <BrandEyebrow>{PRICING.eyebrow}</BrandEyebrow>
          <h2 id="pricing-title" className="mt-5 text-[clamp(36px,5vw,64px)] font-semibold leading-[1] tracking-[-0.035em]">
            {PRICING.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[18px] text-ink-2">{PRICING.sub}</p>
        </div>

        {/*
          Three even cards, as xAI prices Grok Bot (16 Nov 2026, Martin: "i love the way they make the $30 pricing look so
          cheap"): the price large, one button, then what it includes, each plan building on the one before.
        */}
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PRICING.plans.map((p) => (
            <PlanCard
              key={p.key}
              name={p.name}
              price={p.price}
              per={PRICING.perShort}
              note={p.note}
              listHead={p.listHead}
              list={"list" in p ? p.list : PRICING.includes}
            >
              {open === p.key ? (
                <TrialForm id={p.key} label="Continue" />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(p.key)}
                  className="h-12 w-full rounded-full bg-primary text-[16px] font-medium text-white hover:brightness-110"
                >
                  {SALES_HERO.cta}
                </button>
              )}
            </PlanCard>
          ))}
          <Enterprise />
        </div>

        <p className="mt-5 text-center text-[14px] text-ink-2">{PRICING.firstMonth}</p>

        {/* What's charged beside a plan: the designer by the job, and the two add-ons, one price for the business. */}
        <div className="mt-16 text-center">
          <p className="text-[22px] font-semibold tracking-[-0.02em]">{PRICING.addOnsTitle}</p>
          <p className="mx-auto mt-2 max-w-2xl text-[15px] text-ink-2">{PRICING.addOnsSub}</p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="rounded-[28px] bg-surface p-8 ring-1 ring-line">
            <p className="text-[17px] font-semibold">{PRICING.tokensTitle}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{PRICING.tokens}</p>
            <p className="mt-5 flex flex-wrap gap-2 text-[13px]">
              {TOKEN_PACKS.map((p) => (
                <span key={p} className="rounded-full bg-canvas px-3 py-1 tabular-nums ring-1 ring-line">
                  {packWords(p)}
                </span>
              ))}
            </p>
          </div>
          {PRICING.addOns.map((a) => (
            <div key={a.key} className="rounded-[28px] bg-surface p-8 ring-1 ring-line">
              <p className="text-[17px] font-semibold">{a.name}</p>
              <p className="mt-3 text-[15px] font-medium">{a.price}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a.what}</p>
            </div>
          ))}
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
    <PlanCard
      name={PRICING.enterprise.title}
      price={PRICING.enterprise.price}
      note={`${PRICING.enterprise.lead}. ${PRICING.enterprise.note}`}
      listHead={PRICING.enterprise.listHead}
      list={PRICING.enterprise.list}
    >
      {state?.ok ? (
        <p className="text-[15px] text-positive">{state.message}</p>
      ) : open ? (
        <form onSubmit={(e) => void go(e)} className="space-y-2.5 text-ink">
          <input className={input} placeholder="Your name" required value={form.name} onChange={set("name")} />
          <input className={input} placeholder="Business" required value={form.business} onChange={set("business")} />
          <input className={input} placeholder="Work email" type="email" required value={form.email} onChange={set("email")} />
          <input className={input} placeholder="Mobile" type="tel" value={form.mobile} onChange={set("mobile")} />
          <label className="block text-[13px] text-ink-2">
            How many users?
            <input className={clsx(input, "mt-1")} type="number" min={1} value={form.users} onChange={set("users")} />
          </label>
          <textarea
            className={clsx(input, "h-20 py-2")}
            placeholder="Anything we should know (optional)"
            value={form.note}
            onChange={set("note")}
          />
          <button disabled={busy} className="h-11 w-full rounded-full bg-primary text-[15px] font-medium text-white hover:brightness-110">
            {busy ? "Sending…" : PRICING.enterprise.cta}
          </button>
          {state && !state.ok && <p className="text-sm text-danger">{state.message}</p>}
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="h-12 w-full rounded-full bg-surface text-[16px] font-medium text-ink ring-1 ring-line-strong hover:bg-canvas"
        >
          {PRICING.enterprise.cta}
        </button>
      )}
    </PlanCard>
  );
}

/** One plan, as xAI sets theirs out: its name, the price large with what it's per, a line, the button, what it includes. */
function PlanCard({
  name,
  price,
  per,
  note,
  listHead,
  list,
  children,
}: {
  name: string;
  price: string;
  per?: string;
  note: string;
  listHead: string;
  list: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[32px] bg-surface p-8 ring-1 ring-line sm:p-10">
      <p className="text-[17px] text-ink-2">{name}</p>
      <p className="mt-6 flex items-baseline gap-2">
        <span
          className={clsx(
            "text-[clamp(48px,4.4vw,64px)] font-semibold leading-none tracking-[-0.04em]",
            price.startsWith("$") && "tabular-nums",
          )}
        >
          {price}
        </span>
        {per && <span className="text-[17px] text-ink-2">{per}</span>}
      </p>
      <p className="mt-3 min-h-[3em] text-[16px] leading-[1.5] text-ink-2">{note}</p>
      <div className="mt-8">{children}</div>
      <p className="mt-10 text-[16px] font-semibold">{listHead}</p>
      <ul className="mt-4 space-y-3">
        {list.map((l) => (
          <li key={l} className="flex gap-3 text-[16px] text-ink-2">
            <Check className="mt-1 size-4 shrink-0 text-ink-2" aria-hidden />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq() {
  return (
    <section className="scroll-mt-20 px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="faq">
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
    <section
      className="relative isolate overflow-hidden bg-[#0b0b0d] px-5 pb-40 pt-28 text-white snap-start lg:px-8 lg:pb-56 lg:pt-36"
      aria-labelledby="closing"
    >
      <Sunrise size="small" />
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
