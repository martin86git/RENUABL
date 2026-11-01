/**
 * Ready to install (1 Nov 2026, Martin: "a light that only goes green when the design would pass"): every check a
 * design must clear before it goes to site, read from the design and its quote, each with what to fix in one line.
 * Pure, tested in `readiness.test.ts`. A guide for the business, never a site inspection or the installer's own check.
 */

export type ReadinessState = "pass" | "fix" | "check";

export interface ReadinessItem {
  id: "panels" | "inverter" | "strings" | "unstrung" | "ratio" | "edges" | "pitch" | "costs" | "priced" | "solarVic" | "export";
  state: ReadinessState;
  /** What it is, in a few words. */
  label: string;
  /** What to do about it, in one line (or why it passes). */
  words: string;
  /** Where in the designer it is put right. */
  goTo?: "strings" | "quote" | "kit" | "trace" | "pitch";
}

export interface ReadinessInput {
  panels: number;
  /** Inverters chosen on the design. */
  inverters: number;
  /** Each string's check verdict, in order. */
  strings: readonly ("good" | "caution" | "bad" | "unknown")[];
  /** Panels on the roof on no string. */
  unstrung: number;
  /** The panels as a share of the inverters' rating, and the limit that applies. */
  ratio: { percent: number; limit: number; over: boolean } | null;
  /** Panels closer to a traced face's edge than the wind clearance; null when no face is traced to check against. */
  tooClose: number | null;
  pitchSet: boolean;
  /** Costs decided on each job, still undecided (their names). */
  undecided: readonly string[];
  /** Quote lines with no cost on file. */
  missing: number;
  /** The Solar Victoria rebate is on the quote, and why it can't apply, when it can't. */
  solarVic: { on: boolean; bar: string | null };
  phase: "single" | "three";
  /** The inverters' total rating, kW. */
  inverterKw: number;
}

/** A single-phase connection's usual export limit without the distributor's approval, kW (VERIFY with each network). */
export const SINGLE_PHASE_EXPORT_KW = 5;

const letter = (i: number) => String.fromCharCode(65 + i);

/** Every check, in the order they are put right: what is on the roof, how it is wired, what it costs, what it needs. */
export function readiness(input: ReadinessInput): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const add = (item: ReadinessItem) => items.push(item);
  if (input.panels === 0) {
    add({ id: "panels", state: "fix", label: "Panels", words: "Put panels on the roof.", goTo: "trace" });
    return items;
  }
  add({ id: "panels", state: "pass", label: "Panels", words: `${input.panels} on the roof.` });
  add(
    input.inverters
      ? { id: "inverter", state: "pass", label: "Inverter", words: "Chosen." }
      : { id: "inverter", state: "fix", label: "Inverter", words: "Choose an inverter for these panels.", goTo: "kit" },
  );
  if (input.ratio)
    add(
      input.ratio.over
        ? {
            id: "ratio",
            state: "fix",
            label: "Panels to inverter",
            words: `The panels are ${input.ratio.percent}% of the inverter, over the ${input.ratio.limit}% limit: a larger inverter, fewer panels or a battery.`,
            goTo: "kit",
          }
        : { id: "ratio", state: "pass", label: "Panels to inverter", words: `${input.ratio.percent}% of the inverter.` },
    );
  if (!input.strings.length)
    add({ id: "strings", state: "fix", label: "Strings", words: "String the panels (String automatically does it).", goTo: "strings" });
  else {
    const bad = input.strings.flatMap((v, i) => (v === "bad" ? [letter(i)] : []));
    const unsure = input.strings.flatMap((v, i) => (v === "unknown" || v === "caution" ? [letter(i)] : []));
    if (bad.length)
      add({
        id: "strings",
        state: "fix",
        label: "Strings",
        words: `String ${bad.join(", ")} ${bad.length === 1 ? "fails" : "fail"} the inverter's limits: open the check beside ${bad.length === 1 ? "it" : "each"}.`,
        goTo: "strings",
      });
    else if (unsure.length)
      add({
        id: "strings",
        state: "check",
        label: "Strings",
        words: `String ${unsure.join(", ")} can't be fully checked (limits not on file, or close to them): check against the datasheet.`,
        goTo: "strings",
      });
    else
      add({
        id: "strings",
        state: "pass",
        label: "Strings",
        words: "Every string is inside the inverter's limits, coldest morning included.",
      });
  }
  if (input.unstrung > 0)
    add({
      id: "unstrung",
      state: "fix",
      label: "Unstrung panels",
      words: `${input.unstrung} ${input.unstrung === 1 ? "panel isn't" : "panels aren't"} on a string.`,
      goTo: "strings",
    });
  add(
    input.tooClose === null
      ? {
          id: "edges",
          state: "check",
          label: "Roof edges",
          words: "Trace the roof faces to check the panels are clear of the edges for wind.",
          goTo: "trace",
        }
      : input.tooClose > 0
        ? {
            id: "edges",
            state: "fix",
            label: "Roof edges",
            words: `${input.tooClose} ${input.tooClose === 1 ? "panel is" : "panels are"} closer to the roof's edge than the wind clearance.`,
          }
        : { id: "edges", state: "pass", label: "Roof edges", words: "Every panel is clear of the edges for wind." },
  );
  add(
    input.pitchSet
      ? { id: "pitch", state: "pass", label: "Roof pitch", words: "Set." }
      : { id: "pitch", state: "fix", label: "Roof pitch", words: "Set the roof's pitch (or that it is flat).", goTo: "pitch" },
  );
  if (input.missing)
    add({
      id: "priced",
      state: "fix",
      label: "Quote",
      words: `${input.missing} ${input.missing === 1 ? "line has" : "lines have"} no cost on file.`,
      goTo: "quote",
    });
  add(
    input.undecided.length
      ? {
          id: "costs",
          state: "fix",
          label: "Decided on each job",
          words: `Include or leave out: ${input.undecided.join(", ").toLowerCase()}.`,
          goTo: "quote",
        }
      : { id: "costs", state: "pass", label: "Decided on each job", words: "Each one decided." },
  );
  if (input.solarVic.on && input.solarVic.bar)
    add({ id: "solarVic", state: "fix", label: "Solar Victoria", words: `The rebate is on, but: ${input.solarVic.bar}`, goTo: "quote" });
  if (input.phase === "single" && input.inverterKw > SINGLE_PHASE_EXPORT_KW)
    add({
      id: "export",
      state: "check",
      label: "Export limit",
      words: `${input.inverterKw} kW of inverter on single phase: the distributor's pre-approval or export limiting is needed above ${SINGLE_PHASE_EXPORT_KW} kW. Check the network's rule from the NMI.`,
    });
  return items;
}

/** The light: green when nothing needs fixing, with how many are worth a check. */
export function readinessLight(items: readonly ReadinessItem[]): { ready: boolean; fix: number; check: number } {
  return {
    ready: items.length > 0 && !items.some((i) => i.state === "fix"),
    fix: items.filter((i) => i.state === "fix").length,
    check: items.filter((i) => i.state === "check").length,
  };
}
