import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained server bundle (its own minimal
  // node_modules + server.js) independent of the full repo - this is what
  // the Electron desktop build packages and runs locally. Harmless on
  // Vercel too: Vercel's own build pipeline does not depend on this output
  // mode and deploys exactly as before.
  output: "standalone",
};

export default nextConfig;
