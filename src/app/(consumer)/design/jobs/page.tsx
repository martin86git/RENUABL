import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ComingNext } from "@/components/design/kind-home";

export const metadata: Metadata = { title: "Jobs", robots: { index: false, follow: false } };

/** An installer's jobs from the retailers it is connected to (business-kind.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ComingNext
        title="Jobs"
        lead="The jobs the retailers you install for send you will land here, instead of an emailed link."
        points={[
          "Each job's card: the day, the address, the customer's name and phone, the system, the panel layout and string drawings.",
          "One thread of notes and photos with the retailer, as the job card has today.",
          "Jobs you win on the Marketplace, once it opens.",
          "Nominate the electrical inspector for a job, who then sees its design and your photos.",
        ]}
      />
    </DesignShell>
  );
}
