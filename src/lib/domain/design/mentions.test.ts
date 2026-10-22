import { describe, expect, it } from "vitest";
import { seesAllDeals, seesDeal } from "./account";
import { handleOf, mentionEmail, mentionText, mentionsIn } from "./mentions";

const members = ["Sam.Jones@sunny.example", "jo@sunny.example", "jo.b@sunny.example", "martin@sunny.example"];

describe("@mentions in a note", () => {
  it("finds each member mentioned once, by their whole handle or a short one only they have", () => {
    expect(mentionsIn("@sam can you call them? cc @jo.b and @sam.jones", members, "martin@sunny.example")).toEqual([
      "sam.jones@sunny.example",
      "jo.b@sunny.example",
    ]);
    // "jo" is someone's whole handle, so it is them, not jo.b.
    expect(mentionsIn("@jo please", members, "martin@sunny.example")).toEqual(["jo@sunny.example"]);
  });

  it("never notifies the writer, and ignores emails and unknown names", () => {
    expect(mentionsIn("note to self @martin", members, "Martin@sunny.example")).toEqual([]);
    expect(mentionsIn("email alex@example.com, @nobody", members, "martin@sunny.example")).toEqual([]);
    expect(mentionsIn("thanks @jo.", members, "martin@sunny.example")).toEqual(["jo@sunny.example"]);
  });

  it("puts a handle in the box and writes the email", () => {
    expect(handleOf("Sam.Jones@x.example")).toBe("sam.jones");
    expect(mentionText("sam.jones@x.example")).toBe("@sam.jones ");
    const e = mentionEmail({ by: "martin@x.example", customer: "Alex <Example>", text: "Call\nthem", link: "https://x.example/d" });
    expect(e.subject).toBe("martin mentioned you on Alex <Example>'s deal");
    expect(e.html).toContain("Alex &lt;Example&gt;");
    expect(e.html).toContain("Call<br>them");
  });
});

describe("who sees which deals", () => {
  it("is everyone's for the owner and members by default; otherwise their own, no one's, and those they are mentioned on", () => {
    expect(seesAllDeals("owner", { costs: false, prices: false, publish: false, allDeals: false })).toBe(true);
    expect(seesAllDeals("member")).toBe(true);
    expect(seesAllDeals("member", { costs: true, prices: true, publish: true, allDeals: false })).toBe(false);
    const sam = { email: "Sam@x.example", all: false };
    expect(seesDeal(sam, "sam@x.example")).toBe(true);
    expect(seesDeal(sam, null)).toBe(true);
    expect(seesDeal(sam, "jo@x.example")).toBe(false);
    expect(seesDeal(sam, "jo@x.example", true)).toBe(true);
  });
});
