import { CalendarCheck, Home, ShieldCheck, Sun } from "lucide-react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { ConsumerTopBar } from "@/components/consumer/consumer-top-bar";
import { EnergyOrb } from "@/components/ui/energy-orb";

const HOW = [
  { icon: Home, title: "Tell us about your home", body: "Your address and a few everyday questions. No jargon." },
  { icon: Sun, title: "We recommend your system", body: "One clear recommendation, sized for how you live. Adjust anything." },
  { icon: ShieldCheck, title: "We match your installer", body: "A licensed, top-rated local installer — chosen for you." },
  { icon: CalendarCheck, title: "You choose the day", body: "Pick a date, reserve with a refundable deposit, and relax." },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--sun), transparent 65%)" }}
      />
      <ConsumerTopBar />

      <main className="relative mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 items-center gap-6 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-12 lg:pb-20">
        <section className="lg:col-span-6 xl:col-span-5">
          <h1 className="text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[56px] lg:text-[68px]">
            Your home,
            <br />
            powered by the sun.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted lg:text-[19px]">
            Enter your address. We&apos;ll recommend the right system, match a trusted installer, and you choose the day.
          </p>
          <AddressEntry className="mt-8 max-w-xl" />
          <div className="my-6 flex justify-center lg:hidden">
            <EnergyOrb className="h-[140px] w-[140px]" mood="happy" />
          </div>
          <AskRenuabl context="home" variant="bar" prompt="Not sure yet? Ask RENUABL" className="max-w-xl lg:mt-5" />
        </section>

        <div className="hidden justify-center lg:col-span-6 lg:flex xl:col-span-7">
          <EnergyOrb className="h-[420px] w-[420px]" mood="happy" />
        </div>
      </main>

      <section id="how" className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        <h2 className="text-[13px] font-medium tracking-wide text-muted">How it works</h2>
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {HOW.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-3xl bg-surface p-6 border border-line">
              <div className="flex items-center justify-between">
                <Icon className="h-6 w-6 text-ink-2" aria-hidden />
                <span className="text-[13px] text-muted tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-[17px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
