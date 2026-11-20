import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { RoutinesPage } from "@/components/design/routines";

export const metadata: Metadata = { title: "Routines", robots: { index: false, follow: false } };

/** Routines: every agent's routine as a flow, each step changed where it can be (components/design/routines.tsx). */
export default function DesignRoutinesPage() {
  return (
    <DesignShell needsAccount>
      <RoutinesPage />
    </DesignShell>
  );
}
