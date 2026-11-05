/**
 * Server only. Sol at work in the team chat (domain/design/sol-chat-work.ts): reading a line for work he can offer to
 * do, doing it when a person presses Yes on his card, and catching a member up on a channel. He offers and summarises;
 * every change to a deal, an order or a reminder is made by the member's own press, as them, and checked against what
 * they may see and do.
 */
import { can } from "@/lib/domain/design/account";
import { cleanJobInput, STAGE_LABELS } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { fromLocal, withReminder } from "@/lib/domain/design/sol";
import {
  CATCH_UP_MAX,
  CATCH_UP_MIN,
  CATCH_UP_SCHEMA,
  WORK_SCHEMA,
  actionDoneWords,
  actionFrom,
  actionLead,
  actionRefusal,
  catchUpPrompt,
  cleanCatchUp,
  matchProduct,
  mayHoldWork,
  withOrderAdd,
  workPrompt,
  type CatchUp,
  type ChatAction,
} from "@/lib/domain/design/sol-chat-work";
import { SOL_BY, TEAM_CHANNELS, asksSol, isChannel, nameOf } from "@/lib/domain/design/team-chat";
import { todayInMarket } from "@/lib/domain/market";
import { readWithClaude } from "./claude-reader";
import { viewerOf } from "./design-context";
import { jobOrder, loadPrefs, saveOrder } from "./design-after-sale-repo";
import { addActivity, jobById, listJobs, updateJob } from "./design-crm-repo";
import { loadLists, type Member } from "./design-repo";
import { newSolId, withSol } from "./design-sol-repo";
import { channelContext, latestFromOthers, offeredAction, settleAction, solSaysInTeam, type TeamMe } from "./design-team-repo";
import { withSolCredit } from "./sol-credits";

const meOf = (member: Member): TeamMe => ({ businessId: member.businessId, email: member.email, viewer: viewerOf(member) });
const seesCosts = (member: Member) => can(member.role, "costs", member.permissions);

/**
 * The product an order card would add, found on the job's order first, then the business's price lists; null when the
 * order isn't open (the customer hasn't signed) or the words don't name one product.
 */
async function productOnOrder(businessId: string, jobId: string, words: string): Promise<{ sku: string; item: string } | null> {
  const order = await jobOrder(businessId, jobId);
  if (typeof order === "string") return null;
  const lists = await loadLists(businessId);
  const listed = lists.flatMap((l) => [...l.panels, ...l.inverters, ...l.batteries, ...l.items]).map((r) => ({ sku: r.sku, item: r.name }));
  return matchProduct(
    words,
    order.items.map((i) => ({ sku: i.sku, item: i.item })),
    listed,
  );
}

/**
 * After `member` said `text` (line `lineId`) in a channel: when it plainly says something should happen to one of their
 * deals, or that they want reminding, Sol answers it with a card offering to do it, Yes or No. Nothing is done until
 * pressed. Unasked, he only reads lines when the business lets him join in; asked by name (`asked`, the line tags @Sol)
 * he always reads it, and may also offer to add to a job's order or mark a deal's stage. Each reading is one Sol credit
 * (`channel`). True when a card was put up, so an asked Sol doesn't also answer in words.
 */
export async function solOffersWork(
  member: Member,
  room: string,
  lineId: string,
  text: string,
  apiKey: string | null,
  asked = false,
): Promise<boolean> {
  if (!apiKey || !mayHoldWork(isChannel(room), text, asked) || asksSol(room, text) !== asked) return false;
  const { businessId } = member;
  if (!asked && !(await loadPrefs(businessId)).solJoinsIn) return false;
  const jobs = (await listJobs(businessId, viewerOf(member))).filter((j) => j.stage !== "lost").slice(0, 80);
  const names = new Map(jobs.map((j) => [j.id, `${j.customerName} · ${j.title}`]));
  const deals = jobs
    .map((j) => `${j.id}: ${j.customerName} · ${j.title} · ${STAGE_LABELS[j.stage]} · ${j.installDate ?? "no install day"}`)
    .join("\n");
  const context = (await channelContext(businessId, room, 6))
    .filter((l) => l.text !== text)
    .map((l) => `${nameOf(l.by)}: ${l.text}`)
    .join("\n");
  const today = todayInMarket();
  const reading = await withSolCredit(businessId, "channel", member.email, (ai) =>
    readWithClaude<Record<string, unknown>>(
      [],
      WORK_SCHEMA,
      workPrompt({ asker: nameOf(member.email), line: text.replace(/(^|\s)@sol\b/gi, "$1"), today, deals, context, asked }),
      apiKey,
      ai,
    ),
  );
  if (reading === "out") return false;
  let action: ChatAction | null = actionFrom(reading, {
    asker: member.email,
    deals: names,
    today,
    dueAt: (local) => fromLocal(local)?.toISOString() ?? null,
  });
  // The order and stage changes only when asked by name.
  if (!action || (!asked && (action.kind === "order-add" || action.kind === "stage"))) return false;
  if (action.kind === "order-add") {
    // Only offered to someone who may change an order, and only for a product the order or the lists name exactly.
    if (!seesCosts(member)) return false;
    const product = await productOnOrder(businessId, action.jobId!, action.text ?? "");
    if (!product) return false;
    action = { ...action, sku: product.sku, item: product.item, text: undefined };
  }
  await solSaysInTeam(businessId, room, actionLead(action), { action }, lineId);
  return true;
}

