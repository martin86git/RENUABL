"use client";

import { SignInForm, signInNote } from "./sign-in-form";
import { PASSWORD_MIN } from "@/lib/domain/design/password";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Wordmark } from "@/components/ui/primitives";
import { BUSINESS_TERMS_MISSING, BUSINESS_TERMS_PATH, PERMISSIONS, ROLES, can, type MemberPermissions } from "@/lib/domain/design/account";
import {
  addMember,
  designAccount,
  forgetDesignAccount,
  loadMembers,
  passwordState,
  savePassword,
  removeMember,
  setMemberPermissions,
  setMemberRole,
  viewAs,
  renameBusiness,
  setUpBusiness,
  type DesignAccount,
  type MemberLine,
} from "@/lib/services/design-account";
import { importDeviceWork, listSavedRoofs, rememberRoof, type DesignRoof } from "@/lib/services/design-store";

const SIGN_IN = "/design/sign-in";
const ACCOUNT = "/design/account";
const input =
  "block min-h-11 w-full rounded-md border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-forest disabled:bg-surface-2 disabled:text-muted";
const primary =
  "inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted";
const textLink = "tap-area shrink-0 text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink";
const card = "rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6";
const eyebrow = "text-[12px] font-medium uppercase tracking-[0.16em] text-forest";

/** Who is using the designer, once the server has said. Null while it is being asked. */
export function useDesignAccount(): [DesignAccount | null, () => void] {
  const [account, setAccount] = useState<DesignAccount | null>(null);
  const [asks, setAsks] = useState(0);
  useEffect(() => {
    let gone = false;
    void designAccount(asks > 0).then((a) => !gone && setAccount(a));
    return () => {
      gone = true;
    };
  }, [asks]);
  return [account, () => setAsks((n) => n + 1)];
}

/** The page frame the account screens share: the wordmark, and one centred column. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-studio flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 lg:px-10">
        <Link href="/design" aria-label="Roof designer">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-20 pt-8 lg:pt-16">{children}</main>
    </div>
  );
}

/** Ends the session on the server and comes back to the designer, signed out. The device forgets it had an account. */
export function SignOut({ className }: { className?: string }) {
  return (
    <form
      action="/api/auth/signout?to=design"
      method="post"
      onSubmit={() => {
        forgetDesignAccount();
        // The roof last opened belongs to the business: it isn't left behind for whoever uses this device next.
        rememberRoof(null);
      }}
    >
      <button type="submit" className={className ?? textLink}>
        Sign out
      </button>
    </form>
  );
}

/**
 * The step between signing in and using an account: someone new names their
 * business; everyone accepts the terms with a box that is never ticked for
 * them. Until this is done nothing of theirs is kept on the server.
 */
