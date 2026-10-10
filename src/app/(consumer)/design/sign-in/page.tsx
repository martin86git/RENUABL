import type { Metadata } from "next";
import { DesignSignIn } from "@/components/design/design-account";

export const metadata: Metadata = {
  title: "Sign in · Roof designer",
  robots: { index: false, follow: false },
};

/** Sign in to the roof designer with a one-time email link: /design/sign-in?error=expired after a link that no longer works. */
export default async function DesignSignInPage({ searchParams }: PageProps<"/design/sign-in">) {
  const p = await searchParams;
  return <DesignSignIn expired={p.error === "expired"} />;
}
