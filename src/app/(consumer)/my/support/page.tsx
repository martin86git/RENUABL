import { ArrowRight, MessageCircle, Phone, Wrench } from "lucide-react";
import Link from "next/link";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { Disclosure } from "@/components/ui/controls";
import { Card, Eyebrow } from "@/components/ui/primitives";

export const metadata = { title: "Support" };

const FAQ = [
  {
    q: "My app shows no data",
    a: "This is usually Wi-Fi at the inverter. Check your router is on; data catches up automatically once reconnected.",
  },
  {
    q: "Can I change my installation date?",
    a: "Yes — free of charge up to 72 hours before. Message us and we'll arrange it with your installation partner.",
  },
  { q: "What does my warranty cover?", a: "25 years on panels, 10 years on inverter and battery, plus the RENUABL workmanship guarantee." },
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Support</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">How can we help?</h1>
      </div>
      <AskRenuabl context="my" title="Ask Revo" subtitle="Straight answers about your system, any time." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/my/service" className="block sm:order-first">
          {/* Not Card: its white background would win over bg-forest (cn doesn't merge), hiding the white text. */}
          <div className="h-full rounded-[var(--radius-card)] bg-forest p-5 text-white shadow-[var(--shadow-soft)] transition hover:opacity-95">
            <Wrench className="h-5 w-5 text-white/80" aria-hidden />
            <p className="mt-3 text-[16px] font-medium">Book a service</p>
            <p className="text-[14px] text-white/75">Your installation partner, at a time that suits.</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[13px]">
              Book now <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </p>
          </div>
        </Link>
        {[
          { icon: MessageCircle, title: "Message us", body: "Replies within the hour, 7am–9pm." },
          { icon: Phone, title: "Call us", body: "Weekdays 8am–6pm." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-5">
            <Icon className="h-5 w-5 text-muted" aria-hidden />
            <p className="mt-3 text-[16px] font-medium">{title}</p>
            <p className="text-[14px] text-muted">{body}</p>
          </Card>
        ))}
      </div>
      <Card className="divide-y divide-line px-5 sm:px-6">
        {FAQ.map((f) => (
          <Disclosure key={f.q} title={f.q}>
            {f.a}
          </Disclosure>
        ))}
      </Card>
    </div>
  );
}
