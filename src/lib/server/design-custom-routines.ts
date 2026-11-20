/**
 * Server only. Routines a business builds itself (domain/design/custom-routines.ts), kept in `design_routines`, and
 * each one's run on a deal in `design_routine_runs` (business id first in both, from the signed-in member or the cron
 * only). `runCustomRoutines` starts the deals a routine's trigger catches and moves each run on, from the ten-minute
 * cron: a wait until it's over, a check that stops the run when it no longer holds, and an action through the agent's
 * usual way (Sol's outbox for an email, the deal's texts for a text, `queueCall` for a call), each with its own guards.
 */
import { normaliseMobile } from "@/lib/domain/contact";
import { STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import {
  CUSTOM_LIMITS,
  SOL_AGENT,
  checkHolds,
  routineProblem,
  routineWritePrompt,
  startsOn,
  waitOver,
  type CleanRoutine,
  type CustomRoutine,
  type CustomStep,
  type RunLine,
} from "@/lib/domain/design/custom-routines";
import type { PreparedItem } from "@/lib/domain/design/prepared";
import { DRAFT_SCHEMA, cleanDraft, signOff } from "@/lib/domain/design/prepared";
import { withinHours } from "@/lib/domain/design/sol-agents";
import { signedText, textSignOff } from "@/lib/domain/design/texts";
import type { CallerKey } from "@/lib/domain/install-call";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { newId, query } from "./db";
import { addActivity, jobById } from "./design-crm-repo";
import { memberTextsOnDeal } from "./design-deal-team-repo";
import { isDemoBusiness } from "./design-demo-check";
import { businessVoice } from "./design-prepared";
import { loadBrand } from "./design-proposal-repo";
import { agentSettings } from "./design-routine-settings";
import { keepText, textFrom, textsOnFor, textsStopped } from "./design-texts";
import { withSolCredit } from "./sol-credits";
import { sendSms } from "./sms";
import { queueCall } from "./voice-calls";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Who a routine's work is written by on the deal. */
export const ROUTINE_BY = "sol";

const fromRow = (r: { id: string; routine: CustomRoutine; updatedAt: string }): CustomRoutine => ({
  ...r.routine,
  id: r.id,
  updatedAt: r.updatedAt,
});

export async function customRoutines(businessId: string): Promise<CustomRoutine[]> {
  const rows = await query<{ id: string; routine: CustomRoutine; updatedAt: string }>(
    `select id, routine, ${moment("updated_at")} as "updatedAt" from design_routines where business_id = $1 order by created_at`,
    [businessId],
  );
  return rows.map(fromRow);
}

export type SaveResult = { ok: true; routine: CustomRoutine } | { ok: false; message: string; status: number };

/**
 * Keeps a routine made or changed (`id` null makes one). Switching it on needs something to do (`routineProblem`) and
 * stamps when, so only deals that start it from then are caught; a routine already on keeps its time.
 */
export async function saveCustomRoutine(
  businessId: string,
  id: string | null,
  clean: Extract<CleanRoutine, { ok: true }>["routine"],
  by: string,
): Promise<SaveResult> {
  const before = id
    ? (
        await query<{ routine: CustomRoutine }>(`select routine from design_routines where business_id = $1 and id = $2`, [businessId, id])
      )[0]
    : null;
  if (id && !before) return { ok: false, message: "That routine isn't there any more.", status: 404 };
  if (clean.on) {
    const problem = routineProblem(clean);
    if (problem) return { ok: false, message: problem, status: 422 };
  }
  const onAt = clean.on ? (before?.routine.on && before.routine.onAt ? before.routine.onAt : new Date().toISOString()) : null;
  const routine = { ...clean, onAt };
  if (!id) {
    const count = await query<{ n: number }>(`select count(*)::int as n from design_routines where business_id = $1`, [businessId]);
    if ((count[0]?.n ?? 0) >= CUSTOM_LIMITS.routines)
      return { ok: false, message: `A business can have up to ${CUSTOM_LIMITS.routines} routines of its own.`, status: 409 };
    const made = await query<{ id: string; routine: CustomRoutine; updatedAt: string }>(
      `insert into design_routines (business_id, id, routine, updated_by) values ($1, $2, $3::jsonb, $4)
       returning id, routine, ${moment("updated_at")} as "updatedAt"`,
      [businessId, newId("rt", 12), JSON.stringify(routine), by.toLowerCase()],
    );
    return { ok: true, routine: fromRow(made[0]) };
  }
  const saved = await query<{ id: string; routine: CustomRoutine; updatedAt: string }>(
    `update design_routines set routine = $3::jsonb, updated_at = now(), updated_by = $4 where business_id = $1 and id = $2
     returning id, routine, ${moment("updated_at")} as "updatedAt"`,
    [businessId, id, JSON.stringify(routine), by.toLowerCase()],
  );
  // A step taken away: runs that were past the end finish next time round (the runner reads the steps fresh).
  return { ok: true, routine: fromRow(saved[0]) };
}

export async function deleteCustomRoutine(businessId: string, id: string): Promise<boolean> {
  const gone = await query(`delete from design_routines where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return gone.length > 0;
}

/** The runs going now, by routine, with each deal's customer: for the live lines. */
export async function runningRuns(businessId: string): Promise<Record<string, RunLine[]>> {
  const rows = await query<RunLine & { routineId: string }>(
    `select r.routine_id as "routineId", r.job_id as "jobId", r.step, ${moment("r.step_at")} as "stepAt",
            c.name as customer
       from design_routine_runs r
       join design_jobs j on j.business_id = r.business_id and j.id = r.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where r.business_id = $1 and r.status = 'running' order by r.step_at`,
    [businessId],
  );
  const out: Record<string, RunLine[]> = {};
  for (const { routineId, ...line } of rows) (out[routineId] ??= []).push({ ...line, customer: line.customer || "Customer" });
  return out;
}

/** Every business with a routine of its own switched on, for the cron. */
export async function routineBusinesses(): Promise<{ id: string; name: string }[]> {
  return query(
    `select b.id, b.name from businesses b where exists (select 1 from design_routines r where r.business_id = b.id and r.routine->>'on' = 'true')`,
  );
}

// ---------------------------------------------------------------------------
// Running.

/** At most this many runs moved on a business each time, so one busy business can't hold up the cron. */
const RUNS_A_TIME = 40;

async function enrol(businessId: string, r: CustomRoutine): Promise<void> {
  if (!r.onAt) return;
  const stage: JobStage = r.trigger.kind === "new-lead" ? "lead" : r.trigger.stage;
  const found = await query<{ jobId: string; stage: JobStage; createdAt: string; movedAt: string | null }>(
    `select j.id as "jobId", j.stage, ${moment("j.created_at")} as "createdAt",
            (select ${moment("max(a.at)")} from design_activity a where a.business_id = j.business_id and a.job_id = j.id and a.text = $3) as "movedAt"
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.stage = $2 and not c.sample
        and greatest(j.created_at, j.updated_at) >= $4::timestamptz
        and not exists (select 1 from design_routine_runs x where x.business_id = j.business_id and x.routine_id = $5 and x.job_id = j.id)
      limit 50`,
    [businessId, stage, `Moved to ${STAGE_LABELS[stage]}`, r.onAt, r.id],
  );
  for (const d of found.filter((d) => startsOn(r, d)))
    await query(
      `insert into design_routine_runs (business_id, routine_id, job_id, start_stage) values ($1, $2, $3, $4) on conflict do nothing`,
      [businessId, r.id, d.jobId, d.stage],
    );
}

interface Run {
  routineId: string;
  jobId: string;
  step: number;
  stepAt: string;
  startStage: JobStage;
  startedAt: string;
}

type Outcome = { next: true; did: string } | { next: false } | { stop: string };

async function writeWithSol(
  businessId: string,
  kind: "email" | "text",
  about: string,
  facts: { business: string; customer: string; title: string; stage: JobStage },
): Promise<{ subject: string; body: string } | null> {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return null;
  try {
    const voice = await businessVoice(businessId);
    const drafted = await withSolCredit(
      businessId,
      "follow-up",
      null,
      async (ai) =>
        cleanDraft(await readWithClaude<unknown>([], DRAFT_SCHEMA, routineWritePrompt({ kind, about, ...facts, voice }), apiKey, ai)),
      kind === "email" ? "deep" : "quick",
      "routine",
    );
    return drafted === "out" ? null : drafted;
  } catch (e) {
    console.error("a routine's message couldn't be written", redactSecrets(e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function act(business: { id: string; name: string }, r: CustomRoutine, run: Run, step: CustomStep, now: Date): Promise<Outcome> {
  const found = await jobById(business.id, run.jobId);
  if (!found) return { stop: "The deal is gone" };
  const { job, customer } = found;
  if (job.stage === "lost") return { stop: "The deal was lost" };
  const settings = await agentSettings(business.id);
  switch (step.kind) {
    case "wait":
      return waitOver(step, run.stepAt, now) ? { next: true, did: "Waited" } : { next: false };
    case "check": {
      const [replied, signed] = await Promise.all([
        query<{ n: number }>(
          `select ((select count(*) from design_messages m where m.business_id = $1 and m.job_id = $2 and m.from_customer and m.at > $3::timestamptz)
                 + (select count(*) from design_texts t where t.business_id = $1 and t.job_id = $2 and t.direction = 'in' and t.at > $3::timestamptz))::int as n`,
          [business.id, run.jobId, run.startedAt],
        ),
        query<{ n: number }>(
          `select count(*)::int as n from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
            where p.business_id = $1 and p.job_id = $2 and v.accepted_at is not null`,
          [business.id, run.jobId],
        ),
      ]);
      const holds = checkHolds(step.test, {
        replied: (replied[0]?.n ?? 0) > 0,
        signed: (signed[0]?.n ?? 0) > 0,
        stage: job.stage,
        startStage: run.startStage,
      });
      return holds ? { next: true, did: "Checked" } : { stop: `A check didn't hold (${step.test})` };
    }
    case "email": {
      if (!EMAIL.test(customer.email)) return { next: true, did: "No email on file: skipped the email" };
      const brand = await loadBrand(business.id, business.name);
      const name = brand.name || business.name;
      const words = await writeWithSol(business.id, "email", step.about, {
        business: name,
        customer: customer.firstName || customer.name,
        title: job.title,
        stage: job.stage,
      });
      const id = newId("prep", 10);
      const item: PreparedItem & { held?: boolean; notBefore?: string } = {
        id,
        kind: "routine",
        jobId: job.id,
        customerId: customer.id,
        customer: customer.name,
        title: job.title,
        why: `From your routine "${r.name}"`,
        to: customer.email,
        subject: words?.subject || `A note from ${name}`,
        body: words
          ? [words.body.trim(), signOff(name)].join("\n\n")
          : `Write this one yourself: Sol couldn't write it.\n\nIt was to be about: ${step.about}`,
        basis: [`Routine: ${r.name}`, `What it's about: ${step.about}`],
        day: 0,
        by: words ? "sol" : "plain",
        status: "ready",
        createdAt: now.toISOString(),
        // Counts down in the outbox for the usual review time, then goes inside the business's hours; one Sol
        // couldn't write waits for a person.
        ...(words ? { notBefore: new Date(now.getTime() + settings.reviewMinutes * 60_000).toISOString() } : { held: true }),
      };
      await query(
        `insert into design_prepared (id, business_id, job_id, key, kind, status, item) values ($1, $2, $3, $4, 'routine', 'ready', $5::jsonb)
         on conflict (business_id, key) do nothing`,
        [id, business.id, job.id, `routine:${r.id}:${job.id}:${step.id}`, JSON.stringify(item)],
      );
      return { next: true, did: words ? "Email lined up in Sol's outbox" : "Email waiting for you to write" };
    }
    case "text": {
      if (!withinHours(now, settings.hours)) return { next: false };
      if (!(await textsOnFor(business.id))) return { next: true, did: "Texts aren't on: skipped the text" };
      const mobile = normaliseMobile(customer.phone);
      if (!mobile) return { next: true, did: "No mobile on file: skipped the text" };
      if (await textsStopped(business.id, customer.id)) return { next: true, did: "They replied STOP: skipped the text" };
      if (await isDemoBusiness(business.id)) return { next: true, did: "A demo sends nothing" };
      const brand = await loadBrand(business.id, business.name);
      const name = brand.name || business.name;
      const words = await writeWithSol(business.id, "text", step.about, {
        business: name,
        customer: customer.firstName || customer.name,
        title: job.title,
        stage: job.stage,
      });
      if (!words) return { next: true, did: "Sol couldn't write the text: skipped" };
      const text = signedText(words.body.slice(0, 320), textSignOff(null, name));
      if ((await sendSms(mobile, text, await textFrom(business.id))) !== "sent") return { next: true, did: "The text couldn't be sent" };
      await keepText(business.id, { jobId: job.id, customerId: customer.id, direction: "out", mobile, text, by: ROUTINE_BY }).catch(
        () => null,
      );
      await memberTextsOnDeal(business.id, job.id, ROUTINE_BY, text).catch(() => null);
      await addActivity(
        business.id,
        customer.id,
        { kind: "note", text: `Texted ${mobile} by the routine "${r.name}": ${text}`.slice(0, 2000), jobId: job.id },
        ROUTINE_BY,
      ).catch(() => null);
      return { next: true, did: "Texted" };
    }
    case "call": {
      const placed = await queueCall({
        businessId: business.id,
        jobId: job.id,
        mode: r.agent === "admin" ? "install" : "lead",
        asked: false,
        source: `Routine: ${r.name}`,
        ...(r.agent === "admin" ? {} : { agent: r.agent as CallerKey }),
        teamAbout: { text: step.about, by: `routine "${r.name}"` },
      });
      const words: Record<string, string> = {
        placed: "Call lined up",
        already: "A call was already under way",
        off: "Calls aren't on: skipped the call",
        "no-number": "No number on file: skipped the call",
        missing: "The deal is gone",
        failed: "The call couldn't be placed",
      };
      return { next: true, did: words[placed.result] ?? "Call tried" };
    }
  }
}

