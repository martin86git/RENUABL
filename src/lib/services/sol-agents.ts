/**
 * Sol's sales agents (domain/design/sol-agents.ts), as the screens ask for them: the outbox, its settings, and what can
 * be done to one email in it.
 */
import type { AgentSettings, AgentStage, OutboxState } from "@/lib/domain/design/sol-agents";
import type { PreparedItem } from "@/lib/domain/design/prepared";
import { ask } from "./crm";

export interface OutboxEntry extends PreparedItem {
  stage: AgentStage | null;
  firesAt: string;
  state: OutboxState;
  held: boolean;
}

export interface Outbox {
  settings: AgentSettings;
  entries: OutboxEntry[];
  needsYou: { jobId: string; customer: string; title: string; stage: AgentStage | null; last: string; at: string }[];
  sent: { id: string; jobId: string; customer: string; subject: string; stage: AgentStage | null; at: string }[];
  canSend: boolean;
  owner: boolean;
}

export const loadOutbox = () => ask<Outbox>("/api/design/sol-agents");

export const saveAgentSettings = (settings: AgentSettings) =>
  ask<{ settings: AgentSettings }>("/api/design/sol-agents", { method: "PUT", body: { settings } });

export const actOnOutbox = (id: string, act: "send" | "hold" | "release" | "skip") =>
  ask<{ message?: string }>("/api/design/sol-agents", { method: "POST", body: { id, do: act } });

export const putOffOutbox = (id: string, when: "hour" | "tomorrow") =>
  ask<object>("/api/design/sol-agents", { method: "POST", body: { id, do: "later", when } });

export const editOutbox = (id: string, words: { subject: string; body: string }) =>
  ask<object>("/api/design/sol-agents", { method: "POST", body: { id, do: "edit", ...words } });
