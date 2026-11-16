import { after } from "next/server";
import { can } from "@/lib/domain/design/account";
import { cleanCallerKey } from "@/lib/domain/install-call";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { answerTraining, trainingFor, writeUpTraining } from "@/lib/server/design-practice-call";
import { allow } from "@/lib/server/rate-limit";

const PRIVATE = { "cache-control": "private, no-store" };
const roleIn = (request: Request) => cleanCallerKey(new URL(request.url).searchParams.get("role"));

/** A training call's write-up can take a while: the reading runs after the answer has gone back. */
export const maxDuration = 120;

/**
 * GET ?role= → { ok, training, mayKeep }: the agent's latest training call (domain/design/training-call.ts): still on,
 * being written up, or the changes it proposes. A call that is over and not yet read is read after the answer.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { view, writeUp } = await trainingFor(who.member.businessId, roleIn(request));
    if (writeUp) after(() => writeUpTraining(writeUp));
    return Response.json(
      { ok: true, training: view, mayKeep: can(who.member.role, "prices", who.member.permissions) },
      { headers: PRIVATE },
    );
  });
}

/**
 * POST { id, proposal, do: "lock" | "keep" | "drop" } or { id, do: "retry" } → { ok, notes, training, gone, full }: one
 * proposed change locked in as a rule, kept as a note or dropped, by a member who may change settings. The only other
 * way a training call reaches the script is a rule the trainer confirmed out loud on the call (`lockInFromTraining`).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-train", 120))
      return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const what = read.body.do;
    const id = read.body.id;
    if (
      typeof id !== "string" ||
      !/^pc_[a-f0-9]{8,64}$/.test(id) ||
      (what !== "lock" && what !== "keep" && what !== "drop" && what !== "retry")
    )
      return Response.json({ ok: false, message: "That isn't here any more." }, { status: 404 });
    const role = roleIn(request);
    const out = await answerTraining(who.member.businessId, role, who.member.email, {
      id,
      do: what,
      ...(typeof read.body.proposal === "string" ? { proposal: read.body.proposal } : {}),
    });
    if (!out.ok) return Response.json({ ok: false, message: "That isn't here any more." }, { status: 404 });
    const { view, writeUp } = await trainingFor(who.member.businessId, role);
    if (writeUp) after(() => writeUpTraining(writeUp));
    return Response.json({ ok: true, notes: out.notes, training: view, gone: out.gone, full: out.full }, { headers: PRIVATE });
  });
}
