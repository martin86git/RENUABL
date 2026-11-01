import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ComingNext } from "@/components/design/kind-home";

export const metadata: Metadata = { title: "Inspections", robots: { index: false, follow: false } };

/** An inspector's inspections, nominated by the installers it is connected to (business-kind.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ComingNext
        title="Inspections"
        lead="The jobs installers nominate you to inspect will land here."
        points={[
          "Each job read only: the address, the system, the string drawing, and every installation and handover photo.",
          "The customer's name and phone to arrange access; never their email.",
          "Booked, passed or defects found, with your notes and your certificate, seen by the installer and the retailer.",
        ]}
      />
    </DesignShell>
  );
}
