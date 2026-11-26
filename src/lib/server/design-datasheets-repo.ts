/**
 * Server only. A business's checked product datasheets (domain/design/datasheets.ts). Under the designer's tenant
 * rule: the business id first in every function, only ever from the signed-in member. Only figures are kept.
 *
 * **Shared with every business (22 Nov 2026, Martin: "any datasheet downloaded by any user then becomes available to
 * all users").** A datasheet is a maker's public document, not a business's own data, so a product a business has no
 * sheet for reads another business's: its figures, its file, and whether a person has checked them. What is never
 * shared is whose it is: no business's name, no person's email (`SHARED_BY`, `sharedBasis`). A business only ever
 * writes its own rows; made-up businesses (demos and samples, owners on `.example`) share nothing.
 */
import {
  SHARED_BY,
  codeKey,
  sharedBasis,
  sharedFor,
  type Datasheets,
  type SavedSheet,
  type SheetKind,
} from "@/lib/domain/design/datasheets";
import type { InverterElectrical, PanelElectrical } from "@/lib/domain/design/electrical";
import type { DocKind } from "@/lib/domain/design/proposal-datasheets";
import { query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Where a shared sheet with no address of its own sends someone to check it. */
const SHARED_CHECK_PAGE = "/design/settings/datasheets";

/** Not a made-up business: a demo's or a sample's figures are never shared. */
const REAL_BUSINESS = `not exists (select 1 from business_members m
   where m.business_id = d.business_id and m.role = 'owner' and m.email like '%.example')`;

const dayWords = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });

/** Other businesses' sheets for the products this one has none of its own for, named for nobody. */
async function sharedSheets(businessId: string, own: readonly SavedSheet[]): Promise<SavedSheet[]> {
  const others = await query<SavedSheet>(
    `select d.kind, d.sku, d.model, d.figures, d.file_name as "fileName", ${moment("d.checked_at")} as "checkedAt",
            d.file_bytes is not null as "hasFile", d.found_url as "foundUrl", d.unchecked
       from design_datasheets d where d.business_id <> $1 and d.kind in ('panel', 'inverter') and ${REAL_BUSINESS}
      order by d.unchecked asc, d.checked_at desc limit 5000`,
    [businessId],
  );
  return sharedFor(own, others).map((s) => ({
    ...s,
    shared: true,
    // To check for every business it is shared with, until someone there confirms it (22 Nov 2026, Martin), whoever
    // checked it where it came from.
    checkedElsewhere: !s.unchecked,
    unchecked: true,
    checkedBy: SHARED_BY,
    figures: { ...s.figures, basis: sharedBasis(s.model, s.fileName, dayWords(s.checkedAt), Boolean(s.unchecked)) },
  }));
}

/** The business's own sheets, then those shared with it (`shared`), each kind by product code. */
export async function listSheets(businessId: string): Promise<SavedSheet[]> {
  const own = await ownSheets(businessId);
  const shared = await sharedSheets(businessId, own);
  return [...own, ...shared.sort((a, b) => a.kind.localeCompare(b.kind) || a.sku.localeCompare(b.sku))];
}

async function ownSheets(businessId: string): Promise<SavedSheet[]> {
  return query<SavedSheet>(
    `select kind, sku, model, figures, file_name as "fileName", checked_by as "checkedBy", ${moment("checked_at")} as "checkedAt",
            file_bytes is not null as "hasFile", found_url as "foundUrl", unchecked
       from design_datasheets where business_id = $1 and kind in ('panel', 'inverter') order by kind, sku`,
    [businessId],
  );
}

