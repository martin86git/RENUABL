/**
 * Whether a string of panels suits the inverter input it is wired to, for the roof designer.
 * Pure, tested.
 *
 * A price list gives a product's code, name and price, never its electrical
 * details, so those are kept here by product code, **from datasheets and
 * distributors' listings: every figure is a VERIFY item**, and each says where
 * it came from so it can be checked. Sungrow sells more than one generation
 * under one model name with different current limits (an SH10RT and an
 * SH10RT-20 are not the same input), so the generation matters. A panel or
 * inverter that isn't here is never passed: the check says it can't be made.
 *
 * The method is the usual one. A panel's voltage rises as it gets colder and
 * falls as it gets hotter, so a string is tested at both ends:
 *  - coldest morning, nothing connected (open circuit): the highest voltage it
 *    can reach must stay under the inverter's maximum;
 *  - hottest afternoon, working: its voltage must stay above the bottom of the
 *    inverter's tracking range, and it must still be able to start it;
 *  - the current of the strings sharing an input must stay under what that
 *    input can take, and their short-circuit current under its limit.
 * It is a design aid, not a substitute for the installer's own design check to
 * AS/NZS 5033 and the maker's sizing tool.
 */

export interface PanelElectrical {
  /** Open-circuit voltage, volts, at standard test conditions (25 °C cell). */
  voc: number;
  /** Voltage at maximum power. */
  vmp: number;
  /** Short-circuit current, amps. */
  isc: number;
  /** Current at maximum power. */
  imp: number;
  /** Change in Voc for each degree, as a share: -0.0024 is -0.24% a degree. */
  vocPerC: number;
  iscPerC: number;
  /** Change in power for each degree: also used for the working voltage, the usual and cautious choice. */
  pmaxPerC: number;
  /** Where the figures are from. */
  basis: string;
}

/** One tracker input of an inverter. */
export interface MpptInput {
  /** The most working current it uses, amps: more is not harmful, but is clipped. */
  maxCurrent: number;
  /** The most short-circuit current it may be connected to. */
  maxShortCircuit: number;
  /** How many strings it has connectors for. */
  strings: number;
}

export interface InverterElectrical {
  /** The highest voltage it may ever see at its PV input. */
  maxVoltage: number;
  /** The tracking range. */
  mppMin: number;
  mppMax: number;
  /** The voltage it needs to start. */
  startVoltage: number;
  mppts: MpptInput[];
  basis: string;
}

const inputs = (...list: [number, number, number][]): MpptInput[] =>
  list.map(([maxCurrent, maxShortCircuit, strings]) => ({ maxCurrent, maxShortCircuit, strings }));

/** By the product codes on the supplier's price list. VERIFY every line against the maker's datasheet. */
export const PANEL_ELECTRICAL: Record<string, PanelElectrical> = {
  "JKM475N-48QL6-DV": {
    voc: 36.42,
    vmp: 31.11,
    isc: 15.86,
    imp: 15.27,
    vocPerC: -0.0024,
    iscPerC: 0.00046,
    pmaxPerC: -0.0026,
    basis: "Jinko Tiger Neo 48QL6-DV 475 W, as listed by distributors",
  },
};

const RS_600V = { maxVoltage: 600, mppMin: 40, mppMax: 560 };
const SH_RS_2 = { ...RS_600V, startVoltage: 40, mppts: inputs([16, 20, 1], [16, 20, 1]), basis: "Sungrow SH3.0-6.0RS datasheet" };
const SH_RS_4 = {
  ...RS_600V,
  startVoltage: 40,
  mppts: inputs([16, 20, 1], [16, 20, 1], [16, 20, 1], [16, 20, 1]),
  basis: "Sungrow SH8.0/10RS, as listed by distributors",
};
const SH_T_3 = {
  maxVoltage: 1000,
  mppMin: 150,
  mppMax: 950,
  startVoltage: 180,
  mppts: inputs([32, 40, 2], [32, 40, 2], [16, 20, 1]),
  basis: "Sungrow SH15/20/25T datasheet V3",
};

