import { newBlockId, starterContent } from "@/lib/domain/marketing/edm";
import { cleanSequence } from "@/lib/domain/marketing/sequences";
import { createSequence, listSequences } from "@/lib/server/marketing-campaigns-repo";
import { marketingStaff, readJson, unauthorised } from "@/lib/server/marketing-staff";

/** GET (staff): every sequence with its counts. POST {name?}: a new one, off, with a first email and a wait. */
export async function GET() {
  if (!(await marketingStaff())) return unauthorised();
  return Response.json({ ok: true, sequences: await listSequences() });
}

export async function POST(request: Request) {
  const staff = await marketingStaff();
  if (!staff) return unauthorised();
  const b = (await readJson(request)) ?? {};
  const draft = cleanSequence({
    name: typeof b.name === "string" && b.name.trim() ? b.name : "New sequence",
    steps: [
      { id: newBlockId(), kind: "email", content: starterContent() },
      { id: newBlockId(), kind: "wait", days: 3 },
    ],
  });
  return Response.json({ ok: true, id: await createSequence(draft, staff.email) });
}
