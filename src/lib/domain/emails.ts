/** Customer emails, as subject + HTML + plain text. Pure and tested; sending is in src/lib/server/email.ts. */

export interface OrderEmail {
  reference: string;
  firstName: string;
  address?: string;
  installer?: string;
  /** "Friday 23 October 2026" */
  installDate?: string;
  arrival?: string;
  system: string;
  lines: { label: string; amount: number }[];
  gross: number;
  rebates: { label: string; amount: number }[];
  total: number;
  loan?: number;
  outOfPocket?: number;
  deposit: number;
  /** "Tuesday 13 October at 10:30am", when the call is already booked. */
  call?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const clip = (s: string, n = 120) => s.slice(0, n);

function row(label: string, value: string, opts: { green?: boolean; bold?: boolean } = {}) {
  const style = `padding:6px 0;${opts.green ? "color:#2E7D4F;" : ""}${opts.bold ? "font-weight:600;" : ""}`;
  return `<tr><td style="${style}">${esc(clip(label))}</td><td style="${style}text-align:right;white-space:nowrap">${esc(value)}</td></tr>`;
}

export function orderConfirmationEmail(o: OrderEmail): { subject: string; html: string; text: string } {
  const subject = `Your RENUABL reservation ${o.reference}`;
  const next = o.call
    ? `We'll call you on ${o.call} for your 15-minute system confirmation.`
    : "Next, book your 15-minute system confirmation call from your confirmation page.";
  const lines = [
    ...o.lines.map((l) => row(l.label, money(l.amount))),
    row("Price before rebates", money(o.gross)),
    ...o.rebates.map((r) => row(r.label, `−${money(r.amount)}`, { green: true })),
    row("Total after rebates", money(o.total), { bold: true }),
    ...(o.loan
      ? [
          row("Solar Victoria interest-free loan", `−${money(o.loan)}`),
          row("Your upfront cost", money(o.outOfPocket ?? o.total), { bold: true }),
        ]
      : []),
    row("Due today", "$0"),
  ].join("");

  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:Inter,Arial,sans-serif;color:#1A1A1A">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="letter-spacing:.28em;font-size:14px;margin:0 0 24px">RENUABL</p>
<h1 style="font-weight:400;font-size:28px;margin:0 0 8px">You're all set, ${esc(clip(o.firstName, 40))}.</h1>
<p style="color:#6B6B6B;margin:0 0 24px">Your date is reserved (${esc(o.reference)}). There's nothing to pay today.</p>
<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
<table style="width:100%;border-collapse:collapse;font-size:14px">
${o.address ? row("Home", o.address) : ""}${o.installer ? row("Installer", o.installer) : ""}${o.installDate ? row("Installation", `${o.installDate}${o.arrival ? `, arrival ${o.arrival}` : ""}`) : ""}${o.call ? row("Confirmation call", o.call) : ""}
</table></div>
<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
<p style="margin:0 0 8px">${esc(clip(o.system, 200))}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${lines}</table>
<p style="color:#6B6B6B;font-size:12px;margin:12px 0 0">Rebates and your final price are confirmed on your call before anything is final. Solar Victoria support is subject to its eligibility criteria.</p>
</div>
<div style="background:#D9E7DC;border-radius:16px;padding:20px;color:#1E3A2E;font-size:14px">
<p style="margin:0 0 6px"><strong>What happens next</strong></p>
<p style="margin:0">${esc(next)} After the call we'll send a secure link for the ${money(o.deposit)} refundable deposit to lock in your date.</p>
</div>
<p style="color:#6B6B6B;font-size:12px;margin-top:24px">Questions? Just reply to this email.</p>
</div></body></html>`;

  const text = [
    `You're all set, ${o.firstName}.`,
    `Your date is reserved (${o.reference}). There's nothing to pay today.`,
    "",
    o.address && `Home: ${o.address}`,
    o.installer && `Installer: ${o.installer}`,
    o.installDate && `Installation: ${o.installDate}${o.arrival ? `, arrival ${o.arrival}` : ""}`,
    o.call && `Confirmation call: ${o.call}`,
    "",
    o.system,
    ...o.lines.map((l) => `${l.label}: ${money(l.amount)}`),
    `Price before rebates: ${money(o.gross)}`,
    ...o.rebates.map((r) => `${r.label}: -${money(r.amount)}`),
    `Total after rebates: ${money(o.total)}`,
    ...(o.loan ? [`Solar Victoria interest-free loan: -${money(o.loan)}`, `Your upfront cost: ${money(o.outOfPocket ?? o.total)}`] : []),
    "Due today: $0",
    "",
    next,
    `After the call we'll send a secure link for the ${money(o.deposit)} refundable deposit to lock in your date.`,
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");

  return { subject, html, text };
}

export function callBookedEmail(o: { reference: string; firstName: string; call: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your RENUABL call: ${o.call}`;
  const body = `We'll call you on ${o.call} for your 15-minute system confirmation. We'll confirm your roof, switchboard and access. It isn't a sales call. Reservation ${o.reference}.`;
  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:Inter,Arial,sans-serif;color:#1A1A1A"><div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="letter-spacing:.28em;font-size:14px;margin:0 0 24px">RENUABL</p>
<h1 style="font-weight:400;font-size:26px;margin:0 0 12px">Your call is booked, ${esc(clip(o.firstName, 40))}.</h1>
<p style="margin:0">${esc(body)}</p>
<p style="color:#6B6B6B;font-size:12px;margin-top:24px">The calendar invite is attached. Need a different time? Just reply to this email.</p>
</div></body></html>`;
  return { subject, html, text: `Your call is booked, ${o.firstName}.\n\n${body}` };
}
