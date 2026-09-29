import { catalogueEntries, matchPrices, parseCsv } from "@/lib/domain/price-import";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { currentPrices, savePriceUpload } from "@/lib/server/prices-repo";
import { readXlsxRows } from "@/lib/server/xlsx";

export const maxDuration = 30;

/**
 * POST (staff): a supplier price list (multipart "file", .xlsx or .csv, and
 * "supplier"). Matched to our products by SKU against the prices in use, and
 * saved as a pending upload for staff to confirm. Nothing changes yet.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false, message: "The database isn't set up." }, { status: 503 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "Please choose a price list file." }, { status: 400 });
  }
  const file = form.get("file");
  const supplier = String(form.get("supplier") ?? "")
    .replace(/[^\w &.'-]/g, "")
    .trim()
    .slice(0, 60);
  if (!(file instanceof File) || file.size === 0)
    return Response.json({ ok: false, message: "Please choose a price list file." }, { status: 400 });
  if (file.size > 10_000_000) return Response.json({ ok: false, message: "That file is too large (10 MB at most)." }, { status: 413 });
  if (!supplier) return Response.json({ ok: false, message: "Please say which supplier it's from." }, { status: 422 });

  const name = file.name.toLowerCase();
  let rows: string[][];
  try {
    if (name.endsWith(".xlsx")) rows = readXlsxRows(await file.arrayBuffer());
    else if (name.endsWith(".csv") || name.endsWith(".txt")) rows = parseCsv(await file.text());
    else return Response.json({ ok: false, message: "Please upload an Excel (.xlsx) or CSV file." }, { status: 415 });
  } catch {
    return Response.json({ ok: false, message: "We couldn't read that file. Try saving it as .xlsx or .csv." }, { status: 422 });
  }

  const inUse = (await currentPrices()).costs;
  const entries = catalogueEntries().map((e) => ({ ...e, cost: inUse[e.sku] ?? e.cost }));
  const match = matchPrices(rows, entries);
  if (match.changes.length === 0 && match.unchanged === 0) {
    return Response.json(
      { ok: false, message: "None of our products (by SKU) are in that file. Check it's the right price list." },
      { status: 422 },
    );
  }
  const upload = await savePriceUpload({
    supplier,
    filename: file.name.slice(0, 120),
    uploadedBy: session.email,
    changes: match.changes,
    unchanged: match.unchanged,
    notInFile: match.notInFile.length,
  });
  return Response.json({ ok: true, upload, notInFile: match.notInFile.map((e) => ({ sku: e.sku, name: e.name })) });
}
