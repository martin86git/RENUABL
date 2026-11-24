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
      /** The business has Marketing (domain/marketing/access.ts: RENUABL's own for now). */
      marketing?: boolean;
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
      /** This person has seen the tour of a deal (deal-tour.ts), on any device. */
      dealTourSeen?: boolean;
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

/**
 * Waits between asking again when the server doesn't answer on a device someone has signed in on (23 Nov 2026,
 * Martin: back to a Safari tab after the phone was locked half an hour, it showed the signed-out page). After a while
 * away the phone's network and the database both take a moment to wake, so this waits about 40 seconds in all.
 */
const RETRY_MS = [800, 1_500, 2_500, 4_000, 6_000, 8_000, 10_000, 10_000];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves once the page is in view and the device says it is online (a hidden tab or no network: no point asking). */
function readyToAsk(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const ready = () => document.visibilityState !== "hidden" && navigator.onLine !== false;
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (!ready()) return;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      resolve();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
  });
}

async function ask(): Promise<DesignAccount> {
  for (let attempt = 0; ; attempt++) {
    try {
      await readyToAsk();
      const res = await fetch("/api/design/me", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const account = (await res.json()) as DesignAccount;
      hint(account.signedIn);
      return account;
    } catch {
      // The server didn't answer (a database waking up, the phone's network coming back). On a device someone has
      // signed in on, ask again for a while before saying so, rather than showing the sign-in page to someone who is
      // signed in. The device's hint is never cleared by a failure: only a real "signed out" answer or signing out.
      if (hint() && attempt < RETRY_MS.length) {
        await wait(RETRY_MS[attempt]);
        continue;
      }
      if (hint()) keepTrying();
      return { signedIn: false, unreachable: hint() };
    }
  }
}

let trying = false;

/**
 * Still couldn't reach the account: keep asking quietly whenever the page comes back into view, the device comes back
 * online, and every 15 seconds, and tell every screen (ACCOUNT_EVENT) the moment it answers. So a phone left on the
 * "couldn't reach your account" screen goes back in by itself.
 */
function keepTrying() {
  if (trying || typeof window === "undefined") return;
  trying = true;
  const again = async () => {
    if (document.visibilityState === "hidden" || navigator.onLine === false) return;
    try {
      const res = await fetch("/api/design/me", { cache: "no-store" });
      if (!res.ok) return;
      const account = (await res.json()) as DesignAccount;
      stop();
      hint(account.signedIn);
      asked = Promise.resolve(account);
      window.dispatchEvent(new CustomEvent<DesignAccount>(ACCOUNT_EVENT, { detail: account }));
    } catch {
      // Not yet: the next look.
    }
  };
  const timer = window.setInterval(again, 15_000);
  const stop = () => {
    trying = false;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", again);
    window.removeEventListener("online", again);
  };
  document.addEventListener("visibilitychange", again);
  window.addEventListener("online", again);
}

let asked: Promise<DesignAccount> | null = null;

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

/** The tour of a deal has been seen: it doesn't start by itself again, on any device. */
export async function finishDealTour(): Promise<void> {
  await send<Answer>("/api/design/onboarding", "POST", { tour: "deal" });
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
  /** When their profile photo was last changed, when they have one. */
  photo?: number;
}

/** Someone kept to own deals without being invited: never a member, never signs in, never a paid user. */
export interface OwnerOnlyLine {
  email: string;
  name: string;
  deals: number;
}

type MembersAnswer = Answer & { members?: MemberLine[]; ownerOnly?: OwnerOnlyLine[] };

export async function loadMembers(): Promise<MemberLine[] | null> {
  return (await send<MembersAnswer>("/api/design/members", "GET")).members ?? null;
}

export interface Team {
  members: MemberLine[];
  ownerOnly: OwnerOnlyLine[];
}

/** The business's people and those who own deals without an invite. */
export async function loadTeam(): Promise<Team | null> {
  const res = await send<MembersAnswer>("/api/design/members", "GET");
  return res.members ? { members: res.members, ownerOnly: res.ownerOnly ?? [] } : null;
}

const teamOf = (res: MembersAnswer): { team?: Team; problem?: string } =>
  res.ok && res.members ? { team: { members: res.members, ownerOnly: res.ownerOnly ?? [] } } : { problem: res.message ?? UNREACHABLE };

/** Keeps someone who can own deals without inviting them (24 Nov 2026, Martin: for historical deals). */
export async function addOwnerOnly(email: string, name: string) {
  return teamOf(await send<MembersAnswer>("/api/design/members", "POST", { email, name, ownerOnly: true }));
}

/** Invites someone kept to own deals: they become a member and a paid user, keeping their deals. */
export async function inviteOwnerOnly(email: string) {
  return teamOf(await send<MembersAnswer>("/api/design/members", "POST", { email, invite: true }));
}

/** Takes someone off the list of people who own deals; their deals are left with no owner. */
export async function removeOwnerOnly(email: string) {
  return teamOf(await send<MembersAnswer>("/api/design/members", "DELETE", { email, ownerOnly: true }));
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
export async function choosePlan(email: string, seats: number, code?: string): Promise<string | null> {
  const res = await send<Answer & { url?: string }>("/api/design/subscribe", "POST", { email, seats, ...(code ? { code } : {}) });
  if (!res.ok || !res.url) return res.message ?? UNREACHABLE;
  window.location.assign(res.url);
  return null;
}

/** A team member's profile photo, by its version so a new one is fetched and an unchanged one stays cached. */
export const memberPhotoUrl = (email: string, version: number) =>
  `/api/design/profile/photo?email=${encodeURIComponent(email)}&v=${version}`;

/** Puts the signed-in person's own profile photo in place; answers its new version, or what went wrong. */
export async function uploadMyPhoto(file: File): Promise<{ photo?: number; problem?: string }> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/design/profile/photo", { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; photo?: number; message?: string };
    return body.ok && body.photo ? { photo: body.photo } : { problem: body.message ?? UNREACHABLE };
  } catch {
    return { problem: UNREACHABLE };
  }
}

/** Takes the signed-in person's own profile photo away. */
export async function removeMyPhoto(): Promise<{ problem?: string }> {
  const res = await send<Answer>("/api/design/profile/photo", "DELETE");
  return res.ok ? {} : { problem: res.message ?? UNREACHABLE };
}

/** The business's own sign-in address (sign-in-page.ts), made the first time it is asked for. */
export async function loadSignInPage(): Promise<string | null> {
  return (await send<{ ok: boolean; path?: string }>("/api/design/sign-in-page", "GET")).path ?? null;
}

/** The owner's new sign-in address; the old one stops working. */
export async function renewSignInPage(): Promise<{ path?: string; problem?: string }> {
  const res = await send<{ ok: boolean; path?: string; message?: string }>("/api/design/sign-in-page", "POST");
  return res.ok && res.path ? { path: res.path } : { problem: res.message ?? UNREACHABLE };
}
