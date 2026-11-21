"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import {
  ADD_ON_WORDS,
  ADD_TO_PLAN,
  CANCEL_PLAN,
  NOTICE_LINE,
  addOnPriceWords,
  cancelNoticeWords,
  endingWords,
  hasNotice,
  noticeEnds,
  numberStandingWords,
  standingWords,
  voiceTerms,
  type AddOnKey,
} from "@/lib/domain/design/add-ons";
import { addAddOn, getBusinessNumber, keepAddOn, removeAddOn, setSpendingCap, useAddOns } from "@/lib/services/addons";
import { DEFAULT_CAP_CENTS, usageWords } from "@/lib/domain/design/voice-usage";
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
  const usable = item.standing === "on" || item.standing === "included" || item.standing === "ending";
  const statusLine = item.standing === "ending" ? endingWords(addOn, item.endsAt) : standingWords(addOn, item.standing);

  const act = async (
    ask: () => Promise<{ ok: boolean; message?: string; requested?: boolean; number?: string; numberPending?: boolean }>,
    done: string,
  ) => {
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
            ? `${done} Your business number is ${localNumber(a.number)}.`.trim()
            : a.numberPending
              ? `${done} ${a.message ?? ""}`.trim()
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
          <span className="font-medium text-ink">{words.name}</span> · {usable ? statusLine : addOnPriceWords(addOn, item.cents)}
          {item.standing === "requested" && <> · {standingWords(addOn, "requested")}</>}
        </p>
        {button}
        {/* Before it's added: when it is billed, what a call costs, and that the number comes with it. */}
        {addOn === "voice" && item.standing === "off" && view.mayAdd && (
          <ul className="w-full space-y-1 text-[12px] leading-snug text-ink-2">
            {voiceTerms(view.nextBill).map((line) => (
              <li key={line} className="flex gap-1.5">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-2" />
                {line}
              </li>
            ))}
          </ul>
        )}
        {/* Once it's on: the number, or where it stands and the way to get it. */}
        {addOn === "voice" && (item.standing === "on" || item.standing === "ending") && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-2">
              {numberStandingWords({ number: view.number ? localNumber(view.number.e164) : null, canBuy: view.canBuyNumber })}
            </p>
            {!view.number && view.canBuyNumber && view.mayAdd && (
              <button type="button" className={ui.primary} disabled={busy} onClick={() => void act(getBusinessNumber, "")}>
                {busy ? "Setting it up…" : "Get my business number"}
              </button>
            )}
          </div>
        )}
        {note && <p className="w-full text-[12px] font-medium text-ink">{note}</p>}
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
          {[...words.includes, ...(addOn === "voice" ? voiceTerms(view.nextBill) : [NOTICE_LINE])].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink" />
              {line}
            </li>
          ))}
        </ul>
      )}
      {item.standing !== "off" && <p className="text-sm font-medium text-ink">{statusLine}</p>}
      {addOn === "voice" && usable && <VoiceNumber view={view} busy={busy} onGet={() => void act(getBusinessNumber, "")} />}
      {addOn === "voice" && usable && item.standing !== "included" && (
        <VoiceUsage view={view} busy={busy} onCap={(dollars) => void act(() => setSpendingCap(dollars), "Your spending cap is saved.")} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {button}
        {!manage && item.standing === "off" && view.mayAdd && (
          <Link href={BILLING} className={clsx(ui.link, "text-[13px]")}>
            See it in Billing
          </Link>
        )}
        {manage && view.mayAdd && item.standing === "requested" && (
          <button
            type="button"
            className={ui.quiet}
            disabled={busy}
            onClick={() => void act(() => removeAddOn(addOn), `${words.name} isn't asked for any more.`)}
          >
            Cancel the request
          </button>
        )}
        {manage && view.mayAdd && item.standing === "on" && !confirmEnd && (
          <button type="button" className={ui.quiet} disabled={busy} onClick={() => setConfirmEnd(true)}>
            {CANCEL_PLAN}
          </button>
        )}
        {manage && view.mayAdd && item.standing === "ending" && (
          <button
            type="button"
            className={ui.quiet}
            disabled={busy}
            onClick={() => void act(() => keepAddOn(addOn), `${words.name} stays on your plan.`)}
          >
            Keep {words.name}
          </button>
        )}
      </div>
      {/* Before cancelling: the notice, what is billed, and what happens to the number. */}
      {manage && confirmEnd && item.standing === "on" && (
        <div role="alertdialog" aria-label={`Cancel ${words.name}`} className="space-y-3 rounded-md bg-canvas p-4 ring-1 ring-line">
          {hasNotice(addOn) ? (
            <ul className="space-y-1.5 text-[13px] leading-snug text-ink-2">
              {cancelNoticeWords({
                key: addOn,
                endsAt: noticeEnds(new Date()),
                number: view.number ? localNumber(view.number.e164) : null,
              }).map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-2" />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">{words.name} comes off your plan now; the rest of this month is credited by the day.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ui.primary}
              disabled={busy}
              onClick={() =>
                void act(
                  () => removeAddOn(addOn),
                  hasNotice(addOn) ? `${words.name} is cancelled. It stays on until its notice ends.` : `${words.name} is off your plan.`,
                )
              }
            >
              {busy ? "Cancelling…" : `Yes, cancel ${words.name}`}
            </button>
            <button type="button" className={ui.quiet} disabled={busy} onClick={() => setConfirmEnd(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {note && <p className="text-sm text-ink-2">{note}</p>}
    </section>
  );
}

/** This month's minutes and texts against the free allowance, and the spending cap the owner sets. */
function VoiceUsage({
  view,
  busy,
  onCap,
}: {
  view: NonNullable<ReturnType<typeof useAddOns>[0]>;
  busy: boolean;
  onCap: (dollars: string) => void;
}) {
  const cap = view.capCents ?? DEFAULT_CAP_CENTS;
  const [editing, setEditing] = useState(false);
  const [dollars, setDollars] = useState(String(cap / 100));
  const lines = usageWords(view.usage ?? { minutes: 0, texts: 0 }, cap);
  return (
    <div className="space-y-2 rounded-md bg-canvas p-3 ring-1 ring-line">
      <ul className="space-y-1 text-sm text-ink-2">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {view.mayAdd &&
        (editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCap(dollars);
              setEditing(false);
            }}
          >
            <label className="text-sm text-ink-2" htmlFor="voice-cap">
              Spending cap a month, beyond the free allowance: $
            </label>
            <input
              id="voice-cap"
              inputMode="numeric"
              className="w-24 rounded-md bg-surface px-2 py-1 text-sm text-ink ring-1 ring-line"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
            />
            <button type="submit" className={ui.primary} disabled={busy}>
              Save
            </button>
            <button type="button" className={ui.quiet} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className={ui.quiet} onClick={() => setEditing(true)}>
            Change the spending cap
          </button>
        ))}
    </div>
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
      <p className="text-sm text-ink-2">{numberStandingWords({ number: null, canBuy: view.canBuyNumber })}</p>
      {view.mayAdd && view.canBuyNumber && (
        <button type="button" className={ui.primary} disabled={busy} onClick={onGet}>
          {busy ? "Setting it up…" : "Get my business number"}
        </button>
      )}
    </div>
  );
}
