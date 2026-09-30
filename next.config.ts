import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 90 is for photos where sharpness matters (the home page package photos); 75 is the default.
  images: { qualities: [75, 90] },
};

export default nextConfig;
