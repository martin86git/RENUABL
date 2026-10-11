import { describe, expect, it } from "vitest";
import { hubspotAllowedPath } from "../hubspot-tracking";
import { pixelAllowedPath } from "../meta-pixel";
import { VERIFIED_RATES } from "../rebates";
import {
  BRAND_ABN_WRONG,
  BRAND_COLOUR_WRONG,
  BRAND_EMAIL_WRONG,
  BRAND_NAME_MISSING,
  BRAND_WEBSITE_WRONG,
  PALETTES,
  TEMPLATES,
  cleanBrandKit,
  cleanColour,
  cleanWebsite,
  contrast,
  defaultBrand,
  inkOn,
  isAbn,
  readBrandKit,
  sniffImage,
  themeVars,
} from "./brand";
import {
  ACCEPT_LINE,
  ACCEPT_NAME_MISSING,
  ACCEPT_TICK_MISSING,
  ACCEPT_WITH_CONDITIONS,
  COST_WORDS,
  ESTIMATE_NOTE,
  NOTHING_DRAWN,
  PRODUCTION_NOTE,
  QUESTION_MISSING,
  SAVING_NOTE,
  STC_NOTE,
  addDays,
  buildProposal,
  cleanAcceptance,
  cleanChoice,
  cleanQuestion,
  inVictoria,
  isProposalToken,
  proposalState,
  shownSaving,
  type ProposalView,
} from "./proposal";
import { PLACE, pricedWorkspace, sampleBrand, sampleInputs, sampleSet } from "./proposal-fixture";
import { costSystem, designFinance, editedLines, repriced, stcValue } from "./quote";
import { designSummary, monthlyProduction } from "./roof-design";
import { YIELD_PER_KW_DAY, batteryKwhOf, systemSpecOf } from "./system";

const built = (over: Parameters<typeof sampleInputs>[0] = {}) => {
  const result = buildProposal(sampleInputs(over));
  if (!result.ok) throw new Error(result.problems.join(" "));
  return result;
};

/** Every field name anywhere in a value, however deep. */
function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, found));
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      keysOf(inner, found);
    }
  return found;
}

describe("the system a design describes", () => {
  it("is read from the drawing and the products named on it", () => {
    const design = sampleSet(true).designs[0];
    expect(systemSpecOf(design)).toEqual({
      panels: 16,
      panel: { sku: "JKM475N-48QL6-DB", name: "Jinko 475W", watts: 475, short: 1.134 },
      inverters: [{ sku: "SGWSG5.0RS", name: "Sungrow 5kW Single Phase 2 MPPT Inverter" }],
      battery: { sku: "SIG11130001", name: "Sigenergy 8 kWh module", kwh: 8, qty: 2 },
      arrays: 1,
      // A face is drawn at the usual roof pitch, so its panels count as tilted (which only matters on a flat roof).
      tiltedPanels: 16,
      tiltDegrees: 22,
    });
    expect(batteryKwhOf(design)).toBe(16);
  });
  it("prices a design that names no panel with the first on the business's lists, as the designer does", () => {
    // The same drawing with no products named on it.
    const bare = { faces: sampleSet().designs[0].faces };
    expect(systemSpecOf(bare, { sku: "FIRST", name: "First listed panel" })).toMatchObject({
      panel: { sku: "FIRST", name: "First listed panel", watts: 475 },
      inverters: [],
      battery: null,
    });
    expect(systemSpecOf(bare).panel).toMatchObject({ sku: "", name: "Panels" });
    expect(batteryKwhOf({})).toBe(0);
  });
});

