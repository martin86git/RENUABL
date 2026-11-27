import { describe, expect, it } from "vitest";
import { setPipelines } from "./deal";
import { cleanJobInput } from "./crm";
import { panelTabsFor, stagePill } from "./deal-feed";
import { pipelineBoard } from "./today-pad";
import { stageNamed } from "./sol";
import { actionDoneWords, stageChoicesText, type ChatAction } from "./sol-chat-work";
import { triggerWords } from "./custom-routines";
import {
  STAGE_NAME_TAKEN,
  baseAt,
  cleanOwnStageInput,
  cleanPipelineSave,
  cleanStageKeys,
  cleanStageNames,
  dealStageName,
  moveTexts,
  labelOf,
  renameBuiltin,
  columnOf,
  insertStage,
  moveStage,
  keyOfDeal,
  moveText,
  moveTo,
  pipelinesByStage,
  pipelinesFor,
  stageChoices,
  type KeptPipeline,
  type OwnStage,
} from "./pipeline-stages";

const visit: OwnStage = { id: "st_aaaaaaaa", name: "Site visit booked", base: "designed" };
const own = [visit];

describe("a business's own stages", () => {
  it("takes a name not already used and one of the twelve it counts as", () => {
    expect(cleanOwnStageInput({ name: "  Site   visit ", base: "designed" }, [])).toEqual({
      ok: true,
      value: { name: "Site visit", base: "designed" },
    });
    expect(cleanOwnStageInput({ name: "site visit booked", base: "lead" }, own)).toEqual({ ok: false, message: STAGE_NAME_TAKEN });
    expect(cleanOwnStageInput({ name: "Won", base: "lead" }, own)).toEqual({ ok: false, message: STAGE_NAME_TAKEN });
    expect(cleanOwnStageInput({ name: "X", base: "nope" }, own).ok).toBe(false);
  });

  it("counts a new stage as the one before it, else the first after", () => {
    expect(baseAt(["lead", "designed", "proposal"], 1, own)).toBe("designed");
    expect(baseAt(["lead", visit.id, "proposal"], 1, own)).toBe("designed");
    expect(baseAt(["proposal", "won"], -1, own)).toBe("proposal");
    expect(baseAt([], -1, own)).toBe("lead");
  });

  it("puts a stage in after a position", () => {
    expect(insertStage(["lead", "designed"], visit.id, 0)).toEqual(["lead", visit.id, "designed"]);
    expect(insertStage(["lead", "designed"], visit.id, -1)).toEqual([visit.id, "lead", "designed"]);
    expect(insertStage(["lead", "designed"], visit.id, 99)).toEqual(["lead", "designed", visit.id]);
  });

  it("moves a stage to another place in the run", () => {
    expect(moveStage(["lead", "designed", "proposal", "won"], 0, 2)).toEqual(["designed", "proposal", "lead", "won"]);
    expect(moveStage(["lead", "designed", "proposal", "won"], 3, 0)).toEqual(["won", "lead", "designed", "proposal"]);
    expect(moveStage(["lead", "designed"], 1, 9)).toEqual(["lead", "designed"]);
    expect(moveStage(["lead", "designed"], 5, 0)).toEqual(["lead", "designed"]);
  });

  it("keeps a pipeline's stages in the order sent, known ones only, each once", () => {
    expect(cleanStageKeys(["won", visit.id, "lead", "won", "st_bbbbbbbb", "nope"], own)).toEqual(["won", visit.id, "lead"]);
    expect(cleanPipelineSave({ name: "Mine", stages: [], baseId: "sales" }, own).ok).toBe(false);
    expect(cleanPipelineSave({ name: "Mine", stages: ["lead"], baseId: "sales" }, own)).toEqual({
      ok: true,
      value: { name: "Mine", stages: ["lead"], baseId: "sales" },
    });
    expect(cleanPipelineSave({ name: "Mine", stages: ["lead"], baseId: "pipe_x" }, own)).toMatchObject({ value: { baseId: null } });
  });
});

