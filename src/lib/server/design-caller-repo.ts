/**
 * Server only. A business's phone assistant as its customers meet it: the name it gives on calls and its picture
 * (domain/design/caller.ts). One row a business a role in `design_caller` (sales, and the admin assistant that books
 * installations: domain/install-call.ts), business id first as everywhere; no row is Sol with no picture. The picture is only ever kept as redrawn by `avatarImage`.
 */
import { DEFAULT_CALLER, type CallerVoice } from "@/lib/domain/design/caller";
import type { CallerRole } from "@/lib/domain/install-call";
import { cleanCoachChats, type CoachChat } from "@/lib/domain/design/coach-threads";
import { cleanNotes, cleanTurns, type CoachNote, type CoachTurn } from "@/lib/domain/design/coaching";
import { dbConfigured, query } from "./db";

export interface Caller {
  /** Which of the business's two assistants it is (domain/install-call.ts). */
  role: CallerRole;
  name: string;
  /** When the picture was last changed (for the browser's copy), or null when there is none. */
  photoAt: string | null;
  /** The voice it speaks in (Settings → Phone assistant), or null for the site's default. */
  voice: CallerVoice | null;
  /** Whether the business has set its assistant up (Settings → Phone assistant), not just been given Sol. */
  named: boolean;
}

/** The business's phone assistant: its name (Sol until named) and whether it has a picture. */
export async function callerOf(businessId: string, role: CallerRole = "sales"): Promise<Caller> {
  if (!dbConfigured()) return { role, name: DEFAULT_CALLER, photoAt: null, voice: null, named: false };
  const rows = await query<{ name: string; photo_at: Date | null; voice_provider: string | null; voice_id: string | null }>(
    `select name, photo_at, voice_provider, voice_id from design_caller where business_id = $1 and role = $2`,
    [businessId, role],
  );
  const row = rows[0];
  const provider = row?.voice_provider === "vapi" || row?.voice_provider === "11labs" ? row.voice_provider : null;
  return {
    role,
    name: row?.name || DEFAULT_CALLER,
    photoAt: row?.photo_at ? new Date(row.photo_at).toISOString() : null,
    voice: provider && row?.voice_id ? { provider, voiceId: row.voice_id } : null,
    named: Boolean(row),
  };
}

/** The assistant's name, already cleaned (cleanCallerName). */
export async function setCallerName(businessId: string, name: string, by: string, role: CallerRole = "sales"): Promise<Caller> {
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
  role: CallerRole = "sales",
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
  role: CallerRole = "sales",
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
export async function callerPhoto(businessId: string, role: CallerRole = "sales"): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ photo: Buffer | null; photo_type: string | null }>(
    `select photo, photo_type from design_caller where business_id = $1 and role = $2`,
    [businessId, role],
  );
  const row = rows[0];
  return row?.photo && row.photo_type ? { bytes: row.photo, contentType: row.photo_type } : null;
}

/** How the business has coached its assistant: the notes it keeps for every call, and the conversation so far. */
export async function coachingOf(businessId: string, role: CallerRole = "sales"): Promise<{ notes: CoachNote[]; turns: CoachTurn[] }> {
  if (!dbConfigured()) return { notes: [], turns: [] };
  const rows = await query<{ coach_notes: unknown; coach_chat: unknown }>(
    `select coach_notes, coach_chat from design_caller where business_id = $1 and role = $2`,
    [businessId, role],
  );
  return { notes: cleanNotes(rows[0]?.coach_notes), turns: cleanTurns(rows[0]?.coach_chat) };
}

/** The chats before the one going (domain/design/coach-threads.ts), newest first. */
export async function coachChatsOf(businessId: string, role: CallerRole = "sales"): Promise<CoachChat[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ coach_past: unknown }>(`select coach_past from design_caller where business_id = $1 and role = $2`, [
    businessId,
    role,
  ]);
  return cleanCoachChats(rows[0]?.coach_past);
}

/** The chat going and the ones before it, kept together (a new chat, or an earlier one opened again). The notes stay. */
export async function saveCoachChats(businessId: string, c: { turns: CoachTurn[]; past: CoachChat[] }, by: string): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, coach_chat, coach_past, updated_by) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set coach_chat = excluded.coach_chat, coach_past = excluded.coach_past,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, JSON.stringify(cleanTurns(c.turns)), JSON.stringify(cleanCoachChats(c.past)), by],
  );
}

/** The notes and conversation, already cleaned (cleanNotes, cleanTurns). */
export async function saveCoaching(businessId: string, c: { notes: CoachNote[]; turns: CoachTurn[] }, by: string): Promise<void> {
  await query(
    `insert into design_caller (business_id, name, coach_notes, coach_chat, updated_by) values ($1, $2, $3, $4, $5)
     on conflict (business_id, role) do update set coach_notes = excluded.coach_notes, coach_chat = excluded.coach_chat,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, JSON.stringify(cleanNotes(c.notes)), JSON.stringify(cleanTurns(c.turns)), by],
  );
}
