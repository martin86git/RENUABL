"use client";

import { useCallback, useEffect, useState } from "react";
import { networkOf, preApprovalAsked, withPreApprovalRequest } from "@/lib/domain/design/approvals";
import type { Customer, Job } from "@/lib/domain/design/crm";
import { addActivity, loadJob, saveJob } from "./crm";

/** What Sol's card in the designer is told about the deal's network (sol-nudges.ts `NudgeState.network`). */
export interface DealNetwork {
  name: string | null;
  guessed: boolean;
  preApproval: string | null;
  mayRequest: boolean;
}

/**
 * The network of the deal a design is on, and a way to ask for its pre-approval from the designer (19 Nov 2026, Martin).
 * Asking marks the deal's pre-approval Requested, fills in its distributor when none was typed, notes it on the deal's
 * record, and so files it in Pre-approvals; nothing is sent to the network.
 */
export function useDealNetwork(jobId: string | undefined) {
  const [deal, setDeal] = useState<{ job: Job; customer: Customer } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    void loadJob(jobId).then((res) => live && res.ok && setDeal({ job: res.job, customer: res.customer }));
    return () => {
      live = false;
    };
  }, [jobId]);

  const net = deal ? networkOf(deal.job) : null;
  const network: DealNetwork | undefined = deal
    ? {
        name: net?.name ?? null,
        guessed: net?.guessed ?? false,
        preApproval: deal.job.details.preApproval ?? null,
        mayRequest: !preApprovalAsked(deal.job),
      }
    : undefined;

  /** Asks for the pre-approval; answers what to say when it couldn't. */
  const request = useCallback(
    async (kw: number): Promise<string | null> => {
      if (!deal) return "The deal isn't loaded yet.";
      const details = withPreApprovalRequest(deal.job);
      if (!details) return null;
      const res = await saveJob(deal.job.id, { details });
      if (!res.ok) return res.message;
      setDeal({ job: res.job, customer: deal.customer });
      const to = networkOf(res.job)?.name;
      void addActivity(deal.customer.id, {
        kind: "note",
        jobId: deal.job.id,
        text: `Network pre-approval requested from the designer${to ? ` (${to})` : ""}: ${kw.toFixed(2)} kW of panels on single phase. It waits in Pre-approvals to be submitted.`,
      });
      window.dispatchEvent(new Event("renuabl:approvals"));
      return null;
    },
    [deal],
  );

  return { network, request };
}
