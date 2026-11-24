import { describe, expect, it } from "vitest";
import { dealMailFrom, gmailQueryFor, searchableAddress } from "./deal-mail";

const mail = (id: string, from: string, to: string, subject: string, at: number, box = "me@biz.com") => ({
  id,
  box,
  snippet: "Thanks &amp; see you &#39;then&#39;",
  internalDate: String(at),
  payload: {
    headers: [
      { name: "From", value: from },
      { name: "To", value: to },
      { name: "Subject", value: subject },
    ],
  },
});

describe("deal mail", () => {
  const t = Date.parse("2026-11-20T01:00:00Z");
  it("keeps emails to and from the customer, newest first", () => {
    const got = dealMailFrom(
      [
        mail("a", "Alex <alex@home.com>", "me@biz.com", "Quote question", t),
        mail("b", "me@biz.com", "alex@home.com", "Re: Quote question", t + 60_000),
        mail("c", "other@x.com", "me@biz.com", "Unrelated", t),
      ],
      "Alex@Home.com",
      [],
    );
    expect(got.map((m) => [m.id, m.way])).toEqual([
      ["b", "out"],
      ["a", "in"],
    ]);
    expect(got[1].from).toBe("Alex");
    expect(got[1].snippet).toBe("Thanks & see you 'then'");
  });

  it("leaves out one already on the deal's record, and the same email twice", () => {
    const got = dealMailFrom(
      [
        mail("b", "me@biz.com", "alex@home.com", "Your proposal", t),
        mail("a", "Alex <alex@home.com>", "me@biz.com", "Hi", t),
        mail("a2", "Alex <alex@home.com>", "sales@biz.com", "Hi", t, "sales@biz.com"),
      ],
      "alex@home.com",
      [{ text: "Email to alex@home.com: Your proposal\nWords", at: new Date(t + 120_000).toISOString() }],
    );
    expect(got.map((m) => m.id)).toEqual(["a"]);
  });

  it("searches only a plain address", () => {
    expect(searchableAddress(" Alex@Home.com ")).toBe("alex@home.com");
    expect(searchableAddress("a@b.com OR in:anywhere")).toBeNull();
    expect(gmailQueryFor("alex@home.com")).toContain("from:alex@home.com");
  });
});
