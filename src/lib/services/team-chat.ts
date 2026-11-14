/**
 * The team chat, as the screens ask for it (`/api/design/team`): a room and the rooms down the side, the unread count,
 * and each thing a member does in it.
 */
import type { DealChatLine } from "@/lib/domain/design/deal-team";
import type { TeamLine } from "@/lib/domain/design/team-chat";
import type { CatchUp } from "@/lib/domain/design/sol-chat-work";
import { ask, type Answer } from "./crm";

export interface TeamRoomView {
  room: string;
  lines: TeamLine[];
  members: string[];
  /** `own`: a channel the business added itself (it can be removed). */
  channels: { room: string; label: string; unread: number; own?: boolean }[];
  people: { room: string; email: string; label: string; unread: number; last: string }[];
  /** With the deal chats followed (deal-team.ts). */
  unread: number;
  /** The deal chats this member follows, for the window's Deals section. */
  dealChats?: DealChatLine[];
  /** Whether Sol answers a channel's questions nobody has, without being tagged; and whether this member may switch it. */
  solJoinsIn?: boolean;
  maySwitchSol?: boolean;
  /** Whether this member may take a channel the business added away, and add a person to the business. */
  mayRemoveChannels?: boolean;
  mayAddPeople?: boolean;
  /** Whether this member sees costs, so Sol's order cards are theirs to answer. */
  seesCosts?: boolean;
}

export const loadTeamRoom = (room: string) => ask<TeamRoomView>(`/api/design/team?room=${encodeURIComponent(room)}`);
export const teamUnreadCount = () => ask<{ unread: number }>("/api/design/team?count=1");

const post = <T = Record<string, never>>(body: Record<string, unknown>) => ask<T>("/api/design/team", { method: "POST", body });

export const teamSeen = (room: string) => post({ room, seen: true });
export const editTeamLine = (id: string, text: string) => post({ edit: id, text });
export const deleteTeamLine = (id: string) => post({ delete: id });
export const reactToTeamLine = (id: string, emoji: string) => post({ react: id, emoji });
export const setSolJoinsIn = (on: boolean) => post<{ solJoinsIn: boolean }>({ solJoinsIn: on });
/** Adds a channel for the whole business; its name is cleaned on the server. */
export const addTeamChannel = (name: string) => post<{ channel: { id: string; label: string } }>({ addChannel: name });
/** Takes a channel the business added away, with what was said in it. */
export const removeTeamChannel = (id: string) => post({ removeChannel: id });
/** Presses Sol's card on one of his lines: does what it offers, or sets it aside. */
export const pressSolAction = (lineId: string, how: "do" | "dismiss") => post<{ words: string }>({ apply: lineId, how });
/** What happened in a channel since the member was last there (the lines unread when they opened it). */
export const catchUpRoom = (room: string, unread: number) => post<{ summary: CatchUp }>({ catchUp: room, unread });

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
