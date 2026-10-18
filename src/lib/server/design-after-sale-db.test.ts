/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): what a signature sets going. That a
 * signed proposal opens its order (once) from the exact lines it was sold
 * with and fixes its installation allowance, that an order keeps only hand
 * changes and the server's stamps, that an installer's invoice is compared
 * and can be moved between jobs, that the scheduler and reminders see only
 * booked jobs of businesses that asked for reminders, and that one business
 * never reaches another's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-aftersale.test";
const B = "owner@beta-aftersale.test";
const TODAY = "2026-10-12";

describe.skipIf(!url)("roof designer after the sale (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let after: typeof import("./design-after-sale-repo");
  let a: string;
  let b: string;
  let signed: { jobId: string; customerId: string; token: string };
  let unsigned: { jobId: string; customerId: string; token: string };

  async function deal(businessId: string, businessName: string, by: string, name: string, shift: number) {
    const sample = sampleInputs();
    const place = { lat: PLACE.lat + shift, lng: PLACE.lng + shift };
    const customer = cleanCustomerInput({ name, email: "alex@example.com", address: ADDRESS, ...place });
    const job = cleanJobInput({ address: ADDRESS, ...place });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(businessId, customer.value, job.value, by);
    if (made === "full" || !made.job) throw new Error("unexpected");
    await repo.createProject(
      businessId,
      { address: ADDRESS, ...place },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      by,
    );
    const saved = await proposals.savedFor(businessId, businessName, made.job.id);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    const built = buildProposal({
      ...sample,
      version: 1,
      job: saved.job,
      customer: saved.customer,
      project: saved.project,
      workspace: saved.workspace,
      rates: VERIFIED_RATES,
      brand: saved.brand,
      images: [],
    });
    if (!built.ok) throw new Error(built.problems.join(" "));
    const kept = await proposals.publishProposal(businessId, made.job.id, built, by);
    if (!kept || kept === "raced") throw new Error("unexpected");
    return { jobId: made.job.id, customerId: made.customer.id, token: kept.token };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    after = await import("./design-after-sale-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    await repo.saveList(a, sampleInputs().workspace.lists[0], A);
    signed = await deal(a, "Alpha Solar", A, "Sarah Nguyen", 0.001);
    unsigned = await deal(a, "Alpha Solar", A, "Tom Reid", 0.002);
    expect(await proposals.acceptProposal(signed.token, "Sarah Nguyen", TODAY)).toBe("accepted-now");
    await after.afterSigning(a, signed.jobId);
  });

  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("lists proposals sent and signed", async () => {
    const list = await after.listProposals(a, TODAY);
    expect(list.map((p) => [p.customer, p.state])).toEqual(
      expect.arrayContaining([
        ["Sarah Nguyen", "accepted"],
        ["Tom Reid", "live"],
      ]),
    );
    expect(await after.listProposals(b, TODAY)).toEqual([]);
  });

  it("opens the signed job's order once, from the lines it was sold with", async () => {
    await after.afterSigning(a, signed.jobId);
    const rows = await db.query(`select count(*)::int as n from design_orders where business_id = $1 and job_id = $2`, [a, signed.jobId]);
    expect(rows[0].n).toBe(1);
    const order = await after.jobOrder(a, signed.jobId);
    if (typeof order === "string") throw new Error(order);
    expect(order.items.length).toBeGreaterThan(2);
    expect(order.items.every((i) => i.qty > 0)).toBe(true);
    expect(order.items.some((i) => i.group === "Panels" && i.sku)).toBe(true);
    expect(order.items.some((i) => /allowance/i.test(i.item))).toBe(false);
    expect(order.order.reference).toMatch(/^PO-/);
    expect(await after.jobOrder(a, unsigned.jobId)).toBe("unsigned");
    expect(await after.jobOrder(b, signed.jobId)).toBe("missing");
  });

  it("keeps hand changes and stamps the status with the server's member and time", async () => {
    const before = await after.jobOrder(a, signed.jobId);
    if (typeof before === "string") throw new Error(before);
    const first = before.items[0];
    const saved = await after.saveOrder(
      a,
      signed.jobId,
      { ...before.order, status: "ordered", qty: { [first.key]: first.qty + 2 }, orderedBy: "someone@else" },
      A,
    );
    if (typeof saved === "string") throw new Error(saved);
    expect(saved.order).toMatchObject({ status: "ordered", orderedBy: A });
    expect(saved.items[0].qty).toBe(first.qty + 2);
    expect(saved.items[0].worked).toBe(first.qty);
    const rows = await after.listOrders(a);
    expect(rows.map((r) => [r.jobId, r.status])).toEqual([[signed.jobId, "ordered"]]);
    expect(await after.listOrders(b)).toEqual([]);
    expect(await after.saveOrder(a, unsigned.jobId, {}, A)).toBe("unsigned");
  });

  it("fixes the installation allowance and compares an installer's invoice", async () => {
    const view = await after.invoicesView(a);
    expect(view.rows).toHaveLength(1);
    const row = view.rows[0];
    expect(row.cost?.total).toBeGreaterThan(0);
    // Signed but not installed: no installer's invoice is expected yet.
    expect(row.status).toBe("upcoming");
    const allowed = row.cost!.total;
    const inv = await after.addInvoice(
      a,
      signed.jobId,
      { installer: "Sparky", number: "INV-9", date: "2026-10-20", subTotal: allowed + 200, gst: 0, lines: [], fileName: "" },
      A,
    );
    if (inv === "missing") throw new Error(inv);
    let again = (await after.invoicesView(a)).rows[0];
    expect(again).toMatchObject({ status: "over", difference: 200 });
    expect(await after.assignInvoice(b, inv.id, null, B)).toBe(false);
    expect(await after.assignInvoice(a, inv.id, null, A)).toBe(true);
    const waiting = await after.invoicesView(a);
    expect(waiting.rows[0].status).toBe("upcoming");
    await db.query(`update design_jobs set stage = 'installed' where business_id = $1 and id = $2`, [a, signed.jobId]);
    expect((await after.invoicesView(a)).rows[0].status).toBe("awaiting");
    await db.query(`update design_jobs set stage = 'won' where business_id = $1 and id = $2`, [a, signed.jobId]);
    expect(waiting.waiting.map((w) => w.id)).toEqual([inv.id]);
    expect(
      await after.addInvoice(
        a,
        unsigned.jobId.replace(/.$/, "0"),
        { installer: "", number: "", date: "", subTotal: 1, gst: 0, lines: [], fileName: "" },
        A,
      ),
    ).toBe("missing");
    expect(await after.deleteInvoice(b, inv.id)).toBe(false);
    expect(await after.deleteInvoice(a, inv.id)).toBe(true);
    again = (await after.invoicesView(a)).rows[0];
    expect(again.invoices).toEqual([]);
  });

  it("shows booked jobs on the scheduler with their readiness", async () => {
    await db.query(`update design_jobs set install_date = '2026-10-23' where business_id = $1 and id = $2`, [a, signed.jobId]);
    const jobs = await after.bookedJobs(a, "2026-10-19", "2026-10-25");
    expect(jobs.map((j) => j.jobId)).toEqual([signed.jobId]);
    expect(jobs[0].checks.find((c) => c.key === "stock")?.done).toBe(true);
    expect(await after.bookedJobs(b, "2026-10-19", "2026-10-25")).toEqual([]);
  });

  it("reminds only for businesses that switched reminders on, and only once", async () => {
    expect(await after.remindersDue("2026-10-21")).toEqual([]);
    await after.savePrefs(a, { automations: { installReminders: true }, reminderDaysBefore: 2 }, A);
    const due = await after.remindersDue("2026-10-21");
    expect(due.map((r) => [r.jobId, r.email, r.firstName])).toEqual([[signed.jobId, "alex@example.com", "Sarah"]]);
    expect(await after.remindersDue("2026-10-20")).toEqual([]);
    expect(await after.claimReminder(due[0])).toBe(true);
    expect(await after.claimReminder(due[0])).toBe(false);
    expect(await after.remindersDue("2026-10-21")).toEqual([]);
  });
});
