/** Server only. Imported supplier prices: each upload (kept as a history) and the prices in use. */
import type { PriceChange } from "@/lib/domain/price-import";
import { newId, query } from "./db";

export interface PriceUpload {
  id: string;
  supplier: string;
  filename: string;
  uploadedBy: string;
  uploadedAt: string;
  status: "pending" | "applied" | "discarded";
  changes: PriceChange[];
  unchanged: number;
  notInFile: number;
  decidedBy: string | null;
  decidedAt: string | null;
}

interface UploadRow {
  id: string;
  supplier: string;
  filename: string;
  uploaded_by: string;
  uploaded_at: Date | string;
  status: PriceUpload["status"];
  changes: PriceChange[];
  unchanged: number;
  not_in_file: number;
  decided_by: string | null;
  decided_at: Date | string | null;
}

const toUpload = (r: UploadRow): PriceUpload => ({
  id: r.id,
  supplier: r.supplier,
  filename: r.filename,
  uploadedBy: r.uploaded_by,
  uploadedAt: new Date(r.uploaded_at).toISOString(),
  status: r.status,
  changes: r.changes,
  unchanged: r.unchanged,
  notInFile: r.not_in_file,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
});

/** Saves an upload waiting for a staff member to confirm it. */
export async function savePriceUpload(u: {
  supplier: string;
  filename: string;
  uploadedBy: string;
  changes: PriceChange[];
  unchanged: number;
  notInFile: number;
}): Promise<PriceUpload> {
  const rows = await query<UploadRow>(
    `insert into price_uploads (id, supplier, filename, uploaded_by, changes, unchanged, not_in_file)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [newId("pu"), u.supplier, u.filename, u.uploadedBy, JSON.stringify(u.changes), u.unchanged, u.notInFile],
  );
  return toUpload(rows[0]);
}

/** Applies (or discards) a pending upload. Applying makes its prices the ones in use. */
export async function decidePriceUpload(id: string, apply: boolean, by: string): Promise<PriceUpload | null> {
  const rows = await query<UploadRow>(
    `update price_uploads set status = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'pending' returning *`,
    [id, apply ? "applied" : "discarded", by],
  );
  const upload = rows[0] ? toUpload(rows[0]) : null;
  if (upload && apply) {
    for (const c of upload.changes) {
      await query(
        `insert into price_overrides (sku, cost, upload_id) values ($1, $2, $3)
         on conflict (sku) do update set cost = excluded.cost, upload_id = excluded.upload_id, updated_at = now()`,
        [c.sku, c.newCost, upload.id],
      );
    }
  }
  return upload;
}

export async function listPriceUploads(limit = 30): Promise<PriceUpload[]> {
  return (await query<UploadRow>(`select * from price_uploads order by uploaded_at desc limit $1`, [limit])).map(toUpload);
}

/** The imported prices in use, by SKU (supplier cost ex GST). */
export async function currentPrices(): Promise<{ costs: Record<string, number>; updatedAt: string | null }> {
  const rows = await query<{ sku: string; cost: string; updated_at: Date | string }>(`select sku, cost, updated_at from price_overrides`);
  const costs: Record<string, number> = {};
  let latest: number | null = null;
  for (const r of rows) {
    costs[r.sku] = Number(r.cost);
    const t = new Date(r.updated_at).getTime();
    if (latest === null || t > latest) latest = t;
  }
  return { costs, updatedAt: latest ? new Date(latest).toISOString() : null };
}
