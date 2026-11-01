/**
 * The directory and connections, as the screens reach them (/api/design/connections).
 */
import type { BusinessKind } from "@/lib/domain/design/business-kind";
import type { DirectoryEntry, KindFilter, Listing, Standing } from "@/lib/domain/design/connections";
import type { ConnectionLine } from "@/lib/server/design-connections-repo";
import { ask } from "./crm";

export type { ConnectionLine };
export type Connections = { listing: Listing; connections: ConnectionLine[]; kind: BusinessKind };

const BASE = "/api/design/connections";
export const loadConnections = () => ask<Connections>(BASE);
export const connectionAction = (body: Record<string, unknown>) => ask<Connections>(BASE, { method: "POST", body });
export const searchDirectory = (q: string, kind: KindFilter) =>
  ask<{ results: (DirectoryEntry & { standing: Standing })[] }>(`${BASE}?q=${encodeURIComponent(q)}&kind=${kind}`);
export const incomingRequests = () => ask<{ incoming: number }>(`${BASE}?count=1`);
