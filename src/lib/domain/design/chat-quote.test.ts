import { describe, expect, it } from "vitest";
import { cleanLine } from "./chat";
import { MAX_QUOTE, splitQuote, withQuote } from "./chat-quote";

describe("replying to a message", () => {
  it("puts the message answered over the reply, and reads it back", () => {
    const sent = withQuote("Yes, we can.", "Can it go on the garage?");
    expect(sent).toBe("> Can it go on the garage?\nYes, we can.");
    expect(splitQuote(sent)).toEqual({ quote: "Can it go on the garage?", text: "Yes, we can." });
  });

  it("clips a long message to one line, and quotes only the words of a reply", () => {
    const long = `${"word ".repeat(60)}\n\nmore`;
    const quote = splitQuote(withQuote("Sure.", long)).quote!;
    expect(quote.length).toBe(MAX_QUOTE);
    expect(quote.endsWith("…")).toBe(true);
    expect(quote).not.toContain("\n");
    expect(withQuote("Again", "> First\nSecond")).toBe("> Second\nAgain");
  });

  it("leaves a reply alone when there is nothing to quote, and ordinary words as words", () => {
    expect(withQuote("Hello", "   ")).toBe("Hello");
    expect(splitQuote("Hello")).toEqual({ text: "Hello" });
    expect(splitQuote("> only a quote")).toEqual({ text: "> only a quote" });
    expect(splitQuote("> \nwords")).toEqual({ text: "> \nwords" });
    expect(splitQuote("> quote\n  ")).toEqual({ text: "> quote\n  " });
  });

  it("survives the chat's own cleaning as it is", () => {
    const sent = withQuote("Tuesday suits.", "When can you come?");
    const clean = cleanLine({ text: sent });
    expect(clean.ok && clean.value.text).toBe(sent);
  });
});
