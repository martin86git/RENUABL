"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, Clock, Layers } from "lucide-react";
import { Wordmark } from "@/components/ui/primitives";
import {
  ENTERPRISE_FROM,
  MAX_SELF_SERVE_SEATS,
  PLAN_WORDS,
  TOKEN_PACKS,
  dollars,
  packPriceCents,
  priceFor,
  type BillingInterval,
} from "@/lib/domain/design/plans";
import {
  CLOSING,
  COMING_SOON,
  COMING_SOON_LABEL,
  EVERYTHING,
  FAQ,
  JOURNEY,
  MARKETPLACE,
  OLD_WAY,
  PILLARS,
  PRICING,
  SALES_HERO,
  SOL,
  type Visual,
} from "@/lib/domain/design/sales-page";
import { askSales, registerInterest, startTrial } from "@/lib/services/billing";
import { AfterSigningDemo, AutomationDemo, ConversationDemo, ThreeDesignsDemo } from "./designer-showcase";
import { Reveal } from "./front-hero";
import { SolIcon } from "./sol-icon";

/**
 * The sign-up page for solar businesses (`/design` signed out; copy in `domain/design/sales-page.ts`, prices in
 * `plans.ts`). It sells: the price against the old way, one deal from enquiry to service shown on real screens (made-up
 * example data) and the product drawn at work, Sol, everything else in the box, what's coming, and the pricing. Starting
 * the trial is an email here, then Stripe's own secure page for the card, then straight back.
 */
