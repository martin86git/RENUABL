import type { Metadata } from "next";
import { InvoicesPage } from "@/components/design/design-invoices";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Installer Invoices", robots: { index: false, follow: false } };

/** Each signed job's installation allowance against the installer's invoice. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <InvoicesPage />
    </DesignShell>
  );
}
