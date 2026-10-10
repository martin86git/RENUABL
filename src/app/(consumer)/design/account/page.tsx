import type { Metadata } from "next";
import { DesignAccountPage } from "@/components/design/design-account";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = {
  title: "Your account · Roof designer",
  robots: { index: false, follow: false },
};

/** A business's name and the people in it. */
export default function DesignAccountRoute() {
  return (
    <DesignShell>
      <DesignAccountPage />
    </DesignShell>
  );
}
