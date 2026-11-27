/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): deals
 * brought across from HubSpot (domain/design/hubspot-import.ts), with HubSpot's API stood in for by a fake fetch. That a
 * deal becomes a customer and a deal at the stage matched, dated when it was made in HubSpot, with its matched fields
 * and its notes, emails and calls on the record; that a stage left in HubSpot brings nothing; that a deal is never
 * brought in twice and a customer already here gets the deal; and that a scope not ticked is said before the run.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-hubspot.test";
const KEY = "pat-test-not-a-real-token-for-tests";

const pipelines = {
  results: [
    {
      id: "default",
      label: "Sales Pipeline",
      stages: [
        { id: "appointmentscheduled", label: "Appointment scheduled", metadata: { isClosed: "false", probability: "0.2" } },
        { id: "closedwon", label: "Closed won", metadata: { isClosed: "true", probability: "1.0" } },
        { id: "closedlost", label: "Closed lost", metadata: { isClosed: "true", probability: "0.0" } },
      ],
    },
  ],
};
const properties = {
  results: [
    { name: "nmi", label: "NMI", type: "string" },
    { name: "battery_model", label: "Battery model", type: "string" },
  ],
};
const deals: Record<string, Record<string, string>> = {
  "101": {
    dealname: "Kim Example solar",
    dealstage: "closedwon",
    pipeline: "default",
    amount: "12000",
    closedate: "2026-02-10T01:00:00Z",
    createdate: "2025-11-02T01:00:00Z",
    nmi: "6305000001",
    battery_model: "Sample 13.5",
  },
  "102": { dealname: "Lost one", dealstage: "closedlost", pipeline: "default", createdate: "2025-10-01T00:00:00Z" },
  "103": { dealname: "Kim's second", dealstage: "appointmentscheduled", pipeline: "default", createdate: "2026-01-05T00:00:00Z" },
};
const contacts: Record<string, Record<string, string>> = {
  "501": { firstname: "Kim", lastname: "Example", email: "kim@example.com", mobilephone: "0400 111 222", city: "Rowville", state: "VIC" },
};
const assoc: Record<string, Record<string, string[]>> = {
  contacts: { "101": ["501"], "103": ["501"] },
  notes: { "101": ["901"] },
  emails: { "101": ["902"] },
  calls: { "101": ["903"] },
  meetings: {},
};
const engagements: Record<string, Record<string, Record<string, string>>> = {
  notes: { "901": { hs_note_body: "<p>Wants a battery later</p>", hs_timestamp: "2025-11-03T00:00:00Z" } },
  emails: {
    "902": {
      hs_email_subject: "Your quote",
      hs_email_text: "Hi Kim",
      hs_email_to_email: "kim@example.com",
      hs_timestamp: "2025-11-04T00:00:00Z",
    },
  },
  calls: { "903": { hs_call_title: "First call", hs_call_duration: "120000", hs_timestamp: "2025-11-02T02:00:00Z" } },
};

/** HubSpot's API as the import asks it; `noMeetings` answers 403 for meetings, as a token without that scope would. */
function fakeHubSpot(noMeetings = false) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = init?.body ? (JSON.parse(String(init.body)) as { inputs: { id: string }[] }) : null;
    const path = u.pathname;
    if (noMeetings && path.includes("meetings")) return Response.json({ message: "missing scope" }, { status: 403 });
    if (path === "/crm/v3/pipelines/deals") return Response.json(pipelines);
    if (path === "/crm/v3/properties/deals") return Response.json(properties);
    if (path === "/crm/v3/owners") return Response.json({ results: [] });
    if (path === "/crm/v3/objects/deals")
      return Response.json({ results: Object.entries(deals).map(([id, p]) => ({ id, properties: p })) });
    const one = path.match(/^\/crm\/v3\/objects\/(notes|emails|calls|meetings)$/);
    if (one) return Response.json({ results: [] });
    const batch = path.match(/^\/crm\/v3\/objects\/(\w+)\/batch\/read$/);
    if (batch && body) {
      const source = batch[1] === "deals" ? deals : batch[1] === "contacts" ? contacts : (engagements[batch[1]] ?? {});
      return Response.json({ results: body.inputs.filter((i) => source[i.id]).map((i) => ({ id: i.id, properties: source[i.id] })) });
    }
    const joins = path.match(/^\/crm\/v4\/associations\/deals\/(\w+)\/batch\/read$/);
    if (joins && body) {
      const m = assoc[joins[1]] ?? {};
      return Response.json({
        results: body.inputs
          .filter((i) => m[i.id])
          .map((i) => ({ from: { id: i.id }, to: m[i.id].map((t) => ({ toObjectId: Number(t) })) })),
      });
    }
    return new Response("{}", { status: 404 });
  });
}

