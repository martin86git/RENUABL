import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { DesignSettings } from "@/components/design/design-settings";

export const metadata: Metadata = {
  title: "Prices and settings · Roof designer",
  robots: { index: false, follow: false },
};

/** A business's price lists, parts, installation rates and margin for the roof designer's quote. */
export default function DesignSettingsPage() {
  // The gate settles who is signed in (and brings a device's work into a new account) before the page loads its data.
  return (
    <DesignShell>
      <DesignSettings />
    </DesignShell>
  );
}
