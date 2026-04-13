import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Self-hosted image optimization (PR #13): product images are pre-optimized
    // with sharp during sync and stored in Supabase Storage. Brand logos are
    // pre-sized 128x128 PNGs in /public. Nothing here needs Vercel's optimizer,
    // which has a hard monthly quota. Setting this globally prevents future
    // <Image> additions from accidentally hitting /_next/image and breaking
    // the site once quota is exhausted.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.com" },
      { protocol: "https", hostname: "cdn.accentuate.io" },
      { protocol: "https", hostname: "img.logo.dev" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ],
};

export default nextConfig;
