import type { Metadata } from "next";
import { ComplianceBanner } from "@/components/installer/compliance-banner";
import { InstallerShell } from "@/components/installer/installer-shell";
import Link from "next/link";
import { getCurrentInstaller, getCurrentUser, isDemo } from "@/lib/services/installer";

export const metadata: Metadata = {
  title: { default: "Installer portal", template: "%s · RENUABL Installer" },
  robots: { index: false },
};

export default async function InstallerLayout({ children }: LayoutProps<"/installer">) {
  // Signed-in partners see their own jobs; the sample portal is preview only (requirePortal sends everyone else to sign in).
  const installer = await getCurrentInstaller();
  const user = await getCurrentUser();
  return (
    <div className="theme-installer min-h-dvh bg-canvas text-ink">
      <InstallerShell company={installer.name} user={user.name}>
        {(await isDemo()) && (
          <p className="mb-4 rounded-2xl border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2">
            Sample portal with example jobs.{" "}
            <Link href="/login?as=partner" className="text-ink underline underline-offset-4">
              Sign in as a partner
            </Link>{" "}
            to see your own.
          </p>
        )}
        <ComplianceBanner />
        {children}
      </InstallerShell>
    </div>
  );
}
