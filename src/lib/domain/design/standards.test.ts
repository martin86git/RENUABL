import { describe, expect, it } from "vitest";
import {
  LICENCE_NEEDED,
  OFFICIAL_SOURCES,
  SOL_REGULATIONS,
  STANDARDS,
  STANDARDS_LIMITS,
  STANDARD_TOO_BIG,
  cleanStandardInput,
  copyLabel,
  libraryForSol,
  partCount,
  solCustomerRegulations,
} from "./standards";

const ok = { code: "AS/NZS 3000", edition: "2018", fileName: "C:\\docs\\wiring.pdf", size: 7_000_000, licence: true };

describe("standards library", () => {
  it("names the standards the user asked for", () => {
    const codes = STANDARDS.map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(["AS/NZS 3000", "AS/NZS 3008.1.1", "AS/NZS 5139", "AS/NZS 4777.1", "AS/NZS 5033"]));
  });

  it("states no edition year of its own: the copy carries it", () => {
    for (const s of STANDARDS) expect(s.code).not.toMatch(/:\d{4}/);
  });

  it("sends parts under Vercel's request limit", () => {
    expect(STANDARDS_LIMITS.partBytes).toBeLessThan(4.5 * 1024 * 1024);
    expect(partCount(1)).toBe(1);
    expect(partCount(STANDARDS_LIMITS.partBytes)).toBe(1);
    expect(partCount(STANDARDS_LIMITS.partBytes + 1)).toBe(2);
  });

  it("needs the licence ticked, a known standard or a named document, and a size in range", () => {
    expect(cleanStandardInput({ ...ok, licence: undefined })).toEqual({ ok: false, message: LICENCE_NEEDED });
    expect(cleanStandardInput({ ...ok, licence: "yes" }).ok).toBe(false);
    expect(cleanStandardInput({ ...ok, code: "AS 9999" }).ok).toBe(false);
    expect(cleanStandardInput({ ...ok, code: "other" }).ok).toBe(false);
    expect(cleanStandardInput({ ...ok, size: STANDARDS_LIMITS.maxBytes + 1 })).toEqual({ ok: false, message: STANDARD_TOO_BIG });
    expect(cleanStandardInput({ ...ok, size: 0 }).ok).toBe(false);
  });

  it("takes the title from ours, the file name without its folder, and counts the parts", () => {
    const got = cleanStandardInput(ok);
    expect(got.ok && got.value).toMatchObject({
      code: "AS/NZS 3000",
      title: "Electrical installations (the Wiring Rules)",
      fileName: "wiring.pdf",
      parts: 3,
    });
    const other = cleanStandardInput({ ...ok, code: "other", title: "  Network <b>connection</b> rules " });
    expect(other.ok && other.value.title).toBe("Network b connection /b rules");
  });

  it("labels a copy with its edition", () => {
    expect(copyLabel({ code: "AS/NZS 5139", title: "Batteries", edition: "2019" })).toBe("AS/NZS 5139:2019 · Batteries");
    expect(copyLabel({ code: "other", title: "SAA guidelines", edition: "" })).toBe("SAA guidelines");
  });

  it("tells Sol what is on file and what isn't", () => {
    const text = libraryForSol([{ code: "AS/NZS 3000", title: "Wiring Rules", edition: "2018" }]);
    expect(text).toContain("AS/NZS 3000:2018");
    expect(text).toMatch(/Not on file: .*AS\/NZS 5139/);
    expect(libraryForSol([])).toContain("No copies are on file");
  });

  it("keeps Sol from signing off compliance or quoting a standard, and keeps customers general", () => {
    expect(SOL_REGULATIONS).toMatch(/Never say a design, site or installation complies/);
    expect(SOL_REGULATIONS).toMatch(/Never quote a standard's text/);
    expect(solCustomerRegulations("[[HAND]]")).toMatch(/Never say whether their own home/);
    expect(solCustomerRegulations("[[HAND]]")).toContain("[[HAND]]");
  });

  it("links only official sources over https", () => {
    for (const s of OFFICIAL_SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });
});
