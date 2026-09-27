import { afterEach, describe, expect, it, vi } from "vitest";
import { addNote, reservationNote, upsertContact } from "./hubspot-crm";

afterEach(() => vi.unstubAllGlobals());
const contact = { firstName: "Sarah", lastName: "Chen", mobile: "+61412345678", email: "sarah@example.com" };
const calls = (m: { mock: { calls: Parameters<typeof fetch>[] } }) =>
  m.mock.calls.map(([url, init]) => ({ url: String(url), init: init as RequestInit }));

describe("HubSpot CRM", () => {
  it("creates a contact as a lead", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "101" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await upsertContact(contact, "tok")).toBe("101");
    const [c] = calls(fetchMock);
    expect(c.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(new Headers(c.init.headers).get("authorization")).toBe("Bearer tok");
    expect(JSON.parse(c.init.body as string).properties).toMatchObject({
      email: "sarah@example.com",
      mobilephone: "+61412345678",
      lifecyclestage: "lead",
    });
  });

  it("updates the existing contact by email when it already exists", async () => {
    let n = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => (++n === 1 ? new Response("{}", { status: 409 }) : Response.json({ id: "55" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await upsertContact(contact, "tok")).toBe("55");
    const second = calls(fetchMock)[1];
    expect(second.url).toContain("/contacts/sarah%40example.com?idProperty=email");
    expect(second.init.method).toBe("PATCH");
    expect(JSON.parse(second.init.body as string).properties.lifecyclestage).toBeUndefined();
  });

  it("attaches an escaped note to the contact", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "n1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await addNote("101", reservationNote("RN-1234", { Home: "2 Hanwell Ct <b>", Roof: undefined }), "tok");
    const body = JSON.parse(calls(fetchMock)[0].init.body as string);
    expect(body.associations[0]).toEqual({
      to: { id: "101" },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
    });
    expect(body.properties.hs_note_body).toContain("RN-1234");
    expect(body.properties.hs_note_body).toContain("&lt;b&gt;");
    expect(body.properties.hs_note_body).not.toContain("Roof");
  });

  it("throws on HubSpot errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response("bad", { status: 401 })),
    );
    await expect(upsertContact(contact, "tok")).rejects.toThrow(/HubSpot contact 401/);
  });
});
