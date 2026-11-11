/**
 * The roof designer's account, as the browser sees it: who is signed in and
 * to which business, the sign-in link, naming a business and accepting the
 * terms, and the people in it. All of it is asked of the server
 * (/api/design/…): the browser never decides which business it is.
 */
import type { MemberPermissions, MemberRole } from "@/lib/domain/design/account";
import type { BusinessKind } from "@/lib/domain/design/business-kind";

export interface DesignBusiness {
  id: string;
  name: string;
  role: MemberRole;
  /** Retailer, installer or inspector (business-kind.ts); older answers have none: a retailer. */
  kind?: BusinessKind;
}

export type DesignAccount =
  /** Nobody is signed in: the designer keeps its work on this device. */
  | { signedIn: false; unreachable?: boolean }
  /** Signed in. "no-business": they still have to name their business; "needs-terms": to accept the terms. */
  | {
      signedIn: true;
      state: "no-business" | "needs-terms" | "ready";
      email: string;
      business: DesignBusiness | null;
      /** What this person may do, as the server enforces it. The screens use it only to show or hide. */
      may?: { costs: boolean; prices: boolean; publish: boolean; members: boolean } | null;
      /** The owner viewing the product as this member (read only): the owner's email. */
      viewedBy?: string;
      /** A new retailer's owner who hasn't chosen a plan and paid yet (business-kind.ts `needsPlan`). */
      needsPlan?: boolean;
      /** A demo account (demo.ts): made-up deals, nothing sent to anyone. */
      demo?: boolean;
      /** In a demo, who is trying it hasn't been said yet: asked before a roof is designed, Sol is asked or a proposal published. */
      demoNeedsDetails?: boolean;
      /** Their own first name, once given (About you); nobody is greeted by name before. */
      firstName?: string;
      /** About you is still to be given (profile.ts). */
      needsProfile?: boolean;
      /** The welcome on Today is still to be shown (welcome.ts). */
      welcome?: boolean;
      /** RENUABL staff (Settings → View as), and the sample business kind they are looking through. */
      staff?: boolean;
      staffViewing?: "retailer" | "installer" | "inspector";
    };

/**
 * Remembered on the device once someone has signed in on it, and forgotten
 * when they sign out. It holds nothing about them: it only stops the designer
 * falling back to keeping work on the device when the server can't be reached
 * for a moment, which would hide a signed-in person's saved roofs from them.
 */
const SIGNED_IN_HINT = "renuabl.design.signed-in";

function hint(set?: boolean): boolean {
  try {
    if (set === true) window.localStorage.setItem(SIGNED_IN_HINT, "1");
    if (set === false) window.localStorage.removeItem(SIGNED_IN_HINT);
    return window.localStorage.getItem(SIGNED_IN_HINT) === "1";
  } catch {
    return false;
  }
}

let asked: Promise<DesignAccount> | null = null;

async function ask(): Promise<DesignAccount> {
  try {
    const res = await fetch("/api/design/me", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const account = (await res.json()) as DesignAccount;
    hint(account.signedIn);
    return account;
  } catch {
    // The server didn't answer. Say so only for a device someone has signed in on.
    return { signedIn: false, unreachable: hint() };
  }
}

/** Who is using the designer. Asked once for the page; `fresh` asks again (after signing in, naming a business, signing out). */
export function designAccount(fresh = false): Promise<DesignAccount> {
  if (fresh || !asked) {
    asked = ask();
    // Asked again: every screen holding the account hears it (useDesignAccount), so a name just given shows at once.
    if (fresh && typeof window !== "undefined")
      void asked.then((a) => window.dispatchEvent(new CustomEvent<DesignAccount>(ACCOUNT_EVENT, { detail: a })));
  }
  return asked;
}

/** Sent on the window with the account each time it is asked again. */
export const ACCOUNT_EVENT = "renuabl:account";

/** For the sign-out button: the device stops expecting an account. */
export function forgetDesignAccount() {
  hint(false);
  asked = null;
}

interface Answer {
  ok: boolean;
  message?: string;
}

const UNREACHABLE = "We couldn't reach the server. Try again in a moment.";

async function send<T extends Answer>(url: string, method: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    return (await res.json()) as T;
  } catch {
    return { ok: false, message: UNREACHABLE } as T;
  }
}

/** Asks for a sign-in link. The answer is the same whether or not the email has been used before. */
export async function requestSignInLink(email: string, next?: string): Promise<Answer> {
  return send("/api/auth/link", "POST", { email, as: "business", next });
}

