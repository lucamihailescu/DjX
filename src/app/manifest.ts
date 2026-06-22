import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import type { MetadataRoute } from "next";

// Append a short content hash to a /public icon URL so updated artwork busts
// the browser/CDN cache (mirrors how Next hashes the file-based app icons).
// Generated at build time; falls back to the bare path if the file is missing.
function hashed(file: string): string {
  try {
    const buf = readFileSync(join(process.cwd(), "public", file));
    const h = createHash("md5").update(buf).digest("hex").slice(0, 8);
    return `/${file}?${h}`;
  } catch {
    return `/${file}`;
  }
}

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DjX — Music for the AI era",
    short_name: "DjX",
    description:
      "A modern web UI for exploring and controlling your Spotify, with an AI playlist builder.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    orientation: "portrait-primary",
    categories: ["music", "entertainment"],
    icons: [
      { src: hashed("icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: hashed("icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: hashed("icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