export const INVERTER_ELECTRICAL: Record<string, InverterElectrical> = {
  "SGWSG5.0RS": {
    ...RS_600V,
    startVoltage: 50,
    mppts: inputs([16, 20, 1], [16, 20, 1]),
    basis: "Sungrow SG5.0RS (2 MPPT), as listed by distributors",
  },
  "SGWSH5.0RS-ADA": SH_RS_2,
  "SGWSH6.0RS-ADA": SH_RS_2,
  "SGWSH8.0RS-ADA": SH_RS_4,
  "SGWSH10RS-ADA": SH_RS_4,
  "SGWSH5.0RT": {
    maxVoltage: 1000,
    mppMin: 150,
    mppMax: 950,
    startVoltage: 180,
    mppts: inputs([13.5, 18, 1], [13.5, 18, 1]),
    basis: "Sungrow SH5.0RT-20 datasheet V22 (the earlier SH5.0RT takes 12.5 A an input)",
  },
  "SGWSH10.0RT": {
    maxVoltage: 1000,
    mppMin: 200,
    mppMax: 950,
    startVoltage: 250,
    mppts: inputs([13.5, 18, 1], [27, 36, 2]),
    basis: "Sungrow SH10RT-20 datasheet V22 (the earlier SH10RT takes 12.5 A a string)",
  },
  SGWSH15T: SH_T_3,
  SGWSH20RT: SH_T_3,
  SGWSH25T: SH_T_3,
};

/**
 * The temperatures a string is tested at, for Melbourne: the coldest morning on record, and the hottest day on
 * record with the panels running hotter than the air on a roof. VERIFY the allowance.
 */
export const DESIGN_TEMPERATURES = { cold: -3, hotAir: 46, roofRise: 30 } as const;
export const HOT_CELL = DESIGN_TEMPERATURES.hotAir + DESIGN_TEMPERATURES.roofRise;

export interface CheckLine {
  what: string;
  /** What the string comes to. */
  value: string;
  /** What the inverter allows, when it is known. */
  limit: string;
  /** true: within it. false: outside it. null: allowed, but worth knowing. undefined: can't be judged. */
  ok?: boolean | null;
}

export interface StringCheck {
  verdict: "good" | "caution" | "bad" | "unknown";
  /** The verdict in a sentence. */
  words: string;
  lines: CheckLine[];
  /** Where the figures used are from. */
  basis: string[];
  /** The string's highest voltage (Voc on the coldest morning), when the panel's details are on file: the figure to hold against an inverter's maximum. */
  coldVoc?: number;
}

const volts = (v: number) => `${v.toFixed(0)} V`;
const amps = (a: number) => `${a.toFixed(1)} A`;
/** A line's name in the middle of a sentence: only its first letter drops (the C of °C stays). */
const inWords = (what: string) => what.charAt(0).toLowerCase() + what.slice(1);

