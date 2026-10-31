import type { Metadata } from "next";
import { DesignShell, PageHead } from "@/components/design/design-shell";
import { SolChat } from "@/components/design/sol-chat";

export const metadata: Metadata = { title: "Sol", robots: { index: false, follow: false } };

/** Sol on a page of his own: the member's conversation, with their reminders and preferences beside it. */
export default function DesignSolPage() {
  return (
    <DesignShell needsAccount>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <PageHead title="Sol" />
        <SolChat />
      </div>
    </DesignShell>
  );
}
