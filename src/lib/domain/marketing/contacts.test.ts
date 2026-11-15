import { describe, expect, it } from "vitest";
import { cleanColumnMap, cleanState, cleanWebsite, guessColumns, mayEmail, notEmailedBecause, readContacts } from "./contacts";

describe("guessColumns", () => {
  it("reads common header names", () => {
    const m = guessColumns(["First Name", "Surname", "E-mail Address", "Company Name", "Mobile", "Website", "State", "Job Title"]);
    expect(m).toMatchObject({ firstName: 0, lastName: 1, email: 2, company: 3, phone: 4, website: 5, state: 6, role: 7, fullName: -1 });
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
