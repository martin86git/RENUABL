import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AddressEntry } from "@/components/consumer/address-entry";
import { cn } from "@/components/ui/primitives";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { GuidesStrip } from "@/components/consumer/guide-page";
import { LegalFooter } from "@/components/consumer/legal-page";
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdHtml, siteJsonLd } from "@/lib/domain/seo";
import { publicSiteUrl } from "@/lib/domain/site";
import { LEARN_NAME, LEARN_POPUP, guideBySlug, type Guide } from "@/lib/domain/guides";
import { LearnPopup } from "@/components/consumer/learn-popup";
import { MascotAvatar } from "@/components/ui/brand-art";
import { ExamplePlanCard, HealthTeaser, HowItWorks, PackagesSection } from "@/components/consumer/home-sections";
import { WhoopBanner } from "@/components/consumer/whoop-promo";
import { HOME_HERO } from "@/lib/domain/healthy-home";

// Three lines, with a warm marker under "sun" on the last.
const headlineTop = HOME_HERO.headlineLines.slice(0, -1);
const [sunBefore, sunAfter] = HOME_HERO.headlineLines[HOME_HERO.headlineLines.length - 1].split("sun");

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

      <main className="relative isolate mx-auto grid overflow-x-clip w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-4 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:border-t lg:border-line lg:px-10 lg:pt-12">
        {/* A soft sun glow behind the hero (decorative). */}
        <div
          className="sun-glow pointer-events-none absolute -right-24 -top-16 -z-10 h-[340px] w-[340px] lg:right-0 lg:top-0 lg:h-[620px] lg:w-[760px]"
          aria-hidden
        />
        <section className="lg:col-span-7 xl:col-span-6 xl:col-start-2">
          {/* On phones the hero fills the first screen: the headline sits in the space above, and the steps lead
              straight into the address box, the last thing on screen, with room below it. */}
          <div className="flex min-h-[calc(100svh-5rem)] flex-col pb-24 lg:block lg:min-h-0 lg:pb-0">
            <div className="flex flex-1 flex-col justify-center py-6 lg:block lg:py-0">
              <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">{HOME_HERO.eyebrow}</p>
              <h1 className="mt-4 text-[42px] font-normal leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[64px]">
                {headlineTop.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                <span className="block">
                  {sunBefore}
                  <span className="sun-mark">sun</span>
                  {sunAfter}
                </span>
              </h1>
            </div>
            <div className="lg:mt-12">
              <ol className="space-y-1.5 text-[14px] text-muted lg:text-[15px]">
                {HOME_HERO.steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-sun-line text-[11px] text-sun-line-ink"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <div id="plan" className="mt-7 scroll-mt-24 lg:mt-8">
                <p className="text-[14px] text-forest lg:text-[15px]">{HOME_HERO.label}</p>
                <AddressEntry className="mt-3 max-w-lg" />
              </div>
            </div>
          </div>
          <Link
            href="/learn"
            className="group flex max-w-lg items-center gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md lg:mt-10"
          >
            <MascotAvatar className="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink">{LEARN_NAME}</span>
              <span className="block text-[13px] leading-snug text-muted">{HOME_HERO.learnLine}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-forest transition-transform group-hover:translate-x-0.5" strokeWidth={1.6} />
          </Link>
          <Link href="/home-health" className={cn(heroLink, "mt-3")}>
            {HOME_HERO.healthLink} <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
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
