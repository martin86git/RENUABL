import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { GuidesStrip } from "@/components/consumer/guide-page";
import { LegalFooter } from "@/components/consumer/legal-page";
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdHtml, siteJsonLd } from "@/lib/domain/seo";
import { publicSiteUrl } from "@/lib/domain/site";
import { LEARN_NAME, LEARN_POPUP, guideBySlug, type Guide } from "@/lib/domain/guides";
import { LearnPopup } from "@/components/consumer/learn-popup";
import { Mascot } from "@/components/ui/brand-art";
import { Script } from "@/components/ui/primitives";

const FEATURED = LEARN_POPUP.featured.map(guideBySlug).filter((g): g is Guide => Boolean(g));

export const metadata: Metadata = {
  title: { absolute: `${HOME_TITLE} · RENUABL` },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  // Setting openGraph here replaces the site-wide one, so repeat the share image and site details.
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RENUABL: solar and batteries, sized to your bill" }],
  },
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(publicSiteUrl())) }} />
      <MobileHeader partners />
      <ConsumerTopBar className="hidden lg:flex" partners />

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 items-center px-5 pb-8 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:border-t lg:border-line lg:px-10 lg:pb-16 lg:pt-12">
        <section className="lg:col-span-6 xl:col-span-5 xl:col-start-2">
          <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">One platform. One journey.</p>
          <h1 className="mt-3 text-[40px] font-normal leading-[1.02] tracking-[-0.04em] sm:text-[52px] lg:text-[64px]">
            Solar and batteries, sized to your bill.
          </h1>
          <ol className="mt-5 space-y-2 text-[16px] text-muted lg:mt-7 lg:text-[18px]">
            {["Upload your bill", "Pick your install date", "Start saving"].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-[12px] text-forest"
                  aria-hidden
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[15px] text-forest lg:mt-7 lg:text-[16px]">Your system, priced in about two minutes.</p>
          <AddressEntry className="mt-4 max-w-lg lg:mt-5" />
          <Link
            href="/learn"
            className="tap-area mt-3 inline-flex items-center gap-1.5 text-[14px] text-forest underline-offset-4 hover:underline lg:hidden"
          >
            New to solar? {LEARN_NAME} <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <div className="mt-4 hidden lg:block">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <AskRenuabl context="home" variant="link" title="Not sure yet? Ask Revo" />
              <Link
                href="/learn"
                className="tap-area inline-flex items-center gap-1.5 text-[14px] text-forest underline-offset-4 hover:underline"
              >
                New to solar? {LEARN_NAME} <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </Link>
            </div>
          </div>

          {/* Mobile mascot sits below the address. */}
          <div className="relative mx-auto mt-4 w-[230px] lg:hidden">
            <Mascot className="h-auto w-full" float priority />
            <Script className="absolute -right-6 bottom-10 text-[20px]">
              The future
              <br />
              &nbsp;lives here.
            </Script>
          </div>

          <AskRenuabl context="home" variant="link" title="Not sure yet? Ask Revo" className="mt-6 lg:hidden" />
        </section>

        <div className="relative hidden justify-center lg:col-span-6 lg:flex">
          <Mascot className="h-auto w-[460px] xl:w-[520px]" float priority />
          <Script className="absolute bottom-16 right-[8%] text-[26px] xl:right-[14%]">
            The future
            <br />
            &nbsp;lives here.
          </Script>
        </div>
      </main>
      <GuidesStrip guides={FEATURED} />
      <LegalFooter />
      <LearnPopup />
    </div>
  );
}
