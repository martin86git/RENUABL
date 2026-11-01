import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { FeedbackPage } from "@/components/design/updates-feedback";

export const metadata: Metadata = { title: "Feedback", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <DesignShell needsAccount>
      <FeedbackPage />
    </DesignShell>
  );
}
