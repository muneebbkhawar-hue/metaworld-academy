import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://metaworld-academy.vercel.app";

// Every real, publicly-linked route in the app - kept as a flat, explicit
// list (not auto-discovered) so this never silently includes an internal
// API route or a route that only exists as a component/test.
const ROUTES = [
  "",
  "/tools",
  "/tools/synthesis",
  "/tools/bias",
  "/tools/grade",
  "/tools/sensitivity",
  "/tools/tsa",
  "/tools/network-meta-analysis",
  "/tools/meta-regression",
  "/tools/risk-of-bias",
  "/tools/statistical-conversions",
  "/tools/collage-maker",
  "/tools/file-converter",
  "/tools/data-extraction",
  "/tools/km-digitizer",
  "/publications",
  "/mentorship",
  "/blog",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
