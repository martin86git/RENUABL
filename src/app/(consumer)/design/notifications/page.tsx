import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { NotificationsPage } from "@/components/design/design-notifications";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

/** The member's own inbox: each @mention of them in a deal's note. */
export default function DesignNotificationsPage() {
  return (
    <DesignShell needsAccount>
      <NotificationsPage />
    </DesignShell>
  );
}
