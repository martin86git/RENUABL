import { newBlockId, starterContent } from "@/lib/domain/marketing/edm";
import { cleanSequence } from "@/lib/domain/marketing/sequences";
import { answer } from "@/lib/server/design-context";
import { createSequence, listSequences } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, readJson } from "@/lib/server/marketing-guard";

/** GET: every sequence of the business with its counts. POST {name?} (members who may publish): a new one, off, with a first email and a wait. */
export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    return Response.json({ ok: true, sequences: await listSequences(gate.member.businessId) });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const b = (await readJson(request)) ?? {};
    const draft = cleanSequence({
      name: typeof b.name === "string" && b.name.trim() ? b.name : "New sequence",
      steps: [
        { id: newBlockId(), kind: "email", content: starterContent() },
        { id: newBlockId(), kind: "wait", days: 3 },
      ],
    });
    return Response.json({ ok: true, id: await createSequence(gate.member.businessId, draft, gate.member.email) });
  });
}