export function SalesPage({ notice }: { notice?: string | null }) {
  return (
    <div className="theme-studio min-h-dvh bg-canvas text-ink">
      <Header />
      {notice && <p className="mx-auto max-w-3xl px-5 pt-4 text-center text-sm text-danger">{notice}</p>}
      <Hero />
      <Pillars />
      <OldWay />
      <Journey />
      <SolSection />
      <Everything />
      <Soon />
      <Marketplace />
      <Pricing />
      <Faq />
      <Closing />
      <footer className="border-t border-line px-5 py-10 text-center text-xs text-muted">
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

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        {/* RENUABL Business: the network's side for retailers and installers (RENUABL Home, for homeowners, is at /). */}
        <Link href="/business" aria-label="RENUABL Business" className="flex items-baseline gap-2">
          <Wordmark />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-line sm:tracking-[0.2em]">Business</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-ink-2 md:flex">
          <a href="#journey" className="hover:text-ink">
            How it works
          </a>
          <a href="#sol" className="hover:text-ink">
            Sol
          </a>
          <a href="#marketplace" className="hover:text-ink">
            Marketplace
          </a>
          <a href="#pricing" className="hover:text-ink">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden text-[14px] text-ink-2 hover:text-ink lg:inline">
            For homeowners
          </Link>
          <Link href="/design/sign-in" className="whitespace-nowrap text-[14px] text-ink-2 hover:text-ink">
            Sign in
          </Link>
          <a
            href="#start"
            className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-sun-line px-3.5 text-[13px] font-semibold text-white shadow-sm hover:brightness-105 sm:px-4"
          >
            <span className="sm:hidden">Free trial</span>
            <span className="hidden sm:inline">Start free trial</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/** The email box that starts the trial: Stripe's page next, then back. */
function TrialForm({ seats = 1, interval = "month", dark = false }: { seats?: number; interval?: BillingInterval; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const a = await startTrial({ email, seats, interval });
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
        <label className="sr-only" htmlFor={`trial-email-${dark ? "d" : "l"}-${seats}`}>
          Work email
        </label>
        <input
          id={`trial-email-${dark ? "d" : "l"}-${seats}`}
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
          {busy ? "Opening secure checkout…" : SALES_HERO.cta}
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

function Hero() {
  return (
    <section id="start" className="relative isolate overflow-x-clip" aria-labelledby="hero">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[80vh]"
        style={{ background: "radial-gradient(55% 50% at 30% 30%, rgba(255,90,31,0.12), rgba(255,90,31,0) 70%)" }}
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">{SALES_HERO.eyebrow}</p>
          <h1 id="hero" className="mt-5 text-[clamp(52px,8vw,104px)] font-semibold leading-[0.92] tracking-[-0.045em]">
            {SALES_HERO.headline.split(". ").map((part, i, all) => (
              <span key={part} className={clsx("block", i === all.length - 1 && "text-sun-line")}>
                {part}
                {i < all.length - 1 ? "." : ""}
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-ink-2">{SALES_HERO.sub}</p>
          <div className="mt-8 max-w-xl">
            <TrialForm />
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
          <Screen
            src="/design/landing/today-sol.webp"
            alt="RENUABL's Today screen: Sol writes up the day, with RENUABL Marketplace and Sol in the menu (example data)"
            priority
          />
          <p className="mt-3 text-center text-xs text-muted">Real screens. Made-up example customers.</p>
        </div>
      </div>
    </section>
  );
}

/** RENUABL Marketplace's mark: two roofs joined (as on its button in the app's menu). */
function MarketMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 12 8 7l5.5 5" />
      <path d="M10.5 12 16 7l5.5 5" />
      <path d="M4.5 12v6h15v-6" />
    </svg>
  );
}

/** The two things RENUABL is, side by side under the hero: the platform, and the Marketplace that connects it. */
function Pillars() {
  return (
    <section className="px-5 pb-20 lg:px-8 lg:pb-28" aria-label="What RENUABL is">
      <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-2">
        {PILLARS.map((p, i) => {
          const market = p.id === "marketplace";
          const linkClass = clsx(
            "mt-auto inline-flex items-center gap-1.5 pt-8 text-[15px] font-semibold",
            market ? "text-white hover:text-white/80" : "text-sun-line hover:brightness-110",
          );
          return (
            <Reveal
              key={p.id}
              className={clsx(
                "flex flex-col rounded-3xl p-8 lg:p-10",
                market ? "bg-market text-white" : "bg-surface shadow-[0_30px_80px_-40px_rgba(11,11,12,0.35)] ring-1 ring-line",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    "grid size-12 place-items-center rounded-full",
                    market ? "bg-white text-market" : "bg-sun-line text-white",
                  )}
                  aria-hidden
                >
                  {market ? <MarketMark className="size-6" /> : <Layers className="size-6" />}
                </span>
                <span className={clsx("font-mono text-[13px]", market ? "text-white/60" : "text-muted")}>0{i + 1}</span>
              </div>
              <p className={clsx("mt-8 text-[13px] font-medium uppercase tracking-[0.18em]", market ? "text-market-ink" : "text-ink-2")}>
                {p.eyebrow}
              </p>
              <h2 className="mt-3 text-[clamp(30px,3.6vw,46px)] font-semibold leading-[1.02] tracking-[-0.035em]">{p.title}</h2>
              <p className={clsx("mt-5 text-[17px] leading-relaxed", market ? "text-white/80" : "text-ink-2")}>{p.body}</p>
              <ul className="mt-6 grid gap-2 text-[15px] sm:grid-cols-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <Check className={clsx("mt-1 size-4 shrink-0", market ? "text-market-ink" : "text-sun-line")} aria-hidden />
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
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function OldWay() {
  return (
    <section className="bg-primary px-5 py-24 text-white lg:px-8 lg:py-32" aria-labelledby="old-way">
      <Reveal className="mx-auto w-full max-w-6xl">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-sun-bright">{OLD_WAY.eyebrow}</p>
        <h2 id="old-way" className="mt-5 max-w-4xl text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1] tracking-[-0.035em]">
          {OLD_WAY.headline}
        </h2>
        <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/70">{OLD_WAY.sub}</p>
        <div className="mt-14 overflow-hidden rounded-2xl ring-1 ring-white/15">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-white/5 px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white/60 sm:px-8">
            <span />
            <span className="text-sun-bright">RENUABL</span>
            <span>The old way</span>
          </div>
          {OLD_WAY.rows.map((r) => (
            <div key={r.what} className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3 border-t border-white/10 px-5 py-5 sm:px-8">
              <span className="text-[15px] text-white/80">{r.what}</span>
              <span className="text-[clamp(20px,2.6vw,32px)] font-semibold tabular-nums tracking-tight text-white">{r.us}</span>
              <span className="text-[clamp(16px,2vw,24px)] tabular-nums text-white/50 line-through decoration-white/30">{r.them}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-white/45">{OLD_WAY.source}</p>
      </Reveal>
    </section>
  );
}

function Journey() {
  return (
    <section id="journey" className="px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="journey-title">
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
      <div className="mx-auto mt-20 w-full max-w-7xl space-y-24 lg:space-y-32">
        {JOURNEY.map((j, i) => {
          const label = (
            <p className="text-[13px] font-medium tabular-nums tracking-[0.18em] text-sun-line">
              {String(i + 1).padStart(2, "0")} · {j.step.toUpperCase()}
            </p>
          );
          // The product drawn at work needs the whole width: its words go above it. A screenshot sits beside its words.
          if (j.visual.kind === "demo")
            return (
              <article key={j.key} id={`step-${j.key}`} className="scroll-mt-24">
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
              className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
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
    <section id="sol" className="relative isolate overflow-x-clip px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="sol-title">
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
    <section className="px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="everything">
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
    <section className="px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="soon">
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
    <section id="marketplace" className="scroll-mt-16 bg-market px-5 py-24 text-white lg:px-8 lg:py-32" aria-labelledby="marketplace-title">
      <Reveal className="mx-auto w-full max-w-6xl">
        <p className="inline-flex items-center gap-2.5 text-[13px] font-medium uppercase tracking-[0.18em] text-market-ink">
          <span className="grid size-8 place-items-center rounded-full bg-white text-market" aria-hidden>
            <MarketMark className="size-4" />
          </span>
          {MARKETPLACE.eyebrow}
        </p>
        <h2
          id="marketplace-title"
          className="mt-5 max-w-3xl text-[clamp(32px,4.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.035em]"
        >
          {MARKETPLACE.headline}
        </h2>
        <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-white/80">{MARKETPLACE.sub}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {MARKETPLACE.sides.map((s) => (
            <div key={s.title} className="rounded-2xl bg-white/10 p-7 ring-1 ring-white/15">
              <h3 className="text-[20px] font-semibold">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/80">{s.body}</p>
            </div>
          ))}
        </div>
        <Link href="/design/marketplace" className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold hover:text-white/80">
          {MARKETPLACE.look}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        {state?.ok ? (
          <p className="mt-10 text-[16px] text-market-ink">{state.message}</p>
        ) : (
          <form
            onSubmit={(e) => void go(e)}
            className="mt-10 flex max-w-lg flex-col gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 sm:flex-row"
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
              className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-[16px] text-white outline-none placeholder:text-white/50"
            />
            <button disabled={busy} className="h-12 rounded-xl bg-white px-5 text-[15px] font-semibold text-ink hover:bg-white/90">
              {busy ? "Adding you…" : MARKETPLACE.cta}
            </button>
          </form>
        )}
        {state && !state.ok && <p className="mt-2 text-sm text-market-ink">{state.message}</p>}
      </Reveal>
    </section>
  );
}

function Pricing() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [seats, setSeats] = useState(3);
  const price = priceFor(seats, interval);
  return (
    <section id="pricing" className="scroll-mt-16 px-5 py-24 lg:px-8 lg:py-32" aria-labelledby="pricing-title">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-2">{PRICING.eyebrow}</p>
          <h2 id="pricing-title" className="mt-5 text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1] tracking-[-0.035em]">
            {PRICING.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[18px] text-ink-2">{PRICING.sub}</p>
          <div className="mt-8 inline-flex rounded-full bg-surface-2 p-1 text-[14px] font-medium" role="group" aria-label="Billing">
            {(["month", "year"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                aria-pressed={interval === iv}
                className={clsx("rounded-full px-5 py-2", interval === iv ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
              >
                {iv === "month" ? "Monthly" : "Yearly"}
                {iv === "year" && (
                  <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-[11px] font-semibold text-sun-ink">Save 20%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="rounded-3xl bg-surface p-7 shadow-lift ring-2 ring-sun-line sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[14px] font-medium text-ink-2">RENUABL, everything</p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-[64px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                    {dollars(interval === "month" ? 2900 : Math.round(priceFor(1, "year").chargeCents / 12))}
                  </span>
                  <span className="text-[15px] text-ink-2">a user a month{interval === "year" ? ", billed yearly" : ""}</span>
                </p>
                <p className="mt-1 text-[13px] text-muted">{PLAN_WORDS.gst}</p>
              </div>
              <div className="w-full sm:w-64">
                <label htmlFor="seats" className="flex justify-between text-[14px] font-medium">
                  <span>Users</span>
                  <span className="tabular-nums">{seats}</span>
                </label>
                <input
                  id="seats"
                  type="range"
                  min={1}
                  max={MAX_SELF_SERVE_SEATS}
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="mt-3 w-full accent-[var(--sun-line)]"
                />
                <p className="mt-3 text-[14px] text-ink-2">
                  <strong className="tabular-nums text-ink">{dollars(price.chargeCents)}</strong>{" "}
                  {interval === "month" ? "a month" : `a year, saving ${dollars(price.savedCents)}`}
                </p>
              </div>
            </div>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {PRICING.includes.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-2xl bg-canvas p-5">
              <p className="text-[15px] font-semibold">Design jobs: {PLAN_WORDS.token}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{PRICING.tokens}</p>
              <p className="mt-3 flex flex-wrap gap-2 text-[13px]">
                {TOKEN_PACKS.map((p) => (
                  <span key={p} className="rounded-full bg-surface px-3 py-1 tabular-nums ring-1 ring-line">
                    {p} jobs · {dollars(packPriceCents(p))}
                  </span>
                ))}
              </p>
            </div>
            <div className="mt-8">
              <TrialForm seats={seats} interval={interval} />
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{PRICING.trial}</p>
            </div>
          </div>
          <Enterprise />
        </div>
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
    <section className="px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="faq">
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
    <section className="bg-primary px-5 py-24 text-white lg:px-8 lg:py-32" aria-labelledby="closing">
      <Reveal className="mx-auto w-full max-w-3xl text-center">
        <h2 id="closing" className="text-[clamp(40px,6.5vw,84px)] font-semibold leading-[0.98] tracking-[-0.04em]">
          {CLOSING.headline}
        </h2>
        <p className="mt-6 text-[18px] text-white/70">{CLOSING.sub}</p>
        <div className="mx-auto mt-10 max-w-xl text-left">
          <TrialForm dark />
        </div>
      </Reveal>
    </section>
  );
}
