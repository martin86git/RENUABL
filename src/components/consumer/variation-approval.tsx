"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button, Card, cn } from "@/components/ui/primitives";
import { CONNECTION_STEPS } from "@/lib/domain/connection";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import type { HandoverRecord } from "@/lib/domain/handover";
import type { Variation } from "@/lib/domain/variations";
import { answerVariation, type Backend } from "@/lib/services/handover";

const DECIDED = {
  approved: "You approved this",
  declined: "You declined this",
  withdrawn: "Withdrawn by your installation partner",
} as const;

/** Extra work the installation partner has asked to do: approve or decline it here. */
export function VariationApprovals({
  record,
  backend,
  example,
  onChange,
}: {
  record: HandoverRecord;
  backend: Backend;
  example: boolean;
  onChange: (r: HandoverRecord) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const list = record.variations ?? [];
  if (!list.length) return null;

  async function answer(v: Variation, action: "approve" | "decline") {
    setBusy(v.id);
    setProblem(null);
    try {
      onChange(await answerVariation(record, backend, v.id, action));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't go through. Try again.");
    }
    setBusy(null);
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[17px] font-medium">Extra work</h2>
      <ul className="mt-3 space-y-4">
        {[...list].reverse().map((v) => (
          <li key={v.id} className={cn("rounded-2xl p-4", v.status === "sent" ? "bg-surface-2" : "border border-line")}>
            <p className="text-[15px] font-medium">{v.items.map((i) => i.label).join(", ")}</p>
            <p className="mt-1 text-[14px] text-ink-2">{v.reason}</p>
            <p className="mt-2 text-[20px] tracking-tight tabular-nums">
              {formatCurrency(v.customerPrice)} <span className="text-[13px] text-muted">incl. GST</span>
            </p>
            {v.status === "sent" ? (
              <>
                <p className="mt-1 text-[13px] text-muted">Added to your total if you approve. Nothing is charged now.</p>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:flex">
                  <Button size="sm" disabled={example || busy === v.id} onClick={() => void answer(v, "approve")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={example || busy === v.id} onClick={() => void answer(v, "decline")}>
                    Decline
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-muted">
                {DECIDED[v.status]}
                {v.decidedAt ? ` · ${formatDate(v.decidedAt.slice(0, 10), { day: "numeric", month: "short" })}` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <p className="mt-4 text-[13px] text-muted">Questions first? Ask on your call or message us before deciding.</p>
    </Card>
  );
}

/** Where the grid connection and rebates are up to. */
export function ConnectionProgress({ record }: { record: HandoverRecord }) {
  const progress = record.connection ?? {};
  const steps = CONNECTION_STEPS.filter((s) => !s.solarVicOnly || progress[s.id]);
  return (
    <Card className="h-fit p-5 sm:p-6">
      <h2 className="text-[17px] font-medium">Connection and rebates</h2>
      <ol className="mt-3 space-y-3">
        {steps.map((s) => {
          const done = progress[s.id];
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                  done ? "border-forest bg-forest text-white" : "border-line-strong",
                )}
              >
                {done && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </span>
              <span className={cn("flex-1 text-[14px]", done ? "text-ink" : "text-muted")}>{s.customerLabel}</span>
              {done && <span className="text-[12px] text-muted">{formatDate(done.done, { day: "numeric", month: "short" })}</span>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
