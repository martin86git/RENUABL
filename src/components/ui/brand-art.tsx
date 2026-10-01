import { Sun } from "lucide-react";
import Image from "next/image";
import { cn } from "./primitives";

/*
 * Brand artwork. mascot-hero and mascot-avatar come from the original
 * high-resolution mascot render. The other files in /public/brand are crops
 * from the design mockups and are placeholders: swap in the original renders
 * and licensed photography, keeping the same file names.
 */

type MascotPose = "hero" | "battery" | "dark" | "avatar";

const MASCOT: Record<MascotPose, { src: string; w: number; h: number }> = {
  hero: { src: "/brand/mascot-hero.webp", w: 900, h: 908 },
  battery: { src: "/brand/mascot-battery.webp", w: 900, h: 900 },
  dark: { src: "/brand/mascot-dark.webp", w: 236, h: 240 },
  avatar: { src: "/brand/mascot-avatar.webp", w: 240, h: 240 },
};

/** The RENUABL mascot — a soft, friendly character, never labelled "AI". */
export function Mascot({
  pose = "hero",
  className,
  float = false,
  bounce = false,
  priority = false,
}: {
  pose?: MascotPose;
  className?: string;
  float?: boolean;
  /** A slow, gentle bounce (slower than it looks: customers read beside it). */
  bounce?: boolean;
  priority?: boolean;
}) {
  const m = MASCOT[pose];
  return (
    <Image
      src={m.src}
      width={m.w}
      height={m.h}
      alt=""
      aria-hidden
      priority={priority}
      className={cn(
        "select-none",
        pose !== "avatar" && pose !== "dark" && "art-blend",
        float && "animate-float",
        bounce && "animate-bounce-soft",
        className,
      )}
    />
  );
}

/**
 * Loading: the mascot spinning a sun in its hand, with a short line. Fills a
 * 4:3 box on the page colour (the mascot's multiply blend needs a backdrop).
 */
export function MascotLoading({
  label,
  cover = false,
}: {
  label: string;
  /** Cover the image it's waiting for, instead of a 4:3 box. */ cover?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-xl bg-canvas",
        cover ? "absolute inset-0" : "aspect-[4/3]",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative block w-28 sm:w-32">
        <Mascot pose="hero" className="h-auto w-full" />
        <Sun
          className="absolute left-[56%] top-[20%] h-[34%] w-[34%] animate-[spin_2.4s_linear_infinite] text-warning motion-reduce:animate-none"
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <span className="px-4 text-center text-[14px] text-muted">{label}</span>
    </div>
  );
}

export function MascotAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full bg-surface-2", className)}>
      <Image src={MASCOT.avatar.src} fill sizes="64px" alt="" aria-hidden className="object-cover" />
    </span>
  );
}

export const HOME_PHOTOS = [
  "/brand/home-1.webp",
  "/brand/home-2.webp",
  "/brand/home-3.webp",
  "/brand/home-4.webp",
  "/brand/home-5.webp",
  "/brand/home-6.webp",
];

/** A stable home photo for a job or household id (placeholder imagery). */
export function homePhotoFor(id: string) {
  const digits = Number(id.replace(/\D/g, "")) || id.length;
  return HOME_PHOTOS[digits % 5];
}

/** Larger home photos for full-width banners (the thumbnails are too small to stretch). */
export function homeBannerFor(id: string) {
  const banners = ["/brand/home-hero.webp", "/brand/home-5.webp", "/brand/home-6.webp"];
  return banners[(Number(id.replace(/\D/g, "")) || id.length) % banners.length];
}

export function HomePhoto({
  src,
  className,
  sizes = "200px",
  priority = false,
}: {
  src: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-surface-2", className)}>
      <Image src={src} fill sizes={sizes} alt="" aria-hidden priority={priority} className="object-cover" />
    </span>
  );
}

export const PRODUCT_IMAGES: Record<string, string> = {
  "heat-pump": "/brand/product-heatpump.svg",
  "reverse-cycle": "/brand/product-reverse-cycle.svg",
  // Surge protection is fitted in the switchboard.
  "surge-protection": "/brand/product-switchboard.svg",
  "home-backup": "/brand/product-backup.svg",
  "smart-home": "/brand/product-smarthome.svg",
};
