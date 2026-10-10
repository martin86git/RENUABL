import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersPage } from "@/components/design/design-customers";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };

/** A business's customers. */
export default function DesignCustomersPage() {
  return (
    <DesignShell needsAccount>
      <Suspense>
        <CustomersPage />
      </Suspense>
    </DesignShell>
  );
}
