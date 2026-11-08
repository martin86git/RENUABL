import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallationsPage } from "@/components/design/installations";

export const metadata: Metadata = { title: "Installations", robots: { index: false, follow: false } };

/** Installations: every sold job not yet installed, as a calendar or a list. */
export default async function DesignInstallationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return (
    <DesignShell needsAccount>
      <InstallationsPage initial={view === "list" ? "list" : "calendar"} />
    </DesignShell>
  );
}
