import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MarketingNav } from "@/components/admin/marketing/marketing-nav";
import { PageHeader } from "@/components/installer/bits";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";

/** RENUABL's own go-to-market (staff only): contacts, campaigns, sequences and settings, in RENUABL Business's look. */
export default async function MarketingLayout({ children }: LayoutProps<"/admin/marketing">) {
  await connection();
  if (!dbConfigured()) return <PageHeader title="Marketing" subtitle="Connect the database (DATABASE_URL) first." />;
  const session = await currentSession();
  if (session?.role !== "staff") redirect("/login?as=partner&next=/admin/marketing");
  return (
    <>
      <Link href="/admin" className="tap-area relative mb-4 inline-block text-[13px] text-muted hover:text-ink">
        ← Staff home
      </Link>
      <div className="theme-studio -mx-5 rounded-[28px] px-5 py-6 sm:px-8">
        <MarketingNav />
        {children}
      </div>
    </>
  );
}
