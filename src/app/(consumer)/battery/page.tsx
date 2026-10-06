import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { LegalFooter } from "@/components/consumer/legal-page";
import { WhoopStrip } from "@/components/consumer/whoop-promo";
import { LANDING_PAGES } from "@/lib/domain/landing";

const PAGE = LANDING_PAGES.battery;

export const metadata: Metadata = {
  title: PAGE.title,
  description: PAGE.description,
  alternates: { canonical: PAGE.path },
  // Setting openGraph here replaces the site-wide one, so repeat the share image and site details.
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: PAGE.title,
    description: PAGE.description,
    url: PAGE.path,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RENUABL: a healthier home, powered by the sun" }],
  },
};

/** Ad landing page for homes that already have solar: one message, then the address box (the plan starts wanting a battery). */
export default function BatteryLandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader partners />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="relative isolate mx-auto w-full max-w-[1440px] flex-1 overflow-x-clip px-5 pb-28 pt-6 sm:px-8 lg:border-t lg:border-line lg:px-10 lg:pt-14">
        <div
          className="sun-glow pointer-events-none absolute -right-24 -top-16 -z-10 h-[340px] w-[340px] lg:right-0 lg:top-0 lg:h-[620px] lg:w-[760px]"
          aria-hidden
        />
        <section className="mx-auto max-w-2xl">
          <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">{PAGE.eyebrow}</p>
          <h1 className="mt-4 text-[40px] font-normal leading-[1.04] tracking-[-0.04em] sm:text-[54px] lg:text-[60px]">{PAGE.headline}</h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2 lg:text-[17px]">{PAGE.lead}</p>
          <div id="plan" className="mt-8 scroll-mt-24">
            <p className="text-[14px] text-forest lg:text-[15px]">{PAGE.addressLabel}</p>
            <AddressEntry className="mt-3 max-w-lg" entry={PAGE.key} />
          </div>
          <ul className="mt-8 space-y-2.5">
            {PAGE.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-ink">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage text-forest" aria-hidden>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <WhoopStrip className="mt-7 max-w-lg" />
          <p className="mt-6 max-w-lg text-[13px] leading-snug text-muted">{PAGE.urgency} Victoria only for now.</p>
        </section>
      </main>
      <LegalFooter />
      <AskRenuabl context="home" variant="launcher" title="Ask Revo" />
    </div>
  );
}
