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
        optional. We use your answers only to suggest ideas for your home and, added up across all customers, to decide which healthy home
        products to offer, and we keep them with your order so you can see them in My RENUABL.
      </p>
      <p>
        One question asks whether anyone in the home has allergies or sensitive breathing. That&apos;s health information, so we only record
        your answer if you tick to agree, we use it only for your recommendations, and we don&apos;t share it with anyone, including our
        advertising, customer records or installation partners. You can ask us to delete it at any time.
      </p>

      <h2>Gmail, Google Calendar and Outlook (RENUABL Business)</h2>
      <p>
        People at solar businesses who use RENUABL Business can choose to connect their own Gmail, Google Calendar or Outlook calendar. This
        section explains what we do with that information. It applies only to people who connect one of these accounts.
      </p>
      <ul>
        <li>
          <strong>Signing in with Google</strong>: we receive your email address, and use it only to sign you in.
        </li>
        <li>
          <strong>Gmail</strong>: we read the emails in your inbox and their attachments, and change their labels when you ask us to
          (marking an email read or unread, or archiving it). We never send, delete or forward your email.
        </li>
        <li>
          <strong>Google Calendar and Outlook</strong>: we read your calendar events. We never create, change or delete them.
        </li>
      </ul>
      <p>We use this information only to provide these features to you, inside RENUABL:</p>
      <ul>
        <li>showing you your own inbox and calendar;</li>
        <li>showing which of your business&apos;s customers an email is from;</li>
        <li>marking an email read or unread, or archiving it, when you ask;</li>
        <li>
          when you press Summarise or Draft a reply on an email, sending that email to our assistant, Sol, which is powered by
          Anthropic&apos;s Claude, to write the summary or draft you asked for.
        </li>
      </ul>
      <p>
        <strong>What we keep.</strong> We keep the sign-in tokens that let us reach your account, encrypted. We don&apos;t keep your emails,
        attachments or calendar events, and we don&apos;t keep what Sol writes about them. The one exception: if you tag a teammate on an
        email, we keep a copy of that email&apos;s sender, subject, date and text (up to 8,000 characters) with your notes, so the teammate
        can read it.
      </p>
      <p>
        <strong>What we never do.</strong> We don&apos;t sell this information, use it for advertising, or use it to train AI models. We
        share it only with the providers needed to run these features (our hosting and database, and Anthropic for Sol), under terms that
        don&apos;t allow them to use it for anything else. Our staff don&apos;t read it unless you ask us to for a specific problem,
        it&apos;s needed for security, or the law requires it.
      </p>
      <p>
        <strong>Disconnecting.</strong> You can disconnect any account at any time in RENUABL, or in your Google or Microsoft account
        settings. Disconnecting deletes our tokens and asks Google or Microsoft to cancel our access. To have copies of emails you shared
        with teammates deleted, email us.
      </p>
      <p>
        RENUABL&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-4"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Advertising</h2>
      <p>
        We advertise on Facebook, Instagram and Google, and use the Meta Pixel and the Google tag to see whether our ads work. They run only
        on our public pages and the steps to price a system (never on the Home Health check), and tell Meta and Google when a page is
        visited, when a bill has been read or a spend range chosen, when you ask us to follow up or book a call, and when an installation
        date is reserved. We never send them your bill, its contents, your address, name, email, phone number or prices. Meta and Google may
        use cookies to link these visits to your accounts with them; you can manage this in your Meta and Google ad settings or by blocking
        cookies in your browser.
      </p>
      <p>
        We also use HubSpot, where we keep our customer records, and its tracking code on the same pages. It uses cookies to show us which
        of those pages someone visited before they got in touch, so we can help them better. You can block these cookies in your browser.
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
