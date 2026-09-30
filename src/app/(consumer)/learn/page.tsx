import type { Metadata } from "next";
import { GuideCard, GuideCta, GuideFrame } from "@/components/consumer/guide-page";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { GUIDES, GUIDES_TAGLINE, GUIDE_TOPICS, LEARN_NAME } from "@/lib/domain/guides";

export const metadata: Metadata = {
  title: "Learn with Revo: solar, batteries and rebates in plain English",
  description: "Plain-language guides to sizing solar from your bill, home batteries and Victorian rebates. " + GUIDES_TAGLINE,
  alternates: { canonical: "/learn" },
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: "Learn with Revo: solar, batteries and rebates in plain English",
    url: "/learn",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function LearnPage() {
  return (
    <GuideFrame wide>
      <p className="text-[13px] tracking-[0.02em] text-forest lg:text-[14px]">{LEARN_NAME}</p>
      <h1 className="mt-3 max-w-3xl text-[38px] font-normal leading-[1.05] tracking-[-0.04em] lg:text-[56px]">
        Solar, batteries and rebates, in plain English.
      </h1>
      <p className="mt-4 max-w-2xl text-[16px] text-muted lg:text-[17px]">{GUIDES_TAGLINE}</p>
      <div className="mt-4">
        <AskRenuabl context="learn" variant="link" title="Got a question? Chat with Revo" />
      </div>
      {GUIDE_TOPICS.map((topic) => {
        const guides = GUIDES.filter((g) => g.topic === topic);
        if (!guides.length) return null;
        return (
          <section key={topic} className="mt-10">
            <h2 className="text-[20px] font-normal tracking-[-0.02em]">{topic}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((g) => (
                <GuideCard key={g.slug} guide={g} />
              ))}
            </div>
          </section>
        );
      })}
      <div className="mx-auto max-w-2xl">
        <GuideCta />
      </div>
    </GuideFrame>
  );
}
