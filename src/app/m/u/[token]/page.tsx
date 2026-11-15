import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { dbConfigured } from "@/lib/server/db";
import { unsubscribeTarget } from "@/lib/server/marketing-send";

export const metadata: Metadata = {
  title: { absolute: "Email preferences" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The unsubscribe link in a business's marketing email (RENUABL Business): a button, so opening the page (or a mail app checking the link)
 * never unsubscribes anyone. A test email's link (`test`) only says so.
 */
export default async function MarketingUnsubscribe({ params, searchParams }: PageProps<"/m/u/[token]">) {
  await connection();
  const { token } = await params;
  const s = (await searchParams).s;
  const send = typeof s === "string" && /^[0-9a-f]{40}$/.test(s) ? s : null;
  const test = token === "test";
  const target = !test && dbConfigured() && /^[0-9a-f]{40}$/.test(token) ? await unsubscribeTarget(token).catch(() => null) : null;
  if (!test && !target) notFound();
  return (
    <main className="theme-studio grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="w-full max-w-md rounded-2xl bg-surface p-7 text-center shadow-[var(--shadow-soft)] ring-1 ring-line">
        {target && <p className="text-[13px] font-semibold text-ink">{target.business}</p>}
        {test ? (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">This was a test email.</h1>
            <p className="mt-3 text-sm text-ink-2">In a real email this link unsubscribes the person it was sent to.</p>
          </>
        ) : target!.done ? (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">You&apos;re unsubscribed.</h1>
            <p className="mt-3 text-sm text-ink-2">
              {target!.email} won&apos;t get {target!.business}&apos;s marketing emails again.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Unsubscribe from {target!.business}&apos;s emails?</h1>
            <p className="mt-3 text-sm text-ink-2">{target!.email} won&apos;t get their marketing emails any more.</p>
            <form method="post" action={`/api/m/u/${token}${send ? `?s=${send}` : ""}`} className="mt-6">
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="h-11 w-full rounded-full bg-ink text-sm font-medium text-white hover:bg-ink-2">
                Unsubscribe
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-[12px] text-muted">Sent with RENUABL Business.</p>
      </div>
    </main>
  );
}
