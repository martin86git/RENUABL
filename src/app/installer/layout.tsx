import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREVIEW_MODE } from "@/lib/config";
import { InstallerShell } from "@/components/installer/installer-shell";
import { getCurrentInstaller, getCurrentUser } from "@/lib/services/installer";

export const metadata: Metadata = {
  title: { default: "Installer portal", template: "%s · RENUABL Installer" },
};

export default function InstallerLayout({ children }: LayoutProps<"/installer">) {
  // The installer portal runs on sample data: it isn't on the live site until it's connected.
  if (!PREVIEW_MODE) notFound();
  const installer = getCurrentInstaller();
  return (
    <div className="theme-installer min-h-dvh bg-canvas text-ink">
      <InstallerShell company={installer.name} user={getCurrentUser().name}>
        {children}
      </InstallerShell>
    </div>
  );
}
