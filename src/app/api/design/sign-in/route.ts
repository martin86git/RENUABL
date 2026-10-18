import { cookies } from "next/headers";
import { normaliseEmail, safeNext, SESSION_COOKIE } from "@/lib/domain/accounts";
import { WRONG_PASSWORD } from "@/lib/domain/design/password";
import { openSession, SESSION_COOKIE_OPTIONS } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { checkPassword } from "@/lib/server/design-passwords";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { email, password, next? }: the roof designer's sign-in by password.
 * Signed in: { ok, next }. A wrong password: 401. An email with no password
 * (it signs in by link or Google): { ok: false, noPassword: true }, and the
 * page emails a link instead. Limited per visitor, so passwords can't be guessed at speed.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false, message: "Sign-in isn't available just now." }, { status: 503 });
  if (!allow(request, "design-password", 20))
    return Response.json({ ok: false, message: "Too many tries. Wait a few minutes, or sign in with an emailed link." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown; next?: unknown } | null;
  const email = normaliseEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password.slice(0, 400) : "";
  if (!email || !password) return Response.json({ ok: false, message: "Enter your email and password." }, { status: 422 });
  const result = await checkPassword(email, password);
  if (result === "none") return Response.json({ ok: false, noPassword: true });
  if (result === "wrong") return Response.json({ ok: false, message: WRONG_PASSWORD }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, await openSession(email, "business"), SESSION_COOKIE_OPTIONS);
  return Response.json({ ok: true, next: safeNext(body?.next, "business") || "/design" });
}
