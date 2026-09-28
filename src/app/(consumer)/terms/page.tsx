import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/consumer/legal-page";
import { LEGAL } from "@/lib/domain/legal";
import { ASSUMPTIONS } from "@/lib/domain/recommendation";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms apply to the RENUABL website and services, provided by {LEGAL.company} trading as {LEGAL.tradingAs} (ABN {LEGAL.abn}
        ). By using the website you agree to them.
      </p>

      <h2>What RENUABL does</h2>
      <p>
        RENUABL recommends and sells home energy systems, such as solar and batteries, sized from your electricity bill, and arranges their
        installation by an independent, licensed installation partner.
      </p>

      <h2>Estimates and prices</h2>
      <p>
        Savings, sunshine, roof details and rebates shown on the website are estimates based on the information available, including your
        bill and third-party data. Your system, price and rebates are confirmed with you on your 15-minute confirmation call before anything
        is final. Rebates depend on the rules and eligibility criteria set by the government schemes that offer them.
      </p>

      <h2>Reserving and deposits</h2>
      <ul>
        <li>Reserving an installation date is free.</li>
        <li>
          After your confirmation call, a refundable deposit of ${ASSUMPTIONS.deposit} secures your date. Any extra work found on site (a
          &ldquo;variation&rdquo;) is only done and charged with your approval.
        </li>
      </ul>

      <h2>Installation partners</h2>
      <p>
        Installation is carried out by independent businesses that hold the licences, accreditation and insurance their work requires. They
        are responsible for the quality and safety of the installation and for the compliance paperwork they sign.
      </p>

      <h2>Contacting you</h2>
      <p>
        When you give us your mobile and email, you agree that we and your installation partner may contact you by phone, SMS and email
        about your system, call and installation. Reply STOP to any text to opt out of text messages.
      </p>

      <h2>Your rights</h2>
      <p>
        Nothing in these terms limits your rights under the Australian Consumer Law, including the consumer guarantees that apply to
        products and services.
      </p>

      <h2>Using the website</h2>
      <p>
        Please use the website for its intended purpose and don&apos;t misuse it, interfere with it or try to access other people&apos;s
        information. We may update the website and these terms from time to time.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL.state}, Australia.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-4">
          {LEGAL.email}
        </a>{" "}
        · See also our{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPage>
  );
}
