import { cleanConsentNote, cleanListName, isConsentKind } from "@/lib/domain/marketing/contacts";
import { answer } from "@/lib/server/design-context";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";
import { crmPeople, importContacts, listNamed } from "@/lib/server/marketing-repo";

/**
 * GET (members): how many of the business's CRM customers have an email to bring across. POST {consent, note, list?}
 * (members who may publish): brings them into Marketing's contacts (one per email, only blanks filled for anyone
 * already there); anyone unsubscribed from the business's group emails stays unsubscribed here. Nothing is sent.
 */
export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const people = await crmPeople(gate.member.businessId);
    return Response.json({ ok: true, withEmail: people.length, unsubscribed: people.filter((p) => p.unsubscribed).length });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    const b = await readJson(request);
    if (!b || !isConsentKind(b.consent)) return refuse("Choose what consent your customers have given.");
    const note = cleanConsentNote(b.note);
    if ((b.consent === "express" || b.consent === "inferred") && !note) return refuse("Note how they consented.");
    const people = await crmPeople(businessId);
    if (!people.length) return refuse("None of your customers has an email address yet.");
    const listName = cleanListName(b.list);
    const listId = listName ? await listNamed(businessId, listName, email) : null;
    const result = await importContacts(businessId, people, {
      fileName: "Your customers",
      source: "Your customers (CRM)",
      consent: b.consent,
      consentNote: note,
      listId,
      by: email,
      skipped: 0,
      unsubscribed: people.filter((p) => p.unsubscribed).map((p) => p.email),
    });
    return Response.json({ ok: true, ...result });
  });
}
