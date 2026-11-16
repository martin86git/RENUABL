"use client";

/**
 * "Top up by itself" under Design credits and Sol credits in Billing (16 Nov 2026, Martin; domain/design/top-up.ts):
 * a switch, the pack bought, when, and the most a month. Off until the owner switches it on; saved as it is changed.
 */
import { useState } from "react";
import clsx from "clsx";
import { dollars } from "@/lib/domain/design/plans";
import {
  TOP_UP_CAPS,
  TOP_UP_FLOORS,
  topUpPackCents,
  topUpPackCredits,
  topUpWords,
  type TopUpKind,
  type TopUpSettings,
} from "@/lib/domain/design/top-up";
import { saveTopUp, type TopUpLineView } from "@/lib/services/billing";

const select = "h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink";

export function TopUpControl(props: {
  kind: TopUpKind;
  packs: readonly number[];
  settings: TopUpSettings;
  lines: TopUpLineView[];
  payments: boolean;
}) {
  const [s, setS] = useState(props.settings);
  const [note, setNote] = useState<string | null>(null);
  const change = async (next: TopUpSettings) => {
    const was = s;
    setS(next);
    setNote(null);
    const saved = await saveTopUp(props.kind, next);
    if (!saved.ok) {
      setS(was);
      setNote(saved.message);
    } else setS(saved.settings);
  };
  const last = props.lines.find((l) => l.kind === props.kind);
  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-ink">Top up by itself</span>
        <input
          type="checkbox"
          role="switch"
          className="size-4 accent-[var(--sun-line)]"
          checked={s.on}
          disabled={!props.payments}
          onChange={(e) => void change({ ...s, on: e.target.checked })}
        />
      </label>
      <p className="text-xs leading-relaxed text-ink-2">{topUpWords(props.kind, s)}</p>
      <div className={clsx("flex flex-wrap items-center gap-2 text-sm text-ink-2", !s.on && "opacity-60")}>
        <span>Buy</span>
        <select className={select} value={s.pack} onChange={(e) => void change({ ...s, pack: Number(e.target.value) })}>
          {props.packs.map((p) => (
            <option key={p} value={p}>
              {topUpPackCredits(props.kind, p).toLocaleString("en-AU")} credits · {dollars(topUpPackCents(props.kind, p) ?? 0)}
            </option>
          ))}
        </select>
        <span>below</span>
        <select className={select} value={s.below} onChange={(e) => void change({ ...s, below: Number(e.target.value) })}>
          {TOP_UP_FLOORS[props.kind].map((n) => (
            <option key={n} value={n}>
              {n} credits
            </option>
          ))}
        </select>
        <span>up to</span>
        <select
          className={select}
          value={s.monthlyCapCents}
          onChange={(e) => void change({ ...s, monthlyCapCents: Number(e.target.value) })}
        >
          {TOP_UP_CAPS[props.kind].map((c) => (
            <option key={c} value={c}>
              {dollars(c)} a month
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted">Charged to the card your plan is paid with, with a tax invoice for each. Turn it off any time.</p>
      {last && (
        <p className={clsx("text-xs", last.status === "failed" ? "text-danger" : "text-muted")}>
          Last top-up {new Date(last.at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}:{" "}
          {last.status === "paid"
            ? `${last.credits.toLocaleString("en-AU")} credits for ${dollars(last.cents)}`
            : last.status === "failed"
              ? `not charged. ${last.reason ?? ""}`
              : "charging…"}
        </p>
      )}
      {!props.payments && <p className="text-xs text-muted">Payments aren&apos;t switched on yet.</p>}
      {note && <p className="text-xs text-danger">{note}</p>}
    </div>
  );
}
