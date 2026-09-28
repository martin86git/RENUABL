import Link from "next/link";
import type { ReactNode } from "react";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { LEGAL, legalLine } from "@/lib/domain/legal";

/** A plain reading page for the privacy policy, terms and contact details. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
        <h1 className="text-[36px] font-normal leading-tight tracking-[-0.035em] lg:text-[44px]">{title}</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated {LEGAL.updated}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-8 [&_h2]:text-[19px] [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

/** The small legal line with links, on the home page and legal pages. */
export function LegalFooter() {
  return (
    <footer className="border-t border-line px-5 py-5 text-[12px] text-muted sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2">
        <span>{legalLine(new Date().getFullYear())}</span>
        <Link href="/privacy" className="tap-area underline-offset-4 hover:text-ink hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="tap-area underline-offset-4 hover:text-ink hover:underline">
          Terms
        </Link>
        <Link href="/contact" className="tap-area underline-offset-4 hover:text-ink hover:underline">
          Contact
        </Link>
      </div>
    </footer>
  );
}
