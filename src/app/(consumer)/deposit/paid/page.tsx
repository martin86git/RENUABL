import { Check } from "lucide-react";
import type { Metadata } from "next";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { ButtonLink } from "@/components/ui/primitives";
import { parseReference } from "@/lib/domain/deposit";

export const metadata: Metadata = { title: "Deposit received", robots: { index: false } };

export default async function DepositPaidPage({ searchParams }: PageProps<"/deposit/paid">) {
  const params = await searchParams;
  const reference = parseReference(typeof params.ref === "string" ? params.ref : null);

  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest text-white">
          <Check className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <h1 className="mt-6 text-[32px] font-normal tracking-[-0.035em]">Your date is locked in.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Thanks, your deposit has been received{reference ? ` for reservation ${reference}` : ""}. Stripe has emailed you a receipt, and
          we&apos;ll text you the day before your installation.
        </p>
        <ButtonLink href="/my" size="lg" className="mt-8 w-full sm:w-auto">
          Go to My RENUABL
        </ButtonLink>
      </main>
    </div>
  );
}
