import { ChevronDown, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import { Wordmark, cn } from "@/components/ui/primitives";

export const CONSUMER_NAV = [
  { href: "/", label: "Home" },
  { href: "/my/energy", label: "Energy" },
  { href: "/my/savings", label: "Savings" },
  { href: "/my/upgrades", label: "Upgrades" },
  { href: "/my/support", label: "Support" },
];

/** Desktop top bar: wordmark, simple navigation, account. */
export function ConsumerTopBar({ className, account = "Sign in" }: { className?: string; account?: string }) {
  return (
    <header className={cn("mx-auto flex h-[76px] w-full max-w-[1440px] items-center gap-12 px-5 sm:px-8 lg:px-10", className)}>
      <Link href="/" aria-label="RENUABL home">
        <Wordmark className="text-[22px]" />
      </Link>
      <nav className="hidden items-center gap-9 text-[13px] text-ink-2 lg:flex" aria-label="Main">
        {CONSUMER_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
      <Link href="/my" className="ml-auto flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink">
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
export function MobileHeader({ account = false, className }: { account?: boolean; className?: string }) {
  return (
    <header className={cn("flex h-14 items-center justify-between px-5 lg:hidden", className)}>
      <button type="button" aria-label="Menu" className="-ml-1 grid h-9 w-9 place-items-center">
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <Link href="/" aria-label="RENUABL home">
        <Wordmark className="text-[19px] tracking-[0.12em]" />
      </Link>
      {account ? (
        <Link href="/my/profile" aria-label="Profile" className="-mr-1 grid h-9 w-9 place-items-center">
          <UserRound className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      ) : (
        <span className="w-9" />
      )}
    </header>
  );
}
