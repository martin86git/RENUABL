"use client";

/**
 * Usage on Today (23 Nov 2026, Martin: "add a usage shortcut in today / business… an icon that represents usage. Easy
 * for the admin to access and ideally appears as a pop up box. Makes it easy for the user admin to top up as
 * required"). A small gauge beside the day's weather, ringed by the most-used allowance, for the owner and anyone who
 * may change settings (the route answers no one else, so no one else sees it). It opens a box over the page with this
 * month's allowances and the packs to top up, bought by the owner. Stripe's card form opens inside the box (23 Nov 2026,
 * Martin: "i dont want stripe to open in a new browser, i want it to open wihtin the pop up"); once paid, Stripe comes
 * back to the same page with ?usage=bought and the box opens again saying so.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CreditCard, Gauge, PencilRuler, Phone, Sparkles, X } from "lucide-react";
import { METER_WORDS, percentWords } from "@/lib/domain/design/usage";
import { SOL_PACKS, solPackBonus } from "@/lib/domain/design/sol-credits";
import { TOKEN_PACKS, dollars, packBonus, packDollars, packPriceCents, type TokenPack } from "@/lib/domain/design/plans";
import { packCardForm } from "@/lib/services/billing";
import { mountDepositForm } from "@/lib/services/stripe-form";
import { loadUsagePop, type UsagePop } from "@/lib/services/usage";
import { settingsPath } from "./settings-list";

const tone = (p: number) => (p >= 100 ? "var(--danger)" : p >= 80 ? "var(--sun-line)" : "var(--ink)");
const barTone = (p: number) => (p >= 100 ? "bg-danger" : p >= 80 ? "bg-sun-line" : "bg-primary");

/** Opens the box from a menu (the cog's Usage this month, the phone's More sheet's Usage). */
export const USAGE_OPEN = "renuabl:usage-open";
let ready = false;
/** Whether the box can open here (this person may see usage); a menu otherwise goes to the Usage page. */
export const usagePopReady = () => ready;
export const openUsagePop = () => window.dispatchEvent(new Event(USAGE_OPEN));

/**
 * The box, mounted once in the shell. Its round left Today on 23 Nov 2026 (Martin: "Usage icon should be moved out
 * as it's now in the menu"): `bare` draws no round and the menus open the box, so top-ups still happen in it and
 * Stripe's return still reopens it.
 */
