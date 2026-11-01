/**
 * Server only. A business's checked product datasheets (domain/design/datasheets.ts). Under the designer's tenant
 * rule: the business id first in every function, only ever from the signed-in member. Only figures are kept.
 */
import type { Datasheets, SavedSheet, SheetKind } from "@/lib/domain/design/datasheets";
import type { InverterElectrical, PanelElectrical } from "@/lib/domain/design/electrical";
import { query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export async function listSheets(businessId: string): Promise<SavedSheet[]> {
  return query<SavedSheet>(
    `select kind, sku, model, figures, file_name as "fileName", checked_by as "checkedBy", ${moment("checked_at")} as "checkedAt",
            file_bytes is not null as "hasFile"
       from design_datasheets where business_id = $1 order by kind, sku`,
    [businessId],
  );
}

/** The figures by product code, as the designer uses them. */
export async function businessDatasheets(businessId: string): Promise<Datasheets> {
  const sheets: Datasheets = { panels: {}, inverters: {} };
  for (const s of await listSheets(businessId)) {
    if (s.kind === "panel") sheets.panels[s.sku] = s.figures as PanelElectrical;
    else sheets.inverters[s.sku] = s.figures as InverterElectrical;
  }
  return sheets;
}

/** Keeps a product's checked figures, replacing any it had. */
export async function saveSheet(
  businessId: string,
  sheet: { kind: SheetKind; sku: string; model: string; fileName: string; figures: PanelElectrical | InverterElectrical },
  by: string,
): Promise<void> {
  await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (business_id, kind, sku) do update set model = excluded.model, figures = excluded.figures,
       file_name = excluded.file_name, checked_by = excluded.checked_by, checked_at = now()`,
    [businessId, sheet.kind, sheet.sku, sheet.model, JSON.stringify(sheet.figures), sheet.fileName, by.toLowerCase()],
  );
}

/** Keeps the sheet's own file with a product's saved figures. False when the product has no figures saved. */
export async function putSheetFile(businessId: string, kind: SheetKind, sku: string, bytes: Buffer, type: string): Promise<boolean> {
  const rows = await query(
    `update design_datasheets set file_bytes = $4, file_type = $5 where business_id = $1 and kind = $2 and sku = $3 returning sku`,
    [businessId, kind, sku, bytes, type],
  );
  return rows.length > 0;
}

export async function sheetFile(
  businessId: string,
  kind: SheetKind,
  sku: string,
): Promise<{ fileName: string; type: string; bytes: Buffer } | null> {
  const rows = await query<{ fileName: string; type: string; bytes: Buffer }>(
    `select file_name as "fileName", file_type as type, file_bytes as bytes from design_datasheets
      where business_id = $1 and kind = $2 and sku = $3 and file_bytes is not null`,
    [businessId, kind, sku],
  );
  return rows[0] ?? null;
}

export async function deleteSheet(businessId: string, kind: SheetKind, sku: string): Promise<boolean> {
  const rows = await query(`delete from design_datasheets where business_id = $1 and kind = $2 and sku = $3 returning sku`, [
    businessId,
    kind,
    sku,
  ]);
  return rows.length > 0;
}
