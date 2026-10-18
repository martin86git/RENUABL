import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignShell } from "@/components/design/design-shell";
import { DesignStudio } from "@/components/design/design-studio";

export const metadata: Metadata = {
  title: "Design tool",
  description: "Lay out solar panels on a roof seen from above, and check the strings against the inverter.",
  robots: { index: false, follow: false },
};

/**
 * The roof designer: /design/roof, or /design/roof?job=… to design the roof of a customer's job. With &embed=1 it is
 * shown bare, without the sections, as it is inside a deal's design drawer.
 */
export default async function DesignRoofPage({ searchParams }: PageProps<"/design/roof">) {
  const embed = (await searchParams).embed === "1";
  return (
    <DesignShell compact bare={embed}>
      <Suspense>
        <DesignStudio />
      </Suspense>
    </DesignShell>
  );
}
