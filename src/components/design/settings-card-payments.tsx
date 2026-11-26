"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { BadgeCheck, CreditCard, Landmark } from "lucide-react";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/config";
import { dollars } from "@/lib/domain/design/plans";
import { PLATFORM_FEE } from "@/lib/domain/design/proposal-payments";
import { getSetting, withSetting, type Workspace } from "@/lib/domain/design/pricing";
import { connectInstance, loadConnect, startCardPayments, switchCards, type ConnectView } from "@/lib/services/card-payments";
import { loadWorkspace, saveWorkspace } from "@/lib/services/design-store";
import { ui } from "./design-shell";

const monthName = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const pct = (share: number) => `${Math.round(share * 10000) / 100}%`;
const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Tag = "account-onboarding" | "account-management" | "notification-banner" | "payouts" | "payments";

/** One of Stripe's own forms or lists for the business's account, drawn inside RENUABL. */
function StripePart({ tag, onExit }: { tag: Tag; onExit?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY) return;
    let gone = false;
    let el: HTMLElement | null = null;
    void connectInstance(STRIPE_PUBLISHABLE_KEY)
      .then((connect) => {
        if (gone || !box.current) return;
        const made = connect.create(tag);
        made.setOnLoadError(() => setFailed("Stripe's form couldn't be loaded. Reload the page to try again."));
        if (tag === "account-onboarding" && onExit) (made as unknown as { setOnExit: (f: () => void) => void }).setOnExit(onExit);
        el = made;
        box.current.appendChild(made);
      })
      .catch(() => setFailed("Stripe's form couldn't be loaded. Reload the page to try again."));
    return () => {
      gone = true;
      el?.remove();
    };
  }, [tag, onExit]);
  return (
    <>
      <div ref={box} />
      {failed && <p className="text-sm text-danger">{failed}</p>}
    </>
  );
}

const TABS = [
  { key: "payouts", label: "Balance and payouts" },
  { key: "payments", label: "Payments" },
  { key: "account-management", label: "Business and bank details" },
] as const;

/**
 * Settings → Payment gateway (24 Nov 2026, Martin: "similar to pylon so the user experience is easy"). The business's
 * own Stripe account, opened and run through RENUABL: its details, bank account, balance, payouts and payments are all
 * here, in Stripe's own forms, with no Stripe Dashboard. Customers pay the deposit and each milestone by card from their
 * proposal; the money goes to the business's bank daily, less RENUABL's all-in fee.
 */
