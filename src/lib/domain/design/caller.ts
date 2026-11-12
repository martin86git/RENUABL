/**
 * The business's phone assistant as its customers meet it (12 Nov 2026, Martin: RENUABL Business is something solar
 * retailers sign up to, so the call function is personified by each of them: a name and a profile picture). Sol is
 * RENUABL's own AI and the name every business starts with; the name is what the assistant says on the phone ("It's
 * Ella, Sunrise Solar's automated assistant") and what its calls are written under on a deal. Pure, tested.
 */
import { speakableName } from "../voice-agent";

/** The name a business's phone assistant has until the business gives it one. */
export const DEFAULT_CALLER = "Sol";
export const CALLER_NAME_MIN = 2;
export const CALLER_NAME_MAX = 20;

/** Settings → Phone assistant, as the business reads it. */
export const CALLER_COPY = {
  title: "Phone assistant",
  intro:
    "The assistant that rings your new leads and the customers who ask for a call, and answers people who ring your number back. Give it a name and a face: it introduces itself by the name on every call, and its calls are written on your deals under it.",
  automated: "It always says it's an automated assistant and that the call is recorded. A name never changes that.",
  photo: "A square photo or drawing works best. It's shown beside its calls on your deals and in Today's Calls tab.",
} as const;

/** The name as it will be kept and said, or what is wrong with it. */
export function cleanCallerName(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const typed = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  const name = speakableName(typed).replace(/\s+/g, " ").slice(0, CALLER_NAME_MAX).trim();
  if (name.length < CALLER_NAME_MIN) return { ok: false, message: "Give it a name of at least two letters." };
  if (name !== typed.slice(0, CALLER_NAME_MAX).trim())
    return { ok: false, message: "Use letters only (spaces, apostrophes and hyphens are fine): it's said out loud on calls." };
  return { ok: true, value: name };
}

/** The opening words with this name, for the business to hear in its head before saving. */
export function callerIntro(name: string, business: string): string {
  return `"Hi, is that Sam? It's ${speakableName(name) || DEFAULT_CALLER}, ${business.trim() || "your business"}'s automated assistant, calling about the solar enquiry you made on our website. This call is recorded."`;
}

/** The initial shown when there is no photo. */
export const callerInitial = (name: string) => (speakableName(name).charAt(0) || "S").toUpperCase();
