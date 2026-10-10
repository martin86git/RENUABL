import { allow } from "@/lib/server/rate-limit";
import { readXlsxRows } from "@/lib/server/xlsx";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 6000;

/** Splits one line of a CSV file, minding quoted cells. */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/**
 * POST a price list (Excel .xlsx or .csv) and get back its rows as text, first four columns. Nothing is kept
 * here: the file is read and forgotten, and the designer keeps what it reads from the rows.
 */
export async function POST(request: Request) {
  if (!allow(request, "design-price-list", 30))
    return Response.json({ ok: false, message: "Too many uploads. Try again later." }, { status: 429 });
  let file: File | null = null;
  try {
    const entry = (await request.formData()).get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    // Falls through to the message below.
  }
  if (!file) return Response.json({ ok: false, message: "Choose a price list to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, message: "That file is over 8 MB." }, { status: 413 });
  try {
    const data = Buffer.from(await file.arrayBuffer());
    const rows = /\.csv$/i.test(file.name) ? data.toString("utf8").split(/\r?\n/).map(csvCells) : readXlsxRows(data);
    const kept = rows
      .map((r) => r.slice(0, 4).map((cell) => (cell ?? "").trim().slice(0, 240)))
      .filter((r) => r.some(Boolean))
      .slice(0, MAX_ROWS);
    if (!kept.length) return Response.json({ ok: false, message: "We couldn't find any rows in that file." }, { status: 422 });
    return Response.json({ ok: true, name: file.name.slice(0, 120), rows: kept });
  } catch {
    return Response.json({ ok: false, message: "That file couldn't be read. Upload an Excel (.xlsx) or CSV price list." }, { status: 422 });
  }
}
