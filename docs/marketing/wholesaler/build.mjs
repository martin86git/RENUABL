// The wholesaler partner kit: the pictures and the two emails a wholesaler sends to its own trade customers.
// Run from the repo root: node docs/marketing/wholesaler/build.mjs
// Makes public/design/partner/hero.gif (animated, 1200 px wide for 600 px in the email), hero.jpg (its first frame,
// for clients that show no animation), video-thumb.jpg (for the Loom, once it's recorded) and, beside this file,
// email.html (the whole email) and newsletter-block.html (a block for the wholesaler's own newsletter).
// Don't run Prettier on the HTML (it breaks Outlook's conditional comments); docs/marketing/** HTML is in .prettierignore.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const SHOTS = join(ROOT, "public", "design", "landing");
const OUT = join(ROOT, "public", "design", "partner");

const SITE = "https://www.renuabl.com.au";
// The wholesaler's short name goes in WHOLESALER (as it should read) and SLUG (for the link's tracking).
const WHOLESALER = "{Wholesaler}";
const SLUG = "wholesaler";
// Book a demo: the front page with its box open. Nobody opens a demo account themselves (27 Nov 2026, Martin).
const DEMO = `${SITE}/?demo=1&utm_source=${SLUG}&utm_medium=email&utm_campaign=wholesaler-launch`;
const MORE = `${SITE}/business?utm_source=${SLUG}&utm_medium=email&utm_campaign=wholesaler-launch`;
const IMAGES = `${SITE}/design/partner`;
const LOOM = "{Loom link}";

const C = {
  stage: "#0d0e11",
  canvas: "#F2F3F5",
  surface: "#FFFFFF",
  ink: "#111418",
  muted: "#5B6270",
  faint: "#8A909B",
  line: "#E3E6EA",
  graphite: "#2B2F36",
  orange: "#FF5A1F",
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const SVG_FONT = "Segoe UI, Helvetica, Arial, sans-serif";

// ---- The pictures -------------------------------------------------------------------------------------------------

// Each frame: a real screen with made-up example data, and one line over it. Every line is something the product does.
const FRAMES = [
  { shot: "today-sol.webp", step: "01", line: "Sol lines up your day, most pressing first." },
  { shot: "deals.webp", step: "02", line: "Every deal in one pipeline. Who to call first." },
  { shot: "sol.webp", step: "03", line: "Ask Sol anything about solar. With his sources." },
  { shot: "service-sol.webp", step: "04", line: "Service cases, summed up with a next step." },
];

const W = 1200;
const H = 750;
const WIN = { x: 90, y: 150, w: 1020, h: 560 };

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stageSvg(step, line, total, index) {
  const dots = Array.from({ length: total }, (_, i) => {
    const x = W / 2 - ((total - 1) * 22) / 2 + i * 22;
    return `<rect x="${x - (i === index ? 9 : 4)}" y="${H - 22}" width="${i === index ? 18 : 8}" height="6" rx="3" fill="${i === index ? C.orange : "#4a4e57"}"/>`;
  }).join("");
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="0%" r="75%">
      <stop offset="0" stop-color="${C.orange}" stop-opacity="0.32"/>
      <stop offset="0.55" stop-color="${C.orange}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${C.stage}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.stage}"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="${WIN.x}" y="62" font-family="${SVG_FONT}" font-size="17" font-weight="600" letter-spacing="5" fill="#ffffff">RENUABL</text>
  <text x="${WIN.x + 112}" y="62" font-family="${SVG_FONT}" font-size="17" fill="#9aa0aa">Business</text>
  <text x="${WIN.x + WIN.w}" y="62" text-anchor="end" font-family="${SVG_FONT}" font-size="17" fill="${C.orange}" font-weight="600">${step}</text>
  <text x="${WIN.x}" y="112" font-family="${SVG_FONT}" font-size="34" font-weight="600" fill="#ffffff">${escapeXml(line)}</text>
  <rect x="${WIN.x - 1}" y="${WIN.y - 1}" width="${WIN.w + 2}" height="${WIN.h + 2}" rx="15" fill="#2a2d33"/>
  ${dots}
</svg>`);
}

function windowMask() {
  return Buffer.from(
    `<svg width="${WIN.w}" height="${WIN.h}" xmlns="http://www.w3.org/2000/svg"><rect width="${WIN.w}" height="${WIN.h}" rx="14" fill="#fff"/></svg>`,
  );
}

async function frame({ shot, step, line }, index) {
  const screen = await sharp(join(SHOTS, shot))
    .resize(WIN.w, WIN.h, { fit: "cover", position: "top" })
    .composite([{ input: windowMask(), blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(stageSvg(step, line, FRAMES.length, index))
    .composite([{ input: screen, left: WIN.x, top: WIN.y }])
    .png()
    .toBuffer();
}

function playButton() {
  const cx = W / 2;
  const cy = WIN.y + WIN.h / 2;
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}" rx="14" fill="#0d0e11" fill-opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="58" fill="${C.orange}"/>
  <path d="M ${cx - 16} ${cy - 26} L ${cx + 28} ${cy} L ${cx - 16} ${cy + 26} Z" fill="#ffffff"/>
  <rect x="${cx - 108}" y="${cy + 82}" width="216" height="40" rx="20" fill="#0d0e11" fill-opacity="0.8"/>
  <text x="${cx}" y="${cy + 108}" text-anchor="middle" font-family="${SVG_FONT}" font-size="18" fill="#ffffff">Watch · 90 seconds</text>
</svg>`);
}

