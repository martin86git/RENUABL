/**
 * Server only. The business's agents in one place (domain/design/agents.ts): which kinds it has made, and what each
 * needs to work, read from what is set up. Tenant rule as everywhere: business id first.
 */
import type { AgentKind, AgentStatus } from "@/lib/domain/design/agents";
import { dbConfigured, query } from "./db";
import { callerOf } from "./design-caller-repo";
import { colleagueOf, colleagueReady } from "./design-colleague";
import { colleagueChatOn } from "./design-colleague-chat";
import { voiceOnFor } from "./voice-calls";

export interface AgentLine {
  kind: AgentKind;
  /** Its name, once it has one. */
  name: string | null;
  made: boolean;
}

export async function agentsOf(businessId: string): Promise<{ status: AgentStatus; agents: AgentLine[] }> {
  const [sales, admin, colleague, colleagueRow, callsOn, ready, chat] = await Promise.all([
    callerOf(businessId, "sales"),
    callerOf(businessId, "admin"),
    colleagueOf(businessId),
    dbConfigured() ? query(`select 1 from design_colleague where business_id = $1`, [businessId]) : Promise.resolve([]),
    voiceOnFor(businessId).catch(() => false),
    colleagueReady(businessId).catch(() => ({ on: false, web: false, teamNumber: null })),
    colleagueChatOn(businessId).catch(() => false),
  ]);
  const made = { sales: sales.named, admin: admin.named, colleague: colleagueRow.length > 0 };
  return {
    status: { callsOn, browserCalls: ready.web, teamLine: Boolean(ready.teamNumber), chat, made },
    agents: [
      { kind: "sales", name: sales.named ? sales.name : null, made: made.sales },
      { kind: "admin", name: admin.named ? admin.name : null, made: made.admin },
      { kind: "colleague", name: colleague.name, made: made.colleague },
    ],
  };
}
