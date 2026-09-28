import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/consumer/legal-page";
import { LEGAL } from "@/lib/domain/legal";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact us">
      <p>We&apos;d love to hear from you. Email us and we&apos;ll get back to you as soon as we can.</p>
      <ul>
        <li>
          Email:{" "}
          <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-4">
            {LEGAL.email}
          </a>
        </li>
        <li>
          Business: {LEGAL.company} trading as {LEGAL.tradingAs}
        </li>
        <li>ABN: {LEGAL.abn}</li>
        <li>Location: {LEGAL.state}, Australia</li>
      </ul>
      <p>
        Already reserved? You can see your reservation in{" "}
        <Link href="/my" className="text-ink underline underline-offset-4">
          My RENUABL
        </Link>
        . Installers and retailers can{" "}
        <Link href="/partners" className="text-ink underline underline-offset-4">
          become a partner
        </Link>
        .
      </p>
    </LegalPage>
  );
}
