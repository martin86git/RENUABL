"use client";

import { Map as MapIcon, Quote, Star } from "lucide-react";
import { useState } from "react";
import { HomePhoto } from "@/components/ui/brand-art";
import { cn } from "@/components/ui/primitives";
import { getProofPoints, getTestimonials } from "@/lib/services/consumer";

/** 50,000+ homes powered · 4.9★ · coverage — the design's proof strip. */
export function ProofStats({ className }: { className?: string }) {
  const p = getProofPoints();
  return (
    <dl className={cn("grid grid-cols-3 gap-3", className)}>
      <div>
        <dt className="sr-only">Homes powered</dt>
        <dd className="text-[17px] font-medium tracking-tight">{p.homesPowered}</dd>
        <dd className="text-[11px] leading-tight text-muted">homes powered</dd>
      </div>
      <div>
        <dt className="sr-only">Rating</dt>
        <dd className="flex items-center gap-1 text-[17px] font-medium tracking-tight">
          {p.rating} <Star className="h-4 w-4 fill-ink" strokeWidth={0} aria-hidden />
        </dd>
        <dd className="text-[11px] leading-tight text-muted">from {p.reviews} reviews</dd>
      </div>
      <div>
        <dt className="sr-only">Coverage</dt>
        <dd>
          <MapIcon className="h-6 w-6 text-ink-2" strokeWidth={1.3} aria-hidden />
        </dd>
        <dd className="text-[11px] leading-tight text-muted">{p.coverage}</dd>
      </div>
    </dl>
  );
}

/** Right-hand confidence layer on desktop: real homes, the promise, proof, a customer voice. */
export function BrandAside() {
  const testimonials = getTestimonials();
  const [i, setI] = useState(0);
  const t = testimonials[i];

  return (
    <div className="sticky top-6 space-y-7">
      <HomePhoto src="/brand/home-hero.webp" className="aspect-[3/4] w-full rounded-xl" sizes="260px" priority />
      <p className="font-serif text-[21px] font-light leading-[1.3] text-ink">
        Cleaner homes.
        <br />
        Lower bills.
        <br />A brighter future.
      </p>
      <ProofStats />
      <figure className="rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-soft)]">
        <blockquote className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 fill-ink-2 text-ink-2" strokeWidth={0} aria-hidden />
          <p>{t.quote}</p>
        </blockquote>
        <figcaption className="mt-4 flex items-center gap-2.5 text-[12px] text-muted">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sage text-[11px] font-medium text-forest">{t.author[0]}</span>
          {t.author}
        </figcaption>
      </figure>
      <div className="flex justify-center gap-2" role="tablist" aria-label="Customer stories">
        {testimonials.map((x, n) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={n === i}
            aria-label={`Story ${n + 1}`}
            onClick={() => setI(n)}
            className={cn("h-1.5 w-1.5 rounded-full", n === i ? "bg-ink" : "bg-line-strong")}
          />
        ))}
      </div>
    </div>
  );
}
