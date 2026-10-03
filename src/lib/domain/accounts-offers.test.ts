import { describe, expect, it } from "vitest";
import { normaliseEmail, safeNext, staffEmails } from "./accounts";
import { cleanJobRequest, portalJob, stageFor, type StoredJob } from "./jobs";
import { canTakeOffers, offerExpiry, rankPartners, timeLeft, type OfferPartner } from "./offers";

const today = "2026-09-28";

describe("accounts", () => {
  it("normalises emails and reads the staff list", () => {
    expect(normaliseEmail("  Sam@Example.COM ")).toBe("sam@example.com");
    expect(normaliseEmail("nope")).toBeNull();
    expect([...staffEmails("a@renuabl.com.au, B@renuabl.com.au;bad")]).toEqual(["a@renuabl.com.au", "b@renuabl.com.au"]);
    // Quote marks pasted into Vercel around the value or an address don't stop it matching.
    expect([...staffEmails('"martin@renuabl.com.au"')]).toEqual(["martin@renuabl.com.au"]);
    expect([...staffEmails("'a@renuabl.com.au', <b@renuabl.com.au>")]).toEqual(["a@renuabl.com.au", "b@renuabl.com.au"]);
  });

  it("only sends people to their own area after signing in", () => {
    expect(safeNext("/installer/jobs/job_1", "partner")).toBe("/installer/jobs/job_1");
    expect(safeNext("/admin", "partner")).toBe("/installer");
    expect(safeNext("//evil.example", "customer")).toBe("/my");
    expect(safeNext("https://evil.example/my", "customer")).toBe("/my");
    expect(safeNext(undefined, "staff")).toBe("/admin");
  });
});

const partner = (over: Partial<OfferPartner>): OfferPartner => ({
  id: "p1",
  status: "approved",
  base: { lat: -37.88, lng: 145.06, state: "VIC" }, // Malvern East
  radiusKm: 50,
  priority: 0,
  insuranceExpires: "2027-06-01",
  publicLiability: 20_000_000,
  ...over,
});

describe("offers", () => {
  const home = { lat: -37.88, lng: 145.16, state: "VIC" }; // Glen Waverley, ~9 km away

  it("only offers to approved partners insured for at least $10M", () => {
    expect(canTakeOffers(partner({}), today)).toBe(true);
    expect(canTakeOffers(partner({ status: "pending" }), today)).toBe(false);
    expect(canTakeOffers(partner({ insuranceExpires: "2026-09-01" }), today)).toBe(false);
    expect(canTakeOffers(partner({ publicLiability: 5_000_000 }), today)).toBe(false);
  });

  it("ranks the installer of choice first, then the nearest, within each partner's radius", () => {
    const near = partner({ id: "near", base: { lat: -37.9, lng: 145.15, state: "VIC" } });
    const far = partner({ id: "far", base: { lat: -38.15, lng: 144.36, state: "VIC" }, radiusKm: 30 }); // Geelong
    const chosen = partner({ id: "chosen", priority: 5 });
    expect(rankPartners(home, [far, near, chosen], new Set(), today).map((r) => r.partner.id)).toEqual(["chosen", "near"]);
  });

  it("skips partners already offered the job", () => {
    const a = partner({ id: "a" });
    const b = partner({ id: "b", base: { lat: -37.95, lng: 145.2, state: "VIC" } });
    expect(rankPartners(home, [a, b], new Set(["a"]), today).map((r) => r.partner.id)).toEqual(["b"]);
  });

  it("falls back to the home's state without coordinates", () => {
    const nsw = partner({ id: "nsw", base: { lat: -33.8, lng: 151.2, state: "NSW" } });
    expect(rankPartners({ state: "VIC" }, [partner({}), nsw], new Set(), today).map((r) => r.partner.id)).toEqual(["p1"]);
  });

  it("gives 24 hours and counts down", () => {
    const at = new Date("2026-09-28T00:00:00Z");
    expect(offerExpiry(at).toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(timeLeft("2026-09-29T00:00:00Z", new Date("2026-09-28T00:48:00Z")).label).toBe("23 h 12 min left");
    expect(timeLeft("2026-09-29T00:00:00Z", new Date("2026-09-28T23:20:00Z")).label).toBe("40 min left");
    expect(timeLeft("2026-09-29T00:00:00Z", new Date("2026-09-29T00:00:01Z")).expired).toBe(true);
  });
});

describe("jobs from reservations", () => {
  const raw = {
    address: { line: "2 Hanwell Court", suburb: "Glen Waverley", state: "vic", postcode: "3150", lat: -37.88, lng: 145.16 },
    system: { panelCount: 14, batteryKwh: 16, evCharger: false },
    site: { storeys: "double", roof: "tin", phase: "three" },
    packageName: "Recommended · 6.7 kW solar + 16 kWh battery",
    value: 14_250,
    solarVictoria: true,
    installDate: "2026-10-12",
  };

  it("checks what the browser sends", () => {
    const job = cleanJobRequest(raw)!;
    expect(job.address).toMatchObject({ state: "VIC", postcode: "3150", lat: -37.88 });
    expect(job.site).toEqual({ storeys: "double", roof: "tin", phase: "three" });
    expect(cleanJobRequest({ ...raw, address: { ...raw.address, postcode: "31" } })).toBeNull();
    expect(cleanJobRequest({ ...raw, system: { panelCount: 0, batteryKwh: 0 } })).toBeNull();
    expect(cleanJobRequest({ ...raw, site: { roof: "<script>" } })!.site.roof).toBe("unsure");
  });

  it("holds back the customer's details until the offer is accepted", () => {
    const stored: StoredJob = {
      id: "job_1",
      reference: "RN-1234",
      recordKey: "a".repeat(40),
      customer: { name: "Sarah Chen", phone: "+61401555567", email: "sarah@example.com" },
      ...cleanJobRequest(raw)!,
      status: "offered",
      createdAt: "2026-09-28T01:00:00.000Z",
    };
    const offered = portalJob(stored, { id: "of_1", expiresAt: "2026-09-29T01:00:00.000Z" });
    expect(offered.stage).toBe("new");
    expect(offered.customer).toEqual({ name: "New job in Glen Waverley", phone: "", email: "" });
    expect(offered.address.line).toBe("Street shown once you accept");
    expect(offered.address.lat).toBeUndefined();
    const accepted = portalJob({ ...stored, status: "accepted" });
    expect(accepted.customer.name).toBe("Sarah Chen");
    expect(accepted.site.roof).toBe("Tin (Colorbond)");
    expect(stageFor("unassigned")).toBe("new");
  });
});
