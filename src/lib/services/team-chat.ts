/**
 * The team chat, as the screens ask for it (`/api/design/team`): a room and the rooms down the side, the unread count,
 * and each thing a member does in it.
 */
import type { TeamLine } from "@/lib/domain/design/team-chat";
import { ask, type Answer } from "./crm";

export interface TeamRoomView {
  room: string;
  lines: TeamLine[];
  members: string[];
  channels: { room: string; label: string; unread: number }[];
  people: { room: string; email: string; label: string; unread: number; last: string }[];
  unread: number;
}

export const loadTeamRoom = (room: string) => ask<TeamRoomView>(`/api/design/team?room=${encodeURIComponent(room)}`);
export const teamUnreadCount = () => ask<{ unread: number }>("/api/design/team?count=1");

const post = <T = Record<string, never>>(body: Record<string, unknown>) => ask<T>("/api/design/team", { method: "POST", body });

export const teamSeen = (room: string) => post({ room, seen: true });
export const editTeamLine = (id: string, text: string) => post({ edit: id, text });
export const deleteTeamLine = (id: string) => post({ delete: id });
export const reactToTeamLine = (id: string, emoji: string) => post({ react: id, emoji });

/** Says something: as JSON, or as a form when there are files. `replyTo` is the message it answers, when it is a reply. */
export async function sayInTeam(
  room: string,
  text: string,
  deals: string[],
  files: File[],
  replyTo?: string | null,
): Promise<Answer<{ line: TeamLine }>> {
  if (!files.length) return post<{ line: TeamLine }>({ room, text, deals, ...(replyTo ? { replyTo } : {}) });
  const form = new FormData();
  form.set("room", room);
  form.set("text", text);
  for (const d of deals) form.append("deal", d);
  for (const f of files) form.append("file", f);
  if (replyTo) form.set("replyTo", replyTo);
  try {
    const res = await fetch("/api/design/team", { method: "POST", body: form, cache: "no-store" });
    const json = (await res.json().catch(() => null)) as
      ({ ok?: boolean; message?: string; line?: TeamLine } & Record<string, unknown>) | null;
    if (res.ok && json?.ok && json.line) return { ok: true, line: json.line };
    return { ok: false, message: json?.message ?? "Those files couldn't be sent just now." };
  } catch {
    return { ok: false, message: "Those files couldn't be sent just now." };
  }
}

/** Said on the window to open the team chat, on a room when one is given (a tag's email link, `?team=`). */
export const TEAM_OPEN = "renuabl:team-open";
/** Said whenever the panel's unread count changes, so the rail follows. */
export const TEAM_CHANGED = "renuabl:team-changed";
/** The room last open, kept on this device. */
export const ROOM_KEY = "renuabl.design.team-room";
