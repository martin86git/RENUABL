"use client";

import clsx from "clsx";
import { ArrowRight, Battery, Check, Cable, Cpu, LayoutGrid, Lock, MapPin, MessageCircle, Package, Send, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/primitives";
import { LAUNCH, WAITLIST_ROLES, inviteMail, type WaitlistRole } from "@/lib/domain/design/marketplace-launch";
import type { ListingSystem } from "@/lib/domain/design/marketplace";
import { joinWaitlist, loadWaitlist } from "@/lib/services/marketplace-launch";
import { useDesignAccount } from "./design-account";
import { PATHS, ui } from "./design-shell";
import { ListingRoofExample } from "./designer-showcase";
import { Breakdown } from "./marketplace";
import { MarketplaceShowroom } from "./marketplace-showroom";

/** The example listing on the page: the made-up home's design (18 panels on three arrays), its facts as a listing gives them. */
const EXAMPLE: ListingSystem = {
  kw: 8.55,
  panels: 18,
  panel: "475 W panels",
  inverter: "8 kW three-phase hybrid",
  batteryKwh: 16,
  battery: "",
  ev: true,
  storeys: "Single",
  roof: "Tile, and a flat garage",
  phases: "Three",
  arrays: 3,
  strings: 3,
  tiltFrames: true,
  switchboard: "included",
};

/**
 * The Marketplace before it opens (1 Nov 2026, Martin: a coming-soon page that signs businesses up for the launch,
 * explains the Marketplace, and is "another enormous reason... to want to join"): what it is, job listings for both
 * sides (finding an installation partner, winning installation work) with an example listing as it will look, what is
 * and isn't shown, equipment trading, why the network matters, and a place on the list. Signed in or out; copy in
 * domain/design/marketplace-launch.ts.
 */
export function MarketplaceLaunch() {
  const [account] = useDesignAccount();
  const signedIn = Boolean(account?.signedIn && account.business);
  const page = (
    <div className="space-y-24 pb-16 sm:space-y-32">
      {/* The Marketplace itself in the first fold (3 Nov 2026, Martin): a short heading, then the showroom. */}
      <div className="space-y-6 sm:space-y-8">
        <Hero />
        <MarketplaceShowroom compact />
      </div>
      <Jobs />
      <Privacy />
      <Trade />
      <Network signedIn={signedIn} business={account?.signedIn ? (account.business?.name ?? null) : null} />
      <section id="waitlist" className="mx-auto max-w-2xl scroll-mt-24 text-center">
        <h2 className="text-[clamp(30px,4.5vw,52px)] font-light leading-[1.05] tracking-tight text-ink">Be there the day it opens.</h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">{LAUNCH.why}</p>
        <div className="mt-8">
          <Waitlist />
        </div>
      </section>
    </div>
  );
  if (signedIn) return <div className="mx-auto w-full max-w-6xl">{page}</div>;
  // Signed out the page stands on its own: the wordmark, a way in, and the same page.
  return (
    <div className="theme-studio min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href={PATHS.home} aria-label="RENUABL">
          <Wordmark />
        </Link>
        <Link href={PATHS.home} className="tap-area text-sm font-medium text-ink-2 hover:text-ink">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-6">{page}</main>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-sun-line">{children}</p>;
}

/**
 * The heading, kept short so the Marketplace itself is in the first fold (3 Nov 2026, Martin: "the marketplace must
 * be seen immediately"): what it is, one line on it, and a way to the waiting list at the foot of the page.
 */
function Hero() {
  return (
    <section className="text-center">
      <h1 className="mx-auto max-w-4xl text-[clamp(34px,5vw,60px)] font-light leading-[1.02] tracking-[-0.03em] text-ink">
        {LAUNCH.headline}
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{LAUNCH.sub}</p>
      <div className="mt-6">
        <Waitlist quick />
      </div>
    </section>
  );
}

/**
 * The network, drawn: businesses as points across the country's south-east, joined to their neighbours, the odd job
 * or pallet of stock travelling a line in the signal orange. Still with reduced motion.
 */
function NetworkPicture() {
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    // Only once the page is in a browser that hasn't asked for less motion.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoving(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const nodes = NODES;
  const links = LINKS;
  return (
    <div className="relative mx-auto mt-10 max-w-5xl" aria-hidden>
      <svg viewBox="0 0 1000 260" className="w-full">
        <defs>
          <radialGradient id="mk-glow">
            <stop offset="0" stopColor="var(--sun-line)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--sun-line)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="currentColor"
            className="text-line"
            strokeWidth="1"
          />
        ))}
        {moving &&
          PULSES.map(([a, b, dur, delay], i) => (
            <circle key={i} r="3.2" fill="var(--sun-line)">
              <animateMotion
                dur={`${dur}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
                path={`M${nodes[a].x},${nodes[a].y} L${nodes[b].x},${nodes[b].y}`}
              />
            </circle>
          ))}
        {nodes.map((n, i) => (
          <g key={i}>
            {n.hub && <circle cx={n.x} cy={n.y} r="22" fill="url(#mk-glow)" />}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.hub ? 5 : 3.5}
              fill={n.hub ? "var(--sun-line)" : "var(--surface)"}
              stroke={n.hub ? "none" : "currentColor"}
              className="text-ink-2"
              strokeWidth="1.2"
            />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}

// A fixed scatter (no randomness between server and browser), each point joined to its nearest neighbours.
const NODES = Array.from({ length: 34 }, (_, i) => {
  const x = 30 + ((i * 293) % 940);
  const y = 30 + ((i * 137 + (i % 3) * 41) % 200);
  return { x, y, hub: i % 7 === 3 };
});
const LINKS: [number, number][] = (() => {
  const out: [number, number][] = [];
  NODES.forEach((a, i) => {
    NODES.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        if (!out.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) out.push([i, j]);
      });
  });
  return out;
})();
const PULSES: [number, number, number, number][] = LINKS.filter((_, i) => i % 5 === 0).map(([a, b], i) => [
  a,
  b,
  2.4 + (i % 4) * 0.7,
  i * 0.6,
]);

/** A place on the list: what they'd use it for (all three if nothing is picked), and their email when signed out. */
/**
 * The waiting list. `quick` is the heading's: an email and Sign up, nothing to choose (none chosen is all three), so
 * signing up is one step; the foot of the page asks what they want from it.
 */
function Waitlist({ quick = false }: { quick?: boolean }) {
  const [state, setState] = useState<{ joined: boolean; signedIn: boolean; count: string | null } | null>(null);
  const [roles, setRoles] = useState<WaitlistRole[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadWaitlist().then((res) => setState(res.ok ? res : { joined: false, signedIn: false, count: null }));
    const joined = () => setState((s) => s && { ...s, joined: true });
    window.addEventListener("renuabl:market-joined", joined);
    return () => window.removeEventListener("renuabl:market-joined", joined);
  }, []);
  const toggle = (id: WaitlistRole) => setRoles((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const save = async () => {
    setBusy(true);
    const res = await joinWaitlist({ roles, ...(state?.signedIn ? {} : { email }) });
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    // Both boxes on the page show it.
    window.dispatchEvent(new Event("renuabl:market-joined"));
  };
  if (!state) return <div className={quick ? "h-14" : "h-32"} aria-busy="true" />;
  if (state.joined)
    return (
      <div className="mx-auto inline-flex max-w-xl items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-left ring-1 ring-line">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun-line text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="text-[15px] text-ink">{LAUNCH.saved}</p>
      </div>
    );
  return (
    <div className="mx-auto max-w-xl">
      {!quick && (
        <>
          <p className="text-[13px] font-medium text-ink-2">I want to</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {WAITLIST_ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={roles.includes(r.id)}
                onClick={() => toggle(r.id)}
                className={clsx(
                  "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm transition",
                  roles.includes(r.id) ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-line hover:ring-ink-2",
                )}
              >
                {roles.includes(r.id) && <Check className="size-3.5" aria-hidden />}
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
      <form
        className={clsx("flex flex-col gap-2 sm:flex-row sm:justify-center", !quick && "mt-4")}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!state.signedIn && (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your work email"
            aria-label="Your work email"
            className={clsx(ui.input, "rounded-full px-5 sm:w-72", quick ? "h-14 text-[16px]" : "h-12")}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className={clsx(
            "inline-flex items-center justify-center gap-2 rounded-full bg-sun-line font-medium text-white shadow-[0_8px_24px_-8px_var(--sun-line)] transition hover:brightness-105 disabled:bg-surface-2 disabled:text-muted disabled:shadow-none",
            quick ? "h-14 px-9 text-[17px] font-semibold" : "h-12 px-7 text-[15px]",
          )}
        >
          {quick ? LAUNCH.signUp : LAUNCH.save} <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
      {problem && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {problem}
        </p>
      )}
      {quick && <p className="mt-2.5 text-[13px] text-muted">{LAUNCH.signUpNote}</p>}
      {state.count && <p className="mt-3 text-[13px] text-muted">{state.count}</p>}
    </div>
  );
}

function Jobs() {
  return (
    <section>
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>{LAUNCH.jobsEyebrow}</Eyebrow>
        <h2 className="mt-3 text-[clamp(32px,5vw,60px)] font-light leading-[1.02] tracking-[-0.03em] text-ink">{LAUNCH.jobsHeadline}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{LAUNCH.jobsSub}</p>
      </div>

      {/* The two sides, with the listing between them: the thing both are looking at. */}
      <div className="mt-14 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1fr_minmax(0,1.35fr)_1fr]">
        <Side side={LAUNCH.poster} icon={Send} />
        <div className="order-first mx-auto w-full max-w-xl md:col-span-2 xl:order-none xl:col-span-1 xl:max-w-none">
          <ExampleListing />
        </div>
        <Side side={LAUNCH.installer} icon={LayoutGrid} />
      </div>
    </section>
  );
}

function Side({ side, icon: Icon }: { side: { who: string; title: string; steps: readonly string[] }; icon: typeof Send }) {
  return (
    <div className={clsx(ui.card, "p-6")}>
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{side.who}</p>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">{side.title}</h3>
      <ol className="mt-5 space-y-4">
        {side.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-sun-line text-[12px] font-medium tabular-nums text-sun-line">
              {i + 1}
            </span>
            <span className="text-[14.5px] leading-relaxed text-ink-2">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A listing as installers will see it, on the made-up home: the roof design with its surroundings blurred, then the facts. */
function ExampleListing() {
  return (
    <div className={clsx(ui.card, "overflow-hidden")}>
      <div className="relative bg-ink">
        <ListingRoofExample className="block aspect-[4/3] w-full" />
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink">Example</span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-white">
          Closes in 5 days
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-ink-2">
          Everything round the roof blurred
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <MapPin className="size-4 text-muted" aria-hidden /> Glen Waverley, VIC
          </p>
          <span className="text-xs tabular-nums text-muted">12 km from you</span>
        </div>
        <p className="mt-1 text-[44px] font-light leading-none tabular-nums text-ink">
          8.55<span className="ml-1 text-lg text-ink-2">kW</span>
        </p>
        <p className="mt-2 text-sm text-ink-2">
          <span className="font-semibold text-ink">Open to offers</span> · 3 bids · From 18 Nov
        </p>
        <Breakdown listing={{ system: EXAMPLE }} narrow />
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-surface-2 p-3">
          <span className="text-sm text-ink-2">Your price, ex GST</span>
          <span className="ml-auto rounded-md bg-surface px-3 py-1.5 text-sm tabular-nums text-muted ring-1 ring-line">$ —</span>
          <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-ink">Place my bid</span>
        </div>
      </div>
    </div>
  );
}

function Privacy() {
  return (
    <section className="rounded-[28px] bg-primary px-6 py-14 text-primary-ink sm:px-12 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-sun-line">{LAUNCH.privacyEyebrow}</p>
        <h2 className="mt-3 text-[clamp(28px,4.5vw,52px)] font-light leading-[1.05] tracking-[-0.03em]">{LAUNCH.privacyHeadline}</h2>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-10 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-white/60">Every business sees</p>
          <ul className="mt-4 space-y-3">
            {LAUNCH.shown.map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-snug">
                <Check className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-medium text-white/60">No one sees</p>
          <ul className="mt-4 space-y-3">
            {LAUNCH.hidden.map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-snug text-white/80">
                <Lock className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Made-up stock, drawn as the cards will show it. */
const STOCK = [
  { icon: Sun, title: "12 × 475 W panels", line: "Unused, in the box", price: "$95 each", km: "8 km" },
  { icon: Cpu, title: "5 kW hybrid inverter", line: "Swapped out, 1 year old", price: "Make an offer", km: "21 km" },
  { icon: Battery, title: "8 kWh battery module", line: "New, spare from a job", price: "$2,400", km: "34 km" },
  { icon: Cable, title: "Rail, 4.8 m × 40", line: "Pick up only", price: "$18 each", km: "5 km" },
];

function Trade() {
  return (
    <section className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <Eyebrow>{LAUNCH.tradeEyebrow}</Eyebrow>
        <h2 className="mt-3 text-[clamp(30px,4.5vw,52px)] font-light leading-[1.04] tracking-[-0.03em] text-ink">{LAUNCH.tradeHeadline}</h2>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink-2">{LAUNCH.tradeSub}</p>
        <ul className="mt-6 grid max-w-lg gap-2.5 sm:grid-cols-2">
          {LAUNCH.tradePoints.map((p) => (
            <li key={p} className="flex items-center gap-2 text-[14.5px] text-ink">
              <Check className="size-4 shrink-0 text-sun-line" aria-hidden /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative">
        <span className="absolute -top-3 right-3 z-10 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-line">
          Example
        </span>
        <ul className="grid grid-cols-2 gap-4">
          {STOCK.map((s, i) => (
            <li key={s.title} className={clsx(i % 2 === 1 && "sm:translate-y-6")}>
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-surface-2 to-surface ring-1 ring-line">
                <s.icon className="size-10 text-ink-2" strokeWidth={1.2} aria-hidden />
              </div>
              <p className="mt-2 text-[15px] font-semibold text-ink">{s.price}</p>
              <p className="truncate text-sm text-ink">{s.title}</p>
              <p className="truncate text-xs text-muted">
                {s.line} · {s.km}
              </p>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-10 flex w-[min(22rem,100%)] items-center gap-2 rounded-2xl bg-surface p-3 shadow-lift ring-1 ring-line">
          <MessageCircle className="size-4 shrink-0 text-sun-line" aria-hidden />
          <p className="truncate text-[13px] text-ink">Are the panels still available? We can pick up Friday.</p>
        </div>
      </div>
    </section>
  );
}

function Network({ signedIn, business }: { signedIn: boolean; business: string | null }) {
  const [mail, setMail] = useState<string | null>(null);
  useEffect(() => {
    // The site's own address, once in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMail(inviteMail(window.location.origin, business));
  }, [business]);
  return (
    <section>
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>{LAUNCH.networkEyebrow}</Eyebrow>
        <h2 className="mt-3 text-[clamp(30px,4.5vw,52px)] font-light leading-[1.04] tracking-[-0.03em] text-ink">
          {LAUNCH.networkHeadline}
        </h2>
      </div>
      <NetworkPicture />
      <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-3">
        {LAUNCH.networkPoints.map((p, i) => {
          const Icon = [LayoutGrid, Send, Package][i];
          return (
            <div key={p.title} className="bg-surface p-7">
              <Icon className="size-5 text-sun-line" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{p.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          );
        })}
      </div>
      {signedIn && mail && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
          <p className="text-[15px] text-ink-2">{LAUNCH.invite}</p>
          <a href={mail} className={ui.quiet}>
            {LAUNCH.inviteButton} <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      )}
      {!signedIn && (
        <p className="mt-8 text-center text-[15px] text-ink-2">
          Not on RENUABL yet?{" "}
          <Link href={PATHS.home} className={ui.link}>
            Start your free trial
          </Link>
        </p>
      )}
    </section>
  );
}
