/**
 * The launch emails' pictures (22 Nov 2026, Martin: "imagery should be high end", influenced by Tesla, SpaceX and Apple).
 * Each is drawn here as a page (CSS and SVG, with the product's own screenshots from public/design/landing) and taken
 * by headless Chrome at twice the size, then written as a 1200 x 675 JPEG to public/design/launch/, where
 * /api/design/marketing/gtm reads them into RENUABL's own Marketing pictures. No stock photos, no other business's
 * marks, made-up customers only.
 *
 *   node tools/marketing/launch-art.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("public/design/launch");
const W = 1200;
const H = 675;
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "renuabl-art-"));
const shot = (f) => pathToFileURL(resolve("public/design/landing", f)).href;

/** Stars, scattered the same way each time. */
function stars(n, seed = 7) {
  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => {
    const o = (0.15 + r() * 0.7).toFixed(2);
    const z = (0.6 + r() * 1.4).toFixed(1);
    return `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H * 0.7).toFixed(0)}" r="${z}" fill="#fff" opacity="${o}"/>`;
  }).join("");
}

/** The sun as the product draws Sol: a glowing orb, hot core high left, gold to the signal orange. */
const SUN = (size, glow = 1, x = 0, y = 0) => `
  <div style="position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;
    background:radial-gradient(circle at 34% 30%, #fff7dc 0%, #ffd36b 18%, #ffa22e 42%, #ff5a1f 72%, #c63a0b 100%);
    box-shadow:0 0 ${80 * glow}px ${30 * glow}px rgba(255,120,40,.45), 0 0 ${220 * glow}px ${90 * glow}px rgba(255,90,31,.22);"></div>`;

const BASE = `*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#05060a;
  font-family:Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .mark{position:absolute;left:56px;bottom:44px;color:rgba(255,255,255,.55);font-size:13px;letter-spacing:.42em;font-weight:500}
  .tag{position:absolute;right:56px;bottom:44px;color:rgba(255,255,255,.38);font-size:12px;letter-spacing:.22em;text-transform:uppercase}`;

/** Two rows of panels on the house's long face, each dark glass with a fine silver frame and its cells. */
function roofPanels() {
  const out = [];
  const row = (y, x0, n) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 37;
      out.push(
        `<g><rect x="${x}" y="${y}" width="34" height="50" rx="1.5" fill="#101826" stroke="#c9d2de" stroke-width="1.2"/>` +
          [1, 2, 3, 4, 5]
            .map((k) => `<line x1="${x}" x2="${x + 34}" y1="${y + k * 8.3}" y2="${y + k * 8.3}" stroke="#2a3a52" stroke-width=".7"/>`)
            .join("") +
          `<line x1="${x + 17}" x2="${x + 17}" y1="${y}" y2="${y + 50}" stroke="#2a3a52" stroke-width=".7"/>` +
          `<rect x="${x}" y="${y}" width="34" height="18" fill="url(#sheen)" opacity=".5"/></g>`,
      );
    }
  };
  row(93, 289, 14);
  row(147, 345, 11);
  return (
    `<defs><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb4ff" stop-opacity=".45"/><stop offset="1" stop-color="#8fb4ff" stop-opacity="0"/></linearGradient></defs>` +
    out.join("")
  );
}

