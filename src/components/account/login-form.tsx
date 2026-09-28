"use client";

import { ArrowRight, CircleCheck, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { requestLoginLink } from "@/lib/services/accounts";

const CHOICES = [
  { id: "customer", title: "I'm a customer", detail: "See your reservation and your system in My RENUABL." },
  { id: "partner", title: "I'm a partner", detail: "Installers and retailers: open your jobs, offers and payments." },
] as const;

export function LoginForm({
  initialAs,
  next,
  expired,
  demo,
}: {
  initialAs: "customer" | "partner";
  next?: string;
  expired: boolean;
  demo: boolean;
}) {
  const [as, setAs] = useState<"customer" | "partner">(initialAs);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(
    expired ? "That sign-in link has expired or was already used. Send yourself a new one." : null,
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const r = await requestLoginLink(email.trim(), as, next);
    setBusy(false);
    if (r.ok) setSent(r.message);
    else setProblem(r.message);
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage text-forest">
          <MailCheck className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <h1 className="mt-6 text-[30px] font-normal tracking-[-0.035em]">Check your email.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{sent}</p>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="tap-area relative mt-6 text-[14px] text-ink-2 underline underline-offset-4"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void send(e)}>
      <h1 className="text-[34px] font-normal leading-tight tracking-[-0.035em]">Log in to RENUABL.</h1>
      <p className="mt-2 text-[15px] text-muted">No password needed: we&apos;ll email you a link that signs you in.</p>
      <fieldset className="mt-6 space-y-2.5">
        <legend className="sr-only">Who are you?</legend>
        {CHOICES.map((c) => (
          <label
            key={c.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-4",
              as === c.id ? "border-forest ring-1 ring-forest" : "border-line hover:border-line-strong",
            )}
          >
            <input type="radio" name="as" value={c.id} checked={as === c.id} onChange={() => setAs(c.id)} className="sr-only" />
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                as === c.id ? "border-forest bg-forest text-white" : "border-line-strong",
              )}
            >
              {as === c.id && <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </span>
            <span>
              <span className="block text-[16px] text-ink">{c.title}</span>
              <span className="block text-[13.5px] text-muted">{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="mt-5 block">
        <span className="text-[13px] text-muted">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={as === "partner" ? "The email you applied with" : "The email you reserved with"}
          className="mt-1.5 h-12 w-full rounded-xl bg-surface px-4 text-[16px] outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-ink/40"
        />
      </label>
      {problem && (
        <p className="mt-3 text-[13.5px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !email.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Email me a sign-in link"}
      </Button>
      <div className="mt-6 space-y-3 text-center text-[14px]">
        {as === "partner" ? (
          <>
            <p className="text-muted">
              Not a partner yet?{" "}
              <Link href="/partners" className="tap-area relative text-ink underline underline-offset-4">
                Apply to join
              </Link>
            </p>
            {demo && (
              <a
                href="/api/auth/demo"
                className="tap-area relative inline-flex items-center gap-1.5 text-ink-2 underline underline-offset-4"
              >
                Explore the sample partner portal <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        ) : (
          <p className="text-muted">
            Haven&apos;t reserved yet?{" "}
            <Link href="/" className="tap-area relative text-ink underline underline-offset-4">
              Start with your address
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
