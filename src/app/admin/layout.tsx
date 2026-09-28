import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = { title: { default: "Staff", template: "%s · RENUABL staff" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="theme-installer min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex h-[72px] max-w-6xl items-center gap-4 px-5">
        <Link href="/admin" aria-label="Staff home">
          <Wordmark className="text-[19px]" />
        </Link>
        <span className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-muted">Staff</span>
        <form action="/api/auth/signout" method="post" className="ml-auto">
          <button className="tap-area relative text-[13px] text-ink-2 hover:text-ink">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16">{children}</main>
    </div>
  );
}
