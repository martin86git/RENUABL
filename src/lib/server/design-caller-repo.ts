/**
 * Server only. A business's phone assistant as its customers meet it: the name it gives on calls and its picture
 * (domain/design/caller.ts). One row a business a role in `design_caller` (sales, and the admin assistant that books
 * installations: domain/install-call.ts), business id first as everywhere; no row is Sol with no picture. The picture is only ever kept as redrawn by `avatarImage`.
 */
import { agentPrefs } from "./design-sol-repo";
import { callVoice } from "@/lib/domain/design/sol-induction";
import {
  cleanBrain,
  cleanHiddenVoices,
  cleanTint,
  DEFAULT_CALLER,
  voiceProvider,
  type CallerBrain,
  type CallerVoice,
} from "@/lib/domain/design/caller";
import { roleOfKey, SALES_KEYS, type CallerKey } from "@/lib/domain/install-call";
import { cleanCoachChats, type CoachChat } from "@/lib/domain/design/coach-threads";
import { cleanNotes, cleanTurns, scriptLines, type CoachNote, type CoachTurn } from "@/lib/domain/design/coaching";
import { cleanDelivery, defaultDelivery, type Delivery } from "@/lib/domain/design/delivery";
import { DEFAULT_CALL_SETUP, cleanCallSetup, type CallAudience, type CallSetup } from "@/lib/domain/design/call-setup";
import { cleanScripts, liveName, type LiveScript, type SavedScript } from "@/lib/domain/design/call-scripts";
import { dbConfigured, query } from "./db";

export interface Caller {
  /** Which of the business's voice agents it is, by its key (domain/install-call.ts). */
  role: CallerKey;
  name: string;
  /** When the picture was last changed (for the browser's copy), or null when there is none. */
  photoAt: string | null;
  /** The voice it speaks in (Settings → Phone assistant), or null for the site's default. */
  voice: CallerVoice | null;
  /** Whether the business has set its assistant up (Settings → Phone assistant), not just been given Sol. */
  named: boolean;
  /** The colour chosen for its stand-in picture (caller.ts), or null to leave it to its name. */
  tint: number | null;
  /** The model it thinks with on calls (caller.ts CALLER_BRAINS), or null for RENUABL's default. */
  brain: CallerBrain | null;
}

/** The business's phone assistant: its name (Sol until named) and whether it has a picture. */
export async function callerOf(businessId: string, role: CallerKey = "sales"): Promise<Caller> {
  if (!dbConfigured()) return { role, name: DEFAULT_CALLER, photoAt: null, voice: null, named: false, tint: null, brain: null };
  const rows = await query<{
    name: string;
    photo_at: Date | null;
    voice_provider: string | null;
    voice_id: string | null;
    tint: number | null;
    brain: string | null;
  }>(`select name, photo_at, voice_provider, voice_id, tint, brain from design_caller where business_id = $1 and role = $2`, [
    businessId,
    role,
  ]);
  const row = rows[0];
  const provider = voiceProvider(row?.voice_provider);
  return {
    role,
    name: row?.name || DEFAULT_CALLER,
    photoAt: row?.photo_at ? new Date(row.photo_at).toISOString() : null,
    voice: provider && row?.voice_id ? { provider, voiceId: row.voice_id } : null,
    named: Boolean(row),
    tint: cleanTint(row?.tint),
    brain: cleanBrain(row?.brain),
  };
}

/** The model it thinks with on calls, already cleaned (cleanBrain); null leaves it to RENUABL's default. */
export async function setCallerBrain(
  businessId: string,
  brain: CallerBrain | null,
  by: string,
  role: CallerKey = "sales",
): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, brain, updated_by, role) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set brain = excluded.brain, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, brain, by, role],
  );
  return callerOf(businessId, role);
}

/** The colour of its stand-in picture, already cleaned (cleanTint); null leaves it to its name. */
export async function setCallerTint(businessId: string, tint: number | null, by: string, role: CallerKey = "sales"): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, tint, updated_by, role) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set tint = excluded.tint, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, tint, by, role],
  );
  return callerOf(businessId, role);
}

/** The business's sales agents past the first (keys sales-2 …), in order, only those that have been made. */
export async function moreSalesAgents(businessId: string): Promise<Caller[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ role: string }>(`select role from design_caller where business_id = $1 and role like 'sales-%'`, [businessId]);
  const keys = SALES_KEYS.filter((k) => k !== "sales" && rows.some((r) => r.role === k));
  return Promise.all(keys.map((k) => callerOf(businessId, k)));
}

