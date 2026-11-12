import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { accessToken, browserCallSettings, browserCallStatus, identityFor, signedByTwilio, twilioSignature } from "./twilio-voice";

const ENV = {
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_AUTH_TOKEN: "auth-token",
  TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
  TWILIO_API_KEY_SECRET: "key-secret",
  TWILIO_TWIML_APP_SID: "AP00000000000000000000000000000000",
  TWILIO_CALLER_ID: "+61 485 045 505",
  SITE_URL: "https://www.renuabl.com.au",
};

describe("browser call settings", () => {
  it("needs every part, and a caller ID in full", () => {
    const s = browserCallSettings(ENV);
    expect(s?.callerId).toBe("+61485045505");
    expect(s?.record).toBe(true);
    expect(s?.intelligence).toBeNull();
    expect(browserCallSettings({ ...ENV, TWILIO_TWIML_APP_SID: "" })).toBeNull();
    expect(browserCallSettings({ ...ENV, TWILIO_CALLER_ID: "0485045505" })).toBeNull();
    expect(browserCallSettings({ ...ENV, BROWSER_CALL_RECORD: "false" })?.record).toBe(false);
  });

  it("reports yes or no only", () => {
    const status = browserCallStatus(ENV);
    expect(status.ready).toBe(true);
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(browserCallStatus({}).ready).toBe(false);
  });
});

describe("the browser's Twilio token", () => {
  const s = browserCallSettings(ENV)!;
  const identity = identityFor("biz_1", "Sam@Example.com");

  it("names the member by a hash, the same every time", () => {
    expect(identity).toMatch(/^m_[0-9a-f]{32}$/);
    expect(identityFor("biz_1", "sam@example.com")).toBe(identity);
    expect(identityFor("biz_2", "sam@example.com")).not.toBe(identity);
  });

  it("may only make calls through our app, for an hour, signed with the key's secret", () => {
    const token = accessToken(s, identity, Date.UTC(2026, 10, 12));
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header).toEqual({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" });
    expect(payload.iss).toBe(s.keySid);
    expect(payload.sub).toBe(s.accountSid);
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload.grants).toEqual({
      identity,
      voice: { incoming: { allow: false }, outgoing: { application_sid: s.appSid } },
    });
    expect(sig).toBe(createHmac("sha256", "key-secret").update(`${h}.${p}`).digest("base64url"));
  });
});

describe("Twilio's signature", () => {
  const url = "https://www.renuabl.com.au/api/voice/twilio/done?call=bc_1";
  const params = { DialCallStatus: "completed", CallSid: "CA1", DialCallDuration: "42" };

  it("signs the address and the fields in name order", () => {
    const expected = createHmac("sha1", "auth-token").update(`${url}CallSidCA1DialCallDuration42DialCallStatuscompleted`).digest("base64");
    expect(twilioSignature("auth-token", url, params)).toBe(expected);
  });

  it("accepts Twilio's and nothing else", () => {
    const good = twilioSignature("auth-token", url, params);
    expect(signedByTwilio("auth-token", url, params, good)).toBe(true);
    expect(signedByTwilio("auth-token", url, { ...params, DialCallDuration: "4200" }, good)).toBe(false);
    expect(signedByTwilio("auth-token", `${url}&x=1`, params, good)).toBe(false);
    expect(signedByTwilio("other-token", url, params, good)).toBe(false);
    expect(signedByTwilio("auth-token", url, params, null)).toBe(false);
  });
});
