"use client";
/** STC changes for the screens (domain/design/stc-change.ts): the notice, putting it away, applying it, and the rules. */
import type { StcNotice } from "@/lib/domain/design/stc-change";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import { ask } from "./crm";

const PATH = "/api/design/stc";

/** `later`: the person put it away for now, so Today keeps it as a lightbulb on Sol's box. */
export const loadStcNotice = () => ask<{ notice: StcNotice | null; later: boolean }>(PATH);
export const stcLater = () => ask<{ notice: StcNotice | null; later: boolean }>(PATH, { method: "POST", body: { do: "later" } });
export const stcApply = () =>
  ask<{ stcFrom: string; notice: StcNotice | null; later: boolean }>(PATH, { method: "POST", body: { do: "apply" } });

/** Today's rebate rules, the hand-checked ones when they can't be had. */
export async function loadRebateRates(): Promise<RebateRates> {
  try {
    const res = await fetch("/api/rebates");
    const json = (res.ok ? await res.json() : null) as { rates?: RebateRates } | null;
    return json?.rates?.stc ? json.rates : VERIFIED_RATES;
  } catch {
    return VERIFIED_RATES;
  }
}
