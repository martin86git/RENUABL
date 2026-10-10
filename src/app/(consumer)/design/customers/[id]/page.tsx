import type { Metadata } from "next";
import { CustomerPage } from "@/components/design/design-customers";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Customer", robots: { index: false, follow: false } };

/** One customer: their details, jobs and history. */
export default async function DesignCustomerPage({ params }: PageProps<"/design/customers/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <CustomerPage id={id} />
    </DesignShell>
  );
}
