"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, Menu, X } from "lucide-react";
import { BrandEyebrow, Sunrise } from "./business-brand";
import { LivingHero } from "./living-hero";
import { LiveSun } from "./live-sun";
import { SalesLoop } from "./sales-loop";
import { DesignerSlide } from "./designer-slide";
import { InterfaceSlide } from "./interface-slide";
import { DemoRequestButton } from "./demo-request";
import { LaunchSlide } from "./launch-slide";
import { KnowledgeOrbit } from "./business-slides";
import { RaysSlide } from "./rays-slide";
import { VoiceSlide } from "./voice-slide";
import { Wordmark } from "@/components/ui/primitives";
import { ENTERPRISE_FROM, TOKEN_PACKS, packWords, type BillingInterval } from "@/lib/domain/design/plans";
import { CLOSING, FAQ, LOGO_LINE, PRICING, SALES_HERO, STICKY } from "@/lib/domain/design/sales-page";
import { askSales, startPlan } from "@/lib/services/billing";
import { PlanCodeField, type AppliedCode } from "./plan-code-field";
import { Reveal } from "./front-hero";

/**
 * The sign-up page for solar businesses (`/design` signed out; copy in `domain/design/sales-page.ts`, prices in
 * `plans.ts`). It sells: one deal from enquiry to service shown on real screens (made-up
 * example data) and the product drawn at work, Sol, everything else in the box, what's coming, and the pricing. Starting
 * the plan is an email here, then Stripe's own secure page for the card, then straight back.
 */
