/**
 * Server only. Each member's own calendar (domain/design/my-calendar.ts), read, and added to when Sol books a meeting (bookMeeting): Google Calendar or Outlook, one at a
 * time. The provider's sign-in for calendar access, the refresh token kept encrypted as Gmail's is (`seal`
 * in gmail.ts) and never sent to a browser, and the one events call the popup needs.
 * - Google: the same client as "Continue with Google" (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET), with the
 *   Google Calendar API enabled on that project.
 * - Outlook: a Microsoft Entra app registration for work and personal accounts (MICROSOFT_OAUTH_CLIENT_ID,
 *   MICROSOFT_OAUTH_CLIENT_SECRET), with the delegated Graph permission Calendars.Read.
 * Both need <site>/api/auth/calendar/callback as an authorised redirect.
 */
import {
  CALENDAR_SCOPE,
  MAX_EVENTS,
  OUTLOOK_SCOPE,
  OUTLOOK_TIME_ZONE,
  cleanEvents,
  cleanOutlookEvents,
  type CalendarProvider,
  type GoogleEvent,
  type MyEvent,
  type OutlookEvent,
} from "@/lib/domain/design/my-calendar";
import { siteUrl } from "@/lib/domain/sms";
import { googleEventBody, meetLinkOf, type MeetingAsk } from "@/lib/domain/design/sol-meeting";
import { query } from "./db";
import { open, seal } from "./gmail";

export const CALENDAR_STATE_COOKIE = "renuabl_calendar_state";

type Who = { businessId: string; email: string };
export interface CalendarConfig {
  provider: CalendarProvider;
  clientId: string;
  secret: string;
  redirect: string;
}

const MICROSOFT = "https://login.microsoftonline.com/common/oauth2/v2.0";
const TOKEN_URL: Record<CalendarProvider, string> = {
  google: "https://oauth2.googleapis.com/token",
  outlook: `${MICROSOFT}/token`,
};
const SCOPES: Record<CalendarProvider, string> = {
  google: `openid email ${CALENDAR_SCOPE}`,
  outlook: `openid email profile offline_access ${OUTLOOK_SCOPE}`,
};

