/**
 * The HubSpot private app token as pasted into Vercel: HUBSPOT_PRIVATE_APP_TOKEN,
 * or the shorter HUBSPOT_TOKEN. Forgives the usual paste slips (spaces, quote
 * marks, a leading "Bearer "). Pure and tested.
 */
export function cleanHubspotToken(raw: string | undefined): string | null {
  const token = (raw ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/^bearer\s+/i, "")
    .trim();
  return token || null;
}

/** Private app tokens start with "pat-" (e.g. "pat-ap1-…"); anything else is usually the wrong value pasted. */
export const looksLikeHubspotToken = (token: string | null) => Boolean(token && /^pat-[a-z0-9]+-[\w-]{10,}$/i.test(token));

export function hubspotTokenFrom(env: Record<string, string | undefined>): string | null {
  return cleanHubspotToken(env.HUBSPOT_PRIVATE_APP_TOKEN) ?? cleanHubspotToken(env.HUBSPOT_TOKEN);
}
