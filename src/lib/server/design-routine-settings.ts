/**
 * A business's routines, as one row of settings (`design_sol_agents`, business id first): which of Sol's agents send
 * themselves and when, the follow-up days, how long an email waits to be read, and how often a voice agent rings a
 * new lead (domain/design/sol-agents.ts). Kept apart from the outbox so the drafting, the calls and the lists can read
 * it without reaching into each other.
 */
import { cleanAgentSettings, type AgentSettings } from "@/lib/domain/design/sol-agents";
import { query } from "./db";

export async function agentSettings(businessId: string): Promise<AgentSettings> {
  const rows = await query<{ settings: unknown }>(`select settings from design_sol_agents where business_id = $1`, [businessId]);
  return cleanAgentSettings(rows[0]?.settings);
}

export async function saveAgentSettings(businessId: string, settings: AgentSettings, by: string): Promise<AgentSettings> {
  const clean = cleanAgentSettings(settings);
  await query(
    `insert into design_sol_agents (business_id, settings, updated_by) values ($1, $2::jsonb, $3)
     on conflict (business_id) do update set settings = excluded.settings, updated_at = now(), updated_by = excluded.updated_by`,
    [businessId, JSON.stringify(clean), by.toLowerCase()],
  );
  return clean;
}
