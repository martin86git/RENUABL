/**
 * Server only. Each member's conversation with Sol (domain/design/sol.ts), with their own preferences and reminders,
 * in `design_sol`: one row a member. Under the designer's tenant rule (business id first, from the signed-in member
 * only), and each member reads and changes only their own row. A reminder that has fallen due is said in the chat the
 * next time the row is read (the rail asks every minute), marked said in the same step so it is never said twice.
 */
import { randomUUID } from "node:crypto";
import {
  CHAT_KEPT,
  cleanPrefs,
  cleanReminders,
  cleanTurns,
  dropExchange,
  dueNow,
  reminderNote,
  unreadOf,
  upcoming,
  type SolPref,
  type SolReminder,
  type SolState,
  type SolTurn,
} from "@/lib/domain/design/sol";
import { panelTurns } from "@/lib/domain/design/sol-rooms";
import {
  ASK_EACH_TIME,
  cleanInduction,
  cleanScope,
  inductionPrefId,
  keptFor,
  learnedFrom,
  learnedPref,
  questionByKey,
  withKeptPref,
  type BusinessScope,
  type Induction,
} from "@/lib/domain/design/sol-induction";
import { chatsSoFar, cleanPast, fileAway, freshTurns, pastLines, type SolPast, type SolPastLine } from "@/lib/domain/design/sol-history";
import { transaction } from "./db";
import type { Q } from "./design-crm-repo";

interface Row {
  turns: SolTurn[];
  prefs: SolPref[];
  reminders: SolReminder[];
  seenAt: string | null;
  induction: Induction;
  /** How many past conversations are filed away (read only, never saved from here). */
  pastCount: number;
}

/** The member's row, locked for this transaction (made empty first when there is none), with due reminders said. */
async function locked(q: Q, businessId: string, email: string, now: Date): Promise<Row> {
  await q(`insert into design_sol (business_id, email) values ($1, $2) on conflict do nothing`, [businessId, email]);
  const rows = await q<{
    turns: unknown;
    prefs: unknown;
    reminders: unknown;
    seen_at: Date | null;
    induction: unknown;
    past_count: number | null;
  }>(
    `select turns, prefs, reminders, seen_at, induction,
            case when jsonb_typeof(past) = 'array' then jsonb_array_length(past) else 0 end as past_count
       from design_sol where business_id = $1 and email = $2 for update`,
    [businessId, email],
  );
  const row: Row = {
    turns: cleanTurns(rows[0]?.turns),
    prefs: cleanPrefs(rows[0]?.prefs),
    reminders: cleanReminders(rows[0]?.reminders),
    seenAt: rows[0]?.seen_at ? rows[0].seen_at.toISOString() : null,
    induction: cleanInduction(rows[0]?.induction),
    pastCount: Number(rows[0]?.past_count ?? 0) || 0,
  };
  const due = dueNow(row.reminders, now);
  if (due.length) {
    const at = now.toISOString();
    const ids = new Set(due.map((r) => r.id));
    row.reminders = row.reminders.map((r) => (ids.has(r.id) ? { ...r, firedAt: at } : r));
    row.turns = [...row.turns, ...due.map((r): SolTurn => ({ role: "sol", text: reminderNote(r), at }))].slice(-CHAT_KEPT);
    await save(q, businessId, email, row);
  }
  return row;
}

async function save(q: Q, businessId: string, email: string, row: Row): Promise<void> {
  await q(
    `update design_sol set turns = $3::jsonb, prefs = $4::jsonb, reminders = $5::jsonb, seen_at = $6, induction = $7::jsonb,
            updated_at = now()
      where business_id = $1 and email = $2`,
    [
      businessId,
      email,
      JSON.stringify(row.turns),
      JSON.stringify(row.prefs),
      JSON.stringify(row.reminders),
      row.seenAt,
      JSON.stringify(row.induction),
    ],
  );
}

const key = (email: string) => email.trim().toLowerCase();

/** The business's side of Sol: the owner's preferences for everyone, their choice, and who this person is in it. */
interface BusinessSide {
  prefs: SolPref[];
  scope: BusinessScope | null;
  owner: boolean;
  firstName: string | null;
  business: string;
}

