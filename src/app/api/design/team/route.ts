import { after } from "next/server";
import { asksSol, cleanDealIds, cleanRoom, cleanWords, isTeamLineId } from "@/lib/domain/design/team-chat";
import { parseApiKey } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { solAnswersInChannel } from "@/lib/server/design-sol";
import {
  TeamChatRefusal,
  deleteTeamLine,
  editTeamLine,
  markTeamSeen,
  reactToTeamLine,
  sayInTeam,
  teamRoom,
  teamUnread,
  type TeamMe,
} from "@/lib/server/design-team-repo";
import type { Member } from "@/lib/server/design-repo";
import { allow } from "@/lib/server/rate-limit";

// Sol, tagged in a channel, answers after the line is in: his tools can take a minute.
export const maxDuration = 180;

const refusal = (e: unknown): Response => {
  if (e instanceof TeamChatRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
  throw e;
};

const meOf = (member: Member): TeamMe => ({ businessId: member.businessId, email: member.email, viewer: viewerOf(member) });

/** "@Sol" in a channel: he answers there once the line is in, as the member who tagged him. */
function askSolIfTagged(member: Member, room: string, text: string) {
  if (!asksSol(room, text)) return;
  after(() =>
    solAnswersInChannel(member, room, text, parseApiKey(process.env.ANTHROPIC_API_KEY)).catch((e) =>
      console.error("sol in the team chat", e instanceof Error ? e.message : e),
    ),
  );
}

/**
 * The team chat (domain/design/team-chat.ts). GET ?room= → the room as this member sees it (Deals when left out);
 * GET ?count=1 → only how many lines are unread. POST JSON { room, text, deals } says something, { room, seen: true }
 * marks it read, { edit: id, text }, { delete: id }, { react: id, emoji }; POST a form (room, text, deal…, file…) sends
 * files with the words.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const me = meOf(who.member);
    const url = new URL(request.url);
    if (url.searchParams.get("count")) return Response.json({ ok: true, unread: await teamUnread(me) });
    const room = cleanRoom(url.searchParams.get("room") ?? "deals");
    if (!room) return Response.json({ ok: false, message: "There's no such conversation." }, { status: 404 });
    try {
      return Response.json({ ok: true, ...(await teamRoom(me, room)) });
    } catch (e) {
      return refusal(e);
    }
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const me = meOf(who.member);
    try {
      if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
        if (!allow(request, "design-team-files", 120))
          return Response.json({ ok: false, message: "That's a lot of files this hour: try again shortly." }, { status: 429 });
        const form = await request.formData().catch(() => null);
        if (!form) return Response.json({ ok: false, message: "Those files couldn't be read." }, { status: 400 });
        const room = cleanRoom(form.get("room"));
        if (!room) return Response.json({ ok: false, message: "There's no such conversation." }, { status: 404 });
        const text = cleanWords(form.get("text"));
        const files = form.getAll("file").filter((f): f is File => f instanceof File);
        const replyTo = form.get("replyTo");
        const line = await sayInTeam(me, room, {
          text,
          files,
          dealIds: cleanDealIds(form.getAll("deal")),
          replyTo: isTeamLineId(replyTo) ? replyTo : null,
        });
        askSolIfTagged(who.member, room, text);
        return Response.json({ ok: true, line });
      }
      const read = await readBody(request, 40_000);
      if ("refuse" in read) return read.refuse;
      const b = read.body;
      const id = (v: unknown) => (typeof v === "string" ? v.slice(0, 40) : "");
      if (id(b.edit)) {
        await editTeamLine(me, id(b.edit), cleanWords(b.text));
        return Response.json({ ok: true });
      }
      if (id(b.delete)) {
        await deleteTeamLine(me, id(b.delete));
        return Response.json({ ok: true });
      }
      if (id(b.react)) {
        await reactToTeamLine(me, id(b.react), typeof b.emoji === "string" ? b.emoji : "");
        return Response.json({ ok: true });
      }
      const room = cleanRoom(b.room);
      if (!room) return Response.json({ ok: false, message: "There's no such conversation." }, { status: 404 });
      if (b.seen === true) {
        await markTeamSeen(me, room);
        return Response.json({ ok: true });
      }
      if (!allow(request, "design-team", 600))
        return Response.json({ ok: false, message: "That's a lot of messages this hour: try again shortly." }, { status: 429 });
      const text = cleanWords(b.text);
      const line = await sayInTeam(me, room, {
        text,
        files: [],
        dealIds: cleanDealIds(b.deals),
        replyTo: isTeamLineId(b.replyTo) ? b.replyTo : null,
      });
      askSolIfTagged(who.member, room, text);
      return Response.json({ ok: true, line });
    } catch (e) {
      return refusal(e);
    }
  });
}
