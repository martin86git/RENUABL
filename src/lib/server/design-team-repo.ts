/**
 * Server only. The team chat (domain/design/team-chat.ts): lines, files and when each member last had each room open,
 * in `design_team_lines`, `design_team_files` and `design_team_seen`. Under the designer's tenant rule (business id
 * first, from the signed-in member only). Every function checks the room is this member's to use (any channel, or a
 * direct conversation with another member of the business); a file is served only to someone who may read the room it
 * was sent in, and a deal card only to someone who may see that deal.
 */
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { actionWords, cleanAction, type ChatAction } from "@/lib/domain/design/sol-chat-work";
import {
  SOL_BY,
  TEAM_CHANNELS,
  TEAM_LINES_SHOWN,
  channelNameProblem,
  cleanChannelName,
  isOwnChannelId,
  cleanDeals,
  cleanFiles,
  cleanReactions,
  cleanVisuals,
  isChannel,
  isTeamLineId,
  replyQuote,
  mayUseRoom,
  roomLabel,
  tags,
  teamFileName,
  teamFilesProblem,
  teamTagEmail,
  toggledReaction,
  unreadByRoom,
  TEAM_FILE_TYPES,
  type OwnChannel,
  type TeamDeal,
  type TeamFile,
  type TeamLine,
  type TeamReply,
} from "@/lib/domain/design/team-chat";
import type { DealViewer } from "@/lib/domain/design/account";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query, randomToken, transaction } from "./db";
import { jobById, listJobs } from "./design-crm-repo";
import { emailProvider, sendEmail } from "./email";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export class TeamChatRefusal extends Error {}

export interface TeamMe {
  businessId: string;
  email: string;
  viewer?: DealViewer;
}

async function membersOf(businessId: string): Promise<string[]> {
  return (await query<{ email: string }>(`select email from business_members where business_id = $1`, [businessId])).map((m) =>
    m.email.toLowerCase(),
  );
}

/** The channels this business has added itself, oldest first. */
async function ownChannels(businessId: string): Promise<OwnChannel[]> {
  return query<OwnChannel>(`select id, label from design_team_channels where business_id = $1 order by at, id`, [businessId]);
}

/** A channel's name for this business (one it starts with, or one it added), or null when the room isn't a channel of its. */
export async function teamChannelLabel(businessId: string, room: string): Promise<string | null> {
  const fixed = TEAM_CHANNELS.find((c) => c.id === room);
  if (fixed) return fixed.label;
  if (!isOwnChannelId(room)) return null;
  const rows = await query<{ label: string }>(`select label from design_team_channels where business_id = $1 and id = $2`, [
    businessId,
    room,
  ]);
  return rows[0]?.label ?? null;
}

async function allowed(me: TeamMe, room: string): Promise<string[]> {
  const members = await membersOf(me.businessId);
  // A channel the business added is its own only while it is still there (a removed one, or another business's id, isn't).
  const own = isOwnChannelId(room) ? (await ownChannels(me.businessId)).map((c) => c.id) : [];
  if (!mayUseRoom(room, me.email, members, own)) throw new TeamChatRefusal("That conversation isn't yours.");
  return members;
}

