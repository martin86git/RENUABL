import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

let ip = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://x/api/quote-lead", {
      method: "POST",
      headers: { "x-forwarded-for": `10.9.0.${++ip}` },
      body: JSON.stringify(body),
    }),
  );

const good = {
  firstName: "Sam",
  mobile: "0412 345 678",
  email: "sam@example.com",
  answers: { interest: "solar-battery", period: "quarterly", band: "high", owner: true },
  home: "8 Example Court, Glen Waverley VIC 3150",
  suburb: "Glen Waverley",
  consent: { terms: true },
};

beforeEach(() => {
  for (const k of [
    "HUBSPOT_PRIVATE_APP_TOKEN",
    "HUBSPOT_TOKEN",
    "SENDGRID_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SITE_URL",
    "TWILIO_ACCOUNT_SID",
    "LEAD_ALERT_MOBILES",
  ])
    vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/quote-lead", () => {
  it("needs a first name, an Australian mobile and the consent tick", async () => {
    expect((await post({ ...good, firstName: "" })).status).toBe(422);
    expect((await post({ ...good, mobile: "123" })).status).toBe(422);
    expect((await post({ ...good, consent: {} })).status).toBe(422);
  });

  it("saves the lead to HubSpot with the answers, emails staff and the customer", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubEnv("SITE_URL", "https://www.renuabl.com.au");
    vi.stubEnv("LEAD_ALERT_EMAILS", "martin@renuabl.com.au");
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
        if (init?.method === "GET") return new Response("{}", { status: 404 });
        return Response.json({ id: "c7" });
      }),
    );
    const res = await post({ ...good, answers: { ...good.answers, savings: 999999 } });
    expect(await res.json()).toEqual({ ok: true, emailed: true });
    const note = calls.find((c) => c.url.endsWith("/notes"))!.body;
    expect(note).toContain("Quick quote: call now");
    expect(note).toContain("Solar and a battery");
    expect(note).toContain("INDICATIVE");
    expect(note).not.toContain("999999");
    const mails = calls.filter((c) => c.url.includes("sendgrid")).map((c) => c.body);
    expect(mails.some((m) => m.includes("sam@example.com") && m.includes("Your solar and battery estimate"))).toBe(true);
    expect(mails.some((m) => m.includes("martin@renuabl.com.au") && m.includes("HubSpot: saved"))).toBe(true);
  });

  it("still tells staff when HubSpot isn't connected", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202 })),
    );
    expect((await (await post({ ...good, email: "" })).json()).ok).toBe(true);
  });
});
