import type { Metadata } from "next";
import { DesignSettings } from "@/components/design/design-settings";

export const metadata: Metadata = {
  title: "Prices and settings · Roof designer",
  robots: { index: false, follow: false },
};

/** A business's price lists, parts, installation rates and margin for the roof designer's quote. */
export default function DesignSettingsPage() {
  return <DesignSettings />;
}
