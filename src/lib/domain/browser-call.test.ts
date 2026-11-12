import { describe, expect, it } from "vitest";
import {
  NOT_WRITTEN,
  browserCallHeadline,
  callEnd,
  cleanSentences,
  dialTwiml,
  dialogue,
  durationWords,
  noticeTwiml,
  recordingLine,
  recordingNotice,
  recordingOf,
  sayTwiml,
  wordCount,
} from "./browser-call";
import { loggedWords } from "./design/call-log";

describe("Twilio's instructions for a call from the computer", () => {
  const base = {
    callerId: "+61485045505",
    number: "+61412345678",
    actionUrl: "https://www.renuabl.com.au/api/voice/twilio/done?call=bc_1&x=2",
    noticeUrl: "https://www.renuabl.com.au/api/voice/twilio/notice?call=bc_1",
    recordingUrl: "https://www.renuabl.com.au/api/voice/twilio/recording?call=bc_1",
  };

  it("rings the customer from our number and records both sides", () => {
    const x = dialTwiml(base);
    expect(x).toContain('callerId="+61485045505"');
    expect(x).toContain("<Number");
    expect(x).toContain(">+61412345678</Number>");
    expect(x).toContain('record="record-from-answer-dual"');
    expect(x).toContain('url="https://www.renuabl.com.au/api/voice/twilio/notice?call=bc_1"');
  });

  it("escapes the addresses it carries", () => {
    expect(dialTwiml(base)).toContain("done?call=bc_1&amp;x=2");
    expect(sayTwiml('a <b> & "c"')).toContain("a &lt;b&gt; &amp; &quot;c&quot;");
  });

  it("records nothing and plays no notice when recording is off", () => {
    const x = dialTwiml({ ...base, noticeUrl: null, recordingUrl: null });
    expect(x).not.toContain("record=");
    expect(x).not.toContain("url=");
  });

  it("tells the customer who is calling and that it may be recorded", () => {
    expect(recordingNotice("Sunrise Solar")).toBe("Hello, this is a call from Sunrise Solar. This call may be recorded.");
    expect(recordingNotice("<script>")).toContain("from script.");
    expect(recordingNotice("")).toContain("your solar business");
    expect(noticeTwiml("RENUABL")).toContain('<Say language="en-AU">');
  });
});

describe("how a call ended", () => {
  it("reads Twilio's dial status", () => {
    expect(callEnd("completed", 42)).toBe("answered");
    expect(callEnd("completed", 0)).toBe("no-answer");
    expect(callEnd("busy", 0)).toBe("busy");
    expect(callEnd("no-answer", 0)).toBe("no-answer");
    expect(callEnd("canceled", 0)).toBe("cancelled");
    expect(callEnd("failed", 0)).toBe("failed");
    expect(callEnd("", 0)).toBe("failed");
  });

  it("says it in words on the deal", () => {
    expect(durationWords(38)).toBe("38 s");
    expect(durationWords(120)).toBe("2 min");
    expect(durationWords(252)).toBe("4 min 12 s");
    expect(browserCallHeadline("answered", 252)).toBe("Called from the computer · 4 min 12 s");
    expect(browserCallHeadline("busy", 0)).toContain("line busy");
    expect(browserCallHeadline("no-answer", 0)).toContain("no answer");
  });
});

describe("the recording on the deal", () => {
  const id = "bc_0123456789abcdef01234567";
  it("is marked at the end of the entry and read back off it", () => {
    const text = `Called from the computer · 2 min\nSummary here\n${recordingLine(id)}`;
    expect(recordingOf(text)).toEqual({ callId: id, text: "Called from the computer · 2 min\nSummary here" });
    expect(recordingOf("A call with no recording")).toBeNull();
    expect(recordingOf("[recording:../../etc]")).toBeNull();
  });

  it("isn't shown as words in Today's Calls tab", () => {
    expect(loggedWords(`Called from the computer · 2 min\n${recordingLine(id)}`)).toBe("Called from the computer · 2 min");
  });
});

describe("the transcript Sol writes up", () => {
  const raw = [
    { media_channel: 2, transcript: "Hi, yes  this is Jo.", start_time: 3.2 },
    { media_channel: 1, transcript: "Hi Jo, it's Sam from RENUABL.", start_time: 1 },
    { media_channel: 2, transcript: "Is it about the battery?", start_time: 5 },
    { media_channel: 1, transcript: "", start_time: 6 },
    "junk",
  ];

  it("keeps Twilio's sentences in order, tidied", () => {
    const s = cleanSentences(raw);
    expect(s.map((x) => x.text)).toEqual(["Hi Jo, it's Sam from RENUABL.", "Hi, yes this is Jo.", "Is it about the battery?"]);
    expect(cleanSentences(null)).toEqual([]);
  });

  it("marks each side and joins a side's runs", () => {
    expect(dialogue(cleanSentences(raw), "Jo Citizen")).toBe(
      "Us: Hi Jo, it's Sam from RENUABL.\nJo (customer): Hi, yes this is Jo. Is it about the battery?",
    );
  });

  it("counts words, and says why a call wasn't written up", () => {
    expect(wordCount(" one  two three ")).toBe(3);
    for (const words of Object.values(NOT_WRITTEN)) expect(words.startsWith("Recorded.")).toBe(true);
  });
});