export function checkString(input: {
  /** Panels in the string. */
  panels: number;
  panel?: PanelElectrical;
  inverter?: InverterElectrical;
  /** Which of the inverter's inputs the string is on, counting from 0. */
  mppt: number;
  /** How many strings are on that input, this one included. */
  sharing: number;
  /** Its panels don't all face the same way at the same tilt. */
  mixed?: boolean;
  /** An inverter is chosen for the string, whether or not its limits are on file: it changes what is said when they aren't. */
  inverterChosen?: boolean;
  /** The panel's name, to say which panel isn't on file. */
  panelName?: string;
}): StringCheck {
  const { panels, panel, inverter } = input;
  if (!panel)
    return {
      verdict: "unknown",
      words: `${input.panelName ? `The ${input.panelName}'s` : "This panel's"} electrical details (Voc, Vmp, Isc) aren't on file, so the string's voltage can't be worked out here. Check it against the datasheet.`,
      lines: [],
      basis: [],
    };
  const at = (cell: number, perC: number) => 1 + perC * (cell - 25);
  const coldVoc = panels * panel.voc * at(DESIGN_TEMPERATURES.cold, panel.vocPerC);
  const hotVoc = panels * panel.voc * at(HOT_CELL, panel.vocPerC);
  const coldVmp = panels * panel.vmp * at(DESIGN_TEMPERATURES.cold, panel.pmaxPerC);
  const hotVmp = panels * panel.vmp * at(HOT_CELL, panel.pmaxPerC);
  const sharing = Math.max(1, input.sharing);
  const hotIsc = sharing * panel.isc * at(HOT_CELL, panel.iscPerC);
  const working = sharing * panel.imp;
  const tracker = inverter?.mppts[input.mppt];
  const lines: CheckLine[] = [
    {
      what: `Highest voltage: Voc at ${DESIGN_TEMPERATURES.cold} °C`,
      value: volts(coldVoc),
      limit: inverter ? `up to ${volts(inverter.maxVoltage)}` : "",
      ok: inverter ? coldVoc <= inverter.maxVoltage : undefined,
    },
    {
      what: `Working voltage, hottest: Vmp at ${HOT_CELL} °C`,
      value: volts(hotVmp),
      limit: inverter ? `at least ${volts(inverter.mppMin)}` : "",
      ok: inverter ? hotVmp >= inverter.mppMin : undefined,
    },
    {
      what: `Working voltage, coldest: Vmp at ${DESIGN_TEMPERATURES.cold} °C`,
      value: volts(coldVmp),
      limit: inverter ? `up to ${volts(inverter.mppMax)}` : "",
      // Above the tracking range it still runs, off its best point.
      ok: inverter ? (coldVmp <= inverter.mppMax ? true : null) : undefined,
    },
    {
      what: `Voltage to start on: Voc at ${HOT_CELL} °C`,
      value: volts(hotVoc),
      limit: inverter ? `at least ${volts(inverter.startVoltage)}` : "",
      ok: inverter ? hotVoc >= inverter.startVoltage : undefined,
    },
    {
      what: sharing > 1 ? `Short-circuit current (Isc), ${sharing} strings on this input` : "Short-circuit current (Isc)",
      value: amps(hotIsc),
      limit: tracker ? `up to ${amps(tracker.maxShortCircuit)}` : "",
      ok: tracker ? hotIsc <= tracker.maxShortCircuit : undefined,
    },
    {
      what: sharing > 1 ? `Working current (Imp), ${sharing} strings on this input` : "Working current (Imp)",
      value: amps(working),
      limit: tracker ? `uses up to ${amps(tracker.maxCurrent)}` : "",
      // More than the input uses is clipped, not harmful.
      ok: tracker ? (working <= tracker.maxCurrent ? true : null) : undefined,
    },
  ];
  if (tracker && sharing > tracker.strings)
    lines.push({ what: "Strings on this input", value: String(sharing), limit: `it takes ${tracker.strings}`, ok: false });
  if (input.mixed)
    lines.push({
      what: "Its panels face different ways or sit at different tilts",
      value: "",
      limit: "one string, one direction",
      ok: null,
    });
  // The plain datasheet figure too, for comparing by eye: the panels' Voc added up, with no temperature in it.
  lines.push({ what: `Voc at 25 °C: ${panels} × ${panel.voc} V, as on the datasheet`, value: volts(panels * panel.voc), limit: "" });
  const basis = [panel.basis, ...(inverter ? [inverter.basis] : [])];
  if (!inverter)
    return {
      verdict: "unknown",
      words: input.inverterChosen
        ? `This inverter's input limits aren't on file, so the string can't be passed or failed here. Its highest voltage is ${volts(coldVoc)}: hold that, and the currents above, against the inverter's datasheet.`
        : `No inverter is chosen. The string's highest voltage is ${volts(coldVoc)}: choose an inverter whose details are on file and it is checked against it.`,
      lines,
      basis,
      coldVoc,
    };
  if (!tracker)
    return {
      verdict: "bad",
      words: `This inverter has ${inverter.mppts.length} inputs: move the string to one of them.`,
      lines,
      basis,
      coldVoc,
    };
  const bad = lines.filter((l) => l.ok === false);
  const caution = lines.filter((l) => l.ok === null);
  // (The datasheet line has no verdict of its own: it is there to read.)
  if (bad.length) return { verdict: "bad", words: `Outside this inverter's limits: ${inWords(bad[0].what)}.`, lines, basis, coldVoc };
  if (caution.length)
    return { verdict: "caution", words: `Within the limits, with something to know: ${inWords(caution[0].what)}.`, lines, basis, coldVoc };
  return { verdict: "good", words: "Within this inverter's limits on the coldest and the hottest day.", lines, basis, coldVoc };
}
