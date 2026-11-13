import { describe, expect, it } from "vitest";
import {
  assistantConfig,
  bookedLine,
  callRecordLine,
  closedAssistant,
  readCallLine,
  type CallBrief,
  firstMessage,
  openingBlock,
  screeningAnswer,
  mayCallNow,
  MAX_ATTEMPTS,
  missedCallSms,
  nextAttemptAt,
  nextCallWindow,
  OBJECTIONS,
  outcomeOf,
  proposalLinkSms,
  readBooking,
  readVapiEvent,
  shouldRetry,
  speakableName,
  strongerOutcome,
  toolWords,
  VOICE_SECRET_HEADER,
  voiceSlots,
  voiceSystemPrompt,
  voicemailMessage,
  whenWords,
} from "./voice-agent";
import { SMS_MAX } from "./sms";

// Melbourne is UTC+11 in November (daylight saving).
const melb = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+11:00`);

const lead: CallBrief = {
  mode: "lead",
  assistant: "Ella",
  business: "RENUABL",
  firstName: "Sam <script>",
  about: ["Looking for: Solar and a battery", "Suburb: Glen Waverley"],
  asked: false,
  canBook: true,
  canSendLink: false,
  hasEmail: true,
};
const asked: CallBrief = {
  ...lead,
  mode: "proposal",
  assistant: "Sol",
  business: "Sunrise Solar",
  asked: true,
  canBook: false,
  canSendLink: true,
  proposal: "System: 6.6 kW of solar, 14 panels, a 16 kWh battery.\nPrice $18,000 including GST, you pay $14,500.",
};

describe("calling hours", () => {
  it("calls weekdays 9am to 7:30pm and Saturdays 9am to 4:30pm", () => {
    expect(mayCallNow(melb("2026-11-05", "08:59"))).toBe(false); // Thursday
    expect(mayCallNow(melb("2026-11-05", "09:00"))).toBe(true);
    expect(mayCallNow(melb("2026-11-05", "19:29"))).toBe(true);
    expect(mayCallNow(melb("2026-11-05", "19:30"))).toBe(false);
    expect(mayCallNow(melb("2026-11-07", "16:00"))).toBe(true); // Saturday
    expect(mayCallNow(melb("2026-11-07", "16:30"))).toBe(false);
  });

  it("never calls on Sundays or Victorian public holidays", () => {
    expect(mayCallNow(melb("2026-11-08", "11:00"))).toBe(false); // Sunday
    expect(mayCallNow(melb("2026-11-03", "11:00"))).toBe(false); // Melbourne Cup
  });

  it("finds the next window, skipping Sunday, and says when", () => {
    const now = melb("2026-11-07", "18:00"); // Saturday evening
    const w = nextCallWindow(now)!;
    expect(w.from.toISOString()).toBe(melb("2026-11-09", "09:00").toISOString());
    expect(w.until.toISOString()).toBe(melb("2026-11-09", "19:30").toISOString());
    expect(whenWords(w, now)).toBe("Monday at 9am");
  });

  it("starts now when the window is open", () => {
    const now = melb("2026-11-05", "10:15");
    expect(nextCallWindow(now)!.from).toEqual(now);
    expect(whenWords(nextCallWindow(now)!, now)).toBe("now");
    expect(whenWords({ from: melb("2026-11-05", "13:00") }, now)).toBe("today at 1pm");
  });

  it("tries again a few hours later, then the next day, then stops", () => {
    const ended = melb("2026-11-05", "10:00");
    expect(nextAttemptAt(1, ended)!.from.toISOString()).toBe(melb("2026-11-05", "13:00").toISOString());
    expect(nextAttemptAt(2, ended)!.from.toISOString()).toBe(melb("2026-11-06", "09:00").toISOString());
    expect(nextAttemptAt(MAX_ATTEMPTS, ended)).toBeNull();
    expect(nextAttemptAt(2, ended, 2)).toBeNull();
  });
});

describe("outcomes", () => {
  it("reads what the call came to", () => {
    expect(outcomeOf("customer-ended-call", "booked")).toBe("booked");
    expect(outcomeOf("customer-did-not-answer", null)).toBe("no-answer");
    expect(outcomeOf("voicemail", null)).toBe("voicemail");
    expect(outcomeOf("assistant-forwarded-call", null)).toBe("transferred");
    expect(outcomeOf("twilio-failed-to-connect-call", null)).toBe("failed");
    expect(outcomeOf("customer-ended-call", null)).toBe("talked");
  });

  it("keeps the strongest thing done on a call", () => {
    expect(strongerOutcome(null, "link-sent")).toBe("link-sent");
    expect(strongerOutcome("link-sent", "booked")).toBe("booked");
    expect(strongerOutcome("booked", "link-sent")).toBe("booked");
    expect(strongerOutcome("callback", "no-more-calls")).toBe("no-more-calls");
  });

  it("retries only when nobody was reached", () => {
    expect(shouldRetry("no-answer")).toBe(true);
    expect(shouldRetry("voicemail")).toBe(true);
    expect(shouldRetry("talked")).toBe(false);
    expect(shouldRetry("no-more-calls")).toBe(false);
  });

  it("writes what the call came to first, the booked time with it, then the summary", () => {
    expect(callRecordLine({ outcome: "link-sent", summary: "Went through the battery <b>size</b>." })).toBe(
      "Proposal link sent\nWent through the battery bsize/b.",
    );
    const booked = callRecordLine({
      outcome: "booked",
      detail: "Saturday 14 November at 9am (Melbourne time)",
      summary: "Keen on a battery.",
    });
    expect(booked).toBe("15-minute call booked · Saturday 14 November at 9am (Melbourne time)\nKeen on a battery.");
    expect(callRecordLine({ outcome: "no-answer" })).toBe("No answer");
    expect(callRecordLine({ outcome: "talked", inbound: true })).toBe("Spoke to them, nothing booked\nThey rang in.");
    expect(bookedLine("Monday 16 November at 10am (Melbourne time)")).toMatch(/^15-minute call booked · Monday 16 November/);
  });

  it("reads a call entry back for the timeline, the older wording too", () => {
    const now = readCallLine(
      callRecordLine({ outcome: "booked", detail: "Saturday 14 November at 9am (Melbourne time)", summary: "Keen." }),
    );
    expect(now).toEqual({
      outcome: "booked",
      headline: "15-minute call booked",
      detail: "Saturday 14 November at 9am (Melbourne time)",
      rest: "Keen.",
    });
    const old = readCallLine(
      "Revo called (automated): Booked a 15-minute call. Saturday 14 November at 9am (Melbourne time) Revo called Michelle about solar.",
    );
    expect(old?.outcome).toBe("booked");
    expect(old?.detail).toBe("Saturday 14 November at 9am (Melbourne time)");
    expect(old?.rest).toBe("Revo called Michelle about solar.");
    expect(readCallLine("Sol called (automated): No answer.")?.outcome).toBe("no-answer");
    expect(readCallLine("Rang them about the roof, all good.")).toBeNull();
  });
});

describe("booking", () => {
  const today = "2026-11-04";

  it("offers the booking page's times for the next few days", () => {
    const slots = voiceSlots(today);
    expect(slots.length).toBeGreaterThan(0);
    expect(new Set(slots.map((s) => s.date)).size).toBeLessThanOrEqual(3);
    expect(slots.every((s) => s.date > today)).toBe(true);
  });

  it("books only a time the page would offer", () => {
    const s = voiceSlots(today)[0];
    expect(readBooking({ date: s.date, time: s.time }, today)?.label).toContain("Melbourne time");
    expect(readBooking({ date: today, time: "10:00" }, today)).toBeNull();
    expect(readBooking({ date: s.date, time: "03:00" }, today)).toBeNull();
    expect(readBooking("nonsense", today)).toBeNull();
  });

  it("cleans a tool's words", () => {
    expect(toolWords({ about: "  battery\n<size>  " }, "about")).toBe("battery size");
    expect(toolWords({ about: 5 }, "about")).toBe("");
    expect(toolWords(null, "about")).toBe("");
  });
});

describe("what it says", () => {
  it("opens by saying who it is and that it's automated, never that it's recorded", () => {
    const m = firstMessage(lead);
    expect(m).toContain("is that Sam");
    expect(m).toContain("Ella, RENUABL's automated assistant");
    expect(m).not.toMatch(/record/i);
    expect(firstMessage({ ...lead, asked: true })).toContain("You said yes to a call");
    expect(m).not.toMatch(/\bAI\b|<script/);
    expect(firstMessage(asked)).toContain("You asked us to give you a call about your proposal");
    expect(firstMessage(asked)).toContain("Sol, Sunrise Solar's automated assistant");
  });

  it("keeps names to letters", () => {
    expect(speakableName("Jo-Anne O'Neil 123 {}")).toBe("Jo-Anne O'Neil");
  });

  it("guides a new lead to the call and a proposal, with times to offer", () => {
    const p = voiceSystemPrompt(lead, voiceSlots("2026-11-04"), { canTransfer: false });
    expect(p).toContain("book_call");
    expect(p).toContain("they'll be sent a proposal");
    expect(p).toContain("Looking for: Solar and a battery");
    expect(p).toContain("Times you can offer");
    expect(p).not.toContain("send_proposal_link");
    expect(p).not.toContain("transferCall");
  });

  it("goes through a proposal from the customer's copy, guiding to sign online, never agreeing a price", () => {
    const p = voiceSystemPrompt(asked, [], { canTransfer: true });
    expect(p).toContain("you pay $14,500");
    expect(p).toContain("I'd like to go ahead");
    expect(p).toContain("Never change, discount or negotiate a price");
    expect(p).toContain("send_proposal_link");
    expect(p).toContain("transferCall");
    expect(p).not.toContain("book_call");
    expect(p).not.toContain("Times you can offer");
    expect(p).toContain("INDICATIVE it can't be signed");
  });

  it("meets every usual worry, with no pressure", () => {
    const p = voiceSystemPrompt(asked, [], { canTransfer: false });
    for (const o of OBJECTIONS) expect(p).toContain(o.worry);
    expect(p).toContain("No pressure");
    expect(JSON.stringify(OBJECTIONS)).not.toMatch(/discount(?! or)|guarantee|today only/i);
  });

  it("builds the inline assistant with the secret header and only the tools the call may use", () => {
    const a = assistantConfig({
      brief: lead,
      slots: [],
      serverUrl: "https://x.test/api/voice/vapi?ref=v_1",
      secret: "s3",
      model: "claude-sonnet-5",
    });
    expect(a.server.headers[VOICE_SECRET_HEADER]).toBe("s3");
    expect(a.model.provider).toBe("anthropic");
    expect(a.name).toBe("Ella");
    expect(a.maxDurationSeconds).toBe(600);
    const tools = JSON.stringify(a.model.tools);
    expect(tools).toContain("book_call");
    expect(tools).not.toContain("send_proposal_link");
    expect(tools).not.toContain("transferCall");
    const b = assistantConfig({ brief: asked, slots: [], serverUrl: "u", secret: "s", model: "m", transferNumber: "+61400111222" });
    expect(b.maxDurationSeconds).toBe(1200);
    expect(JSON.stringify(b.model.tools)).toContain("send_proposal_link");
    expect(JSON.stringify(b.model.tools)).not.toContain("book_call");
    expect(JSON.stringify(b.model.tools)).toContain("+61400111222");
  });

  it("waits for the other end to speak on a call it placed, and tells a call screener only who and why", () => {
    const a = assistantConfig({ brief: lead, slots: [], serverUrl: "u", secret: "s", model: "m" });
    expect(a).not.toHaveProperty("firstMessage");
    expect(a.firstMessageMode).toBe("assistant-waits-for-user");
    expect(JSON.stringify(a)).toContain("customer.speech.timeout");
    const said = screeningAnswer(lead);
    expect(said).toMatch(/^It's Ella, RENUABL's automated assistant, calling for Sam.* about their solar enquiry.$/);
    expect(said.length).toBeLessThan(firstMessage(lead).length);
    expect(screeningAnswer(asked)).toContain("the call they asked for");
    const p = voiceSystemPrompt(lead, [], { canTransfer: false });
    expect(p).toContain("How this call starts");
    expect(p).toContain(firstMessage(lead));
    expect(p).toContain(said);
    expect(p).toContain("start from the top with your opening");
    expect(openingBlock(lead)).toContain("Never leave it for a call screener");
    // A call that came in is answered straight away, as before.
    const rang = { ...lead, inbound: true };
    const inb = assistantConfig({ brief: rang, slots: [], serverUrl: "u", secret: "s", model: "m" });
    expect(JSON.stringify(inb)).toContain("thanks for calling");
    expect(inb.firstMessageMode).toBe("assistant-speaks-first");
    expect(voiceSystemPrompt(rang, [], { canTransfer: false })).not.toContain("How this call starts");
  });

  it("leaves a voicemail fitting the call", () => {
    expect(voicemailMessage(lead)).toContain("book a free 15-minute call");
    expect(voicemailMessage(asked)).toContain("chat on your proposal page");
  });

  it("keeps texts to one link and Reply STOP", () => {
    for (const t of [
      missedCallSms({ business: "RENUABL", link: "https://www.renuabl.com.au/book-a-call" }),
      proposalLinkSms({ business: "Sunrise Solar", link: `https://www.renuabl.com.au/p/${"a".repeat(48)}` }),
    ]) {
      expect(t.length).toBeLessThanOrEqual(SMS_MAX);
      expect(t).toContain("Reply STOP");
    }
  });
});

