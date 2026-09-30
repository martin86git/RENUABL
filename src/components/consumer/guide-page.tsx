import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { LegalFooter } from "@/components/consumer/legal-page";
import { MascotAvatar } from "@/components/ui/brand-art";
import { ButtonLink } from "@/components/ui/primitives";
import { LEARN_NAME, type Guide, type GuideBlock } from "@/lib/domain/guides";
import { REVO_PAGE_LINES } from "@/lib/domain/revo";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";

/** The reading frame for Revo's guides: the wordmark header, a centred column and the legal footer. */
export function GuideFrame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className={`mx-auto w-full flex-1 px-5 pb-16 pt-6 sm:px-8 lg:pt-12 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>
      <LegalFooter />
      <AskRenuabl context="learn" variant="revo" page line={REVO_PAGE_LINES.learn} />
    </div>
  );
}

export function GuideBody({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-2">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h2 key={i} className="pt-4 text-[21px] font-normal tracking-[-0.02em] text-ink">
              {b.text}
            </h2>
          );
        if (b.type === "list")
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((item) => (
                <li key={item} className="ml-5 list-disc">
                  {item}
                </li>
              ))}
            </ul>
          );
        if (b.type === "note")
          return (
            <p key={i} className="rounded-2xl bg-sage px-5 py-4 text-[14.5px] text-forest">
              {b.text}
            </p>
          );
        if (b.type === "tip")
          return (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-4 shadow-[var(--shadow-soft)]">
              <MascotAvatar className="h-9 w-9 shrink-0" />
              <p className="text-[15px] leading-relaxed text-ink-2">
                <span className="block text-[13px] font-medium text-forest">Revo&apos;s tip</span>
                {b.text}
              </p>
            </div>
          );
        if (b.type === "link")
          return (
            <p key={i}>
              {b.href.startsWith("/") ? (
                <Link href={b.href} className="tap-area text-forest underline underline-offset-4">
                  {b.text}
                </Link>
              ) : (
                <a href={b.href} target="_blank" rel="noopener noreferrer" className="tap-area text-forest underline underline-offset-4">
                  {b.text}
                </a>
              )}
            </p>
          );
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

/** Three guides on the home page, so the guides are easy to find. */
export function GuidesStrip({ guides }: { guides: Guide[] }) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-10">
        <div>
          <p className="text-[13px] tracking-[0.02em] text-sun-ink">{LEARN_NAME}</p>
          <h2 className="mt-1 text-[28px] font-normal tracking-[-0.03em] lg:text-[34px]">New to solar? Start here.</h2>
        </div>
        <Link
          href="/learn"
          className="tap-area inline-flex items-center gap-1.5 text-[14px] text-forest underline-offset-4 hover:underline"
        >
          See all guides <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
        </Link>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {guides.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
    </section>
  );
}

/** "The short answer" at the top of every guide: a reader who stops here still has the answer. */
export function ShortAnswer({ text }: { text: string }) {
  return (
    <aside className="mt-6 flex items-start gap-3 rounded-[var(--radius-card)] bg-sage px-5 py-5 text-forest">
      <MascotAvatar className="h-10 w-10 shrink-0" />
      <div>
        <p className="text-[13px] font-medium">The short answer</p>
        <p className="mt-1 text-[16.5px] leading-relaxed">{text}</p>
      </div>
    </aside>
  );
}

/** Every guide ends by inviting the reader to see their own home's numbers. */
export function GuideCta() {
  return (
    <section className="mt-12 rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <h2 className="text-[24px] font-normal tracking-[-0.03em]">See what this means for your home.</h2>
      <p className="mt-2 text-[15px] text-muted">Enter your address and upload your bill. Your system, priced in about two minutes.</p>
      <ButtonLink href="/" className="mt-5">
        Start with your address <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
      </ButtonLink>
    </section>
  );
}

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link
      href={`/learn/${guide.slug}`}
      className="flex flex-col rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <span className="text-[12.5px] text-forest">
        {guide.topic} · {guide.minutes} min read
      </span>
      <span className="mt-2 text-[19px] leading-snug tracking-[-0.02em] text-ink">{guide.title}</span>
      <span className="mt-2 text-[14.5px] text-muted">{guide.summary}</span>
    </Link>
  );
}
