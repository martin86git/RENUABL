"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ADD_ON_WORDS, ADD_TO_PLAN, addOnPriceWords, standingWords, type AddOnKey } from "@/lib/domain/design/add-ons";
import { addAddOn, getBusinessNumber, removeAddOn, useAddOns } from "@/lib/services/addons";
import { ui } from "./design-shell";

const BILLING = "/design/settings/billing";

const localNumber = (e164: string) => e164.replace(/^\+61(\d)(\d{2})(\d{3})(\d{3})$/, "0$1$2 $3 $4");

/**
 * An add-on offered where its feature lives (domain/design/add-ons.ts): what it is and comes with, its price ("Price on
 * request" until set), and Add to your plan in place of the feature's own action. On the plan it says so, and for
 * voice it carries the business's own number (Get my number until it has one). `compact` is one line with the button.
 */
export function AddOnOffer({ addOn, compact = false, manage = false }: { addOn: AddOnKey; compact?: boolean; manage?: boolean }) {
  const [view] = useAddOns();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (!view) return null;
  const item = view.addOns.find((a) => a.key === addOn);
  if (!item) return null;
  const words = ADD_ON_WORDS[addOn];
  const usable = item.standing === "on" || item.standing === "included";

  const act = async (ask: () => Promise<{ ok: boolean; message?: string; requested?: boolean; number?: string }>, done: string) => {
    setBusy(true);
    setNote(null);
    const a = await ask();
    setBusy(false);
    setConfirmEnd(false);
    setNote(
      a.ok
        ? a.requested
          ? standingWords(addOn, "requested")
          : a.number
            ? `Your number is ${localNumber(a.number)}.`
            : done
        : (a.message ?? "That didn't go through."),
    );
  };

  const button =
    item.standing === "off" ? (
      view.mayAdd ? (
        <button
          type="button"
          className={ui.primary}
          disabled={busy}
          onClick={() => void act(() => addAddOn(addOn), standingWords(addOn, "on"))}
        >
          {busy ? "Adding…" : ADD_TO_PLAN}
        </button>
      ) : (
        <span className="text-[13px] text-muted">Ask your business&apos;s owner to add it in Settings → Billing.</span>
      )
    ) : null;

  if (compact)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2.5 ring-1 ring-line">
        <p className="min-w-0 text-[13px] text-ink-2">
          <span className="font-medium text-ink">{words.name}</span> ·{" "}
          {usable ? standingWords(addOn, item.standing) : addOnPriceWords(addOn, item.cents)}
          {item.standing === "requested" && <> · {standingWords(addOn, "requested")}</>}
        </p>
        {button}
        {note && <p className="w-full text-[12px] text-ink-2">{note}</p>}
      </div>
    );

  return (
    <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")} aria-label={words.name}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{words.name}</h2>
        <p className="text-sm text-ink-2">{item.standing === "included" ? "Included" : addOnPriceWords(addOn, item.cents)}</p>
      </div>
      <p className="text-sm leading-relaxed text-ink-2">{words.what}</p>
      {!usable && (
        <ul className="space-y-1 text-sm text-ink-2">
          {words.includes.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink" />
              {line}
            </li>
          ))}
        </ul>
      )}
      {item.standing !== "off" && <p className="text-sm font-medium text-ink">{standingWords(addOn, item.standing)}</p>}
      {addOn === "voice" && usable && <VoiceNumber view={view} busy={busy} onGet={() => void act(getBusinessNumber, "")} />}
      <div className="flex flex-wrap items-center gap-3">
        {button}
        {!manage && item.standing === "off" && view.mayAdd && (
          <Link href={BILLING} className={clsx(ui.link, "text-[13px]")}>
            See it in Billing
          </Link>
        )}
        {manage && view.mayAdd && (item.standing === "on" || item.standing === "requested") && (
          <button
            type="button"
            className={ui.quiet}
            disabled={busy}
            onClick={() => (confirmEnd ? void act(() => removeAddOn(addOn), `${words.name} is off your plan.`) : setConfirmEnd(true))}
          >
            {confirmEnd
              ? addOn === "voice"
                ? "Yes, take it off and give up our number"
                : "Yes, take it off my plan"
              : item.standing === "requested"
                ? "Cancel the request"
                : "Take it off my plan"}
          </button>
        )}
      </div>
      {note && <p className="text-sm text-ink-2">{note}</p>}
    </section>
  );
}

function VoiceNumber({ view, busy, onGet }: { view: NonNullable<ReturnType<typeof useAddOns>[0]>; busy: boolean; onGet: () => void }) {
  if (view.number)
    return (
      <p className="text-sm text-ink-2">
        Your business number: <span className="font-medium tabular-nums text-ink">{localNumber(view.number.e164)}</span>
        {view.number.renuabl && " (RENUABL's own)"}
      </p>
    );
  return (
    <div className="space-y-2 rounded-md bg-canvas p-3 ring-1 ring-line">
      <p className="text-sm text-ink-2">
        Your agents call and text from a number of your own. {view.canBuyNumber ? "It's set up in a moment." : "We'll set it up with you."}
      </p>
      {view.mayAdd && (
        <button type="button" className={ui.primary} disabled={busy} onClick={onGet}>
          {busy ? "Setting it up…" : "Get my business number"}
        </button>
      )}
    </div>
  );
}
