import { after } from "next/server";
import { asksSol, cleanDealIds, cleanRoom, cleanWords, isTeamLineId } from "@/lib/domain/design/team-chat";
import { parseApiKey } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { can } from "@/lib/domain/design/account";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";
import { solAnswersInChannel } from "@/lib/server/design-sol";
import { solStepsIn } from "@/lib/server/design-sol-joins";
import { catchUp, pressAction, solOffersWork } from "@/lib/server/design-sol-work";
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

/**
 * "@Sol" in a channel: he answers there once the line is in, as the member who tagged him. Untagged, a question nobody
 * answers in a moment may still be his to take (`solStepsIn`), unless the business has switched that off.
 */
function solHears(member: Member, room: string, text: string, lineId: string) {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  // Work said in passing ("Chloe's install moves to Thursday"): Sol offers a card to do it, at once.
  if (!asksSol(room, text)) {
    after(() =>
      solOffersWork(member, room, lineId, text, apiKey).catch((e) =>
        console.error("sol offering work", e instanceof Error ? e.message : e),
      ),
    );
    after(() =>
      solStepsIn(member, room, lineId, text, apiKey).catch((e) => console.error("sol joining in", e instanceof Error ? e.message : e)),
    );
    return;
  }
  // Asked by name to change something ("@Sol move Chloe's install to Friday", "@Sol mark the Lees installed"): his answer
  // is a Yes / No card. Anything else he answers in words.
  after(async () => {
    const carded = await solOffersWork(member, room, lineId, text, apiKey, true).catch((e) => {
      console.error("sol offering work", e instanceof Error ? e.message : e);
      return false;
    });
    if (carded) return;
    await solAnswersInChannel(member, room, text, apiKey).catch((e) =>
      console.error("sol in the team chat", e instanceof Error ? e.message : e),
    );
  });
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
      const [view, prefs] = await Promise.all([teamRoom(me, room), loadPrefs(who.member.businessId)]);
      const m = who.member;
      return Response.json({
        ok: true,
        ...view,
        solJoinsIn: prefs.solJoinsIn,
        maySwitchSol: can(m.role, "prices", m.permissions),
        // Whether Sol's order cards are theirs to answer (the server checks again on the press).
        seesCosts: can(m.role, "costs", m.permissions),
      });
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
        solHears(who.member, room, text, line.id);
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
      // A press on Sol's card: do what it offers, or set it aside.
      if (id(b.apply)) {
        const done = await pressAction(who.member, id(b.apply), b.how === "dismiss" ? "dismiss" : "do");
        return done.ok
          ? Response.json({ ok: true, words: done.words })
          : Response.json({ ok: false, message: done.message }, { status: 409 });
      }
      if (typeof b.catchUp === "string") {
        const room = cleanRoom(b.catchUp);
        if (!room) return Response.json({ ok: false, message: "There's no such conversation." }, { status: 404 });
        if (!allow(request, "design-team-catch-up", 60))
          return Response.json({ ok: false, message: "That's a lot of catching up this hour: try again shortly." }, { status: 429 });
        const summary = await catchUp(
          who.member,
          room,
          typeof b.unread === "number" ? b.unread : 0,
          parseApiKey(process.env.ANTHROPIC_API_KEY),
        );
        if (summary === "out") return Response.json({ ok: false, message: SOL_OUT_SHORT }, { status: 402 });
        if (!summary) return Response.json({ ok: false, message: "Catch up works in a channel." }, { status: 422 });
        return Response.json({ ok: true, summary });
      }
      if (typeof b.solJoinsIn === "boolean") {
        // Whether Sol steps in on the channels unasked: a business setting, so for those who change settings.
        const m = who.member;
        if (!can(m.role, "prices", m.permissions))
          return Response.json({ ok: false, message: "Only someone who changes the settings can switch this." }, { status: 403 });
        const prefs = await loadPrefs(m.businessId);
        const saved = await savePrefs(m.businessId, { ...prefs, solJoinsIn: b.solJoinsIn }, m.email);
        return Response.json({ ok: true, solJoinsIn: saved.solJoinsIn });
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
      solHears(who.member, room, text, line.id);
      return Response.json({ ok: true, line });
    } catch (e) {
      return refusal(e);
    }
  });
}
