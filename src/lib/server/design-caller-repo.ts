/**
 * Server only. A business's phone assistant as its customers meet it: the name it gives on calls and its picture
 * (domain/design/caller.ts). One row a business in `design_caller`, business id first as everywhere; no row is Sol with
 * no picture. The picture is only ever kept as redrawn by `avatarImage`.
 */
import { DEFAULT_CALLER, type CallerVoice } from "@/lib/domain/design/caller";
import { dbConfigured, query } from "./db";

export interface Caller {
  name: string;
  /** When the picture was last changed (for the browser's copy), or null when there is none. */
  photoAt: string | null;
  /** The voice it speaks in (Settings → Phone assistant), or null for the site's default. */
  voice: CallerVoice | null;
}

/** The business's phone assistant: its name (Sol until named) and whether it has a picture. */
export async function callerOf(businessId: string): Promise<Caller> {
  if (!dbConfigured()) return { name: DEFAULT_CALLER, photoAt: null, voice: null };
  const rows = await query<{ name: string; photo_at: Date | null; voice_provider: string | null; voice_id: string | null }>(
    `select name, photo_at, voice_provider, voice_id from design_caller where business_id = $1`,
    [businessId],
  );
  const row = rows[0];
  const provider = row?.voice_provider === "vapi" || row?.voice_provider === "11labs" ? row.voice_provider : null;
  return {
    name: row?.name || DEFAULT_CALLER,
    photoAt: row?.photo_at ? new Date(row.photo_at).toISOString() : null,
    voice: provider && row?.voice_id ? { provider, voiceId: row.voice_id } : null,
  };
}

/** The assistant's name, already cleaned (cleanCallerName). */
export async function setCallerName(businessId: string, name: string, by: string): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, updated_by) values ($1, $2, $3)
     on conflict (business_id) do update set name = excluded.name, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, name, by],
  );
  return callerOf(businessId);
}

/** The voice it speaks in, already cleaned (cleanVoice); null goes back to the site's default. */
export async function setCallerVoice(businessId: string, voice: CallerVoice | null, by: string): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, voice_provider, voice_id, updated_by) values ($1, $2, $3, $4, $5)
     on conflict (business_id) do update set voice_provider = excluded.voice_provider, voice_id = excluded.voice_id,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, voice?.provider ?? null, voice?.voiceId ?? null, by],
  );
  return callerOf(businessId);
}

/** The assistant's picture, already redrawn (avatarImage); null takes it away. */
export async function setCallerPhoto(
  businessId: string,
  photo: { bytes: Buffer; contentType: string } | null,
  by: string,
): Promise<Caller> {
  await query(
    `insert into design_caller (business_id, name, photo, photo_type, photo_at, updated_by)
     values ($1, $2, $3, $4, case when $3::bytea is null then null else now() end, $5)
     on conflict (business_id) do update set photo = excluded.photo, photo_type = excluded.photo_type,
       photo_at = excluded.photo_at, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, DEFAULT_CALLER, photo?.bytes ?? null, photo?.contentType ?? null, by],
  );
  return callerOf(businessId);
}

/** The picture itself, for the business's own members. */
export async function callerPhoto(businessId: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ photo: Buffer | null; photo_type: string | null }>(
    `select photo, photo_type from design_caller where business_id = $1`,
    [businessId],
  );
  const row = rows[0];
  return row?.photo && row.photo_type ? { bytes: row.photo, contentType: row.photo_type } : null;
}
