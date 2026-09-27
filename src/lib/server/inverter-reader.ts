/** Server only. Reads an existing inverter's make, model and size from photos. */
import type Anthropic from "@anthropic-ai/sdk";
import type { InverterReading } from "@/lib/domain/inverter";
import { readWithClaude } from "./claude-reader";

const nullable = (type: "string" | "number" | "boolean", description: string) =>
  ({ anyOf: [{ type }, { type: "null" }], description }) as const;

const INVERTER_SCHEMA = {
  type: "object",
  properties: {
    isInverter: { type: "boolean", description: "True only if the photos show a solar (PV) inverter or its label." },
    brand: nullable("string", "Manufacturer, e.g. Fronius, SMA, Sungrow, GoodWe, SolarEdge, Enphase."),
    model: nullable("string", "Model name or number exactly as on the label."),
    ratedKw: nullable("number", "Rated (nominal) AC output power in kW, e.g. 5 for 5000 W. Not the max DC input."),
    phase: {
      anyOf: [{ type: "string", enum: ["single", "three"] }, { type: "null" }],
      description: "Single or three phase, if the label or model shows it.",
    },
    hybrid: nullable("boolean", "True if it is a hybrid (battery-ready) inverter, if you can tell."),
  },
  required: ["isInverter", "brand", "model", "ratedKw", "phase", "hybrid"],
  additionalProperties: false,
} as const;

const PROMPT = `These are photos of a customer's existing solar inverter in Australia: its front and/or the rating label (nameplate) on its side.
Read the make, model and rated AC output. Use null for anything you can't read clearly; never guess.
Do not record serial numbers or any personal details.`;

export const SAMPLE_INVERTER: InverterReading = {
  isInverter: true,
  brand: "Fronius",
  model: "Primo 5.0-1",
  ratedKw: 5,
  phase: "single",
  hybrid: false,
};

export async function readInverterWithClaude(
  photos: { data: ArrayBuffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }[],
  apiKey: string,
) {
  const files: Anthropic.Beta.BetaContentBlockParam[] = photos.map((p) => ({
    type: "image",
    source: { type: "base64", media_type: p.mediaType, data: Buffer.from(p.data).toString("base64") },
  }));
  return readWithClaude<Partial<InverterReading>>(files, INVERTER_SCHEMA, PROMPT, apiKey);
}
