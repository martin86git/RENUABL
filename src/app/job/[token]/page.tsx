import type { Metadata } from "next";
import { InstallerJobCard } from "@/components/design/job-card";

/** Kept out of search, and never tells a page it links to where it came from: the address is the key to it. */
export const metadata: Metadata = {
  title: { absolute: "Job card" },
  description: "An installation's job card.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Job card", description: "An installation's job card.", locale: "en_AU" },
  twitter: { card: "summary", title: "Job card", description: "An installation's job card." },
};

/**
 * An installation's job card on the installer's phone, at their private link with no sign-in
 * (domain/design/job-card.ts): only that job, only while they are on the business's file, never the customer's email.
 */
export default async function InstallerJobCardPage({ params }: PageProps<"/job/[token]">) {
  const { token } = await params;
  return <InstallerJobCard token={token} />;
}
