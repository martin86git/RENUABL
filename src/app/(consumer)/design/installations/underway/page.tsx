import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallationsPhasePage } from "@/components/design/install-lists";

export const metadata: Metadata = { title: "In the works", robots: { index: false, follow: false } };

/** Installations in the works: the day has come, the paperwork isn't done. */
export default function InstallationsInTheWorksPage() {
  return (
    <DesignShell needsAccount>
      <InstallationsPhasePage phase="in-works" />
    </DesignShell>
  );
}
