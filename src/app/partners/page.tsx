import type { Metadata } from "next";
import Link from "next/link";
import { PartnerSignup } from "@/components/partners/partner-signup";
import { Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Solar installers: jobs already sold, no lead fees",
  description:
    "Join RENUABL as an installation partner in Victoria. Booked solar and battery jobs at your own rates, no lead fees, and everything for each job on your phone.",
  alternates: { canonical: "/partners" },
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: "Stop buying leads. Install jobs that are already sold.",
    url: "/partners",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

/** Partner sign-up: public, in the partner portal's dark theme. */
export default function PartnersPage() {
  return (
    <div className="theme-installer min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8 lg:h-[76px]">
        <span className="flex items-baseline gap-3">
          <Link href="/" aria-label="RENUABL home">
            <Wordmark className="text-[19px] lg:text-[22px]" />
          </Link>
          <Link href="/partners" className="text-[12px] tracking-wide text-muted hover:text-ink">
            Partners
          </Link>
        </span>
        <Link href="/" className="tap-area text-[13px] text-ink-2 hover:text-ink">
          Getting solar? Start here
        </Link>
      </header>
      <main>
        <PartnerSignup />
      </main>
    </div>
  );
}
