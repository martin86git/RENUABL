import { afterEach, describe, expect, it, vi } from "vitest";

let role: string | null = "staff";
vi.mock("@/lib/server/accounts", () => ({ currentSession: async () => (role ? { role } : null) }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

const { GET } = await import("./route");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  role = "staff";
});

describe("GET /api/admin/hubspot-test", () => {
  it("is staff only", async () => {
    role = null;
    expect((await GET()).status).toBe(401);
  });

  it("says which step HubSpot refused, with its reply", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).endsWith("/notes")
          ? new Response("Missing scopes: crm.objects.notes.write", { status: 403 })
          : Response.json({ id: "c1" }),
      ),
    );
    const json = await (await GET()).json();
    expect(json).toMatchObject({ ok: false, step: "note", contactId: "c1" });
    expect(json.message).toContain("403");
  });

  it("writes only to RENUABL's own test contact", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        urls.push(String(url));
        return Response.json({ id: "c1" });
      }),
    );
    expect((await (await GET()).json()).ok).toBe(true);
    expect(urls[0]).toContain(encodeURIComponent("website-test@renuabl.com.au"));
  });
});
