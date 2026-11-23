import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignHome } from "@/components/design/design-home";

export const metadata: Metadata = { title: "Calendar", robots: { index: false, follow: false } };

/** The calendar, from the top bar beside email (23 Nov 2026, Martin: it left Today's switch). */
export default function Page() {
  return (
    <Suspense>
      <DesignHome only="calendar" />
    </Suspense>
  );
}
