/**
 * The Marketplace's equipment trading, as the screens reach it (/api/design/trade).
 */
import type { ItemState, TradeItem } from "@/lib/domain/design/trade";
import type { ItemDetail } from "@/lib/server/design-trade-repo";
import { ask, type Answer } from "./crm";
import { prepareBillFile } from "./consumer";

export type { ItemDetail };

const BASE = "/api/design/trade";
export const loadItems = () => ask<{ items: TradeItem[]; base: { lat: number; lng: number } | null }>(BASE);
export const tradeUnreadCount = () => ask<{ unread: number }>(`${BASE}?count=1`);
export const createItem = (body: Record<string, unknown>) => ask<{ id: string }>(BASE, { method: "POST", body });
export const loadItem = (id: string, read?: string) =>
  ask<ItemDetail>(`${BASE}/${encodeURIComponent(id)}${read ? `?read=${encodeURIComponent(read)}` : ""}`);
export const setItemStatus = (id: string, status: ItemState) =>
  ask<ItemDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body: { status } });
export const messageItem = (id: string, text: string, thread?: string) =>
  ask<ItemDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: "POST", body: { text, ...(thread ? { thread } : {}) } });
export const removeItemPhoto = (id: string, photo: string) =>
  ask<ItemDetail>(`${BASE}/${encodeURIComponent(id)}/photos?photo=${encodeURIComponent(photo)}`, { method: "DELETE" });
export const tradePhotoSrc = (photoId: string) => `${BASE}/photos/${encodeURIComponent(photoId)}`;
export const itemPath = (id: string) => `/design/marketplace/equipment/${encodeURIComponent(id)}`;

/** Photos for an item, each made smaller in the browser first, then redrawn on the server. */
export async function addItemPhotos(id: string, files: File[]): Promise<Answer<ItemDetail>> {
  const form = new FormData();
  for (const f of files) form.append("files", await prepareBillFile(f, 1_500_000));
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/photos`, { method: "POST", body: form, cache: "no-store" });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; message?: string } & Partial<ItemDetail>) | null;
    if (res.ok && json?.ok && json.item) return { ok: true, item: json.item, conversations: json.conversations ?? [] };
    return { ok: false, message: json?.message ?? "Those photos didn't go up. Try again." };
  } catch {
    return { ok: false, message: "Those photos didn't go up. Check your connection and try again." };
  }
}
