"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { welcomeBack } from "@/lib/services/billing";
import { ui } from "./design-shell";

/**
 * Back from Stripe after starting the trial: the sign-up is checked with Stripe on the server, the sign-in link goes
 * to the email the plan is for, and the page says to open it. Opening the link names the business and accepts the terms.
 */
export function Welcome({ sessionId }: { sessionId: string | null }) {
  const [state, setState] = useState<{ email: string } | { message: string } | null>(null);
  useEffect(() => {
    if (!sessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ message: "This page is where Stripe sends you after signing up. Start from the pricing." });
      return;
    }
    void welcomeBack(sessionId).then((a) => setState(a.ok ? { email: a.email } : { message: a.message }));
  }, [sessionId]);

  return (
    <main className="theme-studio flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link href="/design" aria-label="RENUABL home">
          <Wordmark />
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-24 sm:px-6">
        {!state && <p className="text-sm text-ink-2">Checking your sign-up with Stripe…</p>}
        {state && "email" in state && (
          <div className={clsx(ui.card, "space-y-4 p-6 sm:p-8")}>
            <p className={ui.eyebrow}>You&apos;re in</p>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Check your email.</h1>
            <p className="text-[15px] leading-relaxed text-ink-2">
              We&apos;ve sent a sign-in link to <strong className="text-ink">{state.email}</strong>. Open it on this device to name your
              business and step inside. Your plan has started.
            </p>
            <p className="text-sm text-muted">
              No email after a minute or two? Check junk, or{" "}
              <Link href="/design/sign-in" className={ui.link}>
                ask for another link
              </Link>
              .
            </p>
          </div>
        )}
        {state && "message" in state && (
          <div className={clsx(ui.card, "space-y-4 p-6 sm:p-8")}>
            <h1 className="text-2xl font-semibold tracking-tight">Something&apos;s not right.</h1>
            <p className="text-[15px] leading-relaxed text-ink-2">{state.message}</p>
            <Link href="/design#pricing" className={ui.primary}>
              Back to pricing
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
