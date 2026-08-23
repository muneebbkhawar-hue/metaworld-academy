import type { MetadataRoute } from "next";

// Enables "Add to Home Screen" installability on Android/Chrome (and gives
// iOS/Safari a consistent icon/name via the apple-* meta tags in
// app/layout.tsx, since iOS does not read this manifest directly). No
// service worker is registered anywhere in this app - see the comment on
// SITE_URL below for why that's a deliberate choice, not an oversight.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MetaWorld Research Academy",
    short_name: "MetaWorld",
    description: "Cochrane-aligned meta-analysis and systematic review toolkit.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
