import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resendProblem, sendGridProblems, verifySendGrid, verifySvix } from "./marketing-webhooks";

describe("signatures", () => {
  it("checks SendGrid's ECDSA signature", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const body = '[{"event":"bounce"}]';
    const ts = "1700000000";
    const sig = sign("sha256", Buffer.from(ts + body), privateKey).toString("base64");
    const pub = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    expect(verifySendGrid(body, sig, ts, pub)).toBe(true);
    expect(verifySendGrid(body + " ", sig, ts, pub)).toBe(false);
    expect(verifySendGrid(body, null, ts, pub)).toBe(false);
  });

  it("checks Svix's signature and its age", () => {
    const secret = `whsec_${Buffer.from("a secret of thirty two bytes!!!!").toString("base64")}`;
    const body = '{"type":"email.bounced"}';
    const id = "msg_1";
    const ts = "1700000000";
    const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
      .update(`${id}.${ts}.${body}`)
      .digest("base64");
    const h = { id, timestamp: ts, signature: `v1,${sig}` };
    expect(verifySvix(body, h, secret, 1700000010)).toBe(true);
    expect(verifySvix(body, h, secret, 1700009999)).toBe(false);
    expect(verifySvix(body, { ...h, signature: "v1,AAAA" }, secret, 1700000010)).toBe(false);
  });
});

describe("events", () => {
  it("keeps real bounces and complaints from SendGrid", () => {
    const p = sendGridProblems([
      { event: "bounce", type: "bounce", email: "a@x.com", renuabl_m: "tok", reason: "550" },
      { event: "bounce", type: "blocked", email: "b@x.com" },
      { event: "open", email: "c@x.com" },
      { event: "spamreport", email: "d@x.com" },
    ]);
    expect(p.map((x) => [x.kind, x.email, x.token])).toEqual([
      ["bounce", "a@x.com", "tok"],
      ["complaint", "d@x.com", null],
    ]);
  });

  it("reads Resend's bounce with our tag, and leaves soft ones", () => {
    expect(
      resendProblem({ type: "email.bounced", data: { to: ["a@x.com"], tags: { renuabl_m: "tok" }, bounce: { type: "Permanent" } } }),
    ).toMatchObject({
      kind: "bounce",
      token: "tok",
      email: "a@x.com",
    });
    expect(resendProblem({ type: "email.bounced", data: { to: ["a@x.com"], bounce: { type: "Transient" } } })).toBeNull();
    expect(resendProblem({ type: "email.delivered", data: {} })).toBeNull();
  });
});
