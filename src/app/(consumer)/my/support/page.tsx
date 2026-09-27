import { MessageCircle, Phone, Wrench } from "lucide-react";
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
    a: "Yes — free of charge up to 72 hours before. Message us and we'll arrange it with your installer.",
  },
  { q: "What does my warranty cover?", a: "25 years on panels, 10 years on inverter and battery, plus the RENUABL workmanship guarantee." },
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Support</Eyebrow>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">How can we help?</h1>
      </div>
      <AskRenuabl context="my" prompt="Ask RENUABL" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: MessageCircle, title: "Message us", body: "Replies within the hour, 7am–9pm." },
          { icon: Phone, title: "Call us", body: "Weekdays 8am–6pm." },
          { icon: Wrench, title: "Book a service", body: "Your installer, at a time that suits." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-5">
            <Icon className="h-5 w-5 text-muted" aria-hidden />
            <p className="mt-3 text-[16px] font-semibold">{title}</p>
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
