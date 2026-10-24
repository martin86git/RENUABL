import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignHome } from "@/components/design/design-home";

export const metadata: Metadata = {
  title: "For solar installers and retailers",
  description: "Design a roof, see the quote build beside it, and keep every customer and job moving from lead to installed.",
  // In development: kept out of search until it's ready to be found.
  robots: { index: false, follow: false },
};

/** The product's front page with the way in; signed in, the business's overview. */
export default function DesignHomePage() {
  // The overview reads which view is open from the address.
  return (
    <Suspense>
      <DesignHome />
    </Suspense>
  );
}
