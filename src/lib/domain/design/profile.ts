import { normaliseMobile } from "../contact";
import { passwordProblem } from "./password";

/**
 * About you (5 Nov 2026, Martin: the first sign-in greeted him as "Martin" from his email without asking): each person
 * in a business gives their own first and last name once, with a mobile if they like, and may set a password so they
 * can sign in with it next time. Until a first name is given, nobody is greeted by name.
 */
export interface Profile {
  firstName: string;
  lastName: string;
  /** Australian mobile as normalised by `normaliseMobile`, or empty. */
  mobile: string;
}

export const NAME_MAX = 40;

export const PROFILE_WORDS = {
  title: "About you.",
  intro: "So your team, and Sol, know who you are. Your customers only ever see your business's name.",
  passwordLabel: "Password (optional)",
  passwordNote: "Set one to sign in with your email and password next time. Or leave it blank and keep using a link or Google.",
  missingName: "Please enter your first and last name.",
  missingCompany: "Please enter your company's name.",
  newIntro: "A few details about you and your company. Your customers only ever see your company's name.",
  joinIntro: "You've been added to this business. Its roofs, deals and settings are shared with everyone in it.",
  badMobile: "That doesn't look like an Australian mobile number.",
} as const;

const cleanName = (raw: unknown): string =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, NAME_MAX)
    : "";

/**
 * What the browser sent, checked: both names needed, the mobile optional but a real one when given, the password
 * optional but long enough when given. Answers the cleaned profile and the password to set, or what is wrong.
 */
export function cleanProfile(
  body: Record<string, unknown>,
): { ok: true; profile: Profile; password: string | null } | { ok: false; message: string } {
  const firstName = cleanName(body.firstName);
  const lastName = cleanName(body.lastName);
  if (!firstName || !lastName) return { ok: false, message: PROFILE_WORDS.missingName };
  const rawMobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
  const mobile = rawMobile ? normaliseMobile(rawMobile) : "";
  if (mobile === null) return { ok: false, message: PROFILE_WORDS.badMobile };
  const rawPassword = typeof body.password === "string" ? body.password : "";
  if (rawPassword) {
    const problem = passwordProblem(rawPassword);
    if (problem) return { ok: false, message: problem };
  }
  return { ok: true, profile: { firstName, lastName, mobile }, password: rawPassword || null };
}
