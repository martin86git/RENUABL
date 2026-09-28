import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { INSTALLER_MOBILE_NAV, INSTALLER_NAV } from "@/components/installer/nav";

export const metadata = { title: "More" };

export default function MorePage() {
  const primary = new Set<string>(INSTALLER_MOBILE_NAV.map((n) => n.href));
  const rest = INSTALLER_NAV.filter((n) => !primary.has(n.href));
  return (
    <>
      <h1 className="mb-4 text-[28px] font-normal tracking-[-0.03em]">More</h1>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rest.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-4 px-4 text-[16px]">
              <Icon className="h-5 w-5 text-muted" aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <form action="/api/auth/signout" method="post" className="mt-6">
        <button className="min-h-12 w-full rounded-2xl border border-line text-[16px] text-ink-2">Sign out</button>
      </form>
    </>
  );
}
