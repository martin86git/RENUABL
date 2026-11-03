/**
 * Server only. Sol at work in the team chat (domain/design/sol-chat-work.ts): reading a line for work he can offer to
 * do, doing it when a person presses his card, and catching a member up on a channel. He offers and summarises; every
 * change to a deal or a reminder is made by the member's own press, as them, and checked against what they may see.
 */
import { cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { fromLocal, withReminder } from "@/lib/domain/design/sol";
import {
  CATCH_UP_MAX,
  CATCH_UP_MIN,
  CATCH_UP_SCHEMA,
  WORK_SCHEMA,
  actionFrom,
  actionLead,
  actionRefusal,
  actionWords,
  catchUpPrompt,
  cleanCatchUp,
  mayHoldWork,
  workPrompt,
  type CatchUp,
} from "@/lib/domain/design/sol-chat-work";
import { SOL_BY, TEAM_CHANNELS, asksSol, isChannel, nameOf } from "@/lib/domain/design/team-chat";
import { todayInMarket } from "@/lib/domain/market";
import { readWithClaude } from "./claude-reader";
import { viewerOf } from "./design-context";
import { loadPrefs } from "./design-after-sale-repo";
import { addActivity, jobById, listJobs, updateJob } from "./design-crm-repo";
import type { Member } from "./design-repo";
import { newSolId, withSol } from "./design-sol-repo";
import { channelContext, latestFromOthers, offeredAction, settleAction, solSaysInTeam, type TeamMe } from "./design-team-repo";
import { withSolCredit } from "./sol-credits";

const meOf = (member: Member): TeamMe => ({ businessId: member.businessId, email: member.email, viewer: viewerOf(member) });

/**
 * After `member` said `text` (line `lineId`) in a channel: when it plainly says something should happen to one of their
 * deals, or that they want reminding, Sol answers it with a card offering to do it. Nothing is done until pressed.
 */
export async function solOffersWork(member: Member, room: string, lineId: string, text: string, apiKey: string | null): Promise<void> {
  if (!apiKey || !mayHoldWork(isChannel(room), text) || asksSol(room, text)) return;
  const { businessId } = member;
  if (!(await loadPrefs(businessId)).solJoinsIn) return;
  const jobs = (await listJobs(businessId, viewerOf(member))).filter((j) => j.stage !== "lost").slice(0, 80);
  const names = new Map(jobs.map((j) => [j.id, `${j.customerName} · ${j.title}`]));
  const deals = jobs.map((j) => `${j.id}: ${j.customerName} · ${j.title} · ${j.installDate ?? "no install day"}`).join("\n");
  const context = (await channelContext(businessId, room, 6))
    .filter((l) => l.text !== text)
    .map((l) => `${nameOf(l.by)}: ${l.text}`)
    .join("\n");
  const today = todayInMarket();
  const reading = await withSolCredit(businessId, "channel", member.email, () =>
    readWithClaude<Record<string, unknown>>(
      [],
      WORK_SCHEMA,
      workPrompt({ asker: nameOf(member.email), line: text, today, deals, context }),
      apiKey,
    ),
  );
  if (reading === "out") return;
  const action = actionFrom(reading, {
    asker: member.email,
    deals: names,
    today,
    dueAt: (local) => fromLocal(local)?.toISOString() ?? null,
  });
  if (!action) return;
  await solSaysInTeam(businessId, room, actionLead(action), { action }, lineId);
}

export type ActionOutcome = { ok: true; words: string } | { ok: false; message: string };

/** A person presses Sol's card: does what it offers as them (or sets it aside), once. */
export async function pressAction(member: Member, lineId: string, how: "do" | "dismiss"): Promise<ActionOutcome> {
  const me = meOf(member);
  const offered = await offeredAction(me, lineId);
  if (!offered) return { ok: false, message: "There's nothing to do on that message." };
  const { action } = offered;
  const refused = actionRefusal(action, member.email);
  if (refused) return { ok: false, message: refused };
  const { businessId, email } = member;
  if (how === "dismiss") {
    return (await settleAction(businessId, lineId, "dismissed", email))
      ? { ok: true, words: "Set aside." }
      : { ok: false, message: "Someone got there first." };
  }
  if (action.kind === "reminder") {
    // Marked first, so two presses can't set it twice.
    if (!(await settleAction(businessId, lineId, "done", email))) return { ok: false, message: "Someone got there first." };
    await withSol(businessId, email, (row) => ({
      ...row,
      reminders: withReminder(row.reminders, {
        id: newSolId(),
        what: action.text!,
        createdAt: new Date().toISOString(),
        dueAt: action.dueAt,
      }),
    }));
    return { ok: true, words: actionWords(action) };
  }
  // A deal's work only for someone who may see that deal.
  const found = await jobById(businessId, action.jobId!, viewerOf(member));
  if (!found) return { ok: false, message: "That deal isn't one you can see." };
  if (!(await settleAction(businessId, lineId, "done", email))) return { ok: false, message: "Someone got there first." };
  if (action.kind === "install-date") {
    const fields = typedFields((await loadPrefs(businessId)).dealFields);
    const job = await updateJob(
      businessId,
      action.jobId!,
      (current) => cleanJobInput({ installDate: action.date }, current, fields),
      email,
    );
    if (!job || "refused" in job) return { ok: false, message: job && "refused" in job ? job.refused : "That deal couldn't be changed." };
    await addActivity(
      businessId,
      found.customer.id,
      { kind: "note", text: `Install day set to ${action.date} from the team chat.`, jobId: action.jobId! },
      email,
    );
    return { ok: true, words: actionWords(action) };
  }
  const note = await addActivity(businessId, found.customer.id, { kind: "note", text: action.text!, jobId: action.jobId! }, email);
  if (typeof note === "string") return { ok: false, message: "The note couldn't be added to that deal." };
  return { ok: true, words: actionWords(action) };
}

/** Catches a member up on a channel: the `unread` lines from others since they were last there, in three short parts. */
export async function catchUp(member: Member, room: string, unread: number, apiKey: string | null): Promise<CatchUp | "out" | null> {
  const channel = TEAM_CHANNELS.find((c) => c.id === room);
  if (!channel) return null;
  const n = Math.max(1, Math.min(CATCH_UP_MAX, Math.round(unread) || 0));
  const lines = await latestFromOthers(meOf(member), room, n);
  if (lines.length < CATCH_UP_MIN)
    return { lines: lines.length, changed: "Only a line or two since you were last here: it's all on screen.", decided: "", waiting: "" };
  if (!apiKey)
    return { lines: lines.length, changed: "Sol can't catch you up just now: Claude isn't set up on this site.", decided: "", waiting: "" };
  const said = lines.map((l) => `[${l.at.slice(0, 16).replace("T", " ")}] ${l.by === SOL_BY ? "Sol" : nameOf(l.by)}: ${l.text}`).join("\n");
  const reading = await withSolCredit(member.businessId, "channel", member.email, () =>
    readWithClaude<Record<string, unknown>>(
      [],
      CATCH_UP_SCHEMA,
      catchUpPrompt({ reader: nameOf(member.email), channel: channel.label, lines: said }),
      apiKey,
    ),
  );
  if (reading === "out") return "out";
  return cleanCatchUp(reading, lines.length);
}
