import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown, ip = "1.2.3.4") =>
  POST(new Request("http://x/api/follow-up", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));

let ip = 0;
const nextIp = () => `10.0.0.${++ip}`;

beforeEach(() => {
  for (const k of ["HUBSPOT_PRIVATE_APP_TOKEN", "SENDGRID_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "SITE_URL"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/follow-up", () => {
  it("needs a real email", async () => {
    const res = await post({ email: "nope" }, nextIp());
    expect(res.status).toBe(422);
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
    const res = await post({ email: "Sam@Example.com", home: "12 Example St, Kew VIC 3101", source: "facebook / launch" }, nextIp());
    expect(await res.json()).toEqual({ ok: true, emailed: true });
    const note = calls.find((c) => c.url.endsWith("/notes"))!;
    expect(note.body).toContain("Finish later: no bill yet");
    expect(note.body).toContain("12 Example St, Kew VIC 3101");
    expect(note.body).toContain("facebook / launch");
    const mail = calls.find((c) => c.url.includes("sendgrid"))!;
    expect(mail.body).toContain("sam@example.com");
    expect(mail.body).toContain("https://renuabl.com.au/");
  });

  it("says so when it can't be saved anywhere", async () => {
    const res = await post({ email: "sam@example.com" }, nextIp());
    expect(res.status).toBe(502);
  });
});
