import { describe, expect, it } from "vitest";
import {
  CHART_STYLES,
  TEMPLATES,
  TEMPLATE_LOOK,
  TERMS_NEEDS_FILE,
  cleanBrandKit,
  defaultBrand,
  isPdf,
  lookOf,
  lookVars,
  readBrandKit,
  termsFileName,
  termsInUse,
  withOwnTerms,
} from "./brand";
import { ACCEPT_LINE, ACCEPT_WITH_TERMS, acceptLine, acceptWithOwnTerms } from "./proposal";

const kit = () => defaultBrand("Example Solar");
const FILE = { id: "doc_0123456789abcdef01234567", name: "Our terms" };
const bytes = (text: string) => new TextEncoder().encode(text);

describe("the five proposal designs", () => {
  it("are five, each set its own way", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "compact", "bold", "minimal", "split"]);
    const looks = TEMPLATES.map((t) => JSON.stringify(TEMPLATE_LOOK[t.id]));
    expect(new Set(looks).size).toBe(5);
    // Every cover is different: the way a design opens is what tells them apart first.
    expect(new Set(TEMPLATES.map((t) => TEMPLATE_LOOK[t.id].cover)).size).toBe(5);
  });
  it("Minimal has no boxes and numbers its parts; Split puts the headings down the left", () => {
    expect(lookOf("minimal")).toMatchObject({ parts: "lined", numbered: true });
    expect(lookVars("minimal")["--part-bg"]).toBe("transparent");
    expect(lookVars("minimal")["--part-border"]).toBe("0px");
    expect(lookOf("split").headings).toBe("side");
    expect(lookVars("classic")["--part-border"]).toBe("1px");
  });
  it("read an unknown design as Classic", () => {
    expect(lookOf("nonsense")).toEqual(TEMPLATE_LOOK.classic);
  });
  it("can be chosen and kept", () => {
    const saved = cleanBrandKit({ template: "split" }, kit());
    expect(saved.ok && saved.value.template).toBe("split");
    const unknown = cleanBrandKit({ template: "fancy" }, kit());
    expect(unknown.ok && unknown.value.template).toBe("classic");
  });
});

describe("chart styles", () => {
  it("are bars (the start), a line, a shaded area or a table", () => {
    expect(CHART_STYLES.map((c) => c.id)).toEqual(["bars", "line", "area", "table"]);
    expect(kit().chart).toBe("bars");
  });
  it("keep only a style on offer", () => {
    const line = cleanBrandKit({ chart: "line" }, kit());
    expect(line.ok && line.value.chart).toBe("line");
    const pie = cleanBrandKit({ chart: "pie" }, kit());
    expect(pie.ok && pie.value.chart).toBe("bars");
  });
});

describe("the terms on a proposal", () => {
  it("are ours until the business chooses otherwise", () => {
    expect(kit()).toMatchObject({ terms: "standard", standardTerms: true, ownTerms: null });
    expect(termsInUse(kit())).toBe("standard");
  });
  it("can't be the business's own before a file is uploaded", () => {
    expect(cleanBrandKit({ terms: "own" }, kit())).toEqual({ ok: false, message: TERMS_NEEDS_FILE });
  });
  it("become the business's own once it uploads them, and go back to ours when they are taken out", () => {
    const own = withOwnTerms(kit(), FILE);
    expect(own).toMatchObject({ terms: "own", standardTerms: false, ownTerms: FILE });
    expect(termsInUse(own)).toBe("own");
    const back = withOwnTerms(own, null);
    expect(back).toMatchObject({ terms: "standard", standardTerms: true, ownTerms: null });
  });
  it("can switch between ours, theirs and none, keeping the file", () => {
    const own = withOwnTerms(kit(), FILE);
    const ours = cleanBrandKit({ terms: "standard" }, own);
    expect(ours.ok && ours.value).toMatchObject({ terms: "standard", standardTerms: true, ownTerms: FILE });
    const none = cleanBrandKit({ terms: "none" }, own);
    expect(none.ok && termsInUse(none.value)).toBe("none");
  });
  it("never take a file from the browser: only the upload sets it", () => {
    const sneaky = cleanBrandKit({ ownTerms: { id: "doc_ffffffffffffffffffffffff", name: "x" }, terms: "own" }, kit());
    expect(sneaky).toEqual({ ok: false, message: TERMS_NEEDS_FILE });
  });
  it("read the older on/off switch: off is no terms", () => {
    const off = cleanBrandKit({ standardTerms: false }, kit());
    expect(off.ok && off.value.terms).toBe("none");
    // A kit saved before the choice existed.
    expect(readBrandKit({ name: "Example Solar", standardTerms: false }, "Example Solar").terms).toBe("none");
    expect(readBrandKit({ name: "Example Solar" }, "Example Solar").terms).toBe("standard");
  });
  it("keep the business's own file when the kit is read back", () => {
    const saved = JSON.parse(JSON.stringify(withOwnTerms(kit(), FILE)));
    expect(readBrandKit(saved, "Example Solar")).toMatchObject({ terms: "own", ownTerms: FILE });
    // A damaged file id is dropped, and the terms go back to ours rather than to a file that isn't there.
    const damaged = readBrandKit({ ...saved, chart: "area", ownTerms: { id: "../etc", name: "x" } }, "Example Solar");
    expect(damaged).toMatchObject({ ownTerms: null, terms: "standard" });
    // Only the terms fall back: the rest of the kit is kept.
    expect(damaged.chart).toBe("area");
  });
  it("name the business's own terms in what the customer ticks", () => {
    const business = { name: "Example Solar", conditions: "" } as Parameters<typeof acceptLine>[0]["business"];
    expect(acceptLine({ business, contract: null, ownTerms: FILE })).toBe(acceptWithOwnTerms("Example Solar"));
    expect(acceptWithOwnTerms("Example Solar")).toContain("Example Solar's terms and conditions");
    expect(acceptLine({ business, contract: null, ownTerms: null })).toBe(ACCEPT_LINE);
    expect(acceptLine({ business, contract: {} as never })).toBe(ACCEPT_WITH_TERMS);
  });
});

describe("an uploaded terms file", () => {
  it("must be a whole PDF by its own bytes", () => {
    expect(isPdf(bytes("%PDF-1.7\n...\n%%EOF\n"))).toBe(true);
    expect(isPdf(bytes("%PDF-1.7\n...cut short"))).toBe(false);
    expect(isPdf(bytes("<html>%%EOF"))).toBe(false);
    expect(isPdf(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });
  it("is shown under a tidy name", () => {
    expect(termsFileName("C:\\Users\\me\\Terms_and_Conditions_v3.pdf")).toBe("Terms and Conditions v3");
    expect(termsFileName("/tmp/<script>.PDF")).toBe("script");
    expect(termsFileName("")).toBe("Terms and conditions");
    expect(termsFileName(undefined)).toBe("Terms and conditions");
  });
});
