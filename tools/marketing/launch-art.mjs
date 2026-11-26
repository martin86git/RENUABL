/**
 * The launch emails' pictures (22 Nov 2026, Martin: "imagery should be high end", influenced by Tesla, SpaceX and Apple;
 * then "a consistent sol sunbrain icon as per the homepage", "complimentary animations (like on the website) showing a
 * call in progress", "stacked cards in a staggered format", Sol, the voice agent's audio icon and the AI designer shown
 * as products, Apple style, and "bring it home with the 90's style direct marketing").
 *
 * Each picture is a page drawn here in the product's own marks (Sol's sun as sol-icon.tsx draws him, the voice agents'
 * sound wave on graphite as the homepage draws it, the designer's orange round, the product's own icons and
 * screenshots), taken by headless Chrome over the DevTools protocol. Moving ones are taken frame by frame (each page has
 * `window.at(t)`, t from 0 to 1) and written as GIFs, the only animation email apps play; still ones as JPEGs. Sol's
 * own GIF is filmed off the live homepage, so he is the same sun: run the dev server first (port 3100, or the second
 * argument). Everything lands in marketing/launch/ (private, never served by the site), where /api/design/marketing/gtm reads it into RENUABL's
 * Marketing pictures. Made-up customers only, no stock photos, nobody else's marks.
 *
 *   node tools/marketing/launch-art.mjs [only-this-one] [port]
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("marketing/launch");
const ONLY = process.argv[2] && process.argv[2] !== "all" ? process.argv[2] : null;
const SITE = `http://localhost:${process.argv[3] ?? "3100"}`;
const W = 1200;
const H = 675;
/** GIFs go at 800 px: email apps show them at 536, so a little over for sharp screens, and a GIF's size grows fast with its pixels. */
const GIF_W = 800;
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "renuabl-art-"));
/** RENUABL's logo as the website has it (public/brand/renuabl-logo-white.png, the wordmark at weight 400, wide spaced). */
const LOGO_FILE = resolve("public/brand/renuabl-logo-white.png");
const LOGO = pathToFileURL(LOGO_FILE).href;
// RENUABL-only shots live in marketing/launch/source (private); the rest are the sales page's own public screenshots.
const OWN_SHOTS = resolve("marketing/launch/source");
const shot = (f) => pathToFileURL(existsSync(resolve(OWN_SHOTS, f)) ? resolve(OWN_SHOTS, f) : resolve("public/design/landing", f)).href;
/** A frame of the designer at work, cut from a screen recording of a real design (the map and its figures only: no address, no customer). */
/** What each frame of the design being made says, in order: a caption per step, held over the frames it covers. */
const BUILD_SAYS = [
  "Start with the roof.",
  "Drag out a row of panels.",
  "Turn it to the roof.",
  "Turn it to the roof.",
  "Set the tilt.",
  "The quote builds as you go.",
  "The quote builds as you go.",
  "The quote builds as you go.",
  "Shade read on every panel.",
  "Choose the inverter.",
  "Add a battery.",
  "Designed and priced as you draw.",
];
const BUILD_FRAMES = BUILD_SAYS.length;
const build = (n) => pathToFileURL(resolve(OWN_SHOTS, "designer-build", `${n}.webp`)).href;
/** One example morning, as the log picture types it: a time and what happened. Each is something the product does. */
const LOG = [
  ["09:00", "A lead comes in."],
  ["09:05", "Sol emails them their home from above."],
  ["09:06", "Your voice agent rings them."],
  ["09:14", "Questions answered. Call booked."],
  ["09:15", "Written up, on the deal."],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The product's own marks ------------------------------------------------------------------------------------

/** Sol's mark as sol-icon.tsx draws him (SolMark): the sun, the brain etched in it, the light on his top edge, his orbit. */
const BRAIN_HALF = [
  "M52 20C40 22 34 30 38 38C42 46 30 46 24 40",
  "M17 54C28 50 34 56 30 64C26 72 36 76 44 72",
  "M54 40C46 42 44 50 50 54C56 58 50 66 44 62",
  "M22 78C30 80 32 88 40 88C48 88 50 80 56 82",
  "M36 99C42 94 48 98 54 96",
  "M27 28C25 34 19 36 17 44",
];
const folds = () =>
  BRAIN_HALF.map((d) => `<path d="${d}"/>`).join("") +
  `<g transform="translate(120 0) scale(-1 1)">${BRAIN_HALF.map((d) => `<path d="${d}"/>`).join("")}</g><path d="M60 15C57 30 63 45 60 60C57 75 63 90 60 105"/>`;
let solId = 0;
const SOL = (size) => {
  const id = `s${++solId}`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="flex:none">
  <defs><radialGradient id="${id}a" cx="9.4" cy="8.2" r="13.5" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF1C2"/><stop offset=".22" stop-color="#FFD27A"/><stop offset=".58" stop-color="#FF8A3D"/><stop offset=".9" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E8480F"/></radialGradient>
  <radialGradient id="${id}b" cx="12" cy="12" r="12" gradientUnits="userSpaceOnUse"><stop offset=".72" stop-color="#FF8A3D" stop-opacity=".38"/><stop offset="1" stop-color="#FF5A1F" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}c" x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF5A1F" stop-opacity="0"/><stop offset=".55" stop-color="#FF8A3D" stop-opacity=".55"/><stop offset="1" stop-color="#FFD27A"/></linearGradient>
  <clipPath id="${id}d"><circle cx="12" cy="12" r="9"/></clipPath></defs>
  <circle cx="12" cy="12" r="12" fill="url(#${id}b)"/><circle cx="12" cy="12" r="9" fill="url(#${id}a)"/>
  <g clip-path="url(#${id}d)"><g transform="scale(0.2)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#B8360A" stroke-opacity=".38" stroke-width="2.6">${folds()}</g>
    <g stroke="#FFF1C2" stroke-opacity=".35" stroke-width="1.2" transform="translate(1.2 1.4)">${folds()}</g></g></g>
  <path d="M5.9 8.6A7.2 7.2 0 0 1 13.4 4.9" stroke="#fff" stroke-opacity=".55" stroke-width=".7" stroke-linecap="round"/>
  <path d="M4.07 19.93A11.2 11.2 0 1 1 19.93 4.07" stroke="url(#${id}c)" stroke-width=".55" stroke-linecap="round"/>
  <circle cx="19.93" cy="4.07" r="1.15" fill="#FFD27A"/><circle cx="19.93" cy="4.07" r=".5" fill="#fff"/></svg>`;
};

/** A voice agent as the homepage draws it (AgentWave): its sound wave on graphite, in its own colour, a glow behind. */
const WAVE = [0.45, 0.8, 1, 0.65, 0.4];
const AGENT = (size, tint, cls = "") => `<span class="agent ${cls}" style="width:${size}px;height:${size}px;--tint:${tint}">
  <span class="agent-glow"></span><span class="agent-bars" style="height:${size * 0.42}px;gap:${Math.max(3, size / 20)}px">
  ${WAVE.map((v, i) => `<i data-v="${v}" data-i="${i}" style="height:${v * 100}%;width:${Math.max(3, size / 16)}px"></i>`).join("")}</span></span>`;

/** The designer's orange round from the menu, with the pen tool on it. */
const DESIGNER = (size) => `<span class="orb" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size * 0.42}" height="${size * 0.42}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg></span>`;

/** A product icon on graphite (the note-taker's notebook). */
const NOTEBOOK = (size) => `<span class="graphite" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size * 0.44}" height="${size * 0.44}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg></span>`;

/** Speed to lead: a bolt on graphite. */
const BOLT = (size) => `<span class="graphite" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size * 0.44}" height="${size * 0.44}" fill="none" stroke="#ff7a2e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></span>`;

/** The install calendar's icon on graphite. */
const CALENDAR = (size) => `<span class="graphite" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size * 0.44}" height="${size * 0.44}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/></svg></span>`;

/**
 * The ground every picture sits on (26 Nov 2026, Martin: "the black in all the marketing emails is too harsh. lets
 * soften it"): a soft graphite, not black. An email's own dark panels use the same colour, so picture and panel meet
 * without a seam. Change it here and redraw everything.
 */
