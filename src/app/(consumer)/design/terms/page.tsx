import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";
import { BUSINESS_TERMS, BUSINESS_TERMS_DRAFT_NOTE, BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { LEGAL } from "@/lib/domain/legal";

export const metadata: Metadata = {
  title: "Terms · Roof designer",
  robots: { index: false, follow: false },
};

/**
 * The terms a business accepts before its work is kept on our servers. The
 * wording lives in `domain/design/account.ts` with its version; it is a
 * draft, and says so at the top until a lawyer has reviewed it.
 */
export default function DesignTermsPage() {
  return (
    <div className="theme-studio flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 lg:px-10">
        <Link href="/design" aria-label="Roof designer">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
        <h1 className="text-[36px] font-normal leading-tight tracking-[-0.035em] text-ink">Roof designer terms</h1>
        <p className="mt-2 text-[13px] text-muted">Version {BUSINESS_TERMS_VERSION}</p>
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-[14px] leading-relaxed text-warning" role="note">
          {BUSINESS_TERMS_DRAFT_NOTE}
        </p>
        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            These terms apply to the roof designer, provided by {LEGAL.company} trading as {LEGAL.tradingAs} (ABN {LEGAL.abn}).
          </p>
          {BUSINESS_TERMS.map((section) => (
            <section key={section.heading}>
              <h2 className="mt-8 text-[19px] text-ink">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <p className="pt-4">
            Questions:{" "}
            <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4 hover:text-ink">
              {LEGAL.email}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
