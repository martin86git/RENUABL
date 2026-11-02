/**
 * The Marketplace's job listings, as the screens reach them (/api/design/marketplace).
 */
import type { Listing } from "@/lib/domain/design/marketplace";
import type { ListingDetail } from "@/lib/server/design-marketplace-repo";
import { ask } from "./crm";

export type { ListingDetail };

const BASE = "/api/design/marketplace";
export const loadListings = () => ask<{ listings: Listing[]; base: { lat: number; lng: number } | null }>(BASE);
export const createListing = (input: { jobId: string; notes: string; from: string; to: string; guide: string; openFor: number }) =>
  ask<{ id: string }>(BASE, { method: "POST", body: input });
export const loadListing = (id: string) => ask<ListingDetail>(`${BASE}/${encodeURIComponent(id)}`);
export const listingAction = (id: string, body: Record<string, unknown>) =>
  ask<ListingDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: "POST", body });
export const marketplacePath = (id: string) => `/design/marketplace/${encodeURIComponent(id)}`;
export const listingPicturePath = (id: string) => `${BASE}/${encodeURIComponent(id)}/picture`;

/** Where the business works from, for distances (/api/design/base; the Job map's base). */
export const saveBase = (base: import("@/lib/domain/design/job-map").Place | null) =>
  ask<{ base: import("@/lib/domain/design/job-map").Place | null }>("/api/design/base", { method: "PUT", body: { base } });
