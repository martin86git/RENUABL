/**
 * Server only. Each member's own Google Calendar, read only (domain/design/my-calendar.ts): Google's sign-in for the
 * calendar.events.readonly scope, the refresh token kept encrypted as Gmail's is (`seal` in gmail.ts) and never sent to
 * a browser, and the one Calendar API call the popup needs. Same Google client as "Continue with Google", with
 * <site>/api/auth/calendar/callback as another authorised redirect and the Google Calendar API enabled on that project.
 */
import { CALENDAR_SCOPE, MAX_EVENTS, cleanEvents, type GoogleEvent, type MyEvent } from "@/lib/domain/design/my-calendar";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import { open, seal } from "./gmail";

export const CALENDAR_STATE_COOKIE = "renuabl_calendar_state";

type Who = { businessId: string; email: string };

export function calendarConfig(origin: string): { clientId: string; secret: string; redirect: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/calendar/callback` };
}

export function calendarAuthUrl(config: { clientId: string; redirect: string }, state: string, hint: string): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: hint,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

const tokenRequest = (body: Record<string, string>) =>
  fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });

/** Swaps Google's code for the tokens and keeps them for this member. False when Google says no or gave no refresh token. */
export async function connectCalendar(
  config: { clientId: string; secret: string; redirect: string },
  code: string,
  member: Who,
): Promise<boolean> {
  const res = await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.secret,
    redirect_uri: config.redirect,
    grant_type: "authorization_code",
  });
  if (!res.ok) return false;
  const t = (await res.json()) as { refresh_token?: string; access_token?: string; expires_in?: number; id_token?: string; scope?: string };
  if (!t.refresh_token || !t.access_token || !t.scope?.includes(CALENDAR_SCOPE)) return false;
  const claims = t.id_token
    ? (JSON.parse(Buffer.from(t.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string })
    : {};
  await query(
    `insert into design_calendar (business_id, email, address, token, access, expires_at) values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6))
     on conflict (business_id, email) do update set address = excluded.address, token = excluded.token, access = excluded.access,
       expires_at = excluded.expires_at`,
    [
      member.businessId,
      member.email.toLowerCase(),
      (claims.email ?? member.email).toLowerCase(),
      seal(t.refresh_token),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
    ],
  );
  return true;
}

/** The Google account a member's calendar is connected as, or null. */
export async function calendarAddress(member: Who): Promise<string | null> {
  const rows = await query<{ address: string }>(`select address from design_calendar where business_id = $1 and email = $2`, [
    member.businessId,
    member.email.toLowerCase(),
  ]);
  return rows[0]?.address ?? null;
}

/** Disconnects: Google is told to forget the token, and it goes from here. */
export async function disconnectCalendar(member: Who): Promise<void> {
  const rows = await query<{ token: string }>(`delete from design_calendar where business_id = $1 and email = $2 returning token`, [
    member.businessId,
    member.email.toLowerCase(),
  ]);
  const token = rows[0] && open(rows[0].token);
  if (token)
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
}

async function accessToken(member: Who): Promise<string | null> {
  const rows = await query<{ token: string; access: string | null; fresh: boolean }>(
    `select token, access, (expires_at > now()) as fresh from design_calendar where business_id = $1 and email = $2`,
    [member.businessId, member.email.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.fresh && row.access) {
    const access = open(row.access);
    if (access) return access;
  }
  const config = calendarConfig("http://localhost");
  const refresh = open(row.token);
  if (!config || !refresh) return null;
  const res = await tokenRequest({
    refresh_token: refresh,
    client_id: config.clientId,
    client_secret: config.secret,
    grant_type: "refresh_token",
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return null;
  await query(
    `update design_calendar set access = $3, expires_at = now() + make_interval(secs => $4) where business_id = $1 and email = $2`,
    [member.businessId, member.email.toLowerCase(), seal(t.access_token), Math.max(60, (t.expires_in ?? 3600) - 60)],
  );
  return t.access_token;
}

export class CalendarOff extends Error {}

/** The member's events between two instants, from their primary calendar, repeating events laid out one by one. */
export async function calendarEvents(member: Who, timeMin: string, timeMax: string): Promise<MyEvent[]> {
  const token = await accessToken(member);
  if (!token) throw new CalendarOff("Your calendar isn't connected.");
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: String(MAX_EVENTS) });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new CalendarOff("Google turned the request down: connect your calendar again.");
  if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
  const body = (await res.json()) as { items?: GoogleEvent[] };
  return cleanEvents(body.items ?? []);
}
