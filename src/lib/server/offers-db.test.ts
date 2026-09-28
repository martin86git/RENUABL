/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise):
 * partner accounts, jobs, 24-hour offers and sign-in tokens end to end.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PartnerApplication } from "@/lib/domain/partner";

const url = process.env.TEST_DATABASE_URL;

vi.mock("./email", () => ({ sendEmail: vi.fn(async () => "sent") }));
vi.mock("./sms", () => ({ sendSms: vi.fn(async () => "sent") }));

const app = (email: string, business: string, base: { lat: number; lng: number; suburb: string }): PartnerApplication =>
  ({
    type: "installer",
    fullName: "Sam Lee",
    email,
    mobile: "+61400000000",
    businessName: business,
    abn: "51824753556",
    businessAddress: "1 Test St",
    base: { line: "1 Test St", suburb: base.suburb, state: "VIC", postcode: "3000", lat: base.lat, lng: base.lng },
    radiusKm: 50,
    accreditationNumber: "S1234567",
    electricalLicence: "A12345",
    insurance: { publicLiability: 20_000_000, expires: "2030-01-01" },
    rates: {},
  }) as unknown as PartnerApplication;

describe.skipIf(!url)("partners, jobs and offers (database)", () => {
  let db: typeof import("./db");
  let partners: typeof import("./partners-repo");
  let jobs: typeof import("./jobs-repo");
  let engine: typeof import("./offers-engine");
  let accounts: typeof import("./accounts");
  let a: { id: string };
  let b: { id: string };
  let jobId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.SITE_URL = "http://localhost:3000";
    process.env.ADMIN_EMAILS = "staff@renuabl.test";
    db = await import("./db");
    await db.query("drop table if exists sessions, login_tokens, offers, jobs, partners cascade");
    await db.resetDbForTests();
    partners = await import("./partners-repo");
    jobs = await import("./jobs-repo");
    engine = await import("./offers-engine");
    accounts = await import("./accounts");
  });
  afterAll(async () => {
    await db.resetDbForTests();
  });

  it("saves applications as pending, and approval makes them offerable", async () => {
    a = await partners.savePartnerApplication(
      app("a@partner.test", "Alpha Solar", { lat: -37.88, lng: 145.06, suburb: "Malvern East" }),
      "PA-A",
    );
    b = await partners.savePartnerApplication(
      app("b@partner.test", "Beta Electric", { lat: -37.9, lng: 145.15, suburb: "Mulgrave" }),
      "PA-B",
    );
    expect((await partners.getPartner(a.id))?.status).toBe("pending");
    expect(await partners.offerablePartners()).toEqual([]);
    await partners.setPartnerStatus(a.id, "approved", 5);
    await partners.setPartnerStatus(b.id, "approved", 0);
    expect((await partners.offerablePartners()).map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("offers a new job to the installer of choice first, and only they see it", async () => {
    const job = await jobs.createJob(
      "RN-5001",
      { name: "Sarah Chen", phone: "+61401555567", email: "sarah@customer.test" },
      {
        address: { line: "2 Hanwell Court", suburb: "Glen Waverley", state: "VIC", postcode: "3150", lat: -37.88, lng: 145.16 },
        system: { panelCount: 14, batteryKwh: 16, evCharger: false },
        site: { storeys: "single", roof: "tin", phase: "single" },
        packageName: "Recommended",
        value: 14250,
        solarVictoria: true,
        installDate: "2026-10-12",
      },
    );
    jobId = job.id;
    expect(await engine.offerNext(job.id)).toBe(a.id);
    const forA = await jobs.jobsForPartner(a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0].offer?.id).toMatch(/^of_/);
    expect(await jobs.jobsForPartner(b.id)).toEqual([]);
    // One open offer per job: a second offer attempt doesn't double up.
    expect(await engine.offerNext(job.id)).toBeNull();
  });

  it("moves to the next partner when declined, and the first can no longer accept", async () => {
    const offerA = (await jobs.jobsForPartner(a.id))[0].offer!.id;
    expect(await jobs.declineOffer(offerA, a.id)).toBe(jobId);
    expect(await engine.offerNext(jobId)).toBe(b.id);
    expect(await jobs.acceptOffer(offerA, a.id)).toBeNull();
    expect(await jobs.jobsForPartner(a.id)).toEqual([]);
  });

  it("expires after 24 hours; with nobody left, the job waits for staff", async () => {
    await db.query(`update offers set expires_at = now() - interval '1 minute' where status = 'offered'`);
    const offerB = (await jobs.jobsForPartner(b.id))[0]?.offer?.id;
    // Not yet processed: the lapsed offer can't be accepted.
    expect(offerB && (await jobs.acceptOffer(offerB, b.id))).toBeNull();
    expect(await engine.processOffers()).toEqual({ expired: 1, offered: 0 });
    expect((await jobs.getJobRow(jobId))?.status).toBe("unassigned");
  });

  it("a newly approved partner picks up waiting jobs and can accept", async () => {
    const c = await partners.savePartnerApplication(
      app("c@partner.test", "Gamma Power", { lat: -37.85, lng: 145.1, suburb: "Kew" }),
      "PA-C",
    );
    await partners.setPartnerStatus(c.id, "approved");
    expect(await engine.processOffers()).toEqual({ expired: 0, offered: 1 });
    const offer = (await jobs.jobsForPartner(c.id))[0].offer!;
    expect(await jobs.acceptOffer(offer.id, c.id)).toBe(jobId);
    const job = await jobs.getJobRow(jobId);
    expect(job).toMatchObject({ status: "accepted", partnerId: c.id });
    expect(await jobs.partnerOwnsRecord(c.id, job!.recordKey)).toBe(true);
    expect(await jobs.partnerOwnsRecord(a.id, job!.recordKey)).toBe(false);
    expect(await jobs.advancePartnerJob(a.id, jobId, "scheduled")).toBe(false);
    expect(await jobs.advancePartnerJob(c.id, jobId, "scheduled")).toBe(true);
    expect(await jobs.advancePartnerJob(c.id, jobId, "accepted")).toBe(false);
  });

  it("sign-in links work once, and only for approved partners", async () => {
    const t = await accounts.createLoginToken("a@partner.test", "partner", "/installer");
    const s = await accounts.redeemLoginToken(t);
    expect(s).toMatchObject({ role: "partner", next: "/installer" });
    expect(await accounts.redeemLoginToken(t)).toBeNull();
    await partners.setPartnerStatus(a.id, "paused");
    expect(await accounts.redeemLoginToken(await accounts.createLoginToken("a@partner.test", "partner", null))).toBeNull();
    expect(await accounts.redeemLoginToken("f".repeat(64))).toBeNull();
    const staff = await accounts.redeemLoginToken(await accounts.createLoginToken("staff@renuabl.test", "staff", null));
    expect(staff?.role).toBe("staff");
  });
});
