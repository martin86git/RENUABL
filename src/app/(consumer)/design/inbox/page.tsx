import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignShell } from "@/components/design/design-shell";
import { InboxPage } from "@/components/design/inbox";

export const metadata: Metadata = { title: "Email", robots: { index: false, follow: false } };

/** This member's own Gmail inbox, read only (domain/design/inbox.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <Suspense>
        <InboxPage />
      </Suspense>
    </DesignShell>
  );
}
