import { can } from "@/lib/domain/design/account";
import { VOICE_STANDING_WORDS } from "@/lib/domain/design/add-ons";
import { scriptLines } from "@/lib/domain/design/call-scripts";
import { routineLive, routinesFor, type VoiceAgentFacts } from "@/lib/domain/design/routines";
import { countdownWords } from "@/lib/domain/design/sol-agents";
import { assistantDeals } from "@/lib/server/design-call-log-repo";
import { outbox } from "@/lib/server/design-sol-agents";
import type { CallerKey } from "@/lib/domain/install-call";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { callerOf, callSetupOf, moreSalesAgents, scriptBookOf, type Caller } from "@/lib/server/design-caller-repo";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { agentSettings } from "@/lib/server/design-routine-settings";
import { voiceStandingFor } from "@/lib/server/voice-calls";
import { cleanRoutine, customLive, customRoutineView, isRoutineId, type CustomRoutine } from "@/lib/domain/design/custom-routines";
import { customRoutines, deleteCustomRoutine, runningRuns, saveCustomRoutine } from "@/lib/server/design-custom-routines";
import { textsOnFor } from "@/lib/server/design-texts";

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
    const [own, runs, textsOn] = await Promise.all([
      customRoutines(businessId).catch(() => [] as CustomRoutine[]),
      runningRuns(businessId).catch(() => ({}) as Awaited<ReturnType<typeof runningRuns>>),
      textsOnFor(businessId).catch(() => false),
    ]);
    const nameOf = (agent: string) => (agent === "sol" ? "Sol" : (callers.find((c) => c.role === agent)?.name ?? "A voice agent"));
    const ownViews = own.map((r) =>
      customRoutineView(r, {
        agentName: nameOf(r.agent),
        agentKey: r.agent === "sol" ? undefined : r.agent,
        callsOn,
        callsWhy: callsOn ? undefined : VOICE_STANDING_WORDS[standing],
        textsOn,
      }),
    );
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
    for (const r of own)
      Object.assign(
        live,
        customLive(r, runs[r.id] ?? [], (iso, now) => countdownWords(iso, now)),
      );
    return Response.json({
      ok: true,
      routines: [...routines, ...ownViews],
      own,
      agents: [
        { key: "sol", name: "Sol", medium: "text" as const },
        ...callers.map((c) => ({ key: c.role as string, name: c.name, medium: "voice" as const })),
      ],
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

/**
 * POST { do: "save", id?, routine } makes or changes a routine of the business's own (custom-routines.ts); { do:
 * "delete", id } takes it away with its runs. Who may publish builds and changes them; switching one on (it then acts
 * on customers by itself) is the owner's, as switching Sol on is. Never while viewing as someone.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy)
      return Response.json({ ok: false, message: "You're viewing as someone: nothing can be changed." }, { status: 403 });
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email, role } = who.member;
    const b = read.body;
    const id = b.id == null ? null : isRoutineId(b.id) ? b.id : undefined;
    if (id === undefined) return Response.json({ ok: false, message: "That routine isn't there any more." }, { status: 404 });
    if (b.do === "delete") {
      if (!id || !(await deleteCustomRoutine(businessId, id)))
        return Response.json({ ok: false, message: "That routine isn't there any more." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (b.do !== "save") return Response.json({ ok: false, message: "That can't be done here." }, { status: 400 });
    const [sales, admin, more] = await Promise.all([
      callerOf(businessId, "sales"),
      callerOf(businessId, "admin"),
      moreSalesAgents(businessId).catch(() => [] as Caller[]),
    ]);
    const named = [sales, ...more, admin].filter((c) => c.named).map((c) => c.role as string);
    const clean = cleanRoutine(b.routine, named);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    const before = id ? (await customRoutines(businessId)).find((r) => r.id === id) : null;
    if (clean.routine.on && !before?.on && role !== "owner")
      return Response.json({ ok: false, message: "Only the business's owner can switch a routine on." }, { status: 403 });
    const saved = await saveCustomRoutine(businessId, id, clean.routine, email);
    if (!saved.ok) return Response.json({ ok: false, message: saved.message }, { status: saved.status });
    return Response.json({ ok: true, routine: saved.routine });
  });
}
