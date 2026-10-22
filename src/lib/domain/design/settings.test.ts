import { describe, expect, it } from "vitest";
import { proposalAcceptedEmail } from "../emails";
import { ALL_PERMISSIONS, PERMISSIONS, can, cleanPermissions, cleanWorkspaceSettings, refusal } from "./account";
import { BLOCKS, USUAL_BLOCKS, blockHeading, cleanBlocks, defaultBlocks, isLocked, moveBlock, viewBlocks } from "./blocks";
import {
  BANK_INCOMPLETE,
  DEPOSIT_WRONG,
  FONTS,
  MAX_NOTIFY,
  MILESTONE_NAME_MISSING,
  WARRANTY_WRONG,
  cleanBank,
  cleanBrandKit,
  cleanDeposit,
  cleanMilestones,
  cleanNotify,
  defaultBrand,
  readBrandKit,
  shownBsb,
  type BrandImage,
  type BrandKit,
} from "./brand";
import { HIDDEN_COST, keepCostEdits, withoutCostEdits, withoutCosts } from "./permissions";
import { BANK_NOTE, COST_WORDS, TIMING_NOTE, buildProposal, depositOf, milestoneAmounts, splitGst, warrantyNote } from "./proposal";
import { SAMPLE_IMAGES, pricedWorkspace, sampleBrand, sampleInputs } from "./proposal-fixture";

const start = defaultBrand("Example Solar");
const cleaned = (raw: unknown, current: BrandKit = start) => {
  const result = cleanBrandKit(raw, current);
  if (!result.ok) throw new Error(result.message);
  return result.value;
};
const refused = (raw: unknown) => {
  const result = cleanBrandKit(raw, start);
  return result.ok ? null : result.message;
};
const built = (brand: Partial<BrandKit>, images: BrandImage[] = SAMPLE_IMAGES) => {
  const result = buildProposal(sampleInputs({ brand: { ...sampleBrand(), ...brand }, images }));
  if (!result.ok) throw new Error(result.problems.join(" "));
  return result;
};
function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, found));
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value)) {
      found.add(key.toLowerCase());
      keysOf(inner, found);
    }
  return found;
}

