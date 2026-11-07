import { describe, expect, it } from "vitest";
import { cleanWriteAsk, readDraft, writeAsk, writeSystem } from "./deal-write";

describe("write with Sol", () => {
  it("needs something to say", () => {
    expect(cleanWriteAsk({ ask: "  " }).ok).toBe(false);
    expect(cleanWriteAsk({ ask: "Ask if Thursday suits for a site visit" })).toEqual({
      ok: true,
      ask: "Ask if Thursday suits for a site visit",
    });
  });

  it("keeps Sol to the facts and the business's name", () => {
    const s = writeSystem("Example Solar");
    expect(s).toMatch(/Never invent or promise a price/);
    expect(s).toMatch(/The Example Solar team/);
    expect(
      writeAsk(
        { business: "Example Solar", customerFirst: "Jo", title: "Solar", stage: "Proposal sent", suburb: "Kew", recent: [] },
        "Say hi",
      ),
    ).toMatch(/What to say: Say hi/);
  });

  it("reads the subject and body back", () => {
    expect(readDraft("Subject: Site visit\n\nHi Jo,\n\nThanks.\n\nThe Example Solar team")).toEqual({
      subject: "Site visit",
      body: "Hi Jo,\n\nThanks.\n\nThe Example Solar team",
    });
    expect(readDraft("No subject here")).toBeNull();
  });
});