describe("Vapi messages", () => {
  it("reads tool calls with object or string arguments", () => {
    const e = readVapiEvent({
      message: {
        type: "tool-calls",
        call: { id: "c1" },
        toolCallList: [
          { id: "t1", type: "function", function: { name: "book_call", arguments: { date: "2026-11-05", time: "09:30" } } },
          { id: "t2", type: "function", function: { name: "no_more_calls", arguments: '{"reason":"renting"}' } },
          { nonsense: true },
        ],
      },
    });
    expect(e.type).toBe("tool-calls");
    expect(e.callId).toBe("c1");
    expect(e.toolCalls).toEqual([
      { id: "t1", name: "book_call", args: { date: "2026-11-05", time: "09:30" } },
      { id: "t2", name: "no_more_calls", args: { reason: "renting" } },
    ]);
  });

  it("reads the end-of-call report", () => {
    const e = readVapiEvent({
      message: { type: "end-of-call-report", endedReason: "voicemail", call: { id: "c2" }, artifact: { transcript: "AI: Hi" } },
    });
    expect(e).toMatchObject({ type: "end-of-call-report", endedReason: "voicemail", callId: "c2", transcript: "AI: Hi" });
    expect(readVapiEvent(null).type).toBe("");
  });
});

describe("calls that come in", () => {
  const rang = { ...lead, inbound: true, asked: true };
  it("thanks them for calling, says who it is and that it's automated, and leaves no voicemail", () => {
    const m = firstMessage(rang);
    expect(m).toContain("thanks for calling RENUABL");
    expect(m).toContain("Ella, the automated assistant");
    expect(m).not.toMatch(/record/i);
    const a = assistantConfig({ brief: rang, slots: [], serverUrl: "u", secret: "s", model: "m" });
    expect(a).not.toHaveProperty("voicemailMessage");
    expect(a.artifactPlan).toEqual({ recordingEnabled: false });
    expect(a.maxDurationSeconds).toBe(1200);
    expect(a.model.messages[0].content).toContain("rang RENUABL's number themselves");
    expect(a.model.messages[0].content).not.toContain("leave this message");
  });

  it("reads who rang and on which number", () => {
    const e = readVapiEvent({
      message: { type: "assistant-request", call: { id: "c1", phoneNumberId: "pn1", customer: { number: "+61400111222" } } },
    });
    expect(e).toMatchObject({ type: "assistant-request", callId: "c1", number: "+61400111222", phoneNumberId: "pn1" });
  });

  it("says kindly when it can't take the call, with nothing to keep", () => {
    const c = closedAssistant({ business: "RENUABL <b>", model: "m" });
    expect(c.firstMessage).toContain("Thanks for calling RENUABL");
    expect(c.firstMessage).not.toContain("<");
    expect(c).not.toHaveProperty("server");
  });
});
