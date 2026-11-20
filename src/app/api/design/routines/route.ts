import { can } from "@/lib/domain/design/account";
import { VOICE_STANDING_WORDS } from "@/lib/domain/design/add-ons";
import { scriptLines } from "@/lib/domain/design/call-scripts";
import { routinesFor, type VoiceAgentFacts } from "@/lib/domain/design/routines";
import { answer, requireMember } from "@/lib/server/design-context";
import { callerOf, callSetupOf, moreSalesAgents, scriptBookOf, type Caller } from "@/lib/server/design-caller-repo";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { agentSettings } from "@/lib/server/design-routine-settings";
import { voiceStandingFor } from "@/lib/server/voice-calls";

/**
 * GET: the business's routines (domain/design/routines.ts), each agent's flow read from what really drives it, with
 * the settings behind them and who may change what. Changes go through the routes that already own them: Sol's
 * agents' settings (PUT /api/design/sol-agents) and each voice agent's script and setup (PUT /api/design/caller/coach).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, businessName, role, permissions } = who.member;
    const [settings, brand, standing, sales, admin, more] = await Promise.all([
      agentSettings(businessId),
      loadBrand(businessId, businessName),
      voiceStandingFor(businessId).catch(() => "not-set-up" as const),
      callerOf(businessId, "sales"),
      callerOf(businessId, "admin"),
      moreSalesAgents(businessId).catch(() => [] as Caller[]),
    ]);
    const callers = [sales, ...more, admin].filter((c) => c.named);
    const voice: VoiceAgentFacts[] = await Promise.all(
      callers.map(async (c) => {
        const [setup, book] = await Promise.all([callSetupOf(businessId, c.role), scriptBookOf(businessId, c.role)]);
        return {
          key: c.role,
          name: c.name,
          role: c.role === "admin" ? ("admin" as const) : ("sales" as const),
          first: c.role === "sales",
          audience: setup.audience,
          reason: setup.reason,
          saidAs: setup.saidAs,
          script: book.live.name,
          scripts: scriptLines(book.live, book.saved).map((s) => ({ id: s.id, name: s.name })),
        };
      }),
    );
    const callsOn = standing === "on";
    const routines = routinesFor({
      settings,
      solAnswers: brand.solAnswers,
      callsOn,
      callsWhy: callsOn ? undefined : VOICE_STANDING_WORDS[standing],
      voice,
    });
    return Response.json({
      ok: true,
      routines,
      settings,
      voice: voice.map((v) => ({
        key: v.key,
        setup: { saidAs: v.saidAs ?? "", audience: v.audience, reason: v.reason },
        scripts: v.scripts,
      })),
      // Who may change what: the hours, waits and days anyone who may publish; switching Sol on or off the owner; a
      // voice agent's script whoever may change settings.
      may: {
        settings: can(role, "publish", permissions),
        onOff: role === "owner",
        voice: can(role, "prices", permissions),
      },
      readOnly: Boolean(who.member.viewedBy),
    });
  });
}
