import { describe, expect, it } from "vitest";
import { cleanBlocks, isFixed, isLocked } from "./blocks";
import { cleanBrandKit, defaultBrand, readBrandKit, type BrandKit } from "./brand";
import { ACCEPT_LINE, ACCEPT_WITH_CONDITIONS, ACCEPT_WITH_TERMS, COST_WORDS, acceptLine, buildProposal, contractDetails } from "./proposal";
import { sampleBrand, sampleInputs } from "./proposal-fixture";
import { NETCC_INFORMATION, STANDARD_TERMS, STANDARD_TERMS_VERSION } from "./standard-terms";

const built = (brand: Partial<BrandKit> = {}, customer = "Alex Example") => {
  const input = sampleInputs({ brand: { ...sampleBrand(), ...brand } });
  const result = buildProposal({ ...input, customer: { ...input.customer, name: customer } });
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

describe("the standard terms and conditions on a proposal", () => {
  it("are on for a business that hasn't chosen, and say nothing about being an Approved Seller", () => {
    expect(defaultBrand("Example Solar")).toMatchObject({ standardTerms: true, netccApproved: false });
    // A kit saved before there were any reads the same.
    expect(readBrandKit({ name: "Example Solar" }, "Example Solar")).toMatchObject({ standardTerms: true, netccApproved: false });
  });
  it("are switched only by a plain yes or no", () => {
    const start = defaultBrand("Example Solar");
    const set = (raw: unknown) => {
      const kit = cleanBrandKit(raw, start);
      if (!kit.ok) throw new Error(kit.message);
      return [kit.value.standardTerms, kit.value.netccApproved];
    };
    expect(set({ standardTerms: false, netccApproved: true })).toEqual([false, true]);
    expect(set({ standardTerms: "false", netccApproved: "yes" })).toEqual([true, false]);
    expect(set({})).toEqual([true, false]);
  });

  it("go into the fixed copy with their version, the names filled in, as they stood", () => {
    const { view } = built({}, "Jordan Placeholder");
    expect(view.contract?.version).toBe(STANDARD_TERMS_VERSION);
    expect(view.contract?.terms).toHaveLength(STANDARD_TERMS.length);
    const text = JSON.stringify(view.contract);
    expect(text).toContain("Example Solar (we, us)");
    expect(text).toContain("Jordan Placeholder (you)");
    expect(text).not.toMatch(/\{seller\}|\{customer\}/);
    // No business is named in them but the one sending the proposal.
    expect(text).not.toMatch(/renuabl|primero/i);
    expect(view.contract?.netcc).toMatchObject({
      heading: NETCC_INFORMATION.heading,
      intro: NETCC_INFORMATION.intro,
      guides: [...NETCC_INFORMATION.guides],
      url: NETCC_INFORMATION.url,
    });
  });
  it("only call a business an Approved Seller when it has said it is", () => {
    expect(built().view.contract?.netcc.seller).toBe(NETCC_INFORMATION.notStated);
    expect(built({ netccApproved: true }).view.contract?.netcc.seller).toBe(
      "Example Solar is a New Energy Tech Approved Seller and has agreed to follow the Code.",
    );
    expect(JSON.stringify(built().view.contract)).not.toContain("is a New Energy Tech Approved Seller and");
  });
  it("carry nothing at all when switched off", () => {
    const { view } = built({ standardTerms: false, netccApproved: true });
    expect(view.contract).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/New Energy Tech|we, us|Changing your mind/);
  });

  it("change what the customer ticks to go ahead", () => {
    expect(acceptLine(built().view)).toBe(ACCEPT_WITH_TERMS);
    expect(acceptLine(built({ standardTerms: false }).view)).toBe(ACCEPT_WITH_CONDITIONS);
    expect(acceptLine(built({ standardTerms: false, conditions: "" }).view)).toBe(ACCEPT_LINE);
    expect(ACCEPT_WITH_TERMS).toMatch(/accept the terms and conditions/);
  });

  it("open with details built from the proposal's own figures", () => {
    const { view } = built({ installTime: "3-4", warrantyYears: 10 });
    const details = contractDetails(view);
    const said = Object.fromEntries(details.rows.map((r) => [r.label, r.value]));
    const money = (n: number) => `$${n.toLocaleString("en-AU")}`;
    expect(said).toMatchObject({
      Customer: "Alex Example",
      Property: "8 Example Court, Glen Waverley VIC 3150",
      "System price, including GST": money(view.price.incGst),
      "Less the federal rebate (STCs), an estimate until installation": money(view.price.stc),
      "Price payable": money(view.price.youPay),
      "Installation time (an estimate)": "3 to 4 weeks",
      "Workmanship warranty": "10 years",
      "The price stands until": "26 October 2026",
    });
    expect(said.Seller).toBe("Example Solar, ABN 51824753556, 1 Sample Street, Glen Waverley VIC 3150, 0491 570 006, hello@example.com");
    expect(said.System).toContain("PV panel: Jinko 475W");
    expect(said.System).toContain("Panel qty: 16");
    // The order the documents apply in, as clause 1 says: special conditions, the proposal, then the terms.
    expect(details.documents).toEqual([
      "The special conditions in this proposal",
      "This proposal (the system, the price and the payment terms)",
      "These terms and conditions",
    ]);
    // With no special conditions, time or warranty set, none is claimed.
    const bare = contractDetails(built({ conditions: "" }).view);
    expect(bare.documents).toHaveLength(2);
    expect(bare.rows.map((r) => r.label)).not.toContain("Workmanship warranty");
    expect(bare.rows.map((r) => r.label)).not.toContain("Installation time (an estimate)");
  });

  it("are a block that is always last, can't be switched off there and can't be reworded", () => {
    expect(isLocked("terms") && isFixed("terms")).toBe(true);
    const blocks = cleanBlocks([
      { id: "terms", on: false, heading: "Our own contract", words: "Ignore the rest.", image: "img_0000000000000000000000aa" },
      { id: "price" },
    ]);
    expect(blocks[blocks.length - 1]).toEqual({ id: "terms", on: true, heading: "", words: "", image: null });
    // On the proposal the block is there; what it shows is the fixed copy's terms, or nothing when they are off.
    expect(built().view.blocks!.at(-1)).toEqual({ id: "terms", heading: "", words: "", image: null });
    expect(built({ standardTerms: false }).view.contract).toBeNull();
  });

  it("still send the customer no cost, margin or product code", () => {
    const { view, internal } = built({ installTime: "3-4", warrantyYears: 10, netccApproved: true });
    const keys = keysOf(view);
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
    const sent = JSON.stringify([view, contractDetails(view)]);
    for (const secret of [internal.cost, internal.margin, internal.priceExGst]) expect(sent).not.toContain(String(secret));
    for (const code of ["JKM475N-48QL6-DB", "SGWSG5.0RS", "ANTRAIL"]) expect(sent).not.toContain(code);
  });
});