/** The assistant's name, already cleaned (cleanCallerName). */
export async function setCallerName(businessId: string, name: string, by: string, role: CallerKey = "sales"): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, updated_by, role) values ($1, $2, $3, $4)
     on conflict (business_id, role) do update set name = excluded.name, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, name, by, role],
  );
  return callerOf(businessId, role);
}

/** The voice it speaks in, already cleaned (cleanVoice); null goes back to the site's default. */
export async function setCallerVoice(
  businessId: string,
  voice: CallerVoice | null,
  by: string,
  role: CallerKey = "sales",
): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, voice_provider, voice_id, updated_by, role) values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, role) do update set voice_provider = excluded.voice_provider, voice_id = excluded.voice_id,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, voice?.provider ?? null, voice?.voiceId ?? null, by, role],
  );
  return callerOf(businessId, role);
}

/** The assistant's picture, already redrawn (avatarImage); null takes it away. */
export async function setCallerPhoto(
  businessId: string,
  photo: { bytes: Buffer; contentType: string } | null,
  by: string,
  role: CallerKey = "sales",
): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, photo, photo_type, photo_at, updated_by, role)
     values ($1, $2, $3, $4, case when $3::bytea is null then null else now() end, $5, $6)
     on conflict (business_id, role) do update set photo = excluded.photo, photo_type = excluded.photo_type,
       photo_at = excluded.photo_at, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, photo?.bytes ?? null, photo?.contentType ?? null, by, role],
  );
  return callerOf(businessId, role);
}

/** The picture itself, for the business's own members. */
export async function callerPhoto(businessId: string, role: CallerKey = "sales"): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ photo: Buffer | null; photo_type: string | null }>(
    `select photo, photo_type from design_caller where business_id = $1 and role = $2`,
    [businessId, role],
  );
  const row = rows[0];
  return row?.photo && row.photo_type ? { bytes: row.photo, contentType: row.photo_type } : null;
}

/** The voices the business has taken off its list (caller.ts), for every agent's picker. */
export async function hiddenVoicesOf(businessId: string): Promise<string[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ hidden_voices: unknown }>(`select hidden_voices from businesses where id = $1`, [businessId]);
  return cleanHiddenVoices(rows[0]?.hidden_voices);
}

export async function saveHiddenVoices(businessId: string, hidden: string[]): Promise<string[]> {
  const clean = cleanHiddenVoices(hidden);
  await query(`update businesses set hidden_voices = $2 where id = $1`, [businessId, JSON.stringify(clean)]);
  return clean;
}

/** How the business has coached its assistant: the notes it keeps for every call, and the conversation so far. */
export async function coachingOf(businessId: string, role: CallerKey = "sales"): Promise<{ notes: CoachNote[]; turns: CoachTurn[] }> {
  if (!dbConfigured()) return { notes: [], turns: [] };
  const rows = await query<{ coach_notes: unknown; coach_chat: unknown }>(
    `select coach_notes, coach_chat from design_caller where business_id = $1 and role = $2`,
    [businessId, role],
  );
  return { notes: cleanNotes(rows[0]?.coach_notes), turns: cleanTurns(rows[0]?.coach_chat) };
}

/**
 * How the agent speaks (domain/design/delivery.ts): what the business chose, else its kind's own way (a sales agent
 * as a natural phone call, the post-sale one plainly).
 */
export async function deliveryOf(businessId: string, role: CallerKey = "sales"): Promise<Delivery> {
  const usual = defaultDelivery(roleOfKey(role) === "sales");
  if (!dbConfigured()) return usual;
  const rows = await query<{ delivery: unknown }>(`select delivery from design_caller where business_id = $1 and role = $2`, [
    businessId,
    role,
  ]);
  return rows[0]?.delivery ? cleanDelivery(rows[0].delivery) : usual;
}

export async function saveDelivery(businessId: string, delivery: Delivery | null, by: string, role: CallerKey = "sales"): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, delivery, updated_by, role) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set delivery = excluded.delivery, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, delivery ? JSON.stringify(delivery) : null, by, role],
  );
}

/** How the agent's name is said, who it rings and why (domain/design/call-setup.ts); the calls as they were until set. */
export async function callSetupOf(businessId: string, role: CallerKey = "sales"): Promise<CallSetup> {
  if (!dbConfigured()) return DEFAULT_CALL_SETUP;
  const rows = await query<{ call_setup: unknown }>(`select call_setup from design_caller where business_id = $1 and role = $2`, [
    businessId,
    role,
  ]);
  return rows[0]?.call_setup ? cleanCallSetup(rows[0].call_setup) : DEFAULT_CALL_SETUP;
}

