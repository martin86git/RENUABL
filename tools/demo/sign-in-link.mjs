/**
 * Local only: a one-time sign-in link to the roof designer for a made-up demo business, for taking the sign-up page's
 * screenshots with example data. Refuses to run unless DATABASE_URL in .env.local is this computer's own database
 * (`npm run db`, port 54329), so it can never write to the hosted one.
 *
 *   node tools/demo/sign-in-link.mjs [email] [port]
 */
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):54329\//.test(url)) {
  console.error("Refusing: DATABASE_URL isn't the local database (localhost:54329).");
  process.exit(1);
}
const email = (process.argv[2] ?? "demo@sunrise-solar.example").toLowerCase();
const port = process.argv[3] ?? "3100";
const token = randomBytes(32).toString("hex");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  `insert into login_tokens (token_hash, email, role, next, expires_at) values ($1,$2,'business','/design', now() + interval '30 minutes')`,
  [createHash("sha256").update(token).digest("hex"), email],
);
await client.end();
console.log(`http://localhost:${port}/api/auth/callback?token=${token}&for=design`);
