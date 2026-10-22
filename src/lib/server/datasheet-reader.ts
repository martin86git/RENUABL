/**
 * Server only. Reads a panel's or inverter's datasheet (a PDF or a photo) for the electrical figures the string check
 * uses. The file is never kept, and what comes back is a reading the business checks before anything is saved.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { SheetReading } from "@/lib/domain/design/datasheets";
import { readWithClaude } from "./claude-reader";

const num = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description }) as const;

const SCHEMA = {
  type: "object",
  properties: {
    isDatasheet: { type: "boolean", description: "True only if this is a datasheet for a solar panel or a solar or hybrid inverter." },
    kind: { anyOf: [{ type: "string", enum: ["panel", "inverter"] }, { type: "null" }] },
    model: { anyOf: [{ type: "string" }, { type: "null" }], description: "The maker and model, e.g. Jinko Tiger Neo JKM475N-48QL6-DV." },
    panel: {
      anyOf: [
        {
          type: "object",
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
        { type: "null" },
      ],
    },
    inverter: {
      anyOf: [
        {
          type: "object",
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
        { type: "null" },
      ],
    },
  },
  required: ["isDatasheet", "kind", "model", "panel", "inverter"],
  additionalProperties: false,
} as const;

const PROMPT = `This is a manufacturer's datasheet for a solar panel or a solar or hybrid inverter.
If it is a panel, read its electrical figures at STC for the model and wattage named (if several wattages are listed, use the one in the model name, or the first, and say which in "model"), and its temperature coefficients exactly as printed in percent per degree C.
If it is an inverter, read its PV (DC) input figures: maximum input voltage, the MPPT operating range, the start-up voltage, and each MPPT input's maximum current, maximum short-circuit current and number of strings. Where a datasheet covers several models, use the model named in "model" and its column only.
Use null for anything you can't read clearly; never guess or work a figure out. Leave the other kind null.`;

export const SHEET_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type SheetType = (typeof SHEET_TYPES)[number];
export const MAX_SHEET_BYTES = 10 * 1024 * 1024;

export async function readDatasheetWithClaude(file: { data: ArrayBuffer; mediaType: SheetType }, apiKey: string) {
  const data = Buffer.from(file.data).toString("base64");
  const block: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType, data } };
  return readWithClaude<SheetReading>([block], SCHEMA, PROMPT, apiKey);
}
