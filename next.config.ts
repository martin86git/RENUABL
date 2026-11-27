import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 90 is for photos where sharpness matters (the home page package photos); 75 is the default.
  images: { qualities: [75, 90] },
  // RENUABL's own launch pictures are kept out of public/ (nobody can open them by address); the route that adds them to
  // RENUABL's Marketing reads them from disk, so the deployed function must carry the folder.
  outputFileTracingIncludes: {
    "/api/design/marketing/gtm": ["./marketing/launch/*"],
    "/api/design/marketing/updates": ["./marketing/launch/*"],
  },
  // RENUABL Business moved from /business to the front page (19 Nov 2026, Martin). Old links and ads still land on it,
  // their query (utm tags) carried across; /business/demo stays where it is.
  async redirects() {
    return [{ source: "/business", destination: "/", permanent: true }];
  },
};

export default nextConfig;