const GROUND = "#1d1f25";
const GROUND_RGB = "29,31,37";
/** The rounds that sit on the ground (a voice agent's, the designer's): a step lighter than it, so they still read. */
const ROUND = "#2f323a";
const BASE = `*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:${GROUND};color:#fff;
  font-family:Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .mark{position:absolute;right:52px;bottom:40px;width:132px;height:auto;opacity:.75}
  .agent{position:relative;display:inline-grid;place-items:center;border-radius:50%;background:${ROUND};flex:none;
    box-shadow:0 18px 40px -18px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.08)}
  .agent-glow{position:absolute;inset:-14%;border-radius:50%;background:color-mix(in srgb,var(--tint) 30%,transparent);filter:blur(16px);opacity:.5}
  .agent-bars{position:relative;display:flex;align-items:center}.agent-bars i{display:block;border-radius:9px;background:var(--tint)}
  .orb{display:inline-grid;place-items:center;border-radius:50%;flex:none;
    background:radial-gradient(circle at 35% 25%,#ffb08a 0 10%,#ff6a2c 45%,#e8470f 100%);
    box-shadow:inset 0 2px 1px rgba(255,255,255,.55),inset 0 -3px 6px rgba(140,30,0,.3),0 10px 24px rgba(255,90,31,.4)}
  .graphite{display:inline-grid;place-items:center;border-radius:50%;background:${ROUND};flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}`;

const page = (body, css = "", script = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}<script>
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
  const span = (t, a, b) => ease((t - a) / (b - a));
  /** The bars of every agent beat with t. */
  function beat(t, on = 1) {
    document.querySelectorAll(".agent-bars i").forEach((el) => {
      const v = +el.dataset.v, i = +el.dataset.i;
      const k = on ? 0.35 + 0.65 * Math.abs(Math.sin(t * 40 + i * 1.3)) : 1;
      el.style.height = Math.max(18, v * 100 * k) + "%";
    });
  }
  ${script}</script></body></html>`;

// ---- The pictures -----------------------------------------------------------------------------------------------

/** The voice email's agent (26 Nov 2026): an example name in its own colour, its opening line and what a business chooses for it. */
const VOICE_TINT = "#a78bfa";
const VOICE_OPENING = "Hi, it's Gary, Sunrise Solar's automated assistant. Have you got a few minutes?";
const VOICE_TAGS = ["Named by you", "Voice chosen by you", "Follows your script", "Always says it's automated"];
const ico = (d, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  phone: ico(
    '<path d="M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5a2 2 0 0 1 1.6-.8h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.600l-.5.4a1 1 0 0 0-.3 1.200 14 14 0 0 0 6.400 6.400"/>',
  ),
  chat: ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  mail: ico('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  search: ico('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.300-4.300"/>'),
  hang: ico(
    '<path d="M10.700 13.300a14 14 0 0 1-2.300-3.100 1 1 0 0 1 .3-1.200l.5-.4A2 2 0 0 0 10 7V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2 18 18 0 0 0 3.500 10.500"/><path d="M22 2 2 22"/><path d="M14.500 16.200a1 1 0 0 0 .5.100l.4-.500a2 2 0 0 1 1.600-.800h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-9.500-2.700"/>',
    16,
  ),
};

const CARDS = [
  { icon: AGENT(56, "#ff5a1f"), head: "Your customers, answered.", sub: "Voice agents ring every new lead" },
  { icon: "%%SOL%%", head: "Your emails, written.", sub: "Sol drafts every follow-up in your voice" },
  { icon: NOTEBOOK(56), head: "Your calls, written up.", sub: "The note-taker fills in the deal" },
  { icon: "%%SOL%%", head: "Your super-intelligent advisor.", sub: "Sol knows every deal, and the trade" },
  { icon: DESIGNER(56), head: "Your quotes, priced as you draw.", sub: "You lay the panels, the price follows" },
  { icon: AGENT(56, "#2bb5a0"), head: "Your installs, on one calendar.", sub: "Orders, approvals and job cards together" },
];

/**
 * A feature explained on one card (22 Nov 2026, Martin: follow-up emails with card explainers, the text "typed up by
 * Sol" rather than static): the card comes in with the feature's own icon and headline, then Sol, beside his sun, types
 * the line under it. The same words are the picture's alt text.
 */
const EXPLAINERS = {
  "explain-voice.gif": {
    icon: AGENT(88, "#ff5a1f"),
    head: "Your customers, answered.",
    says: "Your voice agent rings each new lead within minutes, answers their questions and books them in. It always says it's your automated assistant.",
  },
  "explain-lead.gif": {
    icon: BOLT(88),
    head: "Every lead, answered in minutes.",
    says: "A new lead comes in. Within minutes I've emailed them their home from above, and your voice agent is ringing them. In your hours, every time.",
  },
  "explain-designer.gif": {
    icon: DESIGNER(88),
    head: "Priced as you draw.",
    says: "You lay out the panels and the quote builds as you go. Your customer chooses a design and signs online.",
  },
  "explain-crm.gif": {
    icon: NOTEBOOK(88),
    head: "Your calls, written up.",
    says: "I write up your calls, draft your follow-ups and turn emailed leads into deals. You do the selling.",
  },
  "explain-runs.gif": {
    icon: CALENDAR(88),
    head: "After the sale, in one place.",
    says: "Once they sign, the order, approvals, install calendar and your installer's job card are in one place for your team.",
  },
};

const explainer = ({ icon, head, says }) =>
  page(
    `<div class="sky"></div><div class="card"><div class="top">${icon}<h2>${head}</h2></div><hr>
      <div class="sol">%%SOLBIG%%<p data-text="${says.replace(/"/g, "&quot;")}"></p></div></div><img class="mark" src="${LOGO}" alt="RENUABL">`,
    `.sky{position:absolute;inset:0;background:radial-gradient(ellipse at 80% 110%,rgba(255,90,31,.3),transparent 55%)}
     .card{position:absolute;left:90px;top:128px;width:1020px;border-radius:36px;padding:52px 60px;
       background:linear-gradient(180deg,rgba(40,43,50,.97),rgba(22,24,29,.97));border:1px solid rgba(255,255,255,.1);
       box-shadow:0 40px 100px -30px rgba(0,0,0,.95),inset 0 1px 0 rgba(255,255,255,.08)}
     .top{display:flex;align-items:center;gap:30px}.top h2{font-size:54px;font-weight:600;letter-spacing:-.03em}
     hr{border:0;border-top:1px solid rgba(255,255,255,.1);margin:40px 0 34px}
     .sol{display:flex;gap:26px;align-items:flex-start}.sol p{font-size:31px;line-height:1.45;color:rgba(255,255,255,.9);min-height:3em}
     .sol p b{display:inline-block;width:3px;height:1em;margin-left:3px;background:#ff7a2e;vertical-align:-.12em}`,
    `const p = document.querySelector(".sol p"); const text = p.dataset.text; const card = document.querySelector(".card");
     window.at = (t) => {
       const k = span(t, 0, 0.12);
       card.style.opacity = k; card.style.transform = "translateY(" + (1 - k) * 30 + "px)";
       const n = Math.round(text.length * span(t, 0.18, 0.9));
       const on = n < text.length ? Math.round(t * 60) % 2 === 0 : false;
       p.innerHTML = text.slice(0, n).replace(/&/g, "&amp;").replace(/</g, "&lt;") + (on || n === 0 ? "<b></b>" : "");
       beat(t);
     };`,
  );

/**
 * The real product, as each email's proof (22 Nov 2026, Martin: "add a screenshot from the actual portal that aligns with
 * the email messaging"): a part of a screenshot taken in the portal on the local example business (made-up customers),
 * framed as a window on black. `crop` is the part shown, as shares of the screenshot.
 */
const product = (file, crop, tag) => {
  const fw = Math.min(1080, (560 * crop.w * 1.6) / crop.h);
  const fh = (fw * crop.h) / (crop.w * 1.6);
  return page(
    `<div class="glow"></div><div class="frame" style="width:${fw}px;height:${fh}px;left:${(W - fw) / 2}px;top:${(H - fh) / 2 - 8}px">
      <div class="shot" style="background-image:url('${shot(file)}');background-size:${100 / crop.w}% ${100 / crop.h}%;background-position:${(crop.x / (1 - crop.w)) * 100}% ${(crop.y / (1 - crop.h)) * 100}%"></div></div>
      <div class="tag">${tag}</div><img class="mark" src="${LOGO}" alt="RENUABL">`,
    `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 112%,rgba(255,90,31,.34),transparent 58%)}
     .frame{position:absolute;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.16);box-shadow:0 40px 120px rgba(0,0,0,.85)}
     .shot{position:absolute;inset:0;background-repeat:no-repeat}
     .tag{position:absolute;left:52px;bottom:40px;color:rgba(255,255,255,.5);font-size:13px;letter-spacing:.24em;text-transform:uppercase}`,
  );
};