describe("payment terms", () => {
  it("start as nothing asked for and nothing shown", () => {
    expect(start).toMatchObject({
      gst: "included",
      deposit: { kind: "none", amount: 0 },
      milestones: [],
      bank: { name: "", bsb: "", number: "" },
    });
  });
  it("take a deposit as none, a percentage or a set amount", () => {
    expect(cleanDeposit({ kind: "none", amount: 50 })).toEqual({ kind: "none", amount: 0 });
    expect(cleanDeposit({ kind: "percent", amount: "20" })).toEqual({ kind: "percent", amount: 20 });
    expect(cleanDeposit({ kind: "fixed", amount: 499.6 })).toEqual({ kind: "fixed", amount: 500 });
    for (const bad of [
      { kind: "percent", amount: 0 },
      { kind: "percent", amount: 101 },
      { kind: "fixed", amount: -1 },
      { kind: "fixed", amount: 2_000_000 },
      { kind: "half" },
    ])
      expect(cleanDeposit(bad)).toBeNull();
    expect(refused({ deposit: { kind: "percent", amount: 500 } })).toBe(DEPOSIT_WRONG);
  });
  it("take milestones only when they add up to 100, and say what they add up to when they don't", () => {
    expect(cleanMilestones([])).toEqual({ ok: true, value: [] });
    expect(
      cleanMilestones([
        { percent: 20, name: " Deposit " },
        { percent: "80", name: "Installation completion" },
        { percent: "", name: "" },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { percent: 20, name: "Deposit" },
        { percent: 80, name: "Installation completion" },
      ],
    });
    expect(
      cleanMilestones([
        { percent: 33.3, name: "A" },
        { percent: 33.3, name: "B" },
        { percent: 33.4, name: "C" },
      ]).ok,
    ).toBe(true);
    const short = cleanMilestones([
      { percent: 20, name: "Deposit" },
      { percent: 65, name: "On installation" },
    ]);
    expect(short).toEqual({
      ok: false,
      message: "The payment milestones add up to 85%. They need to add up to 100%: change them, or take them all out.",
    });
    expect(cleanMilestones([{ percent: 100, name: "" }])).toEqual({ ok: false, message: MILESTONE_NAME_MISSING });
    expect(cleanMilestones([{ percent: 0, name: "Deposit" }])).toEqual({ ok: false, message: MILESTONE_NAME_MISSING });
    expect(refused({ milestones: [{ percent: 50, name: "Half" }] })).toMatch(/add up to 50%/);
  });
  it("take bank details whole or not at all", () => {
    expect(cleanBank({ name: " Example Solar Pty Ltd ", bsb: "063-000", number: "1234 5678", reference: "Your surname" })).toEqual({
      name: "Example Solar Pty Ltd",
      bsb: "063000",
      number: "12345678",
      reference: "Your surname",
    });
    expect(cleanBank({})).toEqual({ name: "", bsb: "", number: "", reference: "" });
    expect(cleanBank({ name: "", bsb: "", number: "", reference: "left over" })).toEqual({ name: "", bsb: "", number: "", reference: "" });
    for (const bad of [
      { name: "Example", bsb: "06300", number: "12345678" },
      { name: "Example", bsb: "063000", number: "12" },
      { name: "", bsb: "063000", number: "12345678" },
      { name: "Example", bsb: "063000", number: "12345678901" },
      { name: "Example", bsb: "o63ooo", number: "12345678" },
    ])
      expect(cleanBank(bad)).toBeNull();
    expect(refused({ bank: { name: "Example", bsb: "1", number: "2" } })).toBe(BANK_INCOMPLETE);
    expect(shownBsb("063000")).toBe("063-000");
  });
  it("work out what each comes to from what the customer pays", () => {
    expect(depositOf({ kind: "none", amount: 0 }, 11454)).toBeNull();
    expect(depositOf({ kind: "percent", amount: 20 }, 11454)).toBe(2290.8);
    expect(depositOf({ kind: "fixed", amount: 500 }, 11454)).toBe(500);
    // Never more than the whole price.
    expect(depositOf({ kind: "fixed", amount: 50_000 }, 11454)).toBe(11454);
    const parts = milestoneAmounts(
      [
        { percent: 33.3, name: "A" },
        { percent: 33.3, name: "B" },
        { percent: 33.4, name: "C" },
      ],
      10_001,
    );
    // To the cent, the last taking up the rounding.
    expect(parts.map((p) => p.amount)).toEqual([3330.33, 3330.33, 3340.34]);
    expect(parts.reduce((sum, p) => sum + Math.round(p.amount * 100), 0)).toBe(1_000_100);
    expect(milestoneAmounts([], 5000)).toEqual([]);
    expect(splitGst(17078)).toEqual({ beforeGst: 15525, gst: 1553 });
  });
});

