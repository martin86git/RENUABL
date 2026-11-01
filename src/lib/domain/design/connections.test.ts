import { describe, expect, it } from "vitest";
import { acceptedEmail, cleanListing, entryLine, matchesSearch, requestEmail, requestRefusal } from "./connections";

describe("a business's listing", () => {
  it("needs a suburb and state to be listed, and checks an ABN when given", () => {
    expect(cleanListing({ listed: true, suburb: "Glen Waverley", state: "VIC" })).toEqual({
      ok: true,
      listing: { listed: true, suburb: "Glen Waverley", state: "VIC", abn: "" },
    });
    expect(cleanListing({ listed: true, suburb: "", state: "VIC" }).ok).toBe(false);
    expect(cleanListing({ listed: true, suburb: "Clayton", state: "Victoria" }).ok).toBe(false);
    expect(cleanListing({ listed: false, suburb: "", state: "" }).ok).toBe(true);
    expect(cleanListing({ listed: true, suburb: "Clayton", state: "VIC", abn: "51 824 753 556" })).toMatchObject({
      ok: true,
      listing: { abn: "51824753556" },
    });
    expect(cleanListing({ listed: true, suburb: "Clayton", state: "VIC", abn: "12 345 678 901" }).ok).toBe(false);
  });

  it("is listed only when ticked in so many words", () => {
    expect(cleanListing({ listed: "yes", suburb: "Clayton", state: "VIC" })).toMatchObject({ ok: true, listing: { listed: false } });
  });

  it("takes markup out of a suburb", () => {
    expect(cleanListing({ suburb: "<b>Clayton</b>  South", state: "VIC" })).toMatchObject({ listing: { suburb: "bClayton/b South" } });
  });
});

describe("searching the directory", () => {
  const sparks = { name: "Sparks Electrical", suburb: "Glen Waverley", state: "VIC", abn: "51824753556" };
  it("needs every word to start a word of the name, suburb or state", () => {
    expect(matchesSearch(sparks, "spark glen")).toBe(true);
    expect(matchesSearch(sparks, "electrical vic")).toBe(true);
    expect(matchesSearch(sparks, "sparks clayton")).toBe(false);
    expect(matchesSearch(sparks, "")).toBe(false);
  });
  it("finds a business by its whole ABN, spaces or not", () => {
    expect(matchesSearch(sparks, "51 824 753 556")).toBe(true);
    expect(matchesSearch(sparks, "51824753557")).toBe(false);
  });
});

describe("asking to connect", () => {
  it("is refused for oneself, or when asked or connected already", () => {
    expect(requestRefusal("none", false)).toBeNull();
    expect(requestRefusal("none", true)).toMatch(/your own/);
    expect(requestRefusal("connected", false)).toMatch(/already connected/);
    expect(requestRefusal("requested", false)).toMatch(/already asked/);
    expect(requestRefusal("incoming", false)).toMatch(/accept their request/);
  });

  it("emails only who asked and the way to answer", () => {
    const mail = requestEmail({ from: "Sunrise <Solar>", kind: "retailer", link: "https://x.example/design/connections" });
    expect(mail.subject).toBe("Sunrise <Solar> wants to connect on RENUABL");
    expect(mail.text).toContain("(Solar retailer)");
    expect(mail.html).toContain("Sunrise &lt;Solar&gt;");
    expect(acceptedEmail({ by: "Sparks", link: "https://x.example" }).subject).toBe("Sparks accepted your request on RENUABL");
  });

  it("describes a business in one line", () => {
    expect(entryLine({ kind: "installer", suburb: "Clayton", state: "VIC" })).toBe("Installer · Clayton, VIC");
    expect(entryLine({ kind: "inspector", suburb: "", state: "" })).toBe("Electrical inspector");
  });
});
