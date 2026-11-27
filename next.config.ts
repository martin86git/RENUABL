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
  // their query (utm tags) carried across. /business/demo was the self-serve demo's page; nobody opens a demo account
  // themselves any more (27 Nov 2026, Martin), so its links land on the front page with the Book a demo box open
  // (DEMO_PAGE.bookPath in domain/design/demo.ts), utm tags kept.
  async redirects() {
    return [
      { source: "/business", destination: "/", permanent: true },
      { source: "/business/demo", destination: "/?demo=1", permanent: false },
    ];
  },
};

export default nextConfig;
