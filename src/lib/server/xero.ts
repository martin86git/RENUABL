/**
 * Server only. A business's own Xero organisation (domain/design/xero.ts): Xero's sign-in (OAuth 2.0, code flow),
 * the tokens kept encrypted with a key of their own and never sent to a browser, and the one helper every Xero call
 * goes through (`xeroCall`), which renews the access token when it has run out. Xero's refresh token changes each time
 * it is used, so the new one is kept each time; it lapses after 60 days unused (VERIFY), after which the business
 * connects again.
 *
 * One organisation a business (`design_xero`, business id first). Needs a Xero app (developer.xero.com, a web app) as
 * XERO_CLIENT_ID and XERO_CLIENT_SECRET, with <site>/api/auth/xero/callback as its redirect URI. XERO_SCOPES overrides
 * the scopes asked for (`XERO_SCOPES` in the domain file).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { XERO_SCOPES, cleanXeroSettings, type XeroSettings } from "@/lib/domain/design/xero";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";

export const XERO_STATE_COOKIE = "renuabl_xero_state";
const IDENTITY = "https://identity.xero.com/connect";
const API = "https://api.xero.com";

let ready: Promise<unknown> | null = null;
/** The tables, made the first time they're needed. */
export const xeroTables = () =>
  (ready ??= query(`
create table if not exists design_xero (
  business_id text primary key references businesses(id) on delete cascade,
  tenant_id text not null,
  tenant_name text not null default '',
  token text not null,
  access text,
  expires_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  connected_by text not null,
  connected_at timestamptz not null default now(),
  synced_at timestamptz,
  problem text
);
create table if not exists design_xero_links (
  business_id text not null references businesses(id) on delete cascade,
  kind text not null,
  ref text not null,
  job_id text,
  xero_id text,
  number text not null default '',
  status text not null default 'sending',
  total numeric,
  amount_due numeric,
  error text,
  at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, kind, ref)
);`).catch((e) => {
    ready = null;
    throw e;
  }));

export interface XeroConfig {
  clientId: string;
  secret: string;
  redirect: string;
  scopes: string;
}

export function xeroConfig(origin?: string): XeroConfig | null {
  const clientId = process.env.XERO_CLIENT_ID?.trim();
  const secret = process.env.XERO_CLIENT_SECRET?.trim();
  const base = siteUrl() ?? origin;
  if (!clientId || !secret || !base) return null;
  return { clientId, secret, redirect: `${base}/api/auth/xero/callback`, scopes: process.env.XERO_SCOPES?.trim() || XERO_SCOPES };
}

export const xeroAuthUrl = (c: XeroConfig, state: string) =>
  `https://login.xero.com/identity/connect/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirect,
    scope: c.scopes,
    state,
  })}`;

// The tokens are sealed with a key of Xero's own, so a Xero connection never hangs on another provider's secret.
const key = () =>
  createHash("sha256")
    .update(`renuabl-xero:${process.env.XERO_CLIENT_SECRET ?? ""}`)
    .digest();
function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}
function open(sealed: string | null): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

interface Tokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

