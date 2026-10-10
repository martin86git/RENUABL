import { describe, expect, it } from "vitest";
import {
  ACTIVITY_KIND_WRONG,
  ACTIVITY_TEXT_MISSING,
  CUSTOMER_EMAIL_WRONG,
  CUSTOMER_NAME_MISSING,
  JOB_DATE_WRONG,
  JOB_STAGES,
  JOB_STAGE_WRONG,
  JOB_VALUE_WRONG,
  LEAD_SOURCES,
  SAMPLE_CUSTOMERS,
  STAGE_LABELS,
  cleanActivityInput,
  cleanCustomerInput,
  cleanJobInput,
  customerStage,
  stageMoveText,
  type CustomerInput,
  type JobInput,
} from "./crm";

const value = <T>(cleaned: { ok: true; value: T } | { ok: false; message: string }): T => {
  if (!cleaned.ok) throw new Error(cleaned.message);
  return cleaned.value;
};
const message = (cleaned: { ok: boolean; message?: string }) => (cleaned.ok ? null : cleaned.message);

describe("stages", () => {
  it("are the six, in order, each with its label", () => {
    expect(JOB_STAGES).toEqual(["lead", "designed", "proposal", "won", "installed", "lost"]);
    expect(JOB_STAGES.map((s) => STAGE_LABELS[s])).toEqual(["Lead", "Designed", "Proposal sent", "Won", "Installed", "Lost"]);
    expect(stageMoveText("proposal")).toBe("Moved to Proposal sent");
  });
  it("show a customer at their furthest job that isn't lost", () => {
    expect(customerStage([])).toBeNull();
    expect(customerStage(["lead"])).toBe("lead");
    expect(customerStage(["won", "lead", "proposal"])).toBe("won");
    expect(customerStage(["lost", "designed"])).toBe("designed");
    expect(customerStage(["installed", "lead"])).toBe("installed");
    // Every job lost: the newest job's stage.
    expect(customerStage(["lost", "lost"])).toBe("lost");
  });
});

describe("a customer as sent by a browser", () => {
  const full = {
    name: "  Alex   Example ",
    phone: " 0491 570 006 ",
    email: " Alex@Example.COM ",
    address: "12 Sample Street,\n Glen Waverley VIC 3150",
    lat: -37.878,
    lng: 145.164,
    source: "Referral",
    notes: "First line\r\n\r\n\r\n\r\nSecond\u0007 line",
  };
  it("is trimmed, tidied and kept", () => {
    expect(value(cleanCustomerInput(full))).toEqual({
      name: "Alex Example",
      phone: "0491 570 006",
      email: "alex@example.com",
      address: "12 Sample Street, Glen Waverley VIC 3150",
      lat: -37.878,
      lng: 145.164,
      source: "Referral",
      notes: "First line\n\nSecond  line",
    });
  });
  it("needs only a name", () => {
    expect(value(cleanCustomerInput({ name: "Sam Sample" }))).toEqual({
      name: "Sam Sample",
      phone: "",
      email: "",
      address: "",
      lat: null,
      lng: null,
      source: "",
      notes: "",
    });
    for (const bad of [{}, { name: "" }, { name: " A " }, { name: 42 }, null, "Alex", []])
      expect(message(cleanCustomerInput(bad))).toBe(CUSTOMER_NAME_MISSING);
  });
  it("cuts everything to a length and strips markup and control characters", () => {
    const c = value(
      cleanCustomerInput({
        name: `<script>${"x".repeat(300)}`,
        phone: "0".repeat(100),
        address: "a".repeat(500),
        source: "s".repeat(100),
        notes: "n".repeat(9000),
      }),
    );
    expect(c.name).toHaveLength(120);
    expect(c.name).not.toMatch(/[<>]/);
    expect([c.phone.length, c.address.length, c.source.length, c.notes.length]).toEqual([30, 200, 40, 4000]);
  });
  it("checks the shape of an email, and allows none", () => {
    expect(value(cleanCustomerInput({ name: "Sam Sample", email: "" })).email).toBe("");
    for (const bad of ["sam", "sam@", "sam@example", "sam example@example.com"])
      expect(message(cleanCustomerInput({ name: "Sam Sample", email: bad }))).toBe(CUSTOMER_EMAIL_WRONG);
  });
  it("takes a place on the map only whole, and only in Australia", () => {
    const at = (lat: unknown, lng: unknown) => cleanCustomerInput({ name: "Sam Sample", lat, lng });
    expect(value(at(-42.88, 147.33))).toMatchObject({ lat: -42.88, lng: 147.33 });
    expect(value(at(null, null))).toMatchObject({ lat: null, lng: null });
    expect(value(at(undefined, ""))).toMatchObject({ lat: null, lng: null });
    for (const [lat, lng] of [
      [-37.8, null],
      [null, 145],
      [51.5, -0.12],
      [37.8, 145],
      [-37.8, 175],
      ["-37.8", "145"],
      [NaN, 145],
    ])
      expect(at(lat, lng).ok).toBe(false);
  });
  it("on an edit, leaves alone what wasn't sent", () => {
    const current: CustomerInput = value(cleanCustomerInput(full));
    expect(value(cleanCustomerInput({ phone: "0491 570 156" }, current))).toEqual({ ...current, phone: "0491 570 156" });
    expect(value(cleanCustomerInput({ notes: "" }, current)).notes).toBe("");
    expect(value(cleanCustomerInput({ lat: null, lng: null }, current))).toMatchObject({ lat: null, lng: null, address: current.address });
    // An edit can't empty the name or break the email either.
    expect(message(cleanCustomerInput({ name: "" }, current))).toBe(CUSTOMER_NAME_MISSING);
    expect(message(cleanCustomerInput({ email: "nope" }, current))).toBe(CUSTOMER_EMAIL_WRONG);
  });
  it("never keeps a field it doesn't know", () => {
    expect(value(cleanCustomerInput({ name: "Sam Sample", sample: true, id: "cus_x", businessId: "biz_other" }))).not.toHaveProperty(
      "sample",
    );
  });
});

