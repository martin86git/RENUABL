import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { JobDrawing } from "@/lib/domain/design/job-card";
import { jobCard } from "@/lib/server/design-job-card-repo";
import { listDealFiles } from "@/lib/server/design-pulse-repo";
import { siteByToken } from "@/lib/server/design-site-link";

/** Kept out of search, and never tells a page it links to where it came from: the address is the key to it. */
export const metadata: Metadata = {
  title: { absolute: "Installation" },
  description: "The panel layout and site photos for an installation.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Installation", description: "The panel layout and site photos.", locale: "en_AU" },
  twitter: { card: "summary", title: "Installation", description: "The panel layout and site photos." },
};

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const head = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

function Drawing({ title, drawing, picture }: { title: string; drawing: JobDrawing; picture: string | null }) {
  return (
    <figure>
      <figcaption className={head}>{title}</figcaption>
      <svg viewBox={drawing.viewBox} className="mt-2 block h-auto w-full rounded-lg bg-[#1f2937]" role="img" aria-label={title}>
        {picture && <image href={picture} x={0} y={0} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
        {/* Made on the server from the design's numbers and fixed words only. */}
        <g dangerouslySetInnerHTML={{ __html: drawing.marks }} />
      </svg>
    </figure>
  );
}

/**
 * A job's site page, opened from the install calendar event with no sign-in (24 Nov 2026, Martin): the panel layout,
 * the string design, and the photos and files kept on the deal (the switchboard, where the battery goes). The
 * installer's side of the job card: the customer's name and phone, never their email, and nothing of the price.
 */
export default async function SitePage({ params }: PageProps<"/site/[token]">) {
  await connection();
  const { token } = await params;
  const link = await siteByToken(token).catch(() => null);
  if (!link) notFound();
  const [card, files] = await Promise.all([
    jobCard({ businessId: link.businessId, businessName: link.businessName }, link.jobId, true).catch(() => null),
    listDealFiles(link.businessId, link.jobId).catch(() => null),
  ]);
  if (!card) notFound();
  const base = `/api/site/${token}`;
  const picture = card.roof ? `${base}/roof` : null;
  const photos = (files ?? []).filter((f) => f.type.startsWith("image/"));
  const papers = (files ?? []).filter((f) => !f.type.startsWith("image/"));

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto max-w-2xl space-y-7">
        <header>
          <p className="text-[13px] text-muted">{card.business}</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{card.job.address}</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {card.job.installDate ? `Installing ${longDate(card.job.installDate)}` : "No installation date yet"}
            {card.system.kw ? ` · ${card.system.kw} kW solar` : ""}
            {card.system.batteryKwh ? ` · ${card.system.batteryKwh} kWh battery` : ""}
          </p>
          <p className="mt-2 text-[14px]">
            {card.customer.name}
            {card.customer.phone && (
              <>
                {" · "}
                <a href={`tel:${card.customer.phone.replace(/\s/g, "")}`} className="underline underline-offset-4">
                  {card.customer.phone}
                </a>
              </>
            )}
          </p>
        </header>

        {card.layout ? (
          <Drawing title="Panel layout" drawing={card.layout} picture={picture} />
        ) : (
          <section>
            <p className={head}>Panel layout</p>
            <p className="mt-1.5 text-[14px] text-muted">No roof design for this job yet.</p>
          </section>
        )}
        {card.strings && <Drawing title="String design" drawing={card.strings} picture={picture} />}
        {card.stringWords.length > 0 && (
          <ul className="-mt-4 space-y-0.5 text-[13px] text-ink-2">
            {card.stringWords.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <section>
          <p className={head}>Photos and files</p>
          {photos.length + papers.length === 0 && <p className="mt-1.5 text-[14px] text-muted">None kept on this job yet.</p>}
          {photos.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((f) => (
                <a
                  key={f.id}
                  href={`${base}/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from the link's own job only */}
                  <img src={`${base}/files/${f.id}`} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-2 py-1 text-[11.5px] text-ink-2">{f.name}</span>
                </a>
              ))}
            </div>
          )}
          {papers.map((f) => (
            <a key={f.id} href={`${base}/files/${f.id}`} className="mt-2 block truncate text-[14px] text-ink underline underline-offset-4">
              {f.name}
            </a>
          ))}
        </section>

        <p className="text-[12px] text-muted">
          A private link from {card.business}. Anyone with it can see this page, so please don&apos;t share it further.
        </p>
      </div>
    </main>
  );
}
