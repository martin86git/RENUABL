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
  /** Upgrades to talk about on the call (not priced, not in the total). */
  discuss?: string[];
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
${o.address ? row("Home", o.address) : ""}${o.installer ? row("Installation partner", o.installer) : ""}${o.installDate ? row("Installation", `${o.installDate}${o.arrival ? `, arrival ${o.arrival}` : ""}`) : ""}${o.call ? row("Confirmation call", o.call) : ""}
</table></div>
<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
<p style="margin:0 0 8px">${esc(clip(o.system, 200))}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${lines}</table>
${o.discuss?.length ? `<p style="font-size:14px;margin:12px 0 0">To discuss on your call: ${esc(o.discuss.map((d) => clip(d, 60)).join(", "))} (not included in your price).</p>` : ""}
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
    o.installer && `Installation partner: ${o.installer}`,
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
    o.discuss?.length && `To discuss on your call: ${o.discuss.join(", ")} (not included in your price).`,
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

/** Plain text only: no links, web or email addresses (so the emails can't carry someone else's message), clipped. */
export function plainText(value: unknown, max = 120): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S*/gi, "")
    .replace(/\S+@\S+/g, "")
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|au|co|info|biz|xyz|ru|cn|app|link|site|online|top)\b\S*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1_000_000 ? v : null);

function items(v: unknown, max: number): { label: string; amount: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, max)
    .map((x) => ({ label: plainText((x as { label?: unknown })?.label, 80), amount: amount((x as { amount?: unknown })?.amount) }))
    .filter((x): x is { label: string; amount: number } => Boolean(x.label) && x.amount !== null);
}

/**
 * The order sent from the browser, checked before it goes into an email: known
 * fields only, plain text, capped lengths and counts, sane amounts. Null if
 * it doesn't look like an order.
 */
export function cleanOrder(raw: unknown): Omit<OrderEmail, "reference" | "firstName"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lines = items(r.lines, 8);
  const gross = amount(r.gross);
  const total = amount(r.total);
  const deposit = amount(r.deposit);
  if (!lines.length || gross === null || total === null || deposit === null) return null;
  const text = (k: string, max = 120) => plainText(r[k], max) || undefined;
  return {
    address: text("address"),
    installer: text("installer", 80),
    installDate: text("installDate", 60),
    arrival: text("arrival", 30),
    system: plainText(r.system, 200) || "Your RENUABL system",
    lines,
    gross,
    rebates: items(r.rebates, 6),
    total,
    loan: amount(r.loan) || undefined,
    outOfPocket: amount(r.outOfPocket) ?? undefined,
    deposit,
    discuss: Array.isArray(r.discuss)
      ? r.discuss
          .slice(0, 6)
          .map((d) => plainText(d, 60))
          .filter(Boolean)
      : undefined,
  };
}

/** Sent when a partner applies. */
export function partnerReceivedEmail(o: { reference: string; firstName: string; type: "installer" | "retailer" }): {
  subject: string;
  html: string;
  text: string;
} {
  const role = o.type === "retailer" ? "retail partner" : "installation partner";
  const subject = `We've received your RENUABL application (${o.reference})`;
  const body = `Thanks for applying to become a RENUABL ${role}. We'll check your accreditation, licence and insurance and be in touch shortly. Your reference is ${o.reference}.`;
  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:Inter,Arial,sans-serif;color:#1A1A1A"><div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="letter-spacing:.28em;font-size:14px;margin:0 0 24px">RENUABL</p>
<h1 style="font-weight:400;font-size:26px;margin:0 0 12px">Thanks, ${esc(plainText(o.firstName, 40) || "there")}.</h1>
<p style="margin:0">${esc(body)}</p>
<p style="color:#6B6B6B;font-size:12px;margin-top:24px">Questions? Just reply to this email.</p>
</div></body></html>`;
  return { subject, html, text: `Thanks, ${plainText(o.firstName, 40) || "there"}.\n\n${body}` };
}

/**
 * A short email with one button. The link is always built on the server from
 * the site's own address (never taken from the browser).
 */
function simpleEmail(o: { subject: string; heading: string; lines: string[]; button?: { label: string; href: string }; footer?: string }) {
  const btn = o.button
    ? `<p style="margin:24px 0"><a href="${esc(o.button.href)}" style="display:inline-block;background:#1E3A2E;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-size:15px">${esc(o.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:Inter,Arial,sans-serif;color:#1A1A1A"><div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="letter-spacing:.28em;font-size:14px;margin:0 0 24px">RENUABL</p>
<h1 style="font-weight:400;font-size:26px;margin:0 0 12px">${esc(o.heading)}</h1>
${o.lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("\n")}
${btn}
<p style="color:#6B6B6B;font-size:12px;margin-top:24px">${esc(o.footer ?? "Questions? Just reply to this email.")}</p>
</div></body></html>`;
  const text = [o.heading, "", ...o.lines, ...(o.button ? ["", `${o.button.label}: ${o.button.href}`] : []), "", o.footer ?? ""]
    .join("\n")
    .trim();
  return { subject: o.subject, html, text };
}

export function loginLinkEmail(o: { link: string; minutes: number; forPartner: boolean }) {
  return simpleEmail({
    subject: "Your RENUABL sign-in link",
    heading: "Sign in to RENUABL",
    lines: [
      `Tap the button to sign in${o.forPartner ? " to your partner portal" : ""}. The link works once and expires in ${o.minutes} minutes.`,
    ],
    button: { label: "Sign in", href: o.link },
    footer: "Didn't ask for this? You can ignore this email: nobody can sign in without the link.",
  });
}

export function applicationPendingEmail() {
  return simpleEmail({
    subject: "Your RENUABL application is being reviewed",
    heading: "We're still reviewing your application",
    lines: ["You'll be able to sign in to the partner portal as soon as your application is approved. We'll email you then."],
  });
}

export function partnerApprovedEmail(o: { firstName: string; link: string }) {
  return simpleEmail({
    subject: "You're approved: welcome to RENUABL",
    heading: `Welcome aboard, ${plainText(o.firstName, 40) || "there"}.`,
    lines: [
      "Your application has been approved. New jobs within your area will be offered to you by email and in the partner portal.",
      "You'll have 24 hours to accept each offer before it goes to another partner.",
    ],
    button: { label: "Open the partner portal", href: o.link },
  });
}

/** The installation partner has designed the customer's panel layout: a look before install day. */
export function layoutReadyEmail(o: { customer: string; panels: number; partner: string; link: string }) {
  const first = plainText(o.customer, 40).split(" ")[0] || "there";
  return simpleEmail({
    subject: "Your panel layout is ready",
    heading: `Hi ${first}, here's where your panels will go.`,
    lines: [
      `${plainText(o.partner, 60) || "Your installation partner"} has designed the layout for your ${o.panels} panels on your roof.`,
      "Have a look before install day. If anything doesn't look right, just reply and we'll sort it out with them.",
    ],
    button: { label: "See your panel layout", href: o.link },
  });
}

export function jobOfferEmail(o: { suburb: string; system: string; installDate: string | null; link: string; hours: number }) {
  return simpleEmail({
    subject: `New job offer in ${plainText(o.suburb, 40)}`,
    heading: `New job in ${plainText(o.suburb, 40)}`,
    lines: [
      `${plainText(o.system, 80)}${o.installDate ? `, installing ${plainText(o.installDate, 40)}` : ""}.`,
      `Accept within ${o.hours} hours, or it will be offered to another partner.`,
    ],
    button: { label: "View the offer", href: o.link },
  });
}
