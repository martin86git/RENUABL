import { checkInverter, checkPanel, cleanSku, sheetBasis, type SheetKind } from "@/lib/domain/design/datasheets";
import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { businessDatasheets, confirmSheet, deleteSheet, listSheets, saveSheet } from "@/lib/server/design-datasheets-repo";
import { findDatasheet } from "@/lib/server/datasheet-finder";
import { allow } from "@/lib/server/rate-limit";

/** Finding a datasheet online (a search, a download, a read) can take a couple of minutes, after the answer too. */
export const maxDuration = 300;

const kindOf = (v: unknown): SheetKind | null => (v === "panel" || v === "inverter" ? v : null);
const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";

/**
 * GET: the business's checked datasheets, as Settings lists them (`sheets`) and by product code as the designer uses
 * them (`datasheets`). Every member designs with them; none of it is a cost.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [sheets, datasheets] = await Promise.all([listSheets(who.member.businessId), businessDatasheets(who.member.businessId)]);
    return Response.json({ ok: true, sheets, datasheets });
  });
}

/**
 * PUT { kind, sku, model, fileName, panel | inverter }: a product's figures, as the member checked them. Each is
 * checked again here (`checkPanel`, `checkInverter`); one missing or out of range stops the save and says which.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const kind = kindOf(read.body.kind);
    const sku = cleanSku(read.body.sku);
    if (!kind) return Response.json({ ok: false, message: "Say whether it is a panel or an inverter." }, { status: 422 });
    if (!sku) return Response.json({ ok: false, message: "Add the product code, as it is on your price list." }, { status: 422 });
    const model = text(read.body.model, 120);
    const fileName = text(read.body.fileName, 120);
    const on = new Date(`${todayInMarket()}T00:00:00Z`).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const basis = sheetBasis(model, fileName, who.member.email, on);
    const raw = (read.body[kind] && typeof read.body[kind] === "object" ? read.body[kind] : {}) as Record<string, unknown>;
    const checked = kind === "panel" ? checkPanel(raw, basis) : checkInverter(raw, basis);
    if (!checked.ok) return Response.json({ ok: false, message: checked.message }, { status: 422 });
    await saveSheet(who.member.businessId, { kind, sku, model, fileName, figures: checked.value }, who.member.email);
    return Response.json({ ok: true, sheets: await listSheets(who.member.businessId) });
  });
}

/**
 * POST { do: "find", kind, sku, name }: looks for the product's datasheet online now and keeps its figures unchecked
 * (datasheet-finder.ts; any member designing, 30 an hour). { do: "confirm", kind, sku }: a person has checked figures
 * found online against the sheet (who may change prices).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const kind = kindOf(read.body.kind);
    const sku = cleanSku(read.body.sku);
    if (!kind || !sku) return Response.json({ ok: false, message: "Which product?" }, { status: 422 });
    if (read.body.do === "confirm") {
      const who = await requireMember("prices");
      if ("refuse" in who) return who.refuse;
      if (!(await confirmSheet(who.member.businessId, kind, sku, who.member.email)))
        return Response.json({ ok: false, message: "There are no figures waiting to be checked for that product." }, { status: 404 });
      return Response.json({ ok: true, sheets: await listSheets(who.member.businessId) });
    }
    if (read.body.do !== "find") return Response.json({ ok: false }, { status: 400 });
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "datasheet-find", 30))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const outcome = await findDatasheet(who.member.businessId, { kind, sku, name: text(read.body.name, 160) || sku });
    const message = {
      found: "Found its datasheet online. Its figures are in use, marked to check until someone confirms them in Settings.",
      "kept-already": "Its figures are already on file.",
      "not-found": "Couldn't find its datasheet online. Upload it in Settings, Product datasheets.",
      "not-read": "Found a datasheet but couldn't read its figures clearly. Upload it in Settings, Product datasheets.",
      off: "Finding datasheets isn't set up here.",
    }[outcome];
    return Response.json({
      ok: outcome === "found" || outcome === "kept-already",
      outcome,
      message,
      datasheets: await businessDatasheets(who.member.businessId),
    });
  });
}

/** DELETE ?kind=&sku=: takes a product's figures away; the designer goes back to RENUABL's own, if any. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const q = new URL(request.url).searchParams;
    const kind = kindOf(q.get("kind"));
    const sku = cleanSku(q.get("sku"));
    if (!kind || !sku || !(await deleteSheet(who.member.businessId, kind, sku)))
      return Response.json({ ok: false, message: "That datasheet isn't here." }, { status: 404 });
    return Response.json({ ok: true, sheets: await listSheets(who.member.businessId) });
  });
}