describe("a job as sent by a browser", () => {
  it("starts as a lead called Solar with no price or date", () => {
    expect(value(cleanJobInput({}))).toEqual({
      title: "Solar",
      address: "",
      lat: null,
      lng: null,
      stage: "lead",
      value: null,
      installDate: null,
    });
    expect(value(cleanJobInput({ title: "  " })).title).toBe("Solar");
    expect(value(cleanJobInput({ title: "t".repeat(200) })).title).toHaveLength(80);
  });
  it("takes only the stages there are", () => {
    for (const stage of JOB_STAGES) expect(value(cleanJobInput({ stage })).stage).toBe(stage);
    for (const bad of ["Won", "quoted", "", null, 3]) expect(message(cleanJobInput({ stage: bad }))).toBe(JOB_STAGE_WRONG);
  });
  it("takes a price from 0 to 10,000,000, to the cent, or none", () => {
    expect(value(cleanJobInput({ value: 0 })).value).toBe(0);
    expect(value(cleanJobInput({ value: 12345.678 })).value).toBe(12345.68);
    expect(value(cleanJobInput({ value: 10_000_000 })).value).toBe(10_000_000);
    expect(value(cleanJobInput({ value: null })).value).toBeNull();
    expect(value(cleanJobInput({ value: "" })).value).toBeNull();
    for (const bad of [-1, 10_000_000.01, "9800", NaN, Infinity, {}]) expect(message(cleanJobInput({ value: bad }))).toBe(JOB_VALUE_WRONG);
  });
  it("takes an installation date only when it is a real day", () => {
    expect(value(cleanJobInput({ installDate: "2026-11-03" })).installDate).toBe("2026-11-03");
    expect(value(cleanJobInput({ installDate: "2028-02-29" })).installDate).toBe("2028-02-29");
    expect(value(cleanJobInput({ installDate: null })).installDate).toBeNull();
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "03/11/2026", "2026-11-3", "1999-12-31", "tomorrow", 20261103])
      expect(message(cleanJobInput({ installDate: bad }))).toBe(JOB_DATE_WRONG);
  });
  it("takes a place on the map only whole, and only in Australia", () => {
    expect(value(cleanJobInput({ lat: -37.8, lng: 145 }))).toMatchObject({ lat: -37.8, lng: 145 });
    expect(cleanJobInput({ lat: -37.8 }).ok).toBe(false);
    expect(cleanJobInput({ lat: 40.7, lng: -74 }).ok).toBe(false);
  });
  it("on an edit, leaves alone what wasn't sent", () => {
    const current: JobInput = {
      title: "Solar and battery",
      address: "4 Example Court, Berwick VIC 3806",
      lat: -38.03,
      lng: 145.35,
      stage: "proposal",
      value: 18400,
      installDate: "2026-11-03",
    };
    expect(value(cleanJobInput({ stage: "won" }, current))).toEqual({ ...current, stage: "won" });
    expect(value(cleanJobInput({ value: null, installDate: "" }, current))).toEqual({ ...current, value: null, installDate: null });
    expect(value(cleanJobInput({}, current))).toEqual(current);
  });
});

