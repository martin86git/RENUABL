import { describe, expect, it } from "vitest";
import type { AsBuilt } from "./as-built";
import { cleanJobDetails } from "./crm";
import { afterStepDone, gridStateOf } from "./deal";
import { typedFields } from "./deal-sections";
import {
  asBuiltFacts,
  cleanGridChange,
  cleanGridSuggestion,
  gridConnectionView,
  gridNote,
  gridRecordLine,
  withGridChange,
} from "./grid-connection";
import { preApprovalView } from "./preapproval";
import { cleanTurns } from "./sol";

const built: AsBuilt = {
  installedOn: "2026-11-20",
  panels: { model: "Jinko 475", count: 14 },
  panelSerials: [],
  inverters: [{ model: "Sungrow SG5.0RS", serial: "A2301234567" }],
  battery: { model: "SigenStor", modules: 2, serials: ["B1", "B2"] },
  notes: "",
  by: "sam@example.com",
  at: "2026-11-20T04:00:00.000Z",
};

const view = (typed: Record<string, string>, opts: { stage?: "installed" | "coes"; built?: AsBuilt | null } = {}) =>
  gridConnectionView({
    pre: preApprovalView({
      jobId: "job_1",
      customer: "Sam Sample",
      address: "8 Example Court, Glen Waverley VIC 3150",
      kw: 6.65,
      typed,
      details: { ...typed, inverter: "Sungrow SG5.0RS", phases: "Single phase" },
    }),
    typed,
    stage: opts.stage ?? "installed",
    installedOn: "2026-11-20",
    built: opts.built === undefined ? built : opts.built,
  });

describe("a deal's grid connection card", () => {
  it("lists the as-built's serials and the pre-approval's outcome to copy across", () => {
    const v = view({ nmi: "63051234567", retailer: "Origin", meterNo: "M1", coes: "received", preApprovalRef: "PA-77", exportLimit: "5" });
    const labels = v.facts.map((f) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining(["NMI", "Pre-approval reference", "Export limit", "Installed on", "Inverter serial", "Battery serials"]),
    );
    expect(v.facts.find((f) => f.label === "Inverter serial")?.value).toBe("A2301234567 (Sungrow SG5.0RS)");
    expect(v.missing).toEqual({ fields: [], other: [] });
    expect(v).toMatchObject({ inspected: true, state: "to-raise", words: "To raise", retailer: "Origin" });
    expect(v.network).toEqual({ name: "AusNet Services", guessed: false });
  });

  it("says what is still missing: the fields, the inspection and the serials", () => {
    const v = view({}, { built: null });
    expect(v.missing.fields).toEqual(["nmi", "meterNo", "retailer"]);
    expect(v.missing.other.join(" ")).toContain("certificate of electrical safety");
    expect(v.missing.other.join(" ")).toContain("serial");
    expect(v.inspected).toBe(false);
    // The deal's stage also says the inspection is done.
    expect(view({}, { stage: "coes" }).inspected).toBe(true);
  });

  it("numbers the serials of two inverters", () => {
    const two = asBuiltFacts({ ...built, inverters: [...built.inverters, { model: "", serial: "Z9" }], battery: null }, null);
    expect(two.map((f) => f.label)).toEqual(["Installed on", "Inverter 1 serial", "Inverter 2 serial"]);
  });
});

describe("a change to it", () => {
  it("is checked", () => {
    expect(cleanGridChange({ nmi: "123" })).toMatchObject({ ok: false });
    expect(cleanGridChange({ state: "sorted" })).toMatchObject({ ok: false });
    expect(cleanGridChange({})).toMatchObject({ ok: false });
    expect(cleanGridChange({ state: "raised", reference: " EWR-9\n", stage: "won" })).toEqual({
      ok: true,
      change: { state: "raised", reference: "EWR-9" },
    });
  });

  it("lands on the deal's own fields, survives the deal's cleaning, and counts as the after-install step", () => {
    const raised = withGridChange({ coes: "received" }, { state: "raised", reference: "EWR-9", retailer: "Origin" });
    expect(raised).toMatchObject({ gridConnection: "underway", gridConnectionRef: "EWR-9", retailer: "Origin" });
    const kept = cleanJobDetails(raised, typedFields(null));
    expect(kept).toMatchObject({ gridConnection: "underway", gridConnectionRef: "EWR-9" });
    expect(gridStateOf({ details: kept })).toBe("raised");
    expect(afterStepDone({ details: kept, stage: "installed" }, "grid")).toBe(true);
    expect(gridStateOf({ details: withGridChange(kept, { state: "connected" }) })).toBe("connected");
  });

  it("is written on the deal's record in words", () => {
    expect(gridRecordLine({ state: "raised", reference: "EWR-9" }, { network: "AusNet Services", retailer: "Origin" })).toBe(
      "Grid connection raised with AusNet Services and Origin · reference EWR-9.",
    );
    expect(gridRecordLine({ state: "connected" }, { network: null, retailer: "" })).toBe(
      "Grid connection completed: the system is connected.",
    );
    expect(gridRecordLine({ meterNo: "M1" }, { network: null, retailer: "" })).toBe("Filled in for the grid connection: Meter number M1.");
  });
});

describe("Sol and the grid connection", () => {
  it("is told what is on the card, never to promise a date", () => {
    const note = gridNote(view({}, { built: null }), { state: "raised" });
    expect(note).toContain("Still needed");
    expect(note).toContain("saved when they press Save");
    expect(note).toContain("never say when it will be connected");
  });

  it("keeps what he proposes only on a connection card", () => {
    expect(cleanGridSuggestion({ nmi: "nope", state: "raised", reference: "EWR-9" })).toEqual({ state: "raised", reference: "EWR-9" });
    expect(cleanGridSuggestion({ nmi: "nope" })).toBeNull();
    const at = new Date().toISOString();
    const connect = { state: "raised", reference: "EWR-9" };
    const turns = cleanTurns([
      {
        role: "sol",
        text: "a",
        at,
        portal: { network: "ausnet", jobId: "job_1", kind: "connection", facts: [], connect, suggest: { status: "Submitted" } },
      },
      { role: "sol", text: "b", at, portal: { network: "ausnet", jobId: "job_1", facts: [], connect } },
      { role: "sol", text: "c", at, portal: { network: "ausnet", kind: "connection", facts: [] } },
    ]);
    expect(turns[0].portal).toMatchObject({ kind: "connection", connect });
    expect(turns[0].portal?.suggest).toBeUndefined();
    expect(turns[1].portal?.connect).toBeUndefined();
    expect(turns[2].portal?.kind).toBeUndefined();
  });
});
