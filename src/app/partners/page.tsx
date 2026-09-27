import type { Metadata } from "next";
import Link from "next/link";
import { PartnerSignup } from "@/components/partners/partner-signup";
import { Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Become a partner",
  description: "Install more solar and battery systems with RENUABL. No lead fees, and payment collected for you.",
};

/** Partner sign-up: public, in the partner portal's dark theme. */
export default function PartnersPage() {
  return (
    <div className="theme-installer min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8 lg:h-[76px]">
        <Link href="/partners" aria-label="RENUABL partners">
          <span className="flex items-baseline gap-3">
            <Wordmark className="text-[19px] lg:text-[22px]" />
            <span className="text-[12px] tracking-wide text-muted">Partners</span>
          </span>
        </Link>
      </header>
      <main>
        <PartnerSignup />
      </main>
    </div>
  );
}
