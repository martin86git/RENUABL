import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/consumer/legal-page";
import { LEGAL } from "@/lib/domain/legal";
import { WHOOP_ENDS, WHOOP_OFFER } from "@/lib/domain/whoop-offer";

export const metadata: Metadata = { title: "October offer terms", alternates: { canonical: "/offer-terms" } };

/** Terms for the October WHOOP offer. Drafted for launch: to be reviewed before relying on it. */
export default function OfferTermsPage() {
  const value = `$${WHOOP_OFFER.value}`;
  return (
    <LegalPage title="October offer terms">
      <p>
        These terms apply to the free {WHOOP_OFFER.product} {WHOOP_OFFER.name.toLowerCase()} from {LEGAL.company} trading as{" "}
        {LEGAL.tradingAs} (ABN {LEGAL.abn}), &ldquo;we&rdquo;.
      </p>

      <h2>The offer</h2>
      <ul>
        <li>
          A {WHOOP_OFFER.product} with a {WHOOP_OFFER.membership}, valued at {value} (the recommended retail price in Australia when the
          offer was published).
        </li>
        <li>It comes in {WHOOP_OFFER.colour} only. Other colours, bands and accessories aren&apos;t included and can&apos;t be swapped.</li>
        <li>One per order.</li>
        <li>No cash alternative, and it can&apos;t be exchanged or transferred.</li>
      </ul>

      <h2>Who&apos;s eligible</h2>
      <ul>
        <li>Orders that include a home battery.</li>
        <li>
          Reservations made from 1 October to {WHOOP_ENDS} (Melbourne time), while stocks last: {WHOOP_OFFER.cap} are available. A claim is
          made when the reservation is confirmed. The offer ends at the end of {WHOOP_ENDS}, or earlier once all {WHOOP_OFFER.cap} have been
          claimed, and is then removed from our website.
        </li>
        <li>If an order is cancelled before installation, its claim is released and may go to another customer.</li>
      </ul>

      <h2>Delivery</h2>
      <ul>
        <li>We ship your {WHOOP_OFFER.product} after your system is installed. You can see its status in My RENUABL.</li>
        <li>You set up your WHOOP account and membership with WHOOP, under WHOOP&apos;s own terms.</li>
        <li>
          After 12 months, the membership renews at your own cost unless you cancel it with WHOOP. We&apos;re not responsible for WHOOP
          memberships or charges.
        </li>
      </ul>

      <h2>Everything else</h2>
      <ul>
        <li>The offer doesn&apos;t change your system&apos;s price, your rebates or your right to cancel under our Terms of Use.</li>
        <li>
          We may end the offer early once {WHOOP_OFFER.cap} have been claimed, or if we can no longer supply it (we&apos;ll honour claims
          already made).
        </li>
        <li>WHOOP is a trademark of its owner. This offer is made by {LEGAL.tradingAs} and isn&apos;t sponsored or endorsed by WHOOP.</li>
      </ul>

      <p>
        Questions? Email{" "}
        <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-4">
          {LEGAL.email}
        </a>
        . See also our{" "}
        <Link href="/terms" className="text-ink underline underline-offset-4">
          Terms of Use
        </Link>
        .
      </p>
    </LegalPage>
  );
}
