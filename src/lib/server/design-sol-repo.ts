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
import { cleanPast, fileAway, freshTurns, pastLines, type SolPast, type SolPastLine } from "@/lib/domain/design/sol-history";
import { transaction } from "./db";
import type { Q } from "./design-crm-repo";

interface Row {
  turns: SolTurn[];
  prefs: SolPref[];
  reminders: SolReminder[];
  seenAt: string | null;
}

/** The member's row, locked for this transaction (made empty first when there is none), with due reminders said. */
async function locked(q: Q, businessId: string, email: string, now: Date): Promise<Row> {
  await q(`insert into design_sol (business_id, email) values ($1, $2) on conflict do nothing`, [businessId, email]);
  const rows = await q<{ turns: unknown; prefs: unknown; reminders: unknown; seen_at: Date | null }>(
    `select turns, prefs, reminders, seen_at from design_sol where business_id = $1 and email = $2 for update`,
    [businessId, email],
  );
  const row: Row = {
    turns: cleanTurns(rows[0]?.turns),
    prefs: cleanPrefs(rows[0]?.prefs),
    reminders: cleanReminders(rows[0]?.reminders),
    seenAt: rows[0]?.seen_at ? rows[0].seen_at.toISOString() : null,
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
    `update design_sol set turns = $3::jsonb, prefs = $4::jsonb, reminders = $5::jsonb, seen_at = $6, updated_at = now()
      where business_id = $1 and email = $2`,
    [businessId, email, JSON.stringify(row.turns), JSON.stringify(row.prefs), JSON.stringify(row.reminders), row.seenAt],
  );
}

const key = (email: string) => email.trim().toLowerCase();

const stateOf = (row: Row): SolState => ({
  turns: row.turns,
  prefs: row.prefs,
  reminders: upcoming(row.reminders),
  unread: unreadOf(row.turns, row.seenAt),
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
    return stateOf(row);
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

export type { Row as SolRow };
