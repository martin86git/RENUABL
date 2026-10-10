import type { Metadata } from "next";
import { DesignAccountGate, DesignAccountPage } from "@/components/design/design-account";

export const metadata: Metadata = {
  title: "Your account · Roof designer",
  robots: { index: false, follow: false },
};

/** A business's name and the people in it. */
export default function DesignAccountRoute() {
  return (
    <DesignAccountGate>
      <DesignAccountPage />
    </DesignAccountGate>
  );
}
