/**
 * A Postgres for development and tests that lives inside the project: no
 * Docker, nothing installed on the machine, and never a hosted database. The
 * real Postgres 17 programs come from the `embedded-postgres` package in this
 * folder's own node_modules (`npm run db:install`), and the data sits in
 * `.local-db/` at the top of the project (ignored by git; delete the folder to
 * start again from nothing).
 *
 *   npm run db        start it and leave it running (Ctrl+C stops it)
 *   npm run db:stop   stop one whose window was closed without Ctrl+C
 *   npm run test:db   run the tests that need a database, starting one for the run if none is up
 *
 * It listens on this computer only. The user name and password below are for
 * this throwaway database alone: they are not secrets and open nothing else.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = path.join(ROOT, ".local-db", "data");
const PORT = Number(process.env.LOCAL_DB_PORT) || 54329;
const USER = "renuabl";
const PASSWORD = "local-only";
/** One database to develop against and one the tests may empty at will. */
const DATABASES = { dev: "renuabl_dev", test: "renuabl_test" };

const urlFor = (database) => `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${database}`;

/** Whether something already answers on the port: a database left running by `npm run db`. */
function listening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: PORT });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

/** Starts Postgres (setting it up the first time) and makes sure both databases exist. */
async function start() {
  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  } catch {
    console.error("The local database isn't installed yet. Run: npm run db:install");
    process.exit(1);
  }
  const quiet = process.env.LOCAL_DB_VERBOSE ? console.log : () => undefined;
  const pg = new EmbeddedPostgres({
    databaseDir: DATA,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
    // UTF-8 whatever the machine's own language settings are, as on the hosted database.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    // This computer only, never the network.
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: quiet,
    onError: quiet,
  });
  if (!existsSync(path.join(DATA, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  try {
    const have = new Set((await client.query("select datname from pg_database")).rows.map((r) => r.datname));
    for (const name of Object.values(DATABASES)) if (!have.has(name)) await client.query(`create database ${name}`);
  } finally {
    await client.end();
  }
  return pg;
}

const command = process.argv[2] ?? "start";

if (command === "start") {
  if (await listening()) {
    console.log(`A database is already running on port ${PORT}.`);
    process.exit(0);
  }
  const pg = await start();
  console.log(
    [
      `Local Postgres is running on this computer (port ${PORT}). Ctrl+C stops it.`,
      "",
      "For the site, put this in .env.local:",
      `  DATABASE_URL=${urlFor(DATABASES.dev)}`,
      "",
      "For the database tests, run `npm run test:db`, or set:",
      `  TEST_DATABASE_URL=${urlFor(DATABASES.test)}`,
    ].join("\n"),
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await pg.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // Keeps this program alive while Postgres (a separate program) runs, and ends it once `npm run db:stop` has shut Postgres down.
  setInterval(async () => {
    if (!stopping && !(await listening())) process.exit(0);
  }, 3_000);
} else if (command === "test") {
  // Uses the database that's already up, else starts one just for this run.
  const pg = (await listening()) ? null : await start();
  const vitest = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
  // One file at a time: the database tests share one database.
  const run = spawn(process.execPath, [vitest, "run", "--no-file-parallelism", ...process.argv.slice(3)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, TEST_DATABASE_URL: urlFor(DATABASES.test) },
  });
  run.on("exit", async (code) => {
    await pg?.stop().catch(() => undefined);
    process.exit(code ?? 1);
  });
} else if (command === "stop") {
  // For a database whose own window was closed without Ctrl+C: asks Postgres to shut down cleanly.
  if (!(await listening())) {
    console.log("No local database is running.");
    process.exit(0);
  }
  const packages = path.join(ROOT, "tools", "local-db", "node_modules", "@embedded-postgres");
  const [platform] = existsSync(packages) ? readdirSync(packages) : [];
  if (!platform) {
    console.error("The local database isn't installed. Run: npm run db:install");
    process.exit(1);
  }
  const { pg_ctl } = await import(pathToFileURL(path.join(packages, platform, "dist", "index.js")).href);
  spawn(pg_ctl, ["stop", "-D", DATA, "-m", "fast"], { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 1));
} else {
  console.error(`Unknown command "${command}". Use: start | stop | test`);
  process.exit(1);
}
