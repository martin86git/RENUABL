"use client";

import clsx from "clsx";
import { Check, Gavel, MapPin, MessageCircle, Search, Send, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LAUNCH } from "@/lib/domain/design/marketplace-launch";
import { ListingRoofExample } from "./designer-showcase";
import { MarketplaceMark } from "./marketplace-bar";
import { MarketplaceFeed } from "./marketplace-feed";

/**
 * The Marketplace, shown before it opens (3 Nov 2026, Martin: "a better job of providing instant visual understanding
 * of what the marketplace might look like... three views": job listings, relevant to retailers and installers; the
 * equipment marketplace; and a third, finding partners). The app as it will look once you're in, framed by its own
 * menu from the blue home, each view something to press. Made-up businesses, jobs and stock; everything in it is
 * something the Marketplace and Connections do.
 */

type View = (typeof LAUNCH.showroom.views)[number]["id"];
type Role = (typeof LAUNCH.showroom.roles)[number]["id"];

export function MarketplaceShowroom() {
  const copy = LAUNCH.showroom;
  const [view, setView] = useState<View>("jobs");
  const [role, setRole] = useState<Role>("installer");
  return (
    <section>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-market">{copy.eyebrow}</p>
        <h2 className="mt-3 text-[clamp(32px,5vw,60px)] font-light leading-[1.02] tracking-[-0.03em] text-ink">{copy.headline}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{copy.sub}</p>
      </div>

      <div className="mt-10 overflow-hidden rounded-[22px] bg-canvas shadow-[0_30px_80px_-30px_rgba(11,11,12,0.35)] ring-1 ring-line">
        {/* The Marketplace's own menu, as it sits at the top of the pad once you're in. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-market">
            <span className="flex size-8 items-center justify-center rounded-full bg-market text-white shadow-[0_3px_10px_rgba(24,73,169,0.28)]">
              <MarketplaceMark className="size-4" />
            </span>
            Marketplace
          </span>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <div role="tablist" aria-label="Marketplace views" className="flex gap-5 overflow-x-auto">
            {copy.views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={clsx(
                  "shrink-0 border-b-2 pb-1 pt-1 text-[13.5px] transition-colors",
                  view === v.id ? "border-market font-medium text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view === "jobs" && (
            <div role="radiogroup" aria-label="Show it" className="ml-auto flex rounded-full bg-canvas p-0.5 ring-1 ring-line">
              {copy.roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={role === r.id}
                  onClick={() => setRole(r.id)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    role === r.id ? "bg-market text-white" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === "jobs" && role === "installer" && <MarketplaceFeed bare />}
        {view === "jobs" && role === "retailer" && <RetailerListing />}
        {view === "trade" && <BuySell />}
        {view === "partners" && <Partners />}
      </div>
      <p className="mt-3 text-center text-xs text-muted">{copy.note}</p>
    </section>
  );
}

const money = (n: number) => `$${n.toLocaleString("en-AU")}`;

/** Something that happens a little later once the view is on screen, as it would over days. */
function useLater(ms: number, steps: number): [number, React.RefObject<HTMLDivElement | null>] {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const seen = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || timer) return;
      timer = setInterval(() => setN((x) => (x >= steps ? x : x + 1)), ms);
    });
    seen.observe(el);
    return () => {
      seen.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [ms, steps]);
  return [n, ref];
}

const BIDS = [
  {
    by: "Coastline Installs (example)",
    initials: "CI",
    km: 9,
    price: 2350,
    start: "Mon 17 Nov",
    note: "Two-person crew, tile roofs every week.",
  },
  {
    by: "Peak Electrical (example)",
    initials: "PE",
    km: 14,
    price: 2480,
    start: "Wed 12 Nov",
    note: "Can start sooner. Three-phase is fine.",
  },
  {
    by: "Greenline Solar Crew (example)",
    initials: "GS",
    km: 22,
    price: 2690,
    start: "Tue 18 Nov",
    note: "Battery and EV charger on the same day.",
  },
];