export function SalesPage({ notice, signedIn = false }: { notice?: string | null; signedIn?: boolean }) {
  return (
    <div className="sales-snap theme-studio min-h-dvh bg-canvas text-ink">
      <Header signedIn={signedIn} />
      {notice && <p className="mx-auto max-w-3xl px-5 pt-4 text-center text-sm text-danger">{notice}</p>}
      {/* Six slides at most (17 Nov 2026, Martin: "there is just too much and the power of the features is being lost"):
          your sales team, how it sells, the film, the old way and the new, pricing with the questions, the close. */}
      <LivingHero />
      <LaunchSlide signedIn={signedIn} />
      <VoiceSlide signedIn={signedIn} />
      <RaysSlide />
      <SalesLoop />
      <DesignerSlide />
      <InterfaceSlide />
      <KnowledgeOrbit />
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

/** The page's sections, behind the top bar's menu (17 Nov 2026, Martin: the titles across the bar go into a menu). */
const PAGE_LINKS = [
  { href: "#start", label: "Meet Sol" },
  { href: "#launch", label: "The launch" },
  { href: "#voice", label: "Voice agents" },
  { href: "#sales", label: "How it sells" },
  { href: "#designer", label: "The assisted designer" },
  { href: "#interface", label: "The interface" },
  { href: "#brain", label: "Ask anything" },
  { href: "#pricing", label: "Pricing" },
] as const;

/**
 * The top bar (17 Nov 2026, Martin): the menu on the left, RENUABL alone in the middle (the wordmark, no "Business"
 * beside it), Sign in, Book a demo and Get started on the right (no self-serve demo since 27 Nov 2026, Martin).
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
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md sm:pb-2">
      {/* RENUABL Business: the network's side for retailers and installers (the front page since 19 Nov 2026; the homeowner homepage is kept at /homeowners). */}
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 sm:px-5 lg:px-8">
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
        <Link href="/" aria-label="RENUABL Business" className="justify-self-start sm:justify-self-center">
          {/* The line under the logo (27 Nov 2026, Martin: smaller than the logo, spaced under it, centred). From sm up:
              on a phone the wordmark sits beside the menu and the buttons, with no room for it. The wordmark stays
              level with the menu icon; the line hangs below it, and the bar is a little deeper from sm to hold it. */}
          <span className="relative flex flex-col items-center">
            <Wordmark className="leading-none" />
            <span className="absolute left-1/2 top-full mt-3.5 hidden -translate-x-1/2 whitespace-nowrap text-[9.5px] font-medium uppercase leading-none tracking-[0.2em] text-muted sm:block">
              {LOGO_LINE}
            </span>
          </span>
        </Link>
        {/* Top right (21 Nov 2026, Martin: "We need a get started button next to Sign In"): Sign in, or straight back
            into RENUABL when signed in, and Get started (to the pricing, as every Get started on the page) when signed out. On a phone (21 Nov 2026, Martin: "show it on phones too, make them smaller") both are smaller and the wordmark sits beside the menu, so they fit. */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
          <Link
            href={signedIn ? "/design" : "/design/sign-in"}
            className="inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[12px] sm:h-9 sm:px-4 sm:text-[13px] font-semibold text-ink ring-1 ring-line-strong hover:bg-surface"
          >
            {signedIn ? "Open RENUABL" : "Sign in"}
          </Link>
          {/* Book a demo (27 Nov 2026, Martin: "you either have to sign up, or book a demo in"). From sm up: a phone's
              bar has no room for a third button, and the hero's Book a demo is in its first screen. */}
          {!signedIn && (
            <span className="hidden sm:inline-flex">
              <DemoRequestButton look="bar" />
            </span>
          )}
          {!signedIn && (
            <a
              href="#pricing"
              className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-sun-line px-3 text-[12px] sm:h-9 sm:px-4 sm:text-[13px] font-semibold text-white hover:brightness-105"
            >
              {SALES_HERO.cta}
            </a>
          )}
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
  const [code, setCode] = useState<AppliedCode | null>(null);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const a = await startPlan({ email, seats, interval, ...(code ? { code: code.code } : {}) });
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
      <div className="mt-2 px-1">
        <PlanCodeField applied={code} onApply={setCode} dark={dark} />
      </div>
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
 * The three things RENUABL is known by, a band each under the hero (3 Nov 2026, Martin: the designer, Sol and the
 * Marketplace are huge features and must feel it): the design tool with AI over it, Sol, and the Marketplace.
 */

/**
 * A sign-up that follows the reader down the page (3 Nov 2026, Martin: there are a lot of slides, so every one is a
 * chance to sign up): once the hero's box has scrolled away, a bar at the foot of the screen with the email box and
 * Get started; it goes again over the closing box (and on a phone over the assisted designer), and can be put away for
 * the visit.
 */
function StickySignUp() {
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  const [read, setRead] = useState(0);
  useEffect(() => {
    const hero = document.getElementById("start");
    const pricing = document.getElementById("pricing");
    const closing = document.getElementById("closing");
    // On a phone it also goes over the assisted designer, whose picture it would cover (19 Nov 2026, Martin).
    const designer = window.matchMedia("(max-width: 639px)").matches ? document.getElementById("designer") : null;
    if (!hero || !("IntersectionObserver" in window)) return;
    const on = new Map<Element, boolean>([[hero, true]]);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) on.set(e.target, e.isIntersecting);
      setShow(![...on.values()].some(Boolean));
    });
    for (const el of [hero, pricing, closing, designer]) if (el) io.observe(el);
    // How far down the page they are, drawn as a fine line along the bar's foot.
    let frame = 0;
    const scrolled = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setRead(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    scrolled();
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scrolled);
    };
  }, []);
  if (closed) return null;
  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 transition-all duration-500 ease-out sm:pb-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0",
      )}
      aria-hidden={!show}
    >
      {/* A glass dock (18 Nov 2026, Martin: the flat grey bar was "lack luster"): dark glass over the page, Sol's live
          sun at its start, the line and the first month's offer, a round Sign up, and how far down the page you are as
          a fine orange line along its foot. */}
      <div className="relative flex w-full max-w-[36rem] items-center gap-3 rounded-full bg-[#0b0b0c]/80 py-2 pl-3.5 pr-2 text-white shadow-[0_24px_60px_-18px_rgba(11,11,12,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150">
        <span className="relative grid size-9 shrink-0 place-items-center" aria-hidden>
          <span className="absolute -inset-1/2">
            <LiveSun live={show} />
          </span>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{STICKY.line}</span>
          <span className="block truncate text-[12.5px] text-white/55">{STICKY.offer}</span>
        </span>
        <a
          href="#pricing"
          tabIndex={show ? 0 : -1}
          className="group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-sun-line pl-5 pr-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110"
        >
          {SALES_HERO.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => setClosed(true)}
          tabIndex={show ? 0 : -1}
          className="hidden size-8 shrink-0 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white sm:grid"
          aria-label={STICKY.close}
        >
          <X className="size-4" aria-hidden />
        </button>
        <span aria-hidden className="absolute inset-x-6 bottom-0 h-px bg-white/[0.06]">
          <span className="block h-full origin-left bg-sun-line" style={{ transform: `scaleX(${read})` }} />
        </span>
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
    <section id="pricing" className="snap-start scroll-mt-16 px-5 py-20 lg:px-8 lg:py-12" aria-labelledby="pricing-title">
      <Reveal className="mx-auto w-full max-w-7xl">
        <div className="text-center">
          <BrandEyebrow>{PRICING.eyebrow}</BrandEyebrow>
          <h2 id="pricing-title" className="mt-4 text-[clamp(32px,3.6vw,48px)] font-semibold leading-[1] tracking-[-0.035em]">
            {PRICING.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[16px] text-ink-2">{PRICING.sub}</p>
        </div>

        {/*
          Three even cards, as xAI prices Grok Bot (16 Nov 2026, Martin: "i love the way they make the $30 pricing look so
          cheap"): the price large, one button, then what it includes, each plan building on the one before.
        */}
        {/* Smaller, so the heading and the three cards are seen in one screen (18 Nov 2026, Martin), and in colour: the
            12-month plan dark with the sun's glow and what it saves, the ticks and its button in the signal orange. */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PRICING.plans.map((p) => (
            <PlanCard
              key={p.key}
              name={p.name}
              price={p.price}
              per={PRICING.perShort}
              note={p.note}
              listHead={p.listHead}
              list={"list" in p ? p.list : PRICING.includes}
              featured={p.featured}
              badge={"badge" in p ? p.badge : undefined}
            >
              {open === p.key ? (
                <TrialForm id={p.key} label="Continue" />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(p.key)}
                  className={clsx(
                    "h-11 w-full rounded-full text-[15px] font-semibold text-white hover:brightness-110",
                    p.featured ? "bg-sun-line shadow-[0_10px_30px_-10px_rgba(255,90,31,0.7)]" : "bg-primary",
                  )}
                >
                  {SALES_HERO.cta}
                </button>
              )}
            </PlanCard>
          ))}
          <Enterprise />
        </div>

        <p className="mt-4 text-center text-[13px] text-ink-2">{PRICING.firstMonth}</p>

        {/* Then the team, each priced on its own (21 Nov 2026, Martin): the two AI cards large across the top, the voice
            team dark with the sun's glow, then the designer, marketing and checkout. */}
        <div className="mt-20 text-center">
          <p className="text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.05] tracking-[-0.03em]">{PRICING.addOnsTitle}</p>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] text-ink-2">{PRICING.addOnsSub}</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-6">
          {PRICING.team.map((t, i) => (
            <TeamCard key={t.key} card={t} wide={i < 2} dark={t.key === "voice"} />
          ))}
        </div>
        <p className="mt-5 flex flex-wrap justify-center gap-2 text-[12px] text-ink-2">
          <span className="py-1">Designer credit packs:</span>
          {TOKEN_PACKS.map((p) => (
            <span key={p} className="rounded-full bg-surface px-3 py-1 tabular-nums ring-1 ring-line">
              {packWords(p)}
            </span>
          ))}
        </p>
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
          className="h-11 w-full rounded-full bg-surface text-[15px] font-semibold text-ink ring-1 ring-line-strong hover:bg-canvas"
        >
          {PRICING.enterprise.cta}
        </button>
      )}
    </PlanCard>
  );
}

