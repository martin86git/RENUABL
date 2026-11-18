/**
 * Price lists and prices from the quote builder's cart (18 Nov 2026, Martin): a supplier's list read from its file, or
 * prices set by hand, added to the business's workspace and saved, so every quote is costed with them.
 */
import { HAND_LIST, handFirst, withHandPrices } from "@/lib/domain/design/hand-prices";
import { readSupplierList, withSupplierList, type ListItem, type SupplierList, type Workspace } from "@/lib/domain/design/pricing";
import { todayInMarket } from "@/lib/domain/market";
import { saveWorkspace } from "./design-store";

/** One file read into a list on the server (nothing kept there), or why it couldn't be. */
export async function readPriceListFile(file: File): Promise<{ list: SupplierList } | { problem: string }> {
  try {
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/design/price-list", { method: "POST", body });
    const json = (await res.json()) as { ok: boolean; name?: string; rows?: string[][]; message?: string };
    if (!json.ok || !json.rows) return { problem: `${file.name}: ${json.message ?? "that file couldn't be read."}` };
    const list = readSupplierList(json.name ?? file.name, json.rows, todayInMarket());
    if (!list.items.length)
      return { problem: `${file.name}: no priced rows found. It needs a product code, a description and a price in its first columns.` };
    if (list.name === HAND_LIST) return { problem: `${file.name}: that name is kept for prices set by hand. Rename the file.` };
    return { list };
  } catch {
    return { problem: `${file.name}: we couldn't reach the server. Try again in a moment.` };
  }
}

/** The workspace with an uploaded list added and saved; the problem when the save was refused. */
export async function addPriceList(workspace: Workspace, list: SupplierList): Promise<{ workspace: Workspace; problem: string | null }> {
  const next = { ...workspace, lists: handFirst(withSupplierList(workspace.lists, list)) };
  return { workspace: next, problem: await saveWorkspace(next) };
}

/** The workspace with prices set by hand kept and saved; the problem when the save was refused. */
export async function setHandPrices(workspace: Workspace, prices: ListItem[]): Promise<{ workspace: Workspace; problem: string | null }> {
  const next = { ...workspace, lists: withHandPrices(workspace.lists, prices, todayInMarket()) };
  return { workspace: next, problem: await saveWorkspace(next) };
}
