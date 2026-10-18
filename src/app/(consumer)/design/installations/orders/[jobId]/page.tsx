import type { Metadata } from "next";
import { OrderPage } from "@/components/design/design-orders";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

/** One signed job's order in the Ordering Station. */
export default async function DesignOrderPage({ params }: PageProps<"/design/installations/orders/[jobId]">) {
  const { jobId } = await params;
  return (
    <DesignShell needsAccount>
      <OrderPage jobId={jobId} />
    </DesignShell>
  );
}
