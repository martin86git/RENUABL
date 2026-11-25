import { describe, expect, it } from "vitest";
import { cleanLockPin, isLocked, lockDeviceOf, touchScreen, passkeyName, relyingParty } from "./screen-lock";

describe("screen lock", () => {
  it("tells a phone from a computer", () => {
    expect(lockDeviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe("phone");
    expect(lockDeviceOf("Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile Safari/537.36")).toBe("phone");
    expect(lockDeviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBe("computer");
    expect(lockDeviceOf(null)).toBe("computer");
  });

  it("counts a phone that says Macintosh as a phone by its hints", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    expect(lockDeviceOf(mac)).toBe("computer");
    expect(lockDeviceOf(mac, { cookie: "phone" })).toBe("phone");
    expect(lockDeviceOf(mac, { cookie: "computer" })).toBe("computer");
    expect(lockDeviceOf("Mozilla/5.0 (Windows NT 10.0) Chrome/130", { mobile: "?1" })).toBe("phone");
    expect(lockDeviceOf("Mozilla/5.0 (Windows NT 10.0) Chrome/130", { mobile: "?0" })).toBe("computer");
    expect(touchScreen(5, true, false)).toBe(true);
    expect(touchScreen(0, false, true)).toBe(false);
    expect(touchScreen(10, true, true)).toBe(false);
  });

  it("locks a computer after 30 minutes and a phone after 4 hours", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    const ago = (m: number) => new Date(now.getTime() - m * 60_000);
    expect(isLocked(ago(29), "computer", now)).toBe(false);
    expect(isLocked(ago(30), "computer", now)).toBe(true);
    expect(isLocked(ago(200), "phone", now)).toBe(false);
    expect(isLocked(ago(240), "phone", now)).toBe(true);
    expect(isLocked(null, "computer", now)).toBe(false);
  });

  it("takes only a PIN that isn't easy to guess", () => {
    expect(cleanLockPin("2580")).toEqual({ ok: true, pin: "2580" });
    expect(cleanLockPin("123").ok).toBe(false);
    expect(cleanLockPin("1111").ok).toBe(false);
    expect(cleanLockPin("1234").ok).toBe(false);
    expect(cleanLockPin("9876").ok).toBe(false);
    expect(cleanLockPin("12a4").ok).toBe(false);
  });

  it("names a passkey by its device and works with or without www", () => {
    expect(passkeyName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18 Mobile Safari/604.1")).toBe("iPhone · Safari");
    expect(passkeyName("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537 Edg/130")).toBe("Windows computer · Edge");
    expect(relyingParty("www.renuabl.com.au")).toBe("renuabl.com.au");
    expect(relyingParty("localhost:3000")).toBe("localhost");
  });
});

describe("Face ID is for phones (24 Nov 2026)", () => {
  it("is offered on a phone and never on a computer", async () => {
    const { faceIdOn } = await import("./screen-lock");
    expect(faceIdOn(lockDeviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"))).toBe(true);
    expect(faceIdOn(lockDeviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36"))).toBe(false);
    expect(faceIdOn(lockDeviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15"))).toBe(false);
  });
});
