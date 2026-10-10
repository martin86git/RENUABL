import type { Metadata } from "next";
import { DesignStudio } from "@/components/design/design-studio";

export const metadata: Metadata = {
  title: "Roof designer",
  description: "Lay out solar panels on a roof seen from above, and check the strings against the inverter.",
  // In development: kept out of search until it's ready to be found.
  robots: { index: false, follow: false },
};

/** The roof designer as a product of its own. */
export default function DesignPage() {
  return <DesignStudio />;
}
