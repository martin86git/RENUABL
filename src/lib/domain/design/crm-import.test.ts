import { describe, expect, it } from "vitest";
import {
  cleanImportMap,
  cleanImportRow,
  dayFrom,
  dealTitleFor,
  guessImportColumns,
  importMapProblem,
  importNote,
  importSummary,
  kwFrom,
  looksLikeDeals,
  moneyFrom,
  rowFromCells,
  rowRef,
  stageFrom,
} from "./crm-import";

describe("guessing a sheet's columns", () => {
  it("reads a HubSpot contact export", () => {
    const map = guessImportColumns([
      "Record ID",
      "First Name",
      "Last Name",
      "Email",
      "Phone Number",
      "Street Address",
      "City",
      "State/Region",
      "Postal Code",
      "Lead Status",
    ]);
    expect(map.firstName).toBe(1);
    expect(map.lastName).toBe(2);
    expect(map.email).toBe(3);
    expect(map.phone).toBe(4);
    expect(map.address).toBe(5);
    expect(map.suburb).toBe(6);
    expect(map.state).toBe(7);
    expect(map.title).toBe(-1);
  });

  it("reads a deals export, and knows it is one", () => {
    const map = guessImportColumns([
      "Deal Name",
      "Deal Stage",
      "Amount",
      "Close Date",
      "Deal owner",
      "Contact",
      "Email",
      "Mobile",
      "System size (kW)",
    ]);
    expect(map.title).toBe(0);
    expect(map.stage).toBe(1);
    expect(map.value).toBe(2);
    expect(map.date).toBe(3);
    expect(map.owner).toBe(4);
    expect(map.name).toBe(5);
    expect(map.email).toBe(6);
    expect(map.phone).toBe(7);
    expect(map.kw).toBe(8);
    expect(looksLikeDeals(map)).toBe(true);
  });

  it("a contact sheet isn't one of deals, and a sheet naming nobody can't be brought in", () => {
    const contacts = guessImportColumns(["Name", "Email", "Mobile"]);
    expect(looksLikeDeals(contacts)).toBe(false);
    expect(importMapProblem(contacts)).toBeNull();
    expect(importMapProblem(guessImportColumns(["Colour", "Height"]))).toMatch(/name or email/);
  });

  it("uses a column once, and cleans a map from the browser", () => {
    const map = cleanImportMap({ firstName: 0, lastName: 0, email: 9, phone: 1.5, name: "2" }, 3);
    expect(map.firstName).toBe(0);
    expect(map.lastName).toBe(-1);
    expect(map.email).toBe(-1);
    expect(map.phone).toBe(-1);
    expect(map.name).toBe(-1);
  });
});

describe("reading cells", () => {
  it("reads stages in other CRMs' words", () => {
    expect(stageFrom("Closed Won")).toBe("won");
    expect(stageFrom("Closed lost")).toBe("lost");
    expect(stageFrom("Quote sent")).toBe("proposal");
    expect(stageFrom("Installed")).toBe("installed");
    expect(stageFrom("Site visit booked")).toBe("designed");
    expect(stageFrom("Appointment scheduled")).toBe("lead");
    expect(stageFrom("")).toBe("lead");
  });

  it("reads money, sizes and dates", () => {
    expect(moneyFrom("$12,345.60")).toBe(12345.6);
    expect(moneyFrom("n/a")).toBeNull();
    expect(kwFrom("6.6 kW")).toBe(6.6);
    expect(kwFrom("6600 W")).toBe(6.6);
    expect(kwFrom("6600")).toBe(6.6);
    expect(kwFrom("")).toBeNull();
    expect(dayFrom("2026-11-21 09:30")).toBe("2026-11-21");
    expect(dayFrom("21/11/2026")).toBe("2026-11-21");
    expect(dayFrom("3/4/26")).toBe("2026-04-03");
    expect(dayFrom("11/21/2026")).toBe("2026-11-21");
    expect(dayFrom("31/02/2026")).toBe("");
    expect(dayFrom("soon")).toBe("");
  });
});

