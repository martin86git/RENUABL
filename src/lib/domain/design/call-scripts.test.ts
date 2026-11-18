import { describe, expect, it } from "vitest";
import type { CoachNote } from "./coaching";
import {
  DEFAULT_SCRIPT_NAME,
  MAX_SCRIPTS,
  SCRIPT_PROBLEMS,
  cleanScriptName,
  cleanScripts,
  forgetScript,
  liveName,
  namedForColdCalls,
  renameScript,
  scriptLines,
  scriptWords,
  startScript,
  chooseScript,
  type LiveScript,
  type SavedScript,
} from "./call-scripts";

const note = (id: string, text: string, locked = false): CoachNote => ({
  id: `cn_${id}00000`,
  text,
  at: "2026-11-18T00:00:00.000Z",
  by: "sam@x.example",
  from: "chat",
  ...(locked ? { locked: true } : {}),
});
const live: LiveScript = {
  name: DEFAULT_SCRIPT_NAME,
  notes: [note("n1", "Keep it short."), note("n2", "Never talk price.", true)],
  setup: { saidAs: "Shar-lee", audience: "enquired", reason: "" },
};
const at = "2026-11-18T01:00:00.000Z";

describe("a voice agent's scripts", () => {
  it("names a script in one plain line", () => {
    expect(cleanScriptName("  Cold   calls <b> ")).toBe("Cold calls b");
    expect(cleanScriptName("")).toBeNull();
    expect(cleanScriptName(7)).toBeNull();
    expect(liveName(null)).toBe(DEFAULT_SCRIPT_NAME);
  });

  it("starts a blank script in use and files the one in use away whole", () => {
    const r = startScript(live, [], { name: "Cold calls", copy: false, fileId: "sc_00000001", at });
    if (!r.ok) throw new Error(r.message);
    expect(r.live).toEqual({ name: "Cold calls", notes: [], setup: { saidAs: "Shar-lee", audience: "enquired", reason: "" } });
    expect(r.saved).toEqual([{ id: "sc_00000001", name: DEFAULT_SCRIPT_NAME, notes: live.notes, audience: "enquired", reason: "", at }]);
  });

  it("starts a blank script ringing who it was made for", () => {
    const r = startScript(live, [], { name: "Cold calls", copy: false, audience: "cold", fileId: "sc_00000001", at });
    expect(r.ok && r.live.setup).toEqual({ saidAs: "Shar-lee", audience: "cold", reason: "" });
    const odd = startScript(live, [], { name: "Other", copy: false, audience: "nonsense", fileId: "sc_00000001", at });
    expect(odd.ok && odd.live.setup.audience).toBe("enquired");
    expect(namedForColdCalls("Cold Calls")).toBe(true);
    expect(namedForColdCalls("Scolding")).toBe(false);
  });

  it("copies the one in use, locked rules and all", () => {
    const r = startScript(live, [], { name: "Battery offer", copy: true, fileId: "sc_00000001", at });
    if (!r.ok) throw new Error(r.message);
    expect(r.live.notes).toEqual(live.notes);
    expect(r.live.setup).toEqual(live.setup);
  });

  it("refuses no name, a name already there and one script too many", () => {
    expect(startScript(live, [], { name: " ", copy: false, fileId: "sc_00000001", at })).toEqual({
      ok: false,
      message: SCRIPT_PROBLEMS.name,
    });
    expect(startScript(live, [], { name: "main SCRIPT", copy: false, fileId: "sc_00000001", at })).toEqual({
      ok: false,
      message: SCRIPT_PROBLEMS.taken,
    });
    const many: SavedScript[] = Array.from({ length: MAX_SCRIPTS - 1 }, (_, i) => ({
      id: `sc_${String(i).padStart(8, "0")}`,
      name: `Script ${i}`,
      notes: [],
      audience: "enquired",
      reason: "",
      at,
    }));
    expect(startScript(live, many, { name: "One more", copy: false, fileId: "sc_ffffffff", at })).toEqual({
      ok: false,
      message: SCRIPT_PROBLEMS.full,
    });
  });

  it("swaps to a chosen script and back without losing a line, the name's said form staying", () => {
    const cold: SavedScript = {
      id: "sc_0000000a",
      name: "Cold calls",
      notes: [note("c1", "Ask before anything else.")],
      audience: "cold",
      reason: "about batteries",
      at,
    };
    const there = chooseScript(live, [cold], "sc_0000000a", { fileId: "sc_0000000b", at });
    if (!there.ok) throw new Error(there.message);
    expect(there.live).toEqual({
      name: "Cold calls",
      notes: cold.notes,
      setup: { saidAs: "Shar-lee", audience: "cold", reason: "about batteries" },
    });
    expect(there.saved.map((s) => s.name)).toEqual([DEFAULT_SCRIPT_NAME]);
    const back = chooseScript(there.live, there.saved, "sc_0000000b", { fileId: "sc_0000000c", at });
    if (!back.ok) throw new Error(back.message);
    expect(back.live).toEqual(live);
    expect(back.saved[0]).toMatchObject({ name: "Cold calls", notes: cold.notes, audience: "cold", reason: "about batteries" });
    expect(chooseScript(live, [cold], "sc_nothere00", { fileId: "sc_0000000b", at })).toEqual({ ok: false, message: SCRIPT_PROBLEMS.gone });
  });

  it("renames the one in use or a filed one, never to a name in use", () => {
    const saved: SavedScript[] = [{ id: "sc_0000000a", name: "Cold calls", notes: [], audience: "cold", reason: "", at }];
    const a = renameScript(live, saved, null, "Enquiries");
    expect(a.ok && a.live.name).toBe("Enquiries");
    const b = renameScript(live, saved, "sc_0000000a", "Door knock follow-up");
    expect(b.ok && b.saved[0].name).toBe("Door knock follow-up");
    expect(renameScript(live, saved, null, "cold calls")).toEqual({ ok: false, message: SCRIPT_PROBLEMS.taken });
    expect(renameScript(live, saved, "sc_0000000a", "Cold Calls").ok).toBe(true);
    expect(renameScript(live, saved, "nonsense", "X")).toEqual({ ok: false, message: SCRIPT_PROBLEMS.gone });
  });

  it("removes only a filed script", () => {
    const saved: SavedScript[] = [{ id: "sc_0000000a", name: "Cold calls", notes: [], audience: "cold", reason: "", at }];
    const r = forgetScript(live, saved, "sc_0000000a");
    expect(r.ok && r.saved).toEqual([]);
    expect(forgetScript(live, saved, null)).toEqual({ ok: false, message: SCRIPT_PROBLEMS.gone });
  });

  it("reads only whole scripts back, and lists the one in use first", () => {
    const read = cleanScripts([
      { id: "sc_0000000a", name: "Cold calls", notes: [note("c1", "Ask first.")], audience: "cold", reason: "your roof", at },
      { id: "bad", name: "X" },
      { id: "sc_0000000a", name: "Twice" },
      { id: "sc_0000000b", name: "" },
      "junk",
    ]);
    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({ audience: "cold", reason: "about your roof" });
    const lines = scriptLines(live, read);
    expect(lines.map((l) => [l.id, l.name])).toEqual([
      [null, DEFAULT_SCRIPT_NAME],
      ["sc_0000000a", "Cold calls"],
    ]);
    expect(scriptWords(lines[0])).toBe("2 lines · 1 locked");
    expect(scriptWords(lines[1])).toBe("1 line · cold calls");
    expect(scriptWords({ ...lines[1], lines: 0 }, false)).toBe("Empty");
  });
});
