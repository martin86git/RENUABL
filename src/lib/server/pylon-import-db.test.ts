/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): sold jobs
 * brought across from Pylon (domain/design/pylon-import.ts), with Pylon's API stood in for by a fake fetch. That a sold
 * project becomes a customer and a deal at the stage chosen with its system, price and signed PDF, that the same project
 * is never brought in twice, that a customer already in the CRM gets the job rather than a second record, and that a
 * key Pylon refuses stops the run with words for the business.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

vi.mock("./safe-fetch", () => ({
  safeFetch: vi.fn(async () => ({ bytes: Buffer.from("%PDF-1.4 signed"), contentType: "application/pdf" })),
}));

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-pylon.test";
const KEY = "pylon_test_key_0123456789";

const project = (id: string, name: string, email: string) => ({
  data: {
    type: "solar_projects",
    id,
    attributes: {
      reference_number: `PYL-${id}`,
      site_location: [145.06, -37.86],
      site_address: { line1: "19 Sample Avenue", city: "Glen Iris", state: "Victoria", zip: "3147" },
      customer_details: { name, phone: "0400 000 000", email },
      site_details: { number_of_storeys: 1, power_phases: 3, nmi: "6305123456" },
      acceptance: { is_accepted: true, latest_esignature: true, latest_esignature_pdf_url: "https://files.example.com/s.pdf" },
    },
    relationships: { latest_signed_design: { data: { type: "solar_designs", id: `d${id}` } } },
  },
});
const design = {
  data: {
    type: "solar_designs",
    id: "dx",
    attributes: {
      title: "6.6 kW Solar",
      summary: { dc_output_kw: 6.6, storage_kwh: null },
      pricing: { total: 800000, total_includes_tax: true },
      module_types: [{ description: "Sample 440 W panel", quantity: 15 }],
      inverter_types: [{ description: "Sample 5 kW inverter", quantity: 1 }],
    },
  },
};

/** Pylon's API as the import asks it, from the projects given. */
function fakePylon(projects: Record<string, ReturnType<typeof project>>, status = 200) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    if (status !== 200) return new Response("{}", { status });
    if (u.pathname === "/v1/solar_projects")
      return Response.json({ data: Object.values(projects).map((p) => p.data), links: { next: null } });
    const p = u.pathname.match(/^\/v1\/solar_projects\/(.+)$/);
    if (p) return projects[p[1]] ? Response.json(projects[p[1]]) : new Response("{}", { status: 404 });
    // Pylon turns down a field its design object doesn't list (storage_types isn't one).
    if (u.pathname.startsWith("/v1/solar_designs/"))
      return /storage_types/.test(u.search) ? Response.json({ title: "Invalid field" }, { status: 400 }) : Response.json(design);
    return new Response("{}", { status: 404 });
  });
}