describe("a row", () => {
  const header = [
    "Deal Name",
    "Deal Stage",
    "Amount",
    "Close Date",
    "Contact",
    "Email",
    "Mobile",
    "Address",
    "Suburb",
    "State",
    "Postcode",
    "kW",
    "Notes",
  ];
  const map = guessImportColumns(header);
  const cells = [
    "Battery add-on",
    "Closed Won",
    "$18,400",
    "14/10/2026",
    "Jo  Citizen Smith",
    "JO@Example.com",
    "0412 345 678",
    "8 Example Ct",
    "Glen Waverley",
    "VIC",
    "3150",
    "6.6",
    "Wants   a battery",
  ];

  it("is read by the map", () => {
    const row = rowFromCells(cells, map)!;
    expect(row).toMatchObject({
      firstName: "Jo",
      lastName: "Citizen Smith",
      email: "jo@example.com",
      phone: "0412 345 678",
      address: "8 Example Ct, Glen Waverley, VIC 3150",
      title: "Battery add-on",
      stage: "won",
      stageWords: "Closed Won",
      value: 18400,
      kw: 6.6,
      day: "2026-10-14",
      notes: "Wants a battery",
    });
  });

  it("names nobody: no row. A bad email or placeholder phone is dropped, not the person", () => {
    expect(rowFromCells(["", "", "", "", "", "", "", "", "", "", "", "", ""], map)).toBeNull();
    const row = rowFromCells(["", "", "", "", "Sam", "not an email", "0000 000 000", "", "", "", "", "", ""], map)!;
    expect(row.firstName).toBe("Sam");
    expect(row.email).toBe("");
    expect(row.phone).toBe("");
    // An email alone names them by its handle.
    expect(rowFromCells(["", "", "", "", "", "pat@example.com", "", "", "", "", "", "", ""], map)!.firstName).toBe("pat");
  });

  it("is read again on the server as it left the browser", () => {
    const row = rowFromCells(cells, map)!;
    expect(cleanImportRow(JSON.parse(JSON.stringify(row)))).toEqual(row);
    expect(cleanImportRow({ firstName: "" })).toBeNull();
    expect(cleanImportRow("x")).toBeNull();
    const odd = cleanImportRow({ firstName: "A\u0000<b>", stage: "nonsense", value: -4, kw: "6", email: "x", day: "tomorrow" })!;
    expect(odd.stage).toBe("lead");
    expect(odd.value).toBeNull();
    expect(odd.kw).toBeNull();
    expect(odd.email).toBe("");
    expect(odd.day).toBe("");
  });

  it("has the same mark each time, and another for another deal", () => {
    const row = rowFromCells(cells, map)!;
    expect(rowRef(row, "deals")).toBe(rowRef({ ...row }, "deals"));
    expect(rowRef(row, "deals")).toMatch(/^[0-9a-f]{16}$/);
    expect(rowRef(row, "deals")).not.toBe(rowRef({ ...row, title: "Solar" }, "deals"));
    expect(rowRef(row, "deals")).not.toBe(rowRef(row, "contacts"));
    // A contact is the same person whatever else the row says.
    expect(rowRef(row, "contacts")).toBe(rowRef({ ...row, title: "Solar", value: 1 }, "contacts"));
  });

  it("gets a deal name and a note of what the sheet said", () => {
    const row = rowFromCells(cells, map)!;
    expect(dealTitleFor(row)).toBe("Battery add-on");
    expect(dealTitleFor({ ...row, title: "" })).toBe("Solar 6.6 kW");
    expect(dealTitleFor({ ...row, title: "", kw: null })).toBe("Solar");
    const note = importNote(row, "deals.csv");
    expect(note).toContain("Brought in from deals.csv.");
    expect(note).toContain("Stage in the sheet: Closed Won.");
    expect(note).toContain("$18,400");
    expect(note).toContain("Notes: Wants a battery");
    expect(importNote({ ...row, stageWords: "", day: "", value: null, kw: null, source: "", notes: "" }, "")).toBe(
      "Brought in from an export sheet.",
    );
  });
});

describe("what a run came to", () => {
  it("is said in a sentence", () => {
    expect(importSummary({ in: 1, already: 0, failed: 0, mode: "deals" })).toBe("1 deal brought in.");
    expect(importSummary({ in: 12, already: 3, failed: 1, mode: "contacts" })).toBe(
      "12 contacts brought in. 3 already here, left as they were. 1 couldn't be brought in.",
    );
  });
});