async function businessSide(q: Q, businessId: string, email: string): Promise<BusinessSide> {
  const rows = await q<{ role: string | null; first_name: string | null; name: string | null; prefs: unknown; scope: string | null }>(
    `select m.role, m.first_name, b.name, sb.prefs, sb.scope
       from businesses b
       left join business_members m on m.business_id = b.id and m.email = $2
       left join design_sol_business sb on sb.business_id = b.id
      where b.id = $1`,
    [businessId, email],
  );
  const r = rows[0];
  return {
    prefs: cleanPrefs(r?.prefs),
    scope: cleanScope(r?.scope),
    owner: r?.role === "owner",
    firstName: r?.first_name?.trim() || null,
    business: r?.name ?? "",
  };
}

const stateOf = (row: Row, side: BusinessSide): SolState => ({
  turns: row.turns,
  prefs: row.prefs,
  reminders: upcoming(row.reminders),
  // Today's answers are read where they are given: only the panel's own count (sol-rooms.ts).
  unread: unreadOf(panelTurns(row.turns), row.seenAt),
  chats: chatsSoFar(row.pastCount, row.turns),
  businessPrefs: side.prefs,
  induction: { status: row.induction.status, scope: side.scope, owner: side.owner, firstName: side.firstName, business: side.business },
});

/** Reads the member's row (saying any reminders now due) and, given `change`, changes it in the same step. */
export async function withSol(
  businessId: string,
  email: string,
  change?: (row: Row) => Row | Promise<Row>,
  now = new Date(),
): Promise<SolState> {
  return transaction(async (q) => {
    let row = await locked(q, businessId, key(email), now);
    if (change) {
      row = await change(row);
      row.turns = row.turns.slice(-CHAT_KEPT);
      await save(q, businessId, key(email), row);
    }
    return stateOf(row, await businessSide(q, businessId, key(email)));
  });
}

/** The member's conversation as it stands (reminders now due said first). */
export const solState = (businessId: string, email: string) => withSol(businessId, email);

/** How many of Sol's lines the member hasn't seen. */
export async function solUnread(businessId: string, email: string): Promise<number> {
  return (await solState(businessId, email)).unread;
}

/** The conversation has been on screen: everything in it is seen. */
export const markSolSeen = (businessId: string, email: string) =>
  withSol(businessId, email, (row) => ({ ...row, seenAt: new Date().toISOString() }));

/** Clears the member's conversation; their pinned messages, preferences and reminders stay. */
export const clearSol = (businessId: string, email: string) =>
  withSol(businessId, email, (row) => ({ ...row, turns: row.turns.filter((t) => t.pinned), seenAt: new Date().toISOString() }));

/**
 * Adds a question and its answer; the answer counts as unread until the conversation is next on screen. `replacing`
 * (Try another answer) is when the question asked again was first said: it and what followed it come off in the same
 * step, so the new answer takes the old one's place.
 */
export const addSolTurns = (businessId: string, email: string, turns: SolTurn[], replacing?: string) =>
  withSol(businessId, email, (row) => ({
    ...row,
    turns: [...(replacing ? dropExchange(row.turns, replacing) : row.turns), ...turns],
    seenAt: row.seenAt ?? turns[0]?.at ?? null,
  }));

export const newSolId = () => randomUUID().slice(0, 12);

// ---------------------------------------------------------------------------
// Past conversations (domain/design/sol-history.ts)
// ---------------------------------------------------------------------------

/** The member's past conversations, locked with their row for this transaction. */
async function lockedPast(q: Q, businessId: string, email: string): Promise<{ turns: SolTurn[]; past: SolPast[] }> {
  await q(`insert into design_sol (business_id, email) values ($1, $2) on conflict do nothing`, [businessId, email]);
  const rows = await q<{ turns: unknown; past: unknown }>(
    `select turns, past from design_sol where business_id = $1 and email = $2 for update`,
    [businessId, email],
  );
  return { turns: cleanTurns(rows[0]?.turns), past: cleanPast(rows[0]?.past) };
}

const savePast = (q: Q, businessId: string, email: string, turns: SolTurn[], past: SolPast[]) =>
  q(
    `update design_sol set turns = $3::jsonb, past = $4::jsonb, seen_at = now(), updated_at = now() where business_id = $1 and email = $2`,
    [businessId, email, JSON.stringify(turns), JSON.stringify(past)],
  );

/** What the member has asked Sol, in every conversation: the words they see, for their box's suggestions. */
export async function solAsked(businessId: string, email: string): Promise<{ text: string; at: string }[]> {
  const { turns, past } = await transaction((q) => lockedPast(q, businessId, key(email)));
  return [...turns, ...past.flatMap((p) => p.turns)].filter((t) => t.role === "you").map((t) => ({ text: t.shown ?? t.text, at: t.at }));
}

