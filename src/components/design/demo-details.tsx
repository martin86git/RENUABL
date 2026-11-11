"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  DEMO_COMPANY_MAX,
  DEMO_DETAILS,
  DEMO_DETAILS_EVENT,
  DEMO_DETAILS_HEADER,
  DEMO_NAME_MAX,
  DEMO_PAGE,
  demoPageNeedsDetails,
} from "@/lib/domain/design/demo";
import { designAccount, type DesignAccount } from "@/lib/services/design-account";

const input =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-muted focus:border-sun-line sm:text-sm";

const DONE_MESSAGE = "renuabl:demo-details-done";

type SignedIn = Extract<DesignAccount, { signedIn: true }>;

/** Opens the "Put your business on it" box from anywhere in a demo. */
export const askDemoDetails = () => window.dispatchEvent(new Event(DEMO_DETAILS_EVENT));

/** The bar over every page of a demo account: that it is a demo, and until given, the way to put their business on it. */
export function DemoBar({ account }: { account: SignedIn }) {
  if (!account.demo) return null;
  return (
    <div className="sticky top-0 z-[45] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sun-line px-4 py-2 text-center text-sm text-white print:hidden">
      <span>{DEMO_PAGE.bar}</span>
      {account.demoNeedsDetails ? (
        <button type="button" onClick={askDemoDetails} className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-ink">
          {DEMO_DETAILS.barButton}
        </button>
      ) : (
        <Link href="/business" className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
          {DEMO_PAGE.barLink}
        </Link>
      )}
    </div>
  );
}

/**
 * In a demo whose visitor hasn't said who they are (domain/design/demo.ts): the box that asks, opened from the bar,
 * when a page opens on something that needs it (the designer on a roof), or when the server refuses something for want
 * of it (any request answered with `DEMO_DETAILS_HEADER`: Sol asked, a proposal published). Nothing is drawn otherwise.
 */
export function DemoDetailsPrompt({ account }: { account: SignedIn }) {
  // Only a demo draws anything; the box reads the address, which waits for the page (hence the boundary).
  if (!account.demo) return null;
  return (
    <Suspense fallback={null}>
      <Prompt account={account} />
    </Suspense>
  );
}

function Prompt({ account }: { account: SignedIn }) {
  const due = Boolean(account.demo && account.demoNeedsDetails);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const gatedPage = demoPageNeedsDetails(pathname, search);
  const [asked, setAsked] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The designer in a deal's pop-up is a frame of its own: when the details are given there, this page hears of it.
  useEffect(() => {
    if (!account.demo) return;
    const heard = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === DONE_MESSAGE) void designAccount(true);
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [account.demo]);

  useEffect(() => {
    if (!due) return;
    const open = () => setAsked(true);
    window.addEventListener(DEMO_DETAILS_EVENT, open);
    // Anything the server refuses until the details are given opens the box, whichever screen asked.
    const plain = window.fetch;
    window.fetch = async (...args) => {
      const res = await plain(...args);
      if (res.status === 403 && res.headers.get(DEMO_DETAILS_HEADER)) open();
      return res;
    };
    return () => {
      window.removeEventListener(DEMO_DETAILS_EVENT, open);
      window.fetch = plain;
    };
  }, [due]);

  const here = `${pathname}?${search}`;
  const open = due && (asked || (gatedPage && dismissed !== here));
  if (!open) return null;

  const close = () => {
    setAsked(false);
    setDismissed(here);
    setProblem(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/business-demo", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, company, email }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) {
        if (window.parent !== window) window.parent.postMessage(DONE_MESSAGE, window.location.origin);
        // A page that opened on something refused loads again with it allowed; elsewhere they carry on where they were.
        if (gatedPage) window.location.reload();
        else {
          await designAccount(true);
          setAsked(false);
        }
        return;
      }
      setProblem(data?.message ?? DEMO_DETAILS.failed);
    } catch {
      setProblem(DEMO_DETAILS.failed);
    }
    setBusy(false);
  };

  return createPortal(
    <div
      className="theme-studio fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-details-title"
        className="relative w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label={DEMO_DETAILS.later}
          className="tap-area absolute right-4 top-4 text-muted hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
        <h2 id="demo-details-title" className="pr-8 text-[22px] font-semibold tracking-tight text-ink">
          {DEMO_DETAILS.title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{DEMO_DETAILS.intro}</p>
        <div className="mt-5 space-y-3">
          <label className="block text-[13px] font-medium text-ink-2">
            {DEMO_DETAILS.name}
            <input
              required
              autoFocus
              maxLength={DEMO_NAME_MAX * 2}
              autoComplete="name"
              className={`${input} mt-1.5`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-ink-2">
            {DEMO_DETAILS.company}
            <input
              required
              maxLength={DEMO_COMPANY_MAX}
              autoComplete="organization"
              className={`${input} mt-1.5`}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-ink-2">
            {DEMO_DETAILS.email}
            <input
              required
              type="email"
              autoComplete="email"
              className={`${input} mt-1.5`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        {problem && (
          <p className="mt-3 text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-sun-line px-5 text-[15px] font-semibold text-white shadow-sm hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
        >
          {busy ? DEMO_DETAILS.saving : DEMO_DETAILS.button}
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">
          {DEMO_DETAILS.consent}{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-ink">
            Privacy Policy
          </Link>
        </p>
      </form>
    </div>,
    document.body,
  );
}
