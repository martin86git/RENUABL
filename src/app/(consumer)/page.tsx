import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { Mascot } from "@/components/ui/brand-art";
import { Script } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 items-center px-5 pb-8 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:border-t lg:border-line lg:px-10 lg:pb-16 lg:pt-12">
        <section className="lg:col-span-6 xl:col-span-5 xl:col-start-2">
          <h1 className="text-[40px] font-normal leading-[1.02] tracking-[-0.04em] sm:text-[52px] lg:text-[64px]">
            A smarter energy future for your home.
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted lg:mt-6 lg:text-[18px]">
            Solar, batteries, EV charging and more. Designed for your home, made simple.
          </p>
          <AddressEntry className="mt-7 max-w-lg lg:mt-10" />
          <div className="mt-4 hidden lg:block">
            <AskRenuabl context="home" variant="link" title="Not sure yet? Ask RENUABL" />
          </div>

          {/* Mobile mascot sits below the address. */}
          <div className="relative mx-auto mt-4 w-[230px] lg:hidden">
            <Mascot className="h-auto w-full" float priority />
            <Script className="absolute -right-6 bottom-10 text-[20px]">
              Good
              <br />
              &nbsp;energy
              <br />
              &nbsp;&nbsp;lives here.
            </Script>
          </div>

          <AskRenuabl context="home" variant="link" title="Not sure yet? Ask RENUABL" className="mt-6 lg:hidden" />
        </section>

        <div className="relative hidden justify-center lg:col-span-6 lg:flex">
          <Mascot className="h-auto w-[460px] xl:w-[520px]" float priority />
          <Script className="absolute bottom-16 right-[8%] text-[26px] xl:right-[14%]">
            Good
            <br />
            &nbsp;energy
            <br />
            &nbsp;&nbsp;lives here.
          </Script>
        </div>
      </main>
    </div>
  );
}
