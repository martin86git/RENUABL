/**
 * The Marketplace's waiting list, as the launch page reaches it (/api/design/marketplace-launch).
 */
import type { WaitlistRole } from "@/lib/domain/design/marketplace-launch";
import { ask } from "./crm";

const BASE = "/api/design/marketplace-launch";
export const loadWaitlist = () => ask<{ joined: boolean; signedIn: boolean; count: string | null }>(BASE);
export const joinWaitlist = (input: { roles: WaitlistRole[]; email?: string }) =>
  ask<{ joined: boolean }>(BASE, { method: "POST", body: input });
