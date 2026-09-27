"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, cn } from "@/components/ui/primitives";
import { suggestedRates } from "@/lib/domain/partner";
import { formatCurrency, formatDateTime } from "@/lib/domain/format";
import type { InstallRates, PartnerType } from "@/lib/domain/partner";
import type { Job } from "@/lib/domain/types";
import {
  VARIATION_LIMITS,
  VARIATION_PRESETS,
  VARIATION_STATUS_LABEL,
  cleanVariationInput,
  priceVariation,
  type Variation,
} from "@/lib/domain/variations";
import { answerVariation, sendVariation } from "@/lib/services/handover";
import { FIELD, useInstallationRecord } from "./use-record";

export interface PartnerTerms {
  type: PartnerType;
  margin?: number;
  rates?: InstallRates;
}

const TONE = { sent: "warning", approved: "positive", declined: "neutral", withdrawn: "neutral" } as const;

function VariationCard({ v, onWithdraw }: { v: Variation; onWithdraw?: () => void }) {
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium">{v.items.map((i) => i.label).join(", ")}</p>
        <Badge tone={TONE[v.status]}>{VARIATION_STATUS_LABEL[v.status]}</Badge>
      </div>
      <p className="mt-1 text-[14px] text-ink-2">{v.reason}</p>
      <p className="mt-2 text-[13px] text-muted">
        You&apos;re paid {formatCurrency(v.partnerAmount)} ex GST · customer pays {formatCurrency(v.customerPrice)} · sent{" "}
        {formatDateTime(v.sentAt)}
      </p>
      {onWithdraw && v.status === "sent" && (
        <button type="button" onClick={onWithdraw} className="tap-area relative mt-2 text-[13px] text-muted underline underline-offset-4">
          Withdraw
        </button>
      )}
    </li>
  );
}

/**
 * Extra work found on site, priced and sent to the customer to approve in the
 * app. Only do the work once it's approved.
 */
export function JobVariations({ job, partner }: { job: Job; partner: PartnerTerms }) {
  const { record, setRecord, backend } = useInstallationRecord(job.recordKey, job.reference);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ label: string; amount: string }[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rates = partner.rates ?? suggestedRates();

  const parsed = items.map((i) => ({ label: i.label.trim(), amount: Number(i.amount) }));
  const valid = cleanVariationInput({ reason, items: parsed });
  const price = valid ? priceVariation(valid.items, partner) : null;

  function addPreset(id: string) {
    const p = VARIATION_PRESETS.find((x) => x.id === id)!;
    const suggested = p.rate ? rates[p.rate] : 0;
    setItems((xs) =>
      xs.length >= VARIATION_LIMITS.items
        ? xs
        : [...xs, { label: p.id === "other" ? "" : p.label, amount: suggested ? String(suggested) : "" }],
    );
  }

  async function send() {
    if (!record || !valid) return;
    setBusy(true);
    setProblem(null);
    try {
      setRecord(await sendVariation(record, backend, valid, partner));
      setItems([]);
      setReason("");
      setOpen(false);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't send. Try again.");
    }
    setBusy(false);
  }

  async function withdraw(id: string) {
    if (!record) return;
    try {
      setRecord(await answerVariation(record, backend, id, "withdraw"));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't withdraw it.");
    }
  }

  const list = record?.variations ?? [];

  return (
    <div>
      <p className="text-[14px] text-ink-2">
        Found more work on site, like a switchboard upgrade? Price it here and the customer approves it in the app. Only start once
        it&apos;s approved.
      </p>
      {list.length > 0 && (
        <ul className="mt-4 space-y-3">
          {[...list].reverse().map((v) => (
            <VariationCard key={v.id} v={v} onWithdraw={() => void withdraw(v.id)} />
          ))}
        </ul>
      )}

      {!open ? (
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => setOpen(true)} disabled={!record}>
          <Plus className="h-4 w-4" /> New variation
        </Button>
      ) : (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="text-[13px] text-muted">Add the work</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VARIATION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addPreset(p.id)}
                className="min-h-10 rounded-full border border-line px-3.5 text-[14px] text-ink-2 hover:border-line-strong hover:text-ink"
              >
                + {p.label}
              </button>
            ))}
          </div>
          {items.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {items.map((it, n) => (
                <li key={n} className="flex items-center gap-2">
                  <input
                    aria-label="Work"
                    value={it.label}
                    maxLength={VARIATION_LIMITS.label}
                    placeholder="What's the work?"
                    onChange={(e) => setItems((xs) => xs.map((x, i) => (i === n ? { ...x, label: e.target.value } : x)))}
                    className={cn(FIELD, "min-w-0 flex-1")}
                  />
                  <span className="relative w-32 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                    <input
                      aria-label="Price ex GST"
                      inputMode="decimal"
                      value={it.amount}
                      placeholder="ex GST"
                      onChange={(e) =>
                        setItems((xs) => xs.map((x, i) => (i === n ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))
                      }
                      className={cn(FIELD, "pl-7 tabular-nums")}
                    />
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setItems((xs) => xs.filter((_, i) => i !== n))}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:text-ink"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 block">
            <span className="text-[13px] text-muted">Why it&apos;s needed (the customer sees this)</span>
            <textarea
              value={reason}
              maxLength={VARIATION_LIMITS.reason}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The switchboard has ceramic fuses and no room for the solar breaker, so it needs upgrading to meet the standard."
              className={cn(FIELD, "mt-1.5")}
            />
          </label>
          {price && (
            <p className="mt-3 text-[14px]">
              You&apos;re paid <span className="font-medium tabular-nums">{formatCurrency(price.partnerAmount)}</span> ex GST · the customer
              pays <span className="font-medium tabular-nums">{formatCurrency(price.customerPrice)}</span> incl. GST
            </p>
          )}
          {problem && (
            <p className="mt-2 text-[13px] text-danger" role="alert">
              {problem}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex">
            <Button size="sm" onClick={() => void send()} disabled={!valid || busy}>
              Send to customer
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {backend === "device" && (
        <p className="mt-3 text-[12px] text-warning">Storage isn&apos;t set up yet, so variations are saved on this device only.</p>
      )}
    </div>
  );
}
