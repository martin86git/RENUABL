import { cleanFollowWord, cleanMuted } from "@/lib/domain/design/feed-social";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { followsOf, setDigest, setFollow } from "@/lib/server/design-feed-social-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET → { follows }: what the member follows and mutes in the industry feed, and whether they get the Monday email. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, follows: await followsOf(who.member.email) });
  });
}

/**
 * POST { kind: "business", key, on } | { kind: "word", word, on } | { kind: "mute", topic, on } | { digest: boolean }:
 * follows or stops following a business or a word, mutes or unmutes a topic, or turns the Monday email on or off. Only
 * ever the member's own.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
    if (!allow(request, "feed-follow", 200)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const m = who.member;
    if (typeof b.digest === "boolean") await setDigest(m.email, b.digest);
    else {
      const on = b.on !== false;
      let problem: string | null = "Say what to follow.";
      if (b.kind === "business" && typeof b.key === "string" && /^[a-f0-9]{24}$/.test(b.key))
        problem = await setFollow(m, { kind: "business", key: b.key }, on);
      else if (b.kind === "word") {
        const word = cleanFollowWord(b.word);
        problem = word ? await setFollow(m, { kind: "word", word }, on) : "Type a word of two letters or more.";
      } else if (b.kind === "mute") {
        const topic = cleanMuted(b.topic);
        problem = topic ? await setFollow(m, { kind: "mute", topic }, on) : "That isn't a topic.";
      }
      if (problem) return Response.json({ ok: false, message: problem }, { status: 400 });
    }
    return Response.json({ ok: true, follows: await followsOf(m.email) });
  });
}
