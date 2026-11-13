import { describe, expect, it } from "vitest";
import {
  cleanCallerRole,
  INSTALL_CALL_LEAD_DAYS,
  INSTALL_OFFER_A_WEEK,
  INSTALL_OFFER_DAYS,
  INSTALL_TOOL,
  installCallRefusal,
  installDaysToOffer,
  installFirstMessage,
  installSystemPrompt,
  installVoicemail,
  pencilledLine,
  readInstallDay,
  roleOfMode,
} from "./install-call";
import { addDaysISO, isInstallDay } from "./scheduling";
import { assistantConfig, CALL_HEADLINES, readCallLine, voiceSystemPrompt, type CallBrief } from "./voice-agent";

const TODAY = "2026-11-13"; // a Friday
const brief: CallBrief = {
  mode: "install",
  assistant: "Ava",
  business: "Sunrise Solar",
  firstName: "Sam",
  about: ["Their job: Solar and battery", "Suburb: Rowville"],
  asked: false,
  canBook: false,
  canSendLink: false,
  hasEmail: true,
};

describe("the two assistants", () => {
  it("reads a role, sales unless it says admin", () => {
    expect(cleanCallerRole("admin")).toBe("admin");
    expect(cleanCallerRole("sales")).toBe("sales");
    expect(cleanCallerRole("owner")).toBe("sales");
    expect(cleanCallerRole(null)).toBe("sales");
  });

  it("gives booking calls to the admin assistant and every other call to sales", () => {
    expect(roleOfMode("install")).toBe("admin");
    expect(roleOfMode("lead")).toBe("sales");
    expect(roleOfMode("proposal")).toBe("sales");
  });
});

describe("the days offered on a booking call", () => {
  it("offers working days from the lead time on, a couple a week", () => {
    const days = installDaysToOffer(TODAY, { taken: [], capacity: 5 });
    expect(days).toHaveLength(INSTALL_OFFER_DAYS);
    for (const d of days) {
      expect(d.date >= addDaysISO(TODAY, INSTALL_CALL_LEAD_DAYS)).toBe(true);
      expect(isInstallDay(d.date)).toBe(true);
    }
    const perWeek = new Map<string, number>();
    for (const d of days) {
      const day = new Date(`${d.date}T00:00:00Z`);
      const monday = addDaysISO(d.date, -((day.getUTCDay() + 6) % 7));
      perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
    }
    expect(Math.max(...perWeek.values())).toBeLessThanOrEqual(INSTALL_OFFER_A_WEEK);
    expect(days[0].label).toMatch(/^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+$/);
  });

  it("never offers a day that already has an install, or a week that is full", () => {
    const open = installDaysToOffer(TODAY, { taken: [], capacity: 5 });
    const first = open[0].date;
    expect(installDaysToOffer(TODAY, { taken: [first], capacity: 5 }).some((d) => d.date === first)).toBe(false);
    // The first week full: nothing from it is offered.
    const monday = addDaysISO(first, -((new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7));
    const full = [0, 1].map((i) => addDaysISO(monday, i));
    const later = installDaysToOffer(TODAY, { taken: full, capacity: 2 });
    expect(later.every((d) => d.date > addDaysISO(monday, 6))).toBe(true);
    // One place left in a week: one day from it, not two.
    const one = installDaysToOffer(TODAY, { taken: [addDaysISO(monday, 0)], capacity: 2 });
    expect(one.filter((d) => d.date <= addDaysISO(monday, 6))).toHaveLength(1);
  });

  it("offers nothing when the business can do no installs", () => {
    expect(installDaysToOffer(TODAY, { taken: [], capacity: 0 })).toEqual([]);
  });

  it("takes only a day that was offered", () => {
    const days = installDaysToOffer(TODAY, { taken: [], capacity: 5 });
    expect(readInstallDay({ date: days[1].date }, days)).toEqual(days[1]);
    expect(readInstallDay({ date: "2026-11-14" }, days)).toBeNull();
    expect(readInstallDay({ date: "tomorrow" }, days)).toBeNull();
    expect(readInstallDay(null, days)).toBeNull();
  });
});

describe("what the admin assistant says", () => {
  const days = installDaysToOffer(TODAY, { taken: [], capacity: 5 });

  it("opens by saying who it is, that it is automated and that the call is recorded", () => {
    const first = installFirstMessage(brief);
    expect(first).toContain("Ava, Sunrise Solar's automated assistant");
    expect(first).toContain("book in your installation");
    expect(first).toContain("This call is recorded");
    expect(installVoicemail(brief)).toContain("automated assistant");
  });

  it("is told to offer only the listed days and that a pencilled day is never final", () => {
    const p = installSystemPrompt({ ...brief, installDays: days }, days, { canTransfer: false });
    for (const d of days) expect(p).toContain(`${d.label} (date ${d.date})`);
    expect(p).toContain("Offer only the days below");
    expect(p).toContain("not final");
    expect(p).toContain("Never ask for card or bank details");
    expect(p).toContain(INSTALL_TOOL);
    expect(p).not.toContain("transferCall");
    // No selling on a booking call.
    expect(p).not.toMatch(/discount is|today only|book_call/);
  });

  it("with no days to offer, asks the team to call instead of inventing one", () => {
    const p = installSystemPrompt(brief, [], { canTransfer: false });
    expect(p).toContain("None right now");
    expect(p).not.toContain(`- ${INSTALL_TOOL}:`);
  });

  it("goes through the same call set-up as every call, with the pencil tool and no 15-minute booking", () => {
    const withDays = { ...brief, installDays: days };
    expect(voiceSystemPrompt(withDays, [], { canTransfer: false })).toContain("Offer only the days below");
    const a = assistantConfig({ brief: withDays, slots: [], serverUrl: "u", secret: "s", model: "m" });
    const tools = JSON.stringify(a.model.tools);
    expect(tools).toContain(INSTALL_TOOL);
    expect(tools).toContain("request_callback");
    expect(tools).not.toContain("book_call");
    expect(tools).not.toContain("send_proposal_link");
    expect(a.maxDurationSeconds).toBe(480);
    const none = assistantConfig({ brief, slots: [], serverUrl: "u", secret: "s", model: "m" });
    expect(JSON.stringify(none.model.tools)).not.toContain(INSTALL_TOOL);
  });

  it("writes the pencilled day on the deal so the timeline reads it back", () => {
    const line = pencilledLine(days[0].label);
    const read = readCallLine(line);
    expect(read?.outcome).toBe("pencilled");
    expect(read?.headline).toBe(CALL_HEADLINES.pencilled);
    expect(read?.detail).toBe(days[0].label);
    expect(line).toContain("tentative");
  });
});

describe("which deals may be rung to book", () => {
  it("only a sold deal, through its approvals, with no install date", () => {
    expect(installCallRefusal({ sold: true, installDate: null, gate: "book" })).toBeNull();
    expect(installCallRefusal({ sold: false, installDate: null, gate: null })).toBe("not-sold");
    expect(installCallRefusal({ sold: true, installDate: "2026-12-01", gate: null })).toBe("has-date");
    expect(installCallRefusal({ sold: true, installDate: null, gate: "preapproval" })).toBe("approvals");
    expect(installCallRefusal({ sold: true, installDate: null, gate: "solarvic" })).toBe("approvals");
  });
});
