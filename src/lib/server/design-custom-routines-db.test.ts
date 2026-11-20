/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): routines a
 * business builds itself (domain/design/custom-routines.ts). That one can't be switched on with nothing to do, that it
 * catches only deals that start it after it was switched on, once each, that a run waits, checks and lines its email
 * up in Sol's outbox, that a reply stops it, and that one business never sees or runs another's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import type { CustomStep } from "@/lib/domain/design/custom-routines";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-routines.test";
const B = "owner@beta-routines.test";

const person = (name: string, email: string) => ({
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  phone: "",
  email,
  address: "",
  lat: null,
  lng: null,
  source: "",
  notes: "",
});
const lead = { title: "Solar", address: "", lat: null, lng: null, stage: "lead" as const, value: null, installDate: null, details: {} };

const steps: CustomStep[] = [
  { id: "sone1", kind: "check", test: "same-stage" },
  { id: "stwo2", kind: "email", about: "Say hello and ask for their latest power bill" },
  { id: "sthree", kind: "wait", amount: 2, unit: "days" },
  { id: "sfour4", kind: "check", test: "no-reply" },
  { id: "sfive5", kind: "email", about: "A friendly nudge about the bill" },
];

describe.skipIf(!url)("routines a business builds (database)", () => {
  let db: typeof import("./db");
  let cr: typeof import("./design-custom-routines");
  let crm: typeof import("./design-crm-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.ANTHROPIC_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    cr = await import("./design-custom-routines");
    crm = await import("./design-crm-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("runs on new deals only, waits, checks, lines its emails up, and stops on a reply", async () => {
    const draft = { name: "Bill please", agent: "sol", on: false, trigger: { kind: "new-lead" as const }, steps };
    // Nothing to do yet: can't be switched on.
    expect((await cr.saveCustomRoutine(a, null, { ...draft, on: true, steps: [steps[2]] }, A)).ok).toBe(false);
    const made = await cr.saveCustomRoutine(a, null, draft, A);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const id = made.routine.id;
    // A lead made before it's switched on isn't caught.
    const before = await crm.createCustomer(a, person("Early Bird", "early@example.com"), lead, A);
    await new Promise((r) => setTimeout(r, 20));
    const on = await cr.saveCustomRoutine(a, id, { ...draft, on: true }, A);
    expect(on.ok && on.routine.onAt).toBeTruthy();
    expect(await cr.routineBusinesses()).toEqual(expect.arrayContaining([expect.objectContaining({ id: a })]));
    expect((await cr.routineBusinesses()).some((x) => x.id === b)).toBe(false);

    const jo = await crm.createCustomer(a, person("Jo Quiet", "jo@example.com"), lead, A);
    const sam = await crm.createCustomer(a, person("Sam Replies", "sam@example.com"), lead, A);
    if (jo === "full" || sam === "full" || before === "full") throw new Error("full");

    const now = new Date();
    await cr.runCustomRoutines({ id: a, name: "Alpha Solar" }, now);
    const runs = await cr.runningRuns(a);
    const lines = runs[id] ?? [];
    expect(lines.map((l) => l.customer).sort()).toEqual(["Jo Quiet", "Sam Replies"]);
    // Through the check and the first email, waiting now at step 2.
    expect(lines.every((l) => l.step === 2)).toBe(true);
    const lined = await db.query<{ job_id: string; item: { held?: boolean; kind: string } }>(
      `select job_id, item from design_prepared where business_id = $1 and kind = 'routine'`,
      [a],
    );
    expect(lined.length).toBe(2);
    // Sol isn't there in the test, so each waits for a person to write it.
    expect(lined.every((r) => r.item.held === true && r.item.kind === "routine")).toBe(true);

    // Running again changes nothing before the wait is over, and catches nobody twice.
    await cr.runCustomRoutines({ id: a, name: "Alpha Solar" }, new Date(now.getTime() + 60_000));
    expect((await cr.runningRuns(a))[id]?.every((l) => l.step === 2)).toBe(true);

    // Sam writes back.
    await db.query(
      `insert into design_messages (id, business_id, job_id, customer_id, from_customer, text) values ($1,$2,$3,$4,true,'Here it is')`,
      ["msg_routine_test", a, sam.job!.id, sam.customer.id],
    );
    await cr.runCustomRoutines({ id: a, name: "Alpha Solar" }, new Date(now.getTime() + 3 * 86_400_000));
    const after = await db.query<{ job_id: string; status: string; step: number }>(
      `select job_id, status, step from design_routine_runs where business_id = $1 and routine_id = $2`,
      [a, id],
    );
    const byJob = new Map(after.map((r) => [r.job_id, r]));
    expect(byJob.get(jo.job!.id)).toMatchObject({ status: "done", step: 5 });
    expect(byJob.get(sam.job!.id)).toMatchObject({ status: "stopped", step: 3 });
    expect(byJob.has(before.job!.id)).toBe(false);
    const emails = await db.query(`select 1 from design_prepared where business_id = $1 and kind = 'routine'`, [a]);
    expect(emails.length).toBe(3);

    // Another business sees none of it, and can't change it.
    expect(await cr.customRoutines(b)).toEqual([]);
    expect(await cr.deleteCustomRoutine(b, id)).toBe(false);
    // Deleting it takes its runs.
    expect(await cr.deleteCustomRoutine(a, id)).toBe(true);
    expect((await db.query(`select 1 from design_routine_runs where business_id = $1`, [a])).length).toBe(0);
  });
});
