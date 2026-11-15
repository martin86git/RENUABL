import { describe, expect, it } from "vitest";
import {
  cleanColumnMap,
  cleanImportName,
  cleanState,
  cleanWebsite,
  guessColumns,
  mayEmail,
  mobileOf,
  notEmailedBecause,
  readContacts,
} from "./contacts";

describe("guessColumns", () => {
  it("reads common header names", () => {
    const m = guessColumns(["First Name", "Surname", "E-mail Address", "Company Name", "Mobile", "Website", "State", "Job Title"]);
    expect(m).toMatchObject({
      firstName: 0,
      lastName: 1,
      email: 2,
      company: 3,
      mobile: 4,
      phone: -1,
      website: 5,
      state: 6,
      role: 7,
      fullName: -1,
    });
  });

  it("finds an unlabelled email column from the rows", () => {
    const m = guessColumns(
      ["Who", "Details"],
      [
        ["Sam", "sam@example.com"],
        ["Jo", "jo@example.com"],
      ],
    );
    expect(m.email).toBe(1);
  });
});

describe("mobiles", () => {
  it("puts a mobile column and a phone column apart", () => {
    expect(guessColumns(["Email", "Phone", "Mobile Phone"])).toMatchObject({ phone: 1, mobile: 2 });
    expect(guessColumns(["Email", "Office phone", "Mobile No."])).toMatchObject({ phone: 1, mobile: 2 });
    expect(guessColumns(["Email", "Cell"])).toMatchObject({ mobile: 1, phone: -1 });
  });

  it("reads Australian mobiles however they're written", () => {
    expect(mobileOf("0412 345 678")).toBe("+61412345678");
    expect(mobileOf("+61 412 345 678")).toBe("+61412345678");
    expect(mobileOf("412345678")).toBe("+61412345678");
    expect(mobileOf("412345678.0")).toBe("+61412345678");
    expect(mobileOf("(03) 9555 1234")).toBeNull();
  });

  it("keeps both, and moves a mobile out of the phone column when there's no mobile", () => {
    const rows = [
      ["Email", "Phone", "Mobile"],
      ["a@x.com", "03 9555 1234", "0412 345 678"],
      ["b@x.com", "0498 765 432", ""],
      ["c@x.com", "", "not given"],
    ];
    const { contacts } = readContacts(rows, guessColumns(rows[0]));
    expect(contacts.map((c) => [c.mobile, c.phone])).toEqual([
      ["+61412345678", "03 9555 1234"],
      ["+61498765432", null],
      ["not given", null],
    ]);
  });

  it("names an imported file as typed, on one line", () => {
    expect(cleanImportName("  Installers\nNov 2026 ")).toBe("Installers Nov 2026");
    expect(cleanImportName("   ")).toBeNull();
  });
});

describe("cleanColumnMap", () => {
  it("needs an email column inside the sheet", () => {
    expect(cleanColumnMap({ email: 9 }, 3)).toBeNull();
    expect(cleanColumnMap({ email: 1, company: "x" }, 3)).toMatchObject({ email: 1, company: -1 });
  });
});

describe("readContacts", () => {
  const map = guessColumns(["Name", "Email", "Business", "Phone", "State"]);
  it("cleans rows, splits a full name and skips bad or repeated emails", () => {
    const { contacts, skipped } = readContacts(
      [
        ["Name", "Email", "Business", "Phone", "State"],
        ["Sam Lee Smith", " Sam@Example.com ", "Sunrise Solar", "0412 345 678", "victoria"],
        ["Jo", "not an email", "", "", ""],
        ["Al", "", "", "", ""],
        ["", "", "", "", ""],
        ["Sam again", "sam@example.com", "", "", ""],
      ],
      map,
    );
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      email: "sam@example.com",
      firstName: "Sam",
      lastName: "Lee Smith",
      company: "Sunrise Solar",
      state: "VIC",
      mobile: "+61412345678",
      phone: null,
    });
    expect(skipped.map((s) => s.reason)).toEqual(["bad-email", "no-email", "repeat"]);
    expect(skipped[0].row).toBe(3);
  });
});

describe("helpers", () => {
  it("cleans states and websites", () => {
    expect(cleanState("nsw")).toBe("NSW");
    expect(cleanWebsite("sunrise.com.au")).toBe("sunrise.com.au");
    expect(cleanWebsite("call us")).toBeNull();
  });

  it("emails only with consent, never unsubscribed or bounced", () => {
    const base = { unsubscribedAt: null, bouncedAt: null };
    expect(mayEmail({ ...base, consent: "express" })).toBe(true);
    expect(mayEmail({ ...base, consent: "inferred" })).toBe(true);
    expect(mayEmail({ ...base, consent: "unknown" })).toBe(false);
    expect(mayEmail({ ...base, consent: "express", unsubscribedAt: "2026-11-15" })).toBe(false);
    expect(notEmailedBecause({ ...base, consent: "express", bouncedAt: "x" })).toBe("Bounced");
    expect(notEmailedBecause({ ...base, consent: "express" })).toBeNull();
  });
});