/** The figures by product code, as the designer uses them. */
export async function businessDatasheets(businessId: string): Promise<Datasheets> {
  const sheets: Datasheets = { panels: {}, inverters: {} };
  for (const s of await listSheets(businessId)) {
    // Figures found online and not yet checked carry where they came from, so the string check says so.
    const figures = s.unchecked ? { ...s.figures, unchecked: s.foundUrl ?? (s.shared ? SHARED_CHECK_PAGE : "found online") } : s.figures;
    if (s.kind === "panel") sheets.panels[s.sku] = figures as PanelElectrical;
    else sheets.inverters[s.sku] = figures as InverterElectrical;
  }
  return sheets;
}

/** Keeps a product's checked figures, replacing any it had (found ones included): a person has checked them. */
export async function saveSheet(
  businessId: string,
  sheet: { kind: SheetKind; sku: string; model: string; fileName: string; figures: PanelElectrical | InverterElectrical },
  by: string,
): Promise<void> {
  await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (business_id, kind, sku) do update set model = excluded.model, figures = excluded.figures,
       file_name = excluded.file_name, checked_by = excluded.checked_by, checked_at = now(), unchecked = false`,
    [businessId, sheet.kind, sheet.sku, sheet.model, JSON.stringify(sheet.figures), sheet.fileName, by.toLowerCase()],
  );
}

/** Keeps the sheet's own file with a product's saved figures. False when the product has no figures saved. */
export async function putSheetFile(businessId: string, kind: DocKind, sku: string, bytes: Buffer, type: string): Promise<boolean> {
  const rows = await query(
    `update design_datasheets set file_bytes = $4, file_type = $5 where business_id = $1 and kind = $2 and sku = $3 returning sku`,
    [businessId, kind, sku, bytes, type],
  );
  return rows.length > 0;
}

export async function sheetFile(
  businessId: string,
  kind: DocKind,
  sku: string,
): Promise<{ fileName: string; type: string; bytes: Buffer } | null> {
  // The business's own first, else the one shared with it (a checked one before one only found, then the newest).
  const rows = await query<{ fileName: string; type: string; bytes: Buffer }>(
    `select d.file_name as "fileName", d.file_type as type, d.file_bytes as bytes from design_datasheets d
      where d.kind = $2 and d.sku = $3 and d.file_bytes is not null and (d.business_id = $1 or ${REAL_BUSINESS})
      order by (d.business_id = $1) desc, d.unchecked asc, d.checked_at desc limit 1`,
    [businessId, kind, sku],
  );
  return rows[0] ?? null;
}

/**
 * A person in this business has checked a shared sheet's figures: it becomes the business's own, checked by them, with
 * the sheet's file. False when no sheet is shared for the product, or the business already has its own.
 */
export async function adoptSharedSheet(businessId: string, kind: DocKind, sku: string, by: string): Promise<boolean> {
  const rows = await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by, found_url, unchecked, file_bytes, file_type)
     select $1, d.kind, d.sku, d.model,
            jsonb_set(d.figures - 'unchecked', '{basis}', to_jsonb(coalesce(nullif(d.model, ''), 'Datasheet') || ' (' ||
              coalesce(nullif(d.file_name, ''), 'datasheet') || '), read and checked by ' || $5::text || ' on ' || $6::text)),
            d.file_name, $4, d.found_url, false, d.file_bytes, d.file_type
       from design_datasheets d where d.business_id <> $1 and d.kind = $2 and d.sku = $3 and ${REAL_BUSINESS}
      order by d.unchecked asc, d.checked_at desc limit 1
     on conflict (business_id, kind, sku) do nothing returning sku`,
    [businessId, kind, sku, by.toLowerCase(), by.toLowerCase().split("@")[0], dayWords(new Date().toISOString())],
  );
  return rows.length > 0;
}

/**
 * Keeps figures found online by themselves (unchecked), with the sheet when it fits; never over figures already kept,
 * so nothing a person has checked or typed is written over. False when the product already has figures.
 */
