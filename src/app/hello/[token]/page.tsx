import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HelloPage } from "@/components/design/hello-page";
import { isHelloToken } from "@/lib/domain/design/first-contact";
import { helloView } from "@/lib/server/design-hello";

/** The business's page, not RENUABL's: kept out of search, and the address (the key) never passed on. */
export const metadata: Metadata = {
  title: { absolute: "Your home" },
  description: "A first look at solar for your home.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Your home", description: "A first look at solar for your home.", locale: "en_AU" },
  twitter: { card: "summary", title: "Your home", description: "A first look at solar for your home." },
};

/** A new lead's own page at its private link (domain/design/first-contact.ts). No sign-in; a link never made is not found. */
export default async function HelloLinkPage({ params }: PageProps<"/hello/[token]">) {
  await connection();
  const { token } = await params;
  if (!isHelloToken(token)) notFound();
  const view = await helloView(token).catch(() => null);
  if (!view) notFound();
  return <HelloPage token={token} view={view} />;
}