/** Adds a channel for the whole business, by a member; its name cleaned and not one already there. */
export async function addTeamChannel(me: TeamMe, raw: unknown): Promise<OwnChannel> {
  const label = cleanChannelName(raw);
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext($1))`, [`team-channels:${me.businessId}`]);
    const own = await q<OwnChannel>(`select id, label from design_team_channels where business_id = $1`, [me.businessId]);
    const problem = channelNameProblem(label, own);
    if (problem) throw new TeamChatRefusal(problem);
    const id = `ch_${randomToken(6)}`;
    await q(`insert into design_team_channels (business_id, id, label, by_email) values ($1, $2, $3, $4)`, [
      me.businessId,
      id,
      label,
      me.email.toLowerCase(),
    ]);
    return { id, label };
  });
}

/** Takes away a channel the business added, with everything said in it and the files sent there. */
export async function removeTeamChannel(me: TeamMe, room: string): Promise<boolean> {
  if (!isOwnChannelId(room)) return false;
  return transaction(async (q) => {
    const gone = await q<{ id: string }>(`delete from design_team_channels where business_id = $1 and id = $2 returning id`, [
      me.businessId,
      room,
    ]);
    if (!gone.length) return false;
    const lines = await q<{ files: unknown }>(`delete from design_team_lines where business_id = $1 and room = $2 returning files`, [
      me.businessId,
      room,
    ]);
    const files = lines.flatMap((l) => cleanFiles(l.files).map((f) => f.id));
    if (files.length) await q(`delete from design_team_files where business_id = $1 and id = any($2)`, [me.businessId, files]);
    await q(`delete from design_team_seen where business_id = $1 and room = $2`, [me.businessId, room]);
    return true;
  });
}

interface Row {
  id: string;
  room: string;
  by: string;
  text: string;
  files: unknown;
  deals: unknown;
  reactions: unknown;
  at: string;
  edited: string | null;
  reply_to: string | null;
  visuals: unknown;
}

const LINE = `id, room, by_email as by, text, files, deals, reactions, ${moment("at")} as at, ${moment("edited_at")} as edited, reply_to, visuals`;

function lineOf(r: Row, seeDeal: (id: string) => boolean, replies: ReadonlyMap<string, TeamReply> = new Map()): TeamLine {
  const files = cleanFiles(r.files);
  const deals = cleanDeals(r.deals).filter((d) => seeDeal(d.id));
  const reactions = cleanReactions(r.reactions);
  // Pictures only ever on Sol's lines.
  const { charts, diagrams } = r.by === SOL_BY ? cleanVisuals(r.visuals) : { charts: [], diagrams: [] };
  // Work Sol offers, only when the reader may see the deal it is for.
  const offered = r.by === SOL_BY ? cleanAction((r.visuals as { action?: unknown } | null)?.action) : null;
  const action = offered && (!offered.jobId || seeDeal(offered.jobId)) ? offered : null;
  return {
    id: r.id,
    room: r.room,
    by: r.by,
    text: r.text,
    at: r.at,
    ...(r.edited ? { edited: r.edited } : {}),
    ...(files.length ? { files } : {}),
    ...(deals.length ? { deals } : {}),
    ...(Object.keys(reactions).length ? { reactions } : {}),
    ...(charts.length ? { charts } : {}),
    ...(diagrams.length ? { diagrams } : {}),
    ...(action ? { action } : {}),
    ...(r.reply_to ? { replyTo: replies.get(r.reply_to) ?? { id: r.reply_to, by: "", text: "", gone: true } } : {}),
  };
}

/** The messages some lines answer, as their quotes: read fresh (so an edit shows), only from the same room. One missing has been deleted. */
async function quotesFor(businessId: string, room: string, rows: readonly Row[]): Promise<Map<string, TeamReply>> {
  const ids = [...new Set(rows.map((r) => r.reply_to).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  const found = await query<{ id: string; by: string; text: string; files: unknown; deals: unknown; visuals: unknown }>(
    `select id, by_email as by, text, files, deals, visuals from design_team_lines where business_id = $1 and room = $2 and id = any($3)`,
    [businessId, room, ids],
  );
  return new Map(
    found.map((q) => [
      q.id,
      {
        id: q.id,
        by: q.by,
        text: replyQuote({ text: q.text, files: cleanFiles(q.files), deals: cleanDeals(q.deals), ...cleanVisuals(q.visuals) }),
      },
    ]),
  );
}

/** The deals this member may see, for showing deal cards: every deal when they see them all. */
async function dealSight(me: TeamMe): Promise<(id: string) => boolean> {
  if (!me.viewer || me.viewer.all) return () => true;
  const mine = new Set((await listJobs(me.businessId, me.viewer)).map((j) => j.id));
  return (id) => mine.has(id);
}

/** The rooms down the side: each channel, and a direct conversation with each other member, with unread counts. */
async function roomsFor(me: TeamMe, members: string[]) {
  const self = me.email.toLowerCase();
  const others = members.filter((m) => m !== self);
  const own = await ownChannels(me.businessId);
  const channels: { id: string; label: string; own?: true }[] = [...TEAM_CHANNELS, ...own.map((c) => ({ ...c, own: true as const }))];
  const rooms = [...channels.map((c) => c.id), ...others.map((o) => `dm:${[self, o].sort().join(",")}`)];
  const [recent, seenRows] = await Promise.all([
    query<{ room: string; by: string; at: string }>(
      `select room, by_email as by, ${moment("at")} as at from design_team_lines
        where business_id = $1 and room = any($2) and at > now() - interval '30 days' order by at desc limit 2000`,
      [me.businessId, rooms],
    ),
    query<{ room: string; at: string }>(
      `select room, ${moment("seen_at")} as at from design_team_seen where business_id = $1 and email = $2`,
      [me.businessId, self],
    ),
  ]);
  const seen = Object.fromEntries(seenRows.map((r) => [r.room, r.at]));
  const unread = unreadByRoom(recent, seen, self, new Date());
  const last: Record<string, string> = {};
  for (const r of recent) last[r.room] ??= r.at;
  return {
    channels: channels.map((c) => ({ room: c.id, label: c.label, unread: unread[c.id] ?? 0, ...(c.own ? { own: true } : {}) })),
    people: others
      .map((o) => {
        const room = `dm:${[self, o].sort().join(",")}`;
        return { room, email: o, label: roomLabel(room, self), unread: unread[room] ?? 0, last: last[room] ?? "" };
      })
      .sort((a, b) => b.last.localeCompare(a.last) || a.label.localeCompare(b.label)),
    unread: Object.values(unread).reduce((a, b) => a + b, 0),
  };
}

/** A room as this member sees it: its latest lines (oldest first), the rooms down the side and the team's emails. */
export async function teamRoom(me: TeamMe, room: string) {
  const members = await allowed(me, room);
  const [rows, rooms, sees] = await Promise.all([
    query<Row>(`select ${LINE} from design_team_lines where business_id = $1 and room = $2 order by at desc, id desc limit $3`, [
      me.businessId,
      room,
      TEAM_LINES_SHOWN,
    ]),
    roomsFor(me, members),
    dealSight(me),
  ]);
  const replies = await quotesFor(me.businessId, room, rows);
  return { room, lines: rows.reverse().map((r) => lineOf(r, sees, replies)), members, ...rooms };
}

/** How many lines from others this member hasn't seen, across every room they may read. */
export async function teamUnread(me: TeamMe): Promise<number> {
  return (await roomsFor(me, await membersOf(me.businessId))).unread;
}

/** The room has been on screen: its lines are seen. */
export async function markTeamSeen(me: TeamMe, room: string): Promise<void> {
  await allowed(me, room);
  await query(
    `insert into design_team_seen (business_id, email, room, seen_at) values ($1, $2, $3, now())
       on conflict (business_id, email, room) do update set seen_at = now()`,
    [me.businessId, me.email.toLowerCase(), room],
  );
}

/** The deal cards for ids dropped in with #: only deals the writer may see, read from the business's own deals. */
async function dealCards(me: TeamMe, ids: readonly string[]): Promise<TeamDeal[]> {
  const out: TeamDeal[] = [];
  for (const id of ids) {
    const got = await jobById(me.businessId, id, me.viewer);
    if (got)
      out.push({
        id: got.job.id,
        name: `${got.customer.name} · ${got.job.title}`,
        address: got.job.address,
        stage: STAGE_LABELS[got.job.stage],
      });
  }
  return out;
}

/**
 * Says something in a room: the words, any files (kept in the database, checked by type and size) and deal cards. The
 * writer has the room open from then. Members tagged in a channel are emailed (when email is set up), each on its own.
 * Answers with the line.
 */
export async function sayInTeam(
  me: TeamMe,
  room: string,
  said: { text: string; files: readonly File[]; dealIds: readonly string[]; replyTo?: string | null },
): Promise<TeamLine> {
  const members = await allowed(me, room);
  const problem = said.files.length ? teamFilesProblem(said.files) : null;
  if (problem) throw new TeamChatRefusal(problem);
  const deals = await dealCards(me, said.dealIds);
  if (!said.text && !said.files.length && !deals.length) throw new TeamChatRefusal("Write something first.");
  // A reply answers a message still in this room; anything else is sent as an ordinary line.
  const replyTo = said.replyTo
    ? ((
        await query<{ id: string }>(`select id from design_team_lines where business_id = $1 and room = $2 and id = $3`, [
          me.businessId,
          room,
          said.replyTo,
        ])
      )[0]?.id ?? null)
    : null;
  const id = newId("tl", 10);
  const by = me.email.toLowerCase();
  const files: TeamFile[] = [];
  await transaction(async (q) => {
    for (const f of said.files) {
      const file = { id: `tf_${randomToken(10)}`, name: teamFileName(f.name, f.type), type: f.type, size: f.size };
      await q(`insert into design_team_files (business_id, id, name, type, size, bytes, by_email) values ($1,$2,$3,$4,$5,$6,$7)`, [
        me.businessId,
        file.id,
        file.name,
        file.type,
        file.size,
        Buffer.from(await f.arrayBuffer()),
        by,
      ]);
      files.push(file);
    }
    await q(
      `insert into design_team_lines (business_id, id, room, by_email, text, files, deals, reply_to) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
      [me.businessId, id, room, by, said.text, JSON.stringify(files), JSON.stringify(deals), replyTo],
    );
    await q(
      `insert into design_team_seen (business_id, email, room, seen_at) values ($1, $2, $3, now())
         on conflict (business_id, email, room) do update set seen_at = now()`,
      [me.businessId, by, room],
    );
  });
  if (isChannel(room) && said.text) await tellTagged(me, room, said.text, members);
  const rows = await query<Row>(`select ${LINE} from design_team_lines where business_id = $1 and id = $2`, [me.businessId, id]);
  return lineOf(rows[0], () => true, await quotesFor(me.businessId, room, rows));
}

