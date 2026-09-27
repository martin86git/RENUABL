/**
 * Server only. Reads an electricity bill (PDF or photo) with Claude and returns
 * the usage figures RENUABL sizes a system from. Asks only for energy figures,
 * never names, account numbers or addresses, and doesn't keep the file.
 */
import type { BillMediaType, BillReading } from "@/lib/domain/bill";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-5-5";

const TOOL = {
  name: "record_bill",
  description: "Record the electricity usage and price figures read from the customer's bill.",
  input_schema: {
    type: "object",
    properties: {
      isElectricityBill: {
        type: "boolean",
        description: "True only if this is a residential electricity bill (not gas, water, internet or anything else).",
      },
      retailer: { type: ["string", "null"], description: "Energy retailer name, e.g. AGL, Origin, Red Energy." },
      periodDays: { type: ["number", "null"], description: "Number of days in this billing period." },
      usageKwh: {
        type: ["number", "null"],
        description:
          "Total grid electricity used (imported) in this billing period, in kWh, summed across peak, off-peak, shoulder and controlled load.",
      },
      annualUsageKwh: {
        type: ["number", "null"],
        description:
          "Total usage over the last 12 months in kWh, only if the bill states it or shows a full 12-month history to add up. Otherwise null.",
      },
      eveningShare: {
        type: ["number", "null"],
        description:
          "Fraction (0-1) of usage outside daylight hours, only if the bill splits usage by time of day (e.g. off-peak + shoulder evening vs peak day). Otherwise null.",
      },
      usageRate: {
        type: ["number", "null"],
        description: "Average price per kWh in dollars including GST (e.g. 0.31). If several rates, weight by usage.",
      },
      feedInRate: { type: ["number", "null"], description: "Solar feed-in tariff in dollars per kWh, if shown." },
      exportedKwh: { type: ["number", "null"], description: "Solar exported to the grid this period in kWh, if shown. 0 or null if none." },
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
  },
} as const;

const PROMPT = `This is a customer's Australian household electricity bill, uploaded so we can size a solar and battery system for their home.
Read it carefully and call record_bill with the figures. Use null for anything the bill doesn't show; never guess.
Do not record names, addresses, account numbers or NMIs.`;

export class BillReaderError extends Error {}

export async function readBillWithClaude(data: ArrayBuffer, mediaType: BillMediaType, apiKey: string): Promise<Partial<BillReading>> {
  const source = { type: "base64", media_type: mediaType, data: Buffer.from(data).toString("base64") };
  const file = mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: [file, { type: "text", text: PROMPT }] }],
    }),
    signal: AbortSignal.timeout(50_000),
  });

  if (!res.ok) throw new BillReaderError(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const call = body.content?.find((c) => c.type === "tool_use" && c.name === TOOL.name);
  if (!call || typeof call.input !== "object" || call.input === null) throw new BillReaderError("Claude returned no bill figures");
  return call.input as Partial<BillReading>;
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
