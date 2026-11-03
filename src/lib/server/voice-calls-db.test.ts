/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * assistant's calls on CRM deals, with Vapi's API faked. That a homeowner lead becomes a deal in RENUABL's own CRM and
 * is rung once, with our reference and secret; that book_call takes only an offered time and writes it on the deal;
 * that an unanswered call is tried again and booking on the page stops it; that "Call me" rings the number on the
 * customer's record about their proposal; and that another business's deals aren't called.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { todayInMarket } from "@/lib/domain/market";
import { readVapiEvent, voiceSlots } from "@/lib/domain/voice-agent";

const url = process.env.TEST_DATABASE_URL;
const OWN = "owner@renuabl-own-voice.test";
const OTHER = "owner@other-voice.test";
const MOBILE = "+61491570110"; // the range set aside for fiction

describe.skipIf(!url)("voice calls on deals (database)", () => {
  let db: typeof import("./db");
  let voice: typeof import("./voice-calls");
  let crm: typeof import("./design-crm-repo");
  let own: string;
  let other: string;
  const sent: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
  let n = 0;
  const calls = () => sent.filter((s) => s.method === "POST" && s.url.endsWith("/call"));
  const rowFor = async (businessId: string) =>
    (
      await db.query<import("./voice-calls").VoiceRow>(`select * from voice_calls where business_id = $1 order by created_at desc`, [
        businessId,
      ])
    )[0];

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url,
      VOICE_CALLS_ENABLED: "true",
      VAPI_API_KEY: "test-key",
      VAPI_PHONE_NUMBER_ID: "pn_test",
      VAPI_WEBHOOK_SECRET: "a-test-secret-of-twenty-plus",
      SITE_URL: "https://www.renuabl.test",
      RENUABL_CRM_EMAIL: OWN,
    });
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    voice = await import("./voice-calls");
    await db.query(`delete from businesses where id in (select business_id from business_members where email in ($1, $2))`, [OWN, OTHER]);
    own = (await repo.createBusiness(OWN, "RENUABL", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    other = (await repo.createBusiness(OTHER, "Other Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
      sent.push({ url: String(u), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ id: `call_${++n}` }), { status: 201 });
    });
  });

  afterEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.query(`delete from businesses where id in ($1, $2)`, [own, other]);
    for (const k of ["VOICE_CALLS_ENABLED", "VAPI_API_KEY", "VAPI_PHONE_NUMBER_ID", "VAPI_WEBHOOK_SECRET", "RENUABL_CRM_EMAIL"])
      delete process.env[k];
  });

  it("makes a homeowner lead a deal in RENUABL's CRM and rings it once", async () => {
    await voice.takeHomeLead(
      {
        firstName: "Sam",
        mobile: "0491 570 110",
        source: "Quick quote (/quote)",
        lookingFor: "Solar and a battery",
        details: { "Looking for": "Solar and a battery" },
      },
      true,
    );
    const row = await rowFor(own);
    expect(row).toMatchObject({ mode: "lead", asked: false, mobile: MOBILE, status: "calling", attempts: 1 });
    const jobs = await crm.listJobs(own);
    expect(jobs.find((j) => j.id === row.job_id)).toMatchObject({ stage: "lead", title: "Solar and a battery" });
    expect(calls()).toHaveLength(1);
    const body = calls()[0].body!;
    expect(body.customer).toEqual({ number: MOBILE, name: "Sam" });
    const assistant = body.assistant as { name: string; server: { url: string; headers: Record<string, string> } };
    expect(assistant.name).toBe("Revo");
    expect(assistant.server.url).toBe(`https://www.renuabl.test/api/voice/vapi?ref=${row.id}`);
    expect(assistant.server.headers["x-renuabl-voice"]).toBe("a-test-secret-of-twenty-plus");
    // The same deal is never rung twice at once.
    expect((await voice.queueCall({ businessId: own, jobId: row.job_id, mode: "lead", asked: false })).result).toBe("already");
  });

  it("books only an offered time, and writes it on the deal", async () => {
    const row = await rowFor(own);
    const later: (() => Promise<void>)[] = [];
    expect(await voice.handleToolCall(row, "book_call", { date: todayInMarket(), time: "03:00" }, (f) => later.push(f))).toContain(
      "isn't free",
    );
    const slot = voiceSlots(todayInMarket())[0];
    expect(await voice.handleToolCall(row, "book_call", { date: slot.date, time: slot.time }, (f) => later.push(f))).toBe(
      `Booked for ${slot.label}.`,
    );
    const booked = await voice.voiceCallByRef(row.id);
    expect(booked).toMatchObject({ status: "booked", outcome: "booked", call_label: slot.label });
    await voice.handleCallEnded(
      booked!,
      readVapiEvent({ message: { type: "end-of-call-report", endedReason: "customer-ended-call", call: { id: booked!.vapi_call_id } } }),
    );
    expect(calls()).toHaveLength(0);
    const record = await db.query<{ text: string; by_email: string }>(
      `select text, by_email from design_activity where business_id = $1 and job_id = $2 and kind = 'call' order by at`,
      [own, row.job_id],
    );
    expect(record.map((r) => r.text).join("\n")).toContain(slot.label);
    expect(record.every((r) => r.by_email === "Revo")).toBe(true);
    expect((await voice.listVoiceCalls()).find((c) => c.id === row.id)!.events.map((e) => e.kind)).toEqual(["booked", "ended"]);
  });

  it("tries again after no answer, then stops when they book on the page", async () => {
    const lead = await crm.createCustomer(
      own,
      {
        name: "Jo Example",
        firstName: "Jo",
        lastName: "Example",
        phone: MOBILE,
        email: "",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Battery", address: "", lat: null, lng: null, stage: "lead", value: null, installDate: null, details: {} },
      "test",
    );
    if (lead === "full" || !lead.job) throw new Error("no deal");
    expect((await voice.queueCall({ businessId: own, jobId: lead.job.id, mode: "lead", asked: false })).result).toBe("placed");
    const row = await rowFor(own);
    sent.length = 0;
    await voice.handleCallEnded(
      row,
      readVapiEvent({ message: { type: "end-of-call-report", endedReason: "customer-did-not-answer", call: { id: row.vapi_call_id } } }),
    );
    expect(calls()[0].body!.schedulePlan).toBeTruthy();
    expect((await voice.voiceCallByRef(row.id))!.attempts).toBe(2);
    sent.length = 0;
    await voice.stopVoiceCalls(MOBILE, "booked on /book-a-call");
    expect((await voice.voiceCallByRef(row.id))!.status).toBe("stopped");
    expect(sent.some((s) => s.method === "DELETE")).toBe(true);
  });

  it("rings a customer who asked, about their proposal, on the number on their record", async () => {
    const asked = await crm.createCustomer(
      own,
      {
        name: "Ali Example",
        firstName: "Ali",
        lastName: "Example",
        phone: "0491 570 156",
        email: "",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Solar", address: "", lat: null, lng: null, stage: "proposal", value: null, installDate: null, details: {} },
      "test",
    );
    if (asked === "full" || !asked.job) throw new Error("no deal");
    const r = await voice.queueCall({ businessId: own, jobId: asked.job.id, mode: "proposal", asked: true });
    expect(r.result).toBe("placed");
    const row = await rowFor(own);
    expect(row).toMatchObject({ asked: true, mobile: "+61491570156" });
    // With no proposal out, it falls back to a lead call: nothing to read out.
    expect(String((calls()[0].body!.assistant as { firstMessage: string }).firstMessage)).toContain("Ali");
    const record = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and kind = 'call'`,
      [own, asked.job.id],
    );
    expect(record.map((x) => x.text).join(" ")).toContain("asked for a call about their proposal");
  });

  it("never calls another business's deals, or a customer with no mobile", async () => {
    const theirs = await crm.createCustomer(
      other,
      {
        name: "Kim Example",
        firstName: "Kim",
        lastName: "Example",
        phone: "0491 570 157",
        email: "",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Solar", address: "", lat: null, lng: null, stage: "lead", value: null, installDate: null, details: {} },
      "test",
    );
    if (theirs === "full" || !theirs.job) throw new Error("no deal");
    expect((await voice.queueCall({ businessId: other, jobId: theirs.job.id, mode: "lead", asked: false })).result).toBe("off");
    expect(await voice.callMeFor(other)).toBeNull();
    expect(await voice.callMeFor(own)).toEqual({ assistant: "Revo" });
    const none = await crm.createCustomer(
      own,
      {
        name: "No Phone",
        firstName: "No",
        lastName: "Phone",
        phone: "",
        email: "no@example.com",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Solar", address: "", lat: null, lng: null, stage: "lead", value: null, installDate: null, details: {} },
      "test",
    );
    if (none === "full" || !none.job) throw new Error("no deal");
    expect((await voice.queueCall({ businessId: own, jobId: none.job.id, mode: "lead", asked: false })).result).toBe("no-number");
    expect(calls()).toHaveLength(0);
  });
});
