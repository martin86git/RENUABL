import { describe, expect, it } from "vitest";
import { HOME_FOR, safeNext, signInDelivery } from "../accounts";
import { designSignInEmail } from "../emails";
import {
  BUSINESS_TERMS,
  BUSINESS_TERMS_DRAFT_NOTE,
  BUSINESS_TERMS_VERSION,
  MAX_IMPORT_ROOFS,
  can,
  cleanBusinessName,
  cleanImportRoofs,
  cleanRoofPlace,
  cleanRoofWork,
  cleanSupplierList,
  cleanWorkspaceSettings,
  readTermsTick,
  roofKey,
} from "./account";
import { DEFAULT_WORKSPACE } from "./pricing";
import { cleanDesignSet } from "./roof-design";

const ROOF = { address: "8 Example Court, Glen Waverley VIC 3150", lat: -37.87812, lng: 145.16432 };

describe("what a member may do", () => {
  it("lets every member design and set prices, and only the owner manage people", () => {
    expect(can("owner", "design") && can("owner", "prices") && can("owner", "members")).toBe(true);
    expect(can("member", "design") && can("member", "prices")).toBe(true);
    expect(can("member", "members")).toBe(false);
  });
  it("allows nothing for a role it doesn't know", () => {
    expect(can("admin" as never, "design")).toBe(false);
  });
});

describe("a business's name", () => {
  it("is trimmed to one tidy line", () => {
    expect(cleanBusinessName("  Alpha   Solar\n Pty Ltd ")).toBe("Alpha Solar Pty Ltd");
    expect(cleanBusinessName("<b>Bright</b> Electrical")).toBe("b Bright /b Electrical");
  });
  it("is refused when it isn't a name", () => {
    for (const bad of ["", " ", "A", "x".repeat(81), 42, null, undefined]) expect(cleanBusinessName(bad)).toBeNull();
  });
});

describe("the terms", () => {
  it("counts only an explicit tick", () => {
    expect(readTermsTick(true)).toBe(true);
    for (const no of [false, "true", 1, null, undefined, {}]) expect(readTermsTick(no)).toBe(false);
  });
  it("are marked as a draft until reviewed, in the version and on the page", () => {
    expect(BUSINESS_TERMS_VERSION).toMatch(/draft/);
    expect(BUSINESS_TERMS_DRAFT_NOTE).toMatch(/not been reviewed by a lawyer/);
    expect(BUSINESS_TERMS.length).toBeGreaterThan(2);
  });
  it("make no promises the product can't keep", () => {
    const text = BUSINESS_TERMS.flatMap((s) => [s.heading, ...s.paragraphs]).join(" ");
    expect(text).not.toMatch(/guarantee|exact|precise|always available|\bAI\b/i);
  });
});

