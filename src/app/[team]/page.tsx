import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignInForm } from "@/components/design/sign-in-form";
import { RememberTeamPage } from "@/components/design/remember-team-page";
import { SIGN_IN_PAGE_WORDS, readSignInSegment } from "@/lib/domain/design/sign-in-page";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { signInPageFor } from "@/lib/server/design-sign-in-page";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * A business's own sign-in page, /<name>-<key> (sign-in-page.ts): its logo and name over the usual sign-in. Any other
 * address of that shape, or a key made since, is a plain 404, so the page says nothing about who uses RENUABL.
 */
export default async function TeamSignInPage({ params }: PageProps<"/[team]">) {
  const { team } = await params;
  const read = readSignInSegment(team);
  if (!read || !dbConfigured()) notFound();
  const page = await signInPageFor(read.slug, read.key).catch(() => null);
  if (!page) notFound();
  const session = await currentSession().catch(() => null);
  if (session?.role === "business") redirect("/design");

  return (
    <div className="theme-studio flex min-h-dvh flex-col bg-canvas">
      <RememberTeamPage segment={`${read.slug}-${read.key}`} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8">
          {page.logo && (
            <div className="mb-6 flex min-h-16 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- the business's own logo, sent inline with the page */}
              <img src={page.logo} alt={page.name} className="max-h-20 max-w-[16rem] object-contain" />
            </div>
          )}
          <h1 className="text-center text-[22px] leading-tight tracking-tight text-ink">{SIGN_IN_PAGE_WORDS.heading(page.name)}</h1>
          <div className="mt-6">
            <SignInForm />
          </div>
        </div>
        <p className="mt-6 text-center text-[12px] text-muted">{SIGN_IN_PAGE_WORDS.poweredBy}</p>
      </main>
    </div>
  );
}
