import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { NewsPage } from "@/components/design/industry-news";

export const metadata: Metadata = { title: "Industry news", robots: { index: false, follow: false } };

/** The industry feed on a page of its own: Sol's stories and businesses' posts, for every kind of business (Today has it as a tab). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <NewsPage />
    </DesignShell>
  );
}