export function UsageButton({ bare }: { bare?: boolean } = {}) {
  const [state, setState] = useState<UsagePop | null>(null);
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    let on = true;
    // Back from Stripe's card form: the box opens again saying so, and the mark comes off the address.
    const url = new URL(window.location.href);
    const back = url.searchParams.get("usage") === "bought";
    if (back) {
      url.searchParams.delete("usage");
      url.searchParams.delete("bought");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    void loadUsagePop().then((s) => {
      if (!on) return;
      setState(s);
      ready = !!s;
      if (back && s) {
        setPaid(true);
        setOpen(true);
      }
    });
    const show = () => setOpen(true);
    window.addEventListener(USAGE_OPEN, show);
    return () => {
      on = false;
      ready = false;
      window.removeEventListener(USAGE_OPEN, show);
    };
  }, []);
  // Read again each time it opens, so a pack bought in another tab shows.
  useEffect(() => {
    if (!open) return;
    void loadUsagePop().then((s) => s && setState(s));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!state) return null;
  const top = Math.max(0, ...state.meters.map((m) => m.percent));
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <>
      {!bare && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Usage this month${state.meters.length ? `, up to ${top}% used` : ""}`}
          title="Usage and top-ups"
          className="relative grid size-8 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-line transition hover:ring-ink/30"
        >
          <Gauge className="size-4" aria-hidden />
          {state.meters.length > 0 && (
            <svg viewBox="0 0 32 32" className="pointer-events-none absolute inset-0 size-8 -rotate-90" aria-hidden>
              <circle
                cx="16"
                cy="16"
                r={r}
                fill="none"
                stroke={tone(top)}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${((c * Math.min(100, top)) / 100).toFixed(2)} ${c.toFixed(2)}`}
              />
            </svg>
          )}
          {top >= 80 && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-sun-line ring-2 ring-canvas" aria-hidden />}
        </button>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <UsageBox
            s={state}
            paid={paid}
            onClose={() => {
              setOpen(false);
              setPaid(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}

type Paying = { key: string; title: string; price: string; pack: { sol: number } | { tokens: TokenPack } };

function UsageBox({ s, paid, onClose }: { s: UsagePop; paid: boolean; onClose: () => void }) {
  const [paying, setPaying] = useState<Paying | null>(null);
  const mayBuy = s.owner && s.payments;
  const sol = s.meters.find((m) => m.key === "sol");
  const voice = s.meters.filter((m) => m.key !== "sol");
  return (
    <div className="theme-studio contents">
      <div className="fixed inset-0 z-[95] bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-pop-title"
        className="fixed left-1/2 top-1/2 z-[96] max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-5 text-left shadow-2xl ring-1 ring-line sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {paying && (
              <button
                type="button"
                onClick={() => setPaying(null)}
                aria-label="Back to usage"
                className="-ml-1 mt-0.5 grid size-8 place-items-center rounded-full hover:bg-canvas"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
            )}
            <div>
              <h2 id="usage-pop-title" className="text-lg font-semibold text-ink">
                {paying ? `Buy ${paying.title}` : "Usage this month"}
              </h2>
              <p className="text-xs text-muted">
                {paying ? `${paying.price}, GST included` : `Ends ${s.ends} · ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full hover:bg-canvas"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {paying ? (
          <CardForm key={paying.key} paying={paying} onBack={() => setPaying(null)} />
        ) : (
          <>
            {paid && (
              <p className="mt-4 rounded-xl bg-positive/10 px-3 py-2.5 text-sm text-ink" role="status">
                Payment received. Your credits show here as soon as Stripe confirms it, usually within a few seconds.
              </p>
            )}
            <div className="mt-5 space-y-3">
              {sol && (
                <Part
                  icon={<Sparkles className="size-4" aria-hidden />}
                  title="Sol credits"
                  figure={percentWords(sol)}
                  sub={`${sol.used.toLocaleString("en-AU")} of ${sol.included.toLocaleString("en-AU")} this month${s.solBought ? ` · ${s.solBought.toLocaleString("en-AU")} bought, never expire` : ""}`}
                  percent={sol.percent}
                >
                  {s.solPacks && (
                    <Packs three>
                      {SOL_PACKS.map((p) => (
                        <PackButton
                          key={p.credits}
                          disabled={!mayBuy}
                          top={`${p.credits.toLocaleString("en-AU")} credits`}
                          extra={solPackBonus(p) > 0 ? `+${solPackBonus(p).toLocaleString("en-AU")} bonus` : undefined}
                          price={dollars(p.cents)}
                          onClick={() =>
                            setPaying({
                              key: `sol-${p.credits}`,
                              title: `${p.credits.toLocaleString("en-AU")} Sol credits`,
                              price: dollars(p.cents),
                              pack: { sol: p.credits },
                            })
                          }
                        />
                      ))}
                    </Packs>
                  )}
                </Part>
              )}

              <Part
                icon={<PencilRuler className="size-4" aria-hidden />}
                title="Design credits"
                figure={`$${Math.max(0, Math.floor(s.designCredits))}`}
                sub="Taken as a roof is designed. They never expire."
              >
                <Packs>
                  {TOKEN_PACKS.map((pack) => (
                    <PackButton
                      key={pack}
                      disabled={!mayBuy}
                      top={`$${packDollars(pack)} credits`}
                      extra={packBonus(pack) > 0 ? `+${packBonus(pack)} bonus` : undefined}
                      price={dollars(packPriceCents(pack))}
                      onClick={() =>
                        setPaying({
                          key: `pack-${pack}`,
                          title: `$${packDollars(pack)} of design credits`,
                          price: dollars(packPriceCents(pack)),
                          pack: { tokens: pack },
                        })
                      }
                    />
                  ))}
                </Packs>
              </Part>

              {s.voice.on && voice.length > 0 && (
                <Part icon={<Phone className="size-4" aria-hidden />} title="Calls &amp; Texts">
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {voice.map((m) => (
                      <div key={m.key}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs text-ink-2">{METER_WORDS[m.key].label}</p>
                          <p className="text-base font-semibold tabular-nums text-ink">{percentWords(m)}</p>
                        </div>
                        <Bar percent={m.percent} />
                        <p className="mt-1 text-[11px] tabular-nums text-muted">
                          {m.used} of {m.included} free
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-ink-2">
                    {!s.voice.charged
                      ? "Included for your business: counted, never charged."
                      : s.voice.capCents > 0
                        ? `Beyond the free allowance, charged on your next bill up to your $${(s.voice.capCents / 100).toLocaleString("en-AU")} cap.`
                        : "Your cap is $0: calls and texts stop at the free allowance."}{" "}
                    {s.owner && s.voice.charged && (
                      <Link
                        href={`${settingsPath("billing")}#add-ons`}
                        className="font-medium text-ink underline underline-offset-4"
                        onClick={onClose}
                      >
                        Change the cap
                      </Link>
                    )}
                  </p>
                </Part>
              )}
            </div>

            {!s.owner && (
              <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-2">Only the owner of the business can top up.</p>
            )}
            {s.owner && !s.payments && <p className="mt-4 text-xs text-muted">Payments aren&rsquo;t switched on yet.</p>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link href={settingsPath("usage")} className="font-medium text-ink underline underline-offset-4" onClick={onClose}>
                See all usage
              </Link>
              <Link href={settingsPath("billing")} className="text-ink-2 hover:text-ink" onClick={onClose}>
                Billing, top-ups and invoices
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-muted">Prices include GST. Card payments are taken securely by Stripe, here in this box.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Stripe's card form for the pack, inside the box. The card goes to Stripe, never to us; paid, Stripe comes back here. */
function CardForm({ paying, onBack }: { paying: Paying; onBack: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let live = true;
    let unmount: (() => void) | null = null;
    void (async () => {
      const got = await packCardForm(paying.pack, window.location.pathname);
      if (!live) return;
      if (!got.ok) {
        setLoading(false);
        return setProblem(got.message);
      }
      try {
        unmount = await mountDepositForm(el, Promise.resolve(got.secret), (m) => live && setProblem(m));
      } catch {
        if (live) setProblem("The card form couldn't load just now.");
      }
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
      unmount?.();
    };
  }, [paying.pack]);
  return (
    <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <CreditCard className="size-4" aria-hidden /> Pay by card · secured by Stripe
      </p>
      {loading && <p className="mt-3 text-[13px] text-muted">Opening the card form…</p>}
      <div ref={host} className="mt-3" />
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}{" "}
          <button type="button" className="underline underline-offset-2" onClick={onBack}>
            Back to usage
          </button>
        </p>
      )}
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
      <div className={clsx("h-full rounded-full", barTone(percent))} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function Part(props: {
  icon: React.ReactNode;
  title: string;
  figure?: string;
  sub?: string;
  percent?: number;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-canvas p-4 ring-1 ring-line/70">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-white">{props.icon}</span>
          {props.title}
        </h3>
        {props.figure && <span className="text-xl font-semibold tabular-nums text-ink">{props.figure}</span>}
      </div>
      {props.percent !== undefined && <Bar percent={props.percent} />}
      {props.sub && <p className="mt-1.5 text-xs text-ink-2">{props.sub}</p>}
      {props.children}
    </section>
  );
}

const Packs = ({ children, three }: { children: React.ReactNode; three?: boolean }) => (
  <div className="mt-3">
    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Top up</p>
    <div className={clsx("grid gap-2", three ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>{children}</div>
  </div>
);

function PackButton(props: { top: string; extra?: string; price: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex flex-col items-center rounded-xl border border-line bg-surface px-2 py-2.5 text-center hover:border-ink/40 disabled:cursor-not-allowed disabled:bg-surface-2"
    >
      <span className="text-sm font-semibold text-ink">{props.top}</span>
      {props.extra && <span className="text-[11px] font-medium text-positive">{props.extra}</span>}
      <span className="text-xs tabular-nums text-ink-2">{props.price}</span>
    </button>
  );
}
