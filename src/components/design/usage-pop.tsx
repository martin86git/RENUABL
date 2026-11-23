"use client";

/**
 * Usage on Today (23 Nov 2026, Martin: "add a usage shortcut in today / business… an icon that represents usage. Easy
 * for the admin to access and ideally appears as a pop up box. Makes it easy for the user admin to top up as
 * required"). A small gauge beside the day's weather, ringed by the most-used allowance, for the owner and anyone who
 * may change settings (the route answers no one else, so no one else sees it). It opens a box over the page with this
 * month's allowances and the packs to top up, bought on Stripe's page by the owner, as in Billing.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { Gauge, X } from "lucide-react";
import { METER_WORDS, percentWords } from "@/lib/domain/design/usage";
import { SOL_PACKS } from "@/lib/domain/design/sol-credits";
import { TOKEN_PACKS, dollars, packBonus, packDollars, packPriceCents } from "@/lib/domain/design/plans";
import { buySolCredits, buyTokens } from "@/lib/services/billing";
import { loadUsagePop, type UsagePop } from "@/lib/services/usage";
import { settingsPath } from "./settings-list";

const tone = (p: number) => (p >= 100 ? "var(--danger)" : p >= 80 ? "var(--sun-line)" : "var(--ink)");
const barTone = (p: number) => (p >= 100 ? "bg-danger" : p >= 80 ? "bg-sun-line" : "bg-primary");

export function UsageButton() {
  const [state, setState] = useState<UsagePop | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let on = true;
    void loadUsagePop().then((s) => on && setState(s));
    return () => {
      on = false;
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
      {open && typeof document !== "undefined" && createPortal(<UsageBox s={state} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function UsageBox({ s, onClose }: { s: UsagePop; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const buy = async (key: string, ask: () => Promise<{ ok: boolean; url?: string; message?: string }>) => {
    setBusy(key);
    setNote(null);
    const a = await ask();
    if (a.ok && a.url) window.location.assign(a.url);
    else {
      setBusy(null);
      setNote(a.message ?? "That didn't go through.");
    }
  };
  const mayBuy = s.owner && s.payments && busy === null;
  const sol = s.meters.find((m) => m.key === "sol");
  const voice = s.meters.filter((m) => m.key !== "sol");
  return (
    <div className="theme-studio contents">
      <div className="fixed inset-0 z-[95] bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-pop-title"
        className="fixed left-1/2 top-1/2 z-[96] max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-5 text-left shadow-2xl ring-1 ring-line"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="usage-pop-title" className="text-lg font-semibold text-ink">
              Usage this month
            </h2>
            <p className="text-xs text-muted">
              Ends {s.ends} · {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left
            </p>
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

        {sol && (
          <Part
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
                    busy={busy === `sol-${p.credits}`}
                    top={`${p.credits.toLocaleString("en-AU")} credits`}
                    price={dollars(p.cents)}
                    onClick={() => void buy(`sol-${p.credits}`, () => buySolCredits(p.credits))}
                  />
                ))}
              </Packs>
            )}
          </Part>
        )}

        <Part
          title="Design credits"
          figure={`$${Math.max(0, Math.floor(s.designCredits))}`}
          sub="Taken as a roof is designed. They never expire."
        >
          <Packs>
            {TOKEN_PACKS.map((pack) => (
              <PackButton
                key={pack}
                disabled={!mayBuy}
                busy={busy === `pack-${pack}`}
                top={`$${packDollars(pack)} credits`}
                extra={packBonus(pack) > 0 ? `+${packBonus(pack)} bonus` : undefined}
                price={dollars(packPriceCents(pack))}
                onClick={() => void buy(`pack-${pack}`, () => buyTokens(pack))}
              />
            ))}
          </Packs>
        </Part>

        {s.voice.on && voice.length > 0 && (
          <section className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-medium text-ink">Calls &amp; Texts</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              {voice.map((m) => (
                <div key={m.key}>
                  <p className="text-xs text-ink-2">{METER_WORDS[m.key].label}</p>
                  <p className="text-lg font-semibold tabular-nums text-ink">{percentWords(m)}</p>
                  <Bar percent={m.percent} />
                  <p className="mt-1 text-[11px] tabular-nums text-muted">
                    {m.used} of {m.included} free
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-2">
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
          </section>
        )}

        {!s.owner && <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-2">Only the owner of the business can top up.</p>}
        {s.owner && !s.payments && <p className="mt-4 text-xs text-muted">Payments aren&rsquo;t switched on yet.</p>}
        {note && <p className="mt-3 text-sm text-danger">{note}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
          <Link href={settingsPath("usage")} className="font-medium text-ink underline underline-offset-4" onClick={onClose}>
            See all usage
          </Link>
          <Link href={settingsPath("billing")} className="text-ink-2 hover:text-ink" onClick={onClose}>
            Billing, top-ups and invoices
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-muted">Prices include GST. Payment is taken on Stripe&rsquo;s page.</p>
      </div>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
      <div className={clsx("h-full rounded-full", barTone(percent))} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function Part(props: { title: string; figure: string; sub: string; percent?: number; children?: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{props.title}</h3>
        <span className="text-xl font-semibold tabular-nums text-ink">{props.figure}</span>
      </div>
      {props.percent !== undefined && <Bar percent={props.percent} />}
      <p className="mt-1 text-xs text-ink-2">{props.sub}</p>
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

function PackButton(props: { top: string; extra?: string; price: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex flex-col items-center rounded-xl border border-line bg-surface px-2 py-2.5 text-center hover:border-ink/40 disabled:cursor-not-allowed disabled:bg-surface-2"
    >
      <span className="text-sm font-semibold text-ink">{props.top}</span>
      {props.extra && <span className="text-[11px] font-medium text-positive">{props.extra}</span>}
      <span className="text-xs tabular-nums text-ink-2">{props.busy ? "Opening Stripe…" : props.price}</span>
    </button>
  );
}
