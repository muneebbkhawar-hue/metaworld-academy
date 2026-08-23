import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained server bundle (its own minimal
  // node_modules + server.js) that the Electron desktop build packages and
  // runs locally. IMPORTANT: this must NOT be set on Vercel - confirmed by
  // a real failed production build (Error: ENOENT .../next-server.js.nft.json)
  // after this was first added unconditionally. Vercel's own build
  // pipeline has its own output handling and is incompatible with
  // "standalone" mode's restructured .next directory. Only the desktop
  // build script (package.json's "desktop:build") sets DESKTOP_BUILD=1, so
  // this only activates there - the Vercel/normal `next build` path is
  // completely unaffected.
  ...(process.env.DESKTOP_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