export function CardPaymentsSettings() {
  const [state, setState] = useState<ConnectView | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("payouts");
  const refresh = useCallback(() => void loadConnect().then(setState), []);
  useEffect(refresh, [refresh]);

  const start = async () => {
    setBusy(true);
    setNote(null);
    const a = await startCardPayments();
    setBusy(false);
    if (a.ok) refresh();
    else setNote(a.message);
  };
  const toggle = async (on: boolean) => {
    if (!state || "error" in state) return;
    setBusy(true);
    const a = await switchCards(on);
    setBusy(false);
    if (a.ok) setState({ ...state, cardsOn: on });
    else setNote(a.message);
  };

  const fee = pct(PLATFORM_FEE);
  return (
    <div className={clsx(ui.page, "max-w-4xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Payment gateway</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Customers pay their deposit and each payment milestone by card, straight from their proposal. The money goes to your bank account
          daily. Each card payment costs {fee}, all in: there are no other card fees. Bank transfer stays on offer beside it.
        </p>
      </div>
      {!state ? (
        <div className="min-h-[20dvh]" aria-busy="true" />
      ) : "error" in state ? (
        <p className="text-sm text-ink-2">{state.error}</p>
      ) : !state.available ? (
        <section className={clsx(ui.card, "p-5 sm:p-6")}>
          <p className="text-sm text-ink-2">Card payments aren&apos;t switched on for RENUABL yet.</p>
        </section>
      ) : !state.connected ? (
        <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-white">
              <CreditCard className="size-5" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-ink">Take card payments on your proposals</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-2">
            {state.older
              ? "Card payments now run through RENUABL, with no separate Stripe Dashboard to manage. Set them up again here in a few minutes. Payments made before stay in the Stripe account you opened."
              : "It takes a few minutes: your business details and ABN, the bank account to pay into, and the ID of a director or owner. Stripe, our payments partner, checks them, usually within minutes."}
          </p>
          <button className={ui.primary} disabled={busy} onClick={() => void start()}>
            {busy ? "Starting…" : "Set up card payments"}
          </button>
          {note && <p className="text-sm text-danger">{note}</p>}
        </section>
      ) : !state.chargesEnabled ? (
        <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Your business details</h2>
            <span className="text-sm text-ink-2">{state.words}</span>
          </div>
          <StripePart tag="account-onboarding" onExit={refresh} />
        </section>
      ) : (
        <>
          <StripePart tag="notification-banner" />
          <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Landmark className="size-5 text-ink" aria-hidden />
              <h2 className="text-base font-semibold text-ink">Card payments</h2>
              <span className="inline-flex items-center gap-1 text-sm text-positive">
                <BadgeCheck className="size-4" aria-hidden /> {state.words}
              </span>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={state.cardsOn}
                disabled={busy}
                onChange={(e) => void toggle(e.target.checked)}
              />
              <span className="text-ink">
                Offer card payments on accepted proposals
                <span className="block text-xs text-muted">
                  Customers see &quot;Pay by card&quot; for the next amount due. Paid deposits are marked received for you.
                </span>
              </span>
            </label>
            {note && <p className="text-sm text-danger">{note}</p>}
          </section>

          <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    "rounded-full px-3.5 py-1.5 text-sm",
                    tab === t.key ? "bg-primary text-white" : "bg-canvas text-ink-2 hover:text-ink",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <StripePart key={tab} tag={tab} />
          </section>
        </>
      )}

      {state && !("error" in state) && state.available && <FeeRecovery />}

      {state && !("error" in state) && state.fees.length > 0 && (
        <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Card fees by month</h2>
          <ul className="divide-y divide-line text-sm">
            {state.fees.map((m) => (
              <li key={m.month} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span className="text-ink">{monthName(m.month)}</span>
                <span className="tabular-nums text-ink-2">
                  {m.payments} {m.payments === 1 ? "payment" : "payments"} · {dollars(m.amountCents)} · fees {dollars(m.feeCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const STEPS = Array.from({ length: 11 }, (_, i) => Math.round(i * 25) / 10000);

/** Who pays the card fee: the business absorbs it, or part or all of it is recovered through the system price. */
function FeeRecovery() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [share, setShare] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    void loadWorkspace().then((w) => {
      setWs(w);
      setShare(getSetting(w.settings, "cardRecover") ?? 0);
    });
  }, []);
  if (!ws) return null;
  const kept = getSetting(ws.settings, "cardRecover") ?? 0;
  const save = async () => {
    const next = { ...ws, settings: withSetting(ws.settings, "cardRecover", share) };
    const problem = await saveWorkspace(next);
    if (problem) setSaved(problem);
    else {
      setWs(next);
      setSaved("Saved. New quotes and designs use it.");
    }
  };
  const base = 10000;
  const line = Math.round(((base * share) / (1 - share)) * 100) / 100;
  const absorb = PLATFORM_FEE - share;
  return (
    <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
      <div>
        <h2 className="text-base font-semibold text-ink">Who pays the card fee</h2>
        <p className="mt-1 text-sm text-ink-2">
          Each card payment costs {pct(PLATFORM_FEE)}. Absorb it, or recover some or all of it through the system price: new quotes add a
          &quot;Card payment fees&quot; line for the share you recover. Customers are never charged extra at checkout.
        </p>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={STEPS.findIndex((s) => Math.abs(s - share) < 1e-6)}
        onChange={(e) => {
          setShare(STEPS[Number(e.target.value)]);
          setSaved(null);
        }}
        className="w-full accent-[var(--primary)]"
        aria-label="Share of the card fee recovered through the price"
      />
      <p className="text-sm text-ink">
        {share === 0
          ? `You absorb the whole ${pct(PLATFORM_FEE)}. Prices don't change.`
          : absorb <= 0
            ? `You recover the whole ${pct(PLATFORM_FEE)} through the system price.`
            : `You absorb ${pct(absorb)} and recover ${pct(share)} through the system price.`}
      </p>
      <p className="text-xs text-muted">
        On a {money(base)} price: a card payment fees line of {money(line)}, and on the whole price a card fee of{" "}
        {money(Math.round((base + line) * PLATFORM_FEE * 100) / 100)}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={ui.primary} disabled={share === kept} onClick={() => void save()}>
          Save
        </button>
        {saved && <span className="text-sm text-ink-2">{saved}</span>}
      </div>
    </section>
  );
}