export async function saveFoundSheet(
  businessId: string,
  sheet: { kind: SheetKind; sku: string; model: string; fileName: string; figures: PanelElectrical | InverterElectrical; url: string },
  file: { bytes: Buffer; type: string } | null,
): Promise<boolean> {
  const rows = await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by, found_url, unchecked, file_bytes, file_type)
     values ($1,$2,$3,$4,$5,$6,'found online',$7,true,$8,$9)
     on conflict (business_id, kind, sku) do update set file_bytes = excluded.file_bytes, file_type = excluded.file_type,
       found_url = coalesce(design_datasheets.found_url, excluded.found_url)
       where design_datasheets.file_bytes is null and excluded.file_bytes is not null
     returning (xmax = 0) as inserted`,
    [
      businessId,
      sheet.kind,
      sheet.sku,
      sheet.model,
      JSON.stringify(sheet.figures),
      sheet.fileName,
      sheet.url,
      file?.bytes ?? null,
      file?.type ?? null,
    ],
  );
  // True only when its figures are new: a file put with figures already kept doesn't count as found.
  return Boolean((rows[0] as { inserted?: boolean } | undefined)?.inserted);
}

/**
 * Puts a sheet found online in place of what is kept for the product, at a member's word (8 Nov 2026, Martin: Sol swaps
 * a wrong sheet for him). Marked unchecked again with its address, so every string on it is to check until a person
 * confirms it.
 */
export async function replaceWithFoundSheet(
  businessId: string,
  sheet: {
    kind: SheetKind;
    sku: string;
    model: string;
    fileName: string;
    figures: PanelElectrical | InverterElectrical;
    url: string | null;
  },
  file: { bytes: Buffer; type: string } | null,
): Promise<void> {
  await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by, found_url, unchecked, file_bytes, file_type)
     values ($1,$2,$3,$4,$5,$6,$10,$7,true,$8,$9)
     on conflict (business_id, kind, sku) do update set model = excluded.model, figures = excluded.figures,
       file_name = excluded.file_name, checked_by = excluded.checked_by, checked_at = now(), found_url = excluded.found_url,
       unchecked = true, file_bytes = excluded.file_bytes, file_type = excluded.file_type`,
    [
      businessId,
      sheet.kind,
      sheet.sku,
      sheet.model,
      JSON.stringify(sheet.figures),
      sheet.fileName,
      sheet.url,
      file?.bytes ?? null,
      file?.type ?? null,
      "found online by Sol",
    ],
  );
}

/** A person confirms figures found online against the sheet: from then on they are checked. */
export async function confirmSheet(businessId: string, kind: DocKind, sku: string, by: string): Promise<boolean> {
  const rows = await query(
    `update design_datasheets set unchecked = false, checked_by = $4, checked_at = now()
      where business_id = $1 and kind = $2 and sku = $3 and unchecked returning sku`,
    [businessId, kind, sku, by.toLowerCase()],
  );
  return rows.length > 0;
}

