/**
 * Server only. Reads a panel's or inverter's datasheet (a PDF or a photo) for the electrical figures the string check
 * uses. The file is never kept, and what comes back is a reading the business checks before anything is saved.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readingFrom, type RawReading } from "@/lib/domain/design/datasheets";
import { readWithClaude } from "./claude-reader";

// No field may be "a number or nothing" (the API allows only a few such unions in a schema: 3 Nov 2026, the reader was
// refused with 18), so a figure that can't be read clearly is 0, which no real figure is; `readingFrom` makes it null.
const num = (description: string) => ({ type: "number", description: `${description} 0 if it can't be read clearly.` }) as const;

const SCHEMA = {
  type: "object",
  properties: {
    isDatasheet: { type: "boolean", description: "True only if this is a datasheet for a solar panel or a solar or hybrid inverter." },
    kind: { type: "string", enum: ["panel", "inverter", "unknown"] },
    model: { type: "string", description: "The maker and model, e.g. Jinko Tiger Neo JKM475N-48QL6-DV. Empty if unknown." },
    panel: {
      type: "object",
      description: "The panel's figures; every one 0 for an inverter.",
      properties: {
        voc: num("Open-circuit voltage Voc at STC, volts."),
        vmp: num("Voltage at maximum power Vmp at STC, volts."),
        isc: num("Short-circuit current Isc at STC, amps."),
        imp: num("Current at maximum power Imp at STC, amps."),
        vocPercentPerC: num("Temperature coefficient of Voc, percent per degree C as printed, e.g. -0.25."),
        iscPercentPerC: num("Temperature coefficient of Isc, percent per degree C as printed, e.g. 0.045."),
        pmaxPercentPerC: num("Temperature coefficient of Pmax, percent per degree C as printed, e.g. -0.29."),
      },
      required: ["voc", "vmp", "isc", "imp", "vocPercentPerC", "iscPercentPerC", "pmaxPercentPerC"],
      additionalProperties: false,
    },
    inverter: {
      type: "object",
      description: "The inverter's PV input figures; every one 0 and no MPPTs for a panel.",
      properties: {
        maxVoltage: num("Maximum PV input voltage, volts."),
        mppMin: num("Lowest voltage of the MPPT operating range, volts."),
        mppMax: num("Highest voltage of the MPPT operating range, volts."),
        startVoltage: num("Start-up input voltage, volts."),
        mppts: {
          type: "array",
          description: "One entry per MPPT input, in order.",
          items: {
            type: "object",
            properties: {
              maxCurrent: num("Maximum input current of this MPPT, amps."),
              maxShortCircuit: num("Maximum short-circuit current of this MPPT, amps."),
              strings: num("Number of strings (connector pairs) on this MPPT."),
            },
            required: ["maxCurrent", "maxShortCircuit", "strings"],
            additionalProperties: false,
          },
        },
      },
      required: ["maxVoltage", "mppMin", "mppMax", "startVoltage", "mppts"],
      additionalProperties: false,
    },
  },
  required: ["isDatasheet", "kind", "model", "panel", "inverter"],
  additionalProperties: false,
} as const;

const PROMPT = `This is a manufacturer's datasheet for a solar panel or a solar or hybrid inverter.
If it is a panel, read its electrical figures at STC for the model and wattage named (if several wattages are listed, use the one in the model name, or the first, and say which in "model"), and its temperature coefficients exactly as printed in percent per degree C.
If it is an inverter, read its PV (DC) input figures: maximum input voltage, the MPPT operating range, the start-up voltage, and each MPPT input's maximum current, maximum short-circuit current and number of strings. Where a datasheet covers several models, use the model named in "model" and its column only.
Use 0 for anything you can't read clearly; never guess or work a figure out. Leave the other kind's figures 0.`;

export const SHEET_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type SheetType = (typeof SHEET_TYPES)[number];
export const MAX_SHEET_BYTES = 10 * 1024 * 1024;

/** `forModel` names the model to read when the sheet covers a series (a datasheet found online for one product). */
export async function readDatasheetWithClaude(file: { data: ArrayBuffer; mediaType: SheetType }, apiKey: string, forModel?: string) {
  const data = Buffer.from(file.data).toString("base64");
  const block: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType, data } };
  const model = (forModel ?? "").replace(/[\r\n`]/g, " ").slice(0, 160);
  const prompt = model
    ? `${PROMPT}\nRead the figures for this model only: ${model}. If the sheet doesn't cover it, set isDatasheet false.`
    : PROMPT;
  return readingFrom(await readWithClaude<RawReading>([block], SCHEMA, prompt, apiKey));
}