/** The past conversations as the history lists them: titles and dates, not the messages. */
export async function solPast(businessId: string, email: string): Promise<SolPastLine[]> {
  return transaction(async (q) => pastLines((await lockedPast(q, businessId, key(email))).past));
}

/** One past conversation to read, or null when it isn't the member's. */
export async function solPastOne(businessId: string, email: string, id: string): Promise<SolPast | null> {
  return transaction(async (q) => (await lockedPast(q, businessId, key(email))).past.find((p) => p.id === id) ?? null);
}

/** A new chat: the conversation so far is filed away (its pinned messages carry on into the new one). */
export async function startNewSol(businessId: string, email: string): Promise<SolState> {
  await transaction(async (q) => {
    const { turns, past } = await lockedPast(q, businessId, key(email));
    await savePast(q, businessId, key(email), freshTurns(turns), fileAway(past, turns, newSolId()));
  });
  return solState(businessId, email);
}

/** A past conversation picked up again: the current one is filed away in its place. Null when it isn't there. */
export async function resumeSol(businessId: string, email: string, id: string): Promise<SolState | null> {
  const found = await transaction(async (q) => {
    const { turns, past } = await lockedPast(q, businessId, key(email));
    const back = past.find((p) => p.id === id);
    if (!back) return false;
    await savePast(
      q,
      businessId,
      key(email),
      back.turns,
      fileAway(
        past.filter((p) => p.id !== id),
        turns,
        newSolId(),
      ),
    );
    return true;
  });
  return found ? solState(businessId, email) : null;
}

/** A past conversation forgotten. */
export async function forgetSolPast(businessId: string, email: string, id: string): Promise<SolPastLine[]> {
  return transaction(async (q) => {
    const kept = (await lockedPast(q, businessId, key(email))).past.filter((p) => p.id !== id);
    await q(`update design_sol set past = $3::jsonb where business_id = $1 and email = $2`, [businessId, key(email), JSON.stringify(kept)]);
    return pastLines(kept);
  });
}

// ---------------------------------------------------------------------------
// The induction, and what Sol learns in the moment (domain/design/sol-induction.ts)
// ---------------------------------------------------------------------------

async function lockBusinessPrefs(q: Q, businessId: string): Promise<{ prefs: SolPref[]; scope: BusinessScope | null }> {
  await q(`insert into design_sol_business (business_id) values ($1) on conflict do nothing`, [businessId]);
  const rows = await q<{ prefs: unknown; scope: string | null }>(
    `select prefs, scope from design_sol_business where business_id = $1 for update`,
    [businessId],
  );
  return { prefs: cleanPrefs(rows[0]?.prefs), scope: cleanScope(rows[0]?.scope) };
}

const saveBusinessPrefs = (q: Q, businessId: string, prefs: SolPref[], scope: BusinessScope | null, by: string) =>
  q(`update design_sol_business set prefs = $2::jsonb, scope = $3, set_by = $4, updated_at = now() where business_id = $1`, [
    businessId,
    JSON.stringify(prefs),
    scope,
    by,
  ]);

/**
 * One induction answer kept as a preference, under its question's key so answering again replaces it: on the
 * business's list when the owner set the customer questions for everyone, else on the person's own. Null when there's
 * no such question.
 */
export async function answerInduction(businessId: string, email: string, questionKey: string, answer: string): Promise<SolState | null> {
  const question = questionByKey(questionKey);
  if (!question) return null;
  const who = key(email);
  const now = new Date();
  return transaction(async (q) => {
    const side = await businessSide(q, businessId, who);
    let row = await locked(q, businessId, who, now);
    if (keptFor(question, side) === "business") {
      const biz = await lockBusinessPrefs(q, businessId);
      await saveBusinessPrefs(
        q,
        businessId,
        withKeptPref(biz.prefs, inductionPrefId(question.key), question.keep(answer), now),
        biz.scope,
        who,
      );
    } else {
      row = { ...row, prefs: withKeptPref(row.prefs, inductionPrefId(question.key), question.keep(answer), now) };
      await save(q, businessId, who, row);
    }
    return stateOf(row, await businessSide(q, businessId, who));
  });
}

/**
 * The owner's choice for the customer questions. "all" moves the owner's own answers to them onto the business's
 * list, for everyone; "own" leaves each person to answer for themselves. Null when this person isn't the owner.
 */
