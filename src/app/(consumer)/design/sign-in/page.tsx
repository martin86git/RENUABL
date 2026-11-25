import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignSignIn } from "@/components/design/design-account";
import { signedOutSignInPage } from "@/lib/server/design-sign-in-page";

export const metadata: Metadata = {
  title: "Sign in · Roof designer",
  robots: { index: false, follow: false },
};

/** Sign in to the roof designer: ?error=expired after a link that no longer works, google or google-off after Google. */
export default async function DesignSignInPage({ searchParams }: PageProps<"/design/sign-in">) {
  const p = await searchParams;
  // The device's own business sign-in page, unless a link has just failed and this page says why.
  if (typeof p.error !== "string") {
    const team = await signedOutSignInPage();
    if (team) redirect(team);
  }
  return <DesignSignIn error={typeof p.error === "string" ? p.error : undefined} />;
}
