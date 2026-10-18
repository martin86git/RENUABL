"use client";

import { useState } from "react";
import clsx from "clsx";
import { LINK_SENT } from "@/lib/domain/design/password";
import { GOOGLE_SIGN_IN, requestSignInLink, signInWithPassword } from "@/lib/services/design-account";

const input =
  "block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-forest disabled:bg-surface-2";

/** Google's own "G", in its colours, as Google asks its sign-in buttons to show it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/**
 * The roof designer's sign-in: Google, or an email with a password, or an
 * email alone (we send a link). An email with no password set gets a link
 * too, and the page says only that one was sent. A new email always starts
 * with a link or Google, which prove it is theirs; a password can be set
 * afterwards, under Account.
 */
export function SignInForm({ next = "/design", note }: { next?: string; note?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(note ?? null);
  const [sent, setSent] = useState<string | null>(null);

  const link = async (to: string) => {
    const res = await requestSignInLink(to, next);
    if (!res.ok) return setProblem(res.message ?? "That didn't work. Try again.");
    // In development the link is printed where the site runs; the message says so.
    setSent(res.message && /Development/.test(res.message) ? `${LINK_SENT(to)} (Development: it's in the terminal.)` : LINK_SENT(to));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim();
    setBusy(true);
    setProblem(null);
    if (!password) await link(to);
    else {
      const res = await signInWithPassword(to, password, next);
      if (res.ok) window.location.assign(res.next || next);
      else if (res.noPassword) await link(to);
      else setProblem(res.message ?? "That didn't work. Try again.");
    }
    setBusy(false);
  };

  if (sent)
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-surface-2 px-4 py-3 text-[14px] text-ink" role="status">
          {sent}
        </p>
        <button type="button" className="text-[13px] text-ink-2 underline underline-offset-4" onClick={() => setSent(null)}>
          Use a different email
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <a
        href={GOOGLE_SIGN_IN}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-line bg-surface text-sm font-medium text-ink hover:border-forest"
      >
        <GoogleMark /> Continue with Google
      </a>
      <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-[13px] font-medium text-ink-2">
          Email
          <input
            type="email"
            required
            className={clsx(input, "mt-1.5")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@yourbusiness.com.au"
          />
        </label>
        <label className="block text-[13px] font-medium text-ink-2">
          Password <span className="font-normal text-muted">(optional)</span>
          <input
            type="password"
            className={clsx(input, "mt-1.5")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {problem && (
          <p className="text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/** What a sign-in page's ?error= means, in a line. */
export function signInNote(error: string | undefined): string | null {
  if (error === "expired") return "That link has expired or was already used. Sign in again.";
  if (error === "google-off") return "Google sign-in isn't set up on this site yet.";
  if (error === "google") return "Google sign-in didn't go through. Try again.";
  return null;
}
