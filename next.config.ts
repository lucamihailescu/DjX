import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We run on 127.0.0.1 (Spotify requires the loopback IP, not "localhost"),
  // so allow HMR/dev resources from that host.
  allowedDevOrigins: ["127.0.0.1"],
  // better-sqlite3 is a native module — keep it out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
