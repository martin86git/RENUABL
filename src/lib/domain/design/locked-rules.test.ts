import { describe, expect, it } from "vitest";
import {
  MAX_LOCKED,
  MAX_NOTES,
  applyCoaching,
  cleanCoachAnswer,
  cleanNotes,
  coachPrompt,
  coachingBlock,
  lockRule,
  scriptLines,
  setLocked,
  trimNotes,
  type CoachNote,
} from "./coaching";
import { NATURAL_DELIVERY } from "./delivery";
import { installSystemPrompt } from "../install-call";
import { assistantConfig, openingBlock, voiceSystemPrompt, withoutSpeedSettings, type CallBrief } from "../voice-agent";

const note = (id: string, text: string, locked = false): CoachNote => ({
  id,
  text,
  at: "2026-11-12T00:00:00.000Z",
  by: "sam@x.example",
  from: "chat",
  ...(locked ? { locked: true } : {}),
});
const o = { at: "2026-11-16T00:00:00.000Z", by: "m@x.example", from: "call" as const, newId: () => "cn_cccccc" };
const brief = (more: Partial<CallBrief> = {}): CallBrief => ({
  mode: "lead",
  assistant: "Charlie",
  business: "RENUABL",
  firstName: "Jo",
  about: [],
  asked: false,
  canBook: false,
  canSendLink: false,
  hasEmail: false,
  ...more,
});

describe("rules locked into a voice agent's script", () => {
  const notes = [note("cn_aaaaaa", "Slow down when giving times"), note("cn_bbbbbb", "Mention the Rowville office", true)];

  it("go to a call as rules to follow every time, ahead of the notes, behind the fixed rules", () => {
    const { coaching, locked } = scriptLines(notes);
    expect(locked).toEqual(["Mention the Rowville office"]);
    expect(coaching).toEqual(["Slow down when giving times"]);
    const block = coachingBlock(coaching, "RENUABL", locked);
    expect(block.indexOf("Rules RENUABL has locked in")).toBeLessThan(block.indexOf("How RENUABL wants you to talk"));
    expect(block).toContain("every call, every time");
    expect(block).toContain("keep the rule above");
    expect(coachingBlock([], "RENUABL", locked)).toContain("- Mention the Rowville office");
    expect(coachingBlock([], "RENUABL", [])).toBe("");
    const prompt = voiceSystemPrompt(brief({ coaching, locked }), [], { canTransfer: false });
    expect(prompt.indexOf("Rules you always keep")).toBeLessThan(prompt.indexOf("Rules Renewable has locked in"));
    expect(installSystemPrompt(brief({ mode: "install", locked }), [], { canTransfer: false })).toContain("- Mention the Rowville office");
  });

  it("are kept through storage and never trimmed for room", () => {
    expect(cleanNotes(JSON.parse(JSON.stringify(notes)))[1].locked).toBe(true);
    const many = [
      note("cn_lock00", "Locked first", true),
      ...Array.from({ length: MAX_NOTES + 3 }, (_, i) => note(`cn_n${String(i).padStart(5, "0")}`, `Note number ${i}`)),
    ];
    const kept = trimNotes(many);
    expect(kept).toHaveLength(MAX_NOTES);
    expect(kept[0].id).toBe("cn_lock00");
    expect(kept.at(-1)?.text).toBe(`Note number ${MAX_NOTES + 2}`);
  });

  it("are locked and unlocked by a person, up to a limit", () => {
    expect(setLocked(notes, "cn_aaaaaa", true, o)?.[0].locked).toBe(true);
    expect(setLocked(notes, "cn_bbbbbb", false, o)?.[1].locked).toBeUndefined();
    expect(setLocked(notes, "cn_nope00", true, o)).toBeNull();
    const full = Array.from({ length: MAX_LOCKED }, (_, i) => note(`cn_l${String(i).padStart(5, "0")}`, `Rule ${i} here`, true));
    expect(setLocked([...full, notes[0]], "cn_aaaaaa", true, o)).toBeNull();
    expect(lockRule(full, "One more rule", o).done).toBe(false);
  });

  it("are locked in by their words: a note that says it already, else a new one", () => {
    const had = lockRule(notes, "slow down when giving times", o);
    expect(had.done).toBe(true);
    expect(had.notes).toHaveLength(2);
    expect(had.notes[0].locked).toBe(true);
    const added = lockRule(notes, "Always say goodbye by name", o);
    expect(added.notes.at(-1)).toMatchObject({ id: "cn_cccccc", locked: true, from: "call" });
    expect(lockRule(notes, "  ", o)).toMatchObject({ done: false, text: null });
  });

  it("can be asked for in the chat, and the chat never rewords or removes one", () => {
    const answer = cleanCoachAnswer(
      {
        messages: ["Locked in."],
        add: ["Always confirm the suburb"],
        remove: ["cn_bbbbbb"],
        change: [{ id: "cn_bbbbbb", text: "Mention nothing" }],
        lock: ["cn_aaaaaa", "Always confirm the suburb", "cn_nope00"],
        rename: "",
        voice: "",
      },
      notes,
    )!;
    const got = applyCoaching(notes, answer, { ...o, from: "chat" });
    expect(got.notes.map((n) => [n.text, Boolean(n.locked)])).toEqual([
      ["Slow down when giving times", true],
      ["Mention the Rowville office", true],
      ["Always confirm the suburb", true],
    ]);
    expect(got.changes.removed).toEqual([]);
    expect(got.changes.changed).toEqual([]);
    expect(got.changes.locked).toEqual(["Slow down when giving times", "Always confirm the suburb"]);
    const prompt = coachPrompt({ assistant: "Charlie", business: "RENUABL", notes, history: [], message: "lock that in" });
    expect(prompt).toContain("[cn_bbbbbb] (locked rule) Mention the Rowville office");
    expect(prompt).toContain("put it in lock");
  });
});

