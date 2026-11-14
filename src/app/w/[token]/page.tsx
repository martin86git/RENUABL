import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WALKTHROUGH_NOTE, lengthWords } from "@/lib/domain/design/walkthrough";
import { watchByToken } from "@/lib/server/design-walkthroughs";

/** Kept out of search, and never telling the page it links to where the visitor came from: the address is the key. */
export const metadata: Metadata = {
  title: { absolute: "Your design walkthrough" },
  description: "A recorded walkthrough of your solar design.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    title: "Your design walkthrough",
    description: "A recorded walkthrough of your solar design.",
    locale: "en_AU",
  },
  twitter: { card: "summary", title: "Your design walkthrough", description: "A recorded walkthrough of your solar design." },
};

/**
 * A recorded walkthrough at its own private link (walkthrough.ts), what a text to the customer opens: the business
 * talking them through their design, Sol's subtitles on, and the way to their proposal when one is out. The page is the
 * business's: nothing of RENUABL's, no ad tags.
 */
export default async function WatchPage({ params }: PageProps<"/w/[token]">) {
  await connection();
  const { token } = await params;
  const found = await watchByToken(token).catch(() => null);
  if (!found) notFound();
  const video = `/api/w/${token}/video`;
  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-canvas px-4 py-8 sm:py-14">
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">{found.business}</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink sm:text-[36px]">
        {found.firstName ? `${found.firstName}, here's your design` : "Here's your design"}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        A walkthrough from {found.business} · {lengthWords(found.seconds)}
      </p>
      <figure className="mt-6 overflow-hidden rounded-[18px] bg-ink">
        <video src={video} controls playsInline preload="metadata" className="aspect-video w-full bg-ink">
          <track kind="captions" src={`${video}?vtt=1`} srcLang="en" label="Subtitles" default />
        </video>
        <figcaption className="bg-surface px-4 py-2.5 text-[12px] text-muted">{WALKTHROUGH_NOTE}</figcaption>
      </figure>
      {found.proposal && (
        <a
          href={`/p/${found.proposal}`}
          className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-3 text-[15px] font-medium text-primary-ink hover:brightness-110"
        >
          See your proposal
        </a>
      )}
    </main>
  );
}
