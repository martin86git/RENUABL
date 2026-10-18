/**
 * Passwords for the roof designer's accounts: what one must be, in one place
 * so the form and the server agree. A password is only ever set by someone
 * already signed in (by an emailed link or Google), so an email is proven
 * theirs before a password can open it. Pure, tested.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

/** Why a password can't be used, or null when it can. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "Enter a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!password.trim()) return "A password can't be only spaces.";
  return null;
}

export const WRONG_PASSWORD = "That email and password don't match.";
export const LINK_SENT = (email: string) => `We've sent a sign-in link to ${email}.`;
