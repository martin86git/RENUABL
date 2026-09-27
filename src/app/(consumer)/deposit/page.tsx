import type { Metadata } from "next";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { DepositPay } from "@/components/consumer/deposit-pay";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { DEPOSIT, parseReference } from "@/lib/domain/deposit";
import { formatCurrency } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Lock in your date", robots: { index: false } };

/** Linked from RENUABL after the confirmation call: /deposit?ref=RN-1234&email=... */
export default async function DepositPage({ searchParams }: PageProps<"/deposit">) {
  const params = await searchParams;
  const reference = parseReference(typeof params.ref === "string" ? params.ref : null);
  const email = typeof params.email === "string" ? params.email : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        {reference ? (
          <>
            <p className="text-[13px] text-muted">Reservation {reference}</p>
            <h1 className="mt-2 text-[34px] font-normal leading-tight tracking-[-0.035em]">Lock in your date.</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Thanks for confirming your system. A {formatCurrency(DEPOSIT.amount)} deposit secures your installation date and your price.
            </p>
            <Card className="mt-6 p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[15px] text-ink">Refundable deposit</p>
                <p className="text-[22px] tabular-nums text-ink">{formatCurrency(DEPOSIT.amount)}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-muted">
                <li>Comes off your final price. The balance is due once your system is switched on.</li>
                <li>Fully refundable until your installer confirms the site visit.</li>
              </ul>
              <div className="mt-5">
                <DepositPay reference={reference} email={email} amount={DEPOSIT.amount} />
              </div>
            </Card>
          </>
        ) : (
          <>
            <h1 className="text-[30px] font-normal tracking-[-0.035em]">This link isn&apos;t valid.</h1>
            <p className="mt-2 text-[15px] text-muted">
              Please use the deposit link we sent you, or reply to our message and we&apos;ll send a new one.
            </p>
            <ButtonLink href="/" size="lg" className="mt-6">
              Back to RENUABL
            </ButtonLink>
          </>
        )}
      </main>
    </div>
  );
}
