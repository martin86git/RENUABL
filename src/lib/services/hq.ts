/** RENUABL admin for staff (domain/design/hq.ts): what it shows, and answering a business's support ticket. */
import type { HqLead } from "@/lib/domain/design/hq";
import type { DesignBusinessRow } from "@/lib/server/design-admin-repo";
import type { StaffTicket } from "@/lib/server/design-support";
import { ask } from "./crm";

export type HqView = { leads: HqLead[]; tickets: StaffTicket[]; businesses: DesignBusinessRow[] };

export const loadHq = () => ask<HqView>("/api/design/hq");

export const answerTicket = (
  body: { id: string; do: "reply"; text: string; resolve?: boolean } | { id: string; do: "resolve" | "reopen" },
) => ask<{ emailed?: boolean }>("/api/design/hq", { method: "POST", body });
