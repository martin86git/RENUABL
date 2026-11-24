/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (`npm run test:db`), with Xero stood in for: connecting
 * a business's organisation, the customer's invoice raised once when a proposal is signed and coming to what the
 * customer pays, the deal marked paid when Xero says so, a matching installer invoice sent once as a draft bill, and
 * one business never seeing another's.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-xero.test";
const B = "owner@beta-xero.test";
const TODAY = "2026-10-12";

type Sent = { method: string; path: string; body: { Invoices?: Record<string, unknown>[] } | null };

describe.skipIf(!url)("Xero for a business's books (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let after: typeof import("./design-after-sale-repo");
  let xero: typeof import("./xero");
  let books: typeof import("./design-xero");
  let a: string;
  let b: string;
  let jobId: string;
  let youPay: number;
  const sent: Sent[] = [];
  let paidInXero = false;
  let n = 0;

  const realFetch = globalThis.fetch;
  const fakeXero = async (input: string | URL | Request, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!href.includes("xero.com")) return realFetch(input, init);
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
    if (href.startsWith("https://identity.xero.com/connect/token"))
      return json({ access_token: "access", refresh_token: "refresh", expires_in: 1800 });
    if (href === "https://api.xero.com/connections")
      return json([{ tenantId: "tenant-1", tenantType: "ORGANISATION", tenantName: "Alpha Solar Pty Ltd" }]);
    const path = href.replace("https://api.xero.com/api.xro/2.0/", "");
    const body = init?.body ? (JSON.parse(String(init.body)) as Sent["body"]) : null;
    sent.push({ method: init?.method ?? "GET", path, body });
    if (path === "Invoices" && body?.Invoices?.[0]) {
      const inv = body.Invoices[0];
      const lines = inv.LineItems as { Quantity?: number; UnitAmount?: number }[];
      const total = lines.reduce((s, l) => s + (l.Quantity ?? 0) * (l.UnitAmount ?? 0), 0);
      n += 1;
      return json({
        Invoices: [
          {
            InvoiceID: `00000000-0000-0000-0000-00000000000${n}`,
            InvoiceNumber: `INV-000${n}`,
            Status: inv.Status,
            Total: total,
            AmountDue: total,
          },
        ],
      });
    }
    if (path.startsWith("Invoices?IDs=")) {
      const ids = path.slice("Invoices?IDs=".length).split(",");
      return json({ Invoices: ids.map((id) => ({ InvoiceID: id, Status: paidInXero ? "PAID" : "DRAFT", AmountDue: paidInXero ? 0 : 1 })) });
    }
    return new Response("{}", { status: 404 });
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.XERO_CLIENT_ID = "test-client";
    process.env.XERO_CLIENT_SECRET = "test-secret";
    process.env.SITE_URL = "https://www.renuabl.com.au";
    vi.stubGlobal("fetch", fakeXero);
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    after = await import("./design-after-sale-repo");
    xero = await import("./xero");
    books = await import("./design-xero");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    await repo.saveList(a, sampleInputs().workspace.lists[0], A);

    const sample = sampleInputs();
    const customer = cleanCustomerInput({ name: "Sarah Nguyen", email: "sarah@example.com", address: ADDRESS, ...PLACE });
    const job = cleanJobInput({ address: ADDRESS, ...PLACE });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    await repo.createProject(
      a,
      { address: ADDRESS, ...PLACE },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      A,
    );
    const saved = await proposals.savedFor(a, "Alpha Solar", jobId);
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
    youPay = built.view.price.youPay;
    const kept = await proposals.publishProposal(a, jobId, built, A);
    if (!kept || kept === "raced") throw new Error("unexpected");
    expect(await proposals.acceptProposal(kept.token, "Sarah Nguyen", TODAY)).toBe("accepted-now");
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("does nothing at signing while Xero isn't connected", async () => {
    await after.afterSigning(a, jobId);
    expect(sent).toHaveLength(0);
  });

  it("connects the business's organisation", async () => {
    const config = xero.xeroConfig();
    if (!config) throw new Error("unexpected");
    expect(await xero.connectXero(config, "the-code", a, A)).toBe("connected");
    expect((await xero.xeroConnection(a))?.tenantName).toBe("Alpha Solar Pty Ltd");
    expect(await xero.xeroConnection(b)).toBeNull();
  });

  it("raises the customer's invoice once, for what the customer pays", async () => {
    expect((await books.xeroOverview(a)).toInvoice.map((j) => j.jobId)).toEqual([jobId]);
    await books.invoiceOnSigning(a, jobId);
    await books.invoiceOnSigning(a, jobId);
    const posts = sent.filter((s) => s.path === "Invoices");
    expect(posts).toHaveLength(1);
    const inv = posts[0].body!.Invoices![0] as {
      Type: string;
      Status: string;
      Contact: { Name: string; EmailAddress: string };
      LineItems: { Quantity?: number; UnitAmount?: number }[];
    };
    expect(inv).toMatchObject({ Type: "ACCREC", Status: "DRAFT", Contact: { Name: "Sarah Nguyen", EmailAddress: "sarah@example.com" } });
    const total = inv.LineItems.reduce((s, l) => s + (l.Quantity ?? 0) * (l.UnitAmount ?? 0), 0);
    expect(total).toBeCloseTo(youPay, 2);
    const again = await books.raiseCustomerInvoice(a, jobId, A);
    expect(again.ok).toBe(false);
    const said = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and text like 'Invoice INV-%'`,
      [a, jobId],
    );
    expect(said.map((r) => r.text)[0]).toMatch(/^Invoice INV-0001 raised in Xero \(draft\)/);
    expect((await books.xeroOverview(a)).toInvoice).toEqual([]);
  });

  it("marks the deal's customer invoice paid once Xero says it is paid", async () => {
    await books.syncXero(a);
    let rows = await db.query<{ p: string | null }>(
      `select details->>'customerInvoice' as p from design_jobs where business_id = $1 and id = $2`,
      [a, jobId],
    );
    expect(rows[0].p).toBeNull();
    paidInXero = true;
    expect((await books.syncXero(a)).paid).toBe(1);
    rows = await db.query<{ p: string | null }>(
      `select details->>'customerInvoice' as p from design_jobs where business_id = $1 and id = $2`,
      [a, jobId],
    );
    expect(rows[0].p).toBe("paid");
    expect((await books.syncXero(a)).paid).toBe(0);
  });

  it("sends a matching installer invoice once as a draft bill", async () => {
    const view = await after.invoicesView(a);
    const allowance = view.rows.find((r) => r.jobId === jobId)?.cost?.total ?? 0;
    expect(allowance).toBeGreaterThan(0);
    const under = await after.addInvoice(
      a,
      jobId,
      { installer: "Sparks Electrical", number: "S-1", date: TODAY, subTotal: allowance - 100, gst: 0, lines: [], fileName: "" },
      A,
    );
    if (under === "missing") throw new Error("unexpected");
    expect(await books.sendBillsDue(a)).toBe(0);
    await after.deleteInvoice(a, under.id);
    const inv = await after.addInvoice(
      a,
      jobId,
      { installer: "Sparks Electrical", number: "S-2", date: TODAY, subTotal: allowance, gst: allowance / 10, lines: [], fileName: "" },
      A,
    );
    if (inv === "missing") throw new Error("unexpected");
    expect(await books.sendBillsDue(a)).toBe(1);
    expect(await books.sendBillsDue(a)).toBe(0);
    const bill = sent.filter((s) => s.path === "Invoices").at(-1)!.body!.Invoices![0];
    expect(bill).toMatchObject({ Type: "ACCPAY", Status: "DRAFT", InvoiceNumber: "S-2", Contact: { Name: "Sparks Electrical" } });
    expect((await books.xeroOverview(a)).toBill).toEqual([]);
  });

  it("keeps each business to its own", async () => {
    const other = await books.xeroOverview(b);
    expect(other.recent).toEqual([]);
    expect((await books.raiseCustomerInvoice(b, jobId, B)).ok).toBe(false);
    expect((await books.sendInstallerBill(b, "inv_00000000", B)).ok).toBe(false);
  });
});