async function pictures() {
  mkdirSync(OUT, { recursive: true });
  const frames = [];
  for (const [i, f] of FRAMES.entries()) frames.push(await frame(f, i));

  await sharp(frames[0]).jpeg({ quality: 82, mozjpeg: true }).toFile(join(OUT, "hero.jpg"));
  await sharp(frames[0])
    .composite([{ input: playButton() }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(OUT, "video-thumb.jpg"));

  // The GIF at 600 px: email clients show it at 600 anyway, and GIF size grows fast with pixels.
  const small = await Promise.all(frames.map((f) => sharp(f).resize(600).png().toBuffer()));
  await sharp(small, { join: { animated: true } })
    .gif({ delay: small.map(() => 2800), loop: 0, effort: 10, colours: 128, dither: 0.6 })
    .toFile(join(OUT, "hero.gif"));
}

// ---- The emails ---------------------------------------------------------------------------------------------------

export const COPY = {
  subject: "Solar just got a brain",
  subjectB: "Software for solar businesses, with AI built in",
  preheader: "Design, CRM, proposals and service in one platform. Book a demo and see it at work.",
  eyebrow: "For solar retailers and installers",
  headline: "Solar just got a brain.",
  paras: [
    `Hi {firstName},`,
    `We've been talking with RENUABL, an Australian team building software for solar retailers and installers, and we think it's worth a look.`,
    `RENUABL Business puts the whole job in one place. Draw a roof and it's priced as you draw. Send a proposal under your own brand that your customer accepts online. Once it's signed, the order, the install calendar and the installer's job card follow on.`,
    `Built into it is Sol, an AI that works inside your deals. He lines up who to call next, drafts the follow-up and answers questions on solar and the standards, with his sources. He never sends anything without you.`,
  ],
  demoLine: "Book a demo and someone from RENUABL will show you round on a short video call, with example customers and deals.",
  cta: "Book a demo",
  videoLine: "Rather watch first? Here's a 90-second walkthrough.",
  price: "$99 a user a month, and the first month is $29 a user. Prices include GST. Cancel any time.",
  about: "RENUABL Business is made by Reburthed Pty Ltd trading as RENUABL, ABN 96 662 374 905.",
  newsletter: {
    heading: "Solar just got a brain",
    words:
      "RENUABL Business is software for solar retailers and installers: roof design that prices as you draw, branded proposals customers accept online, and everything after the sale in one place. Sol, its built-in AI, lines up your day and drafts your follow-ups. Book a demo and someone from RENUABL will show you round.",
  },
};

function button(href, label) {
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="50%" stroke="f" fillcolor="${C.orange}"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${href}" style="display:inline-block;background:${C.orange};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;line-height:48px;padding:0 32px;border-radius:24px;text-decoration:none;">${label}</a><!--<![endif]-->`;
}

function p(text, extra = "") {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink};${extra}">${text}</p>`;
}

function email() {
  const c = COPY;
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<title>${c.subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${C.surface};border-radius:16px;overflow:hidden;">
<tr><td style="padding:0;"><a href="${DEMO}"><img src="${IMAGES}/hero.gif" width="600" alt="RENUABL Business at work: Sol lining up the day, the sales pipeline, Sol answering a solar question and a service case. Example data." style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:36px 40px 8px;">
<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.orange};font-weight:600;">${c.eyebrow}</p>
<h1 style="margin:0 0 24px;font-family:${FONT};font-size:32px;line-height:1.15;font-weight:600;color:${C.ink};letter-spacing:-0.5px;">${c.headline}</h1>
${c.paras.map((t) => p(t)).join("\n")}
${p(c.demoLine)}
</td></tr>
<tr><td align="left" style="padding:8px 40px 28px;">${button(DEMO, c.cta)}</td></tr>
<tr><td style="padding:0 40px 8px;">
${p(`${c.videoLine} <a href="${LOOM}" style="color:${C.orange};">Watch it</a>.`, `font-size:15px;color:${C.muted};`)}
${p(`${c.price} <a href="${MORE}" style="color:${C.ink};">More about RENUABL Business</a>.`, `font-size:15px;color:${C.muted};`)}
</td></tr>
<tr><td style="padding:16px 40px 32px;border-top:1px solid ${C.line};">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">${c.about}</p>
<p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">{${WHOLESALER.slice(1, -1)}'s own footer: why they're receiving this, address, unsubscribe link}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

function newsletterBlock() {
  const n = COPY.newsletter;
  return `<!-- RENUABL Business: a block for ${WHOLESALER}'s newsletter. 600 px wide, inline styles. -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
<tr><td style="padding:0;"><a href="${DEMO}"><img src="${IMAGES}/hero.jpg" width="600" alt="RENUABL Business: Sol lining up the day, with example data." style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:24px 28px 8px;">
<h2 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.25;font-weight:600;color:${C.ink};">${n.heading}</h2>
${p(n.words, "font-size:15px;")}
</td></tr>
<tr><td style="padding:0 28px 26px;">${button(DEMO, COPY.cta)}</td></tr>
</table>
`;
}

await pictures();
writeFileSync(join(HERE, "email.html"), email());
writeFileSync(join(HERE, "newsletter-block.html"), newsletterBlock());
console.log("Built the partner kit.");
