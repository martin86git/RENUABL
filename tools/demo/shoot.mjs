/**
 * Local only: screenshots of the roof designer's screens for the sign-up page, taken as the made-up demo business
 * (`sign-in-link.mjs` makes it) with headless Chrome. Opens a one-hour session for the demo email straight in this
 * computer's own database (refuses any other), visits each page, and saves a WebP in public/design/landing/.
 *
 *   node tools/demo/shoot.mjs [port]
 */
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import sharp from "sharp";

process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):54329\//.test(url)) {
  console.error("Refusing: DATABASE_URL isn't the local database (localhost:54329).");
  process.exit(1);
}
const EMAIL = "demo@sunrise-solar.example";
const PORT = process.argv[2] ?? "3100";
const SITE = `http://localhost:${PORT}`;
const OUT = "public/design/landing";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

/**
 * A real answer from Sol in the Installations channel, framed from the question to the box (the sign-up page's Sol
 * example and cold email 4). It finds the last question that asks him to draw battery clearances, so ask it in the
 * demo business's Installations channel first; the shot is clipped to that part of the chat.
 */
const SOL_EXAMPLE = `window.__clip = "wait"; (async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim().endsWith("Installations"))?.click();
  await wait(3500);
  const asks = [...document.querySelectorAll("p, div, span")].filter((e) => {
    const said = (el) => /battery/i.test(el.textContent) && /clearances/i.test(el.textContent) && /draw/i.test(el.textContent);
    return said(e) && ![...e.children].some(said);
  });
  const q = asks[asks.length - 1];
  if (!q) return null;
  let box = q;
  while (box && !(box.scrollHeight > box.clientHeight + 20 && getComputedStyle(box).overflowY !== "visible")) box = box.parentElement;
  box.scrollTop = box.scrollHeight;
  await wait(800);
  const top = q.getBoundingClientRect().top - 64;
  const pane = box.getBoundingClientRect();
  const input = document.querySelector("textarea, [contenteditable=true]");
  const bottom = (input ? input.getBoundingClientRect().bottom : pane.bottom) + 18;
  return JSON.stringify({ x: pane.left, y: Math.max(pane.top - 70, top), width: pane.width, height: bottom - Math.max(pane.top - 70, top) });
})().then((v) => (window.__clip = v ?? ""));`;

/** Each screen: the file name, the page, the window size, how long to let it settle, and anything to do first. */
const SHOTS = [
  { name: "today", path: "/design", width: 1440, height: 900, wait: 5000 },
  { name: "deals", path: "/design/sales/pipelines", width: 1440, height: 900, wait: 5000 },
  { name: "approvals", path: "/design/procurement/pre-approvals", width: 1440, height: 900, wait: 4500 },
  { name: "calendar", path: "/design/procurement/scheduler", width: 1440, height: 900, wait: 4500 },
  { name: "upcoming", path: "/design/installations", width: 1440, height: 900, wait: 4500 },
  { name: "completed", path: "/design/installations/completed", width: 1440, height: 900, wait: 4500 },
  { name: "sol", path: "/design/sol", width: 1440, height: 900, wait: 6000 },
  { name: "customers", path: "/design/customers", width: 1440, height: 900, wait: 4000 },
  { name: "service", path: "/design/service", width: 1440, height: 900, wait: 4000 },
  { name: "sol-garage-wall", path: "/design/team", width: 1440, height: 1300, wait: 4000, clip: SOL_EXAMPLE, jpeg: true },
];

const only = process.argv.slice(3);

const session = randomBytes(32).toString("hex");
const db = new pg.Client({ connectionString: url });
await db.connect();
await db.query(`insert into sessions (id_hash, email, role, expires_at) values ($1, $2, 'business', now() + interval '1 hour')`, [
  createHash("sha256").update(session).digest("hex"),
  EMAIL,
]);

const profile = mkdtempSync(join(tmpdir(), "renuabl-shoot-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"],
  {
    stdio: "ignore",
  },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page");
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
const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp("Network.enable");
await cdp("Page.enable");
// As a business that has used it a while: the one-time note on the new look already seen, and no development badge.
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `try { localStorage.setItem("renuabl.design.new-look-2026-10-31", "seen"); } catch {}
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(s);
    });`,
});
await cdp("Network.setCookie", { name: "renuabl_session", value: session, url: SITE, httpOnly: true, path: "/" });
mkdirSync(OUT, { recursive: true });
for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.name))) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: shot.width, height: shot.height, deviceScaleFactor: 2, mobile: false });
  await cdp("Page.navigate", { url: SITE + shot.path });
  await sleep(shot.wait);
  let clip;
  if (shot.clip) {
    // Run the framing script, then read what it worked out once it has finished.
    await cdp("Runtime.evaluate", { expression: shot.clip });
    let framed = "wait";
    for (let i = 0; i < 40 && framed === "wait"; i++) {
      await sleep(250);
      framed = (await cdp("Runtime.evaluate", { expression: "window.__clip", returnByValue: true })).result.value;
    }
    const result = { value: framed === "wait" ? "" : framed };
    if (!result.value) {
      console.error(`skipped ${shot.name}: nothing to frame`);
      continue;
    }
    clip = { ...JSON.parse(result.value), scale: 1 };
  }
  const { data } = await cdp("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
  const png = Buffer.from(data, "base64");
  const file = join(OUT, `${shot.name}.webp`);
  writeFileSync(
    file,
    await sharp(png)
      .resize({ width: clip ? undefined : shot.width * 2 })
      .webp({ quality: 82 })
      .toBuffer(),
  );
  console.log(`saved ${file}`);
  // The emails load JPEGs (Outlook for Windows shows no WebP), 1040 wide.
  if (shot.jpeg) {
    const jpg = join(OUT, `${shot.name}.jpg`);
    writeFileSync(jpg, await sharp(png).resize({ width: 1040 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer());
    console.log(`saved ${jpg}`);
  }
}
ws.close();
chrome.kill();
await db.query(`delete from sessions where id_hash = $1`, [createHash("sha256").update(session).digest("hex")]);
await db.end();
