import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AddressEntry } from "@/components/consumer/address-entry";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { GuidesStrip } from "@/components/consumer/guide-page";
import { LegalFooter } from "@/components/consumer/legal-page";
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdHtml, siteJsonLd } from "@/lib/domain/seo";
import { publicSiteUrl } from "@/lib/domain/site";
import { LEARN_NAME, LEARN_POPUP, guideBySlug, type Guide } from "@/lib/domain/guides";
import { LearnPopup } from "@/components/consumer/learn-popup";
import { ExamplePlanCard, HealthTeaser, HowItWorks, PackagesSection } from "@/components/consumer/home-sections";
import { WhoopBanner } from "@/components/consumer/whoop-promo";
import { HOME_HERO } from "@/lib/domain/healthy-home";

// "…powered by the sun." with a warm marker under "sun".
const [headlineBefore, headlineAfter] = HOME_HERO.headline.split("sun");

const heroLink = "tap-area inline-flex items-center gap-1.5 text-[14px] text-forest underline-offset-4 hover:underline";

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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RENUABL: a healthier home, powered by the sun" }],
  },
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(publicSiteUrl())) }} />
      <MobileHeader partners />
      <ConsumerTopBar className="hidden lg:flex" partners />

      <main className="relative isolate mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-4 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:border-t lg:border-line lg:px-10 lg:pt-12">
        {/* A soft sun glow behind the hero (decorative). */}
        <div
          className="sun-glow pointer-events-none absolute -right-24 -top-16 -z-10 h-[340px] w-[340px] lg:right-0 lg:top-0 lg:h-[620px] lg:w-[760px]"
          aria-hidden
        />
        <section className="lg:col-span-7 xl:col-span-6 xl:col-start-2">
          <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">{HOME_HERO.eyebrow}</p>
          <h1 className="mt-3 text-[40px] font-normal leading-[1.02] tracking-[-0.04em] sm:text-[52px] lg:text-[60px]">
            {headlineBefore}
            <span className="sun-mark">sun</span>
            {headlineAfter}
          </h1>
          <ol className="mt-5 space-y-2 text-[16px] text-muted lg:mt-6 lg:text-[17px]">
            {HOME_HERO.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun text-[12px] text-sun-ink"
                  aria-hidden
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div id="plan" className="scroll-mt-24">
            <p className="mt-6 text-[15px] text-forest lg:text-[16px]">{HOME_HERO.label}</p>
            <AddressEntry className="mt-4 max-w-lg" />
          </div>
          <div className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <Link href="/learn" className={heroLink}>
              New to solar? {LEARN_NAME} <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link href="/home-health" className={heroLink}>
              {HOME_HERO.healthLink} <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
          </div>
        </section>

        <div className="flex justify-center lg:col-span-5 xl:col-span-4">
          <ExamplePlanCard />
        </div>
      </main>
      <PackagesSection />
      <WhoopBanner />
      <HowItWorks />
      <HealthTeaser />
      <div className="pt-8" />
      <GuidesStrip guides={FEATURED} />
      <LegalFooter />
      <LearnPopup />
    </div>
  );
}
