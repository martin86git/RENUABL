/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a
 * proposal offering a choice of systems. The customer goes ahead on one that isn't the recommended one, and from then
 * on the proposal as agreed (its price, deposit and the business's lists), the order and the installation allowance
 * are that system's; a choice the proposal doesn't offer falls back to the recommended one.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { costSystem, editedLines, lineKey, type LineEdit } from "@/lib/domain/design/quote";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { systemSpecOf } from "@/lib/domain/design/system";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-choice.test";
const TODAY = "2026-10-12";

describe.skipIf(!url)("a proposal with a choice of systems (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let after: typeof import("./design-after-sale-repo");
  let a: string;

  /** A deal whose roof has two goal designs (solar only for payback, solar and battery for return, the primary), published. */
  async function deal(name: string, shift: number) {
    const solar = sampleInputs();
    const battery = sampleInputs({ withBattery: true });
    const designs = [
      { ...solar.project.set.designs[0], goal: "payback" as const },
      { ...battery.project.set.designs[0], goal: "return" as const },
    ];
    const set = { ...solar.project.set, designs, primary: 1 };
    const quotes = designs.map((d) => {
      const form = solar.project.extras.quotes[0].form;
      const edits: Record<string, LineEdit> = {};
      for (const line of editedLines(costSystem(systemSpecOf(d), form, solar.workspace).lines, {}))
        if (line.missing) edits[lineKey(line)] = { amount: 100 };
      return { form, edits };
    });
    const extras = { ...solar.project.extras, quotes };
    const place = { lat: PLACE.lat + shift, lng: PLACE.lng + shift };
    const customer = cleanCustomerInput({ name, email: "alex@example.com", address: ADDRESS, ...place });
    const job = cleanJobInput({ address: ADDRESS, ...place });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    await repo.createProject(a, { address: ADDRESS, ...place }, { design: packDesignSet(set), extras }, A);
    const saved = await proposals.savedFor(a, "Alpha Solar", made.job.id);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    const built = buildProposal({
      ...solar,
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
    expect(built.view.options?.map((o) => o.goal)).toEqual(["payback", "return"]);
    const kept = await proposals.publishProposal(a, made.job.id, built, A);
    if (!kept || kept === "raced") throw new Error("unexpected");
    return { jobId: made.job.id, token: kept.token, view: built.view };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    after = await import("./design-after-sale-repo");
    await db.query(`delete from businesses where created_by = $1`, [A]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    await repo.saveList(a, sampleInputs().workspace.lists[0], A);
  });

  afterAll(async () => {
    await db.query(`delete from businesses where created_by = $1`, [A]);
  });

  it("goes ahead on the system chosen, and everything after follows it", async () => {
    const d = await deal("Sam Choice", 0.003);
    const solar = d.view.options!.find((o) => o.goal === "payback")!;
    expect(await proposals.acceptProposal(d.token, "Sam Choice", TODAY, "payback")).toBe("accepted-now");

    const opened = await proposals.publicProposal(d.token, TODAY);
    expect(opened?.accepted?.option).toBe("payback");
    expect(opened?.view?.price.youPay).toBe(solar.price.youPay);

    const listed = (await after.listProposals(a, TODAY)).find((p) => p.jobId === d.jobId);
    expect(listed?.youPay).toBe(solar.price.youPay);

    await after.afterSigning(a, d.jobId);
    const order = await after.jobOrder(a, d.jobId);
    if (typeof order === "string") throw new Error(order);
    expect(order.items.some((i) => i.group === "Battery")).toBe(false);
    const allowance = (await after.invoicesView(a)).rows.find((r) => r.jobId === d.jobId)?.cost;
    expect(allowance?.lines.some((l) => /battery/i.test(l.label))).toBe(false);
  });

  it("takes the recommended system when the choice isn't one on offer", async () => {
    const d = await deal("Kim Default", 0.004);
    expect(await proposals.acceptProposal(d.token, "Kim Default", TODAY, "independence")).toBe("accepted-now");
    const opened = await proposals.publicProposal(d.token, TODAY);
    expect(opened?.accepted?.option).toBe("return");
    expect(opened?.view?.system.batteryKwh).toBeGreaterThan(0);
  });
});
