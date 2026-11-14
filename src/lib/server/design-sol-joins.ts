/**
 * Server only. Sol joining in on a team channel without being tagged (domain/design/sol-joins-in.ts): run after a line
 * is in, it waits a moment for a teammate, then reads the question and answers it in the room only when it is his to
 * take. He reads the business as the member who asked may see it, with no tools and never costs; the question isn't
 * put into anyone's own conversation with him.
 */
import Anthropic from "@anthropic-ai/sdk";
import { canvasFacts } from "@/lib/domain/design/canvas";
import { solSystem } from "@/lib/domain/design/sol";
import { SOL_JOIN_WAIT_SECONDS, mayStepIn, readStepIn, stepInPrompt, stillHisToTake } from "@/lib/domain/design/sol-joins-in";
import { handOffLine, whoAnswers } from "@/lib/domain/design/sol-chat-work";
import { SOL_BY, nameOf } from "@/lib/domain/design/team-chat";
import { handleOf } from "@/lib/domain/design/mentions";
import { todayInMarket } from "@/lib/domain/market";
import { redactSecrets } from "./bill-reader";
import { sharedViewer } from "./design-sol";
import { loadPrefs } from "./design-after-sale-repo";
import { listJobs } from "./design-crm-repo";
import { query } from "./db";
import type { Member } from "./design-repo";
import { casesToResolve } from "./design-service-repo";
import { modelFor } from "./sol-credits";
import { channelContext, roomHistory, solSaysInTeam, teamChannelLabel, tellTaggedBySol } from "./design-team-repo";

/** Unasked and often not his to answer: the quick model, and no credit (sol-routing.ts). */
const MODEL = () => modelFor("quick");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** After `member` said `text` (line `lineId`) in `room`: Sol answers it there if nobody has and it is his to take. */
export async function solStepsIn(member: Member, room: string, lineId: string, text: string, apiKey: string | null): Promise<void> {
  if (!apiKey || !mayStepIn(room, text)) return;
  const { businessId } = member;
  const label = await teamChannelLabel(businessId, room);
  if (!label) return;
  const channel = { label };
  if (!(await loadPrefs(businessId)).solJoinsIn) return;
  await pause(SOL_JOIN_WAIT_SECONDS * 1000);

  const [since, sol] = await Promise.all([
    query<{ by: string }>(
      `select by_email as by from design_team_lines
        where business_id = $1 and room = $2
          and at > (select at from design_team_lines where business_id = $1 and id = $3)`,
      [businessId, room, lineId],
    ),
    query<{ last: Date | null; hour: string }>(
      `select max(at) as last, count(*) filter (where at > now() - interval '1 hour') as hour
         from design_team_lines where business_id = $1 and room = $2 and by_email = $3`,
      [businessId, room, SOL_BY],
    ),
  ]);
  // The question was deleted meanwhile: nothing to answer.
  const still = await query<{ id: string }>(`select id from design_team_lines where business_id = $1 and id = $2`, [businessId, lineId]);
  if (!still.length) return;
  if (
    !stillHisToTake({
      asker: member.email,
      since,
      solLast: sol[0]?.last ? new Date(sol[0].last) : null,
      solThisHour: Number(sol[0]?.hour ?? 0),
      now: new Date(),
    })
  )
    return;

  const [jobs, serviceOpen, before] = await Promise.all([
    // The deals everyone reading the channel may see, not only the asker's (3 Nov 2026, a bug review).
    sharedViewer(businessId).then((v) => listJobs(businessId, v)),
    casesToResolve(businessId),
    channelContext(businessId, room),
  ]);
  const context = before
    .filter((l) => l.text !== text)
    .map((l) => `${l.by === SOL_BY ? "Sol" : nameOf(l.by)}: ${l.text}`)
    .join("\n");
  const system = solSystem({
    business: member.businessName,
    member: member.email,
    // The channel is read by everyone: no costs, whoever asked.
    costs: false,
    facts: canvasFacts(jobs, serviceOpen, todayInMarket()),
    prefs: [],
    now: new Date(),
  });
  let reply = "";
  try {
    const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    const m = await client.messages.create({
      model: MODEL(),
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: stepInPrompt({ channel: channel.label, asker: nameOf(member.email), question: text, context }) }],
    });
    reply = m.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (e) {
    // Unasked, so a failure says nothing in the room.
    console.error("sol joining in", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}: ${e.message}` : String(e)));
    return;
  }
  const said = readStepIn(reply);
  // Not his to answer: the teammate who usually answers questions like it, from the room's own history, if one stands out.
  let handOff: string | null = null;
  if (!said) {
    const { history, members } = await roomHistory(businessId, room);
    const who = whoAnswers(
      text,
      history.filter((l) => l.id !== lineId),
      member.email,
      members,
    );
    if (!who) return;
    handOff = handOffLine(handleOf(who), nameOf(who));
  }
  // Someone may have answered while he was thinking: then he stays out.
  const late = await query<{ n: string }>(
    `select count(*) as n from design_team_lines
      where business_id = $1 and room = $2 and by_email <> $4
        and at > (select at from design_team_lines where business_id = $1 and id = $3)`,
    [businessId, room, lineId, member.email.toLowerCase()],
  );
  if (Number(late[0]?.n ?? 0) > 0) return;
  await solSaysInTeam(businessId, room, said ?? handOff!, undefined, lineId);
  // A teammate handed the question is emailed like any tag.
  if (handOff) await tellTaggedBySol(businessId, room, handOff).catch(() => console.error("sol's hand-off email couldn't be sent"));
}