describe("a note, call or email as written", () => {
  it("is kept with its line breaks, cut to a length", () => {
    expect(value(cleanActivityInput({ kind: "call", text: "  Rang back.\r\nWants a battery.  ", jobId: "job_abc" }))).toEqual({
      kind: "call",
      text: "Rang back.\nWants a battery.",
      jobId: "job_abc",
    });
    expect(value(cleanActivityInput({ kind: "note", text: "x".repeat(5000) })).text).toHaveLength(2000);
    expect(value(cleanActivityInput({ kind: "email", text: "Sent." })).jobId).toBeNull();
  });
  it("needs something written", () => {
    for (const text of ["", "   ", "\n\n", undefined, 7])
      expect(message(cleanActivityInput({ kind: "note", text }))).toBe(ACTIVITY_TEXT_MISSING);
  });
  it("can't be a stage move: only the server records those", () => {
    for (const kind of ["stage", "sms", "", undefined])
      expect(message(cleanActivityInput({ kind, text: "Moved to Won" }))).toBe(ACTIVITY_KIND_WRONG);
  });
});

describe("the customers a new business starts with", () => {
  it("are five, spread across lead, lead, designed, proposal and won", () => {
    expect(SAMPLE_CUSTOMERS).toHaveLength(5);
    expect(SAMPLE_CUSTOMERS.map((s) => s.job.stage)).toEqual(["lead", "lead", "designed", "proposal", "won"]);
  });
  it("pass the same checks as anything typed in, unchanged", () => {
    for (const s of SAMPLE_CUSTOMERS) {
      const { job, activity, ...customer } = s;
      expect(value(cleanCustomerInput(customer))).toEqual(customer);
      expect(value(cleanJobInput({ title: job.title, address: s.address, stage: job.stage, value: job.value }))).toMatchObject(job);
      expect(value(cleanActivityInput(activity))).toMatchObject(activity);
    }
  });
  it("are plainly nobody real", () => {
    const names = new Set<string>();
    for (const s of SAMPLE_CUSTOMERS) {
      names.add(s.name);
      expect(s.name).toMatch(/Example|Sample|Placeholder|Test|Demo/);
      // A made-up street with no place on the map, an example.com email, a mobile from the range set aside for fiction.
      expect(s.address).toMatch(/^\d+ (Sample|Example|Demo|Specimen|Mock) (Street|Court|Avenue|Road|Lane), [A-Za-z ]+ VIC \d{4}$/);
      expect([s.lat, s.lng]).toEqual([null, null]);
      expect(s.email).toMatch(/@example\.com$/);
      expect(s.phone).toMatch(/^0491 570 (006|110|15[6-9])$/);
      expect(s.notes).toMatch(/^Sample customer\./);
      expect(LEAD_SOURCES).toContain(s.source);
      expect(s.activity.text.length).toBeGreaterThan(10);
    }
    expect(names.size).toBe(5);
  });
  it("make no claims and name no business", () => {
    const text = SAMPLE_CUSTOMERS.flatMap((s) => [s.notes, s.activity.text, s.job.title]).join(" ");
    expect(text).not.toMatch(/guarantee|RENUABL|Primero|\bAI\b|installer/i);
  });
});
