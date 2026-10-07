import { afterEach, describe, expect, it, vi } from "vitest";
import { suggestedRates } from "@/lib/domain/partner";

const saved: string[] = [];
vi.mock("@/lib/server/storage", () => ({
  storageConfigured: () => process.env.TEST_STORAGE === "1",
  saveFile: async (path: string) => (saved.push(path), path),
  saveJson: async (path: string) => void saved.push(path),
}));
vi.mock("@/lib/server/email", () => ({ sendEmail: async () => "skipped" }));
vi.mock("@/lib/server/hubspot-crm", () => ({
  upsertContact: vi.fn(),
  addNote: vi.fn(),
  crmNote: () => "",
  hubspotToken: () => process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim() || null,
}));

const application = {
  type: "installer",
  fullName: "Jordan Lee",
  email: "jordan@example.com.au",
  mobile: "0412345678",
  businessName: "Lee Solar Pty Ltd",
  abn: "51824753556",
  businessAddress: "10 Waverley Road, Malvern East VIC 3145",
  base: { line: "10 Waverley Road", suburb: "Malvern East", state: "VIC", postcode: "3145" },
  radiusKm: 40,
  accreditationNumber: "A1234567",
  electricalLicence: "REC12345",
  insurance: { publicLiability: 20_000_000, expires: "2099-06-30" },
  rates: suggestedRates(),
};

function request(app: object, certificate = true) {
  const body = new FormData();
  body.append("application", JSON.stringify(app));
  if (certificate) body.append("certificate", new File([new Uint8Array(10)], "coc.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/partners/apply", { method: "POST", body });
}

async function post(req: Request, env: { preview: boolean; storage: boolean }) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_PREVIEW_MODE = env.preview ? "true" : "false";
  process.env.TEST_STORAGE = env.storage ? "1" : "0";
  delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const { POST } = await import("./route");
  const res = await POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe("partner applications", () => {
  afterEach(() => {
    saved.length = 0;
    delete process.env.NEXT_PUBLIC_PREVIEW_MODE;
    delete process.env.TEST_STORAGE;
  });

  it("returns field errors for a bad application", async () => {
    const r = await post(request({ ...application, abn: "123" }, false), { preview: true, storage: true });
    expect(r.status).toBe(422);
    expect(r.json.errors).toMatchObject({ abn: expect.any(String), certificate: expect.any(String) });
  });

  it("stores the application and certificate privately", async () => {
    const r = await post(request(application), { preview: false, storage: true });
    expect(r.json.ok).toBe(true);
    expect(r.json.reference).toMatch(/^PA-[A-Z0-9]{6}$/);
    expect(saved.some((p) => p.endsWith("/certificate-of-currency.pdf"))).toBe(true);
    expect(saved.some((p) => p.endsWith("/application.json"))).toBe(true);
  });

  it("won't say it's received on the live site when nothing could save it", async () => {
    const r = await post(request(application), { preview: false, storage: false });
    expect(r.status).toBe(503);
    expect(r.json.ok).toBe(false);
  });
});