describe("pipelines", () => {
  const kept: KeptPipeline[] = [
    { id: "pipe_1", name: "Selling", stages: ["lead", visit.id, "designed", "proposal", "won"], baseId: "sales" },
    { id: "pipe_2", name: "Batteries", stages: ["lead", "won"], baseId: null },
    { id: "pipe_3", name: "Empty", stages: ["st_gone0000"], baseId: null },
  ];

  it("puts a renamed set pipeline in its place, then the business's own", () => {
    const all = pipelinesFor(kept, own);
    expect(all.map((p) => p.name)).toEqual(["Selling", "Post sale pipeline", "Post installation pipeline", "Lost", "Batteries"]);
    expect(all[0]).toMatchObject({ id: "sales", rowId: "pipe_1", set: true, changed: true });
    expect(all[1]).toMatchObject({ rowId: null, changed: false });
  });

  it("reads as runs of the twelve for the feed", () => {
    expect(pipelinesByStage(kept, own)[0].stages).toEqual(["lead", "designed", "proposal", "won"]);
  });

  it("hands a deal won on from Sales to Post sale, unless the business keeps Won in Sales", () => {
    // As it comes: Sales ends at Proposal sent, and a deal won goes to Post sale.
    const asItComes = pipelinesFor([], own);
    expect(asItComes[0].stages).toEqual(["lead", "designed", "proposal"]);
    expect(asItComes[0].next).toEqual({ at: "won", to: "post-sale" });
    expect(asItComes[1].next).toBeUndefined();
    expect(pipelinesByStage([], own)[0].stages).toEqual(["lead", "designed", "proposal"]);
    // Switched off in Settings: Won is Sales' last column again, and nothing is handed on.
    const off = pipelinesFor([], own, setPipelines(false));
    expect(off[0].stages).toEqual(["lead", "designed", "proposal", "won"]);
    expect(off[0].next).toBeUndefined();
    // A Sales pipeline the business changed keeps its stages: with Won in it, nothing is handed on.
    expect(pipelinesFor(kept, own)[0].next).toBeUndefined();
    // With Won taken off it by hand, a deal won is handed on while the switch is on, and not while it is off.
    const noWon: KeptPipeline[] = [{ id: "pipe_9", name: "Selling", stages: ["lead", "proposal"], baseId: "sales" }];
    expect(pipelinesFor(noWon, own)[0].next).toEqual({ at: "won", to: "post-sale" });
    expect(pipelinesFor(noWon, own, setPipelines(false))[0].next).toBeUndefined();
    // A stage the business added that counts as Won keeps won deals in view too.
    const wonSub = { id: "st_bbbbbbbb", name: "Deposit paid", base: "won" as const };
    const withSub: KeptPipeline[] = [{ id: "pipe_8", name: "Selling", stages: ["lead", wonSub.id], baseId: "sales" }];
    expect(pipelinesFor(withSub, [...own, wonSub])[0].next).toBeUndefined();
  });
});

describe("deals at an added stage", () => {
  const atVisit = { stage: "designed" as const, subStage: visit.id };

  it("sit in the added stage's column, else their base stage's", () => {
    expect(keyOfDeal(atVisit, own)).toBe(visit.id);
    expect(columnOf(atVisit, ["lead", visit.id, "designed"], own)).toBe(visit.id);
    expect(columnOf(atVisit, ["lead", "designed"], own)).toBe("designed");
    expect(columnOf(atVisit, ["won"], own)).toBeNull();
    // An added stage that no longer counts as the deal's stage is ignored.
    expect(keyOfDeal({ stage: "won", subStage: visit.id }, own)).toBe("won");
  });

  it("are saved at the stage it counts as", () => {
    expect(moveTo(visit.id, own)).toEqual({ stage: "designed", subStage: visit.id });
    expect(moveTo("won", own)).toEqual({ stage: "won", subStage: null });
    expect(moveTo("st_unknown0", own)).toBeNull();
    expect(moveText("designed", visit.id, own)).toBe("Moved to Site visit booked");
    expect(
      stageChoices(own)
        .map((c) => c.key)
        .slice(0, 3),
    ).toEqual(["lead", "designed", visit.id]);
  });

  it("are checked on the server: an added stage sets the stage it counts as", () => {
    const start = {
      title: "Solar",
      address: "",
      lat: null,
      lng: null,
      stage: "lead" as const,
      value: null,
      installDate: null,
      details: {},
    };
    expect(cleanJobInput({ stage: "won", subStage: visit.id }, start, undefined, own)).toMatchObject({
      value: { stage: "designed", subStage: visit.id },
    });
    expect(cleanJobInput({ subStage: "st_unknown0" }, start, undefined, own).ok).toBe(false);
    const there = { ...start, stage: "designed" as const, subStage: visit.id };
    // Moved to another of the twelve: off the added stage. The same stage sent alone keeps it.
    expect(cleanJobInput({ stage: "proposal" }, there)).toMatchObject({ value: { stage: "proposal", subStage: null } });
    expect(cleanJobInput({ stage: "designed" }, there)).toMatchObject({ value: { subStage: visit.id } });
    expect(cleanJobInput({ stage: "designed", subStage: null }, there)).toMatchObject({ value: { subStage: null } });
  });
});

