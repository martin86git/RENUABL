import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/consumer/legal-page";
import { LEGAL } from "@/lib/domain/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {LEGAL.company} trading as {LEGAL.tradingAs} (ABN {LEGAL.abn}), &ldquo;we&rdquo;, respects your privacy. This policy explains what
        personal information we collect, why, and how we look after it, in line with the Privacy Act 1988 (Cth) and the Australian Privacy
        Principles.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, mobile number and email address, when you reserve an installation, book a call or sign in.</li>
        <li>Your home address, and details about your home you give us (roof type, storeys, electricity phase).</li>
        <li>
          Energy figures read from the electricity bill you upload (such as daily usage and prices). We read the bill to size your system
          and don&apos;t keep the file.
        </li>
        <li>Photos you upload of an existing inverter, which we read for its make and model and don&apos;t keep.</li>
        <li>Your answers to the Home Health check, if you take it (see below).</li>
        <li>For installation partners: business, licence, insurance and payment details given when applying or working with us.</li>
        <li>How you use our website, such as the pages you visit and where you came from (for example an advertisement).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To recommend and price a system for your home, and to arrange your confirmation call and installation.</li>
        <li>To match you with an installation partner and share with them what they need to do the job.</li>
        <li>To contact you by phone, SMS and email about your system, call, installation and any service visits.</li>
        <li>To claim rebates on your behalf where you ask us to, and to meet our legal obligations.</li>
        <li>To improve our website and services.</li>
      </ul>

      <h2>Text messages</h2>
      <p>
        We send text messages about your reservation, installation and account, such as call reminders and updates from your installation
        partner. Reply STOP to any message to opt out. We don&apos;t sell or share your mobile number with anyone for their own marketing.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Your matched installation partner, once they accept your job.</li>
        <li>
          Service providers who help us run RENUABL: website hosting and storage, our customer records system, payments, email and SMS
          delivery, mapping and roof data, advertising measurement (Meta), and the service that reads your bill. They may only use your
          information to provide their service to us.
        </li>
        <li>Government bodies and distributors where needed for rebates, grid connection or the law.</li>
      </ul>
      <p>
        Some of these providers store or process information outside Australia, including in the United States. We take reasonable steps to
        make sure they protect it.
      </p>

      <h2>Home Health check</h2>
      <p>
        The Home Health check asks optional questions about your home&apos;s air, water, comfort, sleep and lighting. Every question is
        optional. We use your answers only to recommend healthy home upgrades and to quote the ones you ask about, and we keep them with
        your order so you can see them in My RENUABL.
      </p>
      <p>
        One question asks whether anyone in the home has allergies or sensitive breathing. That&apos;s health information, so we only record
        your answer if you tick to agree, we use it only for your recommendations, and we don&apos;t share it with anyone, including our
        advertising, customer records or installation partners. You can ask us to delete it at any time.
      </p>

      <h2>Advertising</h2>
      <p>
        We advertise on Facebook and Instagram and use the Meta Pixel to see whether our ads work. It runs only on our public pages and the
        steps to price a system (never on the Home Health check), and tells Meta when a page is visited and when a bill has been read. We
        never send Meta your bill, its contents, your address, name, email, phone number or prices. Meta may use cookies to link these
        visits to your Facebook or Instagram account; you can manage this in your Meta ad settings or by blocking cookies in your browser.
      </p>

      <h2>Keeping it safe</h2>
      <p>
        We store information with reputable providers, limit who can see it, and keep sign-in links and sessions in a protected form. We
        keep information only as long as we need it for the purposes above or as the law requires.
      </p>

      <h2>Accessing and correcting your information</h2>
      <p>
        You can ask to see or correct the personal information we hold about you, or ask us to delete it, by emailing{" "}
        <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-4">
          {LEGAL.email}
        </a>
        . We&apos;ll respond within 30 days.
      </p>

      <h2>Complaints</h2>
      <p>
        If you&apos;re unhappy with how we&apos;ve handled your information, please email us first and we&apos;ll work to put it right. If
        you&apos;re still not satisfied, you can contact the Office of the Australian Information Commissioner (oaic.gov.au).
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.company} trading as {LEGAL.tradingAs}, {LEGAL.state}, Australia ·{" "}
        <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-4">
          {LEGAL.email}
        </a>{" "}
        · See also our{" "}
        <Link href="/terms" className="text-ink underline underline-offset-4">
          Terms of Use
        </Link>
        .
      </p>
    </LegalPage>
  );
}