describe("a roof as sent by a browser", () => {
  it("needs a real place on the map", () => {
    expect(cleanRoofPlace(ROOF)).toEqual(ROOF);
    expect(cleanRoofPlace({ lat: -37.8, lng: 145.1 })).toEqual({ address: "", lat: -37.8, lng: 145.1 });
    expect(cleanRoofPlace({ ...ROOF, address: "x".repeat(500) })?.address).toHaveLength(200);
    for (const bad of [{ lat: "1", lng: 2 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, null, "roof"])
      expect(cleanRoofPlace(bad)).toBeNull();
  });
  it("tells roofs apart to about a metre, the way the device always has", () => {
    expect(roofKey(ROOF)).toBe("-37.87812,145.16432");
    expect(roofKey({ lat: -37.878121, lng: 145.164319 })).toBe(roofKey(ROOF));
  });
  it("keeps the designs at the roof's own place, whatever was sent", () => {
    const work = cleanRoofWork(ROOF, { lat: 10, lng: 20, faces: [], others: [{ lat: 1, lng: 2, faces: [] }] }, null);
    expect(work?.design).toMatchObject({ lat: ROOF.lat, lng: ROOF.lng });
    const set = cleanDesignSet(work?.design);
    expect(set?.designs).toHaveLength(2);
    for (const design of set?.designs ?? []) expect(design).toMatchObject({ lat: ROOF.lat, lng: ROOF.lng });
    // One quote for each design, with the address's own postcode.
    expect(work?.extras.quotes).toHaveLength(2);
    expect(work?.extras.quotes[0].form.postcode).toBe("3150");
  });
  it("drops what it doesn't know and refuses what it can't read", () => {
    const work = cleanRoofWork(ROOF, { faces: [], businessId: "biz_other", __proto__: { x: 1 } }, { bill: { rate: "<script>" } });
    expect(work?.design).not.toHaveProperty("businessId");
    expect(work?.extras.bill.rate).toMatch(/^\d/);
    expect(cleanRoofWork(ROOF, null, null)).toBeNull();
    expect(cleanRoofWork(ROOF, "design", null)).toBeNull();
  });
});

describe("settings and price lists as sent by a browser", () => {
  it("keeps settings without the lists, every figure within its bounds", () => {
    const sent = { ...DEFAULT_WORKSPACE, lists: [{ name: "smuggled.csv", items: [{ sku: "A", cost: 1 }] }], install: { perWatt: -5 } };
    const clean = cleanWorkspaceSettings(sent);
    expect(clean).not.toHaveProperty("lists");
    expect(clean.install).toEqual(DEFAULT_WORKSPACE.install);
    expect(cleanWorkspaceSettings(null).settings).toEqual(DEFAULT_WORKSPACE.settings);
  });
  it("keeps a price list's priced rows and refuses one with none", () => {
    const list = cleanSupplierList({
      name: "prices.xlsx",
      uploadedAt: "2026-10-10",
      items: [
        { sku: "PANEL-1", name: "A panel", cost: 120 },
        { sku: "FREE", name: "No price", cost: 0 },
        { name: "No code", cost: 5 },
      ],
      panels: [{ sku: "PANEL-1", name: "A panel", cost: 120, watts: 475 }],
    });
    expect(list?.items).toEqual([{ sku: "PANEL-1", name: "A panel", cost: 120 }]);
    expect(list?.panels).toHaveLength(1);
    expect(cleanSupplierList({ name: "empty.csv", items: [] })).toBeNull();
    expect(cleanSupplierList({ items: [{ sku: "A", cost: 1 }] })).toBeNull();
    expect(cleanSupplierList(null)).toBeNull();
  });
});

describe("a device's work brought into an account", () => {
  it("checks every roof, leaves out the unreadable, and takes one per roof", () => {
    const roofs = cleanImportRoofs([
      { ...ROOF, design: { faces: [] }, extras: null },
      { ...ROOF, design: { faces: [], label: "Same roof again" } },
      { address: "No place", design: { faces: [] } },
      { lat: -37.8, lng: 144.9, design: null },
      "nonsense",
    ]);
    expect(roofs).toHaveLength(1);
    expect(roofs[0]).toMatchObject({ address: ROOF.address, lat: ROOF.lat, lng: ROOF.lng });
    expect(cleanImportRoofs(null)).toEqual([]);
  });
  it("takes a bounded number at once", () => {
    const many = Array.from({ length: MAX_IMPORT_ROOFS + 20 }, (_, i) => ({ lat: -37 - i / 1000, lng: 145, design: { faces: [] } }));
    expect(cleanImportRoofs(many)).toHaveLength(MAX_IMPORT_ROOFS);
  });
});

describe("signing in to the roof designer", () => {
  it("lands on the designer and nowhere else", () => {
    expect(HOME_FOR.business).toBe("/design");
    expect(safeNext("/design/settings", "business")).toBe("/design/settings");
    expect(safeNext("/admin", "business")).toBe("/design");
    expect(safeNext("//evil.example/design", "business")).toBe("/design");
  });
  it("sends a plain email that makes no claims", () => {
    const email = designSignInEmail({ link: "https://www.renuabl.com.au/api/auth/callback?token=abc", minutes: 30 });
    expect(email.subject).toMatch(/roof designer/);
    expect(email.text).toContain("https://www.renuabl.com.au/api/auth/callback?token=abc");
    expect(email.text).toMatch(/expires in 30 minutes/);
    expect(email.text).not.toMatch(/guarantee|exact|precise|\bAI\b|best|leading/i);
  });
});

describe("how a sign-in link is delivered", () => {
  const dev = { emailReady: false, site: null, nodeEnv: "development", hosted: false, origin: "http://localhost:3000" };
  it("is emailed whenever email is set up", () => {
    expect(signInDelivery({ ...dev, emailReady: true, site: "https://www.renuabl.com.au", nodeEnv: "production", hosted: true })).toEqual({
      by: "email",
      site: "https://www.renuabl.com.au",
    });
    expect(signInDelivery({ ...dev, emailReady: true, site: "http://localhost:3000" }).by).toBe("email");
  });
  it("is printed in the terminal only on a developer's own computer", () => {
    expect(signInDelivery(dev)).toEqual({ by: "terminal", site: "http://localhost:3000" });
    expect(signInDelivery({ ...dev, origin: "http://127.0.0.1:3111" })).toEqual({ by: "terminal", site: "http://127.0.0.1:3111" });
    // Email half set up (a sender but no public address) still counts as no email.
    expect(signInDelivery({ ...dev, emailReady: true }).by).toBe("terminal");
  });
  it("is never printed on a built or hosted site, or for an address that isn't this computer", () => {
    expect(signInDelivery({ ...dev, nodeEnv: "production" }).by).toBe("none");
    expect(signInDelivery({ ...dev, nodeEnv: undefined }).by).toBe("none");
    expect(signInDelivery({ ...dev, nodeEnv: "test" }).by).toBe("none");
    expect(signInDelivery({ ...dev, hosted: true }).by).toBe("none");
    expect(signInDelivery({ ...dev, origin: "https://renuabl-preview.vercel.app" }).by).toBe("none");
    expect(signInDelivery({ ...dev, origin: "http://192.168.1.20:3000" }).by).toBe("none");
    expect(signInDelivery({ ...dev, origin: "http://localhost.evil.example" }).by).toBe("none");
    expect(signInDelivery({ ...dev, origin: "not a url" }).by).toBe("none");
  });
});
