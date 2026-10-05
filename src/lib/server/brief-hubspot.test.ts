import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noted: string[] = [];
const hubspotSaved: Record<string, string> = {};
let stale: unknown[] = [];

vi.mock("./briefs-repo", () => ({
  staleBriefs: async () => stale,
  markUnfinishedNoted: async (key: string) => void noted.push(key),
  setBriefHubspot: async (key: string, id: string) => void (hubspotSaved[key] = id),
}));

const { noteBriefSent, noteUnfinishedBriefs } = await import("./brief-hubspot");

let calls: { url: string; body: string }[] = [];
beforeEach(() => {
  calls = [];
  for (const k of ["SENDGRID_API_KEY", "RESEND_API_KEY", "EMAIL_FROM"]) vi.stubEnv(k, "");
  vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
  vi.stubEnv("SENDGRID_API_KEY", "SG.test");
  vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
  vi.stubEnv("LEAD_ALERT_EMAILS", "martin@renuabl.com.au");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
      if (String(url).endsWith("/contacts/search")) return Response.json({ results: [] });
      return Response.json({ id: "c9" });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("guided brief in HubSpot", () => {
  it("adds the lead and a 'Brief sent' note as soon as the link is made", async () => {
    const ok = await noteBriefSent(
      { key: "k1", first_name: "Alex", mobile: "+61412000111", email: null },
      { link: "https://www.renuabl.com.au/brief/k1", sentBy: "martin@renuabl.com.au" },
    );
    expect(ok).toBe(true);
    const created = calls.find((c) => c.url.endsWith("/contacts"))!;
    expect(created.body).toContain("+61412000111");
    expect(created.body).toContain('"firstname":"Alex"');
    expect(calls.find((c) => c.url.endsWith("/notes"))!.body).toContain("RENUABL brief sent");
    expect(hubspotSaved.k1).toBe("c9");
  });

  it("skips HubSpot without a mobile or email", async () => {
    expect(await noteBriefSent({ key: "k2", first_name: "Alex", mobile: null, email: null }, { link: "x", sentBy: "m" })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("notes a brief left partway, once, with the answers so far, and tells staff", async () => {
    stale = [
      {
        key: "k3",
        first_name: "Sam",
        mobile: "+61412345678",
        email: null,
        hubspot_id: "c1",
        answers: { timeframe: "asap", ownership: "owner_occupier" },
        summary: { home: "8 Example Court, Glen Waverley VIC 3150" },
      },
    ];
    expect(await noteUnfinishedBriefs()).toBe(1);
    const note = calls.find((c) => c.url.endsWith("/notes"))!;
    expect(note.body).toContain("RENUABL brief not finished");
    expect(note.body).toContain("Timeframe: As soon as possible");
    expect(note.body).toContain("8 Example Court");
    // Uses the contact made when the link was sent: no new contact.
    expect(calls.some((c) => c.url.endsWith("/contacts"))).toBe(false);
    const mail = calls.find((c) => c.url.includes("sendgrid"))!;
    expect(mail.body).toContain("Brief not finished: Sam");
    expect(noted).toEqual(["k3"]);
  });
});