describe("a natural delivery on a call", () => {
  it("adds how it sounds after the rules, and an easy opening that still says who and that it's automated", () => {
    const b = brief({ delivery: NATURAL_DELIVERY });
    const prompt = voiceSystemPrompt(b, [], { canTransfer: false });
    expect(prompt.indexOf("Rules you always keep")).toBeLessThan(prompt.indexOf("## How you sound"));
    const opening = openingBlock(b);
    expect(opening).toContain('"Hi, is that Jo?"');
    expect(opening).toContain("two short beats");
    expect(opening).toContain("that you're automated (always all three)");
    expect(opening).not.toContain("word for word");
    expect(openingBlock(brief())).toContain("word for word");
    expect(voiceSystemPrompt(brief(), [], { canTransfer: false })).not.toContain("How you sound");
  });

  it("sends Vapi a quick answer on every call, and ElevenLabs' quick model", () => {
    const base = { slots: [], serverUrl: "https://x.example/api", secret: "s".repeat(24), model: "m" };
    expect(assistantConfig({ ...base, brief: brief() })).toMatchObject({
      startSpeakingPlan: { waitSeconds: 0.2, smartEndpointingPlan: { provider: "livekit" } },
    });
    expect(assistantConfig({ ...base, brief: brief({ delivery: NATURAL_DELIVERY }) })).toMatchObject({
      startSpeakingPlan: { waitSeconds: 0.2 },
    });
    const eleven = assistantConfig({ ...base, brief: brief(), voice: { provider: "11labs", voiceId: "abc" } });
    expect(eleven).toMatchObject({ voice: { provider: "11labs", voiceId: "abc", model: "eleven_flash_v2_5" } });
    expect(assistantConfig({ ...base, brief: brief(), voice: { provider: "vapi", voiceId: "Elliot" } })).toMatchObject({
      voice: { provider: "vapi", voiceId: "Elliot" },
    });
    // If Vapi turns the call away as badly formed, it goes again with the pause alone.
    const plain = withoutSpeedSettings(eleven as unknown as Record<string, unknown>);
    expect(plain.startSpeakingPlan).toEqual({ waitSeconds: 0.2 });
    expect(plain.voice).toEqual({ provider: "11labs", voiceId: "abc" });
  });
});
