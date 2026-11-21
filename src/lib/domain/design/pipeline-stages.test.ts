import { describe, expect, it } from "vitest";
import { cleanJobInput } from "./crm";
import {
  STAGE_NAME_TAKEN,
  baseAt,
  cleanOwnStageInput,
  cleanPipelineSave,
  cleanStageKeys,
  columnOf,
  insertStage,
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