describe.skipIf(!url)("bringing sold jobs in from Pylon (database)", () => {
  let db: typeof import("./db");
  let pylon: typeof import("./pylon-import");
  let crm: typeof import("./design-crm-repo");
  let a: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    pylon = await import("./pylon-import");
    crm = await import("./design-crm-repo");
    await db.query(`delete from businesses where created_by = $1`, [A]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await db.query(`delete from businesses where created_by = $1`, [A]);
  });

  it("lists the sold projects, and brings one in as a customer and a deal with its system, price and signed PDF", async () => {
    vi.stubGlobal("fetch", fakePylon({ proj0001: project("proj0001", "Jill Example", "jill@example.com") }));
    const found = await pylon.listSoldProjects(a, KEY);
    expect(found.projects.map((p) => p.id)).toEqual(["proj0001"]);
    expect(found.already).toEqual([]);

    const [out] = await pylon.bringInProjects(a, KEY, ["proj0001"], "installed", A);
    expect(out).toMatchObject({ result: "in", customer: "Jill Example", pdf: true });
    const deal = await crm.jobById(a, out.result === "in" ? out.jobId : "")!;
    expect(deal?.job).toMatchObject({ stage: "installed", value: 8000, kw: 6.6, title: "Solar" });
    expect(deal?.job.details).toMatchObject({ systemSize: "6.6 kW", phases: "3", storeys: "Single", panelQty: "15", nmi: "6305123456" });
    expect(deal?.job.wonAt).toBeTruthy();
    expect(deal?.job.installedAt).toBeTruthy();
    expect(deal?.customer).toMatchObject({ email: "jill@example.com", source: "Pylon" });
    const files = await db.query<{ name: string }>(`select name from design_deal_files where business_id = $1 and job_id = $2`, [
      a,
      deal!.job.id,
    ]);
    expect(files.map((f) => f.name)).toEqual(["Signed proposal (Pylon PYL-proj0001) Jill Example.pdf"]);
  });

  it("never brings the same project in twice, and gives a customer already in the CRM the job", async () => {
    vi.stubGlobal(
      "fetch",
      fakePylon({
        proj0001: project("proj0001", "Jill Example", "jill@example.com"),
        proj0002: project("proj0002", "Jill Example", "JILL@example.com"),
      }),
    );
    expect((await pylon.listSoldProjects(a, KEY)).already).toEqual(["proj0001"]);
    const outs = await pylon.bringInProjects(a, KEY, ["proj0001", "proj0002"], "won", A);
    expect(outs.map((o) => o.result)).toEqual(["already", "in"]);
    const customers = await db.query(`select id from design_customers where business_id = $1 and lower(email) = 'jill@example.com'`, [a]);
    expect(customers).toHaveLength(1);
  });

  it("brings the export's sold rows in, dated the day they sold, owned by whoever sold them, and never twice", async () => {
    const row = (id: string, soldOn: string, email: string) => ({
      id,
      reference: `R-${id}`,
      owner: "Owner",
      ownerEmail: A,
      name: "Pat Example",
      phone: "0000 000 000",
      email,
      line1: "1 Sample Street",
      line2: "",
      locality: "Rosebud",
      postcode: "3939",
      region: "Victoria",
      country: "Australia",
      soldOn,
      kw: 6.6,
      price: 8000,
      stcQty: 80,
      stcValue: 3000,
      proposalLink: "",
    });
    const outs = await pylon.bringInCsvRows(
      a,
      [row("csv00001", "2026-11-10", "pat@example.com"), row("csv00002", "2021-03-01", "not-an-email")],
      "2026-11-20",
      8,
      A,
    );
    expect(outs.map((o) => o.result)).toEqual(["in", "in"]);
    const recent = await crm.jobById(a, outs[0].result === "in" ? outs[0].jobId : "");
    expect(recent?.job).toMatchObject({ stage: "won", value: 8000, kw: 6.6, owner: A });
    expect(recent?.job.wonAt?.slice(0, 10)).toBe("2026-11-10");
    expect(recent?.customer).toMatchObject({ email: "pat@example.com", phone: "" });
    const older = await crm.jobById(a, outs[1].result === "in" ? outs[1].jobId : "");
    expect(older?.job.stage).toBe("installed");
    expect(older?.customer.email).toBeFalsy();
    expect(await pylon.alreadyBroughtIn(a, ["csv00001", "csv00002", "csv00003"])).toEqual(["csv00001", "csv00002"]);
    const again = await pylon.bringInCsvRows(a, [row("csv00001", "2026-11-10", "pat@example.com")], "2026-11-20", 8, A);
    expect(again[0].result).toBe("already");
  });

  it("fills in the export's deals from Pylon: the battery and the map, never over what a person typed, and once", async () => {
    const withBattery = {
      data: {
        ...design.data,
        attributes: {
          ...design.data.attributes,
          summary: { dc_output_kw: 6.6, storage_kwh: 16 },
        },
      },
    };
    const [ref] = await db.query<{ job_id: string }>(`select job_id from design_imports where business_id = $1 and ref = 'csv00001'`, [a]);
    const before = await crm.jobById(a, ref.job_id);
    await crm.updateJob(a, ref.job_id, (cur) => ({ ok: true, value: { ...cur, details: { ...cur.details, nmi: "6305999999" } } }), A);
    const fake = fakePylon({ csv00001: project("csv00001", "Pat Example", "pat@example.com") });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
        new URL(String(input)).pathname.startsWith("/v1/solar_designs/") && !/storage_types/.test(String(input))
          ? Response.json(withBattery)
          : fake(input, init),
      ),
    );
    expect(await pylon.fillLeft(a, false)).toBeGreaterThan(0);
    let left = 1;
    const results = [];
    for (let i = 0; i < 10 && left; i++) {
      const run = await pylon.fillFromPylonRun(a, KEY, false, A);
      results.push(...run.results);
      left = run.left;
    }
    expect(left).toBe(0);
    expect(results.find((r) => r.id === "csv00002")?.result).toBe("gone");
    const after = await crm.jobById(a, ref.job_id);
    expect(before?.job.lat).toBeNull();
    expect(after?.job).toMatchObject({ title: "Solar and battery", lat: -37.86, lng: 145.06 });
    expect(after?.job.details).toMatchObject({ systemType: "Solar and battery", batteryStorage: "16 kWh", nmi: "6305999999" });
    const again = await pylon.fillFromPylonRun(a, KEY, false, A);
    expect(again.results).toEqual([]);
  });

  it("says what Pylon answered when it fails, and tries a failing project no more than three times", async () => {
    await db.query(`update design_imports set equipment_at = null, fill_tries = 0 where business_id = $1 and ref = 'csv00001'`, [a]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ title: "Internal error" }, { status: 502 })),
    );
    await expect(pylon.fillFromPylonRun(a, KEY, false, A)).rejects.toThrow("Pylon answered 502 for a project: Internal error.");
    await pylon.fillFromPylonRun(a, KEY, false, A).catch(() => undefined);
    await pylon.fillFromPylonRun(a, KEY, false, A).catch(() => undefined);
    expect(await pylon.fillLeft(a, false)).toBe(0);
  });

  it("stops with words for the business when Pylon refuses the key", async () => {
    vi.stubGlobal("fetch", fakePylon({}, 401));
    await expect(pylon.listSoldProjects(a, KEY)).rejects.toThrow("Pylon didn't accept that key");
  });
});
