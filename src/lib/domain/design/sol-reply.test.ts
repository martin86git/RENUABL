import { describe, expect, it } from "vitest";
import { REPLY_CLIP, replyLabel, replyToSol } from "./sol-format";
import { splitQuote } from "./chat-quote";

describe("replying to a message in a chat with Sol", () => {
  it("sends what was typed as it is when nothing is being replied to", () => {
    expect(replyToSol(null, "  hello ")).toEqual({ said: "hello" });
  });

  it("names a question of his and shows only the answer", () => {
    const r = replyToSol({ kind: "question", text: "Want me to draft it?" }, "Yes, make it short");
    expect(r.said).toBe('Answering your question "Want me to draft it?": Yes, make it short');
    expect(r.shown).toBe("Yes, make it short");
  });

  it("quotes his message for him and shows the reply under a one-line quote", () => {
    const r = replyToSol({ kind: "message", from: "sol", text: "! Call Jo first.\n- She opened it twice" }, "Why Jo?");
    expect(r.said).toBe('Replying to your message: "Call Jo first. - She opened it twice"\n\nWhy Jo?');
    const shown = splitQuote(r.shown ?? "");
    expect(shown.quote).toBe("Call Jo first. - She opened it twice");
    expect(shown.text).toBe("Why Jo?");
  });

  it("says when the member replies to their own message", () => {
    expect(replyToSol({ kind: "message", from: "you", text: "Size it at 8 kW" }, "Make that 10").said).toMatch(
      /^Replying to what I said earlier: "Size it at 8 kW"/,
    );
  });

  it("clips a long message", () => {
    const r = replyToSol({ kind: "message", from: "sol", text: "word ".repeat(400) }, "ok");
    const quoted = /"(.*)"/.exec(r.said)?.[1] ?? "";
    expect(quoted.length).toBeLessThanOrEqual(REPLY_CLIP);
    expect(quoted.endsWith("…")).toBe(true);
  });

  it("labels the line over the box", () => {
    expect(replyLabel({ kind: "message", from: "sol", text: "Hi" })).toEqual({ who: "Sol", words: "Hi" });
    expect(replyLabel({ kind: "question", text: "Ok?" }).who).toBe("Sol's question");
  });
});
