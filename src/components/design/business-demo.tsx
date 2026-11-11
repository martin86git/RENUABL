"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, CalendarCheck, FileSignature, LayoutGrid, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/ui/primitives";
import { DEMO_PAGE } from "@/lib/domain/design/demo";
import { SolIcon } from "./sol-icon";

const ICONS: readonly (LucideIcon | null)[] = [LayoutGrid, FileSignature, CalendarCheck, null];

/**
 * "Try the demo" (domain/design/demo.ts): one press opens a demo account of the visitor's own and goes to it. No form.
 * "quiet" is the outlined button, for beside a page's main one; "bar" the small one for a top bar.
 */
export function TryDemoButton({ look = "main" }: { look?: "main" | "quiet" | "bar" }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/business-demo", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; next?: string } | null;
      if (res.ok && data?.ok) {
        window.location.assign(data.next ?? "/design");
        return;
      }
      setProblem(data?.message ?? DEMO_PAGE.failed);
    } catch {
      setProblem(DEMO_PAGE.failed);
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={clsx(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold disabled:bg-surface-2 disabled:text-muted",
          look === "main" && "h-14 bg-sun-line px-8 text-[17px] text-white shadow-sm hover:brightness-105",
          look === "quiet" && "h-12 border border-ink/25 bg-surface px-6 text-[16px] text-ink hover:border-ink",
          look === "bar" && "h-9 border border-ink/25 bg-surface px-3.5 text-[13px] text-ink hover:border-ink",
        )}
      >
        {busy ? DEMO_PAGE.opening : DEMO_PAGE.button}
        {!busy && look !== "bar" && <ArrowRight className="size-4" aria-hidden />}
      </button>
      {problem && (
        <span className="text-[13px] text-danger" role="alert">
          {problem}
        </span>
      )}
    </span>
  );
}

/**
 * /business/demo (domain/design/demo.ts): the short way in to hand to someone. What RENUABL is, what it does, and Try
 * the demo.
 */
export function BusinessDemo({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="theme-studio flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="border-b border-line/70">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/business" aria-label="RENUABL Business" className="flex items-baseline gap-2">
            <Wordmark />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-line sm:tracking-[0.2em]">Business</span>
          </Link>
          <Link
            href={signedIn ? "/design" : "/design/sign-in"}
            className="tap-area whitespace-nowrap text-[14px] text-ink-2 hover:text-ink"
          >
            {signedIn ? "Open RENUABL" : "Sign in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 lg:px-8 lg:py-16">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-sun-line">{DEMO_PAGE.eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-[34px] leading-[1.08] tracking-tight text-ink sm:text-[52px]">{DEMO_PAGE.headline}</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">{DEMO_PAGE.what}</p>

        <div className="mt-8 flex flex-col items-start gap-3">
          <TryDemoButton />
          <p className="text-[13px] text-ink-2">{DEMO_PAGE.note}</p>
        </div>

        <h2 className="mt-14 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{DEMO_PAGE.doesTitle}</h2>
        <ul className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {DEMO_PAGE.does.map((d, i) => {
            const Icon = ICONS[i];
            return (
              <li key={d.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                  {Icon ? <Icon className="size-[18px]" aria-hidden /> : <SolIcon className="size-[18px]" />}
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-ink">{d.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{d.body}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-10">
          <Link
            href="/business"
            className="tap-area inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline underline-offset-4"
          >
            {DEMO_PAGE.more} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-xs text-muted">
        <p>RENUABL · Reburthed Pty Ltd · ABN 96 662 374 905</p>
        <p className="mt-2 space-x-4">
          <Link href="/design/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
