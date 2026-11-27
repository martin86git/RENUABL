/**
 * The RENUABL wordmark with a line under it, for marketing.
 *
 *   node tools/marketing/logo-tagline.mjs ["The line to put under it"]
 *
 * Writes public/brand/renuabl-logo-tagline.png (dark, for light grounds) and
 * renuabl-logo-tagline-white.png (for dark grounds), both on a clear ground. The wordmark is the website's own
 * file, never typed; the line is Inter in spaced capitals, tracked out to run exactly the wordmark's width. Also
 * renuabl-logo-tagline-email.png, the same sized for the top of a marketing email (domain/marketing/edm.ts).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
/** A second word names the files (renuabl-logo-<name>.png), so several lines can be kept side by side. */
const NAME = (process.argv[3] ?? "tagline").replace(/[^a-z0-9-]/gi, "") || "tagline";
const LINE = process.argv[2] ?? "The all-in-one AI-powered platform for solar";

/**
 * The wordmark file is 2650 × 456; its letters run from 80 to 2550 across and 105 to 365 down. Each size is the
 * wordmark at a width, with the line's type size and where its top sits; the line is tracked to the letters' width.
 */
const FULL = { w: 2650, h: 600, top: 462, font: 56 };
/** For the top of an email, shown 300 wide (drawn at twice that): the line larger against the wordmark, to be read. */
const EMAIL = { w: 600, h: 134, top: 105, font: 17 };

const root = resolve(import.meta.dirname, "../..");
const url = (p) => pathToFileURL(join(root, p)).href;
const dir = mkdtempSync(join(tmpdir(), "renuabl-logo-"));

function page(logo, colour, { w, h, top, font }) {
  const k = w / 2650;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url("${url("src/app/fonts/inter-latin.woff2")}");font-weight:100 900}
html,body{margin:0;background:transparent}
body{width:${w}px;height:${h}px;position:relative;overflow:hidden}
img{position:absolute;left:0;top:0;width:${w}px}
p{position:absolute;left:${80 * k}px;top:${top}px;margin:0;white-space:nowrap;font:400 ${font}px/1 Inter;
  text-transform:uppercase;color:${colour}}
</style><img src="${url(logo)}"><p id="t">${LINE.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p><script>
document.fonts.ready.then(()=>{const t=document.getElementById("t");const n=[...t.textContent].length;
const w=t.getBoundingClientRect().width;t.style.letterSpacing=((${2470 * k}-w)/(n-1))+"px"})</script>`;
}

for (const [logo, colour, out, size] of [
  ["public/brand/renuabl-logo.png", "#1d1d1d", `public/brand/renuabl-logo-${NAME}.png`, FULL],
  ["public/brand/renuabl-logo-white.png", "#ffffff", `public/brand/renuabl-logo-${NAME}-white.png`, FULL],
  ["public/brand/renuabl-logo.png", "#1d1d1d", `public/brand/renuabl-logo-${NAME}-email.png`, EMAIL],
]) {
  const html = join(dir, "logo.html");
  writeFileSync(html, page(logo, colour, size));
  const done = spawnSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--user-data-dir=${join(dir, "profile")}`,
    "--default-background-color=00000000",
    `--window-size=${size.w},${size.h}`,
    "--virtual-time-budget=3000",
    `--screenshot=${join(root, out)}`,
    pathToFileURL(html).href,
  ]);
  if (done.status !== 0) throw new Error(`Chrome couldn't draw ${out}: ${done.stderr}`);
  console.log("wrote", out);
}

try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  // Chrome may still hold a file for a moment.
}
