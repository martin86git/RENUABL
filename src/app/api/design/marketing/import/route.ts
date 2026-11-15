import {
  CONTACT_FIELDS,
  IMPORT_LIMITS,
  cleanColumnMap,
  cleanConsentNote,
  cleanListName,
  cleanSource,
  guessColumns,
  isConsentKind,
  readContacts,
} from "@/lib/domain/marketing/contacts";
import { parseCsv } from "@/lib/domain/price-import";
import { answer } from "@/lib/server/design-context";
import { marketingMember, refuse } from "@/lib/server/marketing-guard";
import { importContacts, listNamed } from "@/lib/server/marketing-repo";
import { readXlsxRows } from "@/lib/server/xlsx";

export const maxDuration = 60;

/**
 * POST (members who may publish) multipart: "file" (.xlsx or .csv) and "step":
 * - "check": the header, a guessed column for each field, a few rows and what would be skipped. Nothing kept.
 * - "import": with "map" (JSON, field → column), "source", "consent", "consentNote" and an optional "list"; the
 *   contacts are added to the business's own (one per email) and the import is recorded. Nothing is sent to anyone.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return refuse("Please choose a file.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return refuse("Please choose a file.", 400);
    if (file.size > IMPORT_LIMITS.bytes) return refuse("That file is too large (4 MB at most). Split it and import each part.", 413);
    const name = file.name.toLowerCase();
    let rows: string[][];
    try {
      if (name.endsWith(".xlsx")) rows = readXlsxRows(await file.arrayBuffer());
      else if (name.endsWith(".csv") || name.endsWith(".txt")) rows = parseCsv(await file.text());
      else return refuse("Please upload an Excel (.xlsx) or CSV file.", 415);
    } catch {
      return refuse("We couldn't read that file. Try saving it as .xlsx or .csv.");
    }
    rows = rows.filter((r) => r.some((c) => c?.trim()));
    if (rows.length < 2) return refuse("That file has no rows under its header.");
    if (rows.length - 1 > IMPORT_LIMITS.rows)
      return refuse(`That file has more than ${IMPORT_LIMITS.rows.toLocaleString()} rows. Split it and import each part.`);
    const header = rows[0].map((h) => (h ?? "").trim().slice(0, 80));

    if (form.get("step") !== "import") {
      const map = guessColumns(header, rows.slice(1, 50));
      const read = map.email >= 0 ? readContacts(rows, map) : null;
      return Response.json({
        ok: true,
        header,
        map,
        sample: rows.slice(1, 6).map((r) => header.map((_, i) => (r[i] ?? "").slice(0, 80))),
        rows: rows.length - 1,
        contacts: read?.contacts.length ?? 0,
        skipped: read?.skipped.length ?? 0,
      });
    }

    let rawMap: unknown;
    try {
      rawMap = JSON.parse(String(form.get("map") ?? ""));
    } catch {
      rawMap = null;
    }
    const map = cleanColumnMap(rawMap, header.length);
    if (!map) return refuse("Choose which column holds the email address.");
    const source = cleanSource(form.get("source"));
    if (!source) return refuse("Say where these contacts came from (e.g. the list's name and when you got it).");
    const consent = form.get("consent");
    if (!isConsentKind(consent)) return refuse("Choose what consent these contacts have given.");
    const consentNote = cleanConsentNote(form.get("consentNote"));
    if ((consent === "express" || consent === "inferred") && !consentNote)
      return refuse(
        "Note how they consented (e.g. 'published business emails on their websites, checked Nov 2026'), so it can be shown if asked.",
      );
    const listName = cleanListName(form.get("list"));
    const { contacts, skipped } = readContacts(rows, map);
    if (!contacts.length) return refuse("No row had an email address we could use.");
    const listId = listName ? await listNamed(businessId, listName, email) : null;
    const result = await importContacts(businessId, contacts, {
      fileName: file.name,
      source,
      consent,
      consentNote,
      listId,
      by: email,
      skipped: skipped.length,
    });
    return Response.json({ ok: true, ...result, skipped: skipped.length, fields: CONTACT_FIELDS.filter((f) => map[f] >= 0) });
  });
}
