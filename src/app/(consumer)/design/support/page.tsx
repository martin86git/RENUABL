import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignShell } from "@/components/design/design-shell";
import { SupportPage } from "@/components/design/support";

export const metadata: Metadata = { title: "RENUABL support", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <DesignShell needsAccount>
      <Suspense>
        <SupportPage />
      </Suspense>
    </DesignShell>
  );
}
