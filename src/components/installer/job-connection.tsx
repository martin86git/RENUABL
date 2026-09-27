"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Badge, cn } from "@/components/ui/primitives";
import { connectionSteps, type ConnectionStepId } from "@/lib/domain/connection";
import { formatDate } from "@/lib/domain/format";
import { todayInMarket } from "@/lib/domain/market";
import type { PartnerType } from "@/lib/domain/partner";
import type { Job } from "@/lib/domain/types";
import { setConnectionStep } from "@/lib/services/handover";
import { FIELD, useInstallationRecord } from "./use-record";

/**
 * Grid connection and rebates after the install. The partner ticks off their
 * steps; RENUABL's are shown so everyone can see where it's up to.
 */
export function JobConnection({ job, partnerType }: { job: Job; partnerType: PartnerType }) {
  const { record, setRecord, backend } = useInstallationRecord(job.recordKey, job.reference);
  const [refs, setRefs] = useState<Partial<Record<ConnectionStepId, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const steps = connectionSteps({ solarVictoria: Boolean(job.solarVictoria) });
  const progress = record?.connection ?? {};

  async function toggle(id: ConnectionStepId) {
    if (!record) return;
    setProblem(null);
    const value = progress[id] ? null : { done: todayInMarket(), reference: refs[id]?.trim() || undefined };
    try {
      setRecord(await setConnectionStep(record, backend, id, value));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't save. Try again.");
    }
  }

  return (
    <div>
      <ol className="divide-y divide-line">
        {steps.map((s) => {
          const done = progress[s.id];
          const mine = s.owner[partnerType] === "partner";
          return (
            <li key={s.id} className="flex items-start gap-3 py-3">
              <button
                type="button"
                onClick={() => void toggle(s.id)}
                disabled={!mine || !record}
                aria-pressed={Boolean(done)}
                aria-label={done ? `Mark ${s.label} not done` : `Mark ${s.label} done`}
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                  done ? "border-positive bg-positive text-[#0d0f12]" : "border-line-strong",
                  !mine && !done && "border-dashed",
                )}
              >
                {done && <Check className="h-4 w-4" strokeWidth={2.5} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-medium">{s.label}</span>
                  {!mine && <Badge>RENUABL</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">{s.detail}</p>
                {done ? (
                  <p className="mt-1 text-[13px] text-ink-2">
                    Done {formatDate(done.done, { day: "numeric", month: "short" })}
                    {done.reference ? ` · ${done.reference}` : ""}
                  </p>
                ) : (
                  mine && (
                    <input
                      aria-label={`${s.label} reference`}
                      value={refs[s.id] ?? ""}
                      maxLength={40}
                      onChange={(e) => setRefs((r) => ({ ...r, [s.id]: e.target.value }))}
                      placeholder="Reference number (optional)"
                      className={cn(FIELD, "mt-2 py-2.5 text-[14px]")}
                    />
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {backend === "device" && (
        <p className="mt-2 text-[12px] text-warning">Storage isn&apos;t set up yet, so progress is saved on this device only.</p>
      )}
    </div>
  );
}
