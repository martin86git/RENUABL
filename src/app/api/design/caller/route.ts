import { can } from "@/lib/domain/design/account";
import { cleanBrain, cleanCallerName, cleanTint, cleanVoice, hideVoice, showVoice, VOICE_BAD } from "@/lib/domain/design/caller";
import { cleanCallerKey } from "@/lib/domain/install-call";
import {
  callerOf,
  hiddenVoicesOf,
  moreSalesAgents,
  pronunciationsOf,
  saveHiddenVoices,
  savePronunciations,
  setCallerName,
  setCallerBrain,
  setCallerTint,
  setCallerVoice,
} from "@/lib/server/design-caller-repo";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { query } from "@/lib/server/db";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { textsOnFor } from "@/lib/server/design-texts";
import { after } from "next/server";
import { speakingProviders, warmClips } from "@/lib/server/voice-samples";
import { voiceOnFor } from "@/lib/server/voice-calls";

// Time for the voice samples to be made after the answer (warmClips).
export const maxDuration = 60;

/** GET: the business's phone assistant (its name, whether it has a picture), the name it speaks for, and whether its calls are on. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const id = who.member.businessId;
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [id]);
    const [caller, admin, more, callsOn, textsOn, brand, hiddenVoices, pronounce] = await Promise.all([
      callerOf(id),
      // The admin assistant, which rings sold customers to book their installation (domain/install-call.ts).
      callerOf(id, "admin"),
      // The sales agents past the first, each with its own name, voice and script.
      moreSalesAgents(id),
      voiceOnFor(id).catch(() => false),
      textsOnFor(id).catch(() => false),
      loadBrand(id, biz[0]?.name ?? ""),
      // The voices the business has taken off its list.
      hiddenVoicesOf(id).catch(() => []),
      // How particular words are said on calls, for every agent (pronounce.ts).
      pronunciationsOf(id).catch(() => []),
    ]);
    // Setting it up is for an admin: whoever may change the business's settings.
    const mayChange = can(who.member.role, "prices", who.member.permissions);
    // Every voice's solar sample made ahead, so the play button doesn't wait for it.
    after(() => warmClips());
    return Response.json({
      ok: true,
      caller,
      admin,
      more,
      callsOn,
      textsOn,
      mayChange,
      business: brand.name || biz[0]?.name || "",
      hiddenVoices,
      pronounce,
      // The makers whose voices can speak the solar sample line (their key is set): the rest play the maker's clip.
      speakers: speakingProviders(),
    });
  });
}

/** PUT { name } or { voice }, with { role } for the admin assistant: the name it gives on calls, or the voice it speaks in (null: the default), for a member who may change settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const role = cleanCallerKey(read.body.role);
    if (Array.isArray(read.body.pronounce)) {
      // How particular words are said, for every agent the business has (pronounce.ts): the whole list, cleaned.
      return Response.json({ ok: true, pronounce: await savePronunciations(who.member.businessId, read.body.pronounce) });
    }
    if (read.body.voices && typeof read.body.voices === "object") {
      // A voice taken off the business's list, or brought back (caller.ts): put away, never deleted.
      const v = read.body.voices as Record<string, unknown>;
      const was = await hiddenVoicesOf(who.member.businessId);
      const next = v.all === true ? [] : typeof v.hide === "string" ? hideVoice(was, v.hide) : showVoice(was, v.show);
      return Response.json({ ok: true, hiddenVoices: await saveHiddenVoices(who.member.businessId, next) });
    }
    if ("brain" in read.body) {
      // The model it thinks with on calls: quicker or more careful, or null for RENUABL's default (caller.ts).
      return Response.json({
        ok: true,
        caller: await setCallerBrain(who.member.businessId, cleanBrain(read.body.brain), who.member.email, role),
      });
    }
    if ("tint" in read.body) {
      // The colour of its stand-in picture: one of the six, or null for its name's own.
      return Response.json({
        ok: true,
        caller: await setCallerTint(who.member.businessId, cleanTint(read.body.tint), who.member.email, role),
      });
    }
    if ("voice" in read.body) {
      const voice = cleanVoice(read.body.voice);
      if (voice === "bad") return Response.json({ ok: false, message: VOICE_BAD }, { status: 422 });
      return Response.json({ ok: true, caller: await setCallerVoice(who.member.businessId, voice, who.member.email, role) });
    }
    const name = cleanCallerName(read.body.name);
    if (!name.ok) return Response.json({ ok: false, message: name.message }, { status: 422 });
    // Each agent has a name of its own: customers and the team tell them apart by it.
    const id = who.member.businessId;
    const others = [await callerOf(id), await callerOf(id, "admin"), ...(await moreSalesAgents(id))].filter(
      (c) => c.named && c.role !== role,
    );
    if (others.some((c) => c.name.toLowerCase() === name.value.toLowerCase()))
      return Response.json(
        { ok: false, message: `You already have an agent called ${name.value}. Give this one a name of its own.` },
        { status: 422 },
      );
    return Response.json({ ok: true, caller: await setCallerName(who.member.businessId, name.value, who.member.email, role) });
  });
}
