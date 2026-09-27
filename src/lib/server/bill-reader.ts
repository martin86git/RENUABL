/**
 * Server only. Reads an electricity bill (PDF or photo) with Claude and returns
 * the usage figures RENUABL sizes a system from. Asks only for energy figures,
 * never names, account numbers or addresses, and doesn't keep the file.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { BillMediaType, BillReading } from "@/lib/domain/bill";

const DEFAULT_MODEL = "claude-opus-5";

const nullableNumber = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description }) as const;

const BILL_SCHEMA = {
  type: "object",
  properties: {
    isElectricityBill: {
      type: "boolean",
      description: "True only if this is a residential electricity bill (not gas, water, internet or anything else).",
    },
    retailer: { anyOf: [{ type: "string" }, { type: "null" }], description: "Energy retailer name, e.g. AGL, Origin, Red Energy." },
    periodDays: nullableNumber("Number of days in this billing period."),
    usageKwh: nullableNumber(
      "Total grid electricity used (imported) in this billing period, in kWh, summed across peak, off-peak, shoulder and controlled load.",
    ),
    annualUsageKwh: nullableNumber(
      "Total usage over the last 12 months in kWh, only if the bill states it or shows a full 12-month history to add up. Otherwise null.",
    ),
    eveningShare: nullableNumber(
      "Fraction (0-1) of usage outside daylight hours, only if the bill splits usage by time of day (e.g. off-peak + shoulder evening vs peak day). Otherwise null.",
    ),
    usageRate: nullableNumber("Average price per kWh in dollars including GST (e.g. 0.31). If several rates, weight by usage."),
    feedInRate: nullableNumber("Solar feed-in tariff in dollars per kWh, if shown."),
    exportedKwh: nullableNumber("Solar exported to the grid this period in kWh, if shown. 0 or null if none."),
  },
  required: [
    "isElectricityBill",
    "retailer",
    "periodDays",
    "usageKwh",
    "annualUsageKwh",
    "eveningShare",
    "usageRate",
    "feedInRate",
    "exportedKwh",
  ],
  additionalProperties: false,
} as const;

const PROMPT = `This is a customer's Australian household electricity bill, uploaded so we can size a solar and battery system for their home.
Read it carefully and return the figures. Use null for anything the bill doesn't show; never guess.
Do not include names, addresses, account numbers or NMIs.`;

export class BillReaderError extends Error {}

export async function readBillWithClaude(data: ArrayBuffer, mediaType: BillMediaType, apiKey: string): Promise<Partial<BillReading>> {
  const client = new Anthropic({ apiKey, timeout: 50_000, maxRetries: 1 });
  const b64 = Buffer.from(data).toString("base64");
  const file: Anthropic.Beta.BetaContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } };

  let response;
  try {
    response = await client.beta.messages.parse({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 4096,
      // If the model declines, the API retries on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: betaJSONSchemaOutputFormat(BILL_SCHEMA) },
      messages: [{ role: "user", content: [file, { type: "text", text: PROMPT }] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new BillReaderError(`Claude API ${e.status}: ${e.message}`);
    // parse() throws when the reply isn't schema JSON (e.g. a refusal or a cut-off reply).
    throw new BillReaderError(`Unreadable reply: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (response.stop_reason === "refusal") throw new BillReaderError("Claude declined to read the bill");
  if (response.stop_reason === "max_tokens") throw new BillReaderError("Bill reading was cut off");
  if (!response.parsed_output) throw new BillReaderError("Claude returned no bill figures");
  return response.parsed_output as Partial<BillReading>;
}

/** Stand-in reading for previews without an API key: a typical Melbourne household. */
export const SAMPLE_READING: BillReading = {
  isElectricityBill: true,
  retailer: null,
  periodDays: 91,
  usageKwh: 1547,
  annualUsageKwh: null,
  eveningShare: 0.58,
  usageRate: 0.31,
  feedInRate: 0.033,
  exportedKwh: 0,
};
