import type { MetadataRoute } from "next";

/**
 * RENUABL on a phone's home screen (21 Nov 2026, Martin: field reps add it from Safari's Share menu and it opens like an
 * app, without the browser's bars). It opens on RENUABL Business's Today.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RENUABL",
    short_name: "RENUABL",
    description: "RENUABL Business: designs, proposals and deals for solar businesses.",
    start_url: "/design",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#2b2d31",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