export async function deleteSheet(businessId: string, kind: DocKind, sku: string): Promise<boolean> {
  const rows = await query(`delete from design_datasheets where business_id = $1 and kind = $2 and sku = $3 returning sku`, [
    businessId,
    kind,
    sku,
  ]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Datasheets as files alone, and the sheets that go with a proposal (26 Nov 2026, Martin)
// ---------------------------------------------------------------------------

/** A product code as `codeKey` compares it, worked out in SQL the same way. */
const KEY_SQL = (column: string) => `regexp_replace(regexp_replace(upper(${column}), '\\.0([A-Z])', '\\1', 'g'), '[\\s_-]+', '', 'g')`;

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

/** The business's own battery and EV charger sheets, then those shared with it, named for nobody. */
export async function listProductFiles(businessId: string): Promise<SavedFile[]> {
  const cols = `d.kind, d.sku, d.model, d.file_name as "fileName", d.checked_by as "checkedBy", ${moment("d.checked_at")} as "checkedAt",
                d.found_url as "foundUrl", d.unchecked`;
  const own = await query<SavedFile>(
    `select ${cols} from design_datasheets d where d.business_id = $1 and d.kind in ('battery', 'charger') and d.file_bytes is not null
      order by d.kind, d.sku`,
    [businessId],
  );
  const others = await query<SavedFile>(
    `select ${cols} from design_datasheets d where d.business_id <> $1 and d.kind in ('battery', 'charger') and d.file_bytes is not null
        and ${REAL_BUSINESS} order by d.unchecked asc, d.checked_at desc limit 2000`,
    [businessId],
  );
  const shared = sharedFor(own, others).map((s) => ({ ...s, shared: true, unchecked: true, checkedBy: SHARED_BY }));
  return [...own, ...shared];
}

/** Keeps a battery's or EV charger's sheet a person uploaded, in place of any it had. */
export async function saveProductFile(
  businessId: string,
  sheet: { kind: DocKind; sku: string; model: string; fileName: string },
  file: { bytes: Buffer; type: string },
  by: string,
  found: string | null = null,
): Promise<void> {
  await query(
    `insert into design_datasheets (business_id, kind, sku, model, figures, file_name, checked_by, found_url, unchecked, file_bytes, file_type)
     values ($1,$2,$3,$4,'{}'::jsonb,$5,$6,$7,$8,$9,$10)
     on conflict (business_id, kind, sku) do update set model = excluded.model, file_name = excluded.file_name,
       checked_by = excluded.checked_by, checked_at = now(), found_url = excluded.found_url, unchecked = excluded.unchecked,
       file_bytes = excluded.file_bytes, file_type = excluded.file_type`,
    [
      businessId,
      sheet.kind,
      sheet.sku,
      sheet.model,
      sheet.fileName,
      found ? "found online" : by.toLowerCase(),
      found,
      Boolean(found),
      file.bytes,
      file.type,
    ],
  );
}

/**
 * Which of these products have a sheet on hand for this business (its own, else one shared with it), by
 * `kind:codeKey`, and whether that sheet is still to check.
 */
export async function sheetsOnHand(
  businessId: string,
  products: readonly { kind: DocKind; sku: string }[],
): Promise<Map<string, { unchecked: boolean }>> {
  const out = new Map<string, { unchecked: boolean }>();
  if (!products.length) return out;
  const rows = await query<{ kind: DocKind; key: string; unchecked: boolean; own: boolean }>(
    `select d.kind, ${KEY_SQL("d.sku")} as key, d.unchecked, d.business_id = $1 as own from design_datasheets d
      where d.file_bytes is not null and d.kind = any($2) and ${KEY_SQL("d.sku")} = any($3)
        and (d.business_id = $1 or ${REAL_BUSINESS})
      order by (d.business_id = $1) desc, d.unchecked asc`,
    [businessId, [...new Set(products.map((p) => p.kind))], [...new Set(products.map((p) => codeKey(p.sku)))]],
  );
  for (const r of rows) {
    const k = `${r.kind}:${r.key}`;
    // Someone else's sheet is to check here until this business confirms it.
    if (!out.has(k)) out.set(k, { unchecked: r.unchecked || !r.own });
  }
  return out;
}

/** A product's sheet file by its code as `codeKey` compares it: the business's own first, else one shared with it. */
export async function sheetFileByKey(
  businessId: string,
  kind: DocKind,
  sku: string,
): Promise<{ fileName: string; type: string; bytes: Buffer } | null> {
  const rows = await query<{ fileName: string; type: string; bytes: Buffer }>(
    `select d.file_name as "fileName", d.file_type as type, d.file_bytes as bytes from design_datasheets d
      where d.kind = $2 and ${KEY_SQL("d.sku")} = $3 and d.file_bytes is not null and (d.business_id = $1 or ${REAL_BUSINESS})
      order by (d.business_id = $1) desc, d.unchecked asc, d.checked_at desc limit 1`,
    [businessId, kind, codeKey(sku)],
  );
  return rows[0] ?? null;
}
