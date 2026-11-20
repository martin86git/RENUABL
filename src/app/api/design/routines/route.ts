import { can } from "@/lib/domain/design/account";
import { VOICE_STANDING_WORDS } from "@/lib/domain/design/add-ons";
import { scriptLines } from "@/lib/domain/design/call-scripts";
import { routineLive, routinesFor, type VoiceAgentFacts } from "@/lib/domain/design/routines";
import { countdownWords } from "@/lib/domain/design/sol-agents";
import { assistantDeals } from "@/lib/server/design-call-log-repo";
import { outbox } from "@/lib/server/design-sol-agents";
import type { CallerKey } from "@/lib/domain/install-call";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
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
    // What each step is doing now: Sol's outbox as this member may see it (read only: nothing is started or sent by
    // looking), and each voice agent's own deals.
    const viewer = viewerOf(who.member);
    const [box, calls] = await Promise.all([
      outbox(who.member, viewer, true).then(
        (o) => o.outbox,
        () => null,
      ),
      Promise.all(voice.map(async (v) => [v.key, await assistantDeals(businessId, viewer, v.key as CallerKey).catch(() => [])] as const)),
    ]);
    const live = routineLive(
      routines,
      {
        outbox: (box?.entries ?? []).map((e) => ({
          kind: e.kind,
          jobId: e.jobId,
          customer: e.customer,
          firesAt: e.firesAt,
          state: e.state,
        })),
        sent: (box?.sent ?? []).map((s) => ({ kind: s.kind ?? "", jobId: s.jobId, customer: s.customer, at: s.at })),
        calls: Object.fromEntries(
          calls.map(([key, list]) => [
            key,
            list.map((d) => ({ jobId: d.jobId, customer: d.customer, standing: d.standing, dueAt: d.dueAt })),
          ]),
        ),
      },
      (iso, now) => countdownWords(iso, now),
    );
    return Response.json({
      ok: true,
      routines,
      live,
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
