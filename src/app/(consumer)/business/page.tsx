import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SalesPage } from "@/components/design/sales-page";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: "RENUABL Business: for solar retailers and installers",
  description: "Design, quote, sell, approve, book, order, install and get paid, in one place built for Australian solar businesses.",
  alternates: { canonical: "/business" },
};

/**
 * RENUABL Business's front door (3 Nov 2026, Martin: RENUABL is a network of two sides, RENUABL Home for homeowners
 * at / and RENUABL Business for retailers and installers here). A business already signed in goes straight to its app.
 */
export default async function BusinessPage() {
  const access = await designAccess();
  if (access.state === "ready") redirect("/design");
  return <SalesPage />;
}