/** Starts the deals each switched-on routine catches, then moves each run on as far as it can go now. */
export async function runCustomRoutines(business: { id: string; name: string }, now = new Date()): Promise<number> {
  const routines = (await customRoutines(business.id)).filter((r) => r.on);
  if (!routines.length) return 0;
  for (const r of routines)
    await enrol(business.id, r).catch((e) => console.error("a routine couldn't start its deals", e instanceof Error ? e.message : e));
  const byId = new Map(routines.map((r) => [r.id, r]));
  const runs = await query<Run>(
    `select routine_id as "routineId", job_id as "jobId", step, ${moment("step_at")} as "stepAt", start_stage as "startStage",
            ${moment("started_at")} as "startedAt"
       from design_routine_runs where business_id = $1 and status = 'running' and routine_id = any($2::text[]) order by step_at limit $3`,
    [business.id, routines.map((r) => r.id), RUNS_A_TIME],
  );
  let moved = 0;
  for (const run of runs) {
    const r = byId.get(run.routineId);
    if (!r) continue;
    let step = run.step;
    let stepAt = run.stepAt;
    const log: { at: string; step: number; did: string }[] = [];
    let ended: { status: "done" | "stopped"; why: string } | null = null;
    // A run goes through checks and actions in one go, and stops at a wait not yet over or an action that must wait.
    for (let i = 0; i <= CUSTOM_LIMITS.steps; i++) {
      const s = r.steps[step];
      if (!s) {
        ended = { status: "done", why: "Every step done" };
        break;
      }
      const out = await act(business, r, { ...run, step, stepAt }, s, now).catch((e) => {
        console.error("a routine's step failed", e instanceof Error ? e.message : e);
        return { next: false } as Outcome;
      });
      if ("stop" in out) {
        ended = { status: "stopped", why: out.stop };
        log.push({ at: now.toISOString(), step, did: out.stop });
        break;
      }
      if (!out.next) break;
      log.push({ at: now.toISOString(), step, did: out.did });
      step += 1;
      stepAt = now.toISOString();
    }
    if (step === run.step && !ended) continue;
    moved++;
    await query(
      `update design_routine_runs set step = $4, step_at = $5::timestamptz, log = (log || $6::jsonb), status = $7,
              ended_at = case when $7 = 'running' then null else now() end
        where business_id = $1 and routine_id = $2 and job_id = $3`,
      [business.id, run.routineId, run.jobId, step, stepAt, JSON.stringify(log), ended?.status ?? "running"],
    );
  }
  return moved;
}

/** Whether a routine's agent exists for the business: Sol always; a voice agent while named. */
export const agentOk = (agent: string, named: readonly string[]) => agent === SOL_AGENT || named.includes(agent);
