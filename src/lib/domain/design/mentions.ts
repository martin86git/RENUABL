/**
 * @mentions in a deal's notes (22 Oct 2026, Martin: as Primero's): "@sam"
 * reaches the member whose email starts sam@ (or sam. / sam_ when no one
 * else's does), who finds it in their Notifications and, when email is set
 * up, gets an email from RENUABL with the note and a link to the deal. The
 * writer never notifies themselves. Pure, tested.
 */

/** "sam.jones@sunny.example" → "sam.jones": what is typed after the @ to reach them. */
export const handleOf = (email: string) => email.split("@")[0]?.toLowerCase() ?? "";

/** "sam.jones@…" → "sam": the short form, which reaches them when no one else shares it. */
const shortOf = (email: string) => handleOf(email).split(/[._+-]/)[0] ?? "";

/**
 * The members a note mentions, each once, never the writer. A handle matches a member's whole handle, or, when only one
 * member has it, the first part of it ("@sam" for sam.jones@ while there is no other sam).
 */
export function mentionsIn(text: string, members: readonly string[], writer: string): string[] {
  const found = new Set<string>();
  const me = writer.toLowerCase();
  for (const m of text.matchAll(/(^|[^a-z0-9._%+-])@([a-z0-9][a-z0-9._+-]*)/gi)) {
    const said = m[2].toLowerCase().replace(/[._+-]+$/, "");
    const whole = members.find((e) => handleOf(e) === said);
    const short = members.filter((e) => shortOf(e) === said);
    const who = whole ?? (short.length === 1 ? short[0] : undefined);
    if (who && who.toLowerCase() !== me) found.add(who.toLowerCase());
  }
  return [...found];
}

/** The handle as the note box puts it in: "@sam.jones ". */
export const mentionText = (email: string) => `@${handleOf(email)} `;

/** The email a mentioned member is sent, from RENUABL: who, which deal, the note, and the way to it. */
export function mentionEmail(input: { by: string; customer: string; text: string; link: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const by = handleOf(input.by);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const subject = `${by} mentioned you on ${input.customer}'s deal`;
  const text = `${by} mentioned you in a note on ${input.customer}'s deal:\n\n${input.text}\n\nOpen the deal: ${input.link}`;
  const html = `<div style="font:14px/1.6 Arial,sans-serif;color:#111"><p>${esc(by)} mentioned you in a note on ${esc(input.customer)}'s deal:</p>
<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #ddd;color:#333">${esc(input.text).replace(/\n/g, "<br>")}</blockquote>
<p><a href="${esc(input.link)}" style="display:inline-block;padding:10px 16px;background:#3a3d43;color:#fff;border-radius:6px;text-decoration:none">Open the deal</a></p></div>`;
  return { subject, text, html };
}
