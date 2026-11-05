import type { Metadata } from "next";
import { SalesPage } from "@/components/design/sales-page";
import { BUSINESS_LINK_SHOWN } from "@/lib/domain/business-link";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: "RENUABL Business: for solar retailers and installers",
  description: "Design, quote, sell, approve, book, order, install and get paid, in one place built for Australian solar businesses.",
  alternates: { canonical: "/business" },
  // Out of search until RENUABL Business launches (business-link.ts); the page still opens for anyone given the address.
  ...(BUSINESS_LINK_SHOWN ? {} : { robots: { index: false, follow: false } }),
};

/**
 * RENUABL Business's front door (3 Nov 2026, Martin: RENUABL is a network of two sides, RENUABL Home for homeowners
 * at / and RENUABL Business for retailers and installers here). Everyone sees the page, signed in or not (Martin: he
 * couldn't see it while signed in); a business already signed in gets "Open RENUABL" in place of Sign in.
 */
export default async function BusinessPage() {
  const access = await designAccess();
  return <SalesPage signedIn={access.state === "ready"} />;
}