async function tellTagged(me: TeamMe, room: string, text: string, members: string[]): Promise<void> {
  const site = siteUrl();
  if (!emailProvider() || !site) return;
  const to = members.filter((m) => m !== me.email.toLowerCase() && tags(text, m));
  const channel = (await teamChannelLabel(me.businessId, room)) ?? "the team chat";
  for (const address of to)
    await sendEmail({
      to: address,
      ...teamTagEmail({ by: me.email, channel, text, link: `${site}/design?team=${room}` }),
      // Sol has no mailbox: a tag from him isn't answered by email.
      ...(me.email === SOL_BY ? {} : { replyTo: me.email }),
    }).catch(() => console.error("a team chat tag email couldn't be sent"));
}

/** Emails the members Sol tags in a line of his (handing a question to the teammate who usually answers it). */
export async function tellTaggedBySol(businessId: string, room: string, text: string): Promise<void> {
  if (!isChannel(room)) return;
  await tellTagged({ businessId, email: SOL_BY }, room, text, await membersOf(businessId));
}

/** Sol's answer in a channel, written as Sol; `replyTo`, the line he answers (as a reply quotes it). */
export async function solSaysInTeam(
  businessId: string,
  room: string,
  text: string,
  visuals?: unknown,
  replyTo?: string | null,
): Promise<void> {
  if (!isChannel(room)) return;
  const { charts, diagrams } = cleanVisuals(visuals);
  const action = cleanAction((visuals as { action?: unknown } | null | undefined)?.action);
  const answering = isTeamLineId(replyTo) ? replyTo : null;
  await query(
    `insert into design_team_lines (business_id, id, room, by_email, text, visuals, reply_to) values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [
      businessId,
      newId("tl", 10),
      room,
      SOL_BY,
      text.slice(0, 2000),
      JSON.stringify({ charts, diagrams, ...(action ? { action } : {}) }),
      answering,
    ],
  );
}

/** The work Sol offered on one of his lines, in a room this member may use, with the room; null when there is none. */
export async function offeredAction(me: TeamMe, lineId: string): Promise<{ room: string; action: ChatAction } | null> {
  const rows = await query<{ room: string; visuals: unknown }>(
    `select room, visuals from design_team_lines where business_id = $1 and id = $2 and by_email = $3`,
    [me.businessId, lineId, SOL_BY],
  );
  const row = rows[0];
  if (!row) return null;
  await allowed(me, row.room);
  const action = cleanAction((row.visuals as { action?: unknown } | null)?.action);
  return action ? { room: row.room, action } : null;
}

/** Marks the work on Sol's line done or set aside, kept with the line; false when someone else got there first. */
export async function settleAction(businessId: string, lineId: string, how: "done" | "dismissed", by: string): Promise<boolean> {
  const stamp = JSON.stringify({ by: by.toLowerCase(), at: new Date().toISOString() });
  const rows = await query(
    `update design_team_lines set visuals = jsonb_set(visuals, $4::text[], $5::jsonb)
      where business_id = $1 and id = $2 and by_email = $3 and visuals ? 'action'
        and not (visuals->'action' ? 'done') and not (visuals->'action' ? 'dismissed')
      returning id`,
    [businessId, lineId, SOL_BY, `{action,${how}}`, stamp],
  );
  return rows.length > 0;
}

/** A room's latest lines from others (and Sol), oldest first, for a catch-up: as many as were unread when it was opened. */
export async function latestFromOthers(me: TeamMe, room: string, n: number): Promise<{ by: string; text: string; at: string }[]> {
  await allowed(me, room);
  const rows = await query<{ by: string; text: string; at: string; visuals: unknown }>(
    `select by_email as by, text, ${moment("at")} as at, visuals from design_team_lines
      where business_id = $1 and room = $2 and by_email <> $3 order by at desc limit $4`,
    [me.businessId, room, me.email.toLowerCase(), n],
  );
  // Sol's offers read as the work they offer, and whether it was done: only for a deal this member may see (3 Nov 2026,
  // a bug review: the catch-up named deals the line itself hides from them).
  const seeDeal = await dealSight(me);
  return rows.reverse().map((r) => {
    const offered = r.by === SOL_BY ? cleanAction((r.visuals as { action?: unknown } | null)?.action) : null;
    const action = offered && (!offered.jobId || seeDeal(offered.jobId)) ? offered : null;
    const text = action
      ? `Offered: ${actionWords(action)} (${action.done ? `done by ${action.done.by}` : action.dismissed ? "set aside" : "not done yet"})`
      : r.text;
    return { by: r.by, text, at: r.at };
  });
}

/** A channel's history for telling who answers what: ids, writers, words and what each answers, oldest first. */
export async function roomHistory(
  businessId: string,
  room: string,
  n = 400,
): Promise<{ history: { id: string; by: string; text: string; replyTo: string | null }[]; members: string[] }> {
  if (!isChannel(room)) return { history: [], members: [] };
  const [rows, members] = await Promise.all([
    query<{ id: string; by: string; text: string; replyTo: string | null }>(
      `select id, by_email as by, text, reply_to as "replyTo" from design_team_lines where business_id = $1 and room = $2 order by at desc limit $3`,
      [businessId, room, n],
    ),
    membersOf(businessId),
  ]);
  return { history: rows.reverse(), members };
}

/** A channel's last lines, as Sol reads them for context: who said what. */
export async function channelContext(businessId: string, room: string, n = 12): Promise<{ by: string; text: string }[]> {
  if (!isChannel(room)) return [];
  const rows = await query<{ by: string; text: string }>(
    `select by_email as by, text from design_team_lines where business_id = $1 and room = $2 order by at desc limit $3`,
    [businessId, room, n],
  );
  return rows.reverse();
}

async function ownLine(me: TeamMe, id: string): Promise<Row> {
  const rows = await query<Row>(`select ${LINE} from design_team_lines where business_id = $1 and id = $2`, [me.businessId, id]);
  const line = rows[0];
  if (!line) throw new TeamChatRefusal("That message isn't there any more.");
  await allowed(me, line.room);
  return line;
}

/** A line's words changed by the person who wrote it. */
export async function editTeamLine(me: TeamMe, id: string, text: string): Promise<void> {
  const line = await ownLine(me, id);
  if (line.by !== me.email.toLowerCase()) throw new TeamChatRefusal("Only the person who wrote a message can change it.");
  if (!text && !cleanFiles(line.files).length && !cleanDeals(line.deals).length)
    throw new TeamChatRefusal("Write something first, or delete the message.");
  if (text === line.text) return;
  await query(`update design_team_lines set text = $3, edited_at = now() where business_id = $1 and id = $2`, [me.businessId, id, text]);
}

/** A line taken out by the person who wrote it, with the files it carried. */
export async function deleteTeamLine(me: TeamMe, id: string): Promise<void> {
  const line = await ownLine(me, id);
  if (line.by !== me.email.toLowerCase()) throw new TeamChatRefusal("Only the person who wrote a message can delete it.");
  const fileIds = cleanFiles(line.files).map((f) => f.id);
  await transaction(async (q) => {
    await q(`delete from design_team_lines where business_id = $1 and id = $2`, [me.businessId, id]);
    if (fileIds.length) await q(`delete from design_team_files where business_id = $1 and id = any($2)`, [me.businessId, fileIds]);
  });
}

/** This member's reaction put on a line, or taken off when it is already theirs. */
export async function reactToTeamLine(me: TeamMe, id: string, emoji: string): Promise<void> {
  await transaction(async (q) => {
    const rows = await q<{ room: string; reactions: unknown }>(
      `select room, reactions from design_team_lines where business_id = $1 and id = $2 for update`,
      [me.businessId, id],
    );
    if (!rows[0]) throw new TeamChatRefusal("That message isn't there any more.");
    await allowed(me, rows[0].room);
    let next: Record<string, string[]>;
    try {
      next = toggledReaction(cleanReactions(rows[0].reactions), me.email, emoji);
    } catch (e) {
      throw new TeamChatRefusal(e instanceof Error ? e.message : "Choose one of the emojis offered.");
    }
    await q(`update design_team_lines set reactions = $3::jsonb where business_id = $1 and id = $2`, [
      me.businessId,
      id,
      JSON.stringify(next),
    ]);
  });
}

/** A file sent in the team chat, for a member who may read the room it was sent in; null otherwise. */
export async function teamFile(me: TeamMe, fileId: string): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  const files = await query<{ name: string; type: string; bytes: Buffer }>(
    `select name, type, bytes from design_team_files where business_id = $1 and id = $2`,
    [me.businessId, fileId],
  );
  if (!files[0] || !TEAM_FILE_TYPES[files[0].type]) return null;
  const lines = await query<{ room: string }>(`select room from design_team_lines where business_id = $1 and files @> $2::jsonb limit 1`, [
    me.businessId,
    JSON.stringify([{ id: fileId }]),
  ]);
  if (!lines[0]) return null;
  const members = await membersOf(me.businessId);
  return mayUseRoom(lines[0].room, me.email, members) ? files[0] : null;
}
