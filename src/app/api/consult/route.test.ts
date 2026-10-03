import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCallAvailability } from "@/lib/domain/booking";
import { todayInMarket } from "@/lib/domain/market";
import { POST } from "./route";

let ip = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://x/api/consult", { method: "POST", headers: { "x-forwarded-for": `10.1.0.${++ip}` }, body: JSON.stringify(body) }),
  );
const slot = () => {
  const day = buildCallAvailability(todayInMarket(), null)[0];
  return { date: day.date, time: day.times[0] };
};
const who = { firstName: "Sam", lastName: "Lee", mobile: "0412 345 678", email: "sam@example.com" };

beforeEach(() => {
  for (const k of ["HUBSPOT_PRIVATE_APP_TOKEN", "SENDGRID_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "SITE_URL"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/consult", () => {
  it("refuses a time the page didn't offer, missing details or no consent", async () => {
    expect((await post({ ...who, date: "2020-01-01", time: "10:00", consent: { terms: true } })).status).toBe(422);
    expect((await post({ ...who, mobile: "", ...slot(), consent: { terms: true } })).status).toBe(422);
    expect((await post({ ...who, ...slot() })).status).toBe(422);
  });

  it("books it: HubSpot contact and note, staff alert, customer invite", async () => {
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
        return Response.json({ id: "c1" });
      }),
    );
    const res = await post({ ...who, ...slot(), consent: { terms: true } });
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, emailed: true });
    expect(json.call).toContain("(Melbourne time)");
    expect(calls.find((c) => c.url.endsWith("/notes"))!.body).toContain("15-minute call");
    const mails = calls.filter((c) => c.url.includes("sendgrid"));
    expect(mails).toHaveLength(2);
    expect(mails[0].body).toContain("martin@renuabl.com.au");
    expect(mails[1].body).toContain("sam@example.com");
    expect(mails[1].body).toContain("renuabl-call.ics");
  });
});