const READY = [
  { who: "Oakleigh South", what: "6.6 kW · 10 kWh battery", sold: "Sold 4 days ago" },
  { who: "Mount Waverley", what: "10.4 kW · EV charger", sold: "Sold yesterday" },
];

/** The retailer's side of a job listing: a sold job listed, sealed bids arriving lowest first, one accepted. */
function RetailerListing() {
  const copy = LAUNCH.showroom;
  const [arrived, ref] = useLater(1800, BIDS.length);
  const [chosen, setChosen] = useState<number | null>(null);
  const [listed, setListed] = useState<string[]>([]);
  const shown = BIDS.slice(0, Math.max(arrived, chosen === null ? 0 : BIDS.length))
    .map((b, i) => ({ ...b, i }))
    .sort((a, b) => a.price - b.price);
  return (
    <div ref={ref} className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-line bg-surface p-4 lg:border-r">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{copy.readyTitle}</p>
        <ul className="mt-3 space-y-2">
          {READY.map((r) => {
            const on = listed.includes(r.who);
            return (
              <li key={r.who} className="rounded-xl bg-canvas p-3 ring-1 ring-line">
                <p className="text-[13px] font-medium text-ink">{r.who}</p>
                <p className="text-[12px] text-muted">{r.what}</p>
                <p className="text-[11px] text-muted">{r.sold}</p>
                <button
                  type="button"
                  onClick={() => setListed((l) => (on ? l : [...l, r.who]))}
                  className={clsx(
                    "mt-2 h-8 w-full rounded-lg text-[12.5px] font-medium transition",
                    on ? "bg-surface text-ink-2 ring-1 ring-line" : "bg-market text-white hover:brightness-110",
                  )}
                >
                  {on ? "Listed · taking bids" : "List on the Marketplace"}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="min-w-0 p-4 sm:p-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{copy.retailerTitle}</p>
            <div className="mt-2 overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <ListingRoofExample className="block aspect-[4/3] w-full" />
              <div className="p-3.5">
                <p className="text-[22px] font-semibold tabular-nums tracking-tight text-ink">8.55 kW</p>
                <p className="text-[13px] text-ink-2">18 panels · 16 kWh battery · EV charger</p>
                <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
                  <MapPin className="size-3.5" aria-hidden /> Glen Waverley, VIC · from Mon 10 Nov
                </p>
                <p className="mt-2 text-[12px] text-muted">Closes in 2 days 6 hours · guide $2,600 ex GST</p>
              </div>
            </div>
          </div>

          <div>
            <p className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              <span>Bids · {shown.length}</span>
              <span className="normal-case tracking-normal">Lowest first</span>
            </p>
            <p className="mt-1 text-[12.5px] text-ink-2">{copy.retailerSub}</p>
            <ul className="mt-3 space-y-2" aria-live="polite">
              {shown.length === 0 && (
                <li className="rounded-xl bg-surface p-4 text-center text-[13px] text-muted ring-1 ring-line">
                  <Gavel className="mx-auto mb-1 size-4" aria-hidden /> Waiting for the first bid…
                </li>
              )}
              {shown.map((b) => {
                const won = chosen === b.i;
                const lost = chosen !== null && !won;
                return (
                  <li
                    key={b.by}
                    className={clsx(
                      "rounded-xl p-3 ring-1 transition motion-safe:animate-[fade-up_0.4s_ease-out]",
                      won ? "bg-market/5 ring-market/40" : "bg-surface ring-line",
                      lost && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-semibold text-ink ring-1 ring-line">
                        {b.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{b.by}</p>
                        <p className="text-[12px] text-muted">
                          {b.km} km away · could start {b.start}
                        </p>
                      </div>
                      <span className="text-[17px] font-semibold tabular-nums text-ink">{money(b.price)}</span>
                    </div>
                    <p className="mt-2 text-[12.5px] text-ink-2">{b.note}</p>
                    {chosen === null ? (
                      <button
                        type="button"
                        onClick={() => setChosen(b.i)}
                        className="mt-2 h-8 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-canvas hover:opacity-90"
                      >
                        Accept this bid
                      </button>
                    ) : won ? (
                      <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-medium text-market">
                        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {copy.accepted}
                      </p>
                    ) : (
                      <p className="mt-2 text-[12px] text-muted">Declined</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

type Kit = "panel" | "inverter" | "battery" | "rail" | "ev" | "meter";

const STOCK: { kind: Kit; cat: string; title: string; line: string; price: string; km: number; seller: string }[] = [
  {
    kind: "panel",
    cat: "Panels",
    title: "12 × 475 W panels",
    line: "New, in the box",
    price: "$95 each",
    km: 8,
    seller: "Sunrise Solar (example)",
  },
  {
    kind: "inverter",
    cat: "Inverters",
    title: "5 kW hybrid inverter",
    line: "Used, working · 1 year",
    price: "Make an offer",
    km: 21,
    seller: "Bayside Power (example)",
  },
  {
    kind: "battery",
    cat: "Batteries",
    title: "8 kWh battery module",
    line: "New, opened",
    price: "$2,400",
    km: 34,
    seller: "Harbour Energy (example)",
  },
  {
    kind: "rail",
    cat: "Mounting and racking",
    title: "Rail, 4.8 m × 40",
    line: "New · pick up only",
    price: "$18 each",
    km: 5,
    seller: "Southside Solar (example)",
  },
  {
    kind: "ev",
    cat: "EV chargers",
    title: "7 kW EV charger",
    line: "Ex-display",
    price: "$690",
    km: 17,
    seller: "Volt Electrical (example)",
  },
  {
    kind: "meter",
    cat: "Test equipment",
    title: "Insulation resistance tester",
    line: "Used, working · in date",
    price: "$420",
    km: 12,
    seller: "Peak Electrical (example)",
  },
  {
    kind: "panel",
    cat: "Panels",
    title: "6 × 440 W panels",
    line: "Used, working",
    price: "$60 each",
    km: 41,
    seller: "Greenline Solar Crew (example)",
  },
  {
    kind: "inverter",
    cat: "Inverters",
    title: "8 kW three-phase inverter",
    line: "New, in the box",
    price: "$1,350",
    km: 26,
    seller: "Coastline Installs (example)",
  },
];
const CATS = ["Everything", "Panels", "Inverters", "Batteries", "Mounting and racking", "EV chargers", "Test equipment"];

/** Buy & sell: spare stock near you as photo cards, by kind, with a conversation with the seller. */
function BuySell() {
  const [cat, setCat] = useState("Everything");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = STOCK.map((s, i) => ({ ...s, i })).filter(
    (s) => (cat === "Everything" || s.cat === cat) && words.every((w) => `${s.title} ${s.line} ${s.cat}`.toLowerCase().includes(w)),
  );
  return (
    <div className="grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface p-4 lg:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Kinds</p>
        <div className="mt-2 space-y-1">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={clsx(
                "flex w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                cat === c ? "bg-market/10 font-medium text-market" : "text-ink-2 hover:bg-canvas",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-[12px] text-muted">
          <MapPin className="size-3.5" aria-hidden /> Within 50 km of Clayton
        </p>
        <button type="button" className="mt-4 h-9 w-full rounded-lg bg-market text-[12.5px] font-medium text-white hover:brightness-110">
          Sell equipment
        </button>
      </aside>
      <div className="min-w-0 p-3 sm:p-4">
        <p className="mb-3 text-[12.5px] text-ink-2">{LAUNCH.showroom.tradeSub}</p>
        <label className="mb-3 flex h-10 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-line">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment"
            aria-label="Search the example equipment"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
        </label>
        <div className="mb-3 flex gap-2 overflow-x-auto lg:hidden">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1 text-[12px] ring-1",
                cat === c ? "bg-market text-white ring-market" : "bg-surface text-ink-2 ring-line",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((s) => (
            <li key={s.i}>
              <button
                type="button"
                onClick={() => setOpen((o) => (o === s.i ? null : s.i))}
                aria-expanded={open === s.i}
                className={clsx(
                  "w-full overflow-hidden rounded-2xl bg-surface text-left ring-1 transition hover:-translate-y-0.5",
                  open === s.i ? "ring-market" : "ring-line",
                )}
              >
                <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-surface-2 to-canvas">
                  <KitDrawing kind={s.kind} />
                </div>
                <div className="p-3">
                  <p className="text-[15px] font-semibold text-ink">{s.price}</p>
                  <p className="truncate text-[13px] text-ink">{s.title}</p>
                  <p className="truncate text-[12px] text-muted">
                    {s.line} · {s.km} km
                  </p>
                </div>
              </button>
            </li>
          ))}
          {!items.length && <li className="col-span-full py-12 text-center text-sm text-muted">Nothing like that near you yet.</li>}
        </ul>
        {open !== null && <SellerChat key={open} item={STOCK[open]} />}
      </div>
    </div>
  );
}

function SellerChat({ item }: { item: (typeof STOCK)[number] }) {
  const [said, setSaid] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [draft, setDraft] = useState("Hi, is this still available?");
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setAnswered(true), 1600);
    return () => clearTimeout(t);
  }, [said]);
  return (
    <div className="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-[13px] font-medium text-ink">
        {item.title} · {item.seller}
      </p>
      <div className="mt-3 space-y-2 text-[13px]">
        {said && <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-market px-3 py-2 text-white">{said}</p>}
        {answered && (
          <p className="w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-canvas px-3 py-2 text-ink ring-1 ring-line">
            Yes, still here. Pick up from our shed, or we can drop it to you this week.
          </p>
        )}
      </div>
      {!said && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setSaid(draft.trim());
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Message the seller"
            className="h-10 min-w-0 flex-1 rounded-full bg-canvas px-4 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-market"
          />
          <button
            type="submit"
            aria-label="Send"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-market text-white hover:brightness-110"
          >
            <Send className="size-4" aria-hidden />
          </button>
        </form>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
        <MessageCircle className="size-3.5" aria-hidden /> Messages stay between your two businesses. RENUABL takes no part in the sale.
      </p>
    </div>
  );
}

/** Drawn stock pictures, in the studio's greys: a hint of each kind, never a real product. */
function KitDrawing({ kind }: { kind: Kit }) {
  const common = "h-[58%] w-[58%] text-ink-2";
  if (kind === "panel")
    return (
      <svg viewBox="0 0 60 80" className={common} aria-hidden>
        <rect x="4" y="4" width="52" height="72" rx="2" fill="currentColor" opacity="0.85" />
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={8 + c * 15.5} y={8 + r * 11.3} width="13.5" height="9.5" fill="white" opacity="0.14" />
          )),
        )}
      </svg>
    );
  if (kind === "inverter")
    return (
      <svg viewBox="0 0 60 70" className={common} aria-hidden>
        <rect x="6" y="4" width="48" height="62" rx="5" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.5" />
        <rect x="16" y="14" width="28" height="12" rx="2" fill="currentColor" opacity="0.7" />
        <circle cx="30" cy="44" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M22 58h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  if (kind === "battery")
    return (
      <svg viewBox="0 0 50 80" className={common} aria-hidden>
        <rect x="6" y="4" width="38" height="72" rx="5" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="12" y={14 + i * 14} width="26" height="10" rx="2" fill="currentColor" opacity={0.75 - i * 0.12} />
        ))}
      </svg>
    );
  if (kind === "rail")
    return (
      <svg viewBox="0 0 80 60" className={common} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={4 + i * 2} y={10 + i * 9} width="70" height="5" rx="1.5" fill="currentColor" opacity={0.85 - i * 0.12} />
        ))}
      </svg>
    );
  if (kind === "ev")
    return (
      <svg viewBox="0 0 60 80" className={common} aria-hidden>
        <rect x="12" y="4" width="36" height="48" rx="8" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M32 14 24 30h8l-4 12 10-17h-8l4-11z" fill="currentColor" opacity="0.75" />
        <path d="M30 52c0 10 14 8 14 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 56 80" className={common} aria-hidden>
      <rect x="8" y="4" width="40" height="64" rx="6" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="11" width="26" height="14" rx="2" fill="currentColor" opacity="0.75" />
      <circle cx="28" cy="44" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 44l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 68v8M36 68v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type PartnerKind = "Installer" | "Inspector" | "Retailer";
const PARTNERS: { name: string; initials: string; kind: PartnerKind; suburb: string; km: number; does: string }[] = [
  { name: "Coastline Installs (example)", initials: "CI", kind: "Installer", suburb: "Mentone", km: 9, does: "Tile and tin, batteries" },
  {
    name: "Peak Electrical (example)",
    initials: "PE",
    kind: "Installer",
    suburb: "Dandenong",
    km: 14,
    does: "Three-phase, commercial roofs",
  },
  {
    name: "Clearline Inspections (example)",
    initials: "CL",
    kind: "Inspector",
    suburb: "Box Hill",
    km: 16,
    does: "Solar and battery inspections",
  },
  {
    name: "Greenline Solar Crew (example)",
    initials: "GS",
    kind: "Installer",
    suburb: "Ringwood",
    km: 22,
    does: "Batteries and EV chargers",
  },
  { name: "Bayside Power (example)", initials: "BP", kind: "Retailer", suburb: "Brighton", km: 12, does: "Sells solar and batteries" },
  {
    name: "Southern Safety Checks (example)",
    initials: "SS",
    kind: "Inspector",
    suburb: "Frankston",
    km: 31,
    does: "Inspections across the bayside",
  },
];

/** Find partners: the opt-in directory (Connections), businesses near you by kind, and asking to connect. */
function Partners() {
  const [kind, setKind] = useState<PartnerKind | "Everyone">("Everyone");
  const [asked, setAsked] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  useEffect(() => {
    const waiting = asked.filter((n) => !connected.includes(n));
    if (!waiting.length) return;
    const t = setTimeout(() => setConnected((c) => [...c, waiting[0]]), 2200);
    return () => clearTimeout(t);
  }, [asked, connected]);
  const list = PARTNERS.filter((p) => kind === "Everyone" || p.kind === kind).sort((a, b) => a.km - b.km);
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[12.5px] text-ink-2">{LAUNCH.showroom.partnersSub}</p>
        <div className="flex gap-1.5">
          {(["Everyone", "Installer", "Inspector", "Retailer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={clsx(
                "rounded-full px-3 py-1 text-[12px] ring-1 transition-colors",
                kind === k ? "bg-market text-white ring-market" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              {k === "Everyone" ? k : `${k}s`}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => {
          const isConnected = connected.includes(p.name);
          const isAsked = asked.includes(p.name);
          return (
            <li key={p.name} className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-market/10 text-[13px] font-semibold text-market">
                  {p.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink">{p.name}</p>
                  <p className="text-[12px] text-muted">
                    {p.kind} · {p.suburb}, VIC · {p.km} km
                  </p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[12.5px] text-ink-2">{p.does}</p>
              <button
                type="button"
                disabled={isAsked}
                onClick={() => setAsked((a) => [...a, p.name])}
                className={clsx(
                  "mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition",
                  isConnected
                    ? "bg-market/10 text-market"
                    : isAsked
                      ? "bg-canvas text-ink-2 ring-1 ring-line"
                      : "bg-market text-white hover:brightness-110",
                )}
              >
                {isConnected ? (
                  <>
                    <Check className="size-3.5" aria-hidden /> Connected
                  </>
                ) : isAsked ? (
                  "Asked · waiting"
                ) : (
                  <>
                    <UserPlus className="size-3.5" aria-hidden /> Connect
                  </>
                )}
              </button>
              {isConnected && (
                <p className="mt-2 text-[11.5px] text-muted">
                  {p.kind === "Installer"
                    ? "You can send them jobs on RENUABL."
                    : p.kind === "Inspector"
                      ? "Installers can nominate them to inspect a job."
                      : "They can send you jobs on RENUABL."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