/** Each picture: a page, and for a moving one how many frames, how long each shows and how long the last holds. */
const ART = {
  /** The launch: the products as a staggered stack of cards, dealt in one by one. */
  "cards.gif": {
    frames: 30,
    delay: 70,
    hold: 3600,
    html: page(
      `<div class="sky"></div>${CARDS.map(
        (c, i) => `<div class="card" style="left:${96 + i * 74}px;top:${34 + i * 99}px;z-index:${i}">
          ${c.icon}<div><b>${c.head}</b><em>${c.sub}</em></div></div>`,
      ).join("")}<img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.sky{position:absolute;inset:0;background:radial-gradient(ellipse at 78% 105%,rgba(255,90,31,.32),transparent 55%),radial-gradient(ellipse at 10% 0%,rgba(90,140,255,.08),transparent 50%)}
       .card{position:absolute;width:560px;height:92px;display:flex;align-items:center;gap:20px;padding:0 26px;border-radius:24px;
         background:linear-gradient(180deg,rgba(40,43,50,.96),rgba(24,26,31,.96));border:1px solid rgba(255,255,255,.1);
         box-shadow:0 24px 60px -20px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.08)}
       .card b{display:block;font-size:25px;font-weight:600;letter-spacing:-.02em}
       .card em{display:block;font-style:normal;font-size:15px;color:rgba(255,255,255,.55);margin-top:3px}`,
      `window.at = (t) => {
        document.querySelectorAll(".card").forEach((el, i) => {
          const k = span(t, i * 0.11, i * 0.11 + 0.22);
          el.style.opacity = k; el.style.transform = "translate(" + (1 - k) * 40 + "px," + (1 - k) * 24 + "px) scale(" + (0.96 + 0.04 * k) + ")";
        });
        beat(t);
      };`,
    ),
  },

  /** The AI sales force: a voice agent on a call, its words as they are said, and the call booked. */
  "call.gif": {
    frames: 44,
    delay: 110,
    hold: 3200,
    html: page(
      `<div class="sky"></div>
       <div class="who">${AGENT(176, "#ff5a1f", "big")}<b>Charlie</b><span>Sales agent · Sunrise Solar</span>
         <em><i></i>On a call · <tt id="clock">0:31</tt></em></div>
       <div class="talk">
         <div class="b a"><s>Charlie</s><p data-text="Hi Jo, it's Charlie, Sunrise Solar's automated assistant. You asked about solar?"></p></div>
         <div class="b c"><s>Jo</s><p data-text="Yes. Is a battery worth it?"></p></div>
         <div class="b a"><s>Charlie</s><p data-text="With most of your power used after dark, it can be. Shall I book you a time with the team?"></p></div>
         <div class="b c"><s>Jo</s><p data-text="Thursday after four."></p></div>
         <div class="booked">✓ Booked · Thursday 4:30 pm</div>
       </div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.sky{position:absolute;inset:0;background:radial-gradient(circle at 23% 46%,rgba(255,90,31,.28),transparent 34%)}
       .who{position:absolute;left:92px;top:118px;width:300px;display:flex;flex-direction:column;align-items:center;text-align:center}
       .who b{margin-top:28px;font-size:30px;font-weight:600;letter-spacing:-.02em}.who span{font-size:16px;color:rgba(255,255,255,.55);margin-top:4px}
       .who em{margin-top:16px;font-style:normal;font-size:15px;color:#ff8f4a;font-family:"JetBrains Mono",Consolas,monospace}
       .who em i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5a1f;margin-right:8px;box-shadow:0 0 10px #ff5a1f}
       .big .agent-glow{inset:-30%;filter:blur(30px)}
       .talk{position:absolute;left:470px;top:70px;width:640px}
       .b{width:420px;border-radius:20px;padding:14px 18px;margin-bottom:12px;background:#fff;color:#0b0b0c;box-shadow:0 18px 40px -20px rgba(0,0,0,.9)}
       .b.c{margin-left:auto;background:#2a2d34;color:#fff}
       .b s{display:block;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#ff5a1f}
       .b.c s{color:rgba(255,255,255,.5)}.b p{font-size:17px;line-height:1.4;margin-top:4px;min-height:1.4em}
       .booked{display:inline-block;margin-top:6px;padding:12px 20px;border-radius:999px;background:#ff5a1f;color:#fff;font-weight:600;font-size:17px;
         box-shadow:0 10px 30px rgba(255,90,31,.5)}`,
      `const bubbles = [...document.querySelectorAll(".b")];
       const slots = [[0.02, 0.28], [0.3, 0.42], [0.44, 0.72], [0.74, 0.84]];
       window.at = (t) => {
         bubbles.forEach((b, i) => {
           const [a, z] = slots[i];
           b.style.display = t >= a ? "block" : "none";
           const p = b.querySelector("p"); const text = p.dataset.text;
           p.textContent = text.slice(0, Math.round(text.length * Math.min(1, span(t, a, z) * 1.02)));
         });
         const k = span(t, 0.88, 0.97); const bk = document.querySelector(".booked");
         bk.style.opacity = k; bk.style.transform = "translateY(" + (1 - k) * 14 + "px)";
         document.getElementById("clock").textContent = "0:" + String(31 + Math.floor(t * 24)).padStart(2, "0");
         beat(t, t < 0.97);
       };`,
    ),
  },

  /**
   * The AI designer, as the website shows it (22 Nov 2026, Martin: "the designer needs to use [the website's site]… and
   * then use a second address… never disclose the addresses"): two real roofs designed in RENUABL's designer, taken in
   * the portal on the local example business under made-up labels, staggered side by side (a GIF of them weighed nearly 2 MB, so it is a still). Their files are named by
   * number, never by street, and nothing in the pictures names either.
   */
  "designer.jpg": {
    html: page(
      `<div class="glow"></div><div class="frame f1"><img src="${shot("designer-site-1.webp")}"></div><div class="frame f2"><img src="${shot("designer-site-2.webp")}"></div>
       <div class="tag">In RENUABL · The designer</div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 112%,rgba(255,90,31,.34),transparent 58%)}
       .frame{position:absolute;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.16);box-shadow:0 40px 100px rgba(0,0,0,.85)}
       .f1{left:48px;top:56px;width:780px;height:482px}.f2{left:600px;top:350px;width:552px;height:225px}
       .frame img{width:100%;height:100%;object-fit:cover}
       .tag{position:absolute;left:52px;bottom:40px;color:rgba(255,255,255,.5);font-size:13px;letter-spacing:.24em;text-transform:uppercase}`,
    ),
  },

  /**
   * The designer in every email (22 Nov 2026, Martin: "important in all emails to have a view of the designer in it…
   * so that the recipient also doesnt mistake this for some irrelevant promotional marketing"): a band under the last
   * part of every email but the designer's. Since 26 Nov 2026 it is a system Martin designed on a real roof, cut from
   * his screen recording: the finished design with its figures across the top (the map only; no address, no customer).
   */
  "designer-band.jpg": {
    clipH: 609,
    html: page(
      `<div class="glow"></div><div class="frame"><img src="${build(BUILD_FRAMES)}"></div>
       <div class="tag">Made for solar · The RENUABL designer</div><img class="mark" src="${LOGO}" alt="RENUABL" style="top:567px;bottom:auto">`,
      `.glow{position:absolute;left:0;right:0;top:0;height:609px;background:radial-gradient(ellipse at 50% 100%,rgba(255,90,31,.32),transparent 60%)}
       .frame{position:absolute;left:48px;top:28px;width:1104px;height:519px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.85)}
       .frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
       .tag{position:absolute;left:52px;top:571px;color:rgba(255,255,255,.6);font-size:13px;letter-spacing:.24em;text-transform:uppercase}`,
    ),
  },

  /**
   * The same design being made (26 Nov 2026, Martin: "if i record designing the system can you use snippets from that?"):
   * twelve quick cuts from the recording with a caption on each step (`BUILD_SAYS`): the bare roof, a row dragged out
   * and turned, the tilt, the shade read on each panel, the inverter and the battery, the figures across the top
   * changing as it grows. Not in the drafts by itself:
   * it is dropped into a picture block by hand where a moving one is wanted.
   */
  "designer-build.gif": {
    clipH: 609,
    frames: BUILD_FRAMES,
    delay: 620,
    hold: 3400,
    colours: 96,
    photo: true,
    html: page(
      `<div class="glow"></div><div class="frame">${Array.from({ length: BUILD_FRAMES }, (_, i) => `<img data-f="${i}" src="${build(i + 1)}">`).join("")}<div class="fade"></div><div class="say" id="say"></div><div class="bar"><i id="bar"></i></div></div>
       <div class="tag">Made for solar · The RENUABL designer</div><img class="mark" src="${LOGO}" alt="RENUABL" style="top:567px;bottom:auto">`,
      `.glow{position:absolute;left:0;right:0;top:0;height:609px;background:radial-gradient(ellipse at 50% 100%,rgba(255,90,31,.32),transparent 60%)}
       .frame{position:absolute;left:48px;top:28px;width:1104px;height:519px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.85)}
       .frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
       .tag{position:absolute;left:52px;top:571px;color:rgba(255,255,255,.6);font-size:13px;letter-spacing:.24em;text-transform:uppercase}
       .fade{position:absolute;left:0;right:0;bottom:0;height:170px;background:linear-gradient(to top,rgba(${GROUND_RGB},.92),rgba(${GROUND_RGB},.55) 55%,transparent)}
       .say{position:absolute;left:32px;right:32px;bottom:30px;font-size:40px;font-weight:600;letter-spacing:-.02em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)}
       .bar{position:absolute;left:0;right:0;bottom:0;height:6px;background:rgba(255,255,255,.14)}.bar i{display:block;height:100%;width:0;background:#ff5a1f}`,
      `const SAYS = ${JSON.stringify(BUILD_SAYS)}; window.at = (t) => { const n = Math.round(t * (${BUILD_FRAMES} - 1)); document.querySelectorAll("[data-f]").forEach((el) => { el.style.opacity = +el.dataset.f <= n ? 1 : 0; }); document.getElementById("say").textContent = SAYS[n]; document.getElementById("bar").style.width = ((n + 1) / SAYS.length) * 100 + "%"; }; window.at(0);`,
    ),
  },

  /**
   * "09:00. A lead comes in." (26 Nov 2026, Martin: "lets create another marketing email. get creative with it the way
   * xAi would"): stark black, monospace, almost no words. A log of one example morning typed a line at a time, ending
   * on the line the email is about. Every line is something the product does in the business's own hours; the times
   * are an example and the picture says so.
   */
  "log.gif": {
    frames: LOG.length + 2,
    delay: 720,
    hold: 3600,
    colours: 48,
    html: page(
      `<div class="grid"></div><div class="top"><i></i>SOL // LIVE LOG<b>EXAMPLE MORNING</b></div>
       <div class="log">${LOG.map(([t, l], i) => `<p data-l="${i}"><span>${t}</span>${l}</p>`).join("")}</div>
       <h1 id="end">You were with another customer.</h1><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `body{background:${GROUND}}.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(ellipse at 30% 40%,#000,transparent 75%)}
       .top{position:absolute;left:84px;top:64px;font-family:"JetBrains Mono",Consolas,monospace;font-size:15px;letter-spacing:.22em;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:14px}
       .top i{width:9px;height:9px;border-radius:50%;background:#ff5a1f;box-shadow:0 0 14px #ff5a1f}.top b{font-weight:400;color:rgba(255,255,255,.3);margin-left:18px}
       .log{position:absolute;left:84px;top:132px;font-family:"JetBrains Mono",Consolas,monospace;font-size:29px;line-height:58px;color:#fff}
       .log p{opacity:0;white-space:nowrap}.log span{color:#ff6a2c;margin-right:34px}
       h1{position:absolute;left:84px;top:494px;font-size:66px;font-weight:600;letter-spacing:-.045em;opacity:0}`,
      `window.at = (t) => { const n = Math.round(t * ${LOG.length + 1}); document.querySelectorAll("[data-l]").forEach((el) => { el.style.opacity = +el.dataset.l < n ? 1 : 0; }); document.getElementById("end").style.opacity = n > ${LOG.length} ? 1 : 0; }; window.at(0);`,
    ),
  },

  /** The same email's second picture: what the voice agent costs, said flat. The figure is Calls & Texts' monthly price over a month's days. */
  "aday.jpg": {
    html: page(
      `<div class="top"><i></i>CALLS &amp; TEXTS // YOUR VOICE AGENT</div><p class="pre">Less than</p><div class="fig">$2<small>a day.</small></div>
       <p class="dry">Cheaper than a coffee. Doesn't need a ute.</p>
       <p class="foot">$49 A MONTH, ON TOP OF YOUR RENUABL PLAN. YOUR OWN NUMBER INCLUDED.</p><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `body{background:${GROUND}}
       .top{position:absolute;left:84px;top:64px;font-family:"JetBrains Mono",Consolas,monospace;font-size:15px;letter-spacing:.22em;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:14px}
       .top i{width:9px;height:9px;border-radius:50%;background:#ff5a1f;box-shadow:0 0 14px #ff5a1f}
       .pre{position:absolute;left:84px;top:112px;font-size:54px;font-weight:400;letter-spacing:-.03em;color:rgba(255,255,255,.5)}
       .fig{position:absolute;left:76px;top:160px;font-size:264px;line-height:1;font-weight:600;letter-spacing:-.06em}
       .fig small{font-size:64px;font-weight:400;letter-spacing:-.03em;color:rgba(255,255,255,.5);margin-left:26px}
       .dry{position:absolute;left:84px;top:462px;font-size:40px;letter-spacing:-.02em;color:#fff}
       .foot{position:absolute;left:84px;bottom:44px;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;letter-spacing:.16em;color:rgba(255,255,255,.42)}`,
    ),
  },

  /** The same email's close (Martin: 'call out the "try for free" free for a month'): the plan's first month, said flat, with what follows it in the small print. */
  "free.jpg": {
    html: page(
      `<div class="glow"></div><div class="top"><i></i>RENUABL // TRY IT FREE</div><div class="fig">$0<small>for your first month.</small></div>
       <p class="dry">Try it. Break it. Keep it if it sells.</p>
       <p class="foot">THEN $49 A USER A MONTH. NO LOCK-IN, CANCEL ANY TIME. ADD-ONS SUCH AS CALLS &amp; TEXTS ARE BILLED FROM THE DAY YOU ADD THEM.</p><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `body{background:${GROUND}}.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 82% 108%,rgba(255,90,31,.38),transparent 55%)}
       .top{position:absolute;left:84px;top:64px;font-family:"JetBrains Mono",Consolas,monospace;font-size:15px;letter-spacing:.22em;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:14px}
       .top i{width:9px;height:9px;border-radius:50%;background:#ff5a1f;box-shadow:0 0 14px #ff5a1f}
       .fig{position:absolute;left:76px;top:120px;font-size:264px;line-height:1;font-weight:600;letter-spacing:-.06em;white-space:nowrap}
       .fig small{font-size:64px;font-weight:400;letter-spacing:-.03em;color:rgba(255,255,255,.5);margin-left:30px}
       .dry{position:absolute;left:84px;top:428px;font-size:40px;letter-spacing:-.02em;color:#fff}
       .foot{position:absolute;left:84px;right:250px;bottom:40px;font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;line-height:1.6;letter-spacing:.14em;color:rgba(255,255,255,.42)}`,
    ),
  },

  /**
   * For "Nobody got into solar to do paperwork." (26 Nov 2026, Martin; a fan of ticked sheets was "a bit lack luster",
   * then "sol is also selling through voice ai and writing emails. we need the to use the actual sol sunbrain"): the
   * calls, emails and admin the email lists, as sheets of paper swept across the dark and into Sol's sun, shrinking and
   * catching his light as they go. The GIF loops (Sol holds still in it, to keep it light); the JPEG is the same picture
   * held still.
   */
  ...Object.fromEntries(
    [
      ["paperwork.gif", { frames: 22, delay: 95, hold: 95, colours: 64, photo: true }],
      ["paperwork.jpg", {}],
    ].map(([name, how]) => [
      name,
      {
        ...how,
        html: page(
          `<div class="corona"></div><div class="rings"><i></i><i></i><i></i></div><div id="sheets"></div>
           <div class="sun">%%SOLHERO%%</div>
           <p class="say">You do the solar.<br><span>Sol calls, writes and chases.</span></p><img class="mark" src="${LOGO}" alt="RENUABL">`,
          `body{background:${GROUND}}
           .corona{position:absolute;left:900px;top:310px;width:1500px;height:1500px;margin:-750px 0 0 -750px;border-radius:50%;
             background:radial-gradient(circle,rgba(255,150,70,.5) 0,rgba(255,90,31,.24) 16%,rgba(255,90,31,.08) 34%,transparent 58%)}
           .rings i{position:absolute;left:900px;top:310px;border-radius:50%;border:1px solid rgba(255,170,110,.16)}
           .rings i:nth-child(1){width:420px;height:420px;margin:-210px}.rings i:nth-child(2){width:640px;height:640px;margin:-320px;border-color:rgba(255,170,110,.1)}
           .rings i:nth-child(3){width:900px;height:900px;margin:-450px;border-color:rgba(255,170,110,.06)}
           .sun{position:absolute;left:760px;top:170px;width:280px;height:280px;display:grid;place-items:center}
           #sheets{position:absolute;inset:0;perspective:1400px}
           .sheet{position:absolute;left:0;top:0;width:230px;height:300px;margin:-150px 0 0 -115px;padding:24px 22px;border-radius:6px;will-change:transform}
           .sheet b{display:block;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;letter-spacing:.14em;color:#1d1d1f}
           .sheet u{display:block;height:9px;margin:16px 0 20px;border-radius:5px;background:rgba(60,50,40,.3)}
           .sheet s{display:block;height:6px;margin-top:12px;border-radius:3px;background:rgba(60,50,40,.17)}
           .say{position:absolute;left:84px;bottom:64px;font-size:62px;line-height:1.08;font-weight:600;letter-spacing:-.04em;color:#fff}
           .say span{background:linear-gradient(90deg,#ffd27a,#ff8a3d 45%,#ff5a1f);-webkit-background-clip:text;background-clip:text;color:transparent}`,
          `const NAMES = ["LEAD CALL", "FOLLOW-UP EMAIL", "QUOTE CHASE", "CALL NOTES", "NETWORK RULES", "REMINDERS"];
           const N = 12, W8 = [92, 84, 96, 70, 88, 76, 58, 90];
           const box = document.getElementById("sheets");
           for (let k = 0; k < N; k++) {
             const el = document.createElement("div"); el.className = "sheet";
             el.innerHTML = "<b>" + NAMES[k % NAMES.length] + "</b><u style='width:" + (54 + (k * 7) % 26) + "%'></u>" + W8.map((w, i) => "<s style='width:" + W8[(i + k) % 8] + "%'></s>").join("");
             box.appendChild(el);
           }
           const bez = (p, a, b, c, d) => { const q = 1 - p; return q * q * q * a + 3 * q * q * p * b + 3 * q * p * p * c + p * p * p * d; };
           window.at = (t) => {
             const tt = (t * ${21 / 22}) % 1;
             [...box.children].forEach((el, k) => {
               // Each sheet is like the one six ahead of it, and a loop moves the stream half the way, so the last frame meets the first.
               const j = k % 6, r = j * 2.4;
               const pp = (k / N + ((j * 37) % 11) / 160 + tt / 2) % 1;
               const x = bez(pp, -170, 250, 610, 900) + Math.sin(r) * 46 * (1 - pp), y = bez(pp, 70, 40, 500, 310) + Math.cos(r * 1.7) * 40 * (1 - pp);
               const s = 1.12 * Math.pow(1 - pp, 1.35) + 0.04;
               const fade = Math.min(1, pp / 0.05) * Math.min(1, (1 - pp) / 0.1);
               const heat = Math.max(0, (pp - 0.3) / 0.7);
               el.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ") rotateZ(" + (-24 + 250 * pp + Math.sin(r) * 18) + "deg) rotateY(" + 48 * Math.sin(pp * 7 + r) + "deg) rotateX(" + 34 * Math.cos(pp * 6 + r) + "deg)";
               el.style.opacity = fade; el.style.zIndex = 100 - Math.round(pp * 100);
               el.style.background = "linear-gradient(160deg,color-mix(in srgb,#fbfaf7,#ffc98a " + heat * 100 + "%),color-mix(in srgb,#dedad2,#ff8a3d " + heat * 100 + "%))";
               el.style.boxShadow = "0 30px 60px -20px rgba(0,0,0,.9),0 0 " + (20 + heat * 50) + "px rgba(255,120,50," + heat * 0.7 + ")";
             });
           };
           window.at(0);`,
        ),
      },
    ]),
  ),

  ...Object.fromEntries(Object.entries(EXPLAINERS).map(([name, e]) => [name, { frames: 40, delay: 80, hold: 3800, html: explainer(e) }])),

  /** Sol in the product: a question typed on Today and his answer. */
  "product-sol.jpg": { html: product("today-sol-ask.webp", { x: 0.21, y: 0.21, w: 0.57, h: 0.66 }, "In RENUABL · Today") },
  /** A voice agent in the product: Charlie's window, on a call now. */
  "product-voice.jpg": { html: product("charlie-window.webp", { x: 0.277, y: 0.142, w: 0.668, h: 0.716 }, "In RENUABL · Talk to Charlie") },

  /** The saving (22 Nov 2026, Martin: "$49 per month is… less than $2 per calendar day… you cant employ anyone on less than $2 per day"). */
  "price-voice.jpg": {
    html: page(
      `<div class="sky"></div><div class="who">${AGENT(150, "#ff5a1f", "big")}</div>
       <div class="say"><small>Your voice agent, with your own number</small><h1>Less than<br><b>$2 a day.</b></h1>
       <p>$49 a month is $1.61 a day. Nobody can be hired for that.</p></div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.sky{position:absolute;inset:0;background:radial-gradient(circle at 78% 50%,rgba(255,90,31,.3),transparent 36%)}
       .who{position:absolute;left:830px;top:262px}.big .agent-glow{inset:-30%;filter:blur(30px)}
       .say{position:absolute;left:84px;top:150px;width:640px}
       .say small{font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:#ff8f4a}
       .say h1{margin-top:18px;font-size:92px;line-height:1;font-weight:600;letter-spacing:-.04em}.say h1 b{color:#ff7a2e;font-weight:600}
       .say p{margin-top:26px;font-size:26px;color:rgba(255,255,255,.62)}`,
    ),
  },

  /**
   * The voice email's character picture (26 Nov 2026, Martin: "add in a nice visual to bring character to the voice
   * ai"): a voice agent introduced as a member of the team, by the name a business might give it. Its wave beats, it
   * says its opening line, and what the business chooses for it comes in as tags. The name is an example.
   */
  "voice-meet.gif": {
    frames: 40,
    delay: 100,
    hold: 3600,
    html: page(
      `<div class="sky"></div>
       <div class="who">${AGENT(210, VOICE_TINT, "big")}<b>Gary</b><span>Voice agent · Sales</span><em><i></i>Ready for your leads</em></div>
       <div class="say"><small>YOUR VOICE AGENT</small><h1>Meet Gary.</h1>
         <p class="sub">Or whatever you call yours. You choose the name, the voice and the script.</p>
         <div class="b"><s>Gary</s><p id="line" data-text="${VOICE_OPENING}"></p></div>
         <div class="tags">${VOICE_TAGS.map((t, i) => `<span data-g="${i}">${t}</span>`).join("")}</div>
       </div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.sky{position:absolute;inset:0;background:radial-gradient(circle at 21% 44%,color-mix(in srgb,${VOICE_TINT} 30%,transparent),transparent 36%)}
       .who{position:absolute;left:72px;top:112px;width:330px;display:flex;flex-direction:column;align-items:center;text-align:center}
       .who b{margin-top:30px;font-size:34px;font-weight:600;letter-spacing:-.02em}.who span{font-size:17px;color:rgba(255,255,255,.55);margin-top:4px}
       .who em{margin-top:16px;font-style:normal;font-size:15px;color:${VOICE_TINT};font-family:"JetBrains Mono",Consolas,monospace}
       .who em i{display:inline-block;width:8px;height:8px;border-radius:50%;background:${VOICE_TINT};margin-right:8px;box-shadow:0 0 10px ${VOICE_TINT}}
       .big .agent-glow{inset:-30%;filter:blur(32px)}
       .say{position:absolute;left:470px;top:84px;width:660px}
       .say small{font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;letter-spacing:.22em;color:rgba(255,255,255,.5)}
       .say h1{margin-top:10px;font-size:96px;line-height:1;font-weight:600;letter-spacing:-.05em}
       .sub{margin-top:16px;font-size:22px;line-height:1.4;color:rgba(255,255,255,.7);max-width:560px}
       .b{margin-top:28px;width:560px;border-radius:22px;padding:16px 20px;background:#fff;color:#0b0b0c;box-shadow:0 18px 40px -20px rgba(0,0,0,.9)}
       .b s{display:block;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#7c5cf0}
       .b p{font-size:21px;line-height:1.4;margin-top:4px;min-height:2.8em}
       .tags{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px;width:600px}
       .tags span{padding:9px 16px;border-radius:999px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);font-size:15px;color:rgba(255,255,255,.85);opacity:0}`,
      `const line = document.getElementById("line"); const text = line.dataset.text;
       window.at = (t) => {
         line.textContent = text.slice(0, Math.round(text.length * span(t, 0.08, 0.6)));
         document.querySelectorAll("[data-g]").forEach((el) => {
           const k = span(t, 0.62 + el.dataset.g * 0.08, 0.72 + el.dataset.g * 0.08);
           el.style.opacity = k; el.style.transform = "translateY(" + (1 - k) * 10 + "px)";
         });
         beat(t, t < 0.6);
       }; window.at(0);`,
    ),
  },

  /**
   * The voice email's product picture (26 Nov 2026, Martin: "one visual to understand how it looks in the software, the
   * phone book"; "update the text in the screenshots so it doesnt have my name… or any real phonenumbers"): the agent's
   * window drawn as the product shows it, from two of Martin's screenshots: a call in progress beside the contacts, one
   * opened on Hand it to the agent. Drawn here, not photographed, so every name is made up and every number is from the
   * range set aside for fiction (0491 570 …).
   */
  "product-phonebook.jpg": {
    html: page(
      `<div class="glow"></div><div class="win">
        <div class="call">
          <div class="chead"><div class="row"><span class="live"><i></i>CALL IN PROGRESS</span><tt>0:26</tt></div>
            <div class="row2">${AGENT(44, VOICE_TINT)}<div><b>Gary <u>with</u> Olivia</b><span>New lead · solar and a battery</span></div></div></div>
          <div class="lines">
            ${[
              ["Gary", "Hi. Is that Olivia?"],
              ["Olivia", "Yes, it is."],
              [
                "Gary",
                "Hi Olivia, it's Gary, Sunrise Solar's automated assistant, calling about your solar enquiry. Have you got a few minutes?",
              ],
              ["Olivia", "Oh, yes. Absolutely."],
            ]
              .map(([who, text]) => `<div class="l ${who === "Gary" ? "g" : "c"}"><s>${who}</s><p>${text}</p></div>`)
              .join("")}
          </div>
          <div class="cfoot"><div class="tell">Tell Gary something…</div><div class="hang">${ICON.hang} Hang up</div></div>
        </div>
        <div class="book">
          <div class="bhead">${AGENT(44, VOICE_TINT)}<div><b>Talk to Gary</b><span>On a call now · 2 calls today</span></div></div>
          <div class="search">${ICON.search} Search contacts</div>
          <div class="list">
            <p class="letter">A</p>
            <div class="open">
              <div class="c"><div><b>Alex Example</b><span>0491 570 006 · Solar · Designed</span></div><i class="on">${ICON.phone}</i><i>${ICON.chat}</i></div>
              <p class="cap">WHAT THE CALL IS ABOUT</p><div class="about">Their proposal went out on Monday. See if they have any questions.</div>
              <div class="hand">${AGENT(34, VOICE_TINT)}<div><b>Hand it to Gary</b><span>Gary rings Alex and you watch the call here</span></div></div>
              <div class="opt">${ICON.mail}<div><b>Ask Alex by email first</b><span>Gary rings only after a yes</span></div></div>
            </div>
            <p class="letter">C</p>
            <div class="c"><div><b>Casey Demo</b><span>0491 570 110 · Solar · Proposal sent</span></div><i>${ICON.phone}</i><i>${ICON.chat}</i></div>
            <p class="letter">J</p>
            <div class="c"><div><b>Jordan Placeholder</b><span>0491 570 157 · Solar and battery · Designed</span></div><i>${ICON.phone}</i><i>${ICON.chat}</i></div>
          </div>
        </div>
      </div><div class="tag">In RENUABL · your voice agent's phone book (example data)</div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 112%,rgba(255,90,31,.34),transparent 58%)}
       .tag{position:absolute;left:52px;bottom:40px;color:rgba(255,255,255,.5);font-size:13px;letter-spacing:.24em;text-transform:uppercase}
       .win{position:absolute;left:70px;top:24px;width:1060px;height:580px;border-radius:20px;overflow:hidden;display:flex;background:#fff;color:#1d1d1f;
         box-shadow:0 0 0 2px #2fae84,0 40px 120px rgba(0,0,0,.85)}
       .win .agent{box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);background:#2f323a}.win .agent-glow{display:none}
       .call{width:372px;display:flex;flex-direction:column;border-right:1px solid #e3e3e8}
       .chead{background:#2fae84;color:#fff;padding:16px 18px 14px}
       .row{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;letter-spacing:.12em}
       .live i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#fff;margin-right:8px;box-shadow:0 0 0 4px rgba(255,255,255,.3)}
       .row tt{font-family:"JetBrains Mono",Consolas,monospace;font-size:16px;letter-spacing:.04em}
       .row2{display:flex;align-items:center;gap:12px;margin-top:14px}.row2 b{font-size:18px;font-weight:600}.row2 u{text-decoration:none;font-weight:400;opacity:.85}
       .row2>div>span{display:block;font-size:13px;opacity:.85;margin-top:1px}
       .lines{flex:1;padding:14px 16px 0;overflow:hidden}
       .l{margin-bottom:7px;display:flex;flex-direction:column;align-items:flex-start}.l.c{align-items:flex-end}
       .l s{text-decoration:none;font-size:11px;color:#8a8a90;margin:0 6px 3px}
       .l p{max-width:268px;padding:8px 13px;border-radius:16px;background:#ececef;font-size:14px;line-height:1.35}
       .l.c p{background:#3a3d43;color:#fff;font-weight:600}
       .cfoot{padding:12px 14px 14px;border-top:1px solid #e3e3e8}
       .tell{height:38px;border-radius:999px;background:#ececef;color:#8a8a90;font-size:14px;display:flex;align-items:center;padding:0 16px}
       .hang{margin-top:10px;height:36px;border-radius:999px;background:#fde7e7;color:#d92d20;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px}
       .book{flex:1;display:flex;flex-direction:column;min-width:0}
       .bhead{background:#3a3d43;color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px}
       .bhead b{font-size:17px;font-weight:600}.bhead>div>span{display:block;font-size:12.5px;color:rgba(255,255,255,.65)}
       .search{height:44px;display:flex;align-items:center;gap:10px;padding:0 20px;color:#8a8a90;font-size:14.5px;border-bottom:1px solid #e3e3e8}
       .list{padding:6px 14px 0;flex:1;overflow:hidden}
       .letter{font-size:11px;font-weight:700;color:#8a8a90;letter-spacing:.1em;margin:7px 8px 3px}
       .c{display:flex;align-items:center;gap:8px;padding:7px 10px}.c>div{flex:1;min-width:0}
       .c b{font-size:15.5px;font-weight:500}.c>div>span{display:block;font-family:"JetBrains Mono",Consolas,monospace;font-size:11.5px;color:#6e6e73;margin-top:1px}
       .c i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 1px #d9d9de;color:#1d1d1f;flex:none}
       .c i.on{background:#3a3d43;color:#fff;box-shadow:none}
       .open{background:#ececef;border-radius:14px;padding:2px 4px 8px}
       .cap{font-size:10.5px;font-weight:700;letter-spacing:.12em;color:#6e6e73;margin:7px 14px 5px}
       .about{margin:0 10px;padding:9px 12px;border-radius:10px;background:#fff;font-size:13.5px;color:#1d1d1f;box-shadow:inset 0 0 0 1px #d9d9de}
       .hand{margin:9px 6px 3px;padding:10px 16px;border-radius:14px;background:#3a3d43;color:#fff;display:flex;align-items:center;gap:14px}
       .hand b{font-size:15.5px;font-weight:600}.hand>div>span{display:block;font-size:12.5px;color:rgba(255,255,255,.7)}
       .opt{display:flex;align-items:center;gap:13px;padding:6px 16px;color:#1d1d1f}.opt b{font-size:14px;font-weight:500}
       .opt>div>span{display:block;font-size:12px;color:#6e6e73}.opt svg,.search svg{flex:none}`,
    ),
  },

  /**
   * The band at the foot of every email (22 Nov 2026, Martin: "design something into the footer of each email - to
   * reinforce a message… marketplace coming soon"): RENUABL Marketplace's blue round with its two roofs, and the line.
   * Taken as the top 1200 x 300 of the page.
   */
  "footer-marketplace.jpg": {
    clipH: 300,
    html: page(
      `<div class="band"><span class="m"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5 8 7l6 5.5"/><path d="M4 11v8h8v-8"/><path d="M11 9.5 16 5l6 5.5"/><path d="M14 19h6v-8"/></svg></span>
        <div><small>RENUABL Marketplace · Coming soon</small><b>Find crews. Win installs. Trade stock.</b><em>One network for solar retailers, installers and inspectors.</em></div></div>`,
      `body{background:${GROUND}}.band{position:absolute;left:0;top:0;width:1200px;height:300px;display:flex;align-items:center;gap:40px;padding:0 80px;
         background:radial-gradient(ellipse at 10% 50%,rgba(60,110,255,.28),transparent 45%),${GROUND};border-top:1px solid rgba(255,255,255,.08)}
       .m{flex:none;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;
         background:radial-gradient(circle at 35% 25%,#8fb0ff 0 10%,#3b6bff 45%,#1f3fc4 100%);box-shadow:inset 0 2px 1px rgba(255,255,255,.5),0 14px 40px rgba(59,107,255,.45)}
       small{display:block;font-size:16px;letter-spacing:.22em;text-transform:uppercase;color:#7fa2ff}
       b{display:block;margin-top:10px;font-size:46px;font-weight:600;letter-spacing:-.03em}
       em{display:block;margin-top:8px;font-style:normal;font-size:20px;color:rgba(255,255,255,.55)}`,
    ),
  },

  /** A slim strip above the Marketplace band in every email (22 Nov 2026, Martin): the saving, as a reminder. */
  "footer-voice.jpg": {
    clipH: 120,
    html: page(
      `<div class="strip">${AGENT(64, "#ff5a1f")}<b>Your AI salesperson: <i>less than $2 a day.</i></b><em>Calls &amp; Texts · $49 a month</em></div>`,
      `.strip{position:absolute;left:0;top:0;width:1200px;height:120px;display:flex;align-items:center;gap:26px;padding:0 64px;
         background:linear-gradient(90deg,rgba(255,90,31,.18),transparent 60%),${GROUND};border-top:1px solid rgba(255,255,255,.08)}
       .strip b{font-size:34px;font-weight:600;letter-spacing:-.02em}.strip i{font-style:normal;color:#ff7a2e}
       .strip em{margin-left:auto;font-style:normal;font-size:18px;color:rgba(255,255,255,.5)}`,
    ),
  },

  /** The CRM: the Today feed, the product's own screen on black. */
  "today.jpg": {
    html: page(
      `<div class="glow"></div><div class="frame"><img src="${shot("today.webp")}"></div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.glow{position:absolute;left:50%;top:60%;width:900px;height:420px;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(255,90,31,.35),transparent 65%);filter:blur(20px)}
       .frame{position:absolute;left:50%;top:56px;width:980px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.8)}
       .frame img{display:block;width:100%;margin-top:-20px}`,
    ),
  },

  /** After the signature: the install calendar. */
  "runs.jpg": {
    html: page(
      `<div class="glow"></div><div class="frame"><img src="${shot("calendar.webp")}"></div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 110%,rgba(255,90,31,.32),transparent 60%)}
       .frame{position:absolute;left:50%;top:56px;width:1000px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.85)}
       .frame img{display:block;width:100%}`,
    ),
  },

  /**
   * The close: a mail-order coupon in RENUABL's own look (22 Nov 2026, Martin: the cream-paper one was "off brand"). The
   * 1990s are in the form only (the cut line, the YES box, the ticks, the badge); the type, colours and dark ground are
   * the product's.
   */
  "coupon.jpg": {
    html: page(
      `<div class="sky"></div><div class="cut">✂</div><div class="coupon">
        <div class="badge"><b>First month</b><span>free</span></div>
        <h1><span class="box"><i></i></span>Yes. I want my <b>AI sales force.</b></h1>
        <ul><li>Voice agents that ring every new lead</li><li>Sol, the brain of the business</li>
          <li>The AI designer: roofs priced as they're drawn</li><li>From $39 a user, then pay as you go</li></ul>
        <p class="fine">No contract · Cancel any time · Prices include GST</p></div><img class="mark" src="${LOGO}" alt="RENUABL">`,
      `.sky{position:absolute;inset:0;background:radial-gradient(ellipse at 85% 0%,rgba(255,90,31,.25),transparent 50%)}
       .coupon{position:absolute;left:56px;top:56px;right:56px;bottom:72px;border:2px dashed rgba(255,122,46,.75);border-radius:26px;padding:48px 56px;
         background:linear-gradient(180deg,rgba(36,39,46,.96),rgba(20,22,27,.96))}
       .cut{position:absolute;left:36px;top:34px;font-size:28px;color:#ff7a2e;transform:rotate(-90deg)}
       h1{font-size:50px;line-height:1.08;font-weight:600;letter-spacing:-.03em;max-width:640px}h1 b{color:#ff7a2e;font-weight:600}
       .box{display:inline-grid;place-items:center;width:46px;height:46px;border:3px solid #fff;border-radius:10px;margin-right:18px;vertical-align:-4px}
       .box i{width:22px;height:12px;border-left:4px solid #ff7a2e;border-bottom:4px solid #ff7a2e;transform:rotate(-45deg) translate(2px,-3px)}
       ul{list-style:none;margin-top:30px;font-size:24px;line-height:1.7;color:rgba(255,255,255,.85)}
       ul li::before{content:"✓";color:#ff7a2e;font-weight:700;margin-right:16px}
       .fine{position:absolute;left:56px;bottom:30px;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.45)}
       .badge{position:absolute;right:56px;top:48px;width:190px;height:190px;border-radius:50%;display:grid;place-content:center;text-align:center;transform:rotate(10deg);
         background:radial-gradient(circle at 35% 25%,#ffb08a 0 10%,#ff6a2c 45%,#e8470f 100%);box-shadow:inset 0 2px 1px rgba(255,255,255,.55),0 16px 40px rgba(255,90,31,.45)}
       .badge b{font-size:24px;font-weight:600}.badge span{font-size:52px;font-weight:700;letter-spacing:-.03em;line-height:1}`,
    ),
  },
};

// ---- Taking them ------------------------------------------------------------------------------------------------

/** Chrome's own port: set ART_PORT when two runs may overlap (two sessions on one port take each other's pictures). */
const ART_PORT = process.env.ART_PORT ?? "9336";
const chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=${ART_PORT}`, `--user-data-dir=${work}`, "--hide-scrollbars", "about:blank"],
  {
    stdio: "ignore",
  },
);
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch(`http://127.0.0.1:${ART_PORT}/json`)).json()).find((t) => t.type === "page");
  } catch {
    // Chrome isn't up yet.
  }
}
if (!target) throw new Error("Chrome didn't start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    waiting.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const grab = async (clip) =>
  Buffer.from(
    (await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).result.data,
    "base64",
  );

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false });

/** `photo` is for frames that are mostly one photograph: only what changed between frames is kept, which cuts such a GIF to a quarter. */
async function writeGif(name, frames, delays, colours = 160, width = GIF_W, photo = false) {
  // Outlook on Windows shows only a GIF's first frame: the finished picture goes first, then it plays from the start.
  frames = [frames.at(-1), ...frames];
  delays = [1600, ...delays];
  const small = await Promise.all(frames.map((f) => sharp(f).resize(width).png().toBuffer()));
  await sharp(small, { join: { animated: true } })
    .gif({
      delay: delays,
      loop: 0,
      effort: 10,
      colours,
      dither: photo ? 0.3 : 0.5,
      ...(photo ? { interFrameMaxError: 12, interPaletteMaxError: 10 } : {}),
    })
    .toFile(join(OUT, name));
}

/**
 * Sol, from the homepage itself: his live sun (the canvas corona) and the brain in it, on black, as he breathes.
 * Taken by hiding everything else on the page and filming the sun where it stands.
 */
/** What Sol types on each of his GIFs, in his own voice, after sitting still for two seconds. */
const SOL_SAYS = {
  "sol-intro.gif": "Hi, I'm Sol. Meet your AI sales force: I answer your leads, write your emails and assist you to design a system.",
  "sol.gif": "I know every deal. I write your emails in your voice, and tell you who to ring next.",
};
const SOL_IDLE = 8;
const SOL_TYPING = 22;
const xml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Words broken into lines of about `max` letters. */
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}
/** A frame of Sol's GIF: the filmed sun on the right, "Sol." and what he has typed so far on the left, with his caret. */
function solFrame(png, says, typed, i) {
  const lines = wrap(says, 30);
  let left = typed;
  const shown = lines.map((l) => {
    const n = Math.max(0, Math.min(l.length, left));
    left -= l.length + 1;
    return l.slice(0, n);
  });
  const last = shown.reduce((k, l, j) => (l ? j : k), 0);
  const caret = typed > 0 && typed < says.length ? i % 2 === 0 : typed === 0 ? i % 4 < 2 : false;
  const rows = shown
    .map(
      (l, j) =>
        `<text x="76" y="${330 + j * 46}" font-family="Inter,Segoe UI,sans-serif" font-size="32" fill="#ffffff" fill-opacity=".92">${xml(l)}${j === last && caret ? '<tspan fill="#ff7a2e" font-weight="700"> |</tspan>' : ""}</text>`,
    )
    .join("");
  return sharp(png)
    .resize(W, H)
    .composite([
      {
        input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <text x="72" y="214" font-family="Inter,Segoe UI,sans-serif" font-size="92" font-weight="600" fill="#fff" letter-spacing="-3">Sol.</text>
          <text x="76" y="260" font-family="Inter,Segoe UI,sans-serif" font-size="22" fill="#ffffff" fill-opacity=".5">The brain of your business.</text>
          ${rows}
          <image href="data:image/png;base64,${readFileSync(LOGO_FILE).toString("base64")}" x="${W - 52 - 132}" y="${H - 40 - 23}" width="132" height="23" opacity=".75"/>
        </svg>`),
      },
    ])
    .png()
    .toBuffer();
}

let solStill = null;
{
  await send("Page.navigate", { url: `${SITE}/` });
  await sleep(6000);
  const box = await js(`(() => {
    // The sun's canvas sits in a wrapper inside the span that spreads past his round (-inset-1/2); his round is that span's parent.
    const spread = [...document.querySelectorAll("canvas")].map((x) => x.closest('[class*="-inset-1/2"]')).find(Boolean);
    if (!spread) return null;
    const sun = spread.parentElement;
    document.documentElement.style.background = "#000"; document.body.style.background = "#000";
    document.body.style.visibility = "hidden"; sun.style.visibility = "visible";
    document.querySelectorAll("nextjs-portal").forEach((n) => n.remove());
    sun.querySelectorAll("*").forEach((n) => (n.style.visibility = "visible"));
    sun.scrollIntoView({ block: "center" });
    const r = sun.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  if (!box) {
    console.log("skipped sol.gif: the homepage's sun wasn't found (is the dev server on?)");
  } else {
    const side = Math.max(box.w, box.h) * 2.6;
    const clip = { x: box.x + box.w / 2 - side * (16 / 9) * 0.68, y: box.y + box.h / 2 - side / 2, width: side * (16 / 9), height: side };
    // A still of the sun alone, for the cards: on black, so it sits on a dark card with mix-blend-mode screen.
    const pad = box.w * 0.12;
    solStill = join(process.env.SOL_STILL_DIR ?? work, "sol-still.png");
    writeFileSync(solStill, await grab({ x: box.x - pad, y: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }));
    await js(`document.documentElement.style.background = "${GROUND}"; document.body.style.background = "${GROUND}"`);
    await sleep(200);
    for (const [name, says] of Object.entries(SOL_SAYS)) {
      if (ONLY && ONLY !== name) continue;
      // He sits in his state for two seconds, then types (22 Nov 2026, Martin).
      const frames = [];
      const delays = [];
      for (let i = 0; i < SOL_IDLE; i++) {
        frames.push({ png: await grab(clip), typed: 0 });
        delays.push(250);
        await sleep(250);
      }
      for (let i = 1; i <= SOL_TYPING; i++) {
        // The sun is filmed every third frame while he types: it moves slowly, and every new sun frame weighs the GIF down.
        const png = i % 3 === 1 ? await grab(clip) : frames.at(-1).png;
        frames.push({ png, typed: Math.round((says.length * i) / SOL_TYPING) });
        delays.push(90);
        await sleep(90);
      }
      delays[delays.length - 1] = 3600;
      const done = await Promise.all(frames.map((f, i) => solFrame(f.png, says, f.typed, i)));
      await writeGif(name, done, delays, 80, 680);
      console.log("made", name);
    }
  }
}

for (const [name, art] of Object.entries(ART)) {
  if (ONLY && ONLY !== name) continue;
  const file = join(work, name.replace(/\.\w+$/, ".html"));
  const sun = solStill
    ? `<img src="${pathToFileURL(solStill).href}" width="96" height="96" style="flex:none;margin:-18px -12px -18px -20px;mix-blend-mode:screen;-webkit-mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%);mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%)">`
    : SOL(64);
  const big = solStill
    ? `<img src="${pathToFileURL(solStill).href}" width="84" height="84" style="flex:none;margin:-14px -6px 0 -14px;mix-blend-mode:screen;-webkit-mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%);mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%)">`
    : SOL(64);
  // The homepage's own sun, large, for a picture he is the middle of (Martin: "the actual sol sunbrain"); the drawn one only when the site isn't up.
  const hero = solStill
    ? `<img src="${pathToFileURL(solStill).href}" width="360" height="360" style="flex:none;margin:-40px;mix-blend-mode:screen;-webkit-mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%);mask-image:radial-gradient(circle closest-side,#000 86%,transparent 100%)">`
    : SOL(280);
  writeFileSync(file, art.html.replaceAll("%%SOLHERO%%", hero).replaceAll("%%SOL%%", sun).replaceAll("%%SOLBIG%%", big));
  await send("Page.navigate", { url: pathToFileURL(file).href });
  await sleep(1200);
  if (!art.frames) {
    await sharp(await grab(art.clipH ? { x: 0, y: 0, width: W, height: art.clipH } : undefined))
      .resize(W, art.clipH ?? H)
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(join(OUT, name));
  } else {
    const frames = [];
    for (let i = 0; i < art.frames; i++) {
      await js(`window.at(${i / (art.frames - 1)})`);
      await sleep(30);
      frames.push(await grab(art.clipH ? { x: 0, y: 0, width: W, height: art.clipH } : undefined));
    }
    await writeGif(
      name,
      frames,
      frames.map((_, i) => (i === frames.length - 1 ? art.hold : i === 0 && art.first ? art.first : art.delay)),
      art.colours ?? 160,
      GIF_W,
      art.photo === true,
    );
  }
  console.log("made", name);
}

ws.close();
chrome.kill();
await sleep(300);
try {
  rmSync(work, { recursive: true, force: true });
} catch {
  // Chrome may still hold a file for a moment.
}
