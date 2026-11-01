import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { UpdatesPage } from "@/components/design/updates-feedback";

export const metadata: Metadata = { title: "Updates", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <DesignShell needsAccount>
      <UpdatesPage />
    </DesignShell>
  );
}