describe("the business's names for the twelve", () => {
  it("shows its name, else ours, everywhere a stage is named", () => {
    const names = { designed: "Site visit done" } as const;
    expect(labelOf("designed", names)).toBe("Site visit done");
    expect(labelOf("lead", names)).toBe("Lead");
    expect(stageChoices(own, names).find((c) => c.key === "designed")?.name).toBe("Site visit done");
    expect(moveText("designed", null, own, names)).toBe("Moved to Site visit done");
    // Its name is taken: another stage can't use it, and ours is free again.
    expect(cleanOwnStageInput({ name: "site visit done", base: "lead" }, own, names)).toEqual({ ok: false, message: STAGE_NAME_TAKEN });
    expect(cleanOwnStageInput({ name: "Designed", base: "lead" }, own, names).ok).toBe(true);
  });

  it("renames one, refuses a name in use, and puts ours back with a blank", () => {
    expect(renameBuiltin("lead", "  New enquiry ", own, {})).toEqual({ ok: true, value: { lead: "New enquiry" } });
    expect(renameBuiltin("lead", "Site visit booked", own, {})).toEqual({ ok: false, message: STAGE_NAME_TAKEN });
    expect(renameBuiltin("lead", "Won", own, {})).toEqual({ ok: false, message: STAGE_NAME_TAKEN });
    // Its own name, in another case, is its to keep.
    expect(renameBuiltin("lead", "LEAD", own, {})).toEqual({ ok: true, value: { lead: "LEAD" } });
    expect(renameBuiltin("lead", "", own, { lead: "New enquiry" })).toEqual({ ok: true, value: {} });
    expect(renameBuiltin("nope", "X", own, {}).ok).toBe(false);
  });

  it("reads back only the twelve, and none the same as ours", () => {
    expect(cleanStageNames({ lead: "Lead", won: " Sold ", bogus: "x", designed: "" })).toEqual({ won: "Sold" });
  });
});

describe("the business's names, everywhere a stage is named", () => {
  const names = { proposal: "Quote sent", won: "Signed" } as const;

  it("reads a deal at an added stage by that stage, else by the business's name", () => {
    expect(dealStageName({ stage: "designed", subStage: visit.id }, own, names)).toBe("Site visit booked");
    expect(dealStageName({ stage: "proposal" }, own, names)).toBe("Quote sent");
    expect(dealStageName({ stage: "lead" }, own, names)).toBe("Lead");
  });

  it("finds a move on the record whatever the stage was called", () => {
    expect(moveTexts("designed", own, names).sort()).toEqual(["Moved to Designed", "Moved to Site visit booked"]);
    expect(moveTexts("proposal", own, names).sort()).toEqual(["Moved to Proposal sent", "Moved to Quote sent"]);
  });

  it("puts the business's name on Today's pills, toggles and board, and in Sol's facts and words", () => {
    expect(stagePill("won", names).words).toBe("Signed");
    expect(stagePill("lead", names).words).toBe("New lead");
    expect(panelTabsFor(["won", "ordered"], names).map((t) => t.label)).toEqual(["Signed", "Ordered", "All"]);
    expect(pipelineBoard([], 6, names).map((b) => b.label)).toEqual(["Lead", "Designed", "Quote sent", "Signed"]);
    expect(stageNamed("quote sent", names)).toBe("proposal");
    expect(stageNamed("proposal sent", names)).toBe("proposal");
    expect(stageChoicesText(names)).toContain("proposal: Quote sent");
    expect(actionDoneWords({ kind: "stage", stage: "won" } as ChatAction, names)).toBe("Marked Signed");
    expect(triggerWords({ kind: "stage", stage: "proposal" }, names)).toBe("A deal reaches Quote sent");
  });
});
