import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isConsentToken } from "@/lib/domain/design/call-consent";
import { consentPage } from "@/lib/server/design-call-consent";

export const metadata: Metadata = {
  title: { absolute: "Would you like a call?" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The link in a business's "Would you like a call?" email (domain/design/call-consent.ts): Yes or No, by a press, never
 * by opening the page, so a mail app checking links answers nothing. It names the business and its phone assistant,
 * and shows the very words a Yes agrees to.
 */
export default async function CallConsentPage({ params }: PageProps<"/c/[token]">) {
  await connection();
  const { token } = await params;
  const page = isConsentToken(token) ? await consentPage(token).catch(() => null) : null;
  if (!page) notFound();
  const { business, assistant, firstName, words, state } = page;
  return (
    <main className="theme-studio grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md rounded-2xl bg-surface p-7 shadow-[var(--shadow-soft)] ring-1 ring-line">
        {state === "yes" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Thanks{firstName ? `, ${firstName}` : ""}. {assistant} will call you soon.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Calls are made on weekdays and Saturdays, during the day. {assistant} is {business}&apos;s automated assistant and can pass
              anything to the team.
            </p>
          </>
        ) : state === "no" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">No problem. We won&apos;t call.</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{business} will be in touch another way.</p>
          </>
        ) : state === "lapsed" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">This link has expired.</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">Reply to {business}&apos;s email and they&apos;ll be in touch.</p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{business}</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
              Would you like a call{firstName ? `, ${firstName}` : ""}?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              {assistant} is {business}&apos;s automated (AI) phone assistant. It can answer your questions and pass anything else to the
              team.
            </p>
            <form method="post" action={`/api/c/${token}`} className="mt-6 space-y-2.5">
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink ring-1 ring-line">{words}</p>
              <button
                type="submit"
                name="answer"
                value="yes"
                className="h-11 w-full rounded-full bg-ink text-sm font-medium text-white hover:bg-ink-2"
              >
                Yes, call me
              </button>
              <button
                type="submit"
                name="answer"
                value="no"
                className="h-11 w-full rounded-full bg-surface text-sm font-medium text-ink ring-1 ring-line hover:bg-surface-2"
              >
                No thanks, don&apos;t call
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-[11px] text-muted">Sent by {business} using RENUABL</p>
      </div>
    </main>
  );
}
