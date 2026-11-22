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
 * argument). Everything lands in public/design/launch/, where /api/design/marketing/gtm reads it into RENUABL's
 * Marketing pictures. Made-up customers only, no stock photos, nobody else's marks.
 *
 *   node tools/marketing/launch-art.mjs [only-this-one] [port]
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("public/design/launch");
const ONLY = process.argv[2] && process.argv[2] !== "all" ? process.argv[2] : null;
const SITE = `http://localhost:${process.argv[3] ?? "3100"}`;
const W = 1200;
const H = 675;
/** GIFs go at 800 px: email apps show them at 536, so a little over for sharp screens, and a GIF's size grows fast with its pixels. */
const GIF_W = 800;
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "renuabl-art-"));
const shot = (f) => pathToFileURL(resolve("public/design/landing", f)).href;
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

/** The install calendar's icon on graphite. */
const CALENDAR = (size) => `<span class="graphite" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size * 0.44}" height="${size * 0.44}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/></svg></span>`;

const BASE = `*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#05060a;color:#fff;
  font-family:Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .mark{position:absolute;right:52px;bottom:40px;color:rgba(255,255,255,.5);font-size:13px;letter-spacing:.42em;font-weight:500}
  .agent{position:relative;display:inline-grid;place-items:center;border-radius:50%;background:#202227;flex:none;
    box-shadow:0 18px 40px -18px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.08)}
  .agent-glow{position:absolute;inset:-14%;border-radius:50%;background:color-mix(in srgb,var(--tint) 30%,transparent);filter:blur(16px);opacity:.5}
  .agent-bars{position:relative;display:flex;align-items:center}.agent-bars i{display:block;border-radius:9px;background:var(--tint)}
  .orb{display:inline-grid;place-items:center;border-radius:50%;flex:none;
    background:radial-gradient(circle at 35% 25%,#ffb08a 0 10%,#ff6a2c 45%,#e8470f 100%);
    box-shadow:inset 0 2px 1px rgba(255,255,255,.55),inset 0 -3px 6px rgba(140,30,0,.3),0 10px 24px rgba(255,90,31,.4)}
  .graphite{display:inline-grid;place-items:center;border-radius:50%;background:#202227;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}`;

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

const CARDS = [
  { icon: AGENT(56, "#ff5a1f"), head: "Your customers, answered.", sub: "Voice agents ring every new lead" },
  { icon: "%%SOL%%", head: "Your emails, written.", sub: "Sol drafts every follow-up in your voice" },
  { icon: NOTEBOOK(56), head: "Your calls, written up.", sub: "The note-taker fills in the deal" },
  { icon: "%%SOL%%", head: "Your super-intelligent advisor.", sub: "Sol knows every deal, and the trade" },
  { icon: DESIGNER(56), head: "Your roofs, designed.", sub: "Three priced designs in one press" },
  { icon: AGENT(56, "#2bb5a0"), head: "Your installs, lined up.", sub: "The post-sale agent pencils in the day" },
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
  "explain-designer.gif": {
    icon: DESIGNER(88),
    head: "Your roofs, designed.",
    says: "One press lays out three designs, each priced as it lands. Your customer chooses one and signs online.",
  },
  "explain-crm.gif": {
    icon: NOTEBOOK(88),
    head: "Your calls, written up.",
    says: "I write up your calls, draft your follow-ups and turn emailed leads into deals. You do the selling.",
  },
  "explain-runs.gif": {
    icon: CALENDAR(88),
    head: "Signed. Then it runs itself.",
    says: "The moment they sign, the order opens, approvals line up and your installer's job card is ready.",
  },
};