function SetUp({ account, onDone }: { account: Extract<DesignAccount, { signedIn: true }>; onDone: () => void }) {
  const naming = account.state === "no-business";
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) return setProblem(BUSINESS_TERMS_MISSING);
    setBusy(true);
    const failed = await setUpBusiness({ ...(naming ? { name } : {}), terms });
    setBusy(false);
    if (failed) return setProblem(failed);
    onDone();
  };
  return (
    <Frame>
      <p className={eyebrow}>Roof designer</p>
      <h1 className="mt-3 text-[30px] leading-tight tracking-tight text-ink">
        {naming ? "Set up your business." : `Join ${account.business?.name ?? "your business"}.`}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        {naming
          ? "Your roofs, price lists and settings will be kept for your business, on any device you sign in on. You can add the people you work with afterwards."
          : "You've been added to this business. Its roofs, price lists and settings are shared with everyone in it."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {naming && (
          <label className="block text-sm font-medium text-ink">
            Business name
            <input
              className={`${input} mt-1.5`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="organization"
              placeholder="e.g. Example Solar"
            />
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-surface-2 px-3.5 py-3 text-[13px] leading-snug text-ink-2">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              setProblem(null);
            }}
            className="mt-px h-4 w-4 shrink-0 accent-[var(--primary)]"
          />
          <span>
            I&apos;ve read and accept the{" "}
            <Link href={BUSINESS_TERMS_PATH} target="_blank" className="underline underline-offset-4 hover:text-ink">
              roof designer&apos;s terms
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-ink">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {problem && (
          <p className="text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className={primary} disabled={busy}>
          {busy ? "Saving…" : naming ? "Start using the designer" : "Join"}
        </button>
      </form>
      <div className="mt-8 flex items-center gap-3 text-[13px] text-muted">
        <span>Signed in as {account.email}.</span>
        <SignOut />
      </div>
    </Frame>
  );
}

/**
 * Wraps the designer's pages. Signed out, they work as they always have, on
 * this device. Signed in, it makes sure the person has a business and has
 * accepted the terms before anything is kept, and the first time on a device
 * brings that device's work into the account before the page loads its data.
 */
export function DesignAccountGate({ children }: { children: React.ReactNode }) {
  const [account, refresh] = useDesignAccount();
  // What came across from this device, and for which business: the page waits for it, so it loads the account's data once.
  const [brought, setBrought] = useState<{ id: string; roofs: number; settings: boolean } | null>(null);
  const business = account?.signedIn && account.state === "ready" ? account.business : null;
  const businessId = business?.id;
  useEffect(() => {
    if (!businessId) return;
    let gone = false;
    void importDeviceWork(businessId).then((done) => !gone && setBrought({ id: businessId, ...done }));
    return () => {
      gone = true;
    };
  }, [businessId]);

  if (!account || (businessId && brought?.id !== businessId)) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  if (account.signedIn && account.state !== "ready") return <SetUp account={account} onDone={refresh} />;
  const came = [
    brought && brought.roofs > 0 ? `${brought.roofs} roof${brought.roofs === 1 ? "" : "s"}` : "",
    brought?.settings ? "your prices and settings" : "",
  ].filter(Boolean);
  return (
    <>
      {came.length > 0 && (
        // In a box of its own with the designer's theme: it sits above the page, outside the page's own themed box.
        <div className="theme-studio">
          <p className="bg-surface-2 px-5 py-2.5 text-center text-[13px] text-ink-2" role="status">
            Brought across from this device: {came.join(" and ")}. Now kept in your account.
          </p>
        </div>
      )}
      {children}
    </>
  );
}

/** In the designer's bar: the way to sign in, or the business that is signed in (which opens its account page). */
export function DesignAccountLink() {
  const [account] = useDesignAccount();
  if (!account) return null;
  if (account.signedIn)
    return (
      <Link href={ACCOUNT} className={textLink}>
        {account.business?.name ?? "Your account"}
      </Link>
    );
  return (
    <Link href={SIGN_IN} className={textLink}>
      Sign in to keep this
    </Link>
  );
}

/** One line under the address box: where designs are being kept. */
export function DesignKeptNote() {
  const [account] = useDesignAccount();
  if (account?.signedIn) return <>Designs are saved to {account.business?.name ?? "your business"}&apos;s account.</>;
  return (
    <>
      Designs are saved on this device.{" "}
      <Link href={SIGN_IN} className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
        Sign in to keep them for your business
      </Link>
      .
    </>
  );
}

/** At the foot of the settings page: where the settings are kept. */
export function DesignSettingsKeptNote() {
  const [account] = useDesignAccount();
  if (account?.signedIn) return <>These settings are kept in your business&apos;s account and shared with everyone in it.</>;
  return <>These settings are kept in this browser on this device. Clearing the browser&apos;s data for this site removes them.</>;
}

/** Under the address box, signed in: the business's saved roofs, to open again on any device. */
export function DesignRoofList({ onOpen }: { onOpen: (roof: DesignRoof) => void }) {
  const [roofs, setRoofs] = useState<(DesignRoof & { id: string; updatedAt: string })[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let gone = false;
    void listSavedRoofs().then((found) => !gone && setRoofs(found));
    return () => {
      gone = true;
    };
  }, []);
  if (!roofs.length) return null;
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="mt-8" aria-labelledby="saved-roofs">
      <h2 id="saved-roofs" className="text-[15px] font-medium text-ink">
        Your roofs
      </h2>
      <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface">
        {(all ? roofs : roofs.slice(0, 6)).map((roof) => (
          <li key={roof.id}>
            <button
              onClick={() => onOpen({ address: roof.address, lat: roof.lat, lng: roof.lng })}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {roof.address || `Roof at ${roof.lat.toFixed(5)}, ${roof.lng.toFixed(5)}`}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">{date(roof.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      {!all && roofs.length > 6 && (
        <button onClick={() => setAll(true)} className={`${textLink} mt-2`}>
          Show all {roofs.length}
        </button>
      )}
    </section>
  );
}

