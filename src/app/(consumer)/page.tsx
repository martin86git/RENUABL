import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { LegalFooter } from "@/components/consumer/legal-page";
import { Mascot } from "@/components/ui/brand-art";
import { Script } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
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
          <div className="mt-4 hidden lg:block">
            <AskRenuabl context="home" variant="link" title="Not sure yet? Ask RENUABL" />
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

          <AskRenuabl context="home" variant="link" title="Not sure yet? Ask RENUABL" className="mt-6 lg:hidden" />
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
      <LegalFooter />
    </div>
  );
}