const page = (body, css = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;

const ART = {
  /** One giant leap: the sun rising over the curve of the earth, from orbit. */
  "leap.jpg": page(`
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">${stars(160)}</svg>
    ${SUN(128, 1.4, 600, 300)}
    <div style="position:absolute;left:-30%;right:-30%;top:300px;height:1400px;border-radius:50%;
      background:radial-gradient(ellipse at 50% 0%, #1a2233 0%, #0b0f18 18%, #05060a 40%);
      box-shadow:0 -2px 0 0 rgba(255,170,90,.95), 0 -10px 40px 6px rgba(255,110,40,.55), 0 -40px 140px 30px rgba(255,90,31,.25);"></div>
    <div style="position:absolute;left:0;right:0;top:300px;height:3px;filter:blur(2px);
      background:linear-gradient(90deg,transparent,rgba(255,220,160,.9) 45%,rgba(255,255,255,1) 50%,rgba(255,220,160,.9) 55%,transparent)"></div>
    <div class="mark">RENUABL</div><div class="tag">One giant leap for solar</div>`),

  /** The AI sales force: a voice agent on a call, the words as they are said. */
  "voice.jpg": page(
    `
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff5a1f" stop-opacity="0"/>
        <stop offset=".5" stop-color="#ff7a2e"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></linearGradient></defs>
      ${Array.from({ length: 96 }, (_, i) => {
        const x = 20 + i * 12.3;
        const h = 18 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 190 + (i % 7 === 0 ? 40 : 0);
        return `<rect x="${x.toFixed(1)}" y="${(337 - h / 2).toFixed(1)}" width="5" height="${h.toFixed(1)}" rx="2.5" fill="url(#g)" opacity=".85"/>`;
      }).join("")}
    </svg>
    <div class="card">
      <div class="row"><div class="av"><span></span><span></span><span></span><span></span><span></span></div>
        <div><div class="nm">Charlie <em>· your sales agent</em></div><div class="st"><i></i>On a call with Jo · 0:42</div></div></div>
      <div class="b l">Do I need a battery, or is solar enough?</div>
      <div class="b r">With most of your use after dark, a battery is worth a look. Can I book you a time with the team?</div>
      <div class="b l">Thursday after four works.</div>
    </div>
    <div class="mark">RENUABL</div><div class="tag">Your AI sales force</div>`,
    `.card{position:absolute;right:92px;top:118px;width:430px;padding:22px;border-radius:22px;
      background:rgba(22,24,30,.72);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.12);
      box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);color:#fff}
     .row{display:flex;gap:14px;align-items:center;margin-bottom:18px}
     .av{width:48px;height:48px;border-radius:50%;background:#2a2d34;display:flex;align-items:center;justify-content:center;gap:3px;
       box-shadow:0 0 0 2px #ff5a1f, 0 0 24px rgba(255,90,31,.6)}
     .av span{display:block;width:3px;border-radius:2px;background:#ff7a2e}
     .av span:nth-child(1),.av span:nth-child(5){height:8px}.av span:nth-child(2),.av span:nth-child(4){height:16px}.av span:nth-child(3){height:22px}
     .nm{font-size:17px;font-weight:600}.nm em{font-style:normal;font-weight:400;color:rgba(255,255,255,.5)}
     .st{font-size:13px;color:#ff8f4a;margin-top:3px;font-family:"JetBrains Mono",Consolas,monospace}
     .st i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff5a1f;margin-right:8px;box-shadow:0 0 8px #ff5a1f}
     .b{font-size:14.5px;line-height:1.45;padding:10px 14px;border-radius:16px;margin-top:9px;max-width:86%}
     .l{background:rgba(255,255,255,.1)}.r{background:#ff5a1f;margin-left:auto;color:#fff}`,
  ),

  /** The designer: a roof drawn in moments, the product's own screen on black. */
  "today.jpg": page(
    `
    <div class="glow"></div>
    <div class="frame"><img src="${shot("today.webp")}"></div>
    <div class="mark">RENUABL</div><div class="tag">Today, run by Sol</div>`,
    `.glow{position:absolute;left:50%;top:60%;width:900px;height:420px;transform:translate(-50%,-50%);
       background:radial-gradient(ellipse,rgba(255,90,31,.35),transparent 65%);filter:blur(20px)}
     .frame{position:absolute;left:50%;top:56px;width:980px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);
       box-shadow:0 40px 120px rgba(0,0,0,.8)}
     .frame img{display:block;width:100%;margin-top:-20px}`,
  ),

  /** Sol: the brain of the business, on the Today screen. */
  "sol.jpg": page(
    `
    ${SUN(150, 1.2, 190, 330)}
    <div class="frame"><img src="${shot("today-sol.webp")}"></div>
    <div class="mark">RENUABL</div><div class="tag">Sol · the brain of your business</div>`,
    `.frame{position:absolute;left:360px;top:64px;width:900px;height:540px;border-radius:18px;overflow:hidden;
       border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.85), -30px 0 90px rgba(255,90,31,.22)}
     .frame img{display:block;margin-top:-60px;margin-left:-300px;width:1500px}`,
  ),

  /** After the signature: the install calendar running itself. */
  "runs.jpg": page(
    `
    <div class="glow"></div>
    <div class="frame"><img src="${shot("calendar.webp")}"></div>
    <div class="mark">RENUABL</div><div class="tag">Signed. Then it runs itself.</div>`,
    `.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 110%,rgba(255,90,31,.32),transparent 60%)}
     .frame{position:absolute;left:50%;top:56px;width:1000px;height:540px;transform:translateX(-50%);border-radius:18px;overflow:hidden;
       border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.85)}
     .frame img{display:block;width:100%}`,
  ),

  /** The roof: drawn to scale from above, as the designer sees it. */
  "roof.jpg": page(
    `
    <img class="roof" src="${shot("aerial-demo.webp")}">
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">${roofPanels()}</svg>
    <div class="shade"></div>
    <div class="mark">RENUABL</div><div class="tag">Designed from above</div>`,
    `.roof{position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;filter:saturate(.75) brightness(.8)}
     .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,10,.1),rgba(5,6,10,.15) 55%,rgba(5,6,10,.85))}`,
  ),

  /** The close: the sun over the horizon, the leap made. */
  "close.jpg": page(`
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">${stars(90, 11)}</svg>
    ${SUN(420, 1.6, 600, 470)}
    <div style="position:absolute;left:0;right:0;top:470px;bottom:0;background:linear-gradient(180deg,#05060a,#05060a)"></div>
    <div style="position:absolute;left:0;right:0;top:469px;height:2px;background:linear-gradient(90deg,transparent,#ffd59a,transparent)"></div>
    <div class="mark">RENUABL</div><div class="tag">The future of solar is here</div>`),
};

for (const [name, html] of Object.entries(ART)) {
  const file = join(work, name.replace(".jpg", ".html"));
  writeFileSync(file, html);
  const png = join(work, name.replace(".jpg", ".png"));
  execFileSync(CHROME, [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=${W},${H}`,
    "--virtual-time-budget=3000",
    `--screenshot=${png}`,
    pathToFileURL(file).href,
  ]);
  await sharp(readFileSync(png)).resize(W, H).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, name));
  console.log("made", name);
}
