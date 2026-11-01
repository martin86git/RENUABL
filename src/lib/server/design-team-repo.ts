/**
 * Server only. The team chat (domain/design/team-chat.ts): lines, files and when each member last had each room open,
 * in `design_team_lines`, `design_team_files` and `design_team_seen`. Under the designer's tenant rule (business id
 * first, from the signed-in member only). Every function checks the room is this member's to use (any channel, or a
 * direct conversation with another member of the business); a file is served only to someone who may read the room it
 * was sent in, and a deal card only to someone who may see that deal.
 */
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  SOL_BY,
  TEAM_CHANNELS,
  TEAM_LINES_SHOWN,
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

async function allowed(me: TeamMe, room: string): Promise<string[]> {
  const members = await membersOf(me.businessId);
  if (!mayUseRoom(room, me.email, members)) throw new TeamChatRefusal("That conversation isn't yours.");
  return members;
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
  const rooms = [...TEAM_CHANNELS.map((c) => c.id as string), ...others.map((o) => `dm:${[self, o].sort().join(",")}`)];
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
    channels: TEAM_CHANNELS.map((c) => ({ room: c.id as string, label: c.label, unread: unread[c.id] ?? 0 })),
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
  const channel = TEAM_CHANNELS.find((c) => c.id === room)?.label ?? "the team chat";
  for (const address of to)
    await sendEmail({
      to: address,
      ...teamTagEmail({ by: me.email, channel, text, link: `${site}/design?team=${room}` }),
      replyTo: me.email,
    }).catch(() => console.error("a team chat tag email couldn't be sent"));
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
  const answering = isTeamLineId(replyTo) ? replyTo : null;
  await query(
    `insert into design_team_lines (business_id, id, room, by_email, text, visuals, reply_to) values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [businessId, newId("tl", 10), room, SOL_BY, text.slice(0, 2000), JSON.stringify({ charts, diagrams }), answering],
  );
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
