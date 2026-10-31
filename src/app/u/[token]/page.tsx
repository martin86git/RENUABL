import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isUnsubToken } from "@/lib/domain/design/customers";
import { unsubscribeTarget } from "@/lib/server/design-people-repo";

export const metadata: Metadata = {
  title: { absolute: "Email preferences" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The link at the foot of a business's group email: a button to stop its group emails (a press, not the opening of the
 * page, so a mail app that checks links can't unsubscribe anyone). It names the business, not RENUABL's customer.
 */
export default async function UnsubscribePage({ params }: PageProps<"/u/[token]">) {
  await connection();
  const { token } = await params;
  const target = isUnsubToken(token) ? await unsubscribeTarget(token).catch(() => null) : null;
  if (!target) notFound();
  return (
    <main className="theme-studio grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="w-full max-w-md rounded-2xl bg-surface p-7 text-center shadow-[var(--shadow-soft)] ring-1 ring-line">
        {target.done ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">You won&apos;t get these emails again.</h1>
            <p className="mt-3 text-sm text-ink-2">
              {target.business} won&apos;t send you group emails any more. They can still write to you about your own system.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Stop emails from {target.business}?</h1>
            <p className="mt-3 text-sm text-ink-2">
              You won&apos;t get their group emails any more. They can still write to you about your own system.
            </p>
            <form method="post" action={`/api/u/${token}`} className="mt-6">
              <button type="submit" className="h-11 w-full rounded-full bg-ink text-sm font-medium text-white hover:bg-ink-2">
                Stop these emails
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
