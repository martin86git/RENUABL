import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { LEARN_NAME } from "@/lib/domain/guides";
import { Wordmark, cn } from "@/components/ui/primitives";
import { MobileMenu } from "./mobile-menu";

/**
 * Desktop top bar: just the wordmark and account. Deliberately no menu of
 * links — RENUABL should feel like a guided product, not a traditional website.
 */
export function ConsumerTopBar({
  className,
  account = "Log in",
  partners = false,
}: {
  className?: string;
  account?: string;
  /** "Learn with Revo" and "Become a partner" (home page only, not mid-purchase). */
  partners?: boolean;
}) {
  return (
    <header className={cn("mx-auto flex h-[76px] w-full max-w-[1440px] items-center gap-12 px-5 sm:px-8 lg:px-10", className)}>
      <Link href="/" aria-label="RENUABL home">
        <Wordmark className="text-[22px]" />
      </Link>
      {partners && (
        <Link href="/learn" className="ml-auto text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          {LEARN_NAME}
        </Link>
      )}
      {partners && (
        <Link href="/partners" className=" text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Become a partner
        </Link>
      )}
      <Link href="/login" className={cn("flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink", !partners && "ml-auto")}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2">
          <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        <span className="hidden sm:inline">{account}</span>
        <ChevronDown className="hidden h-4 w-4 sm:block" strokeWidth={1.5} />
      </Link>
    </header>
  );
}

/** Mobile header: menu, centred wordmark, optional account. */
export function MobileHeader({
  account = false,
  partners = false,
  className,
}: {
  account?: boolean;
  /** A small "Log in" link top right (home page), for customers and partners. */
  partners?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("flex h-14 items-center justify-between px-5 lg:hidden", className)}>
      <MobileMenu />
      <Link href="/" aria-label="RENUABL home">
        <Wordmark className="text-[19px] tracking-[0.12em]" />
      </Link>
      {account ? (
        <Link href="/my/profile" aria-label="Profile" className="tap-area -mr-1 grid h-9 w-9 place-items-center">
          <UserRound className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      ) : partners ? (
        <Link href="/login" className="tap-area -mr-1 text-[13px] text-ink-2">
          Log in
        </Link>
      ) : (
        <span className="w-9" />
      )}
    </header>
  );
}