/** One plan, as xAI sets theirs out: its name, the price large with what it's per, a line, the button, what it includes.
 * The featured plan is dark with the sun's glow behind its price and what it saves in a pill. */
function PlanCard({
  name,
  price,
  per,
  note,
  listHead,
  list,
  featured = false,
  badge,
  children,
}: {
  name: string;
  price: string;
  per?: string;
  note: string;
  listHead: string;
  list: readonly string[];
  featured?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const quiet = featured ? "text-white/65" : "text-ink-2";
  return (
    <div
      className={clsx(
        "relative isolate flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7",
        featured ? "bg-[#0b0b0c] text-white shadow-[0_30px_70px_-30px_rgba(255,90,31,0.45)]" : "bg-surface ring-1 ring-line",
      )}
    >
      {featured && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,110,40,0.55)_0%,rgba(255,90,31,0.18)_40%,transparent_70%)]"
        />
      )}
      <div className="flex h-7 items-center justify-between gap-3">
        <p className={clsx("text-[14px] font-medium", quiet)}>{name}</p>
        {badge && (
          <span className="rounded-full bg-sun-line/15 px-2.5 py-1 text-[12px] font-semibold text-sun-line ring-1 ring-sun-line/40">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span
          className={clsx(
            "text-[clamp(36px,3.2vw,48px)] font-semibold leading-none tracking-[-0.04em]",
            price.startsWith("$") && "tabular-nums",
          )}
        >
          {price}
        </span>
        {per && <span className={clsx("text-[14px]", quiet)}>{per}</span>}
      </p>
      <p className={clsx("mt-2 min-h-[2.9em] text-[14px] leading-[1.45]", quiet)}>{note}</p>
      <div className="mt-4">{children}</div>
      <p className="mt-6 text-[14px] font-semibold">{listHead}</p>
      <ul className="mt-3 space-y-2">
        {list.map((l) => (
          <li key={l} className={clsx("flex gap-2.5 text-[14px] leading-snug", quiet)}>
            <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One member of the team you can add: what it is, its price and how it's charged, what it does. */
function TeamCard({ card, wide, dark }: { card: (typeof PRICING.team)[number]; wide: boolean; dark: boolean }) {
  const quiet = dark ? "text-white/65" : "text-ink-2";
  return (
    <div
      className={clsx(
        "relative isolate flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7",
        wide ? "lg:col-span-3" : "lg:col-span-2",
        dark ? "bg-[#0b0b0c] text-white shadow-[0_30px_70px_-30px_rgba(255,90,31,0.45)]" : "bg-surface ring-1 ring-line",
      )}
    >
      {dark && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,110,40,0.5)_0%,rgba(255,90,31,0.16)_40%,transparent_70%)]"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={clsx("text-[13px] font-medium uppercase tracking-[0.08em]", quiet)}>{card.label}</p>
        <span className="rounded-full bg-sun-line/12 px-2.5 py-1 text-[12px] font-semibold text-sun-line ring-1 ring-sun-line/35">
          {card.how}
        </span>
      </div>
      <h3 className={clsx("mt-3 font-semibold leading-[1.05] tracking-[-0.03em]", wide ? "text-[clamp(26px,2.4vw,32px)]" : "text-[22px]")}>
        {card.title}
      </h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-[clamp(30px,2.6vw,40px)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{card.price}</span>
        <span className={clsx("text-[14px]", quiet)}>{card.per}</span>
      </p>
      <p className={clsx("mt-3 text-[14px] leading-[1.5]", quiet)}>{card.body}</p>
      <ul className={clsx("mt-5 grid gap-2", wide && "sm:grid-cols-2")}>
        {card.list.map((l) => (
          <li key={l} className={clsx("flex gap-2.5 text-[14px] leading-snug", quiet)}>
            <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq() {
  return (
    <section className="snap-start scroll-mt-20 px-5 pb-24 lg:px-8 lg:pb-32" aria-labelledby="faq">
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
      className="relative isolate snap-start overflow-hidden bg-[#0b0b0d] px-5 pb-40 pt-28 text-white lg:px-8 lg:pb-56 lg:pt-36"
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
