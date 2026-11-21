"use client";

import type { ImportMode, ImportOutcome, ImportRow } from "@/lib/domain/design/crm-import";
import { ask } from "./crm";

/** An Excel sheet's rows, read on the server (nothing kept). A CSV is read in the browser. */
export const readImportSheet = (file: File) => {
  const form = new FormData();
  form.set("file", file);
  return ask<{ rows: string[][] }>("/api/design/crm-import", { method: "POST", body: form });
};

/** Brings a batch of a sheet's rows in as customers and, in deals mode, deals. */
export const bringSheetRows = (rows: ImportRow[], mode: ImportMode, sheet: string) =>
  ask<{ results: ImportOutcome[] }>("/api/design/crm-import", { method: "POST", body: { rows, mode, sheet } });
