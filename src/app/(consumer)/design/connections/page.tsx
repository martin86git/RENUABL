import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ComingNext } from "@/components/design/kind-home";

export const metadata: Metadata = { title: "Connections", robots: { index: false, follow: false } };

/** The businesses this one works with (business-kind.ts): retailers, installers and inspectors. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ComingNext
        title="Connections"
        lead="Find the businesses you already work with and connect, like a friend request."
        points={[
          "Search the directory by business name, ABN or suburb. Only businesses that choose to be listed appear.",
          "Send a request; they accept or decline. Either of you can disconnect.",
          "A connection shares nothing by itself: jobs pass between you one at a time, and disconnecting ends access to them.",
        ]}
      />
    </DesignShell>
  );
}
