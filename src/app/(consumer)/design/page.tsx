import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DesignHome } from "@/components/design/design-home";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: "For solar installers and retailers",
  description: "Design a roof, see the quote build beside it, and keep every customer and job moving from lead to installed.",
  // In development: kept out of search until it's ready to be found.
  robots: { index: false, follow: false },
};

/**
 * The product's front page with the way in; signed in, the business's overview. A designer arriving from outside
 * (signing in, a bookmark, a new tab) lands on the design tool; Today is still a press away inside the app.
 */
export default async function DesignHomePage() {
  const access = await designAccess();
  if (access.state === "ready" && access.member.role === "designer") {
    const from = (await headers()).get("referer") ?? "";
    const inside = (() => {
      try {
        const path = new URL(from).pathname;
        return path.startsWith("/design/") && !path.startsWith("/design/sign-in");
      } catch {
        return false;
      }
    })();
    if (!inside) redirect("/design/roof");
  }
  // The overview reads which view is open from the address.
  return (
    <Suspense>
      <DesignHome />
    </Suspense>
  );
}
