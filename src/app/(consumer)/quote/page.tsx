import type { Metadata } from "next";
import Link from "next/link";
import { LegalFooter } from "@/components/consumer/legal-page";
import { QuickQuote } from "@/components/consumer/quick-quote";
import { Wordmark } from "@/components/ui/primitives";
import { QUOTE_COPY } from "@/lib/domain/quick-quote";

export const metadata: Metadata = {
  title: QUOTE_COPY.title,
  description: QUOTE_COPY.description,
  alternates: { canonical: "/quote" },
  // Setting openGraph here replaces the site-wide one, so repeat the share image and site details.
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: QUOTE_COPY.title,
    description: QUOTE_COPY.description,
    url: "/quote",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RENUABL: a healthier home, powered by the sun" }],
  },
};

/**
 * The ad landing page: nothing to click away to, just the quick questions. `?for=battery` starts with
 * "A battery for my solar" chosen (for the battery ads).
 */
export default async function QuotePage({ searchParams }: PageProps<"/quote">) {
  const params = await searchParams;
  const preset = params.for === "battery" ? "battery-existing" : undefined;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-center px-5 lg:h-16">
        <Link href="/" aria-label="RENUABL home">
          <Wordmark className="text-[19px] tracking-[0.12em]" />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-16 pt-4 sm:pt-10">
        <QuickQuote preset={preset} />
      </main>
      <LegalFooter />
    </div>
  );
}