describe.skipIf(!url)("bringing deals in from HubSpot (database)", () => {
  let db: typeof import("./db");
  let hs: typeof import("./hubspot-import");
  let crm: typeof import("./design-crm-repo");
  let a: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    hs = await import("./hubspot-import");
    crm = await import("./design-crm-repo");
    await db.query(`delete from businesses where created_by = $1`, [A]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await db.query(`delete from businesses where created_by = $1`, [A]);
  });

  it("looks, guesses and says which records the token can't read", async () => {
    vi.stubGlobal("fetch", fakeHubSpot(true));
    const look = await hs.lookAtHubSpot(a, KEY);
    expect(look.deals.map((d) => d.id)).toEqual(["101", "102", "103"]);
    expect(look.guess.stages).toEqual({ appointmentscheduled: "lead", closedwon: "won", closedlost: "lost" });
    expect(look.guess.fields.nmi).toBe("nmi");
    expect(look.unread).toEqual(["meetings"]);
  });

  it("checks first what bringing them in would do, and writes nothing", async () => {
    vi.stubGlobal("fetch", fakeHubSpot());
    const { cleanCustomerInput, cleanJobInput } = await import("@/lib/domain/design/crm");
    const { tallyChecks } = await import("@/lib/domain/design/hubspot-import");
    const map = { stages: { closedwon: "won", closedlost: "skip", appointmentscheduled: "lead" } as const, fields: { nmi: "nmi" } };
    const counts = async () =>
      (
        await db.query<{ c: number; j: number; i: number }>(
          `select (select count(*)::int from design_customers where business_id = $1) as c,
                  (select count(*)::int from design_jobs where business_id = $1) as j,
                  (select count(*)::int from design_imports where business_id = $1) as i`,
          [a],
        )
      )[0];

    // Nobody here yet: both of Kim's deals would be new, and the second would join the first as they come in.
    const before = await counts();
    const empty = await hs.checkHubSpotDeals(a, KEY, ["101", "102", "103"], map);
    expect(Object.fromEntries(empty.map((r) => [r.id, r.result]))).toEqual({ "101": "new", "102": "skipped", "103": "new" });
    expect(tallyChecks(empty)).toMatchObject({ fresh: 2, siblings: 1, namesakes: 0, skipped: 1 });
    expect(await counts()).toEqual(before);

    // A Kim Example here under another email, with a deal: the email doesn't find her, so the name is flagged.
    const who = cleanCustomerInput({
      firstName: "Kim",
      lastName: "Example",
      email: "kim.other@example.com",
      phone: "",
      address: "",
      notes: "",
    });
    const job = cleanJobInput({ title: "Solar from Pylon", stage: "won" });
    if (!who.ok || !job.ok) throw new Error("test input");
    const made = await crm.createCustomer(a, who.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("not made");
    const named = await hs.checkHubSpotDeals(a, KEY, ["101"], map);
    expect(named[0]).toMatchObject({ result: "new", namesakes: 1 });

    // The same customer by email, her deal won a week from HubSpot's: it would join; won years away: a second deal.
    await db.query(`update design_customers set email = 'kim@example.com' where business_id = $1 and id = $2`, [a, made.customer.id]);
    await db.query(`update design_jobs set won_at = '2026-02-17T02:00:00Z' where business_id = $1 and id = $2`, [a, made.job.id]);
    const near = await hs.checkHubSpotDeals(a, KEY, ["101"], map);
    expect(near[0]).toMatchObject({ result: "join", into: { title: "Solar from Pylon", gapDays: 7 } });
    await db.query(`update design_jobs set won_at = '2023-02-17T02:00:00Z' where business_id = $1 and id = $2`, [a, made.job.id]);
    const far = await hs.checkHubSpotDeals(a, KEY, ["101"], map);
    expect(far[0]).toMatchObject({ result: "second", near: { title: "Solar from Pylon" } });

    // Nothing of HubSpot's was written, and the test's own customer goes before the import's test.
    expect((await counts()).i).toBe(0);
    await db.query(`delete from design_customers where business_id = $1 and id = $2`, [a, made.customer.id]);
    expect(await counts()).toEqual(before);
  });

  it("brings deals in by the match, with their record, and never twice", async () => {
    vi.stubGlobal("fetch", fakeHubSpot());
    const map = { stages: { closedwon: "won", closedlost: "skip", appointmentscheduled: "lead" } as const, fields: { nmi: "nmi" } };
    const run = await hs.bringInHubSpotDeals(a, KEY, ["101", "102", "103"], map, A);
    expect(Object.fromEntries(run.results.map((r) => [r.id, r.result]))).toEqual({ "101": "in", "102": "skipped", "103": "in" });

    const ref = await db.query<{ job_id: string; ref: string }>(
      `select job_id, ref from design_imports where business_id = $1 and source = 'hubspot' order by ref`,
      [a],
    );
    expect(ref.map((r) => r.ref)).toEqual(["101", "103"]);
    const won = await crm.jobById(a, ref[0].job_id);
    expect(won?.job).toMatchObject({ stage: "won", value: 12000, title: "Kim Example solar" });
    expect(won?.job.details).toMatchObject({ nmi: "6305000001" });
    expect(won?.job.createdAt.slice(0, 10)).toBe("2025-11-02");
    expect(won?.job.wonAt?.slice(0, 10)).toBe("2026-02-10");
    expect(won?.customer).toMatchObject({ email: "kim@example.com", source: "HubSpot" });

    const lines = await db.query<{ kind: string; text: string }>(
      `select kind, text from design_activity where business_id = $1 and job_id = $2 order by at`,
      [a, ref[0].job_id],
    );
    // Kim's second HubSpot deal (made 36 days from the first one's close) joined the first, so its note is on it too.
    expect(lines.map((l) => l.kind)).toEqual(["call", "note", "email", "note", "note"]);
    expect(lines.at(-2)?.text).toContain("Battery model: Sample 13.5");
    expect(lines.at(-1)?.text).toContain("Joined with this deal from HubSpot");
    expect(run.results.find((r) => r.id === "103")).toMatchObject({ result: "in", joined: true });

    // One person, and one deal: the two HubSpot deals of one contact dated within MERGE_DAYS became one here.
    const people = await db.query(`select id from design_customers where business_id = $1 and lower(email) = 'kim@example.com'`, [a]);
    expect(people).toHaveLength(1);
    expect(await db.query(`select id from design_jobs where business_id = $1`, [a])).toHaveLength(1);

    const again = await hs.bringInHubSpotDeals(a, KEY, ["101", "103"], map, A);
    expect(again.results.map((r) => r.result)).toEqual(["already", "already"]);
  });
});