export function calendarConfig(provider: CalendarProvider, origin: string): CalendarConfig | null {
  const env = provider === "google" ? "GOOGLE" : "MICROSOFT";
  const clientId = process.env[`${env}_OAUTH_CLIENT_ID`]?.trim();
  const secret = process.env[`${env}_OAUTH_CLIENT_SECRET`]?.trim();
  if (!clientId || !secret) return null;
  return { provider, clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/calendar/callback` };
}

export function calendarAuthUrl(config: CalendarConfig, state: string, hint: string): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: SCOPES[config.provider],
    login_hint: hint,
    state,
    ...(config.provider === "google"
      ? { access_type: "offline", prompt: "consent", include_granted_scopes: "true" }
      : { response_mode: "query", prompt: "select_account" }),
  });
  return config.provider === "google" ? `https://accounts.google.com/o/oauth2/v2/auth?${q}` : `${MICROSOFT}/authorize?${q}`;
}

const tokenRequest = (provider: CalendarProvider, body: Record<string, string>) =>
  fetch(TOKEN_URL[provider], {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });

/** Swaps the provider's code for the tokens and keeps them for this member, in place of any calendar they had. */
export async function connectCalendar(config: CalendarConfig, code: string, member: Who): Promise<boolean> {
  const res = await tokenRequest(config.provider, {
    code,
    client_id: config.clientId,
    client_secret: config.secret,
    redirect_uri: config.redirect,
    grant_type: "authorization_code",
    ...(config.provider === "outlook" ? { scope: SCOPES.outlook } : {}),
  });
  if (!res.ok) return false;
  const t = (await res.json()) as { refresh_token?: string; access_token?: string; expires_in?: number; id_token?: string; scope?: string };
  const granted = config.provider === "google" ? t.scope?.includes(CALENDAR_SCOPE) : /calendars\.read/i.test(t.scope ?? "");
  if (!t.refresh_token || !t.access_token || !granted) return false;
  const claims = t.id_token
    ? (JSON.parse(Buffer.from(t.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
        email?: string;
        preferred_username?: string;
      })
    : {};
  await query(
    `insert into design_calendar (business_id, email, provider, address, token, access, expires_at)
     values ($1,$2,$3,$4,$5,$6, now() + make_interval(secs => $7))
     on conflict (business_id, email) do update set provider = excluded.provider, address = excluded.address, token = excluded.token,
       access = excluded.access, expires_at = excluded.expires_at`,
    [
      member.businessId,
      member.email.toLowerCase(),
      config.provider,
      (claims.email ?? claims.preferred_username ?? member.email).toLowerCase(),
      seal(t.refresh_token),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
    ],
  );
  return true;
}

/** Which calendar a member has connected, and as whom, or null. */
export async function connectedCalendar(member: Who): Promise<{ provider: CalendarProvider; address: string } | null> {
  const rows = await query<{ provider: CalendarProvider; address: string }>(
    `select provider, address from design_calendar where business_id = $1 and email = $2`,
    [member.businessId, member.email.toLowerCase()],
  );
  return rows[0] ?? null;
}

/** Disconnects: Google is told to forget the token (Microsoft has no such call), and it goes from here. */
export async function disconnectCalendar(member: Who): Promise<void> {
  const rows = await query<{ token: string; provider: CalendarProvider }>(
    `delete from design_calendar where business_id = $1 and email = $2 returning token, provider`,
    [member.businessId, member.email.toLowerCase()],
  );
  const token = rows[0]?.provider === "google" ? open(rows[0].token) : null;
  if (token)
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
}

async function accessToken(member: Who): Promise<{ token: string; provider: CalendarProvider } | null> {
  const rows = await query<{ token: string; access: string | null; fresh: boolean; provider: CalendarProvider }>(
    `select token, access, provider, (expires_at > now()) as fresh from design_calendar where business_id = $1 and email = $2`,
    [member.businessId, member.email.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.fresh && row.access) {
    const access = open(row.access);
    if (access) return { token: access, provider: row.provider };
  }
  const config = calendarConfig(row.provider, "http://localhost");
  const refresh = open(row.token);
  if (!config || !refresh) return null;
  const res = await tokenRequest(row.provider, {
    refresh_token: refresh,
    client_id: config.clientId,
    client_secret: config.secret,
    grant_type: "refresh_token",
    ...(row.provider === "outlook" ? { scope: SCOPES.outlook } : {}),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!t.access_token) return null;
  // Microsoft hands out a new refresh token each time: keep it, so the next refresh still works.
  await query(
    `update design_calendar set access = $3, expires_at = now() + make_interval(secs => $4), token = coalesce($5, token)
     where business_id = $1 and email = $2`,
    [
      member.businessId,
      member.email.toLowerCase(),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
      t.refresh_token ? seal(t.refresh_token) : null,
    ],
  );
  return { token: t.access_token, provider: row.provider };
}

export class CalendarOff extends Error {}

/** The member's events between two instants, from their main calendar, repeating events laid out one by one. */
export async function calendarEvents(member: Who, timeMin: string, timeMax: string): Promise<MyEvent[]> {
  const got = await accessToken(member);
  if (!got) throw new CalendarOff("Your calendar isn't connected.");
  const google = got.provider === "google";
  const url = google
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(MAX_EVENTS),
      })}`
    : `https://graph.microsoft.com/v1.0/me/calendarView?${new URLSearchParams({
        startDateTime: timeMin,
        endDateTime: timeMax,
        $top: String(MAX_EVENTS),
        $orderby: "start/dateTime",
        $select: "id,subject,isCancelled,isAllDay,start,end,location,webLink,onlineMeeting",
      })}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${got.token}`, ...(google ? {} : { prefer: `outlook.timezone="${OUTLOOK_TIME_ZONE}"` }) },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new CalendarOff("Your calendar turned the request down: connect it again.");
  if (!res.ok) throw new Error(`Calendar ${res.status}`);
  if (google) return cleanEvents(((await res.json()) as { items?: GoogleEvent[] }).items ?? []);
  return cleanOutlookEvents(((await res.json()) as { value?: OutlookEvent[] }).value ?? []);
}

/** A meeting Sol booked: its Meet link (null when none was asked for or Google gave none) and the event's own page. */
export interface BookedMeeting {
  meet: string | null;
  link: string | null;
}

/**
 * Puts an event on the member's own main Google Calendar (sol-meeting.ts): no guests, so Google emails nobody, and a
 * Google Meet link when asked. Outlook isn't booked into yet. A calendar connected with reading only answers CalendarOff.
 */
export async function bookMeeting(member: Who, ask: MeetingAsk, description: string): Promise<BookedMeeting> {
  const got = await accessToken(member);
  if (!got) throw new CalendarOff("Their calendar isn't connected: they connect Google Calendar from the date tile at the top.");
  if (got.provider !== "google") throw new CalendarOff("Their calendar is Outlook, and Sol can only book into Google Calendar so far.");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({ conferenceDataVersion: "1", sendUpdates: "none" })}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${got.token}`, "content-type": "application/json" },
      body: JSON.stringify(googleEventBody(ask, description, crypto.randomUUID())),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (res.status === 401 || res.status === 403)
    throw new CalendarOff(
      "Their Google Calendar was connected for reading only: they connect it again (the date tile at the top, Disconnect, then Google Calendar) to let Sol book meetings.",
    );
  if (!res.ok) throw new Error(`Calendar ${res.status}`);
  const e = (await res.json()) as Parameters<typeof meetLinkOf>[0] & { htmlLink?: unknown };
  const link = typeof e.htmlLink === "string" && e.htmlLink.startsWith("https://www.google.com/calendar/") ? e.htmlLink : null;
  return { meet: meetLinkOf(e), link };
}
