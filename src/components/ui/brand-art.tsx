import Image from "next/image";
import { cn } from "./primitives";

/*
 * Brand artwork. The files in /public/brand are crops from the design
 * mockups and are placeholders: swap in the original high-resolution
 * renders and licensed photography, keeping the same file names.
 */

type MascotPose = "hero" | "confirm" | "dark" | "avatar";

const MASCOT: Record<MascotPose, { src: string; w: number; h: number }> = {
  hero: { src: "/brand/mascot-hero.webp", w: 552, h: 784 },
  confirm: { src: "/brand/mascot-confirm.webp", w: 450, h: 244 },
  dark: { src: "/brand/mascot-dark.webp", w: 236, h: 240 },
  avatar: { src: "/brand/mascot-avatar.webp", w: 120, h: 120 },
};

/** The RENUABL mascot — a soft, friendly character, never labelled "AI". */
export function Mascot({
  pose = "hero",
  className,
  float = false,
  priority = false,
}: {
  pose?: MascotPose;
  className?: string;
  float?: boolean;
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
      className={cn("select-none", pose !== "avatar" && pose !== "dark" && "art-blend", float && "animate-float", className)}
    />
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
  "heat-pump": "/brand/product-heatpump.webp",
  "smart-switchboard": "/brand/product-switchboard.webp",
  "home-backup": "/brand/product-backup.webp",
  "smart-home": "/brand/product-smarthome.webp",
};
