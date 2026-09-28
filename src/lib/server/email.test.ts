import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailProvider, parseFrom, sendEmail } from "./email";

const email = { to: "sarah@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };

beforeEach(() => {
  for (const k of ["SENDGRID_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendEmail", () => {
  it("reads the sender's name and address", () => {
    expect(parseFrom("RENUABL <hello@renuabl.com.au>")).toEqual({ email: "hello@renuabl.com.au", name: "RENUABL" });
    expect(parseFrom("hello@renuabl.com.au")).toEqual({ email: "hello@renuabl.com.au" });
  });

  it("sends through SendGrid when its key is set, ahead of Resend", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "RENUABL <hello@renuabl.com.au>");
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(null, { status: 202 })); // eslint-disable-line @typescript-eslint/no-unused-vars
    vi.stubGlobal("fetch", fetchMock);
    expect(emailProvider()).toBe("sendgrid");
    expect(await sendEmail(email)).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer SG.test");
    const body = JSON.parse(String(init.body));
    expect(body.from).toEqual({ email: "hello@renuabl.com.au", name: "RENUABL" });
    expect(body.personalizations[0].to[0].email).toBe("sarah@example.com");
    expect(body.content.map((c: { type: string }) => c.type)).toEqual(["text/plain", "text/html"]);
  });

  it("reports SendGrid refusing", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    vi.stubEnv("EMAIL_FROM", "hello@renuabl.com.au");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response('{"errors":[{"message":"The from address does not match a verified Sender Identity."}]}', { status: 403 }),
      ),
    );
    await expect(sendEmail(email)).rejects.toThrow(/SendGrid 403/);
  });

  it("skips without a sender or a service", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test");
    expect(emailProvider()).toBeNull();
    expect(await sendEmail(email)).toBe("skipped");
  });
});
