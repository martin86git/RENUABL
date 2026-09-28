"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HomePhoto, homeBannerFor, homePhotoFor } from "@/components/ui/brand-art";
import { cn } from "@/components/ui/primitives";
import type { Job } from "@/lib/domain/types";

/** An image error can happen before the page is interactive, when onError can't see it: check once mounted. */
function useLoadFailure() {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return { ref, failed, fail: () => setFailed(true) };
}

/**
 * A job's picture: the satellite view of the roof (Google) for a partner's own
 * accepted job; a stock home photo for offers (the aerial would give away the
 * address), the sample portal, or when the view can't be loaded.
 */
export function JobPhoto({
  job,
  live,
  size = "thumb",
  className,
  sizes,
}: {
  job: Pick<Job, "id" | "recordKey" | "offer">;
  live: boolean;
  size?: "wide" | "thumb";
  className?: string;
  sizes?: string;
}) {
  const { ref, failed, fail } = useLoadFailure();
  const fallback = size === "wide" ? homeBannerFor(job.id) : homePhotoFor(job.id);
  if (!live || job.offer || failed) return <HomePhoto src={fallback} className={className} sizes={sizes} />;
  return (
    <span className={cn("relative block overflow-hidden bg-surface-2", className)}>
      <Image
        src={`/api/jobs/${job.recordKey}/roof?size=${size}`}
        alt="Satellite view of the roof"
        fill
        unoptimized
        sizes={sizes}
        className="object-cover"
        ref={ref}
        onError={fail}
      />
    </span>
  );
}

/** A large satellite view with its source, for the site section. */
export function RoofView({ job, live }: { job: Pick<Job, "id" | "recordKey" | "offer">; live: boolean }) {
  const { ref, failed, fail } = useLoadFailure();
  if (!live || job.offer || failed) return null;
  return (
    <figure>
      <span className="relative block aspect-[16/9] overflow-hidden rounded-xl border border-line bg-surface-2">
        <Image
          src={`/api/jobs/${job.recordKey}/roof?size=wide`}
          alt="Satellite view of the roof"
          fill
          unoptimized
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          ref={ref}
          onError={fail}
        />
      </span>
      <figcaption className="mt-1.5 text-[12px] text-muted">
        Satellite view of the roof · Google. Check the roof on site: imagery can be dated.
      </figcaption>
    </figure>
  );
}
