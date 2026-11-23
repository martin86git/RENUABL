import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignHome } from "@/components/design/design-home";

export const metadata: Metadata = { title: "Feed", robots: { index: false, follow: false } };

/** The deal feed, Deals' landing view (23 Nov 2026, Martin: it left Today's switch). */
export default function Page() {
  return (
    <Suspense>
      <DesignHome only="feed" />
    </Suspense>
  );
}