export async function saveCallSetup(businessId: string, setup: CallSetup, by: string, role: CallerKey = "sales"): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, call_setup, updated_by, role) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set call_setup = excluded.call_setup, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, JSON.stringify(setup), by, role],
  );
}

/** The agent's scripts (domain/design/call-scripts.ts): the one in use, and the others filed away. */
export async function scriptBookOf(businessId: string, role: CallerKey = "sales"): Promise<{ live: LiveScript; saved: SavedScript[] }> {
  const rows = dbConfigured()
    ? await query<{ coach_notes: unknown; call_setup: unknown; script_name: unknown; scripts: unknown }>(
        `select coach_notes, call_setup, script_name, scripts from design_caller where business_id = $1 and role = $2`,
        [businessId, role],
      )
    : [];
  const r = rows[0];
  return {
    live: {
      name: liveName(r?.script_name),
      notes: cleanNotes(r?.coach_notes),
      setup: r?.call_setup ? cleanCallSetup(r.call_setup) : DEFAULT_CALL_SETUP,
    },
    saved: cleanScripts(r?.scripts),
  };
}

/** The scripts after a change (one started, chosen, renamed or removed), kept together. The chat stays. */
export async function saveScriptBook(
  businessId: string,
  book: { live: LiveScript; saved: SavedScript[] },
  by: string,
  role: CallerKey = "sales",
): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, coach_notes, call_setup, script_name, scripts, updated_by, role)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (business_id, role) do update set coach_notes = excluded.coach_notes, call_setup = excluded.call_setup,
       script_name = excluded.script_name, scripts = excluded.scripts, updated_by = excluded.updated_by, updated_at = now()`,
    [
      businessId,
      DEFAULT_CALLER,
      JSON.stringify(cleanNotes(book.live.notes)),
      JSON.stringify(cleanCallSetup(book.live.setup)),
      book.live.name,
      JSON.stringify(cleanScripts(book.saved)),
      by,
      role,
    ],
  );
}

/**
 * The agent's script as every call is given it, read fresh: the notes that guide how it talks, the rules locked in,
 * and how it speaks. Never throws: a call goes ahead with what could be read.
 */
export async function scriptFor(
  businessId: string,
  role: CallerKey = "sales",
): Promise<{
  coaching: string[];
  locked: string[];
  delivery: Delivery | null;
  assistantSaid: string | null;
  audience: CallAudience;
  reason: string | null;
  houseStyle: string[];
}> {
  const [c, delivery, setup, prefs] = await Promise.all([
    coachingOf(businessId, role).catch(() => null),
    // If it can't be read, the call goes as calls always did.
    deliveryOf(businessId, role).catch(() => null),
    callSetupOf(businessId, role).catch(() => DEFAULT_CALL_SETUP),
    // The owner's preferences from Sol's induction (sol-induction.ts): every voice agent follows them too.
    agentPrefs(businessId).catch(() => ({ business: [], owner: [] })),
  ]);
  return {
    ...scriptLines(c?.notes ?? []),
    delivery,
    // Its name as the voice says it, who it rings and why (call-setup.ts).
    assistantSaid: setup.saidAs || null,
    audience: setup.audience,
    reason: setup.reason || null,
    houseStyle: callVoice(prefs.business, prefs.owner),
  };
}

/** The chats before the one going (domain/design/coach-threads.ts), newest first. */
export async function coachChatsOf(businessId: string, role: CallerKey = "sales"): Promise<CoachChat[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ coach_past: unknown }>(`select coach_past from design_caller where business_id = $1 and role = $2`, [
    businessId,
    role,
  ]);
  return cleanCoachChats(rows[0]?.coach_past);
}

/** The chat going and the ones before it, kept together (a new chat, or an earlier one opened again). The notes stay. */
export async function saveCoachChats(
  businessId: string,
  c: { turns: CoachTurn[]; past: CoachChat[] },
  by: string,
  role: CallerKey = "sales",
): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, coach_chat, coach_past, updated_by, role) values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, role) do update set coach_chat = excluded.coach_chat, coach_past = excluded.coach_past,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, JSON.stringify(cleanTurns(c.turns)), JSON.stringify(cleanCoachChats(c.past)), by, role],
  );
}

/** The notes and conversation, already cleaned (cleanNotes, cleanTurns). */
export async function saveCoaching(
  businessId: string,
  c: { notes: CoachNote[]; turns: CoachTurn[] },
  by: string,
  role: CallerKey = "sales",
): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, coach_notes, coach_chat, updated_by, role) values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, role) do update set coach_notes = excluded.coach_notes, coach_chat = excluded.coach_chat,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, JSON.stringify(cleanNotes(c.notes)), JSON.stringify(cleanTurns(c.turns)), by, role],
  );
}
