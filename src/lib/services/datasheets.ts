/**
 * A business's product datasheets (Settings → Product datasheets): read one with Claude, keep the checked figures, and
 * the figures by product code for the designer. Signed out there are none (the designer uses RENUABL's own).
 */
import type { Datasheets, InverterForm, PanelForm, SavedSheet, SheetKind } from "@/lib/domain/design/datasheets";
import { ask } from "./crm";

export type SheetForm = { kind: SheetKind; model: string; panel: PanelForm; inverter: InverterForm };

export const loadDatasheets = () => ask<{ sheets: SavedSheet[]; datasheets: Datasheets }>("/api/design/datasheets");

/** Sends a datasheet to be read; nothing is kept. */
export async function readDatasheet(file: File): Promise<{ ok: true; form: SheetForm; fileName: string } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/design/datasheets/read", { method: "POST", body });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; form?: SheetForm; fileName?: string } | null;
    if (res.ok && json?.ok && json.form) return { ok: true, form: json.form, fileName: json.fileName ?? file.name };
    return { ok: false, message: json?.message ?? "That datasheet couldn't be read just now." };
  } catch {
    return { ok: false, message: "That datasheet couldn't be sent. Check your connection and try again." };
  }
}

export const saveDatasheet = (sheet: {
  kind: SheetKind;
  sku: string;
  model: string;
  fileName: string;
  panel?: PanelForm;
  inverter?: InverterForm;
}) => ask<{ sheets: SavedSheet[] }>("/api/design/datasheets", { method: "PUT", body: sheet });

export const deleteDatasheet = (kind: SheetKind, sku: string) =>
  ask<{ sheets: SavedSheet[] }>(`/api/design/datasheets?kind=${kind}&sku=${encodeURIComponent(sku)}`, { method: "DELETE" });

/** Keeps the sheet itself with a product's saved figures, so the team can open it again. */
export async function keepDatasheetFile(kind: SheetKind, sku: string, file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("kind", kind);
  body.append("sku", sku);
  body.append("file", file);
  try {
    const res = await fetch("/api/design/datasheets/file", { method: "POST", body });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    return res.ok && json?.ok ? { ok: true } : { ok: false, message: json?.message ?? "The sheet itself couldn't be kept." };
  } catch {
    return { ok: false, message: "The sheet itself couldn't be kept. Check your connection." };
  }
}

export const datasheetFileHref = (kind: SheetKind, sku: string) =>
  `/api/design/datasheets/file?kind=${kind}&sku=${encodeURIComponent(sku)}`;

/** Looks for a product's datasheet online now; its figures are kept unchecked (datasheet-finder.ts). */
export const findDatasheetOnline = (product: { kind: SheetKind; sku: string; name: string }) =>
  ask<{ message: string; datasheets: Datasheets }>("/api/design/datasheets", { method: "POST", body: { do: "find", ...product } });

/** A person has checked figures found online against the sheet. */
export const confirmDatasheet = (kind: SheetKind, sku: string) =>
  ask<{ sheets: SavedSheet[] }>("/api/design/datasheets", { method: "POST", body: { do: "confirm", kind, sku } });
