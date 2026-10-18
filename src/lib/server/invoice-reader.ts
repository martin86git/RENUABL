/**
 * Server only. Reads an installer's invoice (a PDF or a photo) for the
 * figures Installer Invoices compares: who it is from, its number and date,
 * its lines and its total ex GST. The file is never kept. What comes back is
 * a reading the business checks before it is saved, never taken as final.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readWithClaude } from "./claude-reader";

const nullable = (type: "string" | "number", description: string) => ({ anyOf: [{ type }, { type: "null" }], description }) as const;

const INVOICE_SCHEMA = {
  type: "object",
  properties: {
    isInvoice: { type: "boolean", description: "True only if this is an invoice or bill for work or goods." },
    installer: nullable("string", "The business that issued the invoice (its trading or legal name)."),
    number: nullable("string", "The invoice number."),
    date: nullable("string", "The invoice date as YYYY-MM-DD."),
    subTotal: nullable("number", "The total excluding GST, in dollars."),
    gst: nullable("number", "The GST, in dollars."),
    total: nullable("number", "The total including GST, in dollars."),
    reference: nullable("string", "Any job reference, purchase order number or site address written on it."),
    lines: {
      type: "array",
      description: "Each charged line: its description and its amount excluding GST in dollars.",
      items: {
        type: "object",
        properties: { description: { type: "string" }, amount: { type: "number" } },
        required: ["description", "amount"],
        additionalProperties: false,
      },
    },
  },
  required: ["isInvoice", "installer", "number", "date", "subTotal", "gst", "total", "reference", "lines"],
  additionalProperties: false,
} as const;

const PROMPT = `This is an Australian solar installer's invoice to the business that hired them.
Read who issued it, its number and date, each charged line with its amount excluding GST, the GST and the totals.
Where lines show amounts including GST, give them excluding GST. Use null for anything you can't read clearly; never guess.
Do not record bank account details, card numbers or anyone's personal contact details.`;

export interface InvoiceReading {
  isInvoice: boolean;
  installer: string | null;
  number: string | null;
  date: string | null;
  subTotal: number | null;
  gst: number | null;
  total: number | null;
  reference: string | null;
  lines: { description: string; amount: number }[];
}

export const INVOICE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];
export const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

export async function readInvoiceWithClaude(file: { data: ArrayBuffer; mediaType: InvoiceType }, apiKey: string) {
  const data = Buffer.from(file.data).toString("base64");
  const block: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType, data } };
  return readWithClaude<InvoiceReading>([block], INVOICE_SCHEMA, PROMPT, apiKey);
}