/** Names a new business and accepts the terms (or only accepts them, for someone added by the owner). Null when done. */
export async function setUpBusiness(o: { name?: string; kind?: BusinessKind; terms: boolean }): Promise<string | null> {
  const res = await send<Answer>("/api/design/business", "POST", o);
  if (!res.ok) return res.message ?? UNREACHABLE;
  await designAccount(true);
  return null;
}

/** About you: their own name, a mobile if they like, and a password if they want one. Null when done. */
export async function saveProfile(o: { firstName: string; lastName: string; mobile: string; password: string }): Promise<string | null> {
  const res = await send<Answer>("/api/design/profile", "POST", o);
  if (!res.ok) return res.message ?? UNREACHABLE;
  await designAccount(true);
  return null;
}

/** The welcome on Today is done (finished or skipped): it isn't shown again. */
export async function finishWelcome(): Promise<void> {
  await send<Answer>("/api/design/onboarding", "POST", {});
}

/** The owner renames the business. Null when done. */
export async function renameBusiness(name: string): Promise<string | null> {
  const res = await send<Answer>("/api/design/business", "PUT", { name });
  if (!res.ok) return res.message ?? UNREACHABLE;
  await designAccount(true);
  return null;
}

export interface MemberLine {
  email: string;
  role: MemberRole;
  /** Whether they have signed in and accepted the terms yet. */
  joined: boolean;
  permissions: MemberPermissions;
}

type MembersAnswer = Answer & { members?: MemberLine[] };

export async function loadMembers(): Promise<MemberLine[] | null> {
  return (await send<MembersAnswer>("/api/design/members", "GET")).members ?? null;
}

export async function addMember(email: string): Promise<{ members?: MemberLine[]; problem?: string }> {
  const res = await send<MembersAnswer>("/api/design/members", "POST", { email });
  return res.ok ? { members: res.members } : { problem: res.message ?? UNREACHABLE };
}

/** The owner sets what a member may do. It takes effect with that person's next request. */
export async function setMemberPermissions(
  email: string,
  permissions: MemberPermissions,
): Promise<{ members?: MemberLine[]; problem?: string }> {
  const res = await send<MembersAnswer>("/api/design/members", "PUT", { email, permissions });
  return res.ok ? { members: res.members } : { problem: res.message ?? UNREACHABLE };
}

export async function setMemberRole(email: string, role: "member" | "designer"): Promise<{ members?: MemberLine[]; problem?: string }> {
  const res = await send<MembersAnswer>("/api/design/members", "PUT", { email, role });
  return res.ok ? { members: res.members } : { problem: res.message ?? UNREACHABLE };
}

export async function removeMember(email: string): Promise<{ members?: MemberLine[]; problem?: string }> {
  const res = await send<MembersAnswer>("/api/design/members", "DELETE", { email });
  return res.ok ? { members: res.members } : { problem: res.message ?? "They couldn't be removed. Try again in a moment." };
}

/** Signs in with a password. `noPassword` when the email has none (it signs in by link or Google instead). */
export async function signInWithPassword(email: string, password: string, next?: string) {
  return send<Answer & { next?: string; noPassword?: boolean }>("/api/design/sign-in", "POST", { email, password, next });
}

/** Whether the signed-in person has a password yet. */
export async function passwordState(): Promise<boolean | null> {
  const res = await send<Answer & { hasPassword?: boolean }>("/api/design/password", "GET");
  return res.ok ? Boolean(res.hasPassword) : null;
}

/** Sets or changes the signed-in person's password. Null when done, else why not. */
export async function savePassword(password: string): Promise<string | null> {
  const res = await send<Answer>("/api/design/password", "PUT", { password });
  return res.ok ? null : (res.message ?? UNREACHABLE);
}

/** Where "Continue with Google" goes. */
export const GOOGLE_SIGN_IN = "/api/auth/google";

/** View as (wave 7): the owner opens the product as another member sees it, read only; and goes back. */
export async function viewAs(email: string): Promise<string | null> {
  const res = await send<Answer>("/api/design/view-as", "POST", { email });
  return res.ok ? null : (res.message ?? UNREACHABLE);
}
export async function stopViewing(): Promise<void> {
  await fetch("/api/design/view-as", { method: "DELETE" }).catch(() => undefined);
}

/** Off to Stripe's secure page to pay for the plan; answers a problem in words, or goes. */
export async function choosePlan(email: string, seats: number): Promise<string | null> {
  const res = await send<Answer & { url?: string }>("/api/design/subscribe", "POST", { email, seats });
  if (!res.ok || !res.url) return res.message ?? UNREACHABLE;
  window.location.assign(res.url);
  return null;
}
