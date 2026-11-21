import { cleanSetupStep } from "@/lib/domain/design/setup";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { putSetupAway, setupFor, skipSetupStep } from "@/lib/server/design-setup";

const PRIVATE = { "cache-control": "private, no-store" };

/** GET → where Sol's setup wizard stands for this person (domain/design/setup.ts): each step read from what is set up. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, ...(await setupFor(who.member)) }, { headers: PRIVATE });
  });
}

/** POST { do: "skip" | "unskip", step } or { do: "away" | "back" } → the same view after it. Only this person's own row. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 500);
    if ("refuse" in read) return read.refuse;
    const what = read.body.do;
    if (what === "skip" || what === "unskip") {
      const step = cleanSetupStep(read.body.step);
      if (!step) return Response.json({ ok: false, message: "Pick a step." }, { status: 422 });
      await skipSetupStep(who.member, step, what === "skip");
    } else if (what === "away" || what === "back") {
      await putSetupAway(who.member, what === "away");
    } else return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
    return Response.json({ ok: true, ...(await setupFor(who.member)) }, { headers: PRIVATE });
  });
}
