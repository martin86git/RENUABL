/**
 * Server only. "Continue with Google" for the roof designer: Google's own
 * OAuth sign-in (the authorisation code flow, openid email). Google proves
 * the email; we start the same session an emailed link would. Needs
 * GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (a Google Cloud
 * OAuth client of the web kind, with <site>/api/auth/google/callback as an
 * authorised redirect); without them the button says it isn't set up.
 */
import { siteUrl } from "@/lib/domain/sms";

export const GOOGLE_STATE_COOKIE = "renuabl_google_state";

export function googleConfig(origin: string): { clientId: string; secret: string; redirect: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/google/callback` };
}

export function googleAuthUrl(config: { clientId: string; redirect: string }, state: string): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Swaps the code for the person's email, as Google vouches for it. Null when Google says no, or the email isn't verified. */
export async function googleEmail(config: { clientId: string; secret: string; redirect: string }, code: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.redirect,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) return null;
  // The token came straight from Google over TLS in answer to our own secret, so its claims are read, not re-verified.
  const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    aud?: string;
    iss?: string;
    email?: string;
    email_verified?: boolean;
    exp?: number;
  };
  const issuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const fresh = typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
  if (claims.aud !== config.clientId || !issuer || !fresh || claims.email_verified !== true || !claims.email) return null;
  return claims.email.toLowerCase();
}
