/**
 * A business's product datasheets (Settings → Product datasheets): read one with Claude, keep the checked figures, and
 * the figures by product code for the designer. Signed out there are none (the designer uses RENUABL's own).
 */
import type { Datasheets, InverterForm, PanelForm, SavedSheet, SheetKind } from "@/lib/domain/design/datasheets";
import type { DocKind } from "@/lib/domain/design/proposal-datasheets";
import type { FindResult } from "@/lib/domain/design/find-all-sheets";
import { ask } from "./crm";

export type SheetForm = { kind: SheetKind; model: string; panel: PanelForm; inverter: InverterForm };

/** A battery's or EV charger's datasheet: a file, with no figures. */
export interface SavedFile {
  kind: DocKind;
  sku: string;
  model: string;
  fileName: string;
  checkedBy: string;
  checkedAt: string;
  foundUrl: string | null;
  unchecked: boolean;
  shared?: boolean;
}

export const loadDatasheets = () => ask<{ sheets: SavedSheet[]; datasheets: Datasheets; files?: SavedFile[] }>("/api/design/datasheets");

/** Keeps a battery's or EV charger's datasheet as a file alone (26 Nov 2026), in place of any it had. */
export async function keepProductFile(
  kind: DocKind,
  sku: string,
  model: string,
  file: File,
): Promise<{ ok: true; files: SavedFile[] } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("kind", kind);
  body.append("sku", sku);
  body.append("model", model);
  body.append("file", file);
  try {
    const res = await fetch("/api/design/datasheets/file", { method: "POST", body });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; files?: SavedFile[] } | null;
    return res.ok && json?.ok
      ? { ok: true, files: json.files ?? [] }
      : { ok: false, message: json?.message ?? "The sheet couldn't be kept." };
  } catch {
    return { ok: false, message: "The sheet couldn't be kept. Check your connection." };
  }
}

/** Looks online for each of a proposal's quoted products with no sheet on hand (up to six); how many were found. */
export const findQuotedOnline = (products: readonly { kind: DocKind; sku: string; name: string }[]) =>
  ask<{ found: number }>("/api/design/datasheets", { method: "POST", body: { do: "find-quoted", products } });

export const deleteProductFile = (kind: DocKind, sku: string) =>
  ask<{ files: SavedFile[] }>(`/api/design/datasheets?kind=${kind}&sku=${encodeURIComponent(sku)}`, { method: "DELETE" });

export const productFileHref = (kind: DocKind, sku: string) => `/api/design/datasheets/file?kind=${kind}&sku=${encodeURIComponent(sku)}`;

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
export const confirmDatasheet = (kind: DocKind, sku: string) =>
  ask<{ sheets: SavedSheet[] }>("/api/design/datasheets", { method: "POST", body: { do: "confirm", kind, sku } });

/** Looks online for a couple of the price lists' products with no sheet on hand; each one's outcome (Settings' Find every datasheet). */
export const findSheetBatch = (products: readonly { kind: DocKind; sku: string; name: string; swap?: boolean }[]) =>
  ask<{ results: { kind: DocKind; sku: string; outcome: FindResult }[] }>("/api/design/datasheets", {
    method: "POST",
    body: { do: "find-batch", products },
  });
