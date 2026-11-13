import { describe, expect, it } from "vitest";
import { demoRefuses } from "./demo";
import { REACH_MAX, TEXT_MAX, TEXT_WORDS, cleanText, dealFor, reachContacts, textParts, textRecord } from "./contact-reach";

const customer = (id: string, name: string, phone: string, extra: Partial<{ email: string; address: string }> = {}) => ({
  id,
  name,
  firstName: name.split(" ")[0],
  phone,
  email: extra.email ?? "",
  address: extra.address ?? "",
});
const job = (id: string, customerId: string, stage: string, updatedAt: string) => ({ id, customerId, title: "Solar", stage, updatedAt });

const PEOPLE = [
  customer("c1", "Tom Example", "0491 570 156", { address: "8 Sample Street, Glen Waverley" }),
  customer("c2", "Michelle Sample", "+61 491 570 157", { email: "michelle@example.com" }),
  customer("c3", "No Number", ""),
  customer("c4", "Land Line", "03 9000 0000"),
];
const JOBS = [
  job("job_a", "c1", "lost", "2026-11-10T00:00:00Z"),
  job("job_b", "c1", "proposal", "2026-11-01T00:00:00Z"),
  job("job_c", "c2", "lost", "2026-10-01T00:00:00Z"),
];

describe("the deal a call or text is kept on", () => {
  it("is the newest deal not lost", () => expect(dealFor("c1", JOBS)?.id).toBe("job_b"));
  it("is a lost deal when that is all there is", () => expect(dealFor("c2", JOBS)?.id).toBe("job_c"));
  it("is none for someone with no deal", () => expect(dealFor("c3", JOBS)).toBeNull());
});

describe("finding a contact", () => {
  it("finds by name, with their deal and whether they can be texted", () => {
    expect(reachContacts(PEOPLE, JOBS, "tom")).toEqual([
      {
        id: "c1",
        name: "Tom Example",
        firstName: "Tom",
        phone: "0491 570 156",
        mobile: true,
        job: { id: "job_b", title: "Solar", stage: "proposal" },
      },
    ]);
  });
  it("finds by the digits of a number, however it is written", () => {
    expect(reachContacts(PEOPLE, JOBS, "0491570157").map((c) => c.id)).toEqual(["c2"]);
  });
  it("finds by email and address", () => {
    expect(reachContacts(PEOPLE, JOBS, "michelle@").map((c) => c.id)).toEqual(["c2"]);
    expect(reachContacts(PEOPLE, JOBS, "glen waverley").map((c) => c.id)).toEqual(["c1"]);
  });
  it("shows those with a number when nothing is typed", () => {
    expect(reachContacts(PEOPLE, JOBS, "  ").map((c) => c.id)).toEqual(["c1", "c2", "c4"]);
  });
  it("knows a landline can't be texted", () => {
    expect(reachContacts(PEOPLE, JOBS, "land")[0]).toMatchObject({ mobile: false, job: null });
  });
  it("puts those with a number first and stops at the limit", () => {
    const many = [
      customer("x0", "Sam Nobody", ""),
      ...Array.from({ length: 12 }, (_, i) => customer(`x${i + 1}`, `Sam ${i}`, "0491 570 110")),
    ];
    const found = reachContacts(many, [], "sam");
    expect(found).toHaveLength(REACH_MAX);
    expect(found.every((c) => c.phone)).toBe(true);
  });
});

describe("a text", () => {
  it("is trimmed and kept plain", () => {
    expect(cleanText("  Hi Tom,\r\n\r\n\r\n\r\nsee you at 9\u0007  ")).toEqual({ ok: true, text: "Hi Tom,\n\nsee you at 9" });
  });
  it("is refused when empty, too long or not words", () => {
    expect(cleanText("   ")).toEqual({ ok: false, message: TEXT_WORDS.empty });
    expect(cleanText(42)).toEqual({ ok: false, message: TEXT_WORDS.empty });
    expect(cleanText("a".repeat(TEXT_MAX + 1))).toEqual({ ok: false, message: TEXT_WORDS.long });
    expect(cleanText("a".repeat(TEXT_MAX)).ok).toBe(true);
  });
  it("counts the messages it goes as", () => {
    expect(textParts("")).toBe(0);
    expect(textParts("a".repeat(160))).toBe(1);
    expect(textParts("a".repeat(161))).toBe(2);
    expect(textParts("a".repeat(307))).toBe(3);
    expect(textParts("☀".repeat(71))).toBe(2);
  });
  it("is written on the deal with who it went to", () => {
    expect(textRecord("+61491570156", "See you at 9")).toBe("Text sent to +61491570156: See you at 9");
  });
  it("never goes out from a demo", () => {
    expect(demoRefuses("POST", "/api/design/jobs/job_abc12345/text")).toBe(true);
  });
});
