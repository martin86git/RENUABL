/**
 * The roof designer's account, as the browser sees it: who is signed in and
 * to which business, the sign-in link, naming a business and accepting the
 * terms, and the people in it. All of it is asked of the server
 * (/api/design/…): the browser never decides which business it is.
 */
import type { MemberPermissions, MemberRole } from "@/lib/domain/design/account";

export interface DesignBusiness {
  id: string;
  name: string;
  role: MemberRole;
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
  if (fresh || !asked) asked = ask();
  return asked;
}

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
export async function setUpBusiness(o: { name?: string; terms: boolean }): Promise<string | null> {
  const res = await send<Answer>("/api/design/business", "POST", o);
  if (!res.ok) return res.message ?? UNREACHABLE;
  await designAccount(true);
  return null;
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

export async function removeMember(email: string): Promise<{ members?: MemberLine[]; problem?: string }> {
  const res = await send<MembersAnswer>("/api/design/members", "DELETE", { email });
  return res.ok ? { members: res.members } : { problem: res.message ?? "They couldn't be removed. Try again in a moment." };
}
