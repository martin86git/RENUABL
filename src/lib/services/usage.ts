/** A business's usage this month (domain/design/usage.ts), as the browser asks for it. */
import type { Meter, SolDayRow } from "@/lib/domain/design/usage";

export type MeterNow = Meter & { percent: number };

export interface UsageState {
  today: string;
  month: string;
  ends: string;
  daysLeft: number;
  meters: MeterNow[];
  solBought: number;
  voice: { on: boolean; capCents: number; charged: boolean; days: { day: string; minutes: number; texts: number }[] };
  solDays: SolDayRow[];
  designCredits: number;
  owner: boolean;
}

export async function loadUsage(): Promise<UsageState | { error: string }> {
  try {
    const res = await fetch("/api/design/usage", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & Partial<UsageState>;
    if (!res.ok || !json.ok) return { error: json.message ?? "Usage couldn't be read just now." };
    return json as UsageState;
  } catch {
    return { error: "We couldn't reach RENUABL just now. Check your connection and try again." };
  }
}

/** The meters alone, for the settings menu; null when this person may not see usage. */
export async function loadUsageBrief(): Promise<MeterNow[] | null> {
  try {
    const res = await fetch("/api/design/usage?brief=1", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; meters?: MeterNow[] };
    return json.ok ? (json.meters ?? []) : null;
  } catch {
    return null;
  }
}
