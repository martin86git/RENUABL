import type { Metadata } from "next";
import { BusinessDemo } from "@/components/design/business-demo";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: "RENUABL Business demo",
  description: "See RENUABL Business at work: a demo account with made-up customers and deals.",
  // A link to hand to people, never one to find by searching.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The RENUABL Business demo (11 Nov 2026, Martin; domain/design/demo.ts): what RENUABL is and what it does, then a name
 * opens a demo account of the visitor's own.
 */
export default async function BusinessDemoPage() {
  const access = await designAccess();
  return <BusinessDemo signedIn={access.state === "ready"} />;
}