async function tokenRequest(c: XeroConfig, body: Record<string, string>): Promise<Tokens | null> {
  const res = await fetch(`${IDENTITY}/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${c.clientId}:${c.secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()) as Tokens;
}

const expiry = (t: Tokens) => Math.max(60, (t.expires_in ?? 1800) - 60);

/**
 * Swaps Xero's code for the tokens and keeps the organisation picked when Xero asked (the newest connection, as Xero
 * lists the one just made last). In place of any organisation the business had connected.
 */
export async function connectXero(
  c: XeroConfig,
  code: string,
  businessId: string,
  by: string,
): Promise<"connected" | "failed" | "no-organisation"> {
  const t = await tokenRequest(c, { grant_type: "authorization_code", code, redirect_uri: c.redirect });
  if (!t?.access_token || !t.refresh_token) return "failed";
  const res = await fetch(`${API}/connections`, {
    headers: { authorization: `Bearer ${t.access_token}`, accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return "failed";
  const orgs = ((await res.json()) as { tenantId?: string; tenantType?: string; tenantName?: string; createdDateUtc?: string }[]).filter(
    (o) => o.tenantId && (o.tenantType ?? "ORGANISATION") === "ORGANISATION",
  );
  const org = orgs.sort((a, b) => (a.createdDateUtc ?? "").localeCompare(b.createdDateUtc ?? "")).at(-1);
  if (!org?.tenantId) return "no-organisation";
  await xeroTables();
  await query(
    `insert into design_xero (business_id, tenant_id, tenant_name, token, access, expires_at, connected_by)
     values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6), $7)
     on conflict (business_id) do update set tenant_id = excluded.tenant_id, tenant_name = excluded.tenant_name, token = excluded.token,
       access = excluded.access, expires_at = excluded.expires_at, connected_by = excluded.connected_by, connected_at = now(), problem = null`,
    [businessId, org.tenantId, (org.tenantName ?? "").slice(0, 200), seal(t.refresh_token), seal(t.access_token), expiry(t), by],
  );
  return "connected";
}

export interface XeroConnection {
  tenantName: string;
  connectedBy: string;
  connectedAt: string;
  syncedAt: string | null;
  problem: string | null;
  settings: XeroSettings;
}

export async function xeroConnection(businessId: string): Promise<XeroConnection | null> {
  await xeroTables();
  const rows = await query<{
    tenant_name: string;
    connected_by: string;
    connected_at: Date;
    synced_at: Date | null;
    problem: string | null;
    settings: unknown;
  }>(`select tenant_name, connected_by, connected_at, synced_at, problem, settings from design_xero where business_id = $1`, [businessId]);
  const r = rows[0];
  if (!r) return null;
  return {
    tenantName: r.tenant_name,
    connectedBy: r.connected_by,
    connectedAt: r.connected_at.toISOString(),
    syncedAt: r.synced_at?.toISOString() ?? null,
    problem: r.problem,
    settings: cleanXeroSettings(r.settings),
  };
}

export async function saveXeroSettings(businessId: string, raw: unknown): Promise<XeroSettings | null> {
  await xeroTables();
  const settings = cleanXeroSettings(raw);
  const rows = await query(`update design_xero set settings = $2 where business_id = $1 returning business_id`, [
    businessId,
    JSON.stringify(settings),
  ]);
  return rows.length ? settings : null;
}

/** Forgets the organisation here and asks Xero to forget the refresh token. What was sent to Xero stays in Xero. */
export async function disconnectXero(businessId: string): Promise<void> {
  await xeroTables();
  const rows = await query<{ token: string }>(`delete from design_xero where business_id = $1 returning token`, [businessId]);
  const refresh = open(rows[0]?.token ?? null);
  const c = xeroConfig();
  if (refresh && c)
    await fetch(`${IDENTITY}/revocation`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${c.clientId}:${c.secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: refresh }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
}

/** Notes what went wrong on the connection (shown in Settings), or clears it. */
export async function noteXeroProblem(businessId: string, problem: string | null): Promise<void> {
  await query(`update design_xero set problem = $2 where business_id = $1`, [businessId, problem?.slice(0, 300) ?? null]).catch(() => null);
}

/** A live access token and the organisation, renewing the token when it has run out. Null when not connected or Xero refused. */
async function accessFor(businessId: string): Promise<{ access: string; tenant: string } | null> {
  await xeroTables();
  const rows = await query<{ tenant_id: string; token: string; access: string | null; fresh: boolean }>(
    `select tenant_id, token, access, coalesce(expires_at > now(), false) as fresh from design_xero where business_id = $1`,
    [businessId],
  );
  const r = rows[0];
  if (!r) return null;
  const access = open(r.access);
  if (r.fresh && access) return { access, tenant: r.tenant_id };
  const c = xeroConfig();
  const refresh = open(r.token);
  if (!c || !refresh) return null;
  const t = await tokenRequest(c, { grant_type: "refresh_token", refresh_token: refresh });
  if (!t?.access_token) {
    await noteXeroProblem(businessId, "Xero stopped accepting RENUABL's connection. Connect Xero again.");
    return null;
  }
  await query(
    `update design_xero set access = $2, token = coalesce($3, token), expires_at = now() + make_interval(secs => $4), problem = null where business_id = $1`,
    [businessId, seal(t.access_token), t.refresh_token ? seal(t.refresh_token) : null, expiry(t)],
  );
  return { access: t.access_token, tenant: r.tenant_id };
}

export type XeroAnswer<T> = { ok: true; body: T } | { ok: false; status: number; message: string };

/** One call to Xero's Accounting API for this business. `idempotency` stops a retry making the same invoice twice. */
export async function xeroCall<T>(
  businessId: string,
  method: "GET" | "PUT" | "POST",
  path: string,
  body?: unknown,
  idempotency?: string,
): Promise<XeroAnswer<T>> {
  const a = await accessFor(businessId);
  if (!a) return { ok: false, status: 401, message: "Xero isn't connected." };
  const res = await fetch(`${API}/api.xro/2.0/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${a.access}`,
      "xero-tenant-id": a.tenant,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(idempotency ? { "idempotency-key": idempotency.slice(0, 128) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, message: "Xero couldn't be reached." };
  const json = (await res.json().catch(() => null)) as T & { Message?: string; Elements?: { ValidationErrors?: { Message?: string }[] }[] };
  if (!res.ok) {
    const why =
      json?.Elements?.[0]?.ValidationErrors?.map((e) => e.Message)
        .filter(Boolean)
        .join(" ") ||
      json?.Message ||
      `Xero answered ${res.status}.`;
    return { ok: false, status: res.status, message: String(why).slice(0, 300) };
  }
  return { ok: true, body: json };
}