const explainer = ({ icon, head, says }) =>
  page(
    `<div class="sky"></div><div class="card"><div class="top">${icon}<h2>${head}</h2></div><hr>
      <div class="sol">%%SOLBIG%%<p data-text="${says.replace(/"/g, "&quot;")}"></p></div></div><div class="mark">RENUABL</div>`,
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
      ).join("")}<div class="mark">RENUABL</div>`,
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
       </div><div class="mark">RENUABL</div>`,
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

  /** The AI designer: one press, and the panels lay themselves on the roof row by row. */
  "designer.gif": {
    frames: 30,
    delay: 90,
    hold: 3200,
    html: page(
      `<img class="roof" src="${shot("aerial-demo.webp")}"><svg id="panels" width="${W}" height="${H}" style="position:absolute;inset:0"></svg>
       <div class="shade"></div>
       <div class="pill">${DESIGNER(44)}<span>Design it for me</span></div>
       <div class="price"><small>Designed in one press</small><b id="kw">0.0 kW</b><span id="n">0 panels</span></div>
       <div class="mark">RENUABL</div>`,
      `.roof{position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;filter:saturate(.7) brightness(.72)}
       .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,10,0) 50%,rgba(5,6,10,.85));pointer-events:none}
       .pill{position:absolute;left:48px;top:40px;display:flex;align-items:center;gap:12px;padding:6px 20px 6px 6px;border-radius:999px;
         background:rgba(20,22,27,.82);border:1px solid rgba(255,255,255,.14);font-size:17px;font-weight:600;backdrop-filter:blur(10px)}
       .price{position:absolute;left:48px;bottom:40px}.price small{display:block;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#ff8f4a}
       .price b{display:block;font-size:44px;font-weight:600;letter-spacing:-.03em;font-family:"JetBrains Mono",Consolas,monospace}
       .price span{font-size:16px;color:rgba(255,255,255,.6)}`,
      `const P = [];
       const row = (y, x0, n) => { for (let i = 0; i < n; i++) P.push([x0 + i * 37, y]); };
       row(93, 289, 14); row(147, 345, 11);
       const svg = document.getElementById("panels");
       const panel = ([x, y]) => '<g><rect x="' + x + '" y="' + y + '" width="34" height="50" rx="1.5" fill="#101826" stroke="#d6dde8" stroke-width="1.2"/>'
         + [1,2,3,4,5].map((k) => '<line x1="' + x + '" x2="' + (x + 34) + '" y1="' + (y + k * 8.3) + '" y2="' + (y + k * 8.3) + '" stroke="#2a3a52" stroke-width=".7"/>').join("")
         + '<line x1="' + (x + 17) + '" x2="' + (x + 17) + '" y1="' + y + '" y2="' + (y + 50) + '" stroke="#2a3a52" stroke-width=".7"/></g>';
       window.at = (t) => {
         const n = Math.round(P.length * span(t, 0.08, 0.86));
         svg.innerHTML = P.slice(0, n).map(panel).join("");
         document.getElementById("kw").textContent = (n * 0.475).toFixed(1) + " kW";
         document.getElementById("n").textContent = n + " panels, priced as they land";
         document.querySelector(".pill").style.boxShadow = t < 0.08 ? "0 0 0 3px rgba(255,90,31,.6)" : "none";
       };`,
    ),
  },

  ...Object.fromEntries(Object.entries(EXPLAINERS).map(([name, e]) => [name, { frames: 40, delay: 80, hold: 3800, html: explainer(e) }])),

  /** The CRM: the Today feed, the product's own screen on black. */
  "today.jpg": {
    html: page(
      `<div class="glow"></div><div class="frame"><img src="${shot("today.webp")}"></div><div class="mark">RENUABL</div>`,
      `.glow{position:absolute;left:50%;top:60%;width:900px;height:420px;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(255,90,31,.35),transparent 65%);filter:blur(20px)}
       .frame{position:absolute;left:50%;top:56px;width:980px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.8)}
       .frame img{display:block;width:100%;margin-top:-20px}`,
    ),
  },

  /** After the signature: the install calendar. */
  "runs.jpg": {
    html: page(
      `<div class="glow"></div><div class="frame"><img src="${shot("calendar.webp")}"></div><div class="mark">RENUABL</div>`,
      `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 110%,rgba(255,90,31,.32),transparent 60%)}
       .frame{position:absolute;left:50%;top:56px;width:1000px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.85)}
       .frame img{display:block;width:100%}`,
    ),
  },

  /** The close, as a 1990s mail-order coupon: dashed border, a starburst, ticks and a YES! box. */
  "coupon.jpg": {
    html: page(
      `<div class="paper"><div class="cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <div class="coupon">
          <div class="burst"><b>FIRST<br>MONTH<br>FREE!</b></div>
          <h1><span class="box">✓</span> YES! I want my<br><u>AI sales force.</u></h1>
          <ul><li>✔ Voice agents that ring every new lead</li><li>✔ Sol, the brain of the business</li>
            <li>✔ The AI designer: roofs priced as they're drawn</li><li>✔ Every feature, for every user</li></ul>
          <p class="fine">NO CONTRACT · CANCEL ANY TIME · PRICES INCLUDE GST</p>
        </div></div>`,
      `body{background:#f6efd9}
       .paper{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.015) 0 2px,transparent 2px 4px),#f6efd9}
       .cut{position:absolute;left:40px;top:22px;font-family:"Courier New",monospace;font-size:18px;color:#3a3a3a;letter-spacing:.1em;white-space:nowrap}
       .coupon{position:absolute;left:40px;top:56px;right:40px;bottom:36px;border:5px dashed #151515;background:#fffaf0;padding:34px 48px}
       h1{font-family:"Arial Black","Segoe UI Black",Impact,sans-serif;font-size:54px;line-height:1.02;color:#111;letter-spacing:-.01em}
       h1 u{text-decoration:none;background:linear-gradient(transparent 58%,#ffd400 58%);padding:0 6px}
       .box{display:inline-grid;place-items:center;width:52px;height:52px;border:5px solid #111;font-size:40px;color:#ff3b0a;vertical-align:-6px;margin-right:10px}
       ul{list-style:none;margin-top:26px;font-family:Georgia,"Times New Roman",serif;font-size:25px;line-height:1.55;color:#151515;font-weight:700}
       .fine{position:absolute;left:48px;bottom:26px;font-family:"Courier New",monospace;font-weight:700;font-size:16px;letter-spacing:.12em;color:#333}
       .burst{position:absolute;right:56px;top:34px;width:250px;height:250px;display:grid;place-items:center;transform:rotate(12deg);
         background:#ff3b0a;clip-path:polygon(50% 0,58% 14%,73% 4%,75% 20%,92% 17%,86% 32%,100% 40%,88% 51%,99% 63%,84% 67%,88% 84%,72% 81%,66% 97%,54% 86%,43% 99%,37% 84%,21% 91%,21% 75%,4% 73%,13% 60%,0 50%,12% 40%,3% 26%,19% 23%,18% 6%,34% 13%,42% 0)}
       .burst b{font-family:"Arial Black",Impact,sans-serif;font-size:34px;line-height:1;text-align:center;color:#fff;text-shadow:3px 3px 0 #111}`,
    ),
  },
};