export type ActionOutcome = { ok: true; words: string } | { ok: false; message: string };

/**
 * A person answers Sol's card: Yes does what it offers as them, No sets it aside; either once. Refused when they may
 * not do it (an order needs costs), the deal isn't one they may see, or someone answered first. A Yes on a deal is
 * written on the deal's record.
 */
export async function pressAction(member: Member, lineId: string, how: "do" | "dismiss"): Promise<ActionOutcome> {
  const me = meOf(member);
  const offered = await offeredAction(me, lineId);
  if (!offered) return { ok: false, message: "There's nothing to do on that message." };
  const { action } = offered;
  const refused = actionRefusal(action, member.email, { costs: seesCosts(member) });
  if (refused) return { ok: false, message: refused };
  const { businessId, email } = member;
  if (how === "dismiss") {
    if (action.jobId && !(await jobById(businessId, action.jobId, viewerOf(member))))
      return { ok: false, message: "That deal isn't one you can see." };
    return (await settleAction(businessId, lineId, "dismissed", email))
      ? { ok: true, words: "Left as it was." }
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
    return { ok: true, words: actionDoneWords(action) };
  }
  // A deal's work only for someone who may see that deal.
  const found = await jobById(businessId, action.jobId!, viewerOf(member));
  if (!found) return { ok: false, message: "That deal isn't one you can see." };
  const jobId = action.jobId!;
  const onRecord = (text: string) => addActivity(businessId, found.customer.id, { kind: "note", text, jobId }, email);

  if (action.kind === "order-add") {
    // Checked before the card is marked, so a closed order doesn't leave a card saying "done".
    const order = await jobOrder(businessId, jobId);
    if (typeof order === "string")
      return {
        ok: false,
        message: order === "unsigned" ? "The order opens once the customer has signed." : "That deal isn't there any more.",
      };
    if (!(await settleAction(businessId, lineId, "done", email))) return { ok: false, message: "Someone got there first." };
    const next = withOrderAdd(order.order, order.items, { sku: action.sku ?? "", item: action.item ?? "", qty: action.qty ?? 0 });
    const saved = await saveOrder(businessId, jobId, next, email);
    if (typeof saved === "string") return { ok: false, message: "That order couldn't be changed." };
    await onRecord(`Added ${action.qty} × ${action.item} to the order, from the team chat.`);
    return { ok: true, words: actionDoneWords(action) };
  }

  if (!(await settleAction(businessId, lineId, "done", email))) return { ok: false, message: "Someone got there first." };
  if (action.kind === "install-date" || action.kind === "stage") {
    const fields = typedFields((await loadPrefs(businessId)).dealFields);
    const change = action.kind === "install-date" ? { installDate: action.date } : { stage: action.stage };
    const job = await updateJob(businessId, jobId, (current) => cleanJobInput(change, current, fields), email);
    if (!job || "refused" in job) return { ok: false, message: job && "refused" in job ? job.refused : "That deal couldn't be changed." };
    // A stage move writes its own line ("Moved to Won"); the note says where it came from.
    await onRecord(
      action.kind === "install-date"
        ? `Install day set to ${action.date} from the team chat.`
        : `Marked ${STAGE_LABELS[action.stage!]} from the team chat.`,
    );
    return { ok: true, words: actionDoneWords(action) };
  }
  const note = await onRecord(action.text!);
  if (typeof note === "string") return { ok: false, message: "The note couldn't be added to that deal." };
  return { ok: true, words: actionDoneWords(action) };
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
  const reading = await withSolCredit(member.businessId, "channel", member.email, (ai) =>
    readWithClaude<Record<string, unknown>>(
      [],
      CATCH_UP_SCHEMA,
      catchUpPrompt({ reader: nameOf(member.email), channel: channel.label, lines: said }),
      apiKey,
      ai,
    ),
  );
  if (reading === "out") return "out";
  return cleanCatchUp(reading, lines.length);
}
