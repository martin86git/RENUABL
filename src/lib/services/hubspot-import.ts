"use client";

import type {
  EngagementType,
  FieldTarget,
  HsListed,
  HsOutcome,
  HsPipeline,
  HsProperty,
  HubSpotMap,
} from "@/lib/domain/design/hubspot-import";
import { ask } from "./crm";

export interface HubSpotLookView {
  pipelines: HsPipeline[];
  properties: HsProperty[];
  targets: FieldTarget[];
  guess: HubSpotMap;
  deals: HsListed[];
  already: string[];
  more: boolean;
  unread: EngagementType[];
}

/** Checks a HubSpot token and reads what is needed to match stages and fields, with every deal listed. */
export const lookAtHubSpot = (key: string) => ask<HubSpotLookView>("/api/design/hubspot", { method: "POST", body: { do: "look", key } });

/** Brings a few HubSpot deals across by the business's match. */
export const bringFromHubSpot = (key: string, ids: string[], map: HubSpotMap) =>
  ask<{ results: HsOutcome[]; unread: EngagementType[] }>("/api/design/hubspot", { method: "POST", body: { do: "bring", key, ids, map } });
