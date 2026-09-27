import Link from "next/link";
import { UserRound } from "lucide-react";
import { MyBottomNav, MyDesktopNav } from "@/components/consumer/my-nav";
import { Wordmark } from "@/components/ui/primitives";

export default function MyLayout({ children }: LayoutProps<"/my">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="RENUABL home">
          <Wordmark />
        </Link>
        <MyDesktopNav />
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2" aria-label="Account">
          <UserRound className="h-5 w-5 text-ink-2" />
        </span>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-28 pt-4 sm:px-8 md:pb-16 lg:px-12 lg:pt-10">{children}</main>
      <MyBottomNav />
    </div>
  );
}
