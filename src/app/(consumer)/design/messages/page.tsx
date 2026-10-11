import type { Metadata } from "next";
import { MessagesPage } from "@/components/design/chat-panel";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

/** What a business's customers have written to it from their proposals, each opening its deal's conversation. */
export default function DesignMessagesPage() {
  return (
    <DesignShell needsAccount>
      <MessagesPage />
    </DesignShell>
  );
}
