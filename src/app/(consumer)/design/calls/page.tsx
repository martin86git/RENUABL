import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { CallLogPage } from "@/components/design/call-log";

export const metadata: Metadata = { title: "Calls", robots: { index: false, follow: false } };

/** The calls Sol has lined up and every call on the deals this member may see (domain/design/call-log.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <CallLogPage />
    </DesignShell>
  );
}
