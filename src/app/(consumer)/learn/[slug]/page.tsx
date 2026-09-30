import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideBody, GuideCard, GuideCta, GuideFrame } from "@/components/consumer/guide-page";
import { GUIDES, LEARN_NAME, guideBySlug } from "@/lib/domain/guides";
import { publicSiteUrl } from "@/lib/domain/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/learn/${guide.slug}` },
    openGraph: { type: "article", title: guide.title, description: guide.summary, modifiedTime: guide.updated },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const site = publicSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    dateModified: guide.updated,
    mainEntityOfPage: `${site}/learn/${guide.slug}`,
    author: { "@type": "Organization", name: "RENUABL", url: site },
    publisher: { "@type": "Organization", name: "RENUABL", url: site },
  };
  const more = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 2);
  const updated = new Date(`${guide.updated}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <GuideFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/learn" className="tap-area text-[13px] text-forest underline-offset-4 hover:underline">
        {LEARN_NAME}
      </Link>
      <article>
        <p className="mt-6 text-[13px] text-muted">
          {guide.topic} · {guide.minutes} min read · Updated {updated}
        </p>
        <h1 className="mt-2 text-[34px] font-normal leading-[1.08] tracking-[-0.035em] lg:text-[44px]">{guide.title}</h1>
        <p className="mt-4 text-[18px] leading-relaxed text-muted">{guide.summary}</p>
        <GuideBody blocks={guide.body} />
      </article>
      <GuideCta />
      <h2 className="mt-12 text-[19px] font-normal">Keep reading</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {more.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
    </GuideFrame>
  );
}
