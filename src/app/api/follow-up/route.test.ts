import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown, ip = "1.2.3.4") =>
  POST(new Request("http://x/api/follow-up", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));

let ip = 0;
const nextIp = () => `10.0.0.${++ip}`;

beforeEach(() => {
  for (const k of [
    "HUBSPOT_PRIVATE_APP_TOKEN",
    "SENDGRID_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SITE_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM",
    "LEAD_ALERT_MOBILES",
  ])
    vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/follow-up", () => {
  it("needs a real email", async () => {
    const res = await post({ email: "nope", consent: { terms: true } }, nextIp());
    expect(res.status).toBe(422);
  });

  it("needs an email or a mobile", async () => {
    const res = await post({ consent: { terms: true } }, nextIp());
    expect(res.status).toBe(422);
    const bad = await post({ mobile: "123", consent: { terms: true } }, nextIp());
    expect(bad.status).toBe(422);
  });

  it("takes a mobile on its own: HubSpot contact by mobile, staff emailed, no customer email", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubEnv("SITE_URL", "https://renuabl.com.au");
    vi.stubEnv("LEAD_ALERT_EMAILS", "martin@renuabl.com.au");
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
        if (String(url).endsWith("/contacts/search")) return Response.json({ results: [] });
        return Response.json({ id: "c2" });
      }),
    );
    const res = await post({ mobile: "0412 345 678", consent: { terms: true } }, nextIp());
    expect(await res.json()).toEqual({ ok: true, emailed: false, texted: false });
    const created = calls.find((c) => c.url.endsWith("/contacts"))!;
    expect(created.body).toContain("+61412345678");
    expect(calls.find((c) => c.url.endsWith("/notes"))!.body).toContain("Finish later: no bill yet");
    const mails = calls.filter((c) => c.url.includes("sendgrid"));
    expect(mails).toHaveLength(1);
    expect(mails[0].body).toContain("martin@renuabl.com.au");
    expect(mails[0].body).toContain("+61412345678");
  });

  it("needs the Terms and Privacy box ticked", async () => {
    const res = await post({ email: "sam@example.com" }, nextIp());
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, consent: true });
  });

  it("adds a HubSpot contact with a note, and emails a link back", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubEnv("SITE_URL", "https://renuabl.com.au");
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
        if (init?.method === "GET") return new Response("{}", { status: 404 });
        return Response.json({ id: "c1" });
      }),
    );
    const res = await post(
      {
        email: "Sam@Example.com",
        home: "12 Example St, Kew VIC 3101",
        source: "facebook / launch",
        consent: { terms: true, marketing: true },
      },
      nextIp(),
    );
    expect(await res.json()).toEqual({ ok: true, emailed: true, texted: false });
    const note = calls.find((c) => c.url.endsWith("/notes"))!;
    expect(note.body).toContain("Finish later: no bill yet");
    expect(note.body).toContain("12 Example St, Kew VIC 3101");
    expect(note.body).toContain("facebook / launch");
    expect(note.body).toContain("Terms of Use and Privacy Policy");
    expect(note.body).toContain("Marketing tips and offers: yes");
    const mail = calls.find((c) => c.url.includes("sendgrid"))!;
    expect(mail.body).toContain("sam@example.com");
    expect(mail.body).toContain("https://renuabl.com.au/");
  });

  it("says so when it can't be saved anywhere", async () => {
    const res = await post({ email: "sam@example.com", consent: { terms: true } }, nextIp());
    expect(res.status).toBe(502);
  });

  it("started: a mobile before the bill is texted straight away, and staff are texted and emailed to call now", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    vi.stubEnv("SITE_URL", "https://www.renuabl.com.au");
    vi.stubEnv("LEAD_ALERT_EMAILS", "martin@renuabl.com.au");
    vi.stubEnv("LEAD_ALERT_MOBILES", "0400 111 222");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "t");
    vi.stubEnv("TWILIO_FROM", "RENUABL");
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        if (String(url).includes("sendgrid")) return new Response(null, { status: 202 });
        if (String(url).includes("twilio")) return Response.json({ sid: "SM1" }, { status: 201 });
        if (String(url).endsWith("/contacts/search")) return Response.json({ results: [] });
        return Response.json({ id: "c3" });
      }),
    );
    const res = await post(
      {
        mobile: "0412 345 678",
        stage: "started",
        suburb: "Glen Waverley",
        entry: "Got solar? Add a battery",
        home: "8 Example Court, Glen Waverley VIC 3150",
        consent: { terms: true },
      },
      nextIp(),
    );
    expect(await res.json()).toEqual({ ok: true, emailed: false, texted: true });
    expect(calls.find((c) => c.url.endsWith("/notes"))!.body).toContain("Started their plan: call now");
    expect(calls.find((c) => c.url.endsWith("/notes"))!.body).toContain("Got solar? Add a battery");
    const texts = calls.filter((c) => c.url.includes("twilio")).map((c) => new URLSearchParams(c.body));
    expect(texts.map((t) => t.get("To"))).toEqual(["+61412345678", "+61400111222"]);
    expect(texts[0].get("Body")).toContain("https://www.renuabl.com.au/book-a-call");
    expect(texts[0].get("Body")).toContain("Reply STOP");
    // Staff text: suburb only, never the street address.
    expect(texts[1].get("Body")).toContain("Glen Waverley");
    expect(texts[1].get("Body")).not.toContain("Example Court");
    const mail = calls.find((c) => c.url.includes("sendgrid"))!;
    expect(mail.body).toContain("started their plan");
  });

  it("started needs a mobile (an email alone isn't enough)", async () => {
    const res = await post({ email: "sam@example.com", stage: "started", consent: { terms: true } }, nextIp());
    expect(res.status).toBe(422);
  });
});
