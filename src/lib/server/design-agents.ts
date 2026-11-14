/**
 * Server only. The business's agents in one place (domain/design/agents.ts): which kinds it has made, and what each
 * needs to work, read from what is set up. Tenant rule as everywhere: business id first.
 */
import type { AgentKind, AgentStatus } from "@/lib/domain/design/agents";
import { dbConfigured, query } from "./db";
import { nextSalesKey, type CallerKey } from "@/lib/domain/install-call";
import { callerOf, moreSalesAgents } from "./design-caller-repo";
import { colleagueOf } from "./design-colleague";
import { colleagueChatOn } from "./design-colleague-chat";
import { voiceOnFor } from "./voice-calls";

export interface AgentLine {
  kind: AgentKind;
  /** A voice agent's key (install-call.ts): which sales agent it is. */
  key?: CallerKey;
  /** Its name, once it has one. */
  name: string | null;
  made: boolean;
}

export async function agentsOf(businessId: string): Promise<{ status: AgentStatus; agents: AgentLine[]; nextSales: CallerKey | null }> {
  const [sales, admin, more, colleague, colleagueRow, callsOn, chat] = await Promise.all([
    callerOf(businessId, "sales"),
    callerOf(businessId, "admin"),
    moreSalesAgents(businessId),
    colleagueOf(businessId),
    dbConfigured() ? query(`select 1 from design_colleague where business_id = $1`, [businessId]) : Promise.resolve([]),
    voiceOnFor(businessId).catch(() => false),
    colleagueChatOn(businessId).catch(() => false),
  ]);
  const made = { sales: sales.named, admin: admin.named, colleague: colleagueRow.length > 0 };
  // The key a new sales agent takes: the first until it is made, then the next one free.
  const nextSales = nextSalesKey([...(sales.named ? ["sales"] : []), ...more.map((m) => m.role)]);
  return {
    status: { callsOn, chat, made, moreSales: made.sales && nextSales !== null },
    nextSales,
    agents: [
      { kind: "sales", key: "sales", name: sales.named ? sales.name : null, made: made.sales },
      ...more.map((m) => ({ kind: "sales" as const, key: m.role, name: m.name, made: true })),
      { kind: "admin", key: "admin", name: admin.named ? admin.name : null, made: made.admin },
      { kind: "colleague", name: colleague.name, made: made.colleague },
    ],
  };
}
