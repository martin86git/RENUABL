import type { Metadata } from "next";
import { DesignShell, PageHead } from "@/components/design/design-shell";
import { TeamChatPage } from "@/components/design/team-chat";

export const metadata: Metadata = { title: "Team chat", robots: { index: false, follow: false } };

/** The team chat on a page of its own: the channels, the people and the room. */
export default function DesignTeamPage() {
  return (
    <DesignShell needsAccount>
      <div className="mx-auto w-full max-w-6xl space-y-4 max-sm:space-y-0">
        {/* On a phone the chat is the page (23 Nov 2026, Martin): no heading over it. */}
        <div className="max-sm:hidden">
          <PageHead title="Team chat" />
        </div>
        <TeamChatPage />
      </div>
    </DesignShell>
  );
}
