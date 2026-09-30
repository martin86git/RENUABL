import type { Metadata } from "next";
import { GuideCard, GuideCta, GuideFrame } from "@/components/consumer/guide-page";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { GUIDES, GUIDES_TAGLINE } from "@/lib/domain/guides";

export const metadata: Metadata = {
  title: "Energy guides from Revo: solar, batteries and rebates in plain English",
  description: "Plain-language guides to sizing solar from your bill, home batteries and Victorian rebates. " + GUIDES_TAGLINE,
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return (
    <GuideFrame wide>
      <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">Energy intelligence from Revo</p>
      <h1 className="mt-3 max-w-3xl text-[38px] font-normal leading-[1.05] tracking-[-0.04em] lg:text-[56px]">
        Solar, batteries and rebates, in plain English.
      </h1>
      <p className="mt-4 max-w-2xl text-[16px] text-muted lg:text-[17px]">{GUIDES_TAGLINE}</p>
      <div className="mt-4">
        <AskRenuabl context="learn" variant="link" title="Got a question? Chat with Revo" />
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
      <div className="mx-auto max-w-2xl">
        <GuideCta />
      </div>
    </GuideFrame>
  );
}
