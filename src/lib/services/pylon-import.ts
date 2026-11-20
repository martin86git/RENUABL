"use client";

import type { PylonCsvRow, PylonListed, PylonOutcome, PylonStage } from "@/lib/domain/design/pylon-import";
import { ask } from "./crm";

/** Checks a Pylon key and lists every sold project, with those already brought in. */
export const checkPylon = (key: string) =>
  ask<{ projects: PylonListed[]; already: string[]; more: boolean }>("/api/design/pylon", { method: "POST", body: { do: "check", key } });

/** Brings a few sold projects across as customers and deals. */
export const bringFromPylon = (key: string, ids: string[], stage: PylonStage) =>
  ask<{ results: PylonOutcome[] }>("/api/design/pylon", { method: "POST", body: { do: "bring", key, ids, stage } });

/** Which of the export's sold projects this business already has. */
export const checkPylonCsv = (ids: string[]) =>
  ask<{ already: string[] }>("/api/design/pylon", { method: "POST", body: { do: "csv-check", ids } });

/** Brings a batch of the export's sold rows in as customers and deals. */
export const bringCsvRows = (rows: PylonCsvRow[], wonWeeks: number) =>
  ask<{ results: PylonOutcome[] }>("/api/design/pylon", { method: "POST", body: { do: "csv", rows, wonWeeks } });