/** /design/sign-in: Google, an email and password, or an email alone (a link is sent). */
export function DesignSignIn({ error }: { error?: string }) {
  const [account] = useDesignAccount();
  return (
    <Frame>
      <h1 className="text-[28px] leading-tight tracking-tight text-ink">Sign in</h1>
      <div className="mt-6">
        {account?.signedIn ? (
          <p className="text-[15px] text-ink-2">
            You&apos;re signed in as {account.email}.{" "}
            <Link href="/design" className="font-medium text-ink underline underline-offset-4">
              Open the designer
            </Link>
          </p>
        ) : (
          <SignInForm note={signInNote(error)} />
        )}
      </div>
      <p className="mt-8 text-[13px] text-muted">
        <Link href="/design/roof" className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
          Try the designer without an account
        </Link>
      </p>
    </Frame>
  );
}

/** /design/account: the business's name and the people in it. The owner renames it and adds or removes people. */
export function DesignAccountPage() {
  const [account, refresh] = useDesignAccount();
  const [members, setMembers] = useState<MemberLine[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const business = account?.signedIn && account.state === "ready" ? account.business : null;
  useEffect(() => {
    if (!business) return;
    let gone = false;
    void loadMembers().then((found) => !gone && setMembers(found));
    return () => {
      gone = true;
    };
  }, [business]);

  if (!account) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  if (!account.signedIn || !business)
    return (
      <Frame>
        <h1 className="text-[30px] leading-tight tracking-tight text-ink">Your account.</h1>
        <p className="mt-3 text-[15px] text-ink-2">
          {account.signedIn ? "Finish setting up your business first." : "You're not signed in."}{" "}
          <Link href={account.signedIn ? "/design" : SIGN_IN} className="font-medium text-ink underline underline-offset-4">
            {account.signedIn ? "Continue" : "Sign in"}
          </Link>
        </p>
      </Frame>
    );

  const owner = can(business.role, "members");
  const typed = name ?? business.name;
  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    const failed = await renameBusiness(typed);
    setNote(failed ? { text: failed, error: true } : { text: "Saved." });
    if (!failed) {
      setName(null);
      refresh();
    }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addMember(email.trim());
    if (res.problem) return setNote({ text: res.problem, error: true });
    setMembers(res.members ?? members);
    setNote({ text: `${email.trim()} can now sign in to the roof designer with that email. We don't email them, so let them know.` });
    setEmail("");
  };
  const permit = async (who: string, permissions: MemberPermissions) => {
    const res = await setMemberPermissions(who, permissions);
    if (res.problem) return setNote({ text: res.problem, error: true });
    setMembers(res.members ?? members);
    setNote({ text: `Saved what ${who} may do.` });
  };
  const giveRole = async (who: string, role: "member" | "designer") => {
    const res = await setMemberRole(who, role);
    if (res.problem) return setNote({ text: res.problem, error: true });
    setMembers(res.members ?? members);
    setNote({ text: role === "designer" ? `${who} is now a designer.` : `${who} is now a member.` });
  };
  const remove = async (who: string) => {
    const res = await removeMember(who);
    if (res.problem) return setNote({ text: res.problem, error: true });
    setMembers(res.members ?? members);
    setNote({ text: `${who} has been removed.` });
  };

  return (
    <div className="theme-studio min-h-dvh pb-24">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3 lg:px-10">
        <Link href="/design" aria-label="Roof designer">
          <Wordmark className="text-[17px]" />
        </Link>
        <span className="text-sm text-ink-2">Your account</span>
        <Link href="/design/roof" className={`${primary} ml-auto h-10 px-5`}>
          Back to the designer
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-6 px-5 pt-8">
        <div>
          <p className={eyebrow}>Roof designer</p>
          <h1 className="mt-2 text-[30px] leading-tight tracking-tight text-ink">{business.name}</h1>
          <p className="mt-2 text-[14px] text-ink-2">
            Signed in as {account.email}
            {owner ? " (owner)" : ""}. Roofs, price lists and settings are shared with everyone in the business.
          </p>
        </div>
        {note && (
          <p className={note.error ? "text-sm text-danger" : "text-sm text-positive"} role="status">
            {note.text}
          </p>
        )}

        {owner && (
          <section className={card} aria-labelledby="business-name">
            <h2 id="business-name" className="text-[19px] tracking-tight text-ink">
              Business name
            </h2>
            <form onSubmit={rename} className="mt-3 flex flex-wrap items-center gap-3">
              <input
                className={`${input} max-w-sm`}
                value={typed}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                aria-label="Business name"
              />
              <button type="submit" className={primary} disabled={typed.trim() === business.name}>
                Save
              </button>
            </form>
          </section>
        )}

        <PasswordSection />

        <section className={card} aria-labelledby="people">
          <h2 id="people" className="text-[19px] tracking-tight text-ink">
            People
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Everyone here can design roofs and work with customers and deals. What else each person may do is set below, by the owner, and
            is checked on the server each time: switching one off takes effect with that person&apos;s next click.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {(members ?? []).map((m) => (
              <li key={m.email} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{m.email}</p>
                  <p className="text-xs text-muted">
                    {m.role === "owner"
                      ? "Owner: may do everything"
                      : `${m.role === "designer" ? "Designer" : "Member"}${m.joined ? "" : ": added, hasn't signed in yet"}`}
                  </p>
                  {/* What a member may do. The owner sets it; a member sees their own, greyed. */}
                  {m.role !== "owner" && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {/* A member or a designer: a designer opens every deal and publishes, and changes no settings. */}
                      <div
                        role="radiogroup"
                        aria-label={`Role of ${m.email}`}
                        className="flex w-fit rounded-md border border-line bg-surface p-0.5 text-xs"
                      >
                        {ROLES.map((r) => (
                          <button
                            key={r.role}
                            type="button"
                            role="radio"
                            aria-checked={m.role === r.role}
                            title={r.about}
                            disabled={!owner}
                            onClick={() => m.role !== r.role && void giveRole(m.email, r.role)}
                            className={
                              m.role === r.role
                                ? "rounded-[5px] bg-ink px-2.5 py-1 text-canvas"
                                : "rounded-[5px] px-2.5 py-1 text-ink-2 hover:text-ink"
                            }
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      {m.role === "designer" && <p className="text-xs text-muted">{ROLES.find((r) => r.role === "designer")?.about}</p>}
                      {PERMISSIONS.filter((p) => m.role !== "designer" || p.key === "costs").map((p) => (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2 text-xs ${owner ? "cursor-pointer text-ink-2" : "text-muted"}`}
                          title={p.about}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-3.5 accent-[var(--primary)]"
                            checked={m.permissions[p.key]}
                            disabled={!owner || (p.key === "prices" && !m.permissions.costs)}
                            onChange={(e) => void permit(m.email, { ...m.permissions, [p.key]: e.target.checked })}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {owner && m.role !== "owner" && m.joined && (
                  <button
                    type="button"
                    onClick={async () => {
                      const problem = await viewAs(m.email);
                      if (problem) setNote({ text: problem, error: true });
                      else window.location.replace("/design");
                    }}
                    className="inline-flex h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-ink hover:border-forest"
                    title="Open RENUABL as they see it, read only"
                  >
                    View as
                  </button>
                )}
                {owner && m.role !== "owner" && (
                  <button
                    onClick={() => void remove(m.email)}
                    className="flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                    aria-label={`Remove ${m.email}`}
                    title="Remove from the business"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {owner && (
            <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="email"
                required
                className={`${input} max-w-sm`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Their email"
                aria-label="Email of the person to add"
              />
              <button type="submit" className={primary}>
                Add
              </button>
            </form>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
          <SignOut />
          <Link href={BUSINESS_TERMS_PATH} className={textLink}>
            Terms
          </Link>
          <Link href="/design/settings" className={textLink}>
            Prices and settings
          </Link>
        </div>
      </main>
    </div>
  );
}

/** Your own password: set one to sign in with your email and password as well as by link or Google. */
function PasswordSection() {
  const [has, setHas] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    void passwordState().then(setHas);
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = await savePassword(value);
    if (problem) return setState({ ok: false, message: problem });
    setHas(true);
    setValue("");
    setState({ ok: true, message: "Saved. You can sign in with your email and this password." });
  };
  return (
    <section className={card} aria-labelledby="password">
      <h2 id="password" className="text-[19px] tracking-tight text-ink">
        Password
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {has ? "You have a password. Change it here." : "Set one to sign in with your email and a password."}
      </p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="password"
          className={`${input} max-w-sm`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          aria-label={has ? "New password" : "Password"}
          placeholder={`At least ${PASSWORD_MIN} characters`}
        />
        <button type="submit" className={primary} disabled={value.length < PASSWORD_MIN}>
          {has ? "Change password" : "Set password"}
        </button>
      </form>
      {state && (
        <p className={state.ok ? "mt-2 text-sm text-positive" : "mt-2 text-sm text-danger"} role="status">
          {state.message}
        </p>
      )}
    </section>
  );
}
