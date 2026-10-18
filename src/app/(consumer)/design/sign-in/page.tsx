import type { Metadata } from "next";
import { DesignSignIn } from "@/components/design/design-account";

export const metadata: Metadata = {
  title: "Sign in · Roof designer",
  robots: { index: false, follow: false },
};

/** Sign in to the roof designer: ?error=expired after a link that no longer works, google or google-off after Google. */
export default async function DesignSignInPage({ searchParams }: PageProps<"/design/sign-in">) {
  const p = await searchParams;
  return <DesignSignIn error={typeof p.error === "string" ? p.error : undefined} />;
}
