/**
 * Local only: drives the product in headless Chrome as the made-up demo business ("Sunrise Solar (example)"), for the
 * sales page's film. Opens a one-hour session for the demo email straight in this computer's own database (refuses any
 * other), then runs a steps module against the page:
 *
 *   node tools/demo/drive.mjs <steps.mjs> [port]
 *
 * The steps module's default export gets `{ go, js, wait, click, type, shot, files, intercept, db, site }`.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import sharp from "sharp";

process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):54329\//.test(url)) {
  console.error("Refusing: DATABASE_URL isn't the local database (localhost:54329).");
  process.exit(1);
}
const EMAIL = process.env.DRIVE_EMAIL ?? "demo@sunrise-solar.example";
const PORT = process.argv[3] ?? "3100";
const SITE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new pg.Client({ connectionString: url });
await db.connect();
const session = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(session).digest("hex");
await db.query(`insert into sessions (id_hash, email, role, expires_at) values ($1, $2, 'business', now() + interval '1 hour')`, [
  hash,
  EMAIL,
]);

const profile = mkdtempSync(join(tmpdir(), "renuabl-drive-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=9334",
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    ...(process.env.CHROME_FLAGS ?? "").split(" ").filter(Boolean),
    "about:blank",
  ],
  {
    stdio: "ignore",
  },
);
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch("http://127.0.0.1:9334/json")).json()).find((t) => t.type === "page");
  } catch {
    // Chrome isn't up yet.
  }
}
if (!target) throw new Error("Chrome didn't start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
const handlers = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  } else if (m.method) for (const h of handlers) h(m);
});
const cdp = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    waiting.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp("Network.enable");
await cdp("Page.enable");
await cdp("DOM.enable");
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `try { localStorage.setItem("renuabl.design.new-look-2026-10-31", "seen"); } catch {}
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(s);
    });`,
});
await cdp("Network.setCookie", { name: "renuabl_session", value: session, url: SITE, httpOnly: true, path: "/" });

/** Answers from the server swapped for ours, by a part of the address and the method. */
const swaps = [];
handlers.push(async (m) => {
  if (m.method !== "Fetch.requestPaused") return;
  const { requestId, request } = m.params;
  const swap = swaps.find((s) => request.url.includes(s.url) && (!s.method || s.method === request.method));
  if (!swap) return cdp("Fetch.continueRequest", { requestId }).catch(() => {});
  const body = Buffer.from(typeof swap.body === "string" ? swap.body : JSON.stringify(swap.body)).toString("base64");
  await cdp("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body,
  }).catch(() => {});
});

const js = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

const api = {
  site: SITE,
  db,
  cdp,
  wait: sleep,
  size: (width, height) => cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false }),
  go: async (path, ms = 4000) => {
    await cdp("Page.navigate", { url: SITE + path });
    await sleep(ms);
  },
  js,
  /** Presses the first button or link whose words match. */
  click: async (words, scope = "button, a, [role=button], [role=switch], [role=tab]", within = 12000) => {
    let ok = false;
    for (let waited = 0; !ok && waited <= within; waited += 400) {
      if (waited) await sleep(400);
      ok = await js(`const re = new RegExp(${JSON.stringify(words)}, "i");
      const el = [...document.querySelectorAll(${JSON.stringify(scope)})].find((b) =>
        [b.textContent, b.getAttribute("aria-label"), b.title].some((w) => w && re.test(w.trim().replace(/\\s+/g, " "))));
      if (!el || el.disabled) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;`);
    }
    if (!ok) console.error(`no button: ${words}`);
    return ok;
  },
  /** Types into the field matched by a CSS selector, as a person would (so React hears it). */
  type: async (selector, text) => {
    await js(`const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.();`);
    await cdp("Input.insertText", { text });
  },
  files: async (selector, paths) => {
    const { root } = await cdp("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await cdp("DOM.querySelector", { nodeId: root.nodeId, selector });
    await cdp("DOM.setFileInputFiles", { nodeId, files: paths.map((p) => resolve(p)) });
  },
  intercept: async (url, body, method) => {
    swaps.push({ url, body, method });
    await cdp("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  },
  /** The page (or a part of it, CSS pixels) saved as WebP at twice the size. */
  shot: async (file, clip) => {
    const { data } = await cdp("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await sharp(Buffer.from(data, "base64")).webp({ quality: 84 }).toBuffer());
    console.log(`saved ${file}`);
  },
  text: () => js(`return document.body.innerText`),
};

try {
  const steps = await import(pathToFileURL(resolve(process.argv[2])).href);
  await steps.default(api);
} finally {
  ws.close();
  chrome.kill();
  await db.query(`delete from sessions where id_hash = $1`, [hash]);
  await db.end();
}