describe("warranty, installation time and who is told", () => {
  it("take a workmanship warranty in whole years, or none", () => {
    expect(cleaned({ warrantyYears: "10", warrantyWords: " Covers our work. " })).toMatchObject({
      warrantyYears: 10,
      warrantyWords: "Covers our work.",
    });
    expect(cleaned({ warrantyYears: "" }, { ...start, warrantyYears: 5 }).warrantyYears).toBeNull();
    for (const bad of [0, 31, 2.5, "ten", -1]) expect(refused({ warrantyYears: bad })).toBe(WARRANTY_WRONG);
  });
  it("say whose warranty it is", () => {
    expect(warrantyNote("Example Solar")).toBe(
      "This is Example Solar's own warranty on its workmanship. The products carry their manufacturers' warranties.",
    );
    expect(warrantyNote("Example Solar")).not.toMatch(/RENUABL|guarantee/i);
  });
  it("take an installation time from the choices only, and call it an estimate", () => {
    expect(cleaned({ installTime: "9-12" }).installTime).toBe("9-12");
    expect(cleaned({ installTime: "tomorrow" }).installTime).toBe("");
    expect(TIMING_NOTE).toMatch(/estimate/i);
    expect(TIMING_NOTE).not.toMatch(/guarantee|will be installed/i);
  });
  it("take extra addresses that look like addresses, once each, up to the limit", () => {
    expect(cleanNotify([" Office@Example.com ", "office@example.com", "", "jobs@example.com"])).toEqual({
      ok: true,
      value: ["office@example.com", "jobs@example.com"],
    });
    expect(cleanNotify(["office@example.com", "not an address"])).toEqual({
      ok: false,
      message: '"not an address" doesn\'t look like an email address.',
    });
    const many = cleanNotify(Array.from({ length: 12 }, (_, i) => `a${i}@example.com`));
    expect(many.ok && many.value).toHaveLength(MAX_NOTIFY);
    expect(refused({ notify: ["nope"] })).toMatch(/doesn't look like an email/);
  });
  it("tell them who accepted and which job, and nothing of the proposal", () => {
    const email = proposalAcceptedEmail({
      business: "Example Solar",
      customer: "Alex Example",
      title: "Solar",
      acceptedBy: "Alex Example",
      link: "https://www.renuabl.com.au/design/deals/job_1",
    });
    expect(email.subject).toBe("Alex Example accepted your proposal");
    expect(email.text).toContain("https://www.renuabl.com.au/design/deals/job_1");
    expect(email.text).toMatch(/wasn't sent to the customer/);
    expect(`${email.subject} ${email.text} ${email.html}`).not.toMatch(/\$|BSB|account number|guarantee/i);
  });
  it("offer only fonts the site loads, each with a face the PDF has built in", () => {
    expect(FONTS.map((f) => f.id)).toEqual(["modern", "editorial"]);
    for (const font of FONTS) expect(font.pdf).toMatch(/Helvetica|Times/);
    expect(cleaned({ font: "editorial" }).font).toBe("editorial");
    expect(cleaned({ font: "comic" }).font).toBe("modern");
  });
});

describe("the proposal's blocks", () => {
  it("start as the usual ones on, in the usual order, the business's own three off", () => {
    const blocks = defaultBlocks();
    expect(blocks.map((b) => b.id)).toEqual(BLOCKS.map((b) => b.id));
    expect(blocks.filter((b) => !b.on).map((b) => b.id)).toEqual(["custom-1", "custom-2", "custom-3"]);
    expect(blocks[0].id).toBe("cover");
  });
  it("are always made whole: each block once, the cover first, the ones a customer must see always on", () => {
    const blocks = cleanBlocks([
      { id: "price", on: false, heading: "  The   investment ", words: "Line one\r\n\r\n\r\n\r\nLine two" },
      { id: "nonsense", on: true },
      { id: "price", on: true, heading: "Twice" },
      { id: "accept", on: false },
      { id: "conditions", on: false },
      { id: "system", on: false, image: "img_0000000000000000000000aa" },
      { id: "roof", image: "../../etc/passwd" },
      { id: "custom-1", on: true, heading: "<b>Our team</b>", words: "x".repeat(5000) },
      { id: "cover", on: false },
      "junk",
    ]);
    expect(blocks).toHaveLength(BLOCKS.length);
    expect(new Set(blocks.map((b) => b.id)).size).toBe(BLOCKS.length);
    expect(blocks[0]).toMatchObject({ id: "cover", on: true });
    expect(blocks[1]).toEqual({ id: "price", on: true, heading: "The investment", words: "Line one\n\nLine two", image: null });
    for (const id of ["price", "accept", "conditions", "cover"] as const) expect(blocks.find((b) => b.id === id)?.on).toBe(true);
    expect(blocks.find((b) => b.id === "system")).toMatchObject({ on: false, image: "img_0000000000000000000000aa" });
    expect(blocks.find((b) => b.id === "roof")).toMatchObject({ on: true, image: null });
    const own = blocks.find((b) => b.id === "custom-1")!;
    expect(own).toMatchObject({ on: true, heading: "b Our team /b" });
    expect(own.words).toHaveLength(1500);
    // Anything at all still comes back as the full, usual list.
    for (const junk of [null, "blocks", 5, {}, []]) expect(cleanBlocks(junk)).toEqual(defaultBlocks());
    expect(BLOCKS.filter((b) => isLocked(b.id)).map((b) => b.id)).toEqual(["cover", "price", "accept", "conditions", "terms"]);
  });
  it("move up and down, never above the cover or off the end", () => {
    const blocks = defaultBlocks();
    expect(
      moveBlock(blocks, "roof", -1)
        .map((b) => b.id)
        .slice(0, 4),
    ).toEqual(["cover", "roof", "system", "production"]);
    expect(moveBlock(blocks, "system", -1)).toEqual(blocks);
    expect(moveBlock(blocks, "cover", 1)).toEqual(blocks);
    // The standard terms close the proposal: they don't move, and nothing moves below them.
    expect(blocks[blocks.length - 1].id).toBe("terms");
    expect(moveBlock(blocks, "conditions", 1)).toEqual(blocks);
    expect(moveBlock(blocks, "terms", -1)).toEqual(blocks);
    expect(
      moveBlock(blocks, "system", 1)
        .map((b) => b.id)
        .slice(0, 3),
    ).toEqual(["cover", "roof", "system"]);
  });
  it("read back from an old or damaged kit as the usual blocks", () => {
    expect(readBrandKit({ name: "Example Solar" }, "Example Solar").blocks).toEqual(defaultBlocks());
    expect(
      readBrandKit({ name: "Example Solar", blocks: [{ id: "bill", on: false }] }, "Example Solar").blocks.find((b) => b.id === "bill")?.on,
    ).toBe(false);
  });
  it("have a usual heading that a business's own replaces", () => {
    expect(blockHeading({ id: "price", heading: "" })).toBe("Your price");
    expect(blockHeading({ id: "price", heading: "The investment" })).toBe("The investment");
    expect(blockHeading({ id: "about", heading: "" }, "About Example Solar")).toBe("About Example Solar");
    expect(viewBlocks({})).toBe(USUAL_BLOCKS);
    expect(USUAL_BLOCKS.map((b) => b.id)).not.toContain("custom-1");
  });
});

describe("a proposal with the business's terms and blocks", () => {
  const terms: Partial<BrandKit> = {
    gst: "excluded",
    font: "editorial",
    deposit: { kind: "percent", amount: 20 },
    milestones: [
      { percent: 20, name: "Deposit" },
      { percent: 80, name: "Installation completion" },
    ],
    bank: { name: "Example Solar Pty Ltd", bsb: "063000", number: "12345678", reference: "Your surname" },
    warrantyYears: 10,
    warrantyWords: "Covers our workmanship.",
    installTime: "3-4",
  };
  it("carries them as the customer will read them", () => {
    const { view } = built(terms);
    const youPay = view.price.youPay;
    expect(view.theme.font).toBe("editorial");
    expect(view.price).toMatchObject({ gstShown: "excluded", ...splitGst(view.price.incGst) });
    expect(view.price.beforeGst! + view.price.gst!).toBe(view.price.incGst);
    expect(view.terms).toEqual({
      // To the cent, and the deposit and a first milestone of the same share are the same figure.
      deposit: Math.round(youPay * 20) / 100,
      milestones: [
        { name: "Deposit", percent: 20, amount: Math.round(youPay * 20) / 100 },
        { name: "Installation completion", percent: 80, amount: (youPay * 100 - Math.round(youPay * 20)) / 100 },
      ],
      bank: terms.bank,
      payLink: null,
      warranty: { years: 10, words: "Covers our workmanship." },
      installTime: "3 to 4 weeks",
    });
  });
  it("carries none where none are set, and the price as one figure", () => {
    const { view } = built({});
    expect(view.terms).toEqual({ deposit: null, milestones: [], bank: null, payLink: null, warranty: null, installTime: null });
    expect(view.price.gstShown).toBe("included");
    expect(view.price).not.toHaveProperty("beforeGst");
    expect(view.price).not.toHaveProperty("gst");
  });
  it("follows the blocks: only those shown, in the business's order, with its own heading, words and picture", () => {
    const picture: BrandImage = { id: "img_0000000000000000000000dd", kind: "block", width: 1200, height: 800 };
    const blocks = cleanBlocks([
      { id: "price", heading: "The investment" },
      { id: "custom-1", on: true, heading: "Our team", words: "Ten years on roofs.", image: picture.id },
      { id: "roof", on: false },
      { id: "bill", on: false },
      // A picture that isn't one of the business's block pictures (here, its logo) isn't carried.
      { id: "system", image: SAMPLE_IMAGES[0].id },
    ]);
    const { view } = built({ blocks }, [...SAMPLE_IMAGES, picture]);
    const ids = view.blocks!.map((b) => b.id);
    expect(ids.slice(0, 4)).toEqual(["cover", "price", "custom-1", "system"]);
    expect(ids).not.toContain("roof");
    expect(ids).not.toContain("bill");
    expect(ids).not.toContain("custom-2");
    // The ones a customer must see are there whatever was switched off.
    for (const id of ["cover", "price", "accept", "conditions"]) expect(ids).toContain(id);
    expect(view.blocks![1]).toEqual({ id: "price", heading: "The investment", words: "", image: null });
    expect(view.blocks![2]).toEqual({ id: "custom-1", heading: "Our team", words: "Ten years on roofs.", image: picture });
    expect(view.blocks![3].image).toBeNull();
  });
  it("still carries no cost, margin or product code, with every term and block set", () => {
    const { view, internal } = built({
      ...terms,
      gst: "included",
      blocks: cleanBlocks([{ id: "custom-1", on: true, heading: "Ours", words: "Words" }]),
    });
    const keys = keysOf(view);
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
    const sent = JSON.stringify(view);
    for (const secret of [internal.cost, internal.margin, internal.priceExGst]) expect(sent).not.toContain(String(secret));
    for (const code of ["JKM475N-48QL6-DB", "SGWSG5.0RS", "ANTRAIL"]) expect(sent).not.toContain(code);
    // Shown separately, the price before GST is the customer's own price less its GST: said on purpose, and still no cost or margin.
    const split = built({ ...terms, gst: "excluded" });
    const splitKeys = keysOf(split.view);
    for (const word of COST_WORDS) expect(splitKeys).not.toContain(word.toLowerCase());
    for (const secret of [split.internal.cost, split.internal.margin]) expect(JSON.stringify(split.view)).not.toContain(String(secret));
  });
  it("says to check bank details before paying", () => {
    expect(BANK_NOTE).toMatch(/before you pay/);
  });
});

describe("what each person may do", () => {
  it("lets the owner do everything, whatever is stored against them", () => {
    for (const action of ["design", "costs", "prices", "publish", "members"] as const)
      expect(can("owner", action, { costs: false, prices: false, publish: false, allDeals: false })).toBe(true);
  });
  it("lets a member design always, manage people never, and the rest as the owner has set", () => {
    const none = { costs: false, prices: false, publish: false, allDeals: false };
    expect(can("member", "design", none)).toBe(true);
    expect(can("member", "members", ALL_PERMISSIONS)).toBe(false);
    for (const action of ["costs", "prices", "publish"] as const) {
      expect(can("member", action, none)).toBe(false);
      expect(can("member", action, ALL_PERMISSIONS)).toBe(true);
      expect(can("member", action)).toBe(true);
      expect(can("stranger" as never, action, ALL_PERMISSIONS)).toBe(false);
    }
    expect(can("member", "publish", { costs: false, prices: false, publish: true, allDeals: true })).toBe(true);
  });
  it("reads permissions so only an explicit no switches one off, and nobody changes prices they can't see", () => {
    expect(cleanPermissions(null)).toEqual(ALL_PERMISSIONS);
    expect(cleanPermissions({ costs: "false", publish: 0 })).toEqual(ALL_PERMISSIONS);
    expect(cleanPermissions({ publish: false })).toEqual({ costs: true, prices: true, publish: false, allDeals: true });
    expect(cleanPermissions({ costs: false, prices: true })).toEqual({ costs: false, prices: false, publish: true, allDeals: true });
    expect(can("member", "prices", { costs: false, prices: true, publish: true, allDeals: true })).toBe(false);
    expect(PERMISSIONS.map((p) => p.key)).toEqual(["costs", "prices", "publish", "allDeals"]);
    for (const action of ["costs", "prices", "publish", "members"] as const) expect(refusal(action)).toMatch(/owner/);
  });
  it("sends someone who may not see costs the products without a single real figure", () => {
    const workspace = pricedWorkspace();
    const real = cleanWorkspaceSettings({
      ...workspace,
      settings: { ...workspace.settings, stcPrice: 37, margin: { ...workspace.settings.margin, base: 4321 } },
    });
    const hidden = withoutCosts(real, workspace.lists);
    // The products are still there to draw with, under their own names and sizes.
    expect(hidden.lists[0].panels.length).toBe(workspace.lists[0].panels.length);
    expect(hidden.lists[0].panels[0]).toMatchObject({
      sku: workspace.lists[0].panels[0].sku,
      watts: workspace.lists[0].panels[0].watts,
      cost: HIDDEN_COST,
    });
    // No row of the price list, and no cost on any product.
    expect(hidden.lists[0].items).toEqual([]);
    for (const list of hidden.lists)
      for (const p of [...list.panels, ...list.inverters, ...list.batteries]) expect(p.cost).toBe(HIDDEN_COST);
    const sent = JSON.stringify(hidden);
    expect(sent).not.toContain("4321");
    for (const item of workspace.lists[0].items.slice(0, 50)) if (item.cost > 5) expect(sent).not.toContain(`"cost":${item.cost},`);
    // The margin and rates are the placeholders every business starts with; the bill figures and certificate price stay.
    expect(hidden.settings.settings.margin).not.toEqual(real.settings.margin);
    expect(hidden.settings.settings.stcPrice).toBe(37);
    expect(hidden.settings.settings.bill).toEqual(real.settings.bill);
    expect(withoutCosts(null, []).lists).toEqual([]);
  });
  it("keeps the costs typed on a quote from someone who can't see them, both ways", () => {
    const extras = sampleInputs({ unpriced: false }).project.extras;
    const withEdit = { ...extras, quotes: [{ ...extras.quotes[0], edits: { "Racking|Rails": { amount: 250 } } }] };
    expect(withoutCostEdits(withEdit).quotes[0].edits).toEqual({});
    expect(withoutCostEdits(withEdit).bill).toEqual(withEdit.bill);
    // What they save comes back with no edits (they were sent none): the business's own stay.
    const sent = { ...withEdit, bill: { ...withEdit.bill, amount: "700" }, quotes: [{ ...withEdit.quotes[0], edits: {} }] };
    const kept = keepCostEdits(sent, withEdit);
    expect(kept.bill.amount).toBe("700");
    expect(kept.quotes[0].edits).toEqual({ "Racking|Rails": { amount: 250 } });
    // And an edit they try to send isn't taken.
    const tried = { ...sent, quotes: [{ ...sent.quotes[0], edits: { "Panels|Jinko": { amount: 1 } } }] };
    expect(keepCostEdits(tried, withEdit).quotes[0].edits).toEqual({ "Racking|Rails": { amount: 250 } });
    expect(keepCostEdits(tried, null).quotes[0].edits).toEqual({});
  });
});
