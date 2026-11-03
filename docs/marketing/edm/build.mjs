// Builds the cold sales emails 01.html to 08.html from the copy below.
// Run from the repo root: node docs/marketing/edm/build.mjs
// Don't run Prettier on the HTML: it breaks Outlook's conditional comments. Add docs/marketing/edm/*.html to .prettierignore before committing.
// Change the copy here, then build again; the HTML files are what gets pasted into HubSpot.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE = "https://www.renuabl.com.au";
const TRIAL = `${SITE}/design`;
const IMAGES = `${SITE}/design/landing`;
const CTA = "Start your 14-day free trial";

// The studio look: white and cool greys, near-black ink, one solar orange.
const C = {
  canvas: "#F2F3F5",
  surface: "#FFFFFF",
  ink: "#111418",
  muted: "#5B6270",
  faint: "#8A909B",
  line: "#E3E6EA",
  graphite: "#2B2F36",
  orange: "#FF5A1F",
  placeholder: "#E9ECEF",
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

const COMPETITOR_SOURCE =
  "A well-known Australian solar platform's published pricing, read on 1 November 2026: Solar CRM from $49 a user a month, plus $4 or $10 a project and 80c an e-signature; trial of 5 projects, no card. We've quoted their figures as published and haven't added or removed GST.";

const TRIAL_TERMS =
  "14 days free, with 5 design jobs on us. Your card is taken on Stripe's secure page and nothing is charged until the trial ends. Cancel any time before then and you pay nothing.";

export const EMAILS = [
  {
    n: 1,
    day: 0,
    slug: "punch",
    subject: "Still paying old prices for old software?",
    subjectB: "Your solar software charges you per signature",
    preheader: "A fee for every project. A fee for every signature. There's another way.",
    eyebrow: "Pay less. Do more.",
    headline: ["Old software.", "Old prices.", "*Still paying?*"],
    blocks: [
      { t: "lines", v: ["Your quoting tool is slow.", "Your CRM doesn't talk to it.", "Your proposals live somewhere else again."] },
      { t: "p", v: "And every project costs you a fee. Every signature costs you a fee. That's not a platform. That's a toll road." },
      {
        t: "img",
        name: "today",
        alt: "RENUABL's Today screen: the jobs to action first and the customer to call next, with example data",
      },
      { t: "p", v: "RENUABL is one place for the whole job. Roof design. Proposal. Signature. Approvals. Ordering. Install. Invoices." },
      { t: "figure", big: "$29", small: "a user a month, GST included. No fee per signature." },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 2,
    day: 3,
    slug: "price",
    subject: "$29. Not $49 plus fees.",
    subjectB: "We did the maths on your software bill",
    preheader: "Same team, same month, side by side. The numbers are below.",
    eyebrow: "The price",
    headline: ["$29.", "Not $49.", "*Not plus.*"],
    blocks: [
      {
        t: "p",
        v: "Most solar software has a number on the front and a meter running at the back. A user fee. Then a project fee. Then a signature fee.",
      },
      {
        t: "table",
        head: ["", "RENUABL", "A well-known Australian solar platform"],
        rows: [
          ["Each user, a month", "$29", "from $49"],
          ["Each project", "$3 a design job", "$4 or $10"],
          ["Each e-signature", "$0", "80c"],
          ["Free trial", "14 days, 5 design jobs", "5 projects"],
        ],
      },
      { t: "h", v: "A month for 5 people, 40 jobs, 15 signed" },
      {
        t: "duel",
        left: { label: "RENUABL", big: "$265", note: "5 × $29 + 40 × $3" },
        right: { label: "At their lowest published rates", big: "$417+", note: "5 × $49 + 40 × $4 + 15 × 80c" },
      },
      { t: "p", v: "Pay yearly and it's 20% off the whole package. Thirteen or more people? Reply and we'll talk." },
      { t: "fine", v: COMPETITOR_SOURCE + " RENUABL prices include GST. Design jobs come in token packs." },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 3,
    day: 6,
    slug: "one-deal",
    subject: "One deal, start to finish, in one place",
    subjectB: "Lead to grid connection. No re-typing.",
    preheader: "Follow one job from the first call to the last tick. Nothing typed twice.",
    eyebrow: "One deal",
    headline: ["One deal.", "One place.", "*Start to finish.*"],
    blocks: [
      { t: "p", v: "Watch one job go through RENUABL. No exports. No copy and paste. No “which system was that in?”" },
      {
        t: "steps",
        v: [
          ["Lead", "It lands in your CRM. The deal clock starts."],
          ["Design", "Draw the roof. The quote builds as you draw, from your own price lists."],
          ["Proposal", "Your logo, your colours. Signed online. The customer chats with you on it."],
          ["Approvals", "Grid pre-approval and Solar Victoria tracked, so nothing gets booked too early."],
          ["Booking", "The install calendar shows how full each week is before you say yes."],
          ["Ordering", "The signature opens the order. Purchase orders by supplier. A pickup slip for the counter."],
          ["Install", "The job card goes to your installer with the layout and strings. Notes and photos come back."],
          ["Finish", "The installer's invoice read and matched. Customer invoice, STCs and grid connection ticked off."],
        ],
      },
      {
        t: "img",
        name: "deals",
        alt: "RENUABL's deals pipeline with each deal's clock, its temperature and who to call first, with example data",
      },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 4,
    day: 10,
    slug: "sol",
    subject: "You already use ChatGPT. Put it in your deals.",
    subjectB: "Meet Sol. He drafts. You send.",
    preheader: "Stop pasting customer notes into a chat window. Sol already knows the deal.",
    eyebrow: "Meet Sol",
    headline: ["You already ask", "ChatGPT.", "*Sol knows the deal.*"],
    blocks: [
      {
        t: "p",
        v: "Be honest. You paste notes into ChatGPT or Claude to write the follow-up. Then copy it back. Then go and find the deal.",
      },
      { t: "p", v: "Sol is the assistant inside RENUABL. He works from your deals, so you just ask:" },
      {
        t: "quotes",
        v: [
          "Who's gone quiet since their proposal?",
          "Draft a follow-up for the Nguyen job.",
          "Remind me Thursday to chase the pre-approval.",
          "Chart this month's sales.",
        ],
      },
      { t: "img", name: "sol", alt: "Sol suggesting which customers to chase, with a drafted email marked not sent, using example data" },
      { t: "lines", v: ["He drafts. You send.", "Sol never sends anything himself.", "He only sees what that team member can see."] },
      { t: "h", v: "And he knows solar" },
      {
        t: "p",
        v: "Asked in the Installations channel where a battery can go on a garage wall with a door and a window, Sol set out the clearances, drew them, flagged a bollard if a car could hit it, and said what to check before picking a spot.",
      },
      {
        t: "img",
        name: "sol-garage-wall",
        h: 488,
        alt: "Asked where a battery can go on a garage wall with a door and a window, Sol answers with the clearances, a drawing and what to check",
      },
      {
        t: "fine",
        v: "Sol runs on Claude. The names above are examples. The clearances are a real answer from Sol: check figures like these against the current standard before acting on them.",
      },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 5,
    day: 14,
    slug: "design-it-for-me",
    subject: "Draw the roof. Get three designs.",
    subjectB: "Fastest payback, best return, most independence. One button.",
    preheader: "Press Design it for me and get three priced designs for the same roof.",
    eyebrow: "Design it for me",
    headline: ["Draw the roof.", "Press one button.", "*Three designs.*"],
    blocks: [
      { t: "figure", big: "3", small: "designs for one roof, each priced from your own price lists and set against the customer's bill." },
      {
        t: "steps",
        v: [
          ["Fastest payback", "Panels only, sized to pay for itself soonest."],
          ["Best return", "Panels and a battery, the most dollars ahead over the years."],
          ["Most independence", "The whole roof, a battery for the evenings and blackout backup."],
        ],
        plain: true,
      },
      {
        t: "p",
        v: "Panels laid by the rules an installer uses: from the gutter up, clear of the edges, square with the roof. Strings checked against the inverter's limits on file.",
      },
      { t: "p", v: "Check it against the photo. Tweak it. Send the customer a choice instead of a guess." },
      { t: "fine", v: "Every figure is an estimate. You check every design before it goes to a customer." },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 6,
    day: 18,
    slug: "after-the-sale",
    subject: "Signed. Then it runs itself.",
    subjectB: "That 9pm admin shift just got shorter",
    preheader: "The moment a customer signs, the order, the booking and the paperwork start moving.",
    eyebrow: "After the sale",
    headline: ["Signed.", "*Then it runs itself.*"],
    blocks: [
      {
        t: "p",
        v: "Winning the job was the fun part. Then came the spreadsheet, the supplier emails, the calendar, the installer's invoice that doesn't match.",
      },
      { t: "h", v: "In RENUABL, the signature sets it going" },
      {
        t: "list",
        v: [
          "The order opens with the exact lines that were sold.",
          "Purchase orders go to each supplier, and a pickup slip waits for the counter.",
          "Approvals line up the jobs ready to book. The calendar shows each week's capacity.",
          "The job card goes to your installer with the panel layout and strings drawn on the roof.",
          "The installer's invoice is read from the PDF and checked against what you allowed.",
          "Customer reminders before install day, if you switch them on.",
        ],
      },
      {
        t: "img",
        name: "calendar",
        alt: "RENUABL's install calendar showing each week booked against the business's capacity, with example data",
      },
      { t: "lines", v: ["Less chasing.", "Less re-typing.", "*More installs.*"] },
    ],
    ps: TRIAL_TERMS,
  },
  {
    n: 7,
    day: 23,
    slug: "coming-soon",
    subject: "What's coming to RENUABL (and a marketplace)",
    subjectB: "Installers bidding on your overflow jobs?",
    preheader: "HubSpot, Pipedrive and Nearmap are on the way. And a marketplace for solar businesses.",
    eyebrow: "What's next",
    headline: ["We're not done.", "*Not even close.*"],
    blocks: [
      { t: "h", v: "Coming soon" },
      {
        t: "badges",
        v: [
          ["HubSpot integration", "Coming soon"],
          ["Pipedrive integration", "Coming soon"],
          ["Nearmap imagery", "Coming soon"],
          ["Automatic proposals from Nearmap", "Coming soon"],
        ],
      },
      { t: "h", v: "And a marketplace for solar businesses" },
      {
        t: "list",
        v: [
          "Too much work this month? List a sold job and let installers near you bid on it. Your customer's details stay with you.",
          "Spare panels, inverters or batteries in the shed? Sell them to another business, or pick up theirs.",
        ],
      },
      { t: "callout", v: "Want in on the marketplace? Reply with the word MARKETPLACE and we'll put you on the list." },
    ],
    ps: "Start now and everything above arrives in the account you already have. " + TRIAL_TERMS,
  },
  {
    n: 8,
    day: 30,
    slug: "last-call",
    subject: "Last one. Bring the team.",
    subjectB: "14 days free. Everyone in.",
    preheader: "This is the last email in this series. 14 days free for your whole team.",
    eyebrow: "Last call",
    headline: ["Last email.", "*Bring the whole team.*"],
    blocks: [
      { t: "p", v: "Software only works when everyone's in it. So bring them." },
      {
        t: "steps",
        v: [
          ["Sales", "Deals, proposals, the customer chat and Sol."],
          ["Designers", "A Designer role that lands straight on the design tool."],
          ["The office", "Approvals, ordering, the install calendar, invoices."],
          ["Installers", "A job card on their phone, no login needed."],
        ],
        plain: true,
      },
      { t: "p", v: "Team chat. @mentions. Permissions per person, so not everyone sees your costs and margin." },
      { t: "figure", big: "14 days", small: "free, with 5 design jobs. $29 a user a month after that, GST included. 20% off yearly." },
      { t: "p", v: "Thirteen or more people? Reply to this email and we'll talk about an enterprise plan." },
      { t: "p", v: "This is the last email in this series. We won't chase you after this one." },
    ],
    ps: TRIAL_TERMS,
  },
];

// ——— Rendering ———

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** *words* become the orange figure that matters. */
const rich = (s) => esc(s).replace(/\*(.+?)\*/g, `<span style="color:${C.orange};">$1</span>`);

const link = (n) =>
  `${TRIAL}?utm_source=edm&amp;utm_medium=email&amp;utm_campaign=cold-sequence-2026-11&amp;utm_content=email-${String(n).padStart(2, "0")}`;

const text = (size, color, extra = "") =>
  `font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * 1.55)}px;color:${color};${extra}`;

const row = (inner, pad = "0 40px 24px 40px") => `<tr><td class="px" style="padding:${pad};">${inner}</td></tr>`;

function block(b) {
  switch (b.t) {
    case "p":
      return row(`<p style="margin:0;${text(17, C.ink)}">${rich(b.v)}</p>`);
    case "lines":
      return row(b.v.map((l) => `<p style="margin:0;${text(19, C.ink, "font-weight:600;")}">${rich(l)}</p>`).join(""));
    case "h":
      return row(
        `<p style="margin:0;${text(13, C.muted, "font-weight:600;letter-spacing:1.5px;text-transform:uppercase;")}">${esc(b.v)}</p>`,
        "8px 40px 14px 40px",
      );
    case "fine":
      return row(`<p style="margin:0;${text(12, C.faint)}">${esc(b.v)}</p>`);
    case "figure":
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.graphite};border-radius:8px;"><tr><td style="padding:28px 28px 26px 28px;">` +
          `<p style="margin:0;font-family:${MONO};font-size:56px;line-height:60px;font-weight:700;color:${C.orange};letter-spacing:-1px;">${esc(b.big)}</p>` +
          `<p style="margin:8px 0 0 0;${text(15, "#FFFFFF")}">${esc(b.small)}</p>` +
          `</td></tr></table>`,
      );
    case "img":
      return row(
        `<img src="${IMAGES}/${b.name}.jpg" width="520" height="${b.h ?? 325}" alt="${esc(b.alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid ${C.line};border-radius:8px;background:${C.placeholder};${text(14, C.muted)}">`,
      );
    case "table": {
      const cell = (v, i, head) => {
        const strong = i === 1;
        const style = head
          ? text(12, i === 1 ? C.orange : C.muted, "font-weight:600;letter-spacing:1px;text-transform:uppercase;")
          : i === 0
            ? text(15, C.muted)
            : `font-family:${MONO};font-size:15px;line-height:22px;color:${strong ? C.ink : C.muted};${strong ? "font-weight:700;" : ""}`;
        return `<td valign="top" style="padding:12px 8px 12px 0;border-bottom:1px solid ${C.line};${style}">${esc(v)}</td>`;
      };
      const head = `<tr>${b.head.map((v, i) => cell(v, i, true)).join("")}</tr>`;
      const body = b.rows.map((r) => `<tr>${r.map((v, i) => cell(v, i, false)).join("")}</tr>`).join("");
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${head}${body}</table>`);
    }
    case "duel": {
      const side = (s, lit) =>
        `<td class="stack" width="50%" valign="top" style="padding:20px;background:${lit ? C.graphite : C.canvas};border-radius:8px;">` +
        `<p style="margin:0;${text(12, lit ? "#FFFFFF" : C.muted, "font-weight:600;letter-spacing:1px;text-transform:uppercase;")}">${esc(s.label)}</p>` +
        `<p style="margin:6px 0 0 0;font-family:${MONO};font-size:40px;line-height:46px;font-weight:700;color:${lit ? C.orange : C.ink};">${esc(s.big)}</p>` +
        `<p style="margin:6px 0 0 0;font-family:${MONO};font-size:12px;line-height:18px;color:${lit ? "#C9CDD3" : C.muted};">${esc(s.note)}</p></td>`;
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${side(b.left, true)}<td class="gap" width="12" style="font-size:0;line-height:0;">&nbsp;</td>${side(b.right, false)}</tr></table>`,
      );
    }
    case "steps":
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
          b.v
            .map(
              ([k, v], i) =>
                `<tr>` +
                (b.plain
                  ? ""
                  : `<td width="36" valign="top" style="padding:14px 0;border-top:1px solid ${C.line};font-family:${MONO};font-size:13px;line-height:24px;color:${C.orange};font-weight:700;">${String(i + 1).padStart(2, "0")}</td>`) +
                `<td valign="top" style="padding:14px 0;border-top:1px solid ${C.line};">` +
                `<p style="margin:0;${text(16, C.ink, "font-weight:700;")}">${esc(k)}</p>` +
                `<p style="margin:2px 0 0 0;${text(15, C.muted)}">${esc(v)}</p></td></tr>`,
            )
            .join("") +
          `</table>`,
      );
    case "list":
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
          b.v
            .map(
              (v) =>
                `<tr><td width="22" valign="top" style="padding:6px 0;${text(16, C.orange, "font-weight:700;")}">&#8212;</td><td valign="top" style="padding:6px 0;${text(16, C.ink)}">${rich(v)}</td></tr>`,
            )
            .join("") +
          `</table>`,
      );
    case "quotes":
      return row(
        b.v
          .map(
            (q) =>
              `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr><td style="padding:10px 16px;background:${C.canvas};border-radius:18px;${text(15, C.ink)}">&#8220;${esc(q)}&#8221;</td></tr></table>`,
          )
          .join(""),
      );
    case "badges":
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
          b.v
            .map(
              ([k, tag]) =>
                `<tr><td valign="middle" style="padding:12px 0;border-top:1px solid ${C.line};${text(16, C.ink, "font-weight:600;")}">${esc(k)}</td>` +
                `<td align="right" valign="middle" style="padding:12px 0;border-top:1px solid ${C.line};"><span style="display:inline-block;padding:3px 10px;border:1px solid ${C.orange};border-radius:20px;${text(11, C.orange, "font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:16px;")}">${esc(tag)}</span></td></tr>`,
            )
            .join("") +
          `</table>`,
      );
    case "callout":
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:18px 20px;border:1px solid ${C.ink};border-radius:8px;${text(16, C.ink, "font-weight:600;")}">${rich(b.v)}</td></tr></table>`,
      );
    default:
      throw new Error(`Unknown block ${b.t}`);
  }
}

function button(n) {
  const href = link(n);
  return (
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:54px;v-text-anchor:middle;width:340px;" arcsize="12%" stroke="f" fillcolor="${C.orange}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">${CTA}</center></v:roundrect><![endif]-->` +
    `<!--[if !mso]><!--><a href="${href}" style="display:inline-block;background:${C.orange};color:#FFFFFF;font-family:${FONT};font-size:17px;line-height:22px;font-weight:700;text-decoration:none;padding:16px 30px;border-radius:6px;mso-hide:all;">${CTA} &rarr;</a><!--<![endif]-->`
  );
}

function footer(e) {
  return (
    `<p style="margin:0 0 10px 0;${text(12, C.muted, "font-weight:700;letter-spacing:2px;")}">RENUABL</p>` +
    `<p style="margin:0 0 10px 0;${text(12, C.muted)}">RENUABL is a trading name of Reburthed Pty Ltd, ABN 96 662 374 905. Questions? <a href="mailto:hello@renuabl.com.au" style="color:${C.muted};text-decoration:underline;">hello@renuabl.com.au</a> or just reply.</p>` +
    `<p style="margin:0 0 10px 0;${text(12, C.muted)}">You're getting this because your business email address is published on your website or business listing as a solar retailer or installer, and RENUABL makes software for solar businesses. It's email ${e.n} of 8 in one short series over 30 days.</p>` +
    `<p style="margin:0;${text(12, C.muted)}">Not for you? <a href="{{unsubscribe}}" style="color:${C.ink};text-decoration:underline;">Unsubscribe</a> and you won't get any more.</p>`
  );
}

export function render(e) {
  const pad = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<!DOCTYPE html>
<html lang="en-AU" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(e.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,p,a,span,h1{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;family=JetBrains+Mono:wght@700&amp;display=swap" rel="stylesheet"><!--<![endif]-->
<style>
  body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
  @media screen and (max-width:620px){
    .px{padding-left:24px !important;padding-right:24px !important;}
    .h1{font-size:40px !important;line-height:42px !important;}
    .stack{display:block !important;width:auto !important;margin-bottom:12px !important;}
    .gap{display:none !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};" bgcolor="${C.canvas}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.canvas};opacity:0;">${esc(e.preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
  <tr><td style="padding:0 8px 16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:800;letter-spacing:3px;color:${C.ink};">RENUABL</td>
      <td align="right" style="font-family:${MONO};font-size:11px;line-height:20px;color:${C.faint};">${String(e.n).padStart(2, "0")} / 08</td>
    </tr></table>
  </td></tr>
  <tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.line};border-radius:10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:4px;line-height:4px;font-size:0;background:${C.orange};border-radius:10px 10px 0 0;">&nbsp;</td></tr>
      ${row(`<p style="margin:0;${text(12, C.orange, "font-weight:700;letter-spacing:2px;text-transform:uppercase;")}">${esc(e.eyebrow)}</p>`, "36px 40px 12px 40px")}
      ${row(`<h1 class="h1" style="margin:0;font-family:${FONT};font-size:52px;line-height:54px;font-weight:800;letter-spacing:-1.5px;color:${C.ink};">${e.headline.map(rich).join("<br>")}</h1>`, "0 40px 28px 40px")}
      ${e.blocks.map(block).join("\n      ")}
      ${row(button(e.n), "8px 40px 16px 40px")}
      ${row(`<p style="margin:0;${text(13, C.muted)}">${esc(e.ps)}</p>`, "0 40px 36px 40px")}
    </table>
  </td></tr>
  <tr><td style="padding:24px 8px 0 8px;">${footer(e)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const e of EMAILS) {
    const file = join(here, `${String(e.n).padStart(2, "0")}.html`);
    writeFileSync(file, render(e));
    console.log(`wrote ${file}`);
  }
}
