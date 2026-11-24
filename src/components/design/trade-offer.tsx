"use client";

import clsx from "clsx";
import { Check, Package, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  MAX_PRICE,
  OFFER_NOTE,
  OFFER_STATE_WORDS,
  money,
  offerChoices,
  type TradeItem,
  type TradeMessage,
} from "@/lib/domain/design/trade";
import { tradePhotoSrc } from "@/lib/services/trade";
import { ui } from "./design-shell";

/**
 * Your offer (23 Nov 2026, Martin, from Facebook Marketplace's offer sheet): the item at the top, 10% lower, the asking
 * price and 5% higher to pick from (the asking price picked), or a different amount, how many when there are several,
 * a note if wanted, the note that an offer isn't a payment, and Send offer. A sheet from the foot on a phone, a box
 * in the middle on a computer.
 */
export function OfferSheet({
  item,
  onClose,
  onSend,
}: {
  item: TradeItem;
  onClose: () => void;
  onSend: (offer: { each: number; qty: number }, note: string) => Promise<string | null>;
}) {
  const choices = offerChoices(item.price);
  const [picked, setPicked] = useState<number | "own">(choices.length ? 1 : "own");
  const [own, setOwn] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const each = picked === "own" ? Number(own.replace(/[$,\s]/g, "")) : choices[picked].each;
  const valid = Number.isFinite(each) && each > 0 && each <= MAX_PRICE;
  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const problem = await onSend({ each, qty }, note.trim());
    setBusy(false);
    if (problem) setProblem(problem);
    else onClose();
  };
  return createPortal(
    <div className="theme-studio contents">
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your offer"
        className="fixed inset-x-0 bottom-0 z-[121] max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="relative flex items-center justify-center border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-3 flex size-9 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
          <p className="text-base font-semibold text-ink">Your offer</p>
        </div>
        <div className="space-y-4 px-5 pt-4">
          <div className="flex items-center gap-3">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
              {item.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tradePhotoSrc(item.photos[0])} alt="" className="size-full object-cover" />
              ) : (
                <Package className="size-7 text-muted" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
              <span className="block text-sm text-positive">
                {item.price === null ? "Make an offer" : `${money(item.price)} each`} <span className="text-muted">ex GST</span>
              </span>
              <span className="block text-xs text-muted">{item.suburb}</span>
            </span>
          </div>
          {choices.length > 0 && (
            <div role="radiogroup" aria-label="Your offer each" className="divide-y divide-line">
              {choices.map((c, n) => (
                <button
                  key={c.words}
                  type="button"
                  role="radio"
                  aria-checked={picked === n}
                  onClick={() => setPicked(n)}
                  className="flex w-full items-center justify-between py-3 text-left text-base text-ink"
                >
                  {c.words}
                  <Dot on={picked === n} />
                </button>
              ))}
            </div>
          )}
          {picked === "own" ? (
            <label className="block">
              <span className="text-xs text-muted">Your offer for each, ex GST</span>
              <span className="mt-1 flex items-center gap-1 rounded-xl px-3 ring-1 ring-line focus-within:ring-ink">
                <span className="text-muted">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={own}
                  onChange={(e) => setOwn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void send()}
                  placeholder="0"
                  className="h-11 w-full bg-transparent text-base text-ink outline-none"
                />
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted">
              Offer a{" "}
              <button type="button" onClick={() => setPicked("own")} className="text-[#2f6fe4] hover:underline">
                different amount
              </button>
            </p>
          )}
          {item.qty > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">How many</span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="One fewer"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="size-9 rounded-full text-lg ring-1 ring-line"
                >
                  −
                </button>
                <span className="w-10 text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label="One more"
                  onClick={() => setQty((q) => Math.min(item.qty, q + 1))}
                  className="size-9 rounded-full text-lg ring-1 ring-line"
                >
                  +
                </button>
                <span className="text-xs text-muted">of {item.qty}</span>
              </span>
            </div>
          )}
          {valid && qty > 1 && (
            <p className="text-sm text-ink">
              Total {money(Math.round(each * qty * 100) / 100)} <span className="text-muted">ex GST</span>
            </p>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Add a note (optional)"
            className={clsx(ui.input, "py-2")}
          />
          <p className="text-sm leading-relaxed text-ink-2">{OFFER_NOTE}</p>
          {problem && (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" role="alert">
              {problem}
            </p>
          )}
          <button
            type="button"
            onClick={() => void send()}
            disabled={!valid || busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f6fe4] text-base font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
          >
            <Tag className="size-5" aria-hidden /> {busy ? "Sending…" : "Send offer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const Dot = ({ on }: { on: boolean }) => (
  <span
    className={clsx("flex size-6 items-center justify-center rounded-full ring-2", on ? "ring-[#2f6fe4]" : "ring-line-strong")}
    aria-hidden
  >
    {on && <span className="size-3.5 rounded-full bg-[#2f6fe4]" />}
  </span>
);

/** An offer in the conversation: the amount, where it stands, and the buttons whoever may act on it has. */
export function OfferBubble({
  m,
  seller,
  onAnswer,
}: {
  m: TradeMessage & { offer: NonNullable<TradeMessage["offer"]> };
  /** The business reading sells the item. */
  seller: boolean;
  onAnswer: (act: "accept" | "decline" | "withdraw") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const go = (act: "accept" | "decline" | "withdraw") => async () => {
    setBusy(true);
    await onAnswer(act);
    setBusy(false);
  };
  const [first, ...rest] = m.text.split("\n\n");
  const state = m.offer.state;
  return (
    <span
      className={clsx(
        "block w-[min(18rem,85%)] rounded-2xl px-3.5 py-3 text-sm ring-1",
        m.own ? "ml-auto bg-[#2f6fe4]/[0.07] ring-[#2f6fe4]/40" : "bg-surface ring-line",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#2f6fe4]">
        <Tag className="size-3.5" aria-hidden /> {m.own ? "Your offer" : `Offer from ${m.business}`}
      </span>
      <span className="mt-1 block text-lg font-semibold text-ink">
        {money(m.offer.each)}
        {m.offer.qty > 1 ? ` each × ${m.offer.qty}` : ""} <span className="text-xs font-normal text-muted">ex GST</span>
      </span>
      {rest.length > 0 && <span className="mt-1 block whitespace-pre-line text-ink-2">{rest.join("\n\n")}</span>}
      <span className="sr-only">{first}</span>
      <span
        className={clsx(
          "mt-2 flex items-center gap-1 text-xs",
          state === "accepted" ? "text-positive" : state === "open" ? "text-muted" : "text-muted line-through",
        )}
      >
        {state === "accepted" && <Check className="size-3.5" aria-hidden />}
        {seller && state === "open" ? "Waiting for your answer" : OFFER_STATE_WORDS[state]}
      </span>
      {state === "open" && seller && !m.own && (
        <span className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={go("accept")}
            className="h-9 flex-1 rounded-lg bg-[#2f6fe4] text-sm font-semibold text-white disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={go("decline")}
            className="h-9 flex-1 rounded-lg text-sm font-medium text-ink ring-1 ring-line disabled:opacity-60"
          >
            Decline
          </button>
        </span>
      )}
      {state === "open" && m.own && (
        <button
          type="button"
          disabled={busy}
          onClick={go("withdraw")}
          className="mt-2 text-xs text-muted underline underline-offset-4 hover:text-ink"
        >
          Withdraw offer
        </button>
      )}
    </span>
  );
}
