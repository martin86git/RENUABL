import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BriefFlow } from "@/components/brief/brief-flow";
import { cleanBriefAnswers, isBriefKey } from "@/lib/domain/brief";
import { getBrief } from "@/lib/server/briefs-repo";
import { dbConfigured } from "@/lib/server/db";

// A private link: never indexed, never passed on to other sites, no ad tags (not a pixelAllowedPath).
export const metadata: Metadata = {
  title: "Your home solar plan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** The guided brief staff text to a lead (/admin → Send a brief). */
export default async function BriefPage({ params }: PageProps<"/brief/[key]">) {
  await connection();
  const { key } = await params;
  if (!isBriefKey(key) || !dbConfigured()) notFound();
  const brief = await getBrief(key);
  if (!brief) notFound();
  return (
    <BriefFlow
      briefKey={key}
      firstName={brief.first_name}
      mobile={brief.mobile}
      email={brief.email}
      initialAnswers={cleanBriefAnswers(brief.answers)}
      booked={brief.status === "booked" ? brief.call_label : null}
    />
  );
}
