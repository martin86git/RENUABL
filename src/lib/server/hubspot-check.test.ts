import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHubspot } from "./hubspot-crm";

afterEach(() => vi.unstubAllGlobals());

const stub = (scopes: string[] | null) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) =>
      String(url).includes("access-token-info")
        ? scopes
          ? Response.json({ scopes })
          : new Response(null, { status: 404 })
        : Response.json({ results: [] }),
    ),
  );

describe("checkHubspot", () => {
  it("is ok when the token can read and write contacts", async () => {
    stub(["crm.objects.contacts.read", "crm.objects.contacts.write", "oauth"]);
    expect(await checkHubspot("pat-x")).toBe("ok");
  });

  it("says which scope is missing when the token can only read", async () => {
    stub(["crm.objects.contacts.read"]);
    expect(await checkHubspot("pat-x")).toContain("crm.objects.contacts.write");
  });

  it("stays ok when HubSpot doesn't report the scopes", async () => {
    stub(null);
    expect(await checkHubspot("pat-x")).toBe("ok");
  });
});
