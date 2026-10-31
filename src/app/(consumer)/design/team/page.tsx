import type { Metadata } from "next";
import { DesignShell, PageHead } from "@/components/design/design-shell";
import { TeamChatPage } from "@/components/design/team-chat";

export const metadata: Metadata = { title: "Team chat", robots: { index: false, follow: false } };

/** The team chat on a page of its own: the channels, the people and the room. */
export default function DesignTeamPage() {
  return (
    <DesignShell needsAccount>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <PageHead title="Team chat" />
        <TeamChatPage />
      </div>
    </DesignShell>
  );
}
