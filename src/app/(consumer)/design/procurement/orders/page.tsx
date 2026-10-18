import type { Metadata } from "next";
import { OrdersPage } from "@/components/design/design-orders";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Ordering Station", robots: { index: false, follow: false } };

/** Every signed job's order. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <OrdersPage />
    </DesignShell>
  );
}
