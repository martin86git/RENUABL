import Link from "next/link";
import { UserRound } from "lucide-react";
import { Wordmark, cn } from "@/components/ui/primitives";

export function ConsumerTopBar({ nav = true, className }: { nav?: boolean; className?: string }) {
  return (
    <header className={cn("mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12", className)}>
      <Link href="/" aria-label="RENUABL home">
        <Wordmark />
      </Link>
      {nav && (
        <nav className="hidden items-center gap-8 text-[14px] text-ink-2 md:flex" aria-label="Main">
          <Link href="/#how" className="hover:text-ink">
            How it works
          </Link>
          <Link href="/my/energy" className="hover:text-ink">
            Energy
          </Link>
          <Link href="/my/support" className="hover:text-ink">
            Support
          </Link>
        </nav>
      )}
      <Link
        href="/my"
        className="flex items-center gap-2 rounded-full px-3 py-2 text-[14px] text-ink-2 hover:bg-surface-2"
        aria-label="My RENUABL"
      >
        <UserRound className="h-5 w-5" />
        <span className="hidden sm:inline">My RENUABL</span>
      </Link>
    </header>
  );
}
