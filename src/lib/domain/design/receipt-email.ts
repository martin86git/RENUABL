/**
 * The receipt RENUABL emails a business once it has paid an invoice (26 Nov 2026, Martin: "we need payment email
 * receipts / invoices emailed from the renuabl platform", with Anthropic's and X's receipts as examples). One email
 * a paid invoice: the amount, when and how it was paid, each line, the GST, and our tax invoice attached as a PDF.
 */
import type { TaxInvoiceView } from "./billing-invoice";

export interface ReceiptGiven {
  invoice: TaxInvoiceView;
  /** The card it was paid with, when Stripe says ("visa", "4242"). */
  card: { brand: string; last4: string } | null;
  /** Settings → Billing, where invoices are listed. */
  link: string | null;
  /** When a plan renews and for how much, when the invoice is a plan's. */
  renews: { on: string; cents: number } | null;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Dollars as an Australian receipt shows them: A$153.45. */
export const aud = (cents: number) => `A$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  eftpos_au: "eftpos",
};

/** A card's brand in words, from Stripe's own name for it. */
export const brandWords = (brand: string) => BRANDS[brand.toLowerCase()] ?? (brand ? brand[0]!.toUpperCase() + brand.slice(1) : "Card");

/** The attachment's file name. */
export const receiptFileName = (v: TaxInvoiceView) => `RENUABL tax invoice ${v.number.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;

type Row = { strong?: boolean; quiet?: boolean; rule?: boolean };

function row(k: string, val: string, o: Row = {}): string {
  const cell = `padding:12px 0;font-size:14px;${o.rule ? "border-top:1px solid #e3e3e8;" : ""}color:${o.quiet ? "#6e6e73" : "#1d1d1f"};${o.strong ? "font-weight:600;" : ""}`;
  return `<tr><td style="${cell}">${esc(k)}</td><td align="right" style="${cell}white-space:nowrap">${esc(val)}</td></tr>`;
}

const card = (inner: string, pad = "20px 28px") =>
  `<div style="background:#ffffff;border:1px solid #e3e3e8;border-radius:14px;padding:${pad};margin-top:12px">${inner}</div>`;

export function receiptEmail(g: ReceiptGiven): { subject: string; text: string; html: string } {
  const v = g.invoice;
  const total = aud(v.totalCents);
  const subject = `Your RENUABL receipt · ${total}`;
  const paidLine = [`Paid ${v.paid ?? v.issued}`, g.card ? `with ${brandWords(g.card.brand)} ending ${g.card.last4}` : ""]
    .filter(Boolean)
    .join(" ");
  const facts: [string, string][] = [
    ["Invoice number", v.number],
    ["Billed to", v.buyer.name],
    ...(v.buyer.abn ? ([["ABN", v.buyer.abn]] as [string, string][]) : []),
    ["Invoice date", v.issued],
  ];
  const renews = g.renews
    ? `Your plan renews on ${g.renews.on} for ${aud(g.renews.cents)}. You can change or cancel it in Settings → Billing.`
    : "";
  const footer = `${v.supplier.name} trading as ${v.supplier.tradingAs} · ABN ${v.supplier.abn}. Paid by card through Stripe: RENUABL never sees or keeps card details. This is a receipt for your RENUABL account, not a marketing email.`;

  const text = [
    `Receipt from RENUABL: ${total}`,
    paidLine,
    facts.map(([k, val]) => `${k}: ${val}`).join("\n"),
    v.lines.map((l) => `${l.description}${l.quantity > 1 ? ` × ${l.quantity}` : ""}: ${aud(l.totalCents)}`).join("\n"),
    `Total excluding GST: ${aud(v.exGstCents)}\nGST (10%): ${aud(v.gstCents)}\nTotal: ${total}\nAmount paid: ${total}`,
    "Your tax invoice is attached as a PDF.",
    renews,
    g.link ? `All your invoices: ${g.link}` : "",
    footer,
  ]
    .filter(Boolean)
    .join("\n\n");

  const lines = v.lines
    .map((l) => {
      const qty = l.quantity > 1 ? `<div style="font-size:12px;color:#6e6e73;margin-top:2px">Qty ${l.quantity}</div>` : "";
      return `<tr><td style="padding:12px 0;font-size:14px;color:#1d1d1f">${esc(l.description)}${qty}</td><td align="right" style="padding:12px 0;font-size:14px;color:#1d1d1f;white-space:nowrap">${esc(aud(l.totalCents))}</td></tr>`;
    })
    .join("");
  const table = (inner: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${inner}</table>`;
  const button = g.link
    ? `<a href="${esc(g.link)}" style="display:block;background:#3a3d43;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px;border-radius:10px;margin:24px 0 0">See all your invoices</a>`
    : "";
  const head = `<div style="font-size:13px;color:#6e6e73">Receipt from RENUABL</div>
<div style="font-size:34px;font-weight:600;color:#1d1d1f;line-height:1.2;margin:6px 0 4px">${esc(total)}</div>
<div style="font-size:13px;color:#6e6e73">${esc(paidLine)}</div>`;
  const sums = [
    lines,
    row("Total excluding GST", aud(v.exGstCents), { rule: true }),
    row("GST (10%)", aud(v.gstCents), { quiet: true }),
    row("Total", total, { strong: true, rule: true }),
    row("Amount paid", total, { strong: true, rule: true }),
  ].join("");
  const html = `<div style="background:#f4f4f6;padding:24px 12px;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">
<div style="font-size:13px;letter-spacing:0.3em;font-weight:600;color:#1d1d1f;padding:8px 4px 8px">RENUABL</div>
${card(head, "28px")}
${card(table(facts.map(([k, val]) => row(k, val, { quiet: true })).join("")))}
${card(`${table(sums)}<p style="font-size:13px;color:#6e6e73;margin:16px 0 0">Your tax invoice is attached as a PDF.</p>${button}`)}
${renews ? card(`<div style="font-size:14px;line-height:1.6;color:#3a3d43">${esc(renews)}</div>`, "18px 28px") : ""}
<p style="font-size:12px;line-height:1.6;color:#6e6e73;padding:20px 4px 0;margin:0">${esc(footer)}</p>
</div></div>`;
  return { subject, text, html };
}