export async function chooseScope(businessId: string, email: string, scope: BusinessScope): Promise<SolState | null> {
  const who = key(email);
  return transaction(async (q) => {
    const side = await businessSide(q, businessId, who);
    if (!side.owner) return null;
    const biz = await lockBusinessPrefs(q, businessId);
    let row = await locked(q, businessId, who, new Date());
    let prefs = biz.prefs;
    if (scope === "all") {
      const moving = row.prefs.filter((p) => p.id.startsWith("in-") && questionByKey(p.id.slice(3))?.scope === "business");
      for (const p of moving) prefs = withKeptPref(prefs, p.id, p.text, new Date(p.at));
      if (moving.length) {
        row = { ...row, prefs: row.prefs.filter((p) => !moving.includes(p)) };
        await save(q, businessId, who, row);
      }
    }
    await saveBusinessPrefs(q, businessId, prefs, scope, who);
    return stateOf(row, await businessSide(q, businessId, who));
  });
}

/** The induction finished, put off for later (a card on Today brings it back), or started again. */
export const setInductionStatus = (businessId: string, email: string, status: Induction["status"]) =>
  withSol(businessId, email, (row) => ({ ...row, induction: { ...row.induction, status, at: new Date().toISOString() } }));

/** The topics already asked about in the moment, and whether this conversation already has a question of his. */
export async function learnState(businessId: string, email: string): Promise<{ asked: string[]; askedThisChat: boolean }> {
  return transaction(async (q) => {
    const row = await locked(q, businessId, key(email), new Date());
    return { asked: row.induction.asked, askedThisChat: row.turns.some((t) => t.learn) };
  });
}

/** A topic Sol has asked about in the moment: never asked again. */
export const markLearnAsked = (businessId: string, email: string, topic: string) =>
  withSol(businessId, email, (row) =>
    row.induction.asked.includes(topic) ? row : { ...row, induction: { ...row.induction, asked: [...row.induction.asked, topic] } },
  );

/**
 * Their press on one of his questions (found by when his answer was said): kept as a preference with where it came
 * from, and the card marked answered. Null when there's no unanswered question there or the choice isn't one of its.
 */
export async function answerLearn(businessId: string, email: string, at: string, choice: string): Promise<SolState | null> {
  const now = new Date();
  let found = false;
  const state = await withSol(businessId, email, (row) => {
    const turn = row.turns.find((t) => t.role === "sol" && t.at === at && t.learn && !t.learn.answer);
    const ask = turn?.learn;
    if (!turn || !ask || !(ask.options.includes(choice) || choice === ASK_EACH_TIME)) return row;
    found = true;
    return {
      ...row,
      turns: row.turns.map((t) => (t === turn ? { ...t, learn: { ...ask, answer: choice } } : t)),
      prefs: withKeptPref(row.prefs, `ln-${ask.key}`.slice(0, 40), learnedPref(ask, choice), now, learnedFrom(ask, now)),
      induction: row.induction.asked.includes(ask.key) ? row.induction : { ...row.induction, asked: [...row.induction.asked, ask.key] },
    };
  });
  return found ? state : null;
}

/** One of the owner's preferences for everyone taken off. Null when this person isn't the owner. */
export async function forgetBusinessPref(businessId: string, email: string, id: string): Promise<SolState | null> {
  const who = key(email);
  return transaction(async (q) => {
    const side = await businessSide(q, businessId, who);
    if (!side.owner) return null;
    const biz = await lockBusinessPrefs(q, businessId);
    await saveBusinessPrefs(
      q,
      businessId,
      biz.prefs.filter((p) => p.id !== id),
      biz.scope,
      who,
    );
    const row = await locked(q, businessId, who, new Date());
    return stateOf(row, await businessSide(q, businessId, who));
  });
}

/**
 * What an agent writing on its own reads for the business's voice (sol-induction.ts `agentVoice`): the owner's
 * preferences for everyone, and the owner's own.
 */
export async function agentPrefs(businessId: string): Promise<{ business: SolPref[]; owner: SolPref[] }> {
  return transaction(async (q) => {
    const rows = await q<{ biz: unknown; own: unknown }>(
      `select sb.prefs as biz, s.prefs as own
         from businesses b
         left join design_sol_business sb on sb.business_id = b.id
         left join business_members m on m.business_id = b.id and m.role = 'owner'
         left join design_sol s on s.business_id = b.id and s.email = m.email
        where b.id = $1
        limit 1`,
      [businessId],
    );
    return { business: cleanPrefs(rows[0]?.biz), owner: cleanPrefs(rows[0]?.own) };
  });
}

export type { Row as SolRow };
