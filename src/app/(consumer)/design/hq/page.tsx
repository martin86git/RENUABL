import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignShell } from "@/components/design/design-shell";
import { RenuablHq } from "@/components/design/renuabl-hq";

export const metadata: Metadata = { title: "RENUABL admin", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <DesignShell needsAccount>
      <Suspense>
        <RenuablHq />
      </Suspense>
    </DesignShell>
  );
}
