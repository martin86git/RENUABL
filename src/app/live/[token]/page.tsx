import type { Metadata } from "next";
import { LiveView } from "@/components/design/live-view";

/** Kept out of search, and never tells a page it links to where it came from: the address is the key to it. */
export const metadata: Metadata = {
  title: { absolute: "Your design, live" },
  description: "Your solar design, as it is drawn.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Your design, live", description: "Your solar design, as it is drawn.", locale: "en_AU" },
  twitter: { card: "summary", title: "Your design, live", description: "Your solar design, as it is drawn." },
};

/**
 * The customer's live view of their roof being designed during the call (domain/design/live.ts), at the private link
 * the business shares, with no sign-in: only what the customer may see, only while the link is open.
 */
export default async function LiveDesignPage({ params }: PageProps<"/live/[token]">) {
  const { token } = await params;
  return <LiveView token={token} />;
}