// ---- Taking them ------------------------------------------------------------------------------------------------

const chrome = spawn(
  CHROME,
  ["--headless=new", "--remote-debugging-port=9336", `--user-data-dir=${work}`, "--hide-scrollbars", "about:blank"],
  {
    stdio: "ignore",
  },
);
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch("http://127.0.0.1:9336/json")).json()).find((t) => t.type === "page");
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

async function writeGif(name, frames, delays, colours = 160, width = GIF_W) {
  // Outlook on Windows shows only a GIF's first frame: the finished picture goes first, then it plays from the start.
  frames = [frames.at(-1), ...frames];
  delays = [1600, ...delays];
  const small = await Promise.all(frames.map((f) => sharp(f).resize(width).png().toBuffer()));
  await sharp(small, { join: { animated: true } })
    .gif({ delay: delays, loop: 0, effort: 10, colours, dither: 0.5 })
    .toFile(join(OUT, name));
}

/**
 * Sol, from the homepage itself: his live sun (the canvas corona) and the brain in it, on black, as he breathes.
 * Taken by hiding everything else on the page and filming the sun where it stands.
 */
/** What Sol types on each of his GIFs, in his own voice, after sitting still for two seconds. */
const SOL_SAYS = {
  "sol-intro.gif": "Hi, I'm Sol. Meet your AI sales force: I answer your leads, write your emails and design your roofs.",
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
          <text x="${W - 52}" y="${H - 40}" text-anchor="end" font-family="Inter,Segoe UI,sans-serif" font-size="13" letter-spacing="5" fill="#ffffff" fill-opacity=".5">RENUABL</text>
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
    const c = [...document.querySelectorAll("canvas")].find((x) => (x.parentElement?.className || "").includes("-inset-1/2"));
    if (!c) return null;
    const sun = c.parentElement.parentElement;
    document.documentElement.style.background = "#05060a"; document.body.style.background = "#05060a";
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
  writeFileSync(file, art.html.replaceAll("%%SOL%%", sun).replaceAll("%%SOLBIG%%", big));
  await send("Page.navigate", { url: pathToFileURL(file).href });
  await sleep(1200);
  if (!art.frames) {
    await sharp(await grab())
      .resize(W, H)
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(join(OUT, name));
  } else {
    const frames = [];
    for (let i = 0; i < art.frames; i++) {
      await js(`window.at(${i / (art.frames - 1)})`);
      await sleep(30);
      frames.push(await grab());
    }
    await writeGif(
      name,
      frames,
      frames.map((_, i) => (i === frames.length - 1 ? art.hold : art.delay)),
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
