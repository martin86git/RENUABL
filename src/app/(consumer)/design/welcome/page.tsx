import type { Metadata } from "next";
import { Welcome } from "@/components/design/welcome";

export const metadata: Metadata = {
  title: "Welcome · RENUABL",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Where Stripe sends someone after signing up for a plan (?session_id=…). */
export default async function WelcomePage({ searchParams }: PageProps<"/design/welcome">) {
  const p = await searchParams;
  return <Welcome sessionId={typeof p.session_id === "string" ? p.session_id : null} />;
}
