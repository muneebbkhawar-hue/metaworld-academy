import type { MetadataRoute } from "next";

// Falls back to the current Vercel deployment URL if no custom domain has
// been configured yet - set NEXT_PUBLIC_SITE_URL once one is (see
// DEPLOYMENT.md) so this (and sitemap.ts) point at the real production
// domain instead.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://metaworld-academy.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
