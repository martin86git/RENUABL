import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCallAvailability } from "@/lib/domain/booking";
import { todayInMarket } from "@/lib/domain/market";

const KEY = "a".repeat(40);
const saved: { booked?: string; slot?: string; answers?: unknown } = {};

vi.mock("@/lib/server/db", () => ({ dbConfigured: () => true }));
vi.mock("@/lib/server/briefs-repo", async (orig) => {
  const real = await orig<typeof import("@/lib/server/briefs-repo")>();
  return {
    ...real,
    getBrief: async (key: string) =>
      key === KEY ? { key, first_name: "Sam", mobile: "+61412345678", email: null, status: "started", answers: {} } : null,
    saveBriefProgress: async (_k: string, answers: unknown) => {
      saved.answers = answers;
      return true;
    },
    markBriefBooked: async (_k: string, label: string, slot: string) => {
      saved.booked = label;
      saved.slot = slot;
    },
  };
});

const { POST } = await import("./route");

let ip = 0;
const post = (key: string, body: unknown) =>
  POST(
    new Request(`http://x/api/brief/${key}/book`, {
      method: "POST",
      headers: { "x-forwarded-for": `10.2.0.${++ip}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) } as never,
  );
const slot = () => {
  const d = buildCallAvailability(todayInMarket(), null)[0];
  return { date: d.date, time: d.times[0] };
};

beforeEach(() => {
  for (const k of ["HUBSPOT_PRIVATE_APP_TOKEN", "SENDGRID_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "SITE_URL"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/brief/[key]/book", () => {
  it("is 404 for a bad or unknown key", async () => {
    expect((await post("nope", {})).status).toBe(404);
    expect((await post("b".repeat(40), { ...slot(), consent: { terms: true } })).status).toBe(404);
  });

  it("refuses a time that wasn't offered, or no consent", async () => {
    expect((await post(KEY, { date: "2020-01-01", time: "10:00", consent: { terms: true } })).status).toBe(422);
    expect((await post(KEY, { ...slot() })).status).toBe(422);
  });

  it("books it: saves the answers, notes HubSpot with the staff-only score, emails staff", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubEnv("LEAD_ALERT_EMAILS", "martin@renuabl.com.au");
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
        if (String(url).endsWith("/contacts/search")) return Response.json({ results: [] });
        return Response.json({ id: "c1" });
      }),
    );
    const res = await post(KEY, {
      ...slot(),
      phone: "",
      answers: { timeframe: "asap", ownership: "owner_occupier", bogus: "x" },
      summary: { home: "1 Test St, Glen Waverley VIC 3150", price: "$9,000 after $3,000 in rebates", billRead: true },
      consent: { terms: true },
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(saved.booked).toContain("(Melbourne time)");
    expect(saved.answers).toEqual({ timeframe: "asap", ownership: "owner_occupier" });
    const note = calls.find((c) => c.url.endsWith("/notes"))!;
    expect(note.body).toContain("RENUABL brief");
    expect(note.body).toContain("Score (staff only)");
    expect(note.body).toContain("Hot");
    expect(note.body).toContain("+61412345678");
    const mail = calls.find((c) => c.url.includes("sendgrid"))!;
    expect(mail.body).toContain("martin@renuabl.com.au");
    // Martin's email carries the call as a calendar invite, with who to ring.
    expect(mail.body).toContain("renuabl-call.ics");
    const ics = Buffer.from(JSON.parse(mail.body).attachments[0].content, "base64").toString();
    expect(ics).toContain("RENUABL call: Sam +61412345678");
    expect(json.date).toBe(slot().date);
    expect(saved.slot).toBe(`${slot().date}T${slot().time}`);
  });
});
