import type { Metadata } from "next";
import { DesignAccountGate } from "@/components/design/design-account";
import { DesignStudio } from "@/components/design/design-studio";

export const metadata: Metadata = {
  title: "Roof designer",
  description: "Lay out solar panels on a roof seen from above, and check the strings against the inverter.",
  // In development: kept out of search until it's ready to be found.
  robots: { index: false, follow: false },
};

/** The roof designer as a product of its own. */
export default function DesignPage() {
  // The gate settles who is signed in (and brings a device's work into a new account) before the page loads its data.
  return (
    <DesignAccountGate>
      <DesignStudio />
    </DesignAccountGate>
  );
}