describe("a business's branding", () => {
  const start = defaultBrand("Example Solar");
  it("starts from the account's name and plain colours", () => {
    expect(start).toMatchObject({ name: "Example Solar", template: "classic", palette: "paper", validDays: 14, licences: [], points: [] });
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "compact", "bold"]);
    expect(PALETTES).toHaveLength(3);
  });
  it("lays what was sent over what it has, tidied and cut to length", () => {
    const next = cleanBrandKit(
      {
        name: "  Example   Solar Co ",
        email: " Hello@Example.com ",
        website: "example.com.au/",
        abn: "51 824 753 556",
        licences: ["REC 1", "", "REC 2", "REC 3", "REC 4", "REC 5"],
        points: ["a".repeat(300)],
        about: "Line one\r\n\r\n\r\n\r\nLine two",
        primary: "#0F4C81",
        template: "bold",
        palette: "night",
        validDays: 30,
      },
      start,
    );
    if (!next.ok) throw new Error(next.message);
    expect(next.value).toMatchObject({
      name: "Example Solar Co",
      email: "hello@example.com",
      website: "https://example.com.au",
      abn: "51824753556",
      licences: ["REC 1", "REC 2", "REC 3", "REC 4"],
      about: "Line one\n\nLine two",
      primary: "#0f4c81",
      accent: start.accent,
      template: "bold",
      palette: "night",
      validDays: 30,
      tagline: "",
    });
    expect(next.value.points[0]).toHaveLength(140);
    // Anything it doesn't know is ignored, and a choice that isn't on offer leaves the one it had.
    const odd = cleanBrandKit({ template: "fancy", palette: "neon", validDays: 365, businessId: "biz_other", margin: 1 }, start);
    expect(odd).toEqual({ ok: true, value: start });
  });
  it("refuses what would mislead or break a page, with a plain reason", () => {
    const message = (raw: unknown) => {
      const c = cleanBrandKit(raw, start);
      return c.ok ? null : c.message;
    };
    expect(message({ name: "x" })).toBe(BRAND_NAME_MISSING);
    expect(message({ email: "not-an-email" })).toBe(BRAND_EMAIL_WRONG);
    expect(message({ website: "javascript:alert(1)" })).toBe(BRAND_WEBSITE_WRONG);
    expect(message({ abn: "12345678901" })).toBe(BRAND_ABN_WRONG);
    for (const colour of ["red", "#fff", "#12345g", "url(x)", "#0f4c81;background:url(x)", 5])
      expect(message({ primary: colour })).toBe(BRAND_COLOUR_WRONG);
  });
  it("reads an old or damaged saved kit as the starting one", () => {
    expect(readBrandKit(null, "Example Solar")).toEqual(start);
    expect(readBrandKit({ name: "", primary: "nope" }, "Example Solar")).toEqual(start);
    expect(readBrandKit({ tagline: "Kept" }, "Example Solar").tagline).toBe("Kept");
  });
  it("takes a web address only as http or https", () => {
    expect(cleanWebsite("")).toBe("");
    expect(cleanWebsite("www.example.com.au")).toBe("https://www.example.com.au");
    expect(cleanWebsite("http://example.com/solar")).toBe("http://example.com/solar");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "example", "https://user:pw@example.com"])
      expect(cleanWebsite(bad)).toBeNull();
  });
  it("checks an ABN by its checksum", () => {
    expect(isAbn("51824753556")).toBe(true);
    expect(isAbn("51824753557")).toBe(false);
    expect(isAbn("5182475355")).toBe(false);
  });
  it("only ever lets six hex digits be a colour", () => {
    expect(cleanColour(" #0F4C81 ")).toBe("#0f4c81");
    for (const bad of ["0f4c81", "#0f4c8", "rgb(0,0,0)", "#0f4c81}", null, 1]) expect(cleanColour(bad)).toBeNull();
  });
  it("puts readable text on any colour", () => {
    expect(inkOn("#0f4c81")).toBe("#ffffff");
    expect(inkOn("#ffe680")).toBe("#0b0b0c");
    expect(inkOn("#ffffff")).toBe("#0b0b0c");
    expect(inkOn("#000000")).toBe("#ffffff");
    for (const colour of ["#0f4c81", "#ffe680", "#ff5a1f", "#7c7c7c", "#22c55e"])
      expect(contrast(colour, inkOn(colour))).toBeGreaterThanOrEqual(4.5);
  });
  it("turns a theme into the site's own colour tokens, and never lets an unreadable accent through", () => {
    const vars = themeVars({ palette: "paper", primary: "#0f4c81", accent: "#c2410c" });
    expect(vars).toMatchObject({ "--canvas": "#f6f6f4", "--primary": "#0f4c81", "--primary-ink": "#ffffff", "--accent": "#c2410c" });
    // Every colour is six hex digits; the one thing that isn't a colour is the headings' face, which is one of two fixed values.
    for (const [name, value] of Object.entries(vars)) if (name !== "--proposal-heading") expect(value).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["--proposal-heading"]).toBe("inherit");
    expect(themeVars({ palette: "paper", primary: "#0f4c81", accent: "#c2410c", font: "editorial" })["--proposal-heading"]).toMatch(
      /^var\(--font-serif\)/,
    );
    // A pale accent on a pale page gives way to the page's text colour.
    expect(themeVars({ palette: "paper", primary: "#0f4c81", accent: "#fff7cc" })["--accent"]).toBe("#16181d");
    expect(themeVars({ palette: "night", primary: "#0f4c81", accent: "#fff7cc" })["--accent"]).toBe("#fff7cc");
    expect(themeVars({ palette: "gone" as never, primary: "#000000", accent: "#000000" })["--canvas"]).toBe("#f6f6f4");
  });
  it("tells a picture by its own bytes, and an SVG is never one", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFFxxxxWEBPVP8 "))).toBe("webp");
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

describe("a proposal worked out from what is saved", () => {
  it("carries the same price the designer's quote builder shows", () => {
    const input = sampleInputs();
    const { view, internal } = built();
    // The quote builder's own sums, done here the way `DesignQuote` does them.
    const design = input.project.set.designs[0];
    const quote = input.project.extras.quotes[0];
    const costing = costSystem(systemSpecOf(design), quote.form, input.workspace);
    const lines = editedLines(costing.lines, quote.edits);
    const totals = Object.keys(quote.edits).length ? repriced(costing, lines) : costing;
    const stc = stcValue(costing, "3150", "2026-10-12", VERIFIED_RATES, input.workspace.settings.stcPrice);
    expect(view.price).toMatchObject({ incGst: totals.priceIncGst, stc, youPay: totals.priceIncGst - stc });
    expect(view.price.youPay).toBeGreaterThan(3000);
    expect(view.price.includes).toEqual([
      "Solar panels",
      "Inverter",
      "Roof mounting",
      "Electrical parts and metering",
      "Installation",
      "GST",
    ]);
    expect(internal).toMatchObject({
      cost: totals.cost,
      margin: costing.margin,
      priceExGst: totals.priceExGst,
      projectVersion: 3,
      design: 0,
    });
    expect(internal.lines.length).toBe(lines.length);
  });
  it("carries the same output and bill estimates the designer shows", () => {
    const input = sampleInputs();
    const { view } = built();
    const design = input.project.set.designs[0];
    const months = monthlyProduction(design, YIELD_PER_KW_DAY);
    const finance = designFinance(
      { interval: "quarterly", amount: 600, supplyPerDay: 1, rate: 0.3, feedIn: 0.04 },
      months,
      0,
      input.workspace.settings.bill.selfUseShare,
    )!;
    expect(view.system).toMatchObject({ panels: 16, kw: designSummary(design).kw, batteryKwh: 0 });
    expect(view.production).toEqual({ monthlyKwh: months, yearKwh: months.reduce((n, m) => n + m, 0) });
    expect(view.bill).toMatchObject({ now: finance.billNow, after: finance.billAfter, dailyKwh: finance.dailyKwh });
    // The saving is rounded down, never up.
    expect(view.bill!.saving).toBe(Math.floor((finance.billNow - finance.billAfter) / 10) * 10);
    expect(view.bill!.saving).toBeLessThanOrEqual(finance.saving);
    expect(view.bill!.assumed).toEqual({
      interval: "quarterly",
      amount: 600,
      supplyPerDay: 1,
      rate: 0.3,
      feedIn: 0.04,
      selfUseShare: 0.35,
    });
    expect(view.paybackYears).toBe(Math.round((view.price.youPay / view.bill!.saving) * 10) / 10);
  });
  it("says who it is from and for, and when the price stands until", () => {
    const { view } = built({ choice: { template: "bold", validDays: 30, note: "See you Tuesday." } });
    expect(view).toMatchObject({
      version: 1,
      publishedAt: "2026-10-12T01:00:00.000Z",
      validUntil: "2026-11-11",
      template: "bold",
      theme: { palette: "paper", primary: "#0f4c81", accent: "#c2410c" },
      customer: { name: "Alex Example", address: "8 Example Court, Glen Waverley VIC 3150" },
      title: "Solar",
      note: "See you Tuesday.",
    });
    expect(view.business).toMatchObject({ name: "Example Solar", abn: "51824753556", conditions: "Example conditions of sale." });
    expect(view.business.logo?.kind).toBe("logo");
    expect(view.business.cover?.kind).toBe("cover");
    expect(view.business.photos).toHaveLength(1);
  });
  it("describes the system as the deal does, with what was typed in by hand winning, and none of the working notes", () => {
    const { view } = built({
      withBattery: true,
      job: { title: "Solar and battery", details: { roofType: "Terracotta tile", nmi: "6000000000", siteAccess: "Dog" } },
    });
    const said = Object.fromEntries(view.system.details.map((d) => [d.label, d.value]));
    expect(said).toMatchObject({
      "System type": "Solar and battery",
      "System size": "7.6 kW",
      "PV panel": "Jinko 475W",
      "Panel qty": "16",
      Inverter: "Sungrow 5kW Single Phase 2 MPPT Inverter",
      Battery: "Sigenergy 8 kWh module",
      "Battery storage": "16 kWh",
      "Roof type": "Terracotta tile",
    });
    expect(Object.keys(said)).not.toContain("NMI");
    expect(Object.keys(said)).not.toContain("Site access");
    expect(view.system.batteryKwh).toBe(16);
    expect(view.price.includes).toContain("Battery");
  });
  it("draws every panel where it was placed", () => {
    const { view } = built();
    expect(view.roof).toMatchObject(PLACE);
    expect(view.roof.panels).toHaveLength(16);
    for (const panel of view.roof.panels) {
      expect(panel).toHaveLength(8);
      // Inside the face that was traced (10 m by 4 m about the middle).
      for (let i = 0; i < 8; i += 2) expect(Math.abs(panel[i]) <= 5 && Math.abs(panel[i + 1]) <= 2).toBe(true);
    }
  });

  it("never carries a cost, a margin or a product code to the customer", () => {
    for (const over of [{}, { withBattery: true }]) {
      const { view, internal } = built(over);
      const keys = [...keysOf(view)].map((k) => k.toLowerCase());
      for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
      // Nor by another name: none of the business's own figures or product codes appears as a value anywhere in it.
      const sent = JSON.stringify(view);
      for (const secret of [internal.cost, internal.margin, internal.priceExGst]) expect(sent).not.toContain(String(secret));
      for (const code of ["JKM475N-48QL6-DB", "SGWSG5.0RS", "SIG11130001", "ANTRAIL"]) expect(sent).not.toContain(code);
      // The business's record does hold them: they are kept, apart.
      expect(internal.lines.length).toBeGreaterThan(4);
      expect(internal.cost).toBeGreaterThan(0);
    }
  });

  it("isn't sent with a hole in the price", () => {
    const unpriced = buildProposal(sampleInputs({ unpriced: true, workspace: { ...pricedWorkspace(), lists: [] } }));
    expect(unpriced.ok).toBe(false);
    if (!unpriced.ok) expect(unpriced.problems[0]).toMatch(/lines on the quote have no cost on file/);

    const input = sampleInputs();
    const empty = { ...input.project.set, designs: [{ ...input.project.set.designs[0], faces: [], inverters: [] }] };
    const nothing = buildProposal({ ...input, project: { ...input.project, set: empty } });
    expect(nothing).toEqual({ ok: false, problems: [NOTHING_DRAWN] });
  });
  it("leaves out the bill when none was entered, and output and savings outside Victoria", () => {
    const input = sampleInputs();
    const noBill = buildProposal({
      ...input,
      project: { ...input.project, extras: { ...input.project.extras, bill: { ...input.project.extras.bill, amount: "" } } },
    });
    if (!noBill.ok) throw new Error("unexpected");
    expect(noBill.view.bill).toBeNull();
    expect(noBill.view.paybackYears).toBeNull();
    expect(noBill.view.production).not.toBeNull();

    const quotes = [{ ...input.project.extras.quotes[0], form: { ...input.project.extras.quotes[0].form, postcode: "2000" } }];
    const sydney = buildProposal({
      ...input,
      project: { ...input.project, address: "1 Sample Street, Sydney NSW 2000", extras: { ...input.project.extras, quotes } },
    });
    if (!sydney.ok) throw new Error("unexpected");
    expect(sydney.view.production).toBeNull();
    expect(sydney.view.bill).toBeNull();
    expect(sydney.view.price.youPay).toBeGreaterThan(0);
    expect(inVictoria("3150") && inVictoria("8001")).toBe(true);
    for (const elsewhere of ["2000", "4000", "0800", "", "abc"]) expect(inVictoria(elsewhere)).toBe(false);
  });
  it("uses the roof's primary design", () => {
    const input = sampleInputs();
    const first = input.project.set.designs[0];
    const second = { ...first, faces: [{ ...first.faces[0], off: [0, 1, 2, 3] }], label: "Fewer panels" };
    const quote = input.project.extras.quotes[0];
    const two = {
      ...input.project,
      set: { ...input.project.set, designs: [first, second], primary: 1 },
      extras: { ...input.project.extras, quotes: [quote, quote] },
    };
    const result = buildProposal({ ...input, project: two });
    if (!result.ok) throw new Error(result.problems.join(" "));
    expect(result.view.system.panels).toBe(12);
    expect(result.internal.design).toBe(1);
  });
});

describe("wording", () => {
  it("calls every estimate an estimate and promises nothing", () => {
    for (const note of [ESTIMATE_NOTE, PRODUCTION_NOTE, SAVING_NOTE, STC_NOTE]) expect(note).toMatch(/estimate/i);
    expect(SAVING_NOTE).toMatch(/rounded down/);
    expect(ESTIMATE_NOTE).toMatch(/leave out shade/);
    const all = [ESTIMATE_NOTE, PRODUCTION_NOTE, SAVING_NOTE, STC_NOTE, ACCEPT_LINE, ACCEPT_WITH_CONDITIONS].join(" ");
    expect(all).not.toMatch(/guarantee|exact|precise|will save you|RENUABL|\bAI\b/i);
  });
  it("rounds a saving down, never up, and never below nothing", () => {
    expect(shownSaving(2400, 1011)).toBe(1380);
    expect(shownSaving(2400, 1010)).toBe(1390);
    expect(shownSaving(1000, 1200)).toBe(0);
  });
});

describe("choices, links and what a customer sends back", () => {
  const brand = sampleBrand();
  it("takes only the choices on offer, falling back to the business's usual ones", () => {
    expect(cleanChoice({ template: "compact", validDays: 7, note: "  Hello\r\n\r\n\r\n\r\nthere  " }, brand)).toEqual({
      template: "compact",
      validDays: 7,
      note: "Hello\n\nthere",
    });
    expect(cleanChoice({ template: "x", validDays: 90, note: 5, price: 1, youPay: 1 }, brand)).toEqual({
      template: "classic",
      validDays: 14,
      note: "",
    });
    expect(cleanChoice(null, { template: "bold", validDays: 30 })).toEqual({ template: "bold", validDays: 30, note: "" });
    expect(cleanChoice({ note: "n".repeat(5000) }, brand).note).toHaveLength(1200);
  });
  it("knows a link we could have made", () => {
    expect(isProposalToken("a".repeat(48))).toBe(true);
    for (const bad of ["a".repeat(47), "A".repeat(48), "g".repeat(48), `${"a".repeat(48)}/..`, "", null, 5])
      expect(isProposalToken(bad)).toBe(false);
  });
  it("says where a proposal stands", () => {
    const p = { withdrawn: false, accepted: false, validUntil: "2026-10-26" };
    expect(proposalState(p, "2026-10-26")).toBe("live");
    expect(proposalState(p, "2026-10-27")).toBe("lapsed");
    expect(proposalState({ ...p, accepted: true }, "2027-01-01")).toBe("accepted");
    expect(proposalState({ ...p, accepted: true, withdrawn: true }, "2026-10-20")).toBe("withdrawn");
    expect(addDays("2026-10-12", 14)).toBe("2026-10-26");
    expect(addDays("2026-12-25", 7)).toBe("2027-01-01");
  });
  it("needs a typed name and the customer's own tick to go ahead", () => {
    expect(cleanAcceptance({ name: "  Alex   Example ", agree: true })).toEqual({ ok: true, value: { name: "Alex Example" } });
    expect(cleanAcceptance({ name: "A", agree: true })).toEqual({ ok: false, message: ACCEPT_NAME_MISSING });
    for (const agree of [false, "true", 1, undefined])
      expect(cleanAcceptance({ name: "Alex Example", agree })).toEqual({ ok: false, message: ACCEPT_TICK_MISSING });
    expect(cleanAcceptance({ name: "<b>Alex</b> Example", agree: true })).toEqual({ ok: true, value: { name: "b Alex /b Example" } });
  });
  it("takes a question as one tidy line", () => {
    expect(cleanQuestion({ text: " Can it go\non the garage? " })).toEqual({ ok: true, value: { text: "Can it go on the garage?" } });
    expect(cleanQuestion({ text: "   " })).toEqual({ ok: false, message: QUESTION_MISSING });
    const long = cleanQuestion({ text: "q".repeat(3000) });
    expect(long.ok && long.value.text.length).toBe(1000);
  });
});

describe("the customer's link", () => {
  it("never runs ad tags", () => {
    const path = `/p/${"a".repeat(48)}`;
    expect(pixelAllowedPath(path)).toBe(false);
    expect(hubspotAllowedPath(path)).toBe(false);
  });
  it("is given a view that reads as a whole proposal", () => {
    const view: ProposalView = built().view;
    expect(Object.keys(view).sort()).toEqual(
      [
        "bill",
        "blocks",
        "business",
        "contract",
        "customer",
        "note",
        "paybackYears",
        "price",
        "production",
        "publishedAt",
        "roof",
        "system",
        "template",
        "terms",
        "theme",
        "title",
        "validUntil",
        "version",
      ].sort(),
    );
  });
});
